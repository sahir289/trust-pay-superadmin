import {
  buildInsertQuery,
  buildUpdateQuery,
  executeQuery,
} from '../../utils/db.js';
import { Status, tableName } from '../../constants/index.js';
import { logger } from '../../utils/logger.js';
// import { buildSearchFilterObj } from '../../utils/searchBuilder.js';
import dayjs from 'dayjs';

const IST = 'Asia/Kolkata';

const getSettlementDao = async (
  filters,
  page,
  pageSize,
  sortBy,
  sortOrder,
  columns = [],
) => {
  try {
    const { SETTLEMENT, USER, ROLE, BENEFICIARY_ACCOUNTS, MERCHANT, VENDOR } =
      tableName;
    const conditions = [`s.is_obsolete = false`];
    const queryParams = [];
    const limitcondition = { value: '' };
    //fields added for getting data on codes and dates
    const handledKeys = new Set([
      'search',
      'sortBy',
      'sortOrder',
      'role',
      'vendor_codes',
      'merchant_codes',
      'start_date',
      'end_date',
      'user_id',
    ]);
    const isUUID = (value) => {
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      return typeof value === 'string' && uuidRegex.test(value);
    };

    const conditionBuilders = {
      user_id: (filters, conditions, queryParams) => {
        if (!filters.user_id) return;
        const nextParamIdx = queryParams.length + 1;
        if (typeof filters.user_id === 'string') {
          const userIds = filters.user_id
            .split(',')
            .map((id) => id.trim())
            .filter((id) => id);
          if (userIds.length > 0) {
            const placeholders = userIds
              .map((_, idx) => `$${nextParamIdx + idx}`)
              .join(', ');
            conditions.push(`s.user_id IN (${placeholders})`);
            queryParams.push(...userIds);
          }
        } else if (Array.isArray(filters.user_id)) {
          const placeholders = filters.user_id
            .map((_, idx) => `$${nextParamIdx + idx}`)
            .join(', ');
          conditions.push(`s.user_id IN (${placeholders})`);
          queryParams.push(...filters.user_id);
        } else {
          conditions.push(`s.user_id = $${nextParamIdx}`);
          queryParams.push(filters.user_id);
        }
        delete filters.user_id;
      },
      role: (filters, conditions, queryParams) => {
        if (!filters.role) return;
        const nextParamIdx = queryParams.length + 1;
        conditions.push(`r.role = $${nextParamIdx}`);
        queryParams.push(filters.role);
        delete filters.role;
      },
      //--merchant_codes and vendor codes and dates filetring
      vendor_codes: (filters, conditions, queryParams) => {
        if (!filters.vendor_codes) return;
        const nextParamIdx = queryParams.length + 1;
        const isMultiValue =
          typeof filters.vendor_codes === 'string' &&
          filters.vendor_codes.includes(',');
        const valueArray = isMultiValue
          ? filters.vendor_codes.split(',').map((v) => v.trim())
          : [filters.vendor_codes];
        const placeholders = valueArray
          .map((_, idx) => `$${nextParamIdx + idx}`)
          .join(', ');
        const column = valueArray.every(isUUID) ? 'u.id' : 'u.code';
        conditions.push(`${column} IN (${placeholders})`);
        queryParams.push(...valueArray);
        delete filters.vendor_codes;
      },
      merchant_codes: (filters, conditions, queryParams) => {
        if (!filters.merchant_codes) return;
        const nextParamIdx = queryParams.length + 1;
        const isMultiValue =
          typeof filters.merchant_codes === 'string' &&
          filters.merchant_codes.includes(',');
        const valueArray = isMultiValue
          ? filters.merchant_codes.split(',').map((v) => v.trim())
          : [filters.merchant_codes];
        const placeholders = valueArray
          .map((_, idx) => `$${nextParamIdx + idx}`)
          .join(', ');
        const column = valueArray.every(isUUID) ? 'u.id' : 'u.code';
        conditions.push(`${column} IN (${placeholders})`);
        queryParams.push(...valueArray);
        delete filters.merchant_codes;
      },
      date_range: (filters, conditions, queryParams) => {
        const { start_date, end_date } = filters;
        if (start_date && end_date) {
          let start;
          let end;
          start = dayjs.tz(`${start_date} 00:00:00`, IST).utc().format(); // UTC ISO string
          end = dayjs.tz(`${end_date} 23:59:59.999`, IST).utc().format();
          const nextParamIdx = queryParams.length + 1;
          if (filters.status === Status.SUCCESS) {
            conditions.push(
              `s.approved_at BETWEEN $${nextParamIdx} AND $${nextParamIdx + 1}`,
            );
          }
          else if (filters.status === Status.REJECTED) {
            conditions.push(
              `s.rejected_at BETWEEN $${nextParamIdx} AND $${nextParamIdx + 1} AND s.approved_at IS NULL`,
            );
          }
          else if (filters.status === Status.REVERSED) {
            conditions.push(
              `(s.rejected_at BETWEEN $${nextParamIdx} AND $${nextParamIdx + 1} AND s.approved_at IS NOT NULL)`,
            );
          }
          else {
            conditions.push(
              `s.updated_at BETWEEN $${nextParamIdx} AND $${nextParamIdx + 1}`,
            ); 
          }
          queryParams.push(start, end);
          delete filters.start_date;
          delete filters.end_date;
        }
      },
      pagination: (page, pageSize, queryParams, limitconditionRef) => {
        if (!page || !pageSize) return;
        const nextParamIdx = queryParams.length + 1;
        limitconditionRef.value = `LIMIT $${nextParamIdx} OFFSET $${nextParamIdx + 1}`;
        queryParams.push(pageSize, (page - 1) * pageSize);
      },
    };

    // conditionBuilders.search(filters, SETTLEMENT);
    conditionBuilders.role(filters, conditions, queryParams);
    conditionBuilders.user_id(filters, conditions, queryParams);
    conditionBuilders.vendor_codes(filters, conditions, queryParams);
    conditionBuilders.merchant_codes(filters, conditions, queryParams);
    conditionBuilders.date_range(filters, conditions, queryParams);
    conditionBuilders.pagination(page, pageSize, queryParams, limitcondition);

    Object.entries(filters).forEach(([key, value]) => {
      if (handledKeys.has(key) || value == null) return;
      const nextParamIdx = queryParams.length + 1;

      if (Array.isArray(value)) {
        const placeholders = value
          .map((_, idx) => `$${nextParamIdx + idx}`)
          .join(', ');
        conditions.push(`s.${key} IN (${placeholders})`);
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
            ? `s.${key} IN (${placeholders})`
            : `s.${key} = $${nextParamIdx}`,
        );
        queryParams.push(...valueArray);
      }
    });
    const columnSelection =
      columns.length > 0 ? columns.map((col) => `s.${col}`).join(', ') : `s.*`;
    //fetching bank name
    const baseQuery = `
    SELECT DISTINCT ON (s.sno)
      ${columnSelection},
      CASE
        WHEN r.role = 'MERCHANT' THEN 
          COALESCE(m.config->>'sub_code', m.code)
        WHEN r.role = 'VENDOR' THEN 
          v.code
        WHEN r.role = 'ADMIN' THEN 
          COALESCE(m.config->>'sub_code', m.code)
        ELSE NULL
      END AS code,
      CASE
        WHEN s.config->>'bank_id' IS NOT NULL THEN
          (
            SELECT jsonb_build_object(
              'beneficiary_bank_name', COALESCE(ba.bank_name, s.config->>'bank_name', ''),
              'acc_holder_name', COALESCE(ba.acc_holder_name, ''),
              'acc_no', COALESCE(ba.acc_no, ''),
              'ifsc', COALESCE(ba.ifsc, '')
              ${
                Object.keys(filters).length > 0
                  ? ', ' +
                    Object.keys(filters)
                      .filter(
                        (key) =>
                          ![
                            'beneficiary_bank_name',
                            'acc_holder_name',
                            'acc_no',
                            'ifsc',
                          ].includes(key),
                      )
                      .map(
                        (key) => `'${key}', COALESCE(s.config->>'${key}', '')`,
                      )
                      .join(', ')
                  : ''
              }
            ) || (
              SELECT jsonb_object_agg(key, value)
              FROM jsonb_each(s.config::jsonb)
              WHERE key NOT IN ('beneficiary_bank_name', 'acc_holder_name', 'acc_no', 'ifsc'${
                Object.keys(filters).length > 0
                  ? ', ' +
                    Object.keys(filters)
                      .map((key) => `'${key}'`)
                      .join(', ')
                  : ''
              })
            )
          )
        ELSE
          s.config::jsonb
      END AS config,
      COALESCE(uc.user_name, s.created_by::text) AS created_by,
      COALESCE(uu.user_name, s.updated_by::text) AS updated_by
    FROM public."${SETTLEMENT}" s
    JOIN public."${USER}" u ON s.user_id = u.id
    LEFT JOIN public."${ROLE}" r ON u.role_id = r.id
    LEFT JOIN public."${BENEFICIARY_ACCOUNTS}" ba ON s.config->>'bank_id' = ba.id
    LEFT JOIN public."${MERCHANT}" m ON u.id = m.user_id AND r.role IN ('MERCHANT', 'ADMIN')
    LEFT JOIN public."${VENDOR}" v ON u.id = v.user_id AND r.role = 'VENDOR'
    LEFT JOIN public."${USER}" uc ON s.created_by = uc.id
    LEFT JOIN public."${USER}" uu ON s.updated_by = uu.id
    WHERE ${conditions.join(' AND ')}
    `;
    const sortClause =
      sortBy && sortOrder
        ? `ORDER BY s.${sortBy} ${sortOrder.toUpperCase()}`
        : 'ORDER BY s.sno DESC';

    const finalQuery = `
      ${baseQuery}
      ${sortClause}
      ${limitcondition.value}
    `;

    const result = await executeQuery(finalQuery, queryParams);
    return result.rows;
  } catch (error) {
    logger.error('Error in getSettlementDao:', error);
    throw error;
  }
};




const getSettlementsBySearchDao = async (
  filters = {},
  page = 1,
  pageSize = 10,
  sortBy = 'sno',
  sortOrder = 'DESC',
  columns = [],
  searchTerms = [],
) => {
  try {
    const conditions = ['s.is_obsolete = false'];
    const queryParams = [];
    let paramIndex = 1;

    // Add dynamic code and user_name fields
    const columnSelection =
      columns.length > 0
        ? columns.map((col) => `s.${col}`).join(', ')
        : `
          s.*,
          u.user_name,
          r.role,
          ba.bank_name,
          ba.acc_holder_name,
          ba.acc_no,
          ba.ifsc,
          m.code AS merchant_code,
          v.code AS vendor_code,
          CASE
            WHEN r.role = 'MERCHANT' THEN COALESCE(m.config->>'sub_code', m.code)
            WHEN r.role = 'VENDOR' THEN v.code
            WHEN r.role = 'ADMIN' THEN COALESCE(m.config->>'sub_code', m.code)
            ELSE NULL
          END AS code,
          COALESCE(uc.user_name, s.created_by::text) AS created_by,
          COALESCE(uu.user_name, s.updated_by::text) AS updated_by
        `;

    // Full-text search conditions
    if (searchTerms.length > 0) {
      const searchConditions = [];

      searchTerms.forEach((term) => {
        if (term.toLowerCase() === 'true' || term.toLowerCase() === 'false') {
          const boolValue = term.toLowerCase() === 'true';
          searchConditions.push(
            `(s.is_notified = $${paramIndex} OR s.is_approved = $${paramIndex} OR s.is_rejected = $${paramIndex})`,
          );
          queryParams.push(boolValue);
          paramIndex++;
        } else {
          searchConditions.push(
            `(
              LOWER(s.id::text) LIKE LOWER($${paramIndex}) OR
              LOWER(s.sno::text) LIKE LOWER($${paramIndex}) OR
              LOWER(s.status) LIKE LOWER($${paramIndex}) OR
              LOWER(s.method) LIKE LOWER($${paramIndex}) OR
              LOWER(u.user_name) LIKE LOWER($${paramIndex}) OR
              LOWER(r.role) LIKE LOWER($${paramIndex}) OR
              LOWER(m.code) LIKE LOWER($${paramIndex}) OR
              LOWER(v.code) LIKE LOWER($${paramIndex}) OR
              LOWER(ba.bank_name) LIKE LOWER($${paramIndex}) OR
              LOWER(ba.acc_holder_name) LIKE LOWER($${paramIndex}) OR
              LOWER(ba.acc_no) LIKE LOWER($${paramIndex}) OR
              LOWER(ba.ifsc) LIKE LOWER($${paramIndex}) OR
              s.amount::text LIKE $${paramIndex} OR
              LOWER(s.config->>'amount') LIKE LOWER($${paramIndex}) OR
              LOWER(s.config->>'reference_id') LIKE LOWER($${paramIndex}) OR
              LOWER(s.config->>'debit_credit') LIKE LOWER($${paramIndex}) OR
              LOWER(s.config->>'ifsc') LIKE LOWER($${paramIndex}) OR
              LOWER(s.config->>'acc_no') LIKE LOWER($${paramIndex}) OR
              LOWER(s.config->>'acc_holder_name') LIKE LOWER($${paramIndex}) OR
              LOWER(s.config->>'bank_name') LIKE LOWER($${paramIndex}) OR
              LOWER(c.first_name || ' ' || c.last_name) LIKE LOWER($${paramIndex}) OR
              LOWER(s.config->>'bank_namebank_name') LIKE LOWER($${paramIndex}) OR
              LOWER(s.config->>'rejected_reason') LIKE LOWER($${paramIndex}))`,
          );
          queryParams.push(`%${term}%`);
          paramIndex++;
        }
      });

      if (searchConditions.length > 0) {
        conditions.push(`(${searchConditions.join(' OR ')})`);
      }
    }
    // Filter handlers
    const filterHandlers = {
      user_id: (val) => {
        const values = Array.isArray(val)
          ? val
          : val.split(',').map((v) => v.trim());
        const placeholders = values
          .map((_, i) => `$${paramIndex + i}`)
          .join(',');
        conditions.push(`s.user_id IN (${placeholders})`);
        queryParams.push(...values);
        paramIndex += values.length;
      },
      role: (val) => {
        conditions.push(`r.role = $${paramIndex}`);
        queryParams.push(val);
        paramIndex++;
      },
      status: (val) => {
        const values = Array.isArray(val) ? val : [val];
        const placeholders = values
          .map((_, i) => `$${paramIndex + i}`)
          .join(',');
        conditions.push(`s.status IN (${placeholders})`);
        queryParams.push(...values);
        paramIndex += values.length;
      },
      method: (val) => {
        const values = Array.isArray(val) ? val : [val];
        const placeholders = values
          .map((_, i) => `$${paramIndex + i}`)
          .join(',');
        conditions.push(`s.method IN (${placeholders})`);
        queryParams.push(...values);
        paramIndex += values.length;
      },
      start_date: (val, filters) => {
        if (filters.end_date) {
          const start = dayjs.tz(`${val} 00:00:00`, IST).utc().format();
          const end = dayjs
            .tz(`${filters.end_date} 23:59:59.999`, IST)
            .utc()
            .format();
          conditions.push(
            `s.created_at BETWEEN $${paramIndex} AND $${paramIndex + 1}`,
          );
          queryParams.push(start, end);
          paramIndex += 2;
        }
      },
      end_date: () => {}, // Handled by start_date
      merchant_codes: (val) => {
        const values = Array.isArray(val)
          ? val
          : val.split(',').map((v) => v.trim());
        const placeholders = values
          .map((_, i) => `$${paramIndex + i}`)
          .join(',');
        conditions.push(`m.code IN (${placeholders})`);
        queryParams.push(...values);
        paramIndex += values.length;
      },
      vendor_codes: (val) => {
        const values = Array.isArray(val)
          ? val
          : val.split(',').map((v) => v.trim());
        const placeholders = values
          .map((_, i) => `$${paramIndex + i}`)
          .join(',');
        conditions.push(`v.code IN (${placeholders})`);
        queryParams.push(...values);
        paramIndex += values.length;
      },
      amount: (val) => {
        conditions.push(`s.amount = $${paramIndex}`);
        queryParams.push(parseFloat(val));
        paramIndex++;
      },
      is_approved: (val) => {
        conditions.push(`s.is_approved = $${paramIndex}`);
        queryParams.push(val === 'true');
        paramIndex++;
      },
      is_rejected: (val) => {
        conditions.push(`s.is_rejected = $${paramIndex}`);
        queryParams.push(val === 'true');
        paramIndex++;
      },
      is_notified: (val) => {
        conditions.push(`s.is_notified = $${paramIndex}`);
        queryParams.push(val === 'true');
        paramIndex++;
      },
      bank_id: (val) => {
        conditions.push(`s.config->>'bank_id' = $${paramIndex}`);
        queryParams.push(val);
        paramIndex++;
      },
      company_id: (val) => {
        conditions.push(`s.company_id = $${paramIndex}`);
        queryParams.push(val);
        paramIndex++;
      },
      updated_at: (val) => {
        const [day, month, year] = val.split('-');
        const properDateStr = `${year}-${month}-${day}`;
        const start = dayjs.tz(`${properDateStr} 00:00:00`, IST).utc().format();
        const end = dayjs
          .tz(`${properDateStr} 23:59:59.999`, IST)
          .utc()
          .format();
        conditions.push(
          `s.updated_at BETWEEN $${paramIndex} AND $${paramIndex + 1}`,
        );
        queryParams.push(start, end);
        paramIndex += 2;
      },
    };

    // Apply filters
    for (const [key, val] of Object.entries(filters)) {
      if (val !== undefined && val !== null && filterHandlers[key]) {
        filterHandlers[key](val, filters);
      }
    }

    // Base query
    const baseQuery = `
      SELECT ${columnSelection} ,
       CASE
      WHEN r.role = 'MERCHANT' THEN COALESCE(m.config->>'sub_code', m.code)
      WHEN r.role = 'VENDOR' THEN v.code
      WHEN r.role = 'ADMIN' THEN COALESCE(m.config->>'sub_code', m.code)
      ELSE NULL
      END AS code,
      c.first_name || ' ' || c.last_name AS company,
      COALESCE(uc.user_name, s.created_by::text) AS created_by,
      COALESCE(uu.user_name, s.updated_by::text) AS updated_by
      FROM "Settlement" s
      JOIN "User" u ON s.user_id = u.id
      LEFT JOIN "Role" r ON u.role_id = r.id
      LEFT JOIN "BeneficiaryAccounts" ba ON s.config->>'bank_id' = ba.id
      LEFT JOIN "Merchant" m ON u.id = m.user_id AND r.role IN ('MERCHANT', 'ADMIN')
      LEFT JOIN "Vendor" v ON u.id = v.user_id AND r.role = 'VENDOR'
      LEFT JOIN public."Company" c
        ON s.company_id = c.id
      LEFT JOIN "User" uc ON s.created_by = uc.id
      LEFT JOIN "User" uu ON s.updated_by = uu.id
      WHERE ${conditions.join(' AND ')}
    `;

    // Count query
    const countQuery = `SELECT COUNT(*) AS total FROM (${baseQuery}) AS count_table`;
    const countResult = await executeQuery(countQuery, queryParams);
    const totalCount = parseInt(countResult.rows[0].total);

    // Sorting & Pagination
    const validSortColumns = [
      'sno',
      'created_at',
      'updated_at',
      'amount',
      'status',
    ];
    const safeSortBy = validSortColumns.includes(sortBy) ? sortBy : 'sno';
    const safeSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const finalQuery = `
      ${baseQuery}
      ORDER BY ${safeSortBy} ${safeSortOrder}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    queryParams.push(pageSize, (page - 1) * pageSize);
    // Final result
    let result = await executeQuery(finalQuery, queryParams);
    if (
      totalCount > 0 &&
      result.rows.length === 0 &&
      (page - 1) * pageSize > 0
    ) {
      queryParams[queryParams.length - 1] = 0; // Reset offset to 0
      result = await executeQuery(finalQuery, queryParams);
    }
    return {
      totalCount,
      totalPages: Math.ceil(totalCount / pageSize),
      settlements: result.rows,
    };
  } catch (error) {
    logger.error('Error in getSettlementsBySearchDao:', error);
    throw error;
  }
};
  



const getSettlementDaoforInternalTransfer = async (utr, method) => {
  try {
    let baseQuery = `SELECT id, user_id, status, amount, method, config, approved_at, rejected_at, created_by, created_at, updated_at, company_id, is_obsolete, updated_by FROM "${tableName.SETTLEMENT}"
 WHERE config->>'reference_id' = $1 AND method = ANY($2)`;

    const queryParams = [utr, method];
    const result = await executeQuery(baseQuery, queryParams);
    return result.rows.length > 0 ? result.rows : result.rows[0];
  } catch (error) {
    logger.error(error);
    throw error;
  }
};

const createSettlementDao = async (payload, conn) => {
  try {
    const [sql, params] = buildInsertQuery(tableName.SETTLEMENT, payload);
    let result;
    if (conn && conn.query) {
      result = await conn.query(sql, params);
    }
    else {
      result = await executeQuery(sql, params);
    }
    return result.rows[0];
  } catch (error) {
    logger.error(error);
    throw error;
  }
};

const updateSettlementDao = async (conn, id, data) => {
  try {
    const [sql, params] = buildUpdateQuery(tableName.SETTLEMENT, data, id);
    let result;
    if (conn && conn.query) {
      result = await conn.query(sql, params); // Use connection to execute query
    } else {
      result = await executeQuery(sql, params); // Use executeQuery if no connection
    }

    return result.rows[0];
  } catch (error) {
    logger.error(error);
    throw error;
  }
};

const deleteSettlementDao = async (conn, id, data) => {
  try {
    const [sql, params] = buildUpdateQuery(tableName.SETTLEMENT, data, id);
    let result;
    if (conn && conn.query) {
      result = await conn.query(sql, params); // Use connection to execute query
    } else {
      result = await executeQuery(sql, params); // Use executeQuery if no connection
    }

    return result.rows[0];
  } catch (error) {
    logger.error(error);
    throw error;
  }
};

export {
  getSettlementDao,
  createSettlementDao,
  getSettlementsBySearchDao,
  getSettlementDaoforInternalTransfer,
  updateSettlementDao,
  deleteSettlementDao,
};
