import { tableName } from '../../constants/index.js';
import { BadRequestError } from '../../utils/appErrors.js';
import {
  buildInsertQuery,
  buildSelectQuery,
  buildUpdateQuery,
  executeQuery,
} from '../../utils/db.js';
import dayjs from 'dayjs';
import { getConnection } from '../../utils/db.js';
import { logger } from '../../utils/logger.js';
import { buildSearchFilterObj } from '../../utils/searchBuilder.js';
// import { newTableEntry } from '../../utils/sockets.js';
export const generatePayInUrlDao = async (data) => {
  try {
    const [sql, params] = buildInsertQuery(tableName.PAYIN, data);
    const result = await executeQuery(sql, params);
    return result.rows[0];
  } catch (error) {
    logger.error('Error generating PayIn URL:', error);
    throw error;
  }
};
export const getPayInCronDao = async (
  filters,
  startDate = new Date(),
  endDate = new Date(),
) => {
  try {
    let baseQuery = `SELECT * FROM "${tableName.PAYIN}" WHERE 1=1`;
    const [sql, queryParams] = buildSelectQuery(baseQuery, filters);
    if (startDate && endDate) {
      baseQuery += ` AND created_at BETWEEN $${Object.keys(queryParams).length + 1} AND $${Object.keys(queryParams).length + 2}`;
      queryParams[`created_at_start`] = startDate;
      queryParams[`created_at_end`] = endDate;
    }
    const result = await executeQuery(sql, queryParams);
    return result.rows[0];
  } catch (error) {
    logger.error('Error getting PayIn data:', error);
    throw error;
  }
};
export const getPayInUrlDao = async (filters) => {
  try {
    const [sql, params] = buildSelectQuery(
      `SELECT * FROM "${tableName.PAYIN}" WHERE 1=1`,
      filters,
    );
    const result = await executeQuery(sql, params);
    return result.rows[0];
  } catch (error) {
    logger.error('Error getting PayIn URL:', error);
    throw error;
  }
};
export const getPayInPendingDao = async ({ company_id, status }) => {
  try {
    const sql = `
      SELECT 
        p.id,
        p.created_at,
        p.user_submitted_utr,
        p.bank_acc_id,
        p.amount,
        p.merchant_order_id,
        p.config,
        m.code as merchant
      FROM "${tableName.PAYIN}" p
      JOIN "${tableName.MERCHANT}" m ON p.merchant_id = m.id
      WHERE p.company_id = $1
        AND p.status = $2
        AND p.updated_at BETWEEN NOW() - INTERVAL '2 days' AND NOW()
    `;
    const params = [company_id, status];
    const result = await executeQuery(sql, params);
    return result.rows;
  } catch (error) {
    logger.error('Error getting PayIn URL:', error);
    throw error;
  }
};

export const getPayInDaoByCode = async (filters) => {
  try {
    const sql = `
    SELECT r.code, p.config, p.merchant_id, p.user
    FROM "${tableName.PAYIN}" p
    LEFT JOIN public."Merchant" r ON p.merchant_id = r.id
    WHERE p.id = $1
      AND p.company_id = $2
  `;
    const params = [filters.id, filters.company_id];
    const result = await executeQuery(sql, params);
    return result.rows;
  } catch (error) {
    logger.error('Error getting PayIn URL:', error);
    throw error;
  }
};

export const getPayInsDao = async (filters, company_id, page, limit, role) => {
  try {
    const { PAYIN } = tableName;

    if (typeof company_id === 'string') {
      company_id = company_id.trim();
    }

    const conditions = [`p.is_obsolete = false`, `p.company_id = $1`];
    const queryParams = [company_id];
    const limitcondition = { value: '' };

    const handledKeys = new Set([
      'search',
      'startDate',
      'endDate',
      'status',
      'sortBy',
      'sortOrder',
      'nick_name',
    ]);

    const conditionBuilders = {
      search: (filters, PAYIN) => {
        if (!filters.search || typeof filters.search !== 'string') return;
        try {
          filters.or = buildSearchFilterObj(filters.search, PAYIN);
          delete filters.search;
        } catch (error) {
          logger.warn(`Invalid search filter: ${filters.search}`, error);
          delete filters.search;
        }
      },
      dateRange: (filters, conditions, queryParams) => {
        if (!filters.startDate || !filters.endDate) return;
        const nextParamIdx = queryParams.length + 1;
        conditions.push(
          `p.created_at BETWEEN $${nextParamIdx} AND $${nextParamIdx + 1}`,
        );
        queryParams.push(filters.startDate, filters.endDate);
      },
      bankName: (filters, conditions, queryParams) => {
        if (!filters.nick_name) return;
        const nextParamIdx = queryParams.length + 1;
        conditions.push(`LOWER(b.nick_name) LIKE LOWER($${nextParamIdx})`);
        queryParams.push(filters.nick_name);
      },
      status: (filters, conditions, queryParams) => {
        if (!filters.status) return;
        const statusArray = filters.status.split(',').map((s) => s.trim());
        const nextParamIdx = queryParams.length + 1;
        const placeholders = statusArray
          .map((_, idx) => `$${nextParamIdx + idx}`)
          .join(', ');
        conditions.push(
          statusArray.length > 1
            ? `p.status IN (${placeholders})`
            : `p.status = $${nextParamIdx}`,
        );
        queryParams.push(...statusArray);
      },
      updated: (filters, conditions) => {
        if (!filters.updatedPayin) return;
        conditions.push(
          `(p.config->>'history' IS NOT NULL AND p.config::jsonb ? 'history')`,
        );
        delete filters.updatedPayin;
      },
      pagination: (page, limit, queryParams, limitconditionRef) => {
        if (!page || !limit) return;
        const nextParamIdx = queryParams.length + 1;
        limitconditionRef.value = `LIMIT $${nextParamIdx} OFFSET $${nextParamIdx + 1}`;
        queryParams.push(limit, (page - 1) * limit);
      },
    };

    conditionBuilders.search(filters, PAYIN);
    conditionBuilders.dateRange(filters, conditions, queryParams);
    conditionBuilders.bankName(filters, conditions, queryParams);
    conditionBuilders.status(filters, conditions, queryParams);
    conditionBuilders.pagination(page, limit, queryParams, limitcondition);
    conditionBuilders.updated(filters, conditions, queryParams);

    Object.entries(filters).forEach(([key, value]) => {
      if (handledKeys.has(key) || value == null) return;
      const nextParamIdx = queryParams.length + 1;

      if (Array.isArray(value)) {
        const placeholders = value
          .map((_, idx) => `$${nextParamIdx + idx}`)
          .join(', ');
        conditions.push(`p.${key} IN (${placeholders})`);
        queryParams.push(...value);
      } else if (key === 'user_ids') {
        const isMultiValue = typeof value === 'string' && value.includes(',');
        const valueArray = isMultiValue
          ? value.split(',').map((v) => v.trim())
          : [value];
        const placeholders = valueArray
          .map((_, idx) => `$${nextParamIdx + idx}`)
          .join(', ');
        conditions.push(
          isMultiValue
            ? `b.user_id IN (${placeholders})`
            : `b.user_id = $${nextParamIdx}`,
        );
        queryParams.push(...valueArray);
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

    let commissionSelect = '';
    if (role === 'MERCHANT') {
      commissionSelect = `
        p.payin_merchant_commission,
        p.merchant_id,
        p.user,
        p.merchant_order_id,
        p.config AS payin_details,
        json_build_object(
          'merchant_code', r.code,
          'dispute', r.dispute_enabled,
          'return_url', r.config->>'return_url',
          'notify_url', r.config->>'notify_url'
        ) AS merchant_details
      `;
    } else if (role === 'VENDOR') {
      commissionSelect = `
        p.payin_vendor_commission,
        v.code AS vendor_code
      `;
    } else {
      commissionSelect = `
        p.payin_merchant_commission,
        json_build_object(
          'merchant_code', COALESCE(r.config->>'sub_code', r.code),
          'dispute', r.dispute_enabled,
          'return_url', r.config->>'return_url',
          'notify_url', r.config->>'notify_url'
        ) AS merchant_details,
        p.payin_vendor_commission,
        p.config AS payin_details,
        p.merchant_order_id,
        p.user,
        u.user_name AS created_by,  
        uu.user_name AS updated_by,
        p.merchant_id,
        v.code AS vendor_code,
        v.user_id AS vendor_user_id,
        p.upi_short_code,
        p.is_url_expires,
        p.approved_at,
        p.created_by,
        p.updated_by,
        p.created_at,
        p.updated_at,
        CASE 
          WHEN p.config::jsonb ? 'history' 
          THEN (
            SELECT json_agg(
              json_build_object(
                'updated_by', upd_user.user_name,
                'updated_at', h->>'updated_at',
                'bank_acc_id', h->>'bank_acc_id',
                'nick_name', h->>'nick_name',
                'user', p.user,
                'amount', h->>'amount',
                'status', p.status,
                'merchant_order_id', p.merchant_order_id,
                'bank_res_details', json_build_object(
                  'utr', h->>'utr',
                  'amount', h->>'amount'
                ),
                'merchant_details', json_build_object(
                  'merchant_code', COALESCE(r.config->>'sub_code', r.code)
                ),
                'payin_vendor_commission', h->>'payin_vendor_commission',
                'payin_merchant_commission', h->>'payin_merchant_commission'
              ) ORDER BY (h->>'updated_at')::timestamp DESC
            )
            FROM jsonb_array_elements(p.config::jsonb->'history') AS h
            LEFT JOIN public."User" upd_user ON upd_user.id = (h->>'updated_by')::text
          )
          ELSE NULL
        END AS history
      `;
    }

    const baseQuery = `
      WITH filtered_payins AS (
        SELECT DISTINCT ON (p.id)
          p.id,
          p.sno,
          p.amount,
          p.status,
          p.is_notified,
          p.user_submitted_utr,
          p.user_submitted_image,
          p.duration,
          b.nick_name,      
          ${commissionSelect},
          json_build_object(
            'utr', br.utr,
            'amount', br.amount
          ) AS bank_res_details,
          CASE 
          WHEN p.config::jsonb ? 'history' 
          THEN (
            SELECT json_agg(
              json_build_object(
                'updated_by', upd_user.user_name,
                'updated_at', h->>'updated_at',
                'bank_acc_id', h->>'bank_acc_id',
                'nick_name', h->>'nick_name',
                'user', p.user,
                'amount', h->>'amount',
                'status', p.status,
                'merchant_order_id', p.merchant_order_id,
                'bank_res_details', json_build_object(
                  'utr', h->>'utr',
                  'amount', h->>'amount'
                ),
                'merchant_details', json_build_object(
                  'merchant_code', COALESCE(r.config->>'sub_code', r.code)
                ),
                'payin_vendor_commission', h->>'payin_vendor_commission',
                'payin_merchant_commission', h->>'payin_merchant_commission'
              ) ORDER BY (h->>'updated_at')::timestamp DESC
            )
            FROM jsonb_array_elements(p.config::jsonb->'history') AS h
            LEFT JOIN public."User" upd_user ON upd_user.id = (h->>'updated_by')::text
          )
          ELSE NULL
        END AS history,
          p.created_at,
          p.updated_at
        FROM public."${PAYIN}" p
        LEFT JOIN public."Merchant" r ON p.merchant_id = r.id
        LEFT JOIN public."BankAccount" b ON p.bank_acc_id = b.id
        LEFT JOIN public."BankResponse" br ON p.bank_response_id = br.id
        LEFT JOIN public."Vendor" v ON v.user_id = b.user_id
        LEFT JOIN public."User" u ON p.created_by = u.id 
        LEFT JOIN public."User" uu ON p.updated_by = uu.id
        WHERE ${conditions.join(' AND ')}
      )
      SELECT * FROM filtered_payins
      ORDER BY sno DESC
      ${limitcondition.value}
    `;

    const expectedParamCount = (baseQuery.match(/\$\d+/g) || []).length;
    if (expectedParamCount !== queryParams.length) {
      logger.warn(
        `Expected: ${expectedParamCount}, Got: ${queryParams.length}`,
      );
    }
    const result = await executeQuery(baseQuery, queryParams);
    return {
      payins: result.rows,
    };
  } catch (error) {
    logger.error('Error getting PayIn URL:', error);
    throw error;
  }
};

export const getAllPayInsDao = async (
  filters,
  company_id,
  page,
  limit,
  role,
) => {
  try {
    const { PAYIN } = tableName;

    if (typeof company_id === 'string') {
      company_id = company_id.trim();
    }

    const conditions = [`p.is_obsolete = false`, `p.company_id = $1`];
    const queryParams = [company_id];
    const limitcondition = { value: '' };

    const handledKeys = new Set([
      'search',
      'startDate',
      'endDate',
      'status',
      'sortBy',
      'sortOrder',
      'nick_name',
    ]);

    const conditionBuilders = {
      search: (filters, PAYIN) => {
        if (!filters.search || typeof filters.search !== 'string') return;
        try {
          filters.or = buildSearchFilterObj(filters.search, PAYIN);
          delete filters.search;
        } catch (error) {
          logger.warn(`Invalid search filter: ${filters.search}`, error);
          delete filters.search;
        }
      },
      dateRange: (filters, conditions, queryParams) => {
        if (!filters.startDate || !filters.endDate) return;
        const nextParamIdx = queryParams.length + 1;
        conditions.push(
          `p.created_at BETWEEN $${nextParamIdx} AND $${nextParamIdx + 1}`,
        );
        queryParams.push(filters.startDate, filters.endDate);
      },
      bankName: (filters, conditions, queryParams) => {
        if (!filters.nick_name) return;
        const nextParamIdx = queryParams.length + 1;
        conditions.push(`LOWER(b.nick_name) LIKE LOWER($${nextParamIdx})`);
        queryParams.push(filters.nick_name);
      },
      status: (filters, conditions, queryParams) => {
        if (!filters.status) return;
        const statusArray = filters.status.split(',').map((s) => s.trim());
        const nextParamIdx = queryParams.length + 1;
        const placeholders = statusArray
          .map((_, idx) => `$${nextParamIdx + idx}`)
          .join(', ');
        conditions.push(
          statusArray.length > 1
            ? `p.status IN (${placeholders})`
            : `p.status = $${nextParamIdx}`,
        );
        queryParams.push(...statusArray);
      },
      updated: (filters, conditions) => {
        if (!filters.updatedPayin) return;
        conditions.push(
          `(p.config->>'history' IS NOT NULL AND p.config::jsonb ? 'history')`,
        );
        delete filters.updatedPayin;
      },
      pagination: (page, limit, queryParams, limitconditionRef) => {
        if (!page || !limit) return;
        const nextParamIdx = queryParams.length + 1;
        limitconditionRef.value = `LIMIT $${nextParamIdx} OFFSET $${nextParamIdx + 1}`;
        queryParams.push(limit, (page - 1) * limit);
      },
    };

    conditionBuilders.search(filters, PAYIN);
    conditionBuilders.dateRange(filters, conditions, queryParams);
    conditionBuilders.bankName(filters, conditions, queryParams);
    conditionBuilders.status(filters, conditions, queryParams);
    conditionBuilders.updated(filters, conditions);
    conditionBuilders.pagination(page, limit, queryParams, limitcondition);

    Object.entries(filters).forEach(([key, value]) => {
      if (handledKeys.has(key) || value == null) return;
      const nextParamIdx = queryParams.length + 1;

      if (Array.isArray(value)) {
        const placeholders = value
          .map((_, idx) => `$${nextParamIdx + idx}`)
          .join(', ');
        conditions.push(`p.${key} IN (${placeholders})`);
        queryParams.push(...value);
      } else if (key === 'user_ids') {
        const isMultiValue = typeof value === 'string' && value.includes(',');
        const valueArray = isMultiValue
          ? value.split(',').map((v) => v.trim())
          : [value];
        const placeholders = valueArray
          .map((_, idx) => `$${nextParamIdx + idx}`)
          .join(', ');
        conditions.push(
          isMultiValue
            ? `b.user_id IN (${placeholders})`
            : `b.user_id = $${nextParamIdx}`,
        );
        queryParams.push(...valueArray);
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

    let commissionSelect = '';
    if (role === 'MERCHANT') {
      commissionSelect = `
        p.is_notified,
        p.payin_merchant_commission,
        p.merchant_id,
        p.user,
        p.merchant_order_id,
        p.config AS payin_details,
        json_build_object(
          'merchant_code', r.code,
          'dispute', r.dispute_enabled,
          'return_url', r.config->>'return_url',
          'notify_url', r.config->>'notify_url'
        ) AS merchant_details
      `;
    } else if (role === 'VENDOR') {
      commissionSelect = `
        p.payin_vendor_commission,
        v.code AS vendor_code
      `;
    } else {
      commissionSelect = `
        p.is_notified,
        p.payin_merchant_commission,
        json_build_object(
          'merchant_code', COALESCE(r.config->>'sub_code', r.code),
          'dispute', r.dispute_enabled,
          'return_url', r.config->>'return_url',
          'notify_url', r.config->>'notify_url'
        ) AS merchant_details,
        p.payin_vendor_commission,
        p.config AS payin_details,
        p.merchant_order_id,
        p.user,
        u.user_name AS created_by,  
        uu.user_name AS updated_by,
        p.merchant_id,
        v.code AS vendor_code,
        v.user_id AS vendor_user_id,
        p.upi_short_code,
        p.is_url_expires,
        p.approved_at,
        p.created_by,
        p.updated_by,
        p.created_at,
        p.updated_at
      `;
    }

    const baseQuery = `
      WITH filtered_payins AS (
        SELECT DISTINCT ON (p.id)
          p.id,
          p.sno,
          p.amount,
          p.status,
          p.user_submitted_utr,
          p.user_submitted_image,
          p.duration,
          b.nick_name,      
          ${commissionSelect},
          json_build_object(
            'utr', br.utr,
            'amount', br.amount
          ) AS bank_res_details,
          CASE 
          WHEN p.config::jsonb ? 'history' 
          THEN (
            SELECT json_agg(
              json_build_object(
                'updated_by', upd_user.user_name,
                'updated_at', h->>'updated_at',
                'bank_acc_id', h->>'bank_acc_id',
                'nick_name', h->>'nick_name',
                'user', p.user,
                'amount', h->>'amount',
                'status', p.status,
                'merchant_order_id', p.merchant_order_id,
                'bank_res_details', json_build_object(
                  'utr', h->>'utr',
                  'amount', h->>'amount'
                ),
                'merchant_details', json_build_object(
                  'merchant_code', COALESCE(r.config->>'sub_code', r.code)
                ),
                'payin_vendor_commission', h->>'payin_vendor_commission',
                'payin_merchant_commission', h->>'payin_merchant_commission'
              ) ORDER BY (h->>'updated_at')::timestamp DESC
            )
            FROM jsonb_array_elements(p.config::jsonb->'history') AS h
            LEFT JOIN public."User" upd_user ON upd_user.id = (h->>'updated_by')::text
          )
          ELSE NULL
        END AS history,
          p.created_at,
          p.updated_at
        FROM public."${PAYIN}" p
        LEFT JOIN public."Merchant" r ON p.merchant_id = r.id
        LEFT JOIN public."BankAccount" b ON p.bank_acc_id = b.id
        LEFT JOIN public."BankResponse" br ON p.bank_response_id = br.id
        LEFT JOIN public."Vendor" v ON v.user_id = b.user_id
        LEFT JOIN public."User" u ON p.created_by = u.id 
        LEFT JOIN public."User" uu ON p.updated_by = uu.id
        WHERE ${conditions.join(' AND ')}
      )
      SELECT * FROM filtered_payins
      ORDER BY sno DESC
      ${limitcondition.value}
    `;

    const expectedParamCount = (baseQuery.match(/\$\d+/g) || []).length;
    if (expectedParamCount !== queryParams.length) {
      logger.warn(
        `Expected: ${expectedParamCount}, Got: ${queryParams.length}`,
      );
    }
    const result = await executeQuery(baseQuery, queryParams);
    return {
      payins: result.rows,
    };
  } catch (error) {
    logger.error('Error getting PayIn URL:', error);
    throw error;
  }
};

export const getPayinsBySearchDao = async (
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
    // Valid columns in the Payin table
    const validColumns = new Set([
      'id',
      'sno',
      'upi_short_code',
      'amount',
      'status',
      'merchant_order_id',
      'is_notified',
      'user_submitted_utr',
      'user',
      'user_submitted_image',
      'duration',
      'config',
      'payin_merchant_commission',
      'payin_vendor_commission',
      'approved_at',
      'created_by',
      'updated_by',
      'created_at',
      'updated_at',
      'is_obsolete',
      'company_id',
      'merchant_id',
      'bank_acc_id',
      'bank_response_id',
    ]);

    // Define commissionSelect without leading commas
    let commissionSelect = '';
    if (role === 'MERCHANT') {
      commissionSelect = `
        p.payin_merchant_commission,
        p.merchant_order_id,
        p.user,
        p.is_notified,
        p.config AS payin_details,
        json_build_object(
          'merchant_code', m.code,
          'dispute', m.dispute_enabled,
          'return_url', m.config->>'return_url',
          'notify_url', m.config->>'notify_url'
        ) AS merchant_details`;
    } else if (role === 'VENDOR') {
      commissionSelect = `
        p.payin_vendor_commission,
        v.code AS vendor_code`;
    } else {
      commissionSelect = `
        p.payin_merchant_commission,
        json_build_object(
          'merchant_code', COALESCE(m.config->>'sub_code', m.code),
          'dispute', m.dispute_enabled,
          'return_url', m.config->>'return_url',
          'notify_url', m.config->>'notify_url'
        ) AS merchant_details,
        p.merchant_order_id,
        p.config AS payin_details,
        p.payin_vendor_commission,
        v.code AS vendor_code,
        v.user_id AS vendor_user_id,
        p.upi_short_code,
        p.is_url_expires,
        p.approved_at,
        p.created_by,
        p.is_notified,
        p.user,
        p.updated_by,
        p.created_at,
        p.updated_at`;
    }

    let queryText = `
      SELECT
        p.id,
        p.sno,
        p.amount,
        p.status,
        p.user_submitted_utr,
        p.user_submitted_image,
        p.duration,
        b.nick_name
        ${commissionSelect ? `,${commissionSelect}` : ''},
        json_build_object(
          'utr', br.utr,
          'amount', br.amount
        ) AS bank_res_details,
        p.created_at,
        p.updated_at,
        CASE 
          WHEN p.config::jsonb ? 'history' 
          THEN (
            SELECT json_agg(
              json_build_object(
                'updated_by', upd_user.user_name,
                'updated_at', h->>'updated_at',
                'amount', h->>'amount',
                'bank_acc_id', h->>'bank_acc_id',
                'user', p.user,
                'nick_name', h->>'nick_name',
                'status', p.status,
                'merchant_order_id', p.merchant_order_id,
                'bank_res_details', json_build_object(
                  'utr', h->>'utr',
                  'amount', h->>'amount'
                ),
                'merchant_details', json_build_object(
                  'merchant_code', COALESCE(m.config->>'sub_code', m.code)
                ),
                'payin_vendor_commission', h->>'payin_vendor_commission',
                'payin_merchant_commission', h->>'payin_merchant_commission'
              ) ORDER BY (h->>'updated_at')::timestamp DESC
            )
            FROM jsonb_array_elements(p.config::jsonb->'history') AS h
            LEFT JOIN public."User" upd_user ON upd_user.id = (h->>'updated_by')::text
          )
          ELSE NULL
        END AS history
      FROM public."Payin" p
      LEFT JOIN public."Merchant" m ON p.merchant_id = m.id
      LEFT JOIN public."BankAccount" b ON p.bank_acc_id = b.id
      LEFT JOIN public."BankResponse" br ON p.bank_response_id = br.id
      LEFT JOIN public."Vendor" v ON v.user_id = b.user_id
      LEFT JOIN public."User" u ON p.created_by = u.id 
      LEFT JOIN public."User" uu ON p.updated_by = uu.id
      WHERE ${conditions.join(' AND ')}
    `;
    if (searchTerms && searchTerms.length > 0) {
      // Handle search terms
      searchTerms.forEach((term) => {
        if (term.toLowerCase() === 'true' || term.toLowerCase() === 'false') {
          const boolValue = term.toLowerCase() === 'true';
          conditions.push(`
            (
              p.is_notified = $${paramIndex}
              OR p.is_url_expires = $${paramIndex}
              OR p.one_time_used = $${paramIndex}
            )
          `);
          queryParams.push(boolValue);
          paramIndex++;
        } else {
          conditions.push(`
            (
              LOWER(p.id::text) LIKE LOWER($${paramIndex})
              OR LOWER(p.sno::text) LIKE LOWER($${paramIndex})
              OR LOWER(p.upi_short_code) LIKE LOWER($${paramIndex})
              OR LOWER(p.status) LIKE LOWER($${paramIndex})
              OR LOWER(p.merchant_order_id) LIKE LOWER($${paramIndex})
              OR LOWER(p.user_submitted_utr) LIKE LOWER($${paramIndex})
              OR LOWER(p.user) LIKE LOWER($${paramIndex})
              OR LOWER(b.nick_name) LIKE LOWER($${paramIndex})
              OR LOWER(br.utr) LIKE LOWER($${paramIndex})
              OR LOWER(m.code) LIKE LOWER($${paramIndex})
              OR LOWER(v.code) LIKE LOWER($${paramIndex})
              OR p.amount::text LIKE $${paramIndex}
              OR br.amount::text LIKE $${paramIndex}
              OR LOWER(p.config->>'user') LIKE LOWER($${paramIndex})
              OR LOWER(p.config->'urls'->>'site') LIKE LOWER($${paramIndex})
              OR LOWER(p.config->'urls'->>'notify') LIKE LOWER($${paramIndex})
            )
          `);
          queryParams.push(`%${term}%`);
          paramIndex++;
        }
      });
    }
    // Handle status filter
    if (filters.status) {
      const statusArray = filters.status.split(',').map((s) => s.trim());
      queryText += ` AND p.status IN (${statusArray.map((_, i) => `$${paramIndex + i}`).join(', ')})`;
      queryParams.push(...statusArray);
      paramIndex += statusArray.length;
    }
    if (filters.user_ids) {
      const statusArray = filters.user_ids.split(',').map((s) => s.trim());
      queryText += ` AND v.user_id IN (${statusArray.map((_, i) => `$${paramIndex + i}`).join(', ')})`;
      queryParams.push(...statusArray);
      paramIndex += statusArray.length;
    }
   
  if (filters.updated_at) {
    const [day, month, year] = filters.updated_at.split('-');
    if (!day || !month || !year || isNaN(new Date(`${year}-${month}-${day}`))) {
      logger.error(`Invalid date format for updated_at: ${filters.updated_at}`);
      throw new Error(
        'Invalid date format for updated_at. Expected DD-MM-YYYY',
      );
    }
    const properDateStr = `${year}-${month}-${day}`;
    let startDate = dayjs
      .tz(`${properDateStr} 00:00:00`, 'Asia/Kolkata')
      .utc()
      .format();
    let endDate = dayjs
      .tz(`${properDateStr} 23:59:59.999`, 'Asia/Kolkata')
      .utc()
      .format();
    conditions.push(
      `p.updated_at BETWEEN $${paramIndex} AND $${paramIndex + 1}`,
    );
    queryParams.push(startDate, endDate);
    paramIndex += 2;
   delete filters.updated_at;
  }
    // Handle additional filters dynamically
    Object.entries(filters).forEach(([key, value]) => {
      if (handledKeys.has(key) || value == null || !validColumns.has(key)) {
        return;
      }
      const nextParamIdx = queryParams.length + 1;
      // Special handling for arrays
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
      // Beyond the initial is_obsolete and company_id
      queryText += ' AND (' + conditions.slice(2).join(' AND ') + ')';
    }

    // Count query
    const countQuery = `SELECT COUNT(*) AS total FROM (${queryText}) AS count_table`;
    // Append pagination
    queryText += `
      ORDER BY p.created_at DESC
      LIMIT $${queryParams.length + 1}
      OFFSET $${queryParams.length + 2}
    `;

    queryParams.push(limitNum, offset);

    // Debug log: Check if placeholders match params
    // const expectedParamCount = (queryText.match(/\$\d+/g) || []).length;
    // if (expectedParamCount !== queryParams.length) {
    //   logger.warn(
    //     `Expected: ${expectedParamCount}, Got: ${queryParams.length}`,
    //   );
    // }

    // Execute queries
    const countResult = await executeQuery(
      countQuery,
      queryParams.slice(0, -2),
    );
    let searchResult = await executeQuery(queryText, queryParams);
    const totalItems = parseInt(countResult.rows[0].total);
    let totalPages = Math.ceil(totalItems / limitNum);
    if (totalItems > 0 && searchResult.rows.length === 0 && offset > 0) {
      queryParams[queryParams.length - 1] = 0; 
      searchResult = await executeQuery(queryText, queryParams);
      totalPages = Math.ceil(totalItems / limitNum); 
    }
    return {
      totalCount: totalItems,
      totalPages,
      payins: searchResult.rows,
    };
  } catch (error) {
    logger.error('Error in getPayinSearch:', error);
    throw error;
  }
};

export const getPayInUrlsDao = async (filters = {}) => {
  try {
    const [sql, params] = buildSelectQuery(
      `SELECT * FROM "${tableName.PAYIN}" WHERE 1=1`,
      filters,
      // , page, limit
    );
    const result = await executeQuery(sql, params);
    return result.rows;
  } catch (error) {
    logger.error('Error getting PayIn URLs:', error);
    throw error;
  }
};

export const updatePayInUrlDao = async (id, data, conn) => {
  try {
    const [sql, params] = buildUpdateQuery(tableName.PAYIN, data, { id });
    if (conn && conn.query) {
      const result = await conn.query(sql, params);
      // await newTableEntry(tableName.PAYIN);
      return result.rows[0];
    }
    const result = await executeQuery(sql, params);
    // await newTableEntry(tableName.PAYIN);
    return result.rows[0];
  } catch (error) {
    logger.error('Error updating PayIn URL:', error);
    throw error;
  }
};

export const getPayinDetailsByMerchantOrderId = async (merchantOrderId) => {
  if (!merchantOrderId || typeof merchantOrderId !== 'string') {
    throw new BadRequestError('Valid merchantOrderId is required');
  }

  let conn;
  const baseQuery = `
    SELECT 
      p.id AS payin_id,
      p.bank_acc_id,
      p.merchant_id,
      ba.user_id AS vendor_user_id,
      m.user_id AS merchant_user_id,
      p.created_at,
      p.status,
      p.user_submitted_utr,
      p.bank_response_id
    FROM public."Payin" p
    LEFT JOIN public."BankAccount" ba ON p.bank_acc_id = ba.id
    JOIN public."Merchant" m ON p.merchant_id = m.id
    WHERE p.merchant_order_id = $1
    AND p.is_obsolete = false
    LIMIT 1;
  `;

  try {
    conn = await getConnection();
    const result = await conn.query(baseQuery, [merchantOrderId]);

    return result.rows;
  } catch (error) {
    const errorMessage = `Error fetching payin details for merchantOrderId ${merchantOrderId}: ${error.message}`;
    logger.error(errorMessage);
    throw error;
  } finally {
    if (conn) {
      try {
        conn.release();
      } catch (releaseError) {
        logger.error('Error releasing connection:', releaseError);
      }
    }
  }
};
