import dayjs from 'dayjs';
import { tableName } from '../../constants/index.js';
// import { InternalServerError } from '../../utils/appErrors.js';
// import { generateUUID } from '../utils/generateUUID.js';

import {
  executeQuery,
  buildSelectQuery,
  buildInsertQuery,
  buildUpdateQuery,
} from '../../utils/db.js';
// import { generateUUID } from '../../utils/generateUUID.js';
import { logger } from '../../utils/logger.js';
import { buildSearchFilterObj } from '../../utils/searchBuilder.js';
import { getBankaccountDao } from '../bankAccounts/bankaccountDao.js';
// import { newTableEntry } from '../../utils/sockets.js';
const IST = 'Asia/Kolkata';

const getBankResponseDao = async (
  filters,
  startDate = new Date(),
  endDate = new Date(),
  page = 0,
  pageSize = 10,
  // sortBy,
  // sortOrder,
  columns = [],
) => {
  try {
    let baseQuery = `SELECT ${columns.length ? columns.join(', ') : '*'} FROM "${tableName.BANK_RESPONSE}" WHERE 1=1`;
    if (filters.search) {
      filters.or = buildSearchFilterObj(
        filters.search,
        tableName.BANK_RESPONSE,
      );
      delete filters.search;
    }
    const [sql, queryParams] = buildSelectQuery(
      baseQuery,
      filters,
      page,
      pageSize,
    );
    if (startDate && endDate) {
      baseQuery += ` AND created_at BETWEEN $${Object.keys(queryParams).length + 1} AND $${Object.keys(queryParams).length + 2}`;
      queryParams[`created_at_start`] = startDate;
      queryParams[`created_at_end`] = endDate;
    }
    const result = await executeQuery(sql, queryParams);
    return result.rows[0];
  } catch (error) {
    logger.error('Error in getBankResponseDao:', error);
    throw error;
  }
};

export const getBankResponseDaoById = async (filters) => {
  try {
    const base = ` SELECT 
    br.id,
    br.bank_id,
    br.utr,
    ba.nick_name,
    ba.user_id
  FROM "${tableName.BANK_RESPONSE}" br
  LEFT JOIN "${tableName.BANK_ACCOUNT}" ba ON ba.id = br.bank_id
  WHERE br.id = $1 AND ba.company_id = $2`;

    const result = await executeQuery(base, [filters.id, filters.company_id]);
    return result.rows[0];
  } catch (error) {
    logger.error('Error in getBankResponseDaoById:', error);
    throw error;
  }
};

const getBankResponseBySearchDao = async (
  filters,
  searchTerm,
  limitNum,
  offset,
) => {
  try {
    const conditions = [];
    const values = [filters.company_id];
    let paramIndex = 2;

    let queryText = `
      SELECT 
        br.id,
        br.status,
        br.bank_id,
        br.amount,
        br.upi_short_code,
        br.utr,
        br.sno,
        br.is_used,
        br.created_at,
        br.updated_at,
        br.created_by,
        br.config,
        br.updated_by,
        ba.user_id ,
        ba.nick_name,
        ba.bank_name,
        v.code,
        v.user_id AS vendor_user_id 
      FROM public."BankResponse" br 
      JOIN public."BankAccount" ba ON br.bank_id = ba.id
      LEFT JOIN public."Vendor" v ON ba.user_id = v.user_id
      WHERE br.is_obsolete = false
      AND br.company_id = $1  
    `;

    if (filters.is_used) {
      queryText += ` AND br.is_used = $${paramIndex}`;
      values.push(filters.is_used);
      paramIndex++;
    }
    if (filters.bank_id) {
      queryText += ` AND br.bank_id = $${paramIndex}`;
      values.push(filters.bank_id);
      paramIndex++;
    }

    searchTerm.forEach((term) => {
      if (term.toLowerCase() === 'true' || term.toLowerCase() === 'false') {
        const boolValue = term.toLowerCase() === 'true';
        conditions.push(`br.is_used = $${paramIndex}`);
        values.push(boolValue);
        paramIndex++;
      } else {
        conditions.push(`
          (
            LOWER(br.id::text) LIKE LOWER($${paramIndex})
            OR LOWER(br.status) LIKE LOWER($${paramIndex})
            OR LOWER(br.bank_id::text) LIKE LOWER($${paramIndex})
            OR LOWER(br.amount::text) LIKE LOWER($${paramIndex})
            OR LOWER(br.upi_short_code) LIKE LOWER($${paramIndex})
            OR LOWER(br.utr) LIKE LOWER($${paramIndex})
            OR LOWER(br.is_used::text) LIKE LOWER($${paramIndex})
            OR LOWER(br.created_at::text) LIKE LOWER($${paramIndex})
            OR LOWER(br.updated_at::text) LIKE LOWER($${paramIndex})
            OR LOWER(br.created_by) LIKE LOWER($${paramIndex})
            OR LOWER(br.config->>'from_UI') LIKE LOWER($${paramIndex})
            OR LOWER(br.updated_by) LIKE LOWER($${paramIndex})
            OR LOWER(ba.user_id::text) LIKE LOWER($${paramIndex})
            OR LOWER(ba.nick_name) LIKE LOWER($${paramIndex})
            OR LOWER(v.code) LIKE LOWER($${paramIndex})
          )
        `);
        values.push(`%${term}%`);
        paramIndex++;
      }
    });

    if (conditions.length > 0) {
      queryText += ' AND (' + conditions.join(' OR ') + ')';
    }

    const countQuery = `SELECT COUNT(*) as total FROM (${queryText}) as count_table`;

    queryText += `
      ORDER BY br.created_at DESC
      LIMIT $${values.length + 1}
      OFFSET $${values.length + 2}
    `;
    values.push(limitNum, offset);

    const countResult = await executeQuery(countQuery, values.slice(0, -2));
    const searchResult = await executeQuery(queryText, values);

    const totalItems = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(totalItems / limitNum);

    const data = {
      totalCount: totalItems,
      totalPages,
      bankResponses: searchResult.rows,
    };
    return data;
  } catch (error) {
    logger.error('Error in getBankResponseBySearchDao:', error);
    throw error;
  }
};

const getClaimResponseDao = async (filters) => {
  try {
    // Convert input date to IST (defaults to now)
    const selectedDate = filters.date
      ? dayjs.tz(filters.date, IST)
      : dayjs().tz(IST);

    const bankIdCondition = filters.bank_id ? `AND bank_id = $3` : '';
    const params = [selectedDate.format('YYYY-MM-DD'), filters.company_id];
    if (filters.bank_id) {
      params.push(filters.bank_id);
    }

    const baseQuery = `
      WITH claimed_data AS (
        SELECT 
          COALESCE(SUM(amount), 0) AS claimed_amount,
          COUNT(*) AS claimed_count
        FROM "BankResponse"
        WHERE is_used = true 
          AND status = '/success'
          AND created_at >= $1
          AND company_id = $2
          ${bankIdCondition}
          AND is_obsolete = false
      ),
      unclaimed_24h AS (
        SELECT 
          COALESCE(SUM(amount), 0) AS unclaimed_24h_amount,
          COUNT(*) AS unclaimed_24h_count
        FROM "BankResponse"
        WHERE is_used = false 
          AND status = '/success'
          AND created_at >= $1
          AND company_id = $2
          ${bankIdCondition}
          AND is_obsolete = false
      ),
      total_unclaimed AS (
        SELECT 
          COALESCE(SUM(amount), 0) AS total_unclaimed_amount,
          COUNT(*) AS total_unclaimed_count
        FROM "BankResponse"
        WHERE is_used = false 
          AND status = '/success'
          AND company_id = $2
          ${bankIdCondition}
          AND is_obsolete = false
      ),
      banks_unclaims_amount AS (
        SELECT 
          b.bank_name,
          b.nick_name,
          COALESCE(SUM(br.amount), 0) AS amount,
          COUNT(br.id) AS count
        FROM "BankAccount" b
        LEFT JOIN "BankResponse" br
          ON b.id = br.bank_id
          AND br.is_used = false 
          AND br.status = '/success'
          AND br.company_id = $2
          AND br.is_obsolete = false
          AND b.bank_used_for = 'PayIn'
          ${bankIdCondition ? `AND ${bankIdCondition.replace(/^AND /, '')}` : ''}
        WHERE b.company_id = $2
        GROUP BY b.bank_name, b.nick_name
      )

      SELECT 
        cd.claimed_amount,
        cd.claimed_count,
        u24.unclaimed_24h_amount,
        u24.unclaimed_24h_count,
        tu.total_unclaimed_amount,
        tu.total_unclaimed_count,
        bua.bank_name,
        bua.nick_name,
        bua.amount,
        bua.count
      FROM claimed_data cd, unclaimed_24h u24, total_unclaimed tu
      LEFT JOIN banks_unclaims_amount bua ON TRUE;
    `;

    const result = await executeQuery(baseQuery, params);

    if (!result || result.rows.length === 0) {
      return {
        claimed24h: { amount: 0, count: 0 },
        unclaimed24h: { amount: 0, count: 0 },
        totalUnclaimed: { amount: 0, count: 0 },
        banks_unclaims_amount: [],
      };
    }

    const firstRow = result.rows[0];

    const banks_unclaims_amount = result.rows
      .filter((row) => row.bank_name) // avoid null rows
      .map((row) => ({
        bank_name: row.bank_name,
        nick_name: row.nick_name,
        amount: parseFloat(row.amount) || 0,
        count: parseInt(row.count) || 0,
      }));

    return {
      claimed24h: {
        amount: parseFloat(firstRow.claimed_amount) || 0,
        count: parseInt(firstRow.claimed_count) || 0,
      },
      unclaimed24h: {
        amount: parseFloat(firstRow.unclaimed_24h_amount) || 0,
        count: parseInt(firstRow.unclaimed_24h_count) || 0,
      },
      totalUnclaimed: {
        amount: parseFloat(firstRow.total_unclaimed_amount) || 0,
        count: parseInt(firstRow.total_unclaimed_count) || 0,
      },
      banks_unclaims_amount,
    };
  } catch (error) {
    logger.error('Error getting claim response:', error);
    throw error;
  }
};

const getBankResponseDaoAll = async (
  filters,
  page = 1,
  pageSize = 10,
  columns = [],
  updated,
  sortBy = 'created_at',
  sortOrder = 'DESC',
  start_date,
  end_date,
) => {
  try {
    let bankId;
    let bankDetails;
    if (filters?.bank_id) {
      bankId = filters?.bank_id;
      bankDetails = await getBankaccountDao({ id: bankId }, null, null);
    }
    const selectCols = columns.length
      ? columns.map((col) => `"BankResponse".${col}`).join(', ')
      : [
          `"BankResponse".*`,
          `"BankAccount".user_id`,
          `"BankAccount".nick_name`,
          `"BankAccount".bank_name`,
          `"Vendor".code AS vendor_code`,
        ].join(', ');

    let start;
    let end;
    if (start_date && end_date) {
      start = dayjs.tz(`${start_date} 00:00:00`, IST).utc().format(); // UTC ISO string
      end = dayjs.tz(`${end_date} 23:59:59.999`, IST).utc().format();
    }
    let baseQueryDate = `
      WITH filtered_accounts AS (
        SELECT 
          "BankAccount".*, 
          jsonb_object_agg(key, value) FILTER (
            WHERE key ~ '^\\d{4}-\\d{2}-\\d{2}' 
              AND (key)::timestamp BETWEEN '${start}'::timestamp AND '${end}'::timestamp
          ) AS filtered_merchant_added
        FROM "BankAccount",
             jsonb_each(("BankAccount".config -> 'merchant_added')::jsonb)
        GROUP BY "BankAccount".id
      )
      SELECT ${selectCols}, 
             "BankResponse".created_at,
             jsonb_set("BankAccount".config::jsonb, '{merchant_added}', COALESCE(filtered_merchant_added, '{}'::jsonb)) AS details,
             "BankAccount".nick_name,
             "Vendor".user_id AS vendor_user_id,
             "Merchant".code AS merchant_code
      FROM "BankResponse"
      JOIN filtered_accounts AS "BankAccount" 
        ON "BankResponse".bank_id = "BankAccount".id
      LEFT JOIN "Vendor" 
        ON "BankAccount".user_id = "Vendor".user_id
          LEFT JOIN "Payin"
        ON "BankResponse".id = "Payin".bank_response_id
        AND "BankResponse".is_used = true
      LEFT JOIN "Merchant"
        ON "Payin".merchant_id = "Merchant".id
    `;

    let baseQuery = `
      SELECT ${selectCols}, "BankResponse".created_at,
        "BankAccount".config AS details,
        "BankAccount".nick_name,
        "Vendor".user_id AS vendor_user_id
      FROM "BankResponse"
      JOIN "BankAccount" ON "BankResponse".bank_id = "BankAccount".id
      LEFT JOIN "Vendor" ON "BankAccount".user_id = "Vendor".user_id
      `;

    const whereConditions = [];

    if (start_date && end_date) {
      whereConditions.push(
        `"BankResponse".created_at BETWEEN '${start}' AND '${end}'`,
      );
    }

    if (filters.search) {
      const searchValue = filters.search.trim();
      filters.or = {
        reference_id: searchValue,
        status: searchValue,
      };
      delete filters.search;
    }

    whereConditions.push(`"BankResponse".is_obsolete = false`);

    if (filters.bank_id) {
      whereConditions.push(`"BankResponse"."bank_id" = '${filters.bank_id}'`);
    }

    if (filters.company_id) {
      whereConditions.push(
        `"BankResponse"."company_id" = '${filters.company_id}'`,
      );
    }
    
    if (filters.status) {
      filters.status = filters.status.split(',');
    }

    if (updated) {
      whereConditions.push(
        `"BankResponse".updated_at IS NOT NULL 
        AND "BankResponse".updated_at != "BankResponse".created_at`,
      );
    }

    if (whereConditions.length) {
      baseQuery += ' WHERE ' + whereConditions.join(' AND ');
      baseQueryDate += ' WHERE ' + whereConditions.join(' AND ');
    }
    const queryIs =
      start && end && bankDetails && bankDetails[0]?.config?.merchant_added
        ? baseQueryDate
        : baseQuery;
    const [query, queryValues] = buildSelectQuery(
      queryIs,
      filters,
      page,
      pageSize,
      sortBy,
      sortOrder,
      'BankResponse',
    );
    const result = await executeQuery(query, queryValues);
    return { totalCount: result.rows.length, rows: result.rows };
  } catch (error) {
    logger.error('Error getting Bank Response:', error);
    throw error;
  }
};

const getBankResponseByUTR = async (utr) => {
  try {
    const baseQuery = `SELECT 
        br.id, 
        br.sno, 
        br.status, 
        br.bank_id, 
        br.amount, 
        br.upi_short_code, 
        br.utr, 
        br.is_used, 
        br.created_at, 
        br.updated_at, 
        br.created_by, 
        br.config, 
        br.updated_by, 
        "BankAccount".user_id, 
        "BankAccount".nick_name, 
        "BankAccount".bank_name, 
        "Vendor".code 
    FROM 
        "BankResponse" AS br 
    JOIN 
        "BankAccount" ON br.bank_id = "BankAccount".id 
    LEFT JOIN 
        "Vendor" ON "BankAccount".user_id = "Vendor".user_id 
    WHERE 
        1=1 
        AND br.is_obsolete = false 
        AND br.status = '/success'
        AND br.utr = $1 
    ORDER BY 
        br.created_at DESC`;
    const queryParams = [utr];
    const result = await executeQuery(baseQuery, queryParams);
    return result.rows[0];
  } catch (error) {
    logger.error('Error getting Bank Response by utr', error);
    throw error;
  }
};

const getInternalBankResponseByUTR = async (utr) => {
  try {
    const baseQuery = `SELECT 
        br.id, 
        br.sno, 
        br.status, 
        br.bank_id, 
        br.amount, 
        br.upi_short_code, 
        br.utr, 
        br.is_used, 
        br.created_at, 
        br.updated_at, 
        br.created_by, 
        br.config, 
        br.updated_by, 
        "BankAccount".user_id, 
        "BankAccount".nick_name, 
        "BankAccount".bank_name, 
        "Vendor".code 
    FROM 
        "BankResponse" AS br 
    JOIN 
        "BankAccount" ON br.bank_id = "BankAccount".id 
    LEFT JOIN 
        "Vendor" ON "BankAccount".user_id = "Vendor".user_id 
    WHERE 
        1=1 
        AND br.is_obsolete = false 
        AND br.status = '/internalTransfer'
        AND br.utr = $1 
    ORDER BY 
        br.created_at DESC`;
    const queryParams = [utr];
    const result = await executeQuery(baseQuery, queryParams);
    return result.rows[0];
  } catch (error) {
    logger.error('Error getting Bank Response by utr', error);
    throw error;
  }
};

const createBankResponseDao = async (conn, data) => {
  try {
    // data.id = generateUUID();
    const [sql, params] = buildInsertQuery(tableName.BANK_RESPONSE, data);
    let result;
    if (conn && conn.query) {
      result = await conn.query(sql, params); // Use connection to execute query
    } else {
      result = await executeQuery(sql, params); // Use executeQuery if no connection
    }
    return result.rows[0];
  } catch (error) {
    logger.error('Error in createBankResponseDao:', error);
    throw error;
  }
};

export const updateBankResponseDao = async (id, data, conn) => {
  try {
    const [sql, params] = buildUpdateQuery(tableName.BANK_RESPONSE, data, id);
    if (conn && conn.query) {
      const result = await conn.query(sql, params);
      // await newTableEntry(tableName.BANK_RESPONSE);
      return result.rows[0];
    }
    const result = await executeQuery(sql, params);
    // await newTableEntry(tableName.BANK_RESPONSE);
    return result.rows[0];
  } catch (error) {
    logger.error('Error in updateBankResponseDao:', error);
    throw error;
  }
};

const getBankMessageDao = async (
  bank_id,
  startDate,
  endDate,
  company_id,
  // page,
  // pageSize,
  // sortBy,
  // sortOrder
) => {
  try {
    const query = `SELECT * FROM "BankResponse" 
      WHERE 1=1 
      AND "bank_id" = $1 
      AND is_obsolete = false 
      AND "created_at" BETWEEN $2 AND $3 
      AND "company_id" = $6
      ORDER BY "created_at" DESC 
      LIMIT $4 OFFSET $5`;
    const values = [bank_id, startDate, endDate, 10, 0, company_id];
    const result = await executeQuery(query, values);
    return result.rows;
  } catch (error) {
    logger.error('Error in getBankMessageDao:', error);
    throw error;
  }
};

const resetBankResponseDao = async (id, data) => {
  try {
    const [sql, params] = buildUpdateQuery(tableName.BANK_RESPONSE, data, {
      id,
    });
    const result = await executeQuery(sql, params);
    return result.rows[0];
  } catch (error) {
    logger.error('Error in resetBankResponseDao:', error);
    throw error;
  }
};

const updateBotResponseDao = async (id, data, conn) => {
  try {
    const [sql, params] = buildUpdateQuery(tableName.BANK_RESPONSE, data, {
      id,
    });
    let result;
    if (conn && conn.query) {
      result = await conn.query(sql, params); // Use connection to execute query
    } else {
      result = await executeQuery(sql, params); // Use executeQuery if no connection
    }
    // await newTableEntry(tableName.BANK_RESPONSE);
    return result.rows[0];
  } catch (error) {
    logger.error('Error in updateBotResponseDao:', error);
    throw error;
  }
};

export {
  getBankResponseDao,
  getClaimResponseDao,
  getInternalBankResponseByUTR,
  createBankResponseDao,
  getBankResponseDaoAll,
  getBankResponseByUTR,
  getBankResponseBySearchDao,
  getBankMessageDao,
  resetBankResponseDao,
  updateBotResponseDao,
};
