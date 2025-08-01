import { tableName } from '../../constants/index.js';
import {
  buildAndExecuteUpdateQuery,
  buildInsertQuery,
  buildUpdateQuery,
  executeQuery,
} from '../../utils/db.js';
import { logger } from '../../utils/logger.js';
import dayjs from 'dayjs';
const IST = 'Asia/Kolkata';

export const createPayoutDao = async (conn, data) => {
  try {
    // Ensure `config` is initialized if not provided
    if (!data.config) {
      data.config = {}; // Default to an empty JSON object
    }

    const [sql, params] = buildInsertQuery(tableName.PAYOUT, data);
    const result = conn
      ? await conn.query(sql, params)
      : await executeQuery(sql, params);

    return result.rows[0];
  } catch (error) {
    logger.error('Error in createPayoutDao:', error);
    throw error;
  }
};
export const assignedPayoutDao = async (
  payoutData,
  vendorId,
  updated_by,
  company_id,
  conn,
) => {
  try {
    if (!Array.isArray(payoutData)) {
      throw new Error('payoutData must be an array');
    }
    const results = [];
    for (const data of payoutData) {
      const updatedData = {
        vendor_id: vendorId.id,
        updated_by: updated_by,
      };
      const [sql, params] = buildUpdateQuery(tableName.PAYOUT, updatedData, {
        id: data,
        company_id
      });
      const result = conn
        ? await conn.query(sql, params)
        : await executeQuery(sql, params);

      results.push(result.rows[0].id);
    }
    return results;
  } catch (error) {
    logger.error('Error in assignedPayoutDao:', error);
    throw error;
  }
};
export const getPayoutsDao = async (
  filters,
  company_id,
  page,
  limit,
  sortOrder = 'DESC',
  role,
  conn,
) => {
  try {
    if (typeof company_id === 'string') {
      company_id = company_id.trim();
    }

    let conditions = [`u.is_obsolete = false`];
    let queryParams = [];
    let paramIndex = 1;
    if (company_id) {
      conditions.push(`u.company_id = $${paramIndex}`);
      queryParams.push(company_id);
      paramIndex++;
    }
    let limitcondition = '';

    if (filters?.startDate && filters?.endDate) {
      let start;
      let end;
      start = dayjs.tz(`${filters?.startDate} 00:00:00`, IST).utc().format(); // UTC ISO string
      end = dayjs.tz(`${filters?.endDate} 23:59:59.999`, IST).utc().format();

      conditions.push(
        `u.updated_at BETWEEN $${paramIndex} AND $${paramIndex + 1}`,
      );
      queryParams.push(start, end);
      paramIndex += 2;
    }

    if (page && limit) {
      limitcondition = `LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      queryParams.push(limit, (page - 1) * limit);
      paramIndex += 2;
    }

    const handledKeys = new Set(['page', 'limit', 'startDate', 'endDate']);
    Object.entries(filters).forEach(([key, value]) => {
      if (handledKeys.has(key) || value == null || value === '') return;
      const nextParamIdx = paramIndex;
      if (Array.isArray(value)) {
        const placeholders = value
          .map((_, idx) => `$${nextParamIdx + idx}`)
          .join(', ');
        conditions.push(`u."${key}" IN (${placeholders})`);
        queryParams.push(...value);
        paramIndex += value.length;
      } else {
        const isMultiValue = typeof value === 'string' && value.includes(',');
        const valueArray = isMultiValue
          ? value.split(',').map((v) => v.trim())
          : [value];
        const placeholders = valueArray
          .map((_, idx) => `$${nextParamIdx + idx}`)
          .join(', ');
        if (key === 'startDate' || key === 'endDate') {
          conditions.push(isMultiValue ? `u."${key}"` : `u."${key}"`);
        } else {
          conditions.push(
            isMultiValue
              ? `u."${key}" IN (${placeholders})`
              : `u."${key}" = $${nextParamIdx}`,
          );
        }
        queryParams.push(...valueArray);
        paramIndex += valueArray.length;
      }
    });

    let commissionSelect = '';
    if (role === 'MERCHANT') {
      commissionSelect = `
        u.payout_merchant_commission, 
        u.merchant_order_id,
        u.user,
        json_build_object(
          'merchant_code', r.code,
          'return_url', r.config->>'return_url',
          'notify_url', r.config->>'notify_url'
        ) AS merchant_details
      `;
    } else if (role === 'VENDOR') {
      commissionSelect = `
        u.payout_vendor_commission, 
        ve.code AS vendor_code,
        ve.id AS vendor_id, 
        ve.user_id AS vendor_user_id,
        u.config->>'method' AS payout_method`;
    } else {
      commissionSelect = `
        u.merchant_id, 
        u.payout_merchant_commission, 
        u.payout_vendor_commission,     
        u.bank_acc_id,
        u.approved_at, 
        u.created_by, 
        u.updated_by, 
        u.created_at, 
        u.user,
        ve.code AS vendor_code, 
        ve.id AS vendor_id, 
        ve.user_id AS vendor_user_id,
        u.config AS payout_details,
        u.merchant_order_id,
        u.updated_at,
        b.user_id, 
        us.user_name AS created_by,  
        uu.user_name AS updated_by,
        json_build_object(
          'merchant_code', COALESCE(r.config->>'sub_code', r.code),
          'return_url', r.config->>'return_url',
          'notify_url', r.config->>'notify_url',
          'public_key', r.config->'keys'->>'public',
          'private_key', r.config->'keys'->>'private'
        ) AS merchant_details
      `;
    }

    let baseQuery = `
      WITH filtered_payOuts AS (
        SELECT DISTINCT ON (u.id) 
          u.id, 
          u.sno, 
          u.bank_acc_id, 
          u.amount,
          u.status, 
          u.merchant_order_id,
          u.failed_reason, 
          u.currency, 
          u.upi_id, 
          u.utr_id, 
          u.rejected_reason,
          ${commissionSelect}, 
          b.id AS bank_table_id, 
          b.user_id,
          b.nick_name,
          json_build_object(
            'account_holder_name', u.acc_holder_name,
            'account_no', u.acc_no,
            'ifsc_code', u.ifsc_code,
            'bank_name', u.bank_name
          ) AS user_bank_details,
          u.created_at,
          u.updated_at,
          u.approved_at,
          u.rejected_at
        FROM public."Payout" u
        LEFT JOIN public."Merchant" r ON u.merchant_id = r.id
        LEFT JOIN public."BankAccount" b ON u.bank_acc_id = b.id
        LEFT JOIN public."Vendor" ve ON u.vendor_id = ve.id
        LEFT JOIN public."User" us ON u.created_by = us.id 
        LEFT JOIN public."User" uu ON u.updated_by = uu.id
        WHERE ${conditions.join(' AND ')}  
      ),
      total_count AS (
        SELECT COUNT(*) AS total FROM filtered_payOuts
      )
      SELECT * FROM filtered_payOuts, total_count
      ORDER BY sno ${sortOrder}
      ${limitcondition}
    `;

    let result;

    if (conn && conn.query) {
      result = await conn.query(baseQuery, queryParams);
    } else {
      result = await executeQuery(baseQuery, queryParams);
    }
    return result.rows;
  } catch (error) {
    logger.error('Error in getPayoutsDao:', error);
    throw error;
  }
};

export const getPayoutBankDetailsDao = async (filters, company_id) => {
  try {
    const conditions = [`u.is_obsolete = false`];
    const queryParams = [];
    let paramIndex = 1;

    if (company_id) {
      conditions.push(`u.company_id = $${paramIndex}`);
      queryParams.push(company_id);
      paramIndex++;
    }

    // Handle payOutids array
    if (filters.payOutids && Array.isArray(filters.payOutids)) {
      conditions.push(`u.id = ANY($${paramIndex})`);
      queryParams.push(filters.payOutids);
      paramIndex++;
    }

    const baseQuery = `
      SELECT 
        u.id,
        u.amount,
        u.status,
        json_build_object(
          'account_holder_name', u.acc_holder_name,
          'account_no', u.acc_no,
          'ifsc_code', u.ifsc_code,
          'bank_name', u.bank_name
        ) AS user_bank_details
      FROM public."Payout" u
      WHERE ${conditions.join(' AND ')}
      ORDER BY u.sno DESC
    `;

    const result = await executeQuery(baseQuery, queryParams);
    return result.rows;

  } catch (error) {
    logger.error('Error in getPayoutBankDetailsDao:', error);
    throw error.message;
  }
};

export const getAllPayoutsDao = async (
  filters,
  company_id,
  page,
  limit,
  sortOrder = 'DESC',
  role,
  conn,
) => {
  try {
    if (typeof company_id === 'string') {
      company_id = company_id.trim();
    }

    let conditions = [`u.is_obsolete = false`];
    let queryParams = [];
    let paramIndex = 1;
    if (company_id) {
      conditions.push(`u.company_id = $${paramIndex}`);
      queryParams.push(company_id);
      paramIndex++;
    }
    let limitcondition = '';

    if (filters?.startDate && filters?.endDate) {
      let start;
      let end;
      start = dayjs.tz(`${filters?.startDate} 00:00:00`, IST).utc().format(); // UTC ISO string
      end = dayjs.tz(`${filters?.endDate} 23:59:59.999`, IST).utc().format();

      conditions.push(
        `u.updated_at BETWEEN $${paramIndex} AND $${paramIndex + 1}`,
      );
      queryParams.push(start, end);
      paramIndex += 2;
    }

    if (page && limit) {
      limitcondition = `LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      queryParams.push(limit, (page - 1) * limit);
      paramIndex += 2;
    }

    const handledKeys = new Set(['page', 'limit', 'startDate', 'endDate']);
    Object.entries(filters).forEach(([key, value]) => {
      if (handledKeys.has(key) || value == null || value === '') return;
      const nextParamIdx = paramIndex;
      if (Array.isArray(value)) {
        const placeholders = value
          .map((_, idx) => `$${nextParamIdx + idx}`)
          .join(', ');
        conditions.push(`u."${key}" IN (${placeholders})`);
        queryParams.push(...value);
        paramIndex += value.length;
      } else {
        const isMultiValue = typeof value === 'string' && value.includes(',');
        const valueArray = isMultiValue
          ? value.split(',').map((v) => v.trim())
          : [value];
        const placeholders = valueArray
          .map((_, idx) => `$${nextParamIdx + idx}`)
          .join(', ');
        if (key === 'startDate' || key === 'endDate') {
          conditions.push(isMultiValue ? `u."${key}"` : `u."${key}"`);
        } else {
          conditions.push(
            isMultiValue
              ? `u."${key}" IN (${placeholders})`
              : `u."${key}" = $${nextParamIdx}`,
          );
        }
        queryParams.push(...valueArray);
        paramIndex += valueArray.length;
      }
    });

    let commissionSelect = '';
    if (role === 'MERCHANT') {
      commissionSelect = `
        u.payout_merchant_commission, 
        u.merchant_order_id,
        u.user,
        json_build_object(
          'merchant_code', r.code,
          'return_url', r.config->>'return_url',
          'notify_url', r.config->>'notify_url'
        ) AS merchant_details
      `;
    } else if (role === 'VENDOR') {
      commissionSelect = `
        u.payout_vendor_commission, 
        ve.code AS vendor_code,
        u.config->>'method' AS payout_method`;
    } else {
      commissionSelect = `
        u.merchant_id, 
        u.payout_merchant_commission, 
        u.payout_vendor_commission,     
        u.bank_acc_id,
        u.approved_at, 
        u.created_by, 
        u.updated_by, 
        u.created_at, 
        u.user,
        ve.code AS vendor_code, 
        ve.id AS vendor_id, 
        ve.user_id AS vendor_user_id,
        u.config AS payout_details,
        u.merchant_order_id,
        u.updated_at,
        b.user_id, 
        us.user_name AS created_by,  
        uu.user_name AS updated_by,
        json_build_object(
          'merchant_code', COALESCE(r.config->>'sub_code', r.code),
          'return_url', r.config->>'return_url',
          'notify_url', r.config->>'notify_url',
          'public_key', r.config->'keys'->>'public',
          'private_key', r.config->'keys'->>'private'
        ) AS merchant_details
      `;
    }

    let baseQuery = `
      WITH filtered_payOuts AS (
        SELECT DISTINCT ON (u.id) 
          u.id, 
          u.sno, 
          u.amount,
          u.status, 
          u.failed_reason, 
          u.currency, 
          u.upi_id, 
          u.utr_id, 
          u.rejected_reason,
          ${commissionSelect}, 
          b.nick_name,
          json_build_object(
            'account_holder_name', u.acc_holder_name,
            'account_no', u.acc_no,
            'ifsc_code', u.ifsc_code,
            'bank_name', u.bank_name
          ) AS user_bank_details,
          u.created_at,
          u.updated_at,
          u.approved_at,
          u.rejected_at
        FROM public."Payout" u
        LEFT JOIN public."Merchant" r ON u.merchant_id = r.id
        LEFT JOIN public."BankAccount" b ON u.bank_acc_id = b.id
        LEFT JOIN public."Vendor" ve ON u.vendor_id = ve.id
        LEFT JOIN public."User" us ON u.created_by = us.id 
        LEFT JOIN public."User" uu ON u.updated_by = uu.id
        WHERE ${conditions.join(' AND ')}  
      ),
      total_count AS (
        SELECT COUNT(*) AS total FROM filtered_payOuts
      )
      SELECT * FROM filtered_payOuts, total_count
      ORDER BY sno ${sortOrder}
      ${limitcondition}
    `;

    let result;

    if (conn && conn.query) {
      result = await conn.query(baseQuery, queryParams);
    } else {
      result = await executeQuery(baseQuery, queryParams);
    }
    return result.rows;
  } catch (error) {
    logger.error('Error in getPayoutsDao:', error);
    throw error;
  }
};

export const getPayoutsBySearchDao = async (
  filters,
  searchTerms,
  limitNum,
  offset,
  role,
) => {
  try {
    const conditions = [`p.is_obsolete = false`, `p.company_id = $1`];
    const queryParams = [filters.company_id];
    let paramIndex = 2;
    const handledKeys = new Set(['status']);
    const validColumns = new Set([
      'id',
      'sno',
      'user',
      'bank_acc_id',
      'amount',
      'status',
      'merchant_order_id',
      'failed_reason',
      'currency',
      'upi_id',
      'utr_id',
      'rejected_reason',
      'config',
      'payout_merchant_commission',
      'payout_vendor_commission',
      'approved_at',
      'created_by',
      'updated_by',
      'created_at',
      'updated_at',
      'is_obsolete',
      'company_id',
      'merchant_id',
      'vendor_id',
      'acc_holder_name',
      'acc_no',
      'ifsc_code',
      'bank_name',
    ]);

    let commissionSelect = '';
    if (role === 'MERCHANT') {
      commissionSelect = `
        p.payout_merchant_commission, 
        p.merchant_order_id, 
        p.user, 
        json_build_object(
          'merchant_code', m.code,
          'return_url', m.config->>'return_url',
          'notify_url', m.config->>'notify_url'
        ) AS merchant_details
      `;
    } else if (role === 'VENDOR') {
      commissionSelect = `
        p.payout_vendor_commission, 
        v.code AS vendor_code,
        p.config->>'method' AS payout_method
      `;
    } else {
      commissionSelect = `
        p.merchant_id, 
        p.payout_merchant_commission, 
        p.payout_vendor_commission, 
        p.merchant_order_id,
        p.bank_acc_id,
        p.approved_at, 
        p.created_by, 
        p.updated_by, 
        p.user, 
        p.created_at, 
        v.code AS vendor_code, 
        v.id AS vendor_id, 
        v.user_id AS vendor_user_id,
        p.config AS payout_details,
        p.updated_at,
        b.user_id, 
        json_build_object(
          'merchant_code', COALESCE(m.config->>'sub_code', m.code),
          'return_url', m.config->>'return_url',
          'notify_url', m.config->>'notify_url',
          'public_key', m.config->'keys'->>'public',
          'private_key', m.config->'keys'->>'private'
        ) AS merchant_details
      `;
    }

    let queryText = `
      SELECT DISTINCT ON (p.id) 
        p.id, 
        p.sno,
        p.amount,
        p.status, 
        p.failed_reason, 
        p.currency, 
        p.upi_id, 
        p.utr_id, 
        p.rejected_reason,
        ${commissionSelect},
        b.nick_name,
        json_build_object(
          'account_holder_name', p.acc_holder_name,
          'account_no', p.acc_no,
          'ifsc_code', p.ifsc_code,
          'bank_name', p.bank_name
        ) AS user_bank_details,
        p.created_at,
        p.updated_at,
        p.approved_at,
        p.rejected_at
      FROM public."Payout" p
      LEFT JOIN public."Merchant" m ON p.merchant_id = m.id
      LEFT JOIN public."BankAccount" b ON p.bank_acc_id = b.id
      LEFT JOIN public."Vendor" v ON p.vendor_id = v.id
      WHERE ${conditions.join(' AND ')}
    `;

    if (filters.status) {
      let statusArray;
      if (Array.isArray(filters.status)) {
        statusArray = filters.status
          .map((s) => String(s).trim())
          .filter((s) => s);
      } else {
        statusArray = filters.status
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s);
      }
      statusArray = [...new Set(statusArray)];
      if (statusArray.length > 0) {
        queryText += ` AND p.status IN (${statusArray.map((_, i) => `$${paramIndex + i}`).join(', ')})`;
        queryParams.push(...statusArray);
        paramIndex += statusArray.length;
      }
    }

    searchTerms.forEach((term) => {
      if (term.toLowerCase() !== 'true' && term.toLowerCase() !== 'false') {
        conditions.push(`
          (
            LOWER(p.id::text) LIKE LOWER($${paramIndex})
            OR LOWER(p.user) LIKE LOWER($${paramIndex})
            OR LOWER(p.merchant_order_id) LIKE LOWER($${paramIndex})
            OR LOWER(p.failed_reason) LIKE LOWER($${paramIndex})
            OR LOWER(p.currency) LIKE LOWER($${paramIndex})
            OR LOWER(p.upi_id) LIKE LOWER($${paramIndex})
            OR LOWER(p.utr_id) LIKE LOWER($${paramIndex})
            OR LOWER(p.status) LIKE LOWER($${paramIndex})
            OR LOWER(p.rejected_reason) LIKE LOWER($${paramIndex})
            OR LOWER(b.nick_name) LIKE LOWER($${paramIndex})
            OR LOWER(m.code) LIKE LOWER($${paramIndex})
            OR LOWER(v.code) LIKE LOWER($${paramIndex})
            OR p.amount::text LIKE $${paramIndex}
            OR LOWER(p.config->>'method') LIKE LOWER($${paramIndex})
            OR LOWER(p.config->>'rejected_reason') LIKE LOWER($${paramIndex})
            OR LOWER(p.acc_holder_name) LIKE LOWER($${paramIndex})
            OR LOWER(p.acc_no) LIKE LOWER($${paramIndex})
            OR LOWER(p.ifsc_code) LIKE LOWER($${paramIndex})
            OR LOWER(p.bank_name) LIKE LOWER($${paramIndex})
          )
        `);
        queryParams.push(`%${term}%`);
        paramIndex++;
      }
    });

    Object.entries(filters).forEach(([key, value]) => {
      if (handledKeys.has(key) || value == null || !validColumns.has(key)) {
        if (!validColumns.has(key) && key !== 'status') {
          logger.warn(`Invalid filter key ignored: ${key}`);
        }
        return;
      }
      const nextParamIdx = queryParams.length + 1;
      if (Array.isArray(value)) {
        const placeholders = value
          .map((_, idx) => `$${nextParamIdx + idx}`)
          .join(', ');
        conditions.push(`p.${key} IN (${placeholders})`);
        queryParams.push(...value);
      } else {
        const isMultiValue = typeof value === 'string' && value.includes(',');
        const valueArray = isMultiValue
          ? value.split(',').map((v) => v.trim())
          : [value];
        const placeholders = valueArray
          .map((_, idx) => `$${nextParamIdx + idx}`)
          .join(', ');
        conditions.push(
          isMultiValue
            ? `p.${key} IN (${placeholders})`
            : `p.${key} = $${nextParamIdx}`,
        );
        queryParams.push(...valueArray);
      }
    });

    if (conditions.length > 2) {
      queryText += ' AND (' + conditions.slice(2).join(' AND ') + ')';
    }

    const countQuery = `SELECT COUNT(*) as total FROM (${queryText}) as count_table`;

    queryText += `
      ORDER BY p.id, p.created_at DESC
      LIMIT $${queryParams.length + 1}
      OFFSET $${queryParams.length + 2}
    `;
    queryParams.push(limitNum, offset);

    const expectedParamCount = (queryText.match(/\$\d+/g) || []).length;
    if (expectedParamCount !== queryParams.length) {
      logger.warn(
        `Expected: ${expectedParamCount}, Got: ${queryParams.length}`,
      );
    }

    const countResult = await executeQuery(
      countQuery,
      queryParams.slice(0, -2),
    );
    const searchResult = await executeQuery(queryText, queryParams);

    const totalItems = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(totalItems / limitNum);

    return {
      totalCount: totalItems,
      totalPages,
      payout: searchResult.rows,
    };
  } catch (error) {
    logger.error('Error in getPayoutsBySearchDao:', error);
    throw error;
  }
};

export const getPayoutsCronDao = async (conn, payload) => {
  try {
    let baseQuery = `SELECT * FROM public."Payout" 
      WHERE is_obsolete = false AND status = $1
      ORDER BY created_at
    `;
    const queryParams = [payload];

    const result = await conn.query(baseQuery, queryParams);
    return result.rows;
  } catch (error) {
    logger.error('Error in createPayoutDao:', error);
    throw error;
  }
};

export const updatePayoutDao = async (ids, data, conn) => {
  try {
    // Clone the data object to avoid modifying the original
    const updateData = { ...data };

    // If config is present, ensure it's properly formatted
    if (updateData.config && typeof updateData.config === 'object') {
      // Get existing config first to merge with new config
      const existingData = await executeQuery(
        `SELECT config FROM "${tableName.PAYOUT}" WHERE id = $1`,
        [ids.id],
      );

      if (existingData.rows.length > 0) {
        const existingConfig = existingData.rows[0].config || {};
        // Merge existing config with new config
        updateData.config = {
          ...existingConfig,
          ...updateData.config,
        };
      }
    }

    // Use buildAndExecuteUpdateQuery
    return await buildAndExecuteUpdateQuery(
      tableName.PAYOUT,
      updateData,
      ids,
      {}, // No special fields
      { returnUpdated: true },
      conn,
    );
  } catch (error) {
    logger.error('Error occurred while updating payout:', error);
    throw error;
  }
};

export const deletePayoutDao = async (ids, data) => {
  try {
    const [sql, params] = buildUpdateQuery(tableName.PAYOUT, data, ids);
    const result = await executeQuery(sql, params);
    return result.rows[0];
  } catch (error) {
    logger.error('Error occurred while deleting payout:', error);
    throw error;
  }
};
