import { tableName } from '../../constants/index.js';
import {
  buildInsertQuery,
  buildUpdateQuery,
  executeQuery,
} from '../../utils/db.js';
import dayjs from 'dayjs';
import { logger } from '../../utils/logger.js';

const getResetHistoryDao = async (
  filters = {},
  page,
  pageSize,
  sortBy = 'sno',
  sortOrder = 'DESC',
  startDate,
  endDate,
  columns = [],
) => {
  try {
    const { BANK_RESPONSE, RESET_DATA_HISTORY, PAYIN, USER } = tableName;
    //reset pagination if page and limit is null
    let queryParams = [];

    // Default columns if none provided
    const selectColumns = columns.length
      ? columns.map((col) => `"${RESET_DATA_HISTORY}".${col}`).join(', ')
      : `"${RESET_DATA_HISTORY}".*`;

    // Base query with DISTINCT ON (sno)
    let sql = `
    SELECT DISTINCT ON ("${RESET_DATA_HISTORY}".sno)
      ${selectColumns},
      json_build_object(
        'status', "${PAYIN}".status,
        'user_submitted_utr', "${PAYIN}".user_submitted_utr
      ) AS new_details,
      CASE
        WHEN "${PAYIN}".bank_response_id IS NOT NULL THEN
          json_build_object(
            'amount', "${BANK_RESPONSE}".amount,
            'utr', "${BANK_RESPONSE}".utr,
            'previous_status', "${RESET_DATA_HISTORY}".pre_status
          )
        ELSE
          json_build_object(
            'amount', "${PAYIN}".amount,
            'utr', "${PAYIN}".user_submitted_utr,
            'previous_status', "${RESET_DATA_HISTORY}".pre_status
          )
      END AS previous_details,
      "${PAYIN}".merchant_order_id AS merchant_order_id,
      created_user.user_name AS created_by,
      updated_user.user_name AS updated_by
    FROM "${RESET_DATA_HISTORY}"
    JOIN "${PAYIN}" ON "${RESET_DATA_HISTORY}".payin_id = "${PAYIN}".id
    LEFT JOIN "${BANK_RESPONSE}" ON "${PAYIN}".bank_response_id = "${BANK_RESPONSE}".id
    LEFT JOIN "${USER}" AS created_user ON "${RESET_DATA_HISTORY}".created_by = created_user.id 
    LEFT JOIN "${USER}" AS updated_user ON "${RESET_DATA_HISTORY}".updated_by = updated_user.id
  `;

    // Handle filters
    const whereClauses = [];
    let paramIndex = 1;

    if (filters.search) {
      // Assuming search applies to a few key fields (e.g., utr, merchant_order_id)
      whereClauses.push(`
        ("${RESET_DATA_HISTORY}".sno::text ILIKE $${paramIndex}
        OR "${PAYIN}".merchant_order_id ILIKE $${paramIndex}
        OR "${BANK_RESPONSE}".utr ILIKE $${paramIndex})
      `);
      queryParams.push(`%${filters.search}%`);
      paramIndex++;
    }

    // Add additional filters (e.g., status, amount)
    for (const [key, value] of Object.entries(filters)) {
      if (key !== 'search' && value !== undefined) {
        whereClauses.push(`"${RESET_DATA_HISTORY}".${key} = $${paramIndex}`);
        queryParams.push(value);
        paramIndex++;
      }
    }

    if (whereClauses.length > 0) {
      sql += ` WHERE ${whereClauses.join(' AND ')}`;
    }
    let limitcondition = '';
    if (page && pageSize) {
      limitcondition = `LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
      queryParams.push(pageSize, (page - 1) * pageSize);
    }
    if (startDate && endDate) {
      const startDateTime = dayjs
        .tz(`${startDate} 00:00:00`, 'Asia/Kolkata')
        .toISOString(true);
      const endDateTime = dayjs
        .tz(`${endDate} 23:59:59.999`, 'Asia/Kolkata')
        .toISOString(true);

      sql += ` AND "${RESET_DATA_HISTORY}".created_at BETWEEN $${paramIndex} AND $${paramIndex + 1}`;
      queryParams.push(startDateTime, endDateTime);
      paramIndex++;
    }

    // Sorting
    const validSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    sql += ` ORDER BY "${RESET_DATA_HISTORY}".${sortBy} ${validSortOrder} ${limitcondition}`;

    // Pagination
    // const offset = (page - 1) * pageSize;
    // sql += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    // queryParams.push(pageSize, offset);
    // paramIndex += 2;

    // Execute both queries
    const [result] = await Promise.all([executeQuery(sql, queryParams)]);

    return {
      resetHistory: result.rows,
    };
  } catch (error) {
    logger.error('Error getting CheckUtr:', error);
    throw error;
  }
};

const getResetHistoryBySearchDao = async (
  company_id,
  searchTerms,
  limitNum,
  offset,
) => {
  try {
    const conditions = [];
    const values = [];
    let paramIndex = 1;

    // Default columns with table aliases

    let queryText = `
      SELECT 
        rdh.*,
        p.merchant_order_id,
        json_build_object(
          'status', p.status,
          'user_submitted_utr', p.user_submitted_utr
        ) AS new_details,
        c.first_name || ' ' || c.last_name AS company,
        json_build_object(
          'amount', br.amount,
          'utr', br.utr,
          'previous_status', rdh.pre_status
        ) AS previous_details
      FROM public."ResetDataHistory" rdh
      JOIN public."Payin" p ON rdh.payin_id = p.id
      LEFT JOIN public."Company" c
        ON rdh.company_id = c.id
      LEFT JOIN LATERAL (
    SELECT utr, amount
    FROM public."BankResponse" 
    WHERE bank_id = p.bank_acc_id
    ORDER BY created_at DESC  
    LIMIT 1
    ) br ON true
    WHERE rdh.is_obsolete = false
    `;

    // Add company_id filter only if present in filters
    if (company_id) {
      if (typeof company_id === 'string' && company_id.includes(',')) {
        const arr = company_id.split(',').map(v => v.trim()).filter(Boolean);
        queryText += ` AND rdh."company_id" = ANY($${paramIndex})`;
        values.push(arr);
        paramIndex++;
      } else if (Array.isArray(company_id)) {
        queryText += ` AND rdh."company_id" = ANY($${paramIndex})`;
        values.push(company_id);
        paramIndex++;
      } else {
        queryText += ` AND rdh."company_id" = $${paramIndex}`;
        values.push(company_id);
        paramIndex++;
      }
    }

    searchTerms.forEach((term) => {
      if (term.toLowerCase() === 'true' || term.toLowerCase() === 'false') {
        const boolValue = term.toLowerCase() === 'true';
        conditions.push(`rdh.is_obsolete = $${paramIndex}`);
        values.push(boolValue);
        paramIndex++;
      } else {
        conditions.push(`
          (
            LOWER(rdh.id::text) LIKE LOWER($${paramIndex})
            OR LOWER(rdh.sno::text) LIKE LOWER($${paramIndex})
            OR LOWER(rdh.payin_id::text) LIKE LOWER($${paramIndex})
            OR LOWER(rdh.created_by) LIKE LOWER($${paramIndex})
            OR LOWER(rdh.updated_by) LIKE LOWER($${paramIndex})
            OR LOWER(p.merchant_order_id) LIKE LOWER($${paramIndex})
            OR LOWER(p.status) LIKE LOWER($${paramIndex})
            OR LOWER(p.user_submitted_utr) LIKE LOWER($${paramIndex})
            OR LOWER(br.utr) LIKE LOWER($${paramIndex})
            OR LOWER(br.amount::text) LIKE LOWER($${paramIndex})
            OR LOWER(rdh.pre_status) LIKE LOWER($${paramIndex})
            OR LOWER(c.first_name || ' ' || c.last_name) LIKE LOWER($${paramIndex})
            OR LOWER(rdh.config->>'from_UI') LIKE LOWER($${paramIndex})
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
      ORDER BY rdh.created_at DESC
      LIMIT $${values.length + 1}
      OFFSET $${values.length + 2}
    `;
    values.push(limitNum, offset);

    const countResult = await executeQuery(countQuery, values.slice(0, -2));
    let searchResult = await executeQuery(queryText, values);

    const totalItems = parseInt(countResult.rows[0].total);
    let totalPages = Math.ceil(totalItems / limitNum);
    if (totalItems > 0 && searchResult.rows.length === 0 && offset > 0) {
      values[values.length - 1] = 0; 
      searchResult = await executeQuery(queryText, values);
      totalPages = Math.ceil(totalItems / limitNum);
    }
    return {
      totalCount: totalItems,
      totalPages,
      resetHistory: searchResult.rows,
    };
  } catch (error) {
    logger.error('Error in getResetHistoryBySearchDao:', error);
    throw error;
  }
};
const createResetHistoryDao = async (payload,conn) => {
  try {
    const tableName = 'ResetDataHistory';
    const [sql, params] = buildInsertQuery(tableName, payload);
    if (conn && conn.query) {
      const result = await conn.query(sql, params);
      return result.rows[0];
    }
    const result = await executeQuery(sql, params);
    return result.rows[0];
  } catch (error) {
    logger.error('Error in createResetHistoryDao:', error);
    throw error;
  }
};

const updateResetHistoryDao = async (id, data) => {
  try {
    const tableName = 'ResetHistory';
    const [sql, params] = buildUpdateQuery(tableName, data, { id });
    const result = await executeQuery(sql, params);
    return result.rows[0];
  } catch (error) {
    logger.error('Error in updateResetHistoryDao:', error);
    throw error;
  }
};

const deleteResetHistoryDao = async (id, data) => {
  try {
    const tableName = 'ResetHistory';
    const [sql, params] = buildUpdateQuery(tableName, data, { id });
    const result = await executeQuery(sql, params);
    return result.rows[0];
  } catch (error) {
    logger.error('Error in deleteResetHistoryDao:', error);
    throw error;
  }
};

export {
  getResetHistoryDao,
  createResetHistoryDao,
  updateResetHistoryDao,
  getResetHistoryBySearchDao,
  deleteResetHistoryDao,
};
