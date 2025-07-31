import { tableName } from '../../constants/index.js';
import {
  buildInsertQuery,
  buildUpdateQuery,
  executeQuery,
} from '../../utils/db.js';
import { logger } from '../../utils/logger.js';
import dayjs from 'dayjs';

const getCheckUtrDao = async (
  filters = {},
  page,
  pageSize,
  sortBy = 'sno',
  sortOrder = 'DESC',
  columns = [],
) => {
  try {
    const { BANK_RESPONSE, CHECK_UTR_HISTORY, PAYIN, USER } = tableName;
    //reset pagination if page and limit is not present
    let queryParams = [];
    let limitcondition = '';
    if (page && pageSize) {
      limitcondition = `LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
      queryParams.push(pageSize, (page - 1) * pageSize);
    }

    // Default columns if none provided
    const selectColumns = columns?.length
      ? columns.map((col) => `"${CHECK_UTR_HISTORY}".${col}`).join(', ')
      : `"${CHECK_UTR_HISTORY}".*`;

    // Base query
    let sql = `
      SELECT DISTINCT ON ("${CHECK_UTR_HISTORY}".sno)
        ${selectColumns},
        json_build_object(
          'merchant_order_id', "${PAYIN}".merchant_order_id,
          'requested_amount', "${PAYIN}".amount,
          'user_submitted_utr', "${PAYIN}".user_submitted_utr
        ) AS payin_details,
         u.user_name AS created_by,
         uu.user_name AS updated_by,
        CASE
          WHEN "${BANK_RESPONSE}".id IS NOT NULL THEN
            json_build_object(
              'status', "${BANK_RESPONSE}".status,
              'utr', "${BANK_RESPONSE}".utr,
              'amount', "${BANK_RESPONSE}".amount,
              'is_used', "${BANK_RESPONSE}".is_used,
              'upi_short_code', "${BANK_RESPONSE}".upi_short_code
            )
          ELSE
            NULL
        END AS bank_response_details,
        "${PAYIN}".merchant_order_id AS merchant_order_id
      FROM "${CHECK_UTR_HISTORY}"
      JOIN "${PAYIN}" 
        ON "${CHECK_UTR_HISTORY}".payin_id = "${PAYIN}".id
      LEFT JOIN "${BANK_RESPONSE}" 
        ON "${PAYIN}".bank_response_id = "${BANK_RESPONSE}".id
      LEFT JOIN "${USER}" u ON "${CHECK_UTR_HISTORY}".created_by = u.id 
      LEFT JOIN "${USER}" uu ON "${CHECK_UTR_HISTORY}".updated_by = uu.id
      WHERE u.company_id = '${filters.company_id}'
    `;

    // Handle filters
    const whereClauses = [];
    let paramIndex = 1;
    if (filters.startDate && filters.endDate) {
      const startDateTime = dayjs
        .tz(`${filters.startDate} 00:00:00`, 'Asia/Kolkata')
        .toISOString(true);
      const endDateTime = dayjs
        .tz(`${filters.endDate} 23:59:59.999`, 'Asia/Kolkata')
        .toISOString(true);

      sql += ` WHERE "${CHECK_UTR_HISTORY}".created_at BETWEEN $${paramIndex} AND $${paramIndex + 1}`;
      queryParams.push(startDateTime, endDateTime);
      paramIndex++;
    }
    if (filters.search) {
      whereClauses.push(`
        ("${CHECK_UTR_HISTORY}".payin_id::text ILIKE $${paramIndex}
        OR "${PAYIN}".merchant_order_id ILIKE $${paramIndex}
        OR "${BANK_RESPONSE}".utr ILIKE $${paramIndex})
      `);
      queryParams.push(`%${filters.search}%`);
      paramIndex++;
    }

    if (whereClauses.length > 0) {
      sql += ` WHERE ${whereClauses.join(' AND ')}`;
    }

    // Sorting with validation
    const validSortOrder = sortOrder?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    const validColumns = ['sno', 'payin_id']; // Add all valid columns here
    const effectiveSortBy = validColumns.includes(sortBy) ? sortBy : 'sno';
    sql += ` ORDER BY "${CHECK_UTR_HISTORY}".${effectiveSortBy} ${validSortOrder} ${limitcondition}`;

    // Pagination
    // const offset = (page - 1) * pageSize;
    // sql += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    // queryParams.push(pageSize, offset);

    // Execute query
    const result = await executeQuery(sql, queryParams);

    return {
      checkutr: result.rows,
    };
  } catch (error) {
    logger.error('Error getting all CheckUtr:', error);
    throw error;
  }
};

const getCheckUtrBySearchDao = async (
  company_id,
  searchTerms,
  limitNum,
  offset,
) => {
  try {
    const conditions = [];
    const values = [company_id];
    let paramIndex = 2;
    let queryText = `
      SELECT 
        "CheckUtrHistory".*, 
        "Payin".merchant_order_id, 
        "Payin".amount, 
        "Payin".user_submitted_utr, 
        "Payin".amount as requested_amount, 
        "BankResponse".status, 
        "BankResponse".utr, 
        "BankResponse".amount, 
        "BankResponse".is_used, 
        "BankResponse".upi_short_code 
      FROM "CheckUtrHistory" 
      JOIN "Payin" ON "CheckUtrHistory".payin_id = "Payin".id 
      LEFT JOIN "BankResponse" ON "Payin".bank_response_id = "BankResponse".id 
      WHERE 1=1 
      AND "CheckUtrHistory".is_obsolete = false 
      AND "CheckUtrHistory"."company_id" = $1
    `;

    searchTerms.forEach((term) => {
      // here it will handle boolean terms separately
      if (term.toLowerCase() === 'true' || term.toLowerCase() === 'false') {
        const boolValue = term.toLowerCase() === 'true';
        conditions.push(`
          (
            "CheckUtrHistory"."is_obsolete" = $${paramIndex}
            OR "BankResponse".is_used = $${paramIndex}
          )
        `);
        values.push(boolValue);
        paramIndex++;
      } else {
        // it will handle text/numeric terms
        conditions.push(`
          (
            LOWER("CheckUtrHistory"."id"::text) LIKE LOWER($${paramIndex})
            OR LOWER("Payin".merchant_order_id) LIKE LOWER($${paramIndex})
            OR LOWER("Payin".user_submitted_utr) LIKE LOWER($${paramIndex})
            OR LOWER("BankResponse".status) LIKE LOWER($${paramIndex})
            OR LOWER("BankResponse".utr) LIKE LOWER($${paramIndex})
            OR LOWER("BankResponse".upi_short_code) LIKE LOWER($${paramIndex})
            OR "Payin".amount::text LIKE $${paramIndex}
            OR "BankResponse".amount::text LIKE $${paramIndex}
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
      ORDER BY "CheckUtrHistory"."created_at" DESC
      LIMIT $${values.length + 1}
      OFFSET $${values.length + 2}
    `;
    values.push(limitNum, offset);

    const countResult = await executeQuery(countQuery, values.slice(0, -2));
    let searchResult = await executeQuery(queryText, values);

    const totalItems = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(totalItems / limitNum);
    if (totalItems > 0 && searchResult.rows.length === 0 && offset > 0) {
      values[values.length - 1] = 0; 
      searchResult = await executeQuery(queryText, values);
    }
    const data = {
      totalCount: totalItems,
      totalPages,
      checkUtr: searchResult.rows,
    };
    return data;
  } catch (error) {
    logger.error(error);
    throw error;
  }
};

const createCheckUtrDao = async (payload) => {
  try {
    const [sql, params] = buildInsertQuery(
      tableName.CHECK_UTR_HISTORY,
      payload,
    );
    const result = await executeQuery(sql, params);
    return result.rows[0];
  } catch (error) {
    logger.error('Error creating CheckUtr:', error);
    throw error; // Rethrow the error to propagate it
  }
};

const updateCheckUtrDao = async (id, data) => {
  try {
    const [sql, params] = buildUpdateQuery(tableName.CHECK_UTR_HISTORY, data, {
      id,
    });
    const result = await executeQuery(sql, params);
    return result.rows[0];
  } catch (error) {
    logger.error('Error updating CheckUtr:', error);
    throw error; // Rethrow the error to propagate it
  }
};

const deleteCheckUtrDao = async (id, data) => {
  try {
    const [sql, params] = buildUpdateQuery(tableName.CHECK_UTR_HISTORY, data, {
      id,
    });
    const result = await executeQuery(sql, params);
    return result.rows[0];
  } catch (error) {
    logger.error('Error deleting CheckUtr:', error);
    throw error; // Rethrow the error to propagate it
  }
};

export {
  getCheckUtrDao,
  getCheckUtrBySearchDao,
  createCheckUtrDao,
  updateCheckUtrDao,
  deleteCheckUtrDao,
};
