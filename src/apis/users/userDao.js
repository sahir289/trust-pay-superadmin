import { tableName } from '../../constants/index.js';
import { buildSearchFilterObj } from '../../utils/searchBuilder.js';
import {
  buildSelectQuery,
  buildUpdateQuery,
  executeQuery,
  buildJoinQuery,
  buildInsertQuery,
} from '../../utils/db.js';
import { logger } from '../../utils/logger.js';

export const getUsersContactDao = async (company_id, contact_no) => {
  try {
    const sql = `
      SELECT id
      FROM "${tableName.USER}" 
      WHERE is_obsolete = FALSE
        AND company_id = $1
        AND contact_no = $2
    `;
    const result = await executeQuery(sql, [company_id, contact_no]);
    return result.rows.length > 0;
  } catch (error) {
    logger.error('Error executing user contact query:', error);
    throw error;
  }
};

const getUsersDao = async (
  filters,
  page,
  pageSize,
  sortBy,
  sortOrder,
  columns = [],
) => {
  try {
    const { USER, ROLE, DESIGNATION } = tableName;
    const joins = [
      {
        table: ROLE,
        // first is source key
        // second is target key
        keys: ['role_id', 'id'],
        type: 'JOIN',
        columns: ['role'],
        columnAs: [`"${ROLE}".role AS Role`],
      },
      {
        table: DESIGNATION,
        // first is source key
        // second is target key
        keys: [`designation_id`, 'id'],
        type: 'LEFT JOIN',
        columnAs: [`"${DESIGNATION}".designation AS Designation`],
        referenceTable: USER,
      },
    ];
    const baseQuery = buildJoinQuery(
      USER,
      columns.length ? columns : '*',
      joins,
    );
    if (filters.search) {
      filters.or = buildSearchFilterObj(filters.search, USER);
      delete filters.search;
    }
    //TODO: columns.ROLE dynamic search
    const [sql, queryParams] = buildSelectQuery(
      baseQuery,
      filters,
      page,
      pageSize,
      sortBy,
      sortOrder,
      USER,
    );

    const result = await executeQuery(sql, queryParams);
    return result.rows;
  } catch (error) {
    logger.error('Error in get Users Dao:', error);
    throw error;
  }
};

const getAllUsersDao = async (
  filters,
  page,
  pageSize,
  sortBy,
  sortOrder,
  columns = [],
) => {
  try {
    const { USER, ROLE, DESIGNATION } = tableName;
    const joins = [
      {
        table: ROLE,
        // first is source key
        // second is target key
        keys: ['role_id', 'id'],
        type: 'JOIN',
        columns: ['role'],
        columnAs: [`"${ROLE}".role AS Role`],
      },
      {
        table: DESIGNATION,
        // first is source key
        // second is target key
        keys: [`designation_id`, 'id'],
        type: 'LEFT JOIN',
        columnAs: [`"${DESIGNATION}".designation AS Designation`],
        referenceTable: USER,
      },
    ];
    const baseQuery = buildJoinQuery(
      USER,
      columns.length ? columns : '*',
      joins,
    );
    if (filters.search) {
      filters.or = buildSearchFilterObj(filters.search, USER);
      delete filters.search;
    }
    //TODO: columns.ROLE dynamic search
    const [sql, queryParams] = buildSelectQuery(
      baseQuery,
      filters,
      page,
      pageSize,
      sortBy,
      sortOrder,
      USER,
    );

    const result = await executeQuery(sql, queryParams);
    return result.rows;
  } catch (error) {
    logger.error('Error in get Users Dao:', error);
    throw error;
  }
};

export const getUsersBySearchDao = async (
  filters,
  searchTerms,
  pageNumber = 1, 
  pageSize = 10, 
) => {
  try {
    const conditions = [];
    const values = [];
    let paramIndex = 1;

    const validatedPageSize = Math.min(
      Math.max(parseInt(pageSize) || 10, 1),
      100,
    ); // Enforce 1-100 limit
    const validatedPageNumber = Math.max(parseInt(pageNumber) || 1);
    const offset = (validatedPageNumber - 1) * validatedPageSize;

    let queryText = `
      SELECT 
        "User".id,
        "User".role_id,
        "User".designation_id,
        "User".first_name,
        "User".last_name,
        "User".email,
        "User".contact_no,
        "User".user_name,
        "User".code,
        "User".is_enabled,
        "User".last_login,
        "User".last_logout,
        "User".config,
        "User".created_by,
        "User".updated_by,
        "User".created_at,
        "User".updated_at,
        "User".first_name || ' ' || "User".last_name AS full_name,
        c.first_name || ' ' || c.last_name AS company,
        "Designation".designation AS Designation 
      FROM "User" 
      LEFT JOIN "Designation" ON "User".designation_id = "Designation".id 
      LEFT JOIN public."Company" c
        ON "User".company_id = c.id
      WHERE 1=1 
        AND "User".is_obsolete = false 
    `;

    // Add company_id filter only if present in filters
    if (filters.company_id) {
      if (typeof filters.company_id === 'string' && filters.company_id.includes(',')) {
        const arr = filters.company_id.split(',').map(v => v.trim()).filter(Boolean);
        queryText += ` AND "User"."company_id" = ANY($${paramIndex})`;
        values.push(arr);
        paramIndex++;
      } else if (Array.isArray(filters.company_id)) {
        queryText += ` AND "User"."company_id" = ANY($${paramIndex})`;
        values.push(filters.company_id);
        paramIndex++;
      } else {
        queryText += ` AND "User"."company_id" = $${paramIndex}`;
        values.push(filters.company_id);
        paramIndex++;
      }
    }

    if (filters.id) {
      if (Array.isArray(filters.id)) {
        const placeholders = filters.id
          .map((_, i) => `$${paramIndex + i}`)
          .join(', ');
        queryText += ` AND "User"."id" IN (${placeholders})`;
        values.push(...filters.id);
        paramIndex += filters.id.length;
      } else {
        queryText += ` AND "User"."id" = $${paramIndex}`;
        values.push(filters.id);
        paramIndex++;
      }
    }

    if (searchTerms) {
      searchTerms.forEach((term) => {
        if (term.toLowerCase() === 'true' || term.toLowerCase() === 'false') {
          const boolValue = term.toLowerCase() === 'true';
          conditions.push(`"User".is_enabled = $${paramIndex}`);
          values.push(boolValue);
          paramIndex++;
        } else {
          conditions.push(`
            (
              LOWER("User".id::text) LIKE LOWER($${paramIndex})
              OR LOWER("User".role_id::text) LIKE LOWER($${paramIndex})
              OR LOWER("User".designation_id::text) LIKE LOWER($${paramIndex})
              OR LOWER("User".first_name) LIKE LOWER($${paramIndex})
              OR LOWER("User".last_name) LIKE LOWER($${paramIndex})
              OR LOWER("User".email) LIKE LOWER($${paramIndex})
              OR LOWER("User".contact_no) LIKE LOWER($${paramIndex})
              OR LOWER("User".user_name) LIKE LOWER($${paramIndex})
              OR LOWER("User".code) LIKE LOWER($${paramIndex})
              OR LOWER("User".created_by::text) LIKE LOWER($${paramIndex})
              OR LOWER("User".updated_by::text) LIKE LOWER($${paramIndex})
              OR LOWER("User".first_name || ' ' || "User".last_name) LIKE LOWER($${paramIndex})
              OR LOWER(c.first_name || ' ' || c.last_name) LIKE LOWER($${paramIndex})
              OR LOWER("Designation".designation) LIKE LOWER($${paramIndex})
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

    queryText += `
      ORDER BY "User"."updated_at" DESC
      LIMIT $${paramIndex}
      OFFSET $${paramIndex + 1}
    `;
    values.push(validatedPageSize, offset);

    let searchResult = await executeQuery(queryText, values);
    const totalItems = parseInt(countResult.rows[0].total);
    let totalPages = Math.ceil(totalItems / validatedPageSize);
    if (totalItems > 0 && searchResult.rows.length === 0 && offset > 0) {
      values[values.length - 1] = 0; 
      searchResult = await executeQuery(queryText, values);
      totalPages = Math.ceil(totalItems / validatedPageSize);
    }

    const data = {
      totalCount: totalItems,
      totalPages,
      Users: searchResult.rows,
    };
    return data;
  } catch (error) {
    logger.error(error.message);
    throw error;
  }
};

const getUserByIdDao = async (conn, ids) => {
  try {
    let baseQuery = `
      SELECT 
        u.id, 
        u.first_name, 
        u.last_name, 
        u.email, 
        u.contact_no, 
        u.user_name, 
        u.code, 
        u.is_enabled, 
        u.last_login, 
        u.last_logout, 
        u.config, 
        u.created_by, 
        u.updated_by, 
        u.created_at, 
        u.updated_at, 
        r.role, 
        d.designation
      FROM public."User" u
      LEFT JOIN public."Role" r ON u.role_id = r.id 
      LEFT JOIN public."Designation" d ON u.designation_id = d.id
      WHERE u.is_obsolete = false
    `;

    let queryParams = [];

    if (ids.id) {
      if (Array.isArray(ids.id)) {
        const placeholders = ids.id
          .map((_, idx) => `$${queryParams.length + idx + 1}`)
          .join(', ');
        baseQuery += ` AND u.id IN (${placeholders})`;
        queryParams.push(...ids.id);
      } else {
        baseQuery += ` AND u.id = $${queryParams.length + 1}`;
        queryParams.push(ids.id);
      }
    }
    if (ids.role_id) {
      baseQuery += ` AND u.role_id = $${queryParams.length + 1}`;
      queryParams.push(ids.role_id);
    }
    if (ids.designation_id) {
      baseQuery += ` AND u.designation_id = $${queryParams.length + 1}`;
      queryParams.push(ids.designation_id);
    }
    if (ids.company_id) {
      baseQuery += ` AND u.company_id = $${queryParams.length + 1}`;
      queryParams.push(ids.company_id);
    }
    const result = await conn.query(baseQuery, queryParams);
    if (result.rowCount === 0) {
      logger.error('No user found with the provided id and filters');
      return [];
    }
    return result.rows;
  } catch (error) {
    logger.error('error getting while fetching user', error);
    throw error;
  }
};

const getUsersByUserNameDao = async (ids, username) => {
  try {
    let baseQuery = `
      SELECT 
        u.id, 
        u.first_name, 
        u.last_name, 
        u.email, 
        u.password,
        u.company_id,
        u.role_id,
        u.designation_id,
        u.contact_no, 
        u.user_name, 
        u.code, 
        u.is_enabled, 
        u.config, 
        u.created_by, 
        u.updated_by, 
        u.created_at, 
        u.updated_at, 
        r.role, 
        d.designation,
        c.config AS company_config 
      FROM public."User" u
      LEFT JOIN public."Role" r ON u.role_id = r.id 
      LEFT JOIN public."Designation" d ON u.designation_id = d.id 
      LEFT JOIN public."Company" c ON u.company_id = c.id
      WHERE u.user_name = $1 AND u.is_obsolete = false
    `;

    const queryParams = [username];
    if (ids.role_id) {
      baseQuery += ` AND u.role_id = $${queryParams.length + 1}`;
      queryParams.push(ids.role_id);
    }
    if (ids.designation_id) {
      baseQuery += ` AND u.designation_id = $${queryParams.length + 1}`;
      queryParams.push(ids.designation_id);
    }
    if (ids.company_id) {
      baseQuery += ` AND u.company_id = $${queryParams.length + 1}`;
      queryParams.push(ids.company_id);
    }

    const result = await executeQuery(baseQuery, queryParams);
    if (result.rowCount === 0) {
      logger.info(`No user found with username: ${username}`);
      return null;
    }
    return result.rows[0];
  } catch (error) {
    logger.error(`Error fetching user by username: ${username}`, error);
    throw error;
  }
};

const createUserDao = async (payload, conn) => {
  try {
    const [sql, params] = buildInsertQuery(tableName.USER, payload);

    let result;
    ///temperary for conn ...in future can excute to query in if condition
    if (conn) {
      result = await conn.query(sql, params);
    } else {
      result = await executeQuery(sql, params);
    }
    logger.info(
      `User with username: ${payload.user_name} created successfully`,
    );

    return result.rows[0];
  } catch (error) {
    logger.error(`Error creating user: ${payload.user_name}`, error);
    throw error;
  }
};

/////no params get all users data
const getUsersForCronDao = async (conn) => {
  try {
    const sql = `SELECT id  FROM public."User" where is_obsolete = false`;
    const result = await conn.query(sql);
    if (result.rows.length === 0) {
      logger.info('No users Found');
      return [];
    }
    return result.rows;
  } catch (error) {
    logger.error('error getting users', error);
    throw error;
  }
};

const updateUserDao = async (ids, data, conn) => {
  try {
    const [sql, params] = buildUpdateQuery(tableName.USER, data, ids);

    if (conn && conn.query) {
      const result = await conn.query(sql, params);
      return result.rows[0];
    }

    const result = await executeQuery(sql, params);
    return result.rows[0];
  } catch (error) {
    logger.error('Error in updateUserDao:', error);
    throw error;
  }
};

const getAdminUserIdsDao = async (company_id) => {
  try {
    const sql = `
      SELECT id
      FROM "${tableName.USER}"
      WHERE is_obsolete = FALSE
        AND company_id = $1
        AND role_id = (SELECT id FROM "${tableName.ROLE}" WHERE role = 'ADMIN')
    `;
    const result = await executeQuery(sql, [company_id]);
    return result.rows;
  } catch (error) {
    logger.error('Error executing getAdminUsersDao query:', error);
    throw error;
  }
};

const getUserByCompanyCreatedAtDao = async (company_id, role) => {
  try {
    const sql = `
      SELECT u.id, u.created_at
      FROM "User" u
      LEFT JOIN "Company" c ON u."company_id" = c.id
      LEFT JOIN "Role" r ON u."role_id" = r.id
      WHERE u.is_obsolete = FALSE
        AND c.id = $1
        AND r.role = $2
        AND (u.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date = 
            (c.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date;
    `;
    const result = await executeQuery(sql, [company_id, role]);
    return result.rows[0];
  } catch (error) {
    logger.error('Error executing getUserByCompanyCreatedAtDao query:', error);
    throw error;
  }
};

const getUserByRoleDao = async (company_id, role) => {
  try {
    const sql = `
      SELECT u.id
      FROM "${tableName.USER}" u
      LEFT JOIN public."Role" r ON u.role_id = r.id
      WHERE u.is_obsolete = FALSE
        AND u.company_id = $1
        AND r.role = $2
    `;
    const result = await executeQuery(sql, [company_id, role]);
    return result.rows;
  } catch (error) {
    logger.error('Error executing getUserByCompanyCreatedAtDao query:', error);
    throw error;
  }
};

export {
  getUsersDao,
  getAllUsersDao,
  getUserByIdDao,
  getUsersForCronDao,
  getUsersByUserNameDao,
  getAdminUserIdsDao,
  getUserByCompanyCreatedAtDao,
  getUserByRoleDao,
  createUserDao,
  updateUserDao,
};
