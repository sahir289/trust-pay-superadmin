import { Role, tableName } from '../../constants/index.js';

import {
  buildInsertQuery,
  buildUpdateQuery,
  buildAndExecuteUpdateQuery,
  executeQuery,
} from '../../utils/db.js';
import { logger } from '../../utils/logger.js';

const getBeneficiaryAccountDao = async (filters, page, limit, role) => {
  try {
    let queryParams = [];
    let conditions = [`bea.is_obsolete = false`];
    let limitcondition = '';

    if (page && limit) {
      limitcondition = `LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
      queryParams.push(limit, (page - 1) * limit);
    }
    if (filters && Object.keys(filters).length > 0) {
      Object.keys(filters).forEach((key) => {
        delete filters?.page;
        delete filters?.limit;
        const value = filters[key];
        if (value !== null && value !== undefined && value !== '') {
          if (key.includes('->>')) {
            const [jsonField, jsonKey] = key.split('->>');
            conditions.push(
              `bea.${jsonField}->>'${jsonKey}' = $${queryParams.length + 1}`,
            );
            queryParams.push(value);
          } else if (Array.isArray(value)) {
            conditions.push(`bea."${key}" = ANY($${queryParams.length + 1})`);
            queryParams.push(value);
          } else {
            conditions.push(`bea."${key}" = $${queryParams.length + 1}`);
            queryParams.push(value);
          }
        }
      });
    }
    let commissionSelect = '';
    if (role === Role.MERCHANT) {
      commissionSelect = `
        bea.ifsc AS ifsc`;
    } else if (role === Role.VENDOR) {
      commissionSelect = `
        bea.ifsc AS ifsc, bea.config`;
    } else {
      commissionSelect = `
        bea.user_id, 
        bea.ifsc, 
        creator.user_name AS created_by, 
        updater.user_name AS updated_by, 
        bea.created_at,
        bea.config,
        bea.updated_at`;
    }
    const baseQuery = `SELECT 
        bea.id,
        bea.upi_id,
        bea.acc_holder_name,
        bea.acc_no, 
        bea.bank_name,
        ${commissionSelect ? `${commissionSelect},` : ''}
        v.code AS Vendor,
        m.code AS Merchant
      FROM 
          public."BeneficiaryAccounts" bea
      LEFT JOIN public."Vendor" v 
          ON bea.user_id = v.user_id
      LEFT JOIN public."Merchant" m 
          ON bea.user_id = m.user_id
       LEFT JOIN public."User" creator 
        ON bea.created_by = creator.id
      LEFT JOIN public."User" updater 
        ON bea.updated_by = updater.id
      WHERE 
          ${conditions.join(' AND ')}
      ORDER BY 
          bea.updated_at DESC  
      ${limitcondition};
      `;
    const result = await executeQuery(baseQuery, queryParams);
    return result.rows;
  } catch (error) {
    logger.error('Error in get BeneficiaryAccount Dao:', error);
    throw error;
  }
};

const getBeneficiaryAccountDaoAll = async (filters, page, limit, role) => {
  try {
    let queryParams = [];
    let conditions = [`bea.is_obsolete = false`];
    let limitCondition = '';

    if (page && limit) {
      limitCondition = `LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
      queryParams.push(limit, (page - 1) * limit);
    }
    if (filters && Object.keys(filters).length > 0) {
      Object.keys(filters).forEach((key) => {
        delete filters?.page;
        delete filters?.limit;
        const value = filters[key];
        if (value !== null && value !== undefined && value !== '') {
          if (key.includes('->>')) {
            const [jsonField, jsonKey] = key.split('->>');
            conditions.push(
              `bea.${jsonField}->>'${jsonKey}' = $${queryParams.length + 1}`,
            );
            queryParams.push(value);
          } else if (Array.isArray(value)) {
            // Ensure array is not empty, is flat, and is a proper Postgres array
            const flatArray = value.flat().filter(v => v !== null && v !== undefined && !Array.isArray(v));
            if (flatArray.length > 0) {
              conditions.push(`bea."${key}" = ANY($${queryParams.length + 1})`);
              queryParams.push(flatArray);
            }
          } else {
            conditions.push(`bea."${key}" = $${queryParams.length + 1}`);
            queryParams.push(value);
          }
        }
      });
    }
    let commissionSelect = '';

    if (role === Role.MERCHANT) {
      commissionSelect = `bea.ifsc AS ifsc`;
    } else if (role === Role.VENDOR) {
      commissionSelect = `
        bea.ifsc AS ifsc,
        v.user_id AS user_id
    `;
    } else {
      commissionSelect = `
      v.user_id AS user_id,
        bea.ifsc AS ifsc,
        creator.user_name AS created_by,
        updater.user_name AS updated_by,
        bea.created_at AS created_at,
        bea.config->>'type' AS config_type,
        bea.config->>'initial_balance' AS config_initial_balance,
        bea.config->>'closing_balance' AS config_closing_balance,
        bea.config,
        bea.updated_at AS updated_at`;
    }

    const baseQuery = `SELECT 
      bea.acc_no,
      bea.id AS id,
      bea.upi_id AS upi_id,
      bea.acc_holder_name AS acc_holder_name,
      bea.bank_name AS bank_name,
      ${commissionSelect ? `${commissionSelect},` : ''}
      v.code AS vendors,
      m.code AS merchant
    FROM public."BeneficiaryAccounts" bea
    LEFT JOIN public."Vendor" v ON bea.user_id = v.user_id
    LEFT JOIN public."Merchant" m ON bea.user_id = m.user_id
    LEFT JOIN public."User" creator ON bea.created_by = creator.id
    LEFT JOIN public."User" updater ON bea.updated_by = updater.id
    WHERE ${conditions.join(' AND ')}
    ORDER BY bea.updated_at DESC
    ${limitCondition};`;

    const result = await executeQuery(baseQuery, queryParams);
    return result.rows;
  } catch (error) {
    logger.error('Error in get BeneficiaryAccount Dao:', error);
    throw error;
  }
};

const getBeneficiaryAccountBySearchDao = async (
  role,
  searchTerms = [],
  page = 1,
  limit = 10,
  filters = {},
) => {
  try {
    let queryParams = [];
    let conditions = [];
    let paramIndex = 1;

    if (
      filters &&
      typeof filters === 'object' &&
      Object.keys(filters).length > 0
    ) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
          if (Array.isArray(value)) {
            conditions.push(`sub."${key}" = ANY($${paramIndex})`);
            queryParams.push(value);
          } else {
            conditions.push(`sub."${key}" = $${paramIndex}`);
            queryParams.push(value);
          }
          paramIndex++;
        }
      });
    }

    let commissionSelect = '';
    if (role === 'MERCHANT') {
      commissionSelect = `sub.ifsc AS ifsc`;
    } else if (role === 'VENDOR') {
      commissionSelect = `sub.ifsc AS ifsc`;
    } else {
      commissionSelect = `
        sub.user_id AS user_id,
        sub.ifsc AS ifsc,
        sub.created_by AS created_by,
        sub.updated_by AS updated_by,
        sub.created_at AS created_at,
        sub.updated_at AS updated_at`;
    }

    // Track search terms and their parameter indices
    const searchTermIndices = [];
    const searchConditions = [];
    if (Array.isArray(searchTerms) && searchTerms.length > 0) {
      searchTerms.forEach((term) => {
        if (typeof term !== 'string') return;
        searchConditions.push(`
          (
            LOWER(sub.id::text) LIKE LOWER($${paramIndex})
            OR LOWER(sub.upi_id) LIKE LOWER($${paramIndex})
            OR LOWER(sub.acc_holder_name) LIKE LOWER($${paramIndex})
            OR LOWER(sub.acc_no) LIKE LOWER($${paramIndex})
            OR LOWER(sub.bank_name) LIKE LOWER($${paramIndex})
            OR LOWER(sub.vendors::text) LIKE LOWER($${paramIndex})
            OR LOWER(sub.merchants::text) LIKE LOWER($${paramIndex})
            ${
              role !== 'MERCHANT'
                ? `
              OR LOWER(sub.user_id::text) LIKE LOWER($${paramIndex})
              OR LOWER(sub.ifsc) LIKE LOWER($${paramIndex})
              ${
                role !== 'VENDOR'
                  ? `
                OR LOWER(COALESCE(sub.created_by, '')) LIKE LOWER($${paramIndex})
                OR LOWER(COALESCE(sub.updated_by, '')) LIKE LOWER($${paramIndex})
              `
                  : ''
              }`
                : role === 'VENDOR'
                  ? `
              OR LOWER(sub.ifsc) LIKE LOWER($${paramIndex})
              `
                  : ''
            }
          )`);
        queryParams.push(`%${term}%`);
        searchTermIndices.push({ term, paramIndex, isBoolean: false });
        paramIndex++;
      });
    }

    // Compute matched_keywords
    let matchedKeywordsSelect = '';
    if (searchTermIndices.length > 0) {
      const keywordCases = searchTermIndices.map(
        ({ term, paramIndex }) => `
        CASE WHEN (
          LOWER(sub.id::text) LIKE LOWER($${paramIndex})
          OR LOWER(sub.upi_id) LIKE LOWER($${paramIndex})
          OR LOWER(sub.acc_holder_name) LIKE LOWER($${paramIndex})
          OR LOWER(sub.acc_no) LIKE LOWER($${paramIndex})
          OR LOWER(sub.bank_name) LIKE LOWER($${paramIndex})
          OR LOWER(sub.vendors::text) LIKE LOWER($${paramIndex})
          OR LOWER(sub.merchants::text) LIKE LOWER($${paramIndex})
          ${
            role !== 'MERCHANT'
              ? `
            OR LOWER(sub.user_id::text) LIKE LOWER($${paramIndex})
            OR LOWER(sub.ifsc) LIKE LOWER($${paramIndex})
            ${
              role !== 'VENDOR'
                ? `
              OR LOWER(COALESCE(sub.created_by, '')) LIKE LOWER($${paramIndex})
              OR LOWER(COALESCE(sub.updated_by, '')) LIKE LOWER($${paramIndex})
            `
                : ''
            }`
              : role === 'VENDOR'
                ? `
            OR LOWER(sub.ifsc) LIKE LOWER($${paramIndex})
            `
                : ''
          }
        ) THEN '${term}'::text END`,
      );
      matchedKeywordsSelect =
        keywordCases.length > 0
          ? `,
          ARRAY_REMOVE(ARRAY[${keywordCases.join(', ')}], NULL) AS matched_keywords`
          : `,
          ARRAY[]::text[] AS matched_keywords`;
    } else {
      matchedKeywordsSelect = `,
        ARRAY[]::text[] AS matched_keywords`;
    }

    let baseQuery = `
      SELECT 
        sub.acc_no,
        sub.id,
        sub.upi_id,
        sub.acc_holder_name,
        sub.bank_name,
        ${commissionSelect ? `${commissionSelect},` : ''}
        sub.vendors,
        sub.merchants
        ${matchedKeywordsSelect}
      FROM (
        SELECT 
          bea.acc_no,
          MAX(bea.id) AS id,
          MAX(bea.upi_id) AS upi_id,
          MAX(bea.acc_holder_name) AS acc_holder_name,
          MAX(bea.bank_name) AS bank_name,
          MAX(bea.user_id) AS user_id,
          MAX(bea.ifsc) AS ifsc,
          MAX(bea.role_id) AS role_id,
          MAX(creator.user_name) AS created_by,
          MAX(updater.user_name) AS updated_by,
          MAX(bea.created_at) AS created_at,
          MAX(bea.updated_at) AS updated_at,
          ARRAY_AGG(DISTINCT v.code) FILTER (WHERE v.code IS NOT NULL) AS vendors,
          ARRAY_AGG(DISTINCT m.code) FILTER (WHERE m.code IS NOT NULL) AS merchants
        FROM 
          public."BeneficiaryAccounts" bea
        LEFT JOIN public."Vendor" v 
          ON bea.user_id = v.user_id
        LEFT JOIN public."Merchant" m 
          ON bea.user_id = m.user_id
        LEFT JOIN public."User" creator 
          ON bea.created_by = creator.id
        LEFT JOIN public."User" updater 
          ON bea.updated_by = updater.id
        WHERE bea.is_obsolete = false
        GROUP BY bea.acc_no
      ) sub
      WHERE 1=1`;

    if (conditions.length > 0) {
      baseQuery += ` AND ${conditions.join(' AND ')}`;
    }
    if (searchConditions.length > 0) {
      baseQuery += ` AND (${searchConditions.join(' OR ')})`;
    }

    const countQuery = `
      SELECT COUNT(DISTINCT sub.acc_no) as total
      FROM (
        SELECT 
          bea.acc_no,
          MAX(bea.id) AS id,
          MAX(bea.upi_id) AS upi_id,
          MAX(bea.acc_holder_name) AS acc_holder_name,
          MAX(bea.bank_name) AS bank_name,
          MAX(bea.user_id) AS user_id,
          MAX(bea.ifsc) AS ifsc,
          MAX(bea.role_id) AS role_id,
          MAX(creator.user_name) AS created_by,
          MAX(updater.user_name) AS updated_by,
          MAX(bea.created_at) AS created_at,
          MAX(bea.updated_at) AS updated_at,
          ARRAY_AGG(DISTINCT v.code) FILTER (WHERE v.code IS NOT NULL) AS vendors,
          ARRAY_AGG(DISTINCT m.code) FILTER (WHERE m.code IS NOT NULL) AS merchants
        FROM public."BeneficiaryAccounts" bea
        LEFT JOIN public."Vendor" v 
          ON bea.user_id = v.user_id
        LEFT JOIN public."Merchant" m 
          ON bea.user_id = m.user_id
        LEFT JOIN public."User" creator 
          ON bea.created_by = creator.id
        LEFT JOIN public."User" updater 
          ON bea.updated_by = updater.id
        WHERE bea.is_obsolete = false
        GROUP BY bea.acc_no
      ) sub
      WHERE 1=1
      ${conditions.length > 0 ? ` AND ${conditions.join(' AND ')}` : ''}
      ${searchConditions.length > 0 ? ` AND (${searchConditions.join(' OR ')})` : ''}`;

    const countResult = await executeQuery(
      countQuery,
      queryParams.slice(0, paramIndex - 1),
    );

    const offset = (page - 1) * limit;
    baseQuery += `
      ORDER BY 
        sub.updated_at DESC
      LIMIT $${paramIndex}
      OFFSET $${paramIndex + 1}`;
    queryParams.push(limit, offset);

    const searchResult = await executeQuery(baseQuery, queryParams);

    const totalItems = parseInt(countResult.rows[0].total);
    const totalPages = totalItems > 0 ? Math.ceil(totalItems / limit) : 0;

    return {
      totalCount: totalItems,
      totalPages,
      bankAccounts: searchResult.rows,
    };
  } catch (error) {
    logger.error('Error in get Beneficiary Account By SearchDao:', error);
    throw error;
  }
};

const createBeneficiaryAccountDao = async (conn, payload) => {
  try {
    const [sql, params] = buildInsertQuery(
      tableName.BENEFICIARY_ACCOUNTS,
      payload,
    );
    const result = await conn.query(sql, params);
    return result.rows[0];
  } catch (error) {
    logger.error(error);
    throw error;
  }
};

const getBeneficiaryAccountDaoByBankName = async (
  conn,
  company_id,
  type,
  filters = {},
) => {
  try {
    // Initialize query components
    let whereConditions = ['is_obsolete = false'];
    let queryParams = [];

    // Handle filters
    if (Object.keys(filters).length > 0) {
      Object.entries(filters).forEach(([key, value]) => {
        let paramValue = value;
        // If value is an array, take the first element (adjust based on requirements)
        if (Array.isArray(value) && value.length > 0) {
          paramValue = value[0]; // Extract first element
          if (paramValue == null) {
            return; // Skip if first element is null/undefined
          }
        }
        whereConditions.push(`"${key}" = $${queryParams.length + 1}`);
        queryParams.push(paramValue);
      });
    }

    // Construct base query with dynamic WHERE clause
    let baseQuery = `
      SELECT bank_name AS label, id AS value 
      FROM "${tableName.BENEFICIARY_ACCOUNTS}" 
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY bank_name ASC
    `;

    // Execute query
    const result = await conn.query(baseQuery, queryParams);

    return {
      totalCount: result.rowCount,
      bankNames: result.rows,
    };
  } catch (error) {
    logger.error('Error querying bank accounts:', error.message, error.stack);
    throw error;
  }
};

const updateBeneficiaryAccountDao = async (
  id,
  payload,
  conn,
  // isParentDeleted,
) => {
  try {
    // Use buildAndExecuteUpdateQuery to update the bank account
    return await buildAndExecuteUpdateQuery(
      tableName.BENEFICIARY_ACCOUNTS,
      payload,
      id,
      {}, // No special fields
      { returnUpdated: true }, // Return the updated row
      conn, // Use the provided connection
    );
  } catch (error) {
    logger.error('Error in updateBeneficiaryAccountDao:', error);
    throw error;
  }
};

const deleteBeneficiaryDao = async (conn, id, data) => {
  try {
    const [sql, params] = buildUpdateQuery(
      tableName.BENEFICIARY_ACCOUNTS,
      data,
      id,
    );
    let result;
    if (conn && conn.query) {
      result = await conn.query(sql, params); // Use connection to execute query
    } else {
      result = await executeQuery(sql, params); // Use executeQuery if no connection
    }
    return result.rows[0];
  } catch(error) {
    logger.error('Error in deleteBeneficiaryDao:', error);
    throw error;
  }
};

export const updateBanktBalanceDao = async (
  filters,
  amount,
  updated_by,
  conn,
) => {
  try {
    const [sql, params] = buildUpdateQuery(
      tableName.BENEFICIARY_ACCOUNTS,
      { balance: amount, today_balance: amount, updated_by },
      filters,
      { balance: '+', today_balance: '+' },
    );
    if (conn && conn.query) {
      const result = await conn.query(sql, params);
      return result.rows[0];
    }
    const result = await executeQuery(sql, params);
    return result[0];
  } catch (error) {
    logger.error(error);
    throw error;
  }
};

export {
  getBeneficiaryAccountDao,
  getBeneficiaryAccountBySearchDao,
  createBeneficiaryAccountDao,
  updateBeneficiaryAccountDao,
  deleteBeneficiaryDao,
  getBeneficiaryAccountDaoAll,
  getBeneficiaryAccountDaoByBankName,
};
