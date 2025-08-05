import { Role, tableName } from '../../constants/index.js';
import {
  buildInsertQuery,
  buildSelectQuery,
  buildUpdateQuery,
  executeQuery,
} from '../../utils/db.js';
// import { buildSearchFilterObj } from '../../utils/searchBuilder.js';
import { logger } from '../../utils/logger.js';

export const createVendorDao = async (data, conn) => {
  try {
    const [sql, params] = buildInsertQuery(tableName.VENDOR, data);
    if (conn && conn.query) {
      const result = await conn.query(sql, params);
      return result.rows[0];
    }
    const result = await executeQuery(sql, params);
    return result.rows[0];
  } catch (error) {
    logger.error('Error in create Vendor Dao:', error);
    throw error;
  }
};

export const getVendorsCodeDao = async (filters, conn) => {
  try {
    let sql = `
        SELECT 
            code AS label, 
            user_id AS value, 
            id AS vendor_id 
        FROM 
            "${tableName.VENDOR}" 
        WHERE 
            is_obsolete = FALSE 
    `;
    const queryParams = [];
    let paramIndex = 1;
    if (filters.company_id) {
      sql += ` AND "Vendor".company_id = $${paramIndex++}`;
      queryParams.push(filters.company_id);
    }
    sql = sql.replace(/\s*ORDER BY\s+.*$/i, '') + ' ORDER BY "code" ASC';
    const result = await conn.query(sql, queryParams);
    logger.log('Fetched Vendors:', result.rows.length, 'rows');
    return result.rows;
  } catch (error) {
    logger.error('Error executing vendor query:', error);
    throw error;
  }
};

export const getVendorsDao = async (
  filters,
  page = 1,
  pageSize = 10,
  sortBy = 'created_at',
  sortOrder = 'DESC',
  role,
) => {
  try {
    let baseQuery;
    // Build base query based on role
    // Define columns to select
    const columns = [
      `"Vendor".id`,
      `"Vendor".user_id`,
      `"Vendor".first_name`,
      `"Vendor".last_name`,
      `"Vendor".code`,
      `"Vendor".payin_commission`,
      `"Vendor".payout_commission`,
      `"Vendor".created_at`,
      `"Vendor".updated_at`,
      `user_main.first_name || ' ' || user_main.last_name AS full_name`,
      `d.designation AS designation_name`,
      `(SELECT net_balance FROM "Calculation" WHERE "Calculation".user_id = "Vendor".user_id ORDER BY "Calculation".updated_at DESC LIMIT 1) AS balance`,
    ];

    // Add extra columns for admin
    if (role === Role.ADMIN || role === Role.SUPER_ADMIN) {
      columns.push(
        `"Vendor".created_by`,
        `"Vendor".updated_by`,
        `"Vendor".company_id`,
        `user_main.designation_id`,
        `u.user_name AS created_by`,
        `uu.user_name AS updated_by`,
      );
    }

    // Build FROM/JOIN clause
    let fromClause = `
      FROM "Vendor"
      JOIN "User" AS user_main ON "Vendor".user_id = user_main.id
      LEFT JOIN "Designation" AS d ON user_main.designation_id = d.id
    `;

    if (role === Role.ADMIN || role === Role.SUPER_ADMIN) {
      fromClause += `
      LEFT JOIN "User" AS u ON "Vendor".created_by = u.id
      LEFT JOIN "User" AS uu ON "Vendor".updated_by = uu.id
      `;
    }

    // Build WHERE clause
    let whereClause = `
      WHERE "Vendor".is_obsolete = false
    `;
    if (role === Role.ADMIN || role === Role.SUPER_ADMIN) {
      whereClause += `
      AND user_main.designation_id = (SELECT id FROM "Designation" WHERE designation = 'VENDOR')
      `;
    }

    baseQuery = `
      SELECT ${columns.join(',\n')}
      ${fromClause}
      ${whereClause}
    `;
    const value = [];
    let paramIndex = 1;

    if (filters.id) {
      baseQuery += `
      AND "Vendor".id = $${paramIndex}
    `;
      value.push(filters.id);
      paramIndex++;
    }

    const [query, values] = buildSelectQuery(
      baseQuery,
      filters,
      page,
      pageSize,
      sortBy,
      sortOrder,
      'Vendor',
    );
    const result = await executeQuery(query, values);
    return result.rows;
  } catch (error) {
    logger.error('Error in getVendorsDao:', error);
    throw error;
  }
};

export const getAllVendorsDao = async (
  filters,
  page = 1,
  pageSize = 10,
  sortBy = 'created_at',
  sortOrder = 'DESC',
  role,
) => {
  try {
    let baseQuery;
    // Build base query based on role
    // Define columns to select
    const columns = [
      `"Vendor".id`,
      `"Vendor".first_name`,
      `"Vendor".last_name`,
      `"Vendor".code`,
      `"Vendor".payin_commission`,
      `"Vendor".payout_commission`,
      `"Vendor".created_at`,
      `"Vendor".updated_at`,
      `user_main.first_name || ' ' || user_main.last_name AS full_name`,
      `d.designation AS designation_name`,
      `(SELECT net_balance FROM "Calculation" WHERE "Calculation".user_id = "Vendor".user_id ORDER BY "Calculation".updated_at DESC LIMIT 1) AS balance`,
    ];

    // Add extra columns for admin
    if (role === Role.ADMIN || role === Role.SUPER_ADMIN) {
      columns.push(
        `"Vendor".created_by`,
        `"Vendor".updated_by`,
        `"Vendor".user_id`,
        `"Vendor".company_id`,
        `user_main.designation_id`,
        `u.user_name AS created_by`,
        `uu.user_name AS updated_by`,
      );
    }

    // Build FROM/JOIN clause
    let fromClause = `
      FROM "Vendor"
      JOIN "User" AS user_main ON "Vendor".user_id = user_main.id
      LEFT JOIN "Designation" AS d ON user_main.designation_id = d.id
    `;

    if (role === Role.ADMIN || role === Role.SUPER_ADMIN) {
      fromClause += `
      LEFT JOIN "User" AS u ON "Vendor".created_by = u.id
      LEFT JOIN "User" AS uu ON "Vendor".updated_by = uu.id
      `;
    }

    // Build WHERE clause
    let whereClause = `
      WHERE "Vendor".is_obsolete = false
    `;
    if (role === Role.ADMIN || role === Role.SUPER_ADMIN) {
      whereClause += `
      AND user_main.designation_id = (SELECT id FROM "Designation" WHERE designation = 'VENDOR')
      `;
    }

    baseQuery = `
      SELECT ${columns.join(',\n')}
      ${fromClause}
      ${whereClause}
    `;
    const value = [];
    let paramIndex = 1;

    if (filters.id) {
      baseQuery += `
      AND "Vendor".id = $${paramIndex}
    `;
      value.push(filters.id);
      paramIndex++;
    }

    const [query, values] = buildSelectQuery(
      baseQuery,
      filters,
      page,
      pageSize,
      sortBy,
      sortOrder,
      'Vendor',
    );
    const result = await executeQuery(query, values);
    return result.rows;
  } catch (error) {
    logger.error('Error in getVendorsDao:', error);
    throw error;
  }
};

export const getVendorsBySearchDao = async (
  filters,
  pageNumber,
  pageSize,
  searchTerms,
) => {
  try {
    const conditions = [];
    const values = [];
    let paramIndex = 1;

    // Build base SELECT columns based on role
    const columns = [
      `"Vendor".id`,
      `"Vendor".first_name`,
      `"Vendor".last_name`,
      `"Vendor".code`,
      `"Vendor".payin_commission`,
      `"Vendor".payout_commission`,
      `"Vendor".created_at`,
      `"Vendor".updated_at`,
      `"user_main".first_name || ' ' || "user_main".last_name AS full_name`,
      `"d".designation AS designation_name`,
      `c.first_name || ' ' || c.last_name AS company`,
      `(SELECT net_balance FROM "Calculation" WHERE "Calculation".user_id = "Vendor".user_id ORDER BY "Calculation".created_at DESC LIMIT 1) AS balance`,
    ];

    // Add extra columns for admin
    if (filters.role === Role.ADMIN || filters.role === Role.SUPER_ADMIN) {
      columns.push(
        `"Vendor".created_by`,
        `"Vendor".updated_by`,
        `"Vendor".user_id`,
        `"Vendor".company_id`,
        `"user_main".designation_id`,
        `u.user_name AS created_by`,
        `uu.user_name AS updated_by`,
      );
    }

    let queryText = `
      SELECT 
      ${columns.join(',\n')}
      FROM "Vendor"
      JOIN "User" AS user_main ON "Vendor".user_id = user_main.id
      LEFT JOIN "Designation" AS d ON user_main.designation_id = d.id
      LEFT JOIN public."Company" c
        ON "Vendor".company_id = c.id
      ${
        filters.role === Role.ADMIN || filters.role === Role.SUPER_ADMIN
          ? `LEFT JOIN "User" AS u ON "Vendor".created_by = u.id
         LEFT JOIN "User" AS uu ON "Vendor".updated_by = uu.id`
          : ''
      }
      WHERE "Vendor".is_obsolete = false
    `;

    // Add company_id filter only if present in filters
    if (filters.company_id) {
      queryText += ` AND "Vendor"."company_id" = $${paramIndex}`;
      values.push(filters.company_id);
      paramIndex++;
    }

    if (filters.user_id) {
      queryText += ` AND "Vendor"."user_id" = $${paramIndex}`;
      values.push(filters.user_id);
      paramIndex += 1;
    }

    if (searchTerms) {
      searchTerms.forEach((term) => {
        if (term.toLowerCase() === 'true' || term.toLowerCase() === 'false') {
          const boolValue = term.toLowerCase() === 'true';
          conditions.push(`
            ("Vendor".config->>'is_enabled')::boolean = $${paramIndex}
          `);
          values.push(boolValue);
          paramIndex++;
        } else {
          conditions.push(`
            (
              LOWER("Vendor".id::text) LIKE LOWER($${paramIndex})
              OR LOWER("Vendor".user_id::text) LIKE LOWER($${paramIndex})
              OR LOWER("Vendor".first_name) LIKE LOWER($${paramIndex})
              OR LOWER("Vendor".last_name) LIKE LOWER($${paramIndex})
              OR LOWER("Vendor".code) LIKE LOWER($${paramIndex})
              OR "Vendor".payin_commission::text LIKE $${paramIndex}
              OR "Vendor".payout_commission::text LIKE $${paramIndex}
              OR LOWER("Vendor".created_by::text) LIKE LOWER($${paramIndex})
              OR LOWER("Vendor".updated_by::text) LIKE LOWER($${paramIndex})
              OR LOWER("user_main".first_name || ' ' || "user_main".last_name) LIKE LOWER($${paramIndex})
              OR LOWER(c.first_name || ' ' || c.last_name) LIKE LOWER($${paramIndex})
              OR LOWER("d".designation) LIKE LOWER($${paramIndex})
              OR LOWER("Vendor".config->>'utr') LIKE LOWER($${paramIndex})
              OR (
                SELECT net_balance::text 
                FROM "Calculation" 
                WHERE "Calculation".user_id = "Vendor".user_id 
                ORDER BY "Calculation".created_at DESC 
                LIMIT 1
              ) LIKE $${paramIndex}
            )
          `);
          values.push(`%${term}%`);
          paramIndex++;
        }
      });
    }

    if (conditions.length > 0) {
      queryText += ' AND (' + conditions.join(' OR ') + ')';
    }

    const countQuery = `SELECT COUNT(*) as total FROM (${queryText}) as count_table`;
    const countResult = await executeQuery(countQuery, values);

    // Calculate offset - pageNumber is 1-based
    const offset = (pageNumber - 1) * pageSize;

    queryText += `
      ORDER BY "Vendor"."updated_at" DESC
      LIMIT $${paramIndex}
      OFFSET $${paramIndex + 1}
    `;
    values.push(pageSize, offset);
    let searchResult = await executeQuery(queryText, values);
    // Calculate pagination metadata
    const totalItems = parseInt(countResult.rows[0].total);
    let totalPages = Math.ceil(totalItems / pageSize);
    if (totalItems > 0 && searchResult.rows.length === 0 && offset > 0) {
      values[values.length - 1] = 0;
      searchResult = await executeQuery(queryText, values);
      totalPages = Math.ceil(totalItems / pageSize);
    }
    const data = {
      totalCount: totalItems,
      totalPages,
      Vendors: searchResult.rows,
    };
    return data;
  } catch (error) {
    logger.error(error.message);
    throw error;
  }
};

export const updateVendorDao = async (id, data, conn) => {
  try {
    const [sql, params] = buildUpdateQuery(tableName.VENDOR, data, id);
    if (conn && conn.query) {
      const result = await conn.query(sql, params);
      return result.rows[0];
    }
    const result = await executeQuery(sql, params);
    return result.rows[0];
  } catch (error) {
    logger.error('Error in updateVendorDao:', error);
    throw error;
  }
};

export const deleteVendorDao = async (conn, id, data) => {
  try {
    const [sql, params] = buildUpdateQuery(tableName.VENDOR, data, id);
    const result = await conn.query(sql, params);
    return result.rows[0];
  } catch (error) {
    logger.error('Error in deleteVendorDao:', error);
    throw error;
  }
};

export const updateVendorBalanceDao = async (
  filters,
  valueToAdd,
  updated_by,
  conn,
) => {
  try {
    const [sql, params] = buildUpdateQuery(
      tableName.VENDOR,
      { balance: valueToAdd, updated_by },
      filters,
      { balance: '+' },
    );
    if (conn && conn.query) {
      const result = await conn.query(sql, params);
      return result.rows[0];
    }
    const result = await executeQuery(sql, params);
    return result[0];
  } catch (error) {
    logger.error('Error in updateVendorBalanceDao:', error);
    throw error;
  }
};

export const getVendorsDaoArray = async (company_id, code) => {
  try {
    let baseQuery = `
      SELECT 
       "Vendor".id, 
        "Vendor".user_id, 
        "Vendor".first_name, 
        "Vendor".last_name, 
        "Vendor".code, 
        "Vendor".payin_commission, 
        "Vendor".payout_commission, 
        "Vendor".config, 
        "Vendor".created_by, 
        "Vendor".updated_by, 
        "Vendor".created_at, 
        "Vendor".updated_at, 
        "User".designation_id, 
        "User".first_name || ' ' || "User".last_name AS full_name, 
          "Designation".designation AS designation_name,
         (
          SELECT net_balance 
          FROM "Calculation" 
          WHERE "Calculation".user_id = "Vendor".user_id 
          ORDER BY "Calculation".updated_at DESC 
          LIMIT 1
        ) AS balance
           FROM "Vendor" 
      JOIN "User" ON "Vendor".user_id = "User".id 
      LEFT JOIN "Designation" ON "User".designation_id = "Designation".id 
      WHERE "Vendor".is_obsolete = false 
      AND "Vendor"."company_id" = $1
      AND "Vendor".user_id = ANY($2)
    `;

    let queryParams = [company_id, code];
    const result = await executeQuery(baseQuery, queryParams);
    return result.rows;
  } catch (error) {
    logger.error('Error fetching merchant by code and API key:', error);
    throw error;
  }
};
