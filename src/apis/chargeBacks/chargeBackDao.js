import { Role, tableName } from '../../constants/index.js';
import {
  buildInsertQuery,
  buildUpdateQuery,
  buildSelectQuery,
  executeQuery,
} from '../../utils/db.js';
import { logger } from '../../utils/logger.js';
import { buildSearchFilterObj } from '../../utils/searchBuilder.js';
import dayjs from 'dayjs';

// Create ChargeBack entry
export const createChargeBackDao = async (data) => {
  try {
    const [sql, params] = buildInsertQuery(tableName.CHARGE_BACK, data);
    const result = await executeQuery(sql, params);
    return result.rows[0];
  } catch (error) {
    logger.error('Error creating ChargeBack entry:', error);
    throw error;
  }
};

export const getChargebackByIdDao = async (filters) => {
  try {
    const query = `SELECT id, sno, merchant_user_id, vendor_user_id, payin_id, bank_acc_id, amount, reference_date, created_by, updated_by, created_at, updated_at FROM "${tableName.CHARGE_BACK}" WHERE 1=1`;
    const [sql, parameters] = buildSelectQuery(query, filters);
    const result = await executeQuery(sql, parameters);
    return result.rows;
  } catch (error) {
    logger.error(error);
    throw error;
  }
};

// Get ChargeBack entries with pagination, sorting, and filtering
export const getChargeBackDao = async (
  filters,
  page,
  pageSize,
  sortBy,
  sortOrder,
  columns = [],
  role,
) => {
  try {
    const {
      VENDOR,
      COMPANY,
      CHARGE_BACK,
      MERCHANT,
      PAYIN,
      USER,
      BANK_ACCOUNT,
      BANK_RESPONSE,
    } = tableName;
    const conditions = [`cb.is_obsolete = false`];
    const queryParams = [];
    const limitcondition = { value: '' };

    const handledKeys = new Set(['search', 'startDate', 'endDate']);

    const conditionBuilders = {
      search: (filters, CHARGE_BACK) => {
        if (!filters.search || typeof filters.search !== 'string') return;
        try {
          filters.or = buildSearchFilterObj(filters.search, CHARGE_BACK);
          delete filters.search;
        } catch (error) {
          console.warn(`Invalid search filter: ${filters.search}`, error);
          delete filters.search;
        }
      },
      dateRange: (filters, conditions, queryParams) => {
        if (!filters.startDate || !filters.endDate) return;
        const startDate = dayjs
          .tz(`${filters.startDate} 00:00:00`, 'Asia/Kolkata')
          .toISOString();
        const endDate = dayjs
          .tz(`${filters.endDate} 23:59:59.999`, 'Asia/Kolkata')
          .toISOString();
        const idx = queryParams.length + 1;
        conditions.push(`cb.created_at BETWEEN $${idx} AND $${idx + 1}`);
        queryParams.push(startDate, endDate);
      },
      pagination: (page, pageSize, queryParams, limitconditionRef) => {
        if (!page || !pageSize) return;
        const nextParamIdx = queryParams.length + 1;
        limitconditionRef.value = `LIMIT $${nextParamIdx} OFFSET $${nextParamIdx + 1}`;
        queryParams.push(pageSize, (page - 1) * pageSize);
      },
    };

    // Handle bank_name filter properly
    const bankName = filters.bank_name;
    const utr = filters.utr;
    if (bankName) {
      const nextParamIdx = queryParams.length + 1;
      conditions.push(`ba.bank_name = $${nextParamIdx}`);
      queryParams.push(bankName);
    } else if (utr) {
      const nextParamIdx = queryParams.length + 1;
      conditions.push(`p.user_submitted_utr = $${nextParamIdx}`);
      queryParams.push(utr);
    }
    delete filters.bank_name;
    delete filters.utr; // Remove from filters object

    // Handle search filters
    conditionBuilders.search(filters, CHARGE_BACK);
    conditionBuilders.dateRange(filters, conditions, queryParams);
    conditionBuilders.pagination(page, pageSize, queryParams, limitcondition);

    Object.entries(filters).forEach(([key, value]) => {
      if (handledKeys.has(key) || value == null) return;
      const nextParamIdx = queryParams.length + 1;

      // Special handling for arrays (like merchant_user_id)
      if (Array.isArray(value)) {
        const placeholders = value
          .map((_, idx) => `$${nextParamIdx + idx}`)
          .join(', ');
        conditions.push(`cb.${key} IN (${placeholders})`);
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
            ? `cb.${key} IN (${placeholders})`
            : `cb.${key} = $${nextParamIdx}`,
        );
        queryParams.push(...valueArray);
      }
    });

    const tableAlias = 'cb';

    // Filter out unwanted columns
    columns = columns.filter(
      (col) =>
        col !== 'merchant_user_id' &&
        col !== 'payin_id' &&
        col !== 'bank_acc_id',
    );

    // Default columns if none provided
    const defaultColumns = ['id', 'payin_id', 'amount'];
    const baseColumns = columns.length
      ? columns.map((col) => `${tableAlias}.${col}`).join(', ')
      : defaultColumns.map((col) => `${tableAlias}.${col}`).join(', ');

    // Additional columns based on role
    let additionalColumns = '';
    if (role === Role.MERCHANT) {
      additionalColumns = `
        m.code AS merchant_name,
        p.user AS user,
        p.merchant_order_id AS merchant_order_id,
      `;
    } else if (role === Role.VENDOR) {
      additionalColumns += ``;
    } else {
      additionalColumns = `
        m.code AS merchant_name,
        p.merchant_order_id AS merchant_order_id,
        v.code AS vendor_name,
       CASE 
    WHEN m.config->>'sub_code' IS NOT NULL AND m.config->>'sub_code' != '' 
    THEN m.config->>'sub_code' 
    ELSE m.code 
  END AS merchant_name,
        p.user AS user,
        u.user_name AS created_by,
        uu.user_name AS updated_by,
        jsonb_build_object('blocked_users', cm.config->'blocked_users') AS config,
      `;
    }
    //created and updated by with user name
    additionalColumns += `
      ba.nick_name AS bank_name,
      COALESCE(p.user_submitted_utr, br.utr) AS utr,
      cb.created_at
    `;

    // Combine all columns
    const allColumns = [baseColumns];
    if (additionalColumns) allColumns.push(additionalColumns);

    // Ensure sortBy is fully qualified if it's a simple column name
    const validSortColumns = [
      'id',
      'sno',
      'payin_id',
      'amount',
      'created_at',
      'updated_at',
    ];
    const qualifiedSortBy = validSortColumns.includes(sortBy)
      ? `cb.${sortBy}`
      : sortBy;

    const baseQuery = `
      SELECT
        ${allColumns.join(', ')}
      FROM public."${CHARGE_BACK}" cb
      LEFT JOIN public."${VENDOR}" v ON cb.vendor_user_id = v.user_id
      LEFT JOIN public."${COMPANY}" cm ON cb.company_id = cm.id
      LEFT JOIN public."${MERCHANT}" m ON cb.merchant_user_id = m.user_id
      LEFT JOIN public."${PAYIN}" p ON cb.payin_id = p.id
      LEFT JOIN "${BANK_RESPONSE}" br ON p.bank_response_id = br.id
      LEFT JOIN public."${USER}" u ON cb.created_by = u.id 
      LEFT JOIN public."${USER}" uu ON cb.updated_by = uu.id
      LEFT JOIN public."${BANK_ACCOUNT}" ba ON cb.bank_acc_id = ba.id
      WHERE ${conditions.join(' AND ')}
      ${bankName ? `AND ba.nick_name = $${queryParams.length + 1}` : ''}
      ${utr ? `AND p.user_submitted_utr = $${queryParams.length + 1}` : ''}
      ORDER BY ${qualifiedSortBy} ${sortOrder}
      ${limitcondition.value}
    `;
    // Add bank_name to params if it exists
    if (bankName) {
      queryParams.push(bankName);
    }
    // Add utr to params if it exists
    if (utr) {
      queryParams.push(utr);
    }

    const expectedParamCount = (baseQuery.match(/\$\d+/g) || []).length;
    if (expectedParamCount !== queryParams.length) {
      logger.warn(
        `Expected: ${expectedParamCount}, Got: ${queryParams.length}`,
      );
    }

    const result = await executeQuery(baseQuery, queryParams);
    return result.rows;
  } catch (error) {
    logger.error('Error fetching ChargeBack entries:', error);
    throw error;
  }
};

export const getAllChargeBackDao = async (
  filters,
  page,
  pageSize,
  sortBy,
  sortOrder,
  columns = [],
  role,
) => {
  try {
    const {
      VENDOR,
      CHARGE_BACK,
      MERCHANT,
      PAYIN,
      USER,
      BANK_ACCOUNT,
      BANK_RESPONSE,
    } = tableName;
    const conditions = [`cb.is_obsolete = false`];
    const queryParams = [];
    const limitcondition = { value: '' };

    const handledKeys = new Set(['search', 'startDate', 'endDate']);

    const conditionBuilders = {
      search: (filters, CHARGE_BACK) => {
        if (!filters.search || typeof filters.search !== 'string') return;
        try {
          filters.or = buildSearchFilterObj(filters.search, CHARGE_BACK);
          delete filters.search;
        } catch (error) {
          console.warn(`Invalid search filter: ${filters.search}`, error);
          delete filters.search;
        }
      },
      dateRange: (filters, conditions, queryParams) => {
        if (!filters.startDate || !filters.endDate) return;
        const startDate = dayjs
          .tz(`${filters.startDate} 00:00:00`, 'Asia/Kolkata')
          .toISOString();
        const endDate = dayjs
          .tz(`${filters.endDate} 23:59:59.999`, 'Asia/Kolkata')
          .toISOString();
        const idx = queryParams.length + 1;
        conditions.push(`cb.created_at BETWEEN $${idx} AND $${idx + 1}`);
        queryParams.push(startDate, endDate);
      },
      pagination: (page, pageSize, queryParams, limitconditionRef) => {
        if (!page || !pageSize) return;
        const nextParamIdx = queryParams.length + 1;
        limitconditionRef.value = `LIMIT $${nextParamIdx} OFFSET $${nextParamIdx + 1}`;
        queryParams.push(pageSize, (page - 1) * pageSize);
      },
    };

    // Handle bank_name filter properly
    const bankName = filters.bank_name;
    const utr = filters.utr;
    // if (bankName) {
    //   const nextParamIdx = queryParams.length + 1;
    //   conditions.push(`ba.bank_name = $${nextParamIdx}`);
    //   queryParams.push(bankName);
    // } else
    if (utr) {
      const nextParamIdx = queryParams.length + 1;
      conditions.push(`p.user_submitted_utr = $${nextParamIdx}`);
      queryParams.push(utr);
    }
    delete filters.bank_name;
    delete filters.utr; // Remove from filters object

    // Handle search filters
    conditionBuilders.search(filters, CHARGE_BACK);
    conditionBuilders.dateRange(filters, conditions, queryParams);
    conditionBuilders.pagination(page, pageSize, queryParams, limitcondition);

    Object.entries(filters).forEach(([key, value]) => {
      if (handledKeys.has(key) || value == null) return;
      const nextParamIdx = queryParams.length + 1;

      // Special handling for arrays (like merchant_user_id)
      if (Array.isArray(value)) {
        const placeholders = value
          .map((_, idx) => `$${nextParamIdx + idx}`)
          .join(', ');
        conditions.push(`cb.${key} IN (${placeholders})`);
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
            ? `cb.${key} IN (${placeholders})`
            : `cb.${key} = $${nextParamIdx}`,
        );
        queryParams.push(...valueArray);
      }
    });

    const tableAlias = 'cb';

    // Filter out unwanted columns
    columns = columns.filter(
      (col) =>
        col !== 'merchant_user_id' &&
        col !== 'payin_id' &&
        col !== 'vendor_user_id' &&
        col !== 'bank_acc_id',
    );

    // Default columns if none provided
    const defaultColumns = ['id', 'payin_id', 'amount'];
    const baseColumns = columns.length
      ? columns.map((col) => `${tableAlias}.${col}`).join(', ')
      : defaultColumns.map((col) => `${tableAlias}.${col}`).join(', ');

    // Additional columns based on role
    let additionalColumns = '';
    if (role === Role.MERCHANT) {
      additionalColumns = `
        m.code AS merchant_name,
        p.user AS user,
        p.merchant_order_id AS merchant_order_id,
      `;
    } else if (role === Role.VENDOR) {
      additionalColumns += ``;
    } else {
      additionalColumns = `
        m.code AS merchant_name,
        p.merchant_order_id AS merchant_order_id,
        v.code AS vendor_name,
       CASE 
    WHEN m.config->>'sub_code' IS NOT NULL AND m.config->>'sub_code' != '' 
    THEN m.config->>'sub_code' 
    ELSE m.code 
  END AS merchant_name,
        p.user AS user,
        u.user_name AS created_by,
        uu.user_name AS updated_by,
        jsonb_build_object('blocked_users', m.config->'blocked_users') AS config,
      `;
    }
    //created and updated by with user name
    additionalColumns += `
      ba.nick_name AS bank_name,
      COALESCE(p.user_submitted_utr, br.utr) AS utr,
      cb.created_at
    `;

    // Combine all columns
    const allColumns = [baseColumns];
    if (additionalColumns) allColumns.push(additionalColumns);

    // Ensure sortBy is fully qualified if it's a simple column name
    const validSortColumns = [
      'id',
      'sno',
      'payin_id',
      'amount',
      'created_at',
      'updated_at',
    ];
    const qualifiedSortBy = validSortColumns.includes(sortBy)
      ? `cb.${sortBy}`
      : sortBy;

    const baseQuery = `
      SELECT
        ${allColumns.join(', ')}
      FROM public."${CHARGE_BACK}" cb
      LEFT JOIN public."${VENDOR}" v ON cb.vendor_user_id = v.user_id
      LEFT JOIN public."${MERCHANT}" m ON cb.merchant_user_id = m.user_id
      LEFT JOIN public."${PAYIN}" p ON cb.payin_id = p.id
      LEFT JOIN "${BANK_RESPONSE}" br ON p.bank_response_id = br.id
      LEFT JOIN public."${USER}" u ON cb.created_by = u.id 
      LEFT JOIN public."${USER}" uu ON cb.updated_by = uu.id
      LEFT JOIN public."${BANK_ACCOUNT}" ba ON cb.bank_acc_id = ba.id
      WHERE ${conditions.join(' AND ')}
      ${bankName ? `AND ba.nick_name = $${queryParams.length + 1}` : ''}
      ${utr ? `AND p.user_submitted_utr = $${queryParams.length + 1}` : ''}
      ORDER BY ${qualifiedSortBy} ${sortOrder}
      ${limitcondition.value}
    `;
    // Add bank_name to params if it exists
    if (bankName) {
      queryParams.push(bankName);
    }
    // Add utr to params if it exists
    if (utr) {
      queryParams.push(utr);
    }

    const expectedParamCount = (baseQuery.match(/\$\d+/g) || []).length;
    if (expectedParamCount !== queryParams.length) {
      logger.warn(
        `Expected: ${expectedParamCount}, Got: ${queryParams.length}`,
      );
    }

    const result = await executeQuery(baseQuery, queryParams);
    return result.rows;
  } catch (error) {
    logger.error('Error fetching ChargeBack entries:', error);
    throw error;
  }
};

export const getChargeBacksBySearchDao = async (
  filters,
  page,
  pageSize,
  sortBy,
  sortOrder,
  columns = [],
  role,
  searchTerms = [],
) => {
  try {
    const {
      VENDOR,
      CHARGE_BACK,
      MERCHANT,
      COMPANY,
      PAYIN,
      USER,
      BANK_ACCOUNT,
      BANK_RESPONSE,
    } = tableName;

    const conditions = [`cb.is_obsolete = false`];
    const queryParams = [];
    let paramIndex = 1;

    // Search term logic
    if (searchTerms.length > 0) {
      const searchConditions = [];

      searchTerms.forEach((term) => {
        searchConditions.push(`
          (
            LOWER(cb.id::text) LIKE LOWER($${paramIndex}) OR
            LOWER(cb.amount::text) LIKE LOWER($${paramIndex}) OR
            LOWER(p.user::text) LIKE LOWER($${paramIndex}) OR
            LOWER(m.code::text) LIKE LOWER($${paramIndex}) OR
            LOWER(v.code::text) LIKE LOWER($${paramIndex}) OR
            LOWER(p.user_submitted_utr::text) LIKE LOWER($${paramIndex}) OR
            LOWER(p.merchant_order_id::text) LIKE LOWER($${paramIndex}) OR
            LOWER(br.utr::text) LIKE LOWER($${paramIndex}) OR
            LOWER(ba.nick_name::text) LIKE LOWER($${paramIndex}) OR
            LOWER(u.user_name::text) LIKE LOWER($${paramIndex}) OR
            LOWER(uu.user_name::text) LIKE LOWER($${paramIndex})
          )
        `);
        queryParams.push(`%${term}%`);
        paramIndex++;
      });

      if (searchConditions.length > 0) {
        conditions.push(`(${searchConditions.join(' OR ')})`);
      }
    }

    // Apply start & end date filter
    if (filters.created_at) {
      const [day, month, year] = filters.created_at.split('-');
      const properDateStr = `${year}-${month}-${day}`;
      const IST = 'Asia/Kolkata';
      let startDate = dayjs.tz(`${properDateStr} 00:00:00`, IST).utc().format();
      let endDate = dayjs
        .tz(`${properDateStr} 23:59:59.999`, IST)
        .utc()
        .format();
      conditions.push(
        `cb.created_at BETWEEN $${paramIndex} AND $${paramIndex + 1}`,
      );
      queryParams.push(startDate, endDate);
      paramIndex += 2;
    }

    // Handle bank_name and utr filters
    if (filters.bank_name) {
      conditions.push(`ba.nick_name = $${paramIndex}`);
      queryParams.push(filters.bank_name);
      paramIndex++;
    }
    if (filters.user) {
      conditions.push(`p.user = $${paramIndex}`);
      queryParams.push(filters.user);
      paramIndex++;
    }
    if (filters.utr) {
      conditions.push(`p.user_submitted_utr = $${paramIndex}`);
      queryParams.push(filters.utr);
      paramIndex++;
    }
    if (filters.merchant_order_id) {
      conditions.push(`p.merchant_order_id = $${paramIndex}`);
      queryParams.push(filters.merchant_order_id); // Fixed: Push merchant_order_id
      paramIndex++;
    }
    if (filters.vendor_name) {
      conditions.push(`v.code = $${paramIndex}`);
      queryParams.push(filters.vendor_name); // Fixed: Push merchant_order_id
      paramIndex++;
    }

    // Handle other filters dynamically
    const ignoredKeys = new Set([
      'search',
      'startDate',
      'endDate',
      'bank_name',
      'utr',
      'merchant_order_id',
      'user',
      'vendor_name',
      'created_at'
    ]);
    for (const [key, value] of Object.entries(filters)) {
      if (!value || ignoredKeys.has(key)) continue;
      const values = Array.isArray(value)
        ? value
        : typeof value === 'string' && value.includes(',')
          ? value.split(',').map((v) => v.trim())
          : [value];

      const placeholders = values.map((_, i) => `$${paramIndex + i}`).join(',');
      if (values.length > 1) {
        conditions.push(`cb.${key} IN (${placeholders})`);
      } else {
        conditions.push(`cb.${key} = ${placeholders}`);
      }
      queryParams.push(...values);
      paramIndex += values.length;
    }

    // Column selection
    const baseColumns =
      columns.length > 0
        ? columns.map((col) => `cb.${col}`).join(', ')
        : 'cb.id, cb.payin_id, cb.amount';

    let extraColumns = `
      ba.nick_name AS bank_name,
      COALESCE(p.user_submitted_utr, br.utr) AS utr,
      cb.created_at
    `;

    if (role === Role.MERCHANT || role === Role.ADMIN) {
      extraColumns += `,
        m.code AS merchant_name,
        p.user AS user,
        p.merchant_order_id AS merchant_order_id, -- Fixed: Reference p.merchant_order_id
        u.user_name AS created_by,
        uu.user_name AS updated_by,
        v.code AS vendor_name,
        jsonb_build_object('blocked_users', cm.config->'blocked_users') AS config,
        CASE 
          WHEN m.config->>'sub_code' IS NOT NULL AND m.config->>'sub_code' != '' 
          THEN m.config->>'sub_code' 
          ELSE m.code 
        END AS merchant_display_code
      `;
    }

    const allColumns = `${baseColumns}, ${extraColumns}`;

    // Sorting
    const validSortColumns = [
      'id',
      'sno',
      'payin_id',
      'amount',
      'created_at',
      'updated_at',
    ];
    const safeSortBy = validSortColumns.includes(sortBy)
      ? `cb.${sortBy}`
      : 'cb.created_at';
    const safeSortOrder = sortOrder?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // Base FROM + JOIN
    const baseFromClause = `
      FROM public."${CHARGE_BACK}" cb
      LEFT JOIN public."${VENDOR}" v ON cb.vendor_user_id = v.user_id
      LEFT JOIN public."${COMPANY}" cm ON cb.company_id = cm.id
      LEFT JOIN public."${MERCHANT}" m ON cb.merchant_user_id = m.user_id
      LEFT JOIN public."${PAYIN}" p ON cb.payin_id = p.id
      LEFT JOIN "${BANK_RESPONSE}" br ON p.bank_response_id = br.id
      LEFT JOIN public."${USER}" u ON cb.created_by = u.id 
      LEFT JOIN public."${USER}" uu ON cb.updated_by = uu.id
      LEFT JOIN public."${BANK_ACCOUNT}" ba ON cb.bank_acc_id = ba.id
    `;

    // Final queries
    const whereClause = `WHERE ${conditions.join(' AND ')}`;
    const offset = (page - 1) * pageSize;

    const countQuery = `SELECT COUNT(*) ${baseFromClause} ${whereClause}`;
    const dataQuery = `
      SELECT ${allColumns}
      ${baseFromClause}
      ${whereClause}
      ORDER BY ${safeSortBy} ${safeSortOrder}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    queryParams.push(pageSize, offset);

    const countResult = await executeQuery(
      countQuery,
      queryParams.slice(0, paramIndex - 1),
    );
    const totalCount = parseInt(countResult.rows[0]?.count || '0');

    let result = await executeQuery(dataQuery, queryParams);
    if (totalCount > 0 && result.rows.length === 0 && offset > 0) {
      queryParams[queryParams.length - 1] = 0; 
      result = await executeQuery(dataQuery, queryParams);
    }
    return {
      totalCount,
      totalPages: Math.ceil(totalCount / pageSize),
      chargeBacks: result.rows,
    };
  } catch (error) {
    logger.error('Error in getChargeBacksBySearchDao:', error.message);
    throw error;
  }
};


// Update ChargeBack entry
export const updateChargeBackDao = async (id, data) => {
  try {
    const [sql, params] = buildUpdateQuery(tableName.CHARGE_BACK, data, id);
    const result = await executeQuery(sql, params);
    return result.rows[0];
  } catch (error) {
    logger.error('Error updating ChargeBack entry:', error);
    throw error;
  }
};

// Delete ChargeBack entry
export const deleteChargeBackDao = async (id, data) => {
  try {
    const [sql, params] = buildUpdateQuery(tableName.CHARGE_BACK, data, id);
    const result = await executeQuery(sql, params);
    return result.rows[0];
  } catch (error) {
    logger.error('Error deleting ChargeBack entry:', error);
    throw error;
  }
};
