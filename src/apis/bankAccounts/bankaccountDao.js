import { Role, tableName } from '../../constants/index.js';

import {
  buildInsertQuery,
  buildSelectQuery,
  buildUpdateQuery,
  buildAndExecuteUpdateQuery,
  executeQuery,
} from '../../utils/db.js';

import { logger } from '../../utils/logger.js';

const getBankaccountDao = async (filters, page, limit, role, designation) => {
  try {
    let queryParams = [];
    let conditions = [`ba.is_obsolete = false`];
    // if (filters.company_id) {
    //   queryParams.push(filters.company_id);
    //   conditions.push(`ba.company_id = $1`);
    // }
    let limitcondition = '';

    if (page && limit) {
      limitcondition = `LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
      queryParams.push(limit, (page - 1) * limit);
    }

    if (filters?.startDate && filters?.endDate) {
      conditions.push(
        `ba.created_at BETWEEN $${queryParams.length + 1} AND $${queryParams.length + 2}`,
      );
      queryParams.push(filters?.startDate, filters?.endDate);
      // delete filters.startDate
      // delete filters.endDate
    }
    if (filters?.bank_used_for) {
      conditions.push(`ba.bank_used_for = $${queryParams.length + 1}`);
      queryParams.push(filters?.bank_used_for);
    }

    // Nickname filter
    if (filters?.nick_name) {
      conditions.push(`ba.nick_name= $${queryParams.length + 1}`);
      queryParams.push(filters.nick_name);
    }
    if (filters?.merchant_id) {
      queryParams.push(filters.merchant_id);
      conditions.push(
        `(ba.config->'merchants')::jsonb ?| $${queryParams.length}::text[]`,
      );
      delete filters.merchant_id;
    }
    if (filters && Object.keys(filters).length > 0) {
      Object.keys(filters).forEach((key) => {
        delete filters?.page;
        delete filters?.limit;
        const value = filters[key];
        if (value !== null && value !== undefined && value !== '') {
          if (Array.isArray(value)) {
            conditions.push(`ba."${key}" = ANY($${queryParams.length + 1})`);
            queryParams.push(value);
          } else {
            conditions.push(`ba."${key}" = $${queryParams.length + 1}`);
            queryParams.push(value);
          }
        }
      });
    }
    let commissionSelect = '';
    if (role === 'MERCHANT') {
      commissionSelect = '';
    } else if (role === 'VENDOR') {
      commissionSelect = `
        ba.ifsc AS ifsc_code, 
        ba.payin_count, 
        ba.balance, 
        ba.today_balance, 
        ba.bank_used_for,
        ba.config->>'is_freeze' AS freezed,
        ba.config->>'is_intent' AS intent,
        ba.config->>'is_phonepay' AS phonepe,
        ba.config->>'max_limit' AS daily_limit`;
    } else {
      // Only include Merchant_Details and config if designation is 'Admin'
      commissionSelect = `
        ba.user_id, 
        ba.ifsc, 
        ba.min, 
        ba.max, 
        ba.payin_count, 
        ba.balance, 
        ba.today_balance, 
        ba.bank_used_for, 
        creator.user_name AS created_by, 
        updater.user_name AS updated_by, 
        ${designation === Role.SUPER_ADMIN || Role.ADMIN || Role.OPERATIONS || Role.TRANSACTIONS ? `COALESCE(m.merchant_details, '[]'::jsonb) AS Merchant_Details, ba.config,` : ''}
        ba.created_at, 
        ba.updated_at`;
    }
    const baseQuery = `SELECT 
        ba.id, 
        ba.sno, 
        ba.upi_id,
        ba.acc_holder_name,
        ba.upi_params, 
        ba.nick_name, 
        ba.acc_no, 
        ba.bank_name, 
        ba.is_qr, 
        ba.is_bank, 
        ba.is_enabled, 
        ${commissionSelect ? `${commissionSelect},` : ''}
        v.code AS Vendor 
      FROM 
          public."BankAccount" ba
      LEFT JOIN public."Vendor" v 
          ON ba.user_id = v.user_id
      LEFT JOIN LATERAL (
          SELECT 
              jsonb_agg(jsonb_build_object('id', m.id, 'code', m.code)) AS merchant_details
          FROM public."Merchant" m
          WHERE m.id::text IN (
                    SELECT jsonb_array_elements_text((ba.config->'merchants')::jsonb)
          )
      ) m ON TRUE
       LEFT JOIN public."User" creator 
        ON ba.created_by = creator.id
      LEFT JOIN public."User" updater 
        ON ba.updated_by = updater.id
      WHERE 
          ${conditions.join(' AND ')}
      ORDER BY 
          ba.is_enabled DESC,  
          ba.updated_at DESC  
      ${limitcondition};
      `;
    const result = await executeQuery(baseQuery, queryParams);
    return result.rows;
  } catch (error) {
    logger.error('Error in get BankAccount Dao:', error);
    throw error;
  }
};

const getAllBankaccountDao = async (
  filters,
  page,
  limit,
  role,
  designation,
) => {
  try {
    let queryParams = [];
    let conditions = [`ba.is_obsolete = false`];
    // if (filters.company_id) {
    //   queryParams.push(filters.company_id);
    //   conditions.push(`ba.company_id = $1`);
    // }
    let limitcondition = '';

    if (page && limit) {
      limitcondition = `LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
      queryParams.push(limit, (page - 1) * limit);
    }

    if (filters?.startDate && filters?.endDate) {
      conditions.push(
        `ba.created_at BETWEEN $${queryParams.length + 1} AND $${queryParams.length + 2}`,
      );
      queryParams.push(filters?.startDate, filters?.endDate);
      // delete filters.startDate
      // delete filters.endDate
    }
    if (filters?.bank_used_for) {
      conditions.push(`ba.bank_used_for = $${queryParams.length + 1}`);
      queryParams.push(filters?.bank_used_for);
    }

    // Nickname filter
    if (filters?.nick_name) {
      conditions.push(`ba.nick_name= $${queryParams.length + 1}`);
      queryParams.push(filters.nick_name);
    }
    if (filters?.merchant_id) {
      queryParams.push(filters.merchant_id);
      conditions.push(
        `(ba.config->'merchants')::jsonb ?| $${queryParams.length}::text[]`,
      );
      delete filters.merchant_id;
    }
    if (filters && Object.keys(filters).length > 0) {
      Object.keys(filters).forEach((key) => {
        delete filters?.page;
        delete filters?.limit;
        const value = filters[key];
        if (value !== null && value !== undefined && value !== '') {
          if (Array.isArray(value)) {
            conditions.push(`ba."${key}" = ANY($${queryParams.length + 1})`);
            queryParams.push(value);
          } else {
            conditions.push(`ba."${key}" = $${queryParams.length + 1}`);
            queryParams.push(value);
          }
        }
      });
    }
    let commissionSelect = '';
    if (role === 'MERCHANT') {
      commissionSelect = '';
    } else if (role === 'VENDOR') {
      commissionSelect = `
        ba.ifsc AS ifsc_code, 
        ba.payin_count, 
        ba.balance, 
        ba.today_balance,
        ba.is_enabled,   
        ba.bank_used_for,
        ba.config->>'max_limit' AS daily_limit`;
    } else {
      // Only include Merchant_Details and config if designation is 'Admin'
      commissionSelect = `
        ba.user_id, 
        ba.ifsc, 
        ba.min, 
        ba.max, 
        ba.payin_count, 
        ba.balance, 
        ba.is_qr, 
        ba.is_bank, 
        ba.is_enabled, 
        ba.today_balance, 
        ba.bank_used_for, 
        creator.user_name AS created_by, 
        updater.user_name AS updated_by, 
        ${designation === Role.SUPER_ADMIN || Role.ADMIN || Role.OPERATIONS || Role.TRANSACTIONS ? `COALESCE(m.merchant_details, '[]'::jsonb) AS Merchant_Details, ba.config,` : ''}
        ba.created_at, 
        ba.updated_at`;
    }
    const baseQuery = `SELECT 
        ba.id, 
        ba.sno, 
        ba.upi_id,
        ba.acc_holder_name,
        ba.upi_params, 
        ba.nick_name, 
        ba.acc_no, 
        ba.bank_name, 
        ${commissionSelect ? `${commissionSelect},` : ''}
        v.code AS Vendor 
      FROM 
          public."BankAccount" ba
      LEFT JOIN public."Vendor" v 
          ON ba.user_id = v.user_id
      LEFT JOIN LATERAL (
          SELECT 
              jsonb_agg(jsonb_build_object('id', m.id, 'code', m.code)) AS merchant_details
          FROM public."Merchant" m
          WHERE m.id::text IN (
                    SELECT jsonb_array_elements_text((ba.config->'merchants')::jsonb)
          )
      ) m ON TRUE
       LEFT JOIN public."User" creator 
        ON ba.created_by = creator.id
      LEFT JOIN public."User" updater 
        ON ba.updated_by = updater.id
      WHERE 
          ${conditions.join(' AND ')}
      ORDER BY 
          ba.is_enabled DESC,  
          ba.updated_at DESC  
      ${limitcondition};
      `;
    const result = await executeQuery(baseQuery, queryParams);
    return result.rows;
  } catch (error) {
    logger.error('Error in get BankAccount Dao:', error);
    throw error;
  }
};

const getBankAccountsBySearchDao = async (
  company_id,
  role,
  searchTerms,
  limitNum,
  offset,
  bank_used_for,
  designation,
  filters,
) => {
  try {
    let commissionSelect = '';
    if (role === 'MERCHANT') {
      commissionSelect = '';
    } else if (role === 'VENDOR') {
      commissionSelect = `
        ba.ifsc, 
        ba.payin_count, 
        ba.balance, 
        ba.today_balance, 
        ba.bank_used_for, 
        ba.config->>'is_freeze' AS freezed,
        ba.config->>'is_intent' AS intent,
        ba.config->>'is_phonepay' AS phonepe,
        ba.config->>'max_limit' AS daily_limit
      `;
    } else {
      commissionSelect = `
        ba.ifsc, 
        ba.min, 
        ba.max, 
        ba.payin_count, 
        ba.balance, 
        ba.today_balance, 
        ba.bank_used_for, 
        creator.user_name AS created_by, 
        updater.user_name AS updated_by, 
        ${designation === Role.SUPER_ADMIN || Role.ADMIN ? `COALESCE(m.merchant_details, '[]'::jsonb) AS Merchant_Details, ba.config,` : ''}
        ba.created_at, 
        ba.updated_at
      `;
    }

    const conditions = ['ba.company_id = $1'];
    const searchConditions = [];
    const values = [company_id];
    let paramIndex = 2;

    let baseQuery = `
      SELECT 
        ba.id, 
        ba.sno, 
        ba.upi_id,
        ba.acc_holder_name,
        ba.upi_params, 
        ba.nick_name, 
        ba.acc_no, 
        ba.bank_name, 
        ba.is_qr, 
        ba.is_bank, 
        ba.is_enabled,
        ${commissionSelect},
        v.code AS Vendor
      FROM 
        public."BankAccount" ba
      LEFT JOIN public."Vendor" v 
        ON ba.user_id = v.user_id
      LEFT JOIN LATERAL (
        SELECT 
          jsonb_agg(jsonb_build_object('id', m.id, 'code', m.code)) AS merchant_details
        FROM public."Merchant" m
        WHERE m.id::text IN (
          SELECT jsonb_array_elements_text((ba.config->'merchants')::jsonb)
        )
      ) m ON TRUE
      LEFT JOIN public."User" creator 
        ON ba.created_by = creator.id
      LEFT JOIN public."User" updater 
        ON ba.updated_by = updater.id
      WHERE 1=1
    `;

    if (bank_used_for) {
      conditions.push(`LOWER(ba.bank_used_for) = $${paramIndex}`);
      values.push(bank_used_for.toLowerCase());
      paramIndex++;
    }

    searchTerms.forEach((term) => {
      if (term.toLowerCase() === 'true' || term.toLowerCase() === 'false') {
        const boolValue = term.toLowerCase() === 'true';
        searchConditions.push(`
          (
            ba.is_qr = $${paramIndex}
            OR ba.is_bank = $${paramIndex}
            OR ba.is_enabled = $${paramIndex}
          )
        `);
        values.push(boolValue);
        paramIndex++;
      } else {
        searchConditions.push(`
          (
            LOWER(ba.id::text) LIKE LOWER($${paramIndex})
            OR LOWER(ba.sno::text) LIKE LOWER($${paramIndex})
            OR LOWER(ba.upi_id) LIKE LOWER($${paramIndex})
            OR LOWER(ba.acc_holder_name) LIKE LOWER($${paramIndex})
            OR LOWER(ba.upi_params::text) LIKE LOWER($${paramIndex})
            OR LOWER(ba.nick_name) LIKE LOWER($${paramIndex})
            OR LOWER(ba.acc_no) LIKE LOWER($${paramIndex})
            OR LOWER(ba.bank_name) LIKE LOWER($${paramIndex})
            OR LOWER(v.code) LIKE LOWER($${paramIndex})
            OR LOWER(ba.config->>'merchants') LIKE LOWER($${paramIndex})
            OR EXISTS (
              SELECT 1 
              FROM jsonb_array_elements_text((ba.config->'merchants')::jsonb) AS merchant_id
              WHERE LOWER(merchant_id) LIKE LOWER($${paramIndex})
            )
            ${
              role !== 'MERCHANT'
                ? `
              OR LOWER(ba.user_id::text) LIKE LOWER($${paramIndex})
              OR LOWER(ba.ifsc) LIKE LOWER($${paramIndex})
              OR ba.min::text LIKE $${paramIndex}
              OR ba.max::text LIKE $${paramIndex}
              OR ba.payin_count::text LIKE $${paramIndex}
              OR ba.balance::text LIKE $${paramIndex}
              OR ba.today_balance::text LIKE $${paramIndex}
              OR LOWER(ba.bank_used_for) LIKE LOWER($${paramIndex})
              ${
                role !== 'VENDOR'
                  ? `
                OR LOWER(creator.user_name) LIKE LOWER($${paramIndex})
                OR LOWER(updater.user_name) LIKE LOWER($${paramIndex})
              `
                  : ''
              }
            `
                : role === 'VENDOR'
                  ? `
              OR LOWER(ba.ifsc_code) LIKE LOWER($${paramIndex})
              OR ba.payin_count::text LIKE $${paramIndex}
              OR ba.balance::text LIKE $${paramIndex}
              OR ba.today_balance::text LIKE $${paramIndex}
              OR LOWER(ba.bank_used_for) LIKE LOWER($${paramIndex})
            `
                  : ''
            }
            OR LOWER(m.merchant_details::text) LIKE LOWER($${paramIndex})
          )
        `);
        values.push(`%${term}%`);
        paramIndex++;
      }
    });

    if (conditions.length > 0) {
      baseQuery += ' AND ' + conditions.join(' AND ');
    }
    if (searchConditions.length > 0) {
      baseQuery += ' AND (' + searchConditions.join(' OR ') + ')';
    }

    if (filters && Object.keys(filters).length > 0) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
          if (Array.isArray(value)) {
            baseQuery += ` AND ba."${key}" = ANY($${paramIndex})`;
            values.push(value);
          } else {
            baseQuery += ` AND ba."${key}" = $${paramIndex}`;
            values.push(value);
          }
          paramIndex++;
        }
      });
    }

    const countQuery = `SELECT COUNT(*) as total FROM (${baseQuery}) as count_table`;

    baseQuery += `
      ORDER BY 
        ba.is_enabled DESC, 
        ba.updated_at DESC
      LIMIT $${paramIndex}
      OFFSET $${paramIndex + 1}
    `;
    values.push(limitNum, offset);

    const countResult = await executeQuery(countQuery, values.slice(0, -2));
    const searchResult = await executeQuery(baseQuery, values);

    const totalItems = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(totalItems / limitNum);

    const data = {
      totalCount: totalItems,
      totalPages,
      bankAccounts: searchResult.rows,
    };
    return data;
  } catch (error) {
    logger.error('Error in getBankAccountsBySearchDao:', error);
    throw error;
  }
};

const getMerchantBankDao = async (filters) => {
  try {
    const query = `SELECT * FROM  "${tableName.BANK_ACCOUNT}" WHERE 1=1`;
    const [sql, parameters] = buildSelectQuery(query, filters);
    const result = await executeQuery(sql, parameters);
    return result.rows;
  } catch (error) {
    logger.error(error);
    throw error;
  }
};
const getBankByIdDao = async (filters) => {
  try {
    const query = `SELECT  min,
  max,
  is_enabled,
  payin_count,
  balance,today_balance, user_id ,id FROM  "${tableName.BANK_ACCOUNT}" WHERE 1=1`;
    const [sql, parameters] = buildSelectQuery(query, filters);
    const result = await executeQuery(sql, parameters);
    return result.rows;
  } catch (error) {
    logger.error(error);
    throw error;
  }
};
const createBankaccountDao = async (payload) => {
  try {
    const [sql, params] = buildInsertQuery(tableName.BANK_ACCOUNT, payload);
    const result = await executeQuery(sql, params);
    return result.rows[0];
  } catch (error) {
    logger.error(error);
    throw error;
  }
};

const getBankAccountDaoNickName = async (
  conn,
  company_id,
  type,
  filters = {},
) => {
  try {
    // Initialize query components
    let whereConditions = [
      'company_id = $1',
      'bank_used_for = $2',
      'is_obsolete = false',
      "(config->>'is_freeze' IS NULL OR config->>'is_freeze' != 'true' OR config->>'is_freeze' = 'false')",
    ];
    if (type !== 'PayIn') {
      whereConditions.push('is_enabled = true');
    }
    let queryParams = [company_id, type];

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
      SELECT nick_name AS label, id AS value 
      FROM "${tableName.BANK_ACCOUNT}" 
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY nick_name ASC
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

const updateBankaccountDao = async (id, payload, conn, isParentDeleted) => {
  try {
    // Fetch existing bank config to merge with added_at
    const existingBankArr = await getBankaccountDao({
      id: id.id,
      company_id: id.company_id,
    });
    const existingBank = existingBankArr[0];

    // Handle nested JSON updates for the `config` column
    if (payload.config && typeof payload.config === 'object') {
      const configUpdates = payload.config;
      delete payload.config; // Remove `config` from the main payload

      // Merge the new `config` data into the existing JSON structure
      const safeConfig = {};
      //added merchant_added key in config
      for (const key in configUpdates) {
        if (
          key === 'merchant_added' &&
          typeof configUpdates[key] === 'object'
        ) {
          const rawAddedAt = configUpdates[key];
          const existingAddedAt = existingBank?.config?.merchant_added || {};

          const updatedAddedAt = {
            ...existingAddedAt,
            ...rawAddedAt,
          };

          safeConfig['merchant_added'] = updatedAddedAt;
        } else {
          safeConfig[key] = configUpdates[key];
        }
      }
      payload.config = safeConfig;
    }

    // if vendor delete then this config updated
    if (isParentDeleted) {
      const [sql, params] = buildUpdateQuery(
        tableName.BANK_ACCOUNT,
        payload,
        id,
      );
      const result = conn.query(sql, params);
      return result;
    }
    // Use buildAndExecuteUpdateQuery to update the bank account
    return await buildAndExecuteUpdateQuery(
      tableName.BANK_ACCOUNT,
      payload,
      id,
      {}, // No special fields
      { returnUpdated: true }, // Return the updated row
      conn, // Use the provided connection
    );
  } catch (error) {
    logger.error('Error in updateBankaccountDao:', error);
    throw error;
  }
};

const deleteBankaccountDao = async (conn, id, data) => {
  try {
    const [sql, params] = buildUpdateQuery(tableName.BANK_ACCOUNT, data, id);
    let result;
    if (conn && conn.query) {
      result = await conn.query(sql, params); // Use connection to execute query
    } else {
      result = await executeQuery(sql, params); // Use executeQuery if no connection
    }
    return result.rows[0];
  } catch (error)  {
    logger.error('Error in deleteBankaccountDao:', error);
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
      tableName.BANK_ACCOUNT,
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
  getBankaccountDao,
  getBankAccountsBySearchDao,
  getAllBankaccountDao,
  createBankaccountDao,
  updateBankaccountDao,
  deleteBankaccountDao,
  getMerchantBankDao,
  getBankAccountDaoNickName,
  getBankByIdDao,
};
