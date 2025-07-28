import { tableName, Role } from '../../constants/index.js';
import {
  buildInsertQuery,
  buildSelectQuery,
  buildUpdateQuery,
  executeQuery,
  buildAndExecuteUpdateQuery,
} from '../../utils/db.js';
import { logger } from '../../utils/logger.js';
import { enhanceMerchantsWithSubMerchants } from '../../utils/enhanceSubMerchant.js';
export const createMerchantDao = async (data, conn) => {
  try {
    delete data.parent_id;
    const [sql, params] = buildInsertQuery(tableName.MERCHANT, data);
    if (conn && conn.query) {
      const result = await conn.query(sql, params);
      return result.rows[0];
    }
    const result = await executeQuery(sql, params);
    return result.rows[0];
  } catch (error) {
    logger.error('Error in createMerchantDao:', error);
    throw error;
  }
};

export const getMerchantsCodeDao = async (
  conn,
  filters,
  includeSubMerchants = false,
  includeOnlyMerchants = false,
) => {
  try {
    //includeSubMerchants  convert string to boolean
    if (includeSubMerchants) {
      includeSubMerchants = includeSubMerchants.toLowerCase() === 'true';
    }
    if (includeOnlyMerchants) {
      includeOnlyMerchants = includeOnlyMerchants.toLowerCase() === 'true';
    }
    let sql = `
      SELECT 
        m.code AS label, 
        m.user_id AS value, 
        m.id AS merchant_id,
        ${
          includeSubMerchants
            ? `
              COALESCE(
                json_agg(
                  json_build_object(
                    'label', sm.code,
                    'value', sm.user_id,
                    'merchant_id', sm.id
                  )
                ) FILTER (WHERE sm.id IS NOT NULL),
                '[]'::json
              ) AS submerchants
            `
            : `'[]'::json AS submerchants`
        }
      FROM 
        "${tableName.MERCHANT}" m
      LEFT JOIN "${tableName.USER_HIERARCHY}" uh 
        ON uh.user_id = m.user_id
      LEFT JOIN "${tableName.MERCHANT}" sm 
        ON sm.user_id IN (
          SELECT json_array_elements_text(uh.config -> 'siblings' -> 'sub_merchants')
          FROM "${tableName.USER_HIERARCHY}" uh_sub
          WHERE uh_sub.user_id = m.user_id
          AND uh_sub.config -> 'siblings' -> 'sub_merchants' IS NOT NULL
        )
        AND sm.company_id = m.company_id
        AND sm.is_obsolete = FALSE
      WHERE 
        m.is_obsolete = FALSE
    `;
    const queryParams = [];
    let paramIndex = 1;
    if (includeOnlyMerchants) {
      sql += `
      AND m.user_id IN (
          SELECT u.id 
          FROM "${tableName.USER}" u
          JOIN "${tableName.DESIGNATION}" d 
            ON u.designation_id = d.id 
          WHERE d.designation = 'MERCHANT'
        )
      `;
    }
    if (filters.company_id) {
      sql += ` AND m.company_id = $${paramIndex++}`;
      queryParams.push(filters.company_id);
    }
    if (filters.user_id) {
      if (Array.isArray(filters.user_id)) {
        sql += ` AND m.user_id = ANY($${paramIndex++})`;
        queryParams.push(filters.user_id);
      } else {
        sql += ` AND m.user_id = $${paramIndex++}`;
        queryParams.push(filters.user_id);
      }
    }

    sql += ` GROUP BY m.id, m.code, m.user_id ORDER BY m.code ASC`;
    const result = await conn.query(sql, queryParams);
    logger.log('Fetched Merchants:', result.rows.length, 'rows');
    return result.rows;
  } catch (error) {
    logger.error('Error executing merchant query:', error);
    throw error;
  }
};
// get merchant with user_id  to get submerchant for user hierachys
export const getMerchantByUserIdDao = async (userId) => {
  try {
    const sql = `
      SELECT 
        "Merchant".id, 
        "Merchant".user_id, 
        "Merchant".first_name, 
        "Merchant".last_name, 
        "Merchant".code, 
        "Merchant".min_payin, 
        "Merchant".max_payin, 
        "Merchant".payin_commission, 
        "Merchant".min_payout, 
        "Merchant".max_payout, 
        "Merchant".payout_commission, 
        "Merchant".is_test_mode, 
        "Merchant".is_enabled, 
        "Merchant".dispute_enabled, 
        "Merchant".is_demo, 
        "Merchant".balance, 
        "Merchant".config, 
        creator.user_name AS created_by, 
        updater.user_name AS updated_by, 
        "Merchant".created_at, 
        "Merchant".updated_at, 
        "User".designation_id, 
        "User".first_name || ' ' || "User".last_name AS full_name, 
        "Designation".designation AS designation_name 
      FROM "Merchant" 
      JOIN "User" ON "Merchant".user_id = "User".id 
      LEFT JOIN "Designation" ON "User".designation_id = "Designation".id
      LEFT JOIN "User" creator ON "Merchant".created_by = creator.id 
      LEFT JOIN "User" updater ON "Merchant".updated_by = updater.id
      WHERE  "Merchant".is_obsolete = false 
      AND "Merchant"."user_id" ${Array.isArray(userId) ? '= ANY($1)' : '= $1'}
      ORDER BY "Merchant"."created_at" ASC;
    `;

    // Query parameters
    const queryParams = [userId];

    // Execute query
    const result = await executeQuery(sql, queryParams);

    // Return the rows (merchant data)
    return result.rows;
  } catch (error) {
    logger.error(
      `Error in getMerchantByUserIdDao for user_id ${userId}:`,
      error,
    );
    throw error;
  }
};

export const getMerchantsDao = async (
  filters,
  page = 1,
  pageSize = 10,
  sortBy = 'created_at',
  sortOrder = 'ASC',
  role,
) => {
  try {
    let baseQuery = `
      SELECT 
        "Merchant".id, 
        "Merchant".user_id, 
        "Merchant".first_name, 
        "Merchant".last_name, 
        "Merchant".code, 
        "Merchant".min_payin, 
        "Merchant".max_payin, 
        "Merchant".payin_commission, 
        "Merchant".min_payout, 
        "Merchant".max_payout, 
        "Merchant".payout_commission, 
        "Merchant".is_test_mode, 
        "Merchant".is_enabled, 
        "Merchant".dispute_enabled, 
        "Merchant".is_demo, 
        "Merchant".config, 
        "Merchant".company_id, 
        creator.user_name AS created_by, 
        updater.user_name AS updated_by, 
        "Merchant".created_at, 
        "Merchant".updated_at, 
        "User".designation_id, 
        "User".first_name || ' ' || "User".last_name AS full_name, 
        "Designation".designation AS designation_name,
        (
          SELECT net_balance 
          FROM "Calculation" 
          WHERE "Calculation".user_id = "Merchant".user_id 
          ORDER BY "Calculation".updated_at DESC 
          LIMIT 1
        ) AS balance
      FROM "Merchant" 
      JOIN "User" ON "Merchant".user_id = "User".id 
      LEFT JOIN "Designation" ON "User".designation_id = "Designation".id
      LEFT JOIN "User" creator ON "Merchant".created_by = creator.id 
      LEFT JOIN "User" updater ON "Merchant".updated_by = updater.id
      WHERE 1=1
    `;

    if (role === Role.ADMIN || role === Role.SUPER_ADMIN) {
      baseQuery += `
        AND "User".designation_id = (
          SELECT id FROM "Designation" WHERE designation = 'MERCHANT'
        )
      `;
    }

    const [sql, queryParams] = buildSelectQuery(
      baseQuery,
      filters,
      page,
      pageSize,
      sortBy,
      sortOrder,
      tableName.MERCHANT,
    );
    const result = await executeQuery(sql, queryParams);
    const data = await enhanceMerchantsWithSubMerchants(result.rows);
    return data;
  } catch (error) {
    logger.error('Error in getMerchantsDao:', error);
    throw error;
  }
};

export const getAllMerchantsDao = async (
  filters,
  page = 1,
  pageSize = 10,
  sortBy = 'created_at',
  sortOrder = 'ASC',
  role,
) => {
  try {
    let baseQuery = `
      SELECT 
        "Merchant".id, 
        "Merchant".user_id, 
        "Merchant".first_name, 
        "Merchant".last_name, 
        "Merchant".code, 
        "Merchant".min_payin, 
        "Merchant".max_payin, 
        "Merchant".payin_commission, 
        "Merchant".min_payout, 
        "Merchant".max_payout, 
        "Merchant".payout_commission, 
        "Merchant".is_test_mode, 
        "Merchant".is_enabled, 
        "Merchant".dispute_enabled, 
        "Merchant".is_demo, 
        "Merchant".config, 
        "Merchant".company_id, 
        creator.user_name AS created_by, 
        updater.user_name AS updated_by, 
        "Merchant".created_at, 
        "Merchant".updated_at, 
        "User".designation_id, 
        "User".first_name || ' ' || "User".last_name AS full_name, 
        "Designation".designation AS designation_name,
        (
          SELECT net_balance 
          FROM "Calculation" 
          WHERE "Calculation".user_id = "Merchant".user_id 
          ORDER BY "Calculation".updated_at DESC 
          LIMIT 1
        ) AS balance
      FROM "Merchant" 
      JOIN "User" ON "Merchant".user_id = "User".id 
      LEFT JOIN "Designation" ON "User".designation_id = "Designation".id
      LEFT JOIN "User" creator ON "Merchant".created_by = creator.id 
      LEFT JOIN "User" updater ON "Merchant".updated_by = updater.id
      WHERE 1=1
    `;

    if (role === Role.ADMIN || role === Role.SUPER_ADMIN) {
      baseQuery += `
        AND "User".designation_id = (
          SELECT id FROM "Designation" WHERE designation = 'MERCHANT'
        )
      `;
    }

    const [sql, queryParams] = buildSelectQuery(
      baseQuery,
      filters,
      page,
      pageSize,
      sortBy,
      sortOrder,
      tableName.MERCHANT,
    );
    const result = await executeQuery(sql, queryParams);
    const data = await enhanceMerchantsWithSubMerchants(result.rows);
    return data;
  } catch (error) {
    logger.error('Error in getMerchantsDao:', error);
    throw error;
  }
};

export const getMerchantsByCodeDao = async (code) => {
  try {
    let baseQuery = `
    SELECT 
      "Merchant".id, 
      "Merchant".user_id, 
      "Merchant".first_name, 
      "Merchant".last_name, 
      "Merchant".code, 
      "Merchant".min_payin, 
      "Merchant".max_payin, 
      "Merchant".payin_commission, 
      "Merchant".payout_commission, 
      "Merchant".min_payout, 
      "Merchant".max_payout, 
      "Merchant".config, 
      "Merchant".company_id, 
      creator.user_name AS created_by, 
      updater.user_name AS updated_by, 
      "Merchant".created_at, 
      "Merchant".updated_at, 
      "User".designation_id, 
      "User".first_name || ' ' || "User".last_name AS full_name, 
      "Designation".designation AS designation_name
    FROM "Merchant" 
    JOIN "User" ON "Merchant".user_id = "User".id 
    LEFT JOIN "Designation" ON "User".designation_id = "Designation".id
    LEFT JOIN "User" creator ON "Merchant".created_by = creator.id 
    LEFT JOIN "User" updater ON "Merchant".updated_by = updater.id
  `;

    let queryParams = [];
    if (code) {
      baseQuery += ` WHERE "Merchant".code = $1`;
      queryParams = [code.trim()];
    }
    const result = await executeQuery(baseQuery, queryParams);
    return result.rows;
  } catch (error) {
    logger.error('Error in getMerchants By Code Dao:', error);
    throw error;
  }
};

export const getMerchantByCodeDao = async (code) => {
  try {
    let baseQuery = `
      SELECT 
        "Merchant".id,
        "Merchant".code, 
        "Merchant".payin_commission, 
        "Merchant".payout_commission,
        "Merchant".min_payin,
        "Merchant".max_payin,
        ("Merchant".config->'keys'->>'public') AS public_key
      FROM "Merchant" 
    `;

    let queryParams = [];
    if (code) {
      baseQuery += ` WHERE "Merchant".code = $1`;
      queryParams = [code.trim()];
    }
    const result = await executeQuery(baseQuery, queryParams);
    return result.rows;
  } catch (error) {
    logger.error('Error in getMerchants By Code Dao:', error);
    throw error;
  }
};

export const getMerchantsBySearchDao = async (
  filters,
  searchTerms,
  limitNum,
  offset,
  role,
) => {
  try {
    const conditions = [];
    const values = [filters.company_id];
    let paramIndex = 2;

    let queryText = `
      SELECT 
        "Merchant".id, 
        "Merchant".user_id, 
        "Merchant".first_name, 
        "Merchant".last_name, 
        "Merchant".code, 
        "Merchant".min_payin, 
        "Merchant".max_payin, 
        "Merchant".payin_commission, 
        "Merchant".min_payout, 
        "Merchant".max_payout, 
        "Merchant".payout_commission, 
        "Merchant".is_test_mode, 
        "Merchant".is_enabled, 
        "Merchant".dispute_enabled, 
        "Merchant".is_demo, 
        "Merchant".config, 
        "Merchant".company_id, 
        creator.user_name AS created_by, 
        updater.user_name AS updated_by, 
        "Merchant".created_at, 
        "Merchant".updated_at, 
        "User".designation_id, 
        "User".first_name || ' ' || "User".last_name AS full_name, 
        "Designation".designation AS designation_name,
        (SELECT net_balance 
         FROM "Calculation" 
         WHERE "Calculation".user_id = "Merchant".user_id 
         ORDER BY "Calculation".updated_at DESC 
         LIMIT 1) AS balance
      FROM "Merchant" 
      JOIN "User" ON "Merchant".user_id = "User".id 
      LEFT JOIN "Designation" ON "User".designation_id = "Designation".id
      LEFT JOIN "User" creator ON "Merchant".created_by = creator.id 
      LEFT JOIN "User" updater ON "Merchant".updated_by = updater.id
      WHERE "Merchant".is_obsolete = false 
      AND "Merchant"."company_id" = $1
    `;

    // Apply designation filter for ADMIN role
    if (role === Role.ADMIN || role === Role.SUPER_ADMIN) {
      queryText += `
        AND (
          "User".designation_id = (SELECT id FROM "Designation" WHERE designation = 'MERCHANT')
          OR "User".designation_id = (SELECT id FROM "Designation" WHERE designation = 'SUB_MERCHANT')
        )
      `;
    }

    // Filter by user_id if provided
    if (filters.user_id) {
      if (Array.isArray(filters.user_id)) {
        const placeholders = filters.user_id
          .map((_, i) => `$${paramIndex + i}`)
          .join(', ');
        queryText += ` AND "Merchant"."user_id" IN (${placeholders})`;
        values.push(...filters.user_id);
        paramIndex += filters.user_id.length;
      } else {
        queryText += ` AND "Merchant"."user_id" = $${paramIndex}`;
        values.push(filters.user_id);
        paramIndex++;
      }
    }

    searchTerms.forEach((term) => {
      if (term.toLowerCase() === 'true' || term.toLowerCase() === 'false') {
        const boolValue = term.toLowerCase() === 'true';
        conditions.push(`
          (
            "Merchant".is_test_mode = $${paramIndex}
            OR "Merchant".is_enabled = $${paramIndex}
            OR "Merchant".dispute_enabled = $${paramIndex}
            OR "Merchant".is_demo = $${paramIndex}
            OR ("Merchant".config->'allow_intent')::boolean = $${paramIndex}
          )
        `);
        values.push(boolValue);
        paramIndex++;
      } else {
        conditions.push(`
          (
            LOWER("Merchant".id::text) LIKE LOWER($${paramIndex})
            OR LOWER("Merchant".user_id::text) LIKE LOWER($${paramIndex})
            OR LOWER("Merchant".first_name) LIKE LOWER($${paramIndex})
            OR LOWER("Merchant".last_name) LIKE LOWER($${paramIndex})
            OR LOWER("Merchant".code) LIKE LOWER($${paramIndex})
            OR "Merchant".min_payin::text LIKE $${paramIndex}
            OR "Merchant".max_payin::text LIKE $${paramIndex}
            OR "Merchant".payin_commission::text LIKE $${paramIndex}
            OR "Merchant".min_payout::text LIKE $${paramIndex}
            OR "Merchant".max_payout::text LIKE $${paramIndex}
            OR "Merchant".payout_commission::text LIKE $${paramIndex}
            OR LOWER(creator.user_name) LIKE LOWER($${paramIndex})
            OR LOWER(updater.user_name) LIKE LOWER($${paramIndex})
            OR LOWER("User".first_name || ' ' || "User".last_name) LIKE LOWER($${paramIndex})
            OR LOWER("Designation".designation) LIKE LOWER($${paramIndex})
            OR LOWER("Merchant".config->'keys'->>'public') LIKE LOWER($${paramIndex})
            OR LOWER("Merchant".config->'keys'->>'private') LIKE LOWER($${paramIndex})
            OR LOWER("Merchant".config->'urls'->>'site') LIKE LOWER($${paramIndex})
            OR LOWER("Merchant".config->'urls'->>'return') LIKE LOWER($${paramIndex})
            OR LOWER("Merchant".config->'urls'->>'payin_notify') LIKE LOWER($${paramIndex})
            OR LOWER("Merchant".config->'urls'->>'payout_notify') LIKE LOWER($${paramIndex})
            OR (
              SELECT net_balance::text 
              FROM "Calculation" 
              WHERE "Calculation".user_id = "Merchant".user_id 
              ORDER BY "Calculation".updated_at DESC 
              LIMIT 1
            ) LIKE $${paramIndex}
          )
        `);
        values.push(`%${term}%`);
        paramIndex++;
      }
    });

    if (conditions.length > 0) {
      queryText += ' AND (' + conditions.join(' OR ') + ')';
    }

    const countQuery = `SELECT COUNT(*) as total FROM (${queryText}) AS count_table`;

    queryText += `
      ORDER BY "Merchant"."created_at" DESC
      LIMIT $${paramIndex}
      OFFSET $${paramIndex + 1}
    `;

    values.push(limitNum, offset);
    const countResult = await executeQuery(countQuery, values.slice(0, -2));
    const searchResult = await executeQuery(queryText, values);

    // Calculate pagination metadata
    const totalItems = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(totalItems / limitNum);

    // Enhance with sub-merchants
    const data = await enhanceMerchantsWithSubMerchants(searchResult.rows);

    return {
      totalCount: totalItems,
      totalPages,
      merchants: data,
    };
  } catch (error) {
    logger.error('Error in getMerchantsBySearchDao', error.message);
    throw error;
  }
};

export const updateMerchantDao = async (ids, data, conn) => {
  return await buildAndExecuteUpdateQuery(
    'Merchant',
    data,
    ids,
    {},
    { returnUpdated: true },
    conn,
  );
};

export const deleteMerchantDao = async (
  conn,
  ids,
  data,
  options = { returnUpdated: true },
) => {
  try {
    const { id, company_id } = ids;
    const idArray = Array.isArray(id) ? id : [id];

    const is_obsolete = true;
    const updated_by = data.updated_by;

    const values = [is_obsolete, updated_by, idArray, company_id];

    const returningClause = options.returnUpdated ? 'RETURNING *' : '';

    const sql = `
      UPDATE "Merchant"
      SET "is_obsolete" = $1,
          "updated_by" = $2
      WHERE "id" = ANY($3)
        AND "company_id" = $4
      ${returningClause}
    `;

    const result = await conn.query(sql, values);

    return result.rows;
  } catch (error) {
    logger.error('Error in deleteMerchantDao:', error);
    throw error;
  }
};

export const updateMerchantBalanceDao = async (
  filters,
  valueToAdd,
  updated_by,
  conn,
) => {
  try {
    const [sql, params] = buildUpdateQuery(
      tableName.MERCHANT,
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
    logger.error('Error in updateMerchantBalanceDao:', error);
    throw error;
  }
};

export const getMerchantByCodeAndApiKey = async (code, publicKey) => {
  try {
    const query = `
      SELECT * 
      FROM "${tableName.MERCHANT}" 
      WHERE code = $1 
      AND (config->'keys'->>'public' = $2 OR config->'keys'->>'private' = $2) 
      AND is_obsolete = false
    `;
    const params = [code, publicKey];
    const result = await executeQuery(query, params);
    return result.rows[0]; // Return the first matching merchant
  } catch (error) {
    logger.error('Error fetching merchant by code and API key:', error);
    throw error;
  }
};

export const getMerchantsDaoArray = async (company_id, code) => {
  try {
    let baseQuery = `
      SELECT 
        "Merchant".id, 
        "Merchant".user_id, 
        "Merchant".first_name, 
        "Merchant".last_name, 
        "Merchant".code, 
        "Merchant".min_payin, 
        "Merchant".max_payin, 
        "Merchant".payin_commission, 
        "Merchant".min_payout, 
        "Merchant".max_payout, 
        "Merchant".config, 
        "Merchant".company_id, 
        creator.user_name AS created_by, 
        updater.user_name AS updated_by, 
        "Merchant".created_at, 
        "Merchant".updated_at, 
        "User".designation_id, 
        "User".first_name || ' ' || "User".last_name AS full_name, 
        "Designation".designation AS designation_name
      FROM "Merchant" 
      JOIN "User" ON "Merchant".user_id = "User".id 
      LEFT JOIN "Designation" ON "User".designation_id = "Designation".id
      LEFT JOIN "User" creator ON "Merchant".created_by = creator.id 
      LEFT JOIN "User" updater ON "Merchant".updated_by = updater.id
      WHERE "Merchant".company_id = $1 AND "Merchant".user_id = ANY($2)
    `;

    let queryParams = [company_id, code];
    const result = await executeQuery(baseQuery, queryParams);
    return result.rows;
  } catch (error) {
    logger.error('Error fetching merchant by code and API key:', error);
    throw error;
  }
};
