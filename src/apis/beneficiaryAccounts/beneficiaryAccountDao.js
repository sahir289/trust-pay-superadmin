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
const checkBeneficiaryAccountExistsDao = async (filters) => {
  try {
    const { acc_no, company_id } = filters;
    if (!acc_no || !company_id) {
      throw new Error('Missing acc_no or company_id in filters');
    }

    const query = `
      SELECT 1
      FROM public."BeneficiaryAccounts" bea
      WHERE bea.is_obsolete = false
        AND bea.acc_no = $1
        AND bea.company_id = $2
      LIMIT 1;
    `;

    const params = [acc_no, company_id];
    const result = await executeQuery(query, params);

    return result.rows.length > 0;
  } catch (error) {
    logger.error('Error in checkBeneficiaryAccountExistsDao:', error);
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
  filters,
  page,
  limit,
  role,
  searchTerms,
) => {
  try {
    let queryParams = [];
    let conditions = [`bea.is_obsolete = false`];
    let paramIndex = 1;

    if (
      filters &&
      typeof filters === 'object' &&
      Object.keys(filters).length > 0
    ) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
          if (key === 'company_id' && typeof value === 'string' && value.includes(',')) {
            // Support comma-separated string for company_id
            const arr = value.split(',').map(v => v.trim()).filter(Boolean);
            conditions.push(`bea."company_id" = ANY($${paramIndex})`);
            queryParams.push(arr);
            paramIndex++;
            return;
          }
          if (key.includes('->>')) {
            const [jsonField, jsonKey] = key.split('->>');
            conditions.push(`bea.${jsonField}->>'${jsonKey}' = $${paramIndex}`);
            queryParams.push(value);
          } else if (Array.isArray(value)) {
            conditions.push(`bea."${key}" = ANY($${paramIndex})`);
            queryParams.push(value);
          } else {
            conditions.push(`bea."${key}" = $${paramIndex}`);
            queryParams.push(value);
          }
          paramIndex++;
        }
      });
    }

    let commissionSelect = '';
    if (role === 'MERCHANT') {
      commissionSelect = `bea.ifsc AS ifsc`;
    } else if (role === 'VENDOR') {
      commissionSelect = `bea.ifsc AS ifsc`;
    } else {
      commissionSelect = `
        bea.user_id AS user_id,
        bea.ifsc AS ifsc,
        creator.user_name AS created_by,
        updater.user_name AS updated_by,
        bea.created_at AS created_at,
        bea.updated_at AS updated_at,
        bea.config->>'type' AS config_type,
        bea.config->>'initial_balance' AS config_initial_balance,
        bea.config->>'closing_balance' AS config_closing_balance,
        bea.config`;
    }

    const searchConditions = [];
    if (Array.isArray(searchTerms) && searchTerms.length > 0) {
      searchTerms.forEach((term) => {
        if (typeof term !== 'string') return;
        searchConditions.push(`
          (
            LOWER(bea.id::text) LIKE LOWER($${paramIndex})
            OR LOWER(bea.upi_id) LIKE LOWER($${paramIndex})
            OR LOWER(bea.acc_holder_name) LIKE LOWER($${paramIndex})
            OR LOWER(bea.acc_no) LIKE LOWER($${paramIndex})
            OR LOWER(bea.bank_name) LIKE LOWER($${paramIndex})
            OR LOWER(c.first_name || ' ' || c.last_name) LIKE LOWER($${paramIndex})
            OR LOWER(v.code::text) LIKE LOWER($${paramIndex})
            OR LOWER(m.code::text) LIKE LOWER($${paramIndex})
            ${
              role !== 'MERCHANT'
                ? `
              OR LOWER(bea.user_id::text) LIKE LOWER($${paramIndex})
              OR LOWER(bea.ifsc) LIKE LOWER($${paramIndex})
              ${
                role !== 'VENDOR'
                  ? `
                OR LOWER(COALESCE(creator.user_name, '')) LIKE LOWER($${paramIndex})
                OR LOWER(COALESCE(updater.user_name, '')) LIKE LOWER($${paramIndex})
              `
                  : ''
              }`
                : role === 'VENDOR'
                  ? `
              OR LOWER(bea.ifsc) LIKE LOWER($${paramIndex})
              `
                  : ''
            }
          )`);
        queryParams.push(`%${term}%`);
        paramIndex++;
      });
    }

    let baseQuery = `
      SELECT 
        bea.acc_no,
        bea.id,
        bea.upi_id,
        bea.acc_holder_name,
        bea.bank_name,
        ${commissionSelect ? `${commissionSelect},` : ''}
        v.code AS vendors,
        c.first_name || ' ' || c.last_name AS company,
        m.code AS merchant
      FROM public."BeneficiaryAccounts" bea
      LEFT JOIN public."Vendor" v ON bea.user_id = v.user_id
      LEFT JOIN public."Merchant" m ON bea.user_id = m.user_id
      LEFT JOIN public."User" creator ON bea.created_by = creator.id
      LEFT JOIN public."User" updater ON bea.updated_by = updater.id
      LEFT JOIN public."Company" c
        ON bea.company_id = c.id
      WHERE ${conditions.join(' AND ')}
      ${searchConditions.length > 0 ? ` AND (${searchConditions.join(' OR ')})` : ''}
      ORDER BY bea.updated_at DESC
      LIMIT $${paramIndex}
      OFFSET $${paramIndex + 1}`;

    queryParams.push(limit, (page - 1) * limit);

    const countQuery = `
      SELECT COUNT(*) as total
      FROM public."BeneficiaryAccounts" bea
      LEFT JOIN public."Vendor" v ON bea.user_id = v.user_id
      LEFT JOIN public."Merchant" m ON bea.user_id = m.user_id
      LEFT JOIN public."User" creator ON bea.created_by = creator.id
      LEFT JOIN public."User" updater ON bea.updated_by = updater.id
      LEFT JOIN public."Company" c
        ON bea.company_id = c.id
      WHERE ${conditions.join(' AND ')}
      ${searchConditions.length > 0 ? ` AND (${searchConditions.join(' OR ')})` : ''}`;

    const countResult = await executeQuery(
      countQuery,
      queryParams.slice(0, -2),
    );
    let searchResult = await executeQuery(baseQuery, queryParams);

    const totalItems = parseInt(countResult.rows[0].total);
    const totalPages = totalItems > 0 ? Math.ceil(totalItems / limit) : 0;
    if (
      totalItems > 0 &&
      searchResult.rows.length === 0 &&
      (page - 1) * limit > 0
    ) {
      queryParams[queryParams.length - 1] = 0; 
      searchResult = await executeQuery(baseQuery, queryParams);
    }
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
  checkBeneficiaryAccountExistsDao,
};
