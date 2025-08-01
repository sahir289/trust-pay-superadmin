/* eslint-disable no-unused-vars */
import pkg from 'pg';
import config from '../config/config.js';
import chalk from 'chalk';
import { DbError } from './appErrors.js';
import { logger } from './logger.js';
import { stringifyJSON } from './index.js';
// import fs from 'fs';
// import path from 'path';
// import { fileURLToPath } from 'url';
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);
const { Pool } = pkg;

const pool = new Pool({
  connectionString: `${config.databaseUrl}`,
  ssl:
    config.env === 'production'
      ? {
          rejectUnauthorized: false,
          // ca: fs.readFileSync(path.join(__dirname, '/Users/mac/Downloads/ap-south-1-bundle.pem')).toString(),
        }
      : { rejectUnauthorized: false },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  keepAlive: true,
});

pool.on('connect', (client) => {
  client.query('SET TIME ZONE \'Asia/Kolkata\'');
});

pool.on('error', async (err) => {
  logger.error('Unexpected error on idle client:', err);

  let retryCount = 0;
  const maxRetries = 5;
  const baseDelay = config.env === 'production' ? 5000 : 2000;

  while (retryCount < maxRetries) {
    const delay = baseDelay * Math.pow(2, retryCount);
    logger.warn(
      `Reconnecting to DB (Attempt ${retryCount + 1}) in ${delay / 1000}s...`,
    );

    await new Promise((resolve) => setTimeout(resolve, delay));

    try {
      const newClient = await pool.connect();
      newClient.release();
      logger.info('Database reconnected successfully!');
      return;
    } catch (retryErr) {
      logger.error(`Reconnection attempt ${retryCount + 1} failed:`, retryErr);
    }

    retryCount++;
  }
  logger.error(
    'All DB reconnection attempts failed. The database remains unreachable.',
  );
});

const getConnection = async () => {
  const maxRetries = 5;
  const baseDelay = 2000;

  for (let retryCount = 0; retryCount < maxRetries; retryCount++) {
    try {
      const client = await pool.connect();
      logger.info(chalk.bgCyanBright('Database connected successfully'));
      return client;
    } catch (error) {
      const delay = baseDelay * Math.pow(2, retryCount);
      logger.error(`Error fetching database connection:`, error);
      logger.warn(
        chalk.yellow(
          `DB connection failed (Attempt ${retryCount + 1}). Retrying in ${delay / 1000}s...`,
        ),
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  logger.error('Database connection failed after multiple retries');
  throw new DbError('Database connection error');
};

export async function closePool() {
  try {
    await pool.end();
    const styledMessageError = chalk.underline.red(`PostgreSQL connection pool closed`);
    logger.info(styledMessageError);
  } catch (err) {
    logger.error('Error while closing PostgreSQL pool:', err);
  }
}

const beginTransaction = async (client) => {
  try {
    await client.query('BEGIN');
    logger.info('Transaction started');
  } catch (error) {
    logger.error('Error starting transaction', error);
    throw new DbError('Failed to start transaction');
  }
};

const commit = async (client) => {
  try {
    await client.query('COMMIT');
    logger.info('Transaction committed');
  } catch (error) {
    logger.error('Error committing transaction', error);
    throw new DbError('Failed to commit transaction');
  }
};

const rollback = async (client, throwError = true) => {
  try {
    await client.query('ROLLBACK');
    logger.info('Transaction rolled back');
  } catch (error) {
    logger.error('Error rolling back transaction', error);
    if (throwError) {
      throw new DbError('Failed to rollback transaction');
    }
  }
};

export const executeQuery = async (query, queryParams = []) => {
  const maxRetries = 3; // Number of retries for transient errors
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await pool.query(query, queryParams);
      return result;
    } catch (error) {
      logger.error(`Error while executing query (Attempt ${attempt}):`, error);
      logger.error(`\nQuery: ${query}\nParams: [${queryParams}]`);

      // Retry only for transient errors
      if (
        error.message.includes('Connection terminated unexpectedly') &&
        attempt < maxRetries
      ) {
        logger.warn(`Retrying query (Attempt ${attempt + 1})...`);
        await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second before retrying
        continue;
      }

      // Throw error if retries are exhausted or error is not transient
      throw new DbError(error.message);
    }
  }
};

export const buildSelectQuery = (
  baseQuery,
  filters,
  page,
  pageSize,
  sortBy,
  sortOrder,
  tableName,
) => {
  const prefix = tableName ? `"${tableName}".` : '';
  let query = baseQuery;
  let values = [];
  let conditions = [`${prefix}is_obsolete = false`];

  for (const key in filters) {
    const value = filters[key];
    if (key === 'or' || key === 'page' || key === 'limit') {
      continue;
    }

    if (['startDate', 'endDate'].includes(key)) {
      continue;
    }

    if (key.startsWith('config_') && key.endsWith('_contains')) {
      const variablePart = key.replace('config_', '').replace('_contains', '');
      const jsonColumn = `
        COALESCE(
          CASE 
            WHEN json_typeof(${prefix}"config"->'${variablePart}') = 'array' 
            THEN ARRAY(SELECT json_array_elements_text(${prefix}"config"->'${variablePart}'))
            ELSE ARRAY[(${prefix}"config"->>'${variablePart}')::text]
          END,
          ARRAY[]::text[]
        )`;
      conditions.push(`$${values.length + 1} = ANY(${jsonColumn})`);
      values.push(value);
    } else if (Array.isArray(value)) {
      conditions.push(`${prefix}"${key}" = ANY($${values.length + 1})`);
      values.push(value);
    } else {
      conditions.push(`${prefix}"${key}" = $${values.length + 1}`);
      values.push(value);
    }
  }

  // Handle startDate and endDate
  if (filters?.startDate && filters?.endDate) {
    const startDate = new Date(filters.startDate).toISOString().split('T')[0];
    const endDate = new Date(filters.endDate).toISOString().split('T')[0];
    conditions.push(
      `${prefix}"created_at" BETWEEN $${values.length + 1} AND $${values.length + 2}`,
    );
    values.push(startDate, endDate);
  }

  // Add WHERE conditions
  if (conditions?.length) {
    if (query.toLowerCase().includes('where')) {
      query += ` AND ${conditions.join(' AND ')}`;
    } else {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }
  }

  if (filters?.or && typeof filters?.or === 'object') {
    const orConditions = [];
    for (const key in filters.or) {
      const value = filters.or[key];
      if (Array.isArray(value)) {
        orConditions.push(`${prefix}"${key}" = ANY($${values.length + 1})`);
      } else {
        orConditions.push(`${prefix}"${key}" = $${values.length + 1}`);
      }
      values.push(value);
    }
    query += ` AND (${orConditions.join(' OR ')})`;
  }

  // Apply sorting and pagination
  query = applySortingAndPagination(
    query,
    values,
    sortBy,
    sortOrder,
    page,
    pageSize,
    prefix,
  );
  return [query, values];
};

export const applySortingAndPagination = (
  query,
  values,
  sortBy,
  sortOrder,
  page,
  pageSize,
  prefix,
) => {
  // Validate sort order
  const order =
    (sortOrder && sortOrder.toUpperCase()) === 'ASC' ? 'ASC' : 'DESC';

  // Detect if sortBy is a raw SQL expression (contains space, operator, parentheses, comma)
  let sortClause;
  if (!sortBy) {
    sortClause = `${prefix}"created_at" ${order}`;
  } else if (/\s|\|\||\+|\(|\)|,/.test(sortBy)) {
    // Raw SQL expression, do not quote
    sortClause = `${sortBy} ${order}`;
  } else {
    // Simple column name, quote it
    sortClause = `${prefix}"${sortBy}" ${order}`;
  }
  query += ` ORDER BY ${sortClause}`;

  // Add pagination if values are passed
  if (Number(page) && Number(pageSize)) {
    const offset = (page - 1) * pageSize;
    query += ` LIMIT $${values.length + 1} OFFSET $${values.length + 2}`;
    values.push(pageSize, offset);
  }

  return query;
};

export const buildInsertQuery = (tableName, data) => {
  const keys = Object.keys(data).map((key) => `"${key}"`);
  const values = keys.map((el, i) => `$${i + 1}`);
  const query = `INSERT INTO "${tableName}" (${keys.join(', ')}) VALUES (${values}) RETURNING *`;
  return [query, Object.values(data)];
};

// specialFields { balance: "+" }
// whereCondition { id: 1 }
// data { balance: 1000 }
export const buildUpdateQuery = (
  tableName,
  data,
  whereCondition,
  specialFields = {},
  options = { returnUpdated: true }, // Option to control RETURNING clause
) => {
  const values = [];
  const setClause = Object.entries(data).map(([key, value]) => {
    values.push(value);
    return specialFields[key]
      ? `"${key}" = "${key}" ${specialFields[key]} $${values.length}` // Use specified operator (e.g., "+", "-")
      : `"${key}" = $${values.length}`;
  });

  const whereClause = Object.entries(whereCondition).map(([key, value]) => {
    values.push(value);
    return `"${key}" = $${values.length}`;
  });

  const returningClause = options.returnUpdated ? 'RETURNING *' : '';

  const query = `UPDATE "${tableName}" SET ${setClause.join(', ')} WHERE ${whereClause.join(' AND ')} ${returningClause}`;
  return [query, values];
};

export const buildAndExecuteUpdateQuery = async (
  tableName,
  data,
  whereCondition,
  specialFields = {},
  options = { returnUpdated: true }, // Option to control RETURNING clause
  conn = null, // Optional database connection
) => {
  try {
    const values = [];
    const setClause = [];
    let index = 1;

    // Handle nested JSON updates for `config` or other JSONB columns
    if (data.config && typeof data.config === 'object') {
      let jsonbSetQuery = `"config"::jsonb`;
      const processNestedKeys = (obj, parentKey = []) => {
        Object.entries(obj).forEach(([key, value]) => {
          const currentPath = [...parentKey, key];
          // merging merchant_added object
          if (
            key === 'merchant_added' &&
            typeof value === 'object' &&
            !Array.isArray(value)
          ) {
            const path = currentPath.join(',');
            const mergeSnippet = `coalesce(${jsonbSetQuery}#>'{${path}}', '{}'::jsonb) || $${index}::jsonb`;
            jsonbSetQuery = `jsonb_set(${jsonbSetQuery}, '{${path}}', ${mergeSnippet})`;
            values.push(stringifyJSON(value));
            index++;
          } else if (typeof value === 'object' && !Array.isArray(value)) {
            // Recursively process nested objects
            processNestedKeys(value, currentPath);
          } else {
            // Add jsonb_set for the current key
            const path = currentPath.join(',');
            jsonbSetQuery = `jsonb_set(${jsonbSetQuery}, '{${path}}', $${index}::jsonb)`;
            values.push(stringifyJSON(value));
            index++;
          }
        });
      };

      processNestedKeys(data.config);
      setClause.push(`"config" = ${jsonbSetQuery}`);
      delete data.config; // Remove `config` from the main data object
    }

    // Handle other updates
    Object.entries(data).forEach(([key, value]) => {
      setClause.push(
        specialFields[key]
          ? `"${key}" = "${key}" ${specialFields[key]} $${index}` // Use specified operator (e.g., "+", "-")
          : `"${key}" = $${index}`,
      );
      values.push(value);
      index++;
    });

    // Build the WHERE clause
    const whereClause = Object.entries(whereCondition).map(([key, value]) => {
      values.push(value);
      return `"${key}" = $${index++}`;
    });

    // Add RETURNING clause if required
    const returningClause = options.returnUpdated ? 'RETURNING *' : '';

    // Build the final query
    const query = `UPDATE "${tableName}" SET ${setClause.join(', ')} WHERE ${whereClause.join(' AND ')} ${returningClause}`;

    // Execute the query
    const result = conn
      ? await conn.query(query, values) // Use provided connection
      : await executeQuery(query, values); // Use default pool connection

    if (!result || !result.rows || result.rows.length === 0) {
      logger.warn(
        'No rows updated. Please check the provided IDs and conditions.',
      );
      throw new Error(
        'No rows updated. Please check the provided IDs and conditions.',
      );
    }

    return result.rows[0]; // Return the updated row
  } catch (error) {
    logger.error('Error in buildAndExecuteUpdateQuery:', error);
    throw new Error(error.message || 'Error updating the database.');
  }
};

export const transactionWrapper =
  (fn) =>
  async (...args) => {
    let conn;
    try {
      conn = await getConnection();
      await beginTransaction(conn); // Ensure transaction starts properly

      const data = await fn(conn, ...args); // Ensure fn expects conn as the first argument

      await commit(conn); // Commit only if no errors
      return data;
    } catch (error) {
      if (conn) {
        try {
          await rollback(conn); // Explicit rollback
          logger.error('Transaction rolled back due to error:', error);
        } catch (rollbackError) {
          logger.error('Rollback failed:', rollbackError);
        }
      }
      throw error;
    } finally {
      if (conn) {
        logger.info('Releasing connection');
        conn.release(); // Always release connection
      }
    }
  };

/**
 * Builds a dynamic SQL SELECT query with auto-generated JOIN conditions.
 * @param {string} table - The main table name.
 * @param {Array<string>|"*"} [columns="*"] - Base table columns.
 * @param {Array<Object>} [joins=[]] - Array of join objects.
 *
 * Each join object should have:
 *  - {string} table: The table to join.
 *  - {string} referenceTable: The table to use as baseTable (Optional).
 *  - {string|Array<string>} keys:
 *      - If string → assumes both tables have the same key. (e.g., `"user_id"`)
 *      - If array → assumes [foreignKey, primaryKey]. (e.g., `["user_id", "id"]`)
 *  - {string} [type="JOIN"]: Type of join (e.g., "JOIN", "LEFT JOIN").
 *  - {Array<string>} [columns=[]]: Columns to select from the joined table.
 *  - {Array<string>} [columnAs=[]]: Columns with aliases.
 *
 * @returns {string} - The generated SQL query.
 *
 * @example
 *
 * const sql = buildJoinQuery({
 *   table: "Merchant",
 *   columns: "*",
 *   joins: [
 *     {
 *       table: "User",
 *       keys: "user_id",
 *       type: "JOIN",
 *       columns: ["first_name", "last_name"]
 *     },
 *     {
 *       table: "Designation",
 *       keys: ["designation_id", "id"],
 *       type: "LEFT JOIN",
 *       columnAs: [`"Designation".designation AS designation_name`]
 *     }
 *   ]
 * });
 *
 *
 * // Generates:
 * SELECT "Merchant".*, "User".first_name, "User".last_name, "Designation".designation AS designation_name
 * FROM "Merchant"
 * JOIN "User" ON "Merchant".user_id = "User".user_id
 * LEFT JOIN "Designation" ON "User".designation_id = "Designation".id
 */
export const buildJoinQuery = (table, columns = '*', joins = []) => {
  let selectCols =
    columns === '*'
      ? [`"${table}".*`]
      : columns.map((col) => `"${table}".${col}`);
  let joinClauses = [];

  for (const join of joins) {
    const {
      table: jTable,
      referenceTable: rTable,
      keys,
      type = 'JOIN',
      columns = [],
      columnAs = [],
    } = join;
    const referenceTable = rTable || table;

    // Auto-generate ON condition
    let onCondition = '';
    if (keys) {
      if (typeof keys === 'string') {
        // If keys is a string, use the same key for both tables
        onCondition = `"${referenceTable}".${keys} = "${jTable}".${keys}`;
      } else if (Array.isArray(keys) && keys.length === 2) {
        // If keys is an array, assume different keys for each table
        onCondition = `"${referenceTable}".${keys[0]} = "${jTable}".${keys[1]}`;
      }
    }

    // Add selected columns
    for (const col of columns) {
      selectCols.push(`"${jTable}".${col}`);
    }
    for (const colAs of columnAs) {
      selectCols.push(colAs);
    }

    // Add the JOIN clause
    joinClauses.push(`${type} "${jTable}" ON ${onCondition}`);
  }

  return `SELECT ${selectCols.join(', ')} FROM "${table}" ${joinClauses.join(' ')} WHERE 1=1`;
};

const executePaginatedQuery = async ({
  baseQuery,
  countQuery,
  params = [],
  page = 1,
  limit = 10,
}) => {
  // Convert page and limit to integers
  const pageNum = parseInt(page, 10) || 1;
  const limitNum = parseInt(limit, 10) || 10;
  const offset = (pageNum - 1) * limitNum;
  logger.info(typeof offset, offset, pageNum, 'offset');

  // Base query params include limit and offset
  const validParams = params.filter((param) => param !== undefined);
  const baseQueryParams = [...validParams, limitNum, offset];
  logger.info(baseQueryParams, 'baseQueryParams');
  // Count query params exclude limit and offset
  const countQueryParams = [...params];

  const limitPlaceholder = `$${baseQueryParams.length - 1 + 1}`; // Correct index
  const offsetPlaceholder = `$${baseQueryParams.length + 1}`;

  logger.info(
    `${baseQuery} LIMIT $${limitPlaceholder.length - 1} OFFSET $${offsetPlaceholder.length}`,
    '-------',
  );

  const [result, countResult] = await Promise.all([
    executeQuery(
      `${baseQuery} LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}`,
      baseQueryParams,
    ),
    executeQuery(countQuery, countQueryParams), // Use only the params needed for countQuery
  ]);

  return {
    rows: result.rows,
    totalCount: parseInt(countResult.rows[0].total),
  };
};

const buildSearchConditions = (
  searchTerms,
  searchableFields,
  paramStart = 1,
) => {
  if (!searchTerms?.length)
    return { conditions: [], params: [], nextParam: paramStart };

  const params = [];
  let paramCount = paramStart;

  const conditions = searchTerms.map((term) => {
    const fieldConditions = searchableFields.map(
      (field) => `${field} ILIKE '%' || $${paramCount++} || '%'`,
    );
    params.push(term);
    return `(${fieldConditions.join(' OR ')})`;
  });

  return {
    conditions: conditions.length ? [`(${conditions.join(' AND ')})`] : [],
    params,
    nextParam: paramCount,
  };
};

const buildFilterConditions = (filters, fieldMap, paramStart = 1) => {
  const params = [];
  let paramCount = paramStart;

  const conditions = Object.entries(filters)
    .filter(([_, value]) => value !== undefined && value !== null)
    .map(([key, value]) => {
      const field = fieldMap[key];
      if (!field) return null;
      params.push(value);
      return `${field} = $${paramCount++}`;
    })
    .filter(Boolean);

  return { conditions, params, nextParam: paramCount };
};

const generateQuery = (baseQuery, options = {}) => {
  // Default options
  const {
    tableName = 'CheckUtrHistory',
    sortOrder = 'DESC',
    companyIdParam = '$1',
  } = options;

  // Build the additional conditions
  const additionalConditions = `
      AND "${tableName}".is_obsolete = false 
      AND "${tableName}"."company_id" = ${companyIdParam}
      ORDER BY "${tableName}"."created_at" ${sortOrder}
  `;

  // Combine base query with additional conditions
  const finalQuery = `${baseQuery} ${additionalConditions}`;

  return finalQuery;
};

export {
  pool,
  getConnection,
  beginTransaction,
  commit,
  rollback,
  executePaginatedQuery,
  buildSearchConditions,
  buildFilterConditions,
  generateQuery,
};
