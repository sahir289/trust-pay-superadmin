import {
  executeQuery,
  buildSelectQuery,
  buildInsertQuery,
  buildUpdateQuery,
  buildJoinQuery,
} from '../../utils/db.js';
import { Role, tableName } from '../../constants/index.js';
import { getUserHierarchysDao } from '../userHierarchy/userHierarchyDao.js';
import { NotFoundError } from '../../utils/appErrors.js';
import dayjs from 'dayjs';
import { logger } from '../../utils/logger.js';

const IST = 'Asia/Kolkata';

const getCalculationDao = async (
  filters,
  page,
  pageSize,
  sortBy,
  sortOrder,
  columns = [],
) => {
  try {
    // if simple user is querying then filter object must have user_id to bind result
    let baseQuery = `SELECT ${columns.length ? columns.join(', ') : '*'} FROM "${tableName.CALCULATION}" WHERE 1=1`;
    const {
      role,
      designation,
      startDate,
      endDate,
      sDate,
      eDate,
      includeSubVendors,
      includeSubMerchant,
      user_id,
    } = filters;
    let users = filters.users || '';
    delete filters.designation;
    delete filters.users;
    delete filters.role;
    delete filters.startDate;
    delete filters.endDate;
    delete filters.sDate;
    delete filters.eDate;
    users = users.split(',');

    // scenarios for super admin
    if (role && role === Role.SUPER_ADMIN) {
      delete filters.company_id;
      delete filters.user_id;
    }

    // scenarios for admin
    if (role && (role === Role.ADMIN || role === Role.SUPER_ADMIN)) {
      // filter object must have company_id to bind the result
      delete filters.user_id;
    }

    // scenarios for merchant admin, vendor admin
    if (
      role &&
      designation &&
      [Role.MERCHANT_ADMIN, Role.VENDOR_ADMIN].includes(designation) &&
      (includeSubMerchant || includeSubVendors)
    ) {
      delete filters.user_id;
      const roleToMatch =
        role === Role.MERCHANT_ADMIN ? Role.MERCHANT : Role.VENDOR;

      baseQuery = buildJoinQuery(
        tableName.CALCULATION,
        columns.length ? columns : '*',
        [
          {
            table: tableName.USER,
            keys: ['user_id', 'id'],
            columns: ['role_id'],
          },
          {
            table: tableName.ROLE,
            keys: ['role_id', 'id'],
            columns: ['role'],
            referenceTable: tableName.USER,
          },
        ],
      );

      baseQuery += ` AND "${tableName.ROLE}".role = '${roleToMatch}'`;

      if (includeSubMerchant || includeSubVendors || users.length) {
        const heirarchy = await getUserHierarchysDao({ user_id });
        if (!heirarchy) {
          throw NotFoundError('Sub Merchants not found!');
        }
        const heirarchyUsers = heirarchy.config[user_id] || [];
        if (heirarchyUsers.length && users.length) {
          // fetch user heirarchy
          let userIds = [];
          for (const user of users) {
            if (heirarchyUsers.includes(user)) {
              userIds.push(user);
            }
          }

          if (userIds.length) {
            filters.user_id = userIds;
          }
        }
      }
    }

    if (startDate && endDate) {
      baseQuery += ` AND created_at BETWEEN '${new Date(startDate).toISOString()}'::TIMESTAMPTZ AND '${new Date(endDate).toISOString()}'::TIMESTAMPTZ`;
    }

    if (sDate && eDate) {
      baseQuery += ` AND created_at BETWEEN '${new Date(sDate).toISOString()}'::TIMESTAMPTZ AND '${new Date(eDate).toISOString()}'::TIMESTAMPTZ`;
    }

    const [sql, queryParams] = buildSelectQuery(
      baseQuery,
      filters,
      page,
      pageSize,
      sortBy,
      sortOrder,
      tableName.CALCULATION,
    );
    // Execute query
    const result = await executeQuery(sql, queryParams);
    return result.rows;
  } catch (error) {
    logger.error('Error fetching Calculation', error);
    throw error;
  }
};

export const getCalculationsSumDao = async (filters) => {
  try {
    const {
      role,
      designation,
      startDate: start,
      endDate: end,
      user_id,
      users,
      company_id,
    } = filters;

    const startDate = start
      ? dayjs(start).tz(IST).startOf('day').toISOString()
      : dayjs().tz(IST).startOf('day').toISOString();

    const endDate = end
      ? dayjs(end).tz(IST).endOf('day').toISOString()
      : dayjs().tz(IST).endOf('day').toISOString();
    let vendorData = {},
      merchantData = {},
      netBalance = {};
    let hierarchyUsers = [];

    // Fix the userCodes array creation
    let userCodes = [];
    if (users) {
      // Handle both comma-with-space and comma-only separators
      userCodes = users.split(/\s*,\s*/).filter((id) => id.trim());
      logger.info('Processed user codes:', userCodes);
    }

    let effectiveUserId = user_id;

    if (
      designation === Role.MERCHANT_OPERATIONS ||
      designation === Role.VENDOR_OPERATIONS
    ) {
      const hierarchy = await getUserHierarchysDao({ user_id });
      const parentId = hierarchy?.[0]?.config?.parent;
      if (parentId) {
        effectiveUserId = parentId;
        logger.info('Using parent merchant ID:', parentId);
      }
    }

    const groupBy = ` GROUP BY DATE_TRUNC('day', c.created_at) ORDER BY DATE_TRUNC('day', c.created_at)DESC;`;

    // Modified Base Query with numeric casting
    let baseQuery = `
      SELECT 
         (DATE_TRUNC('day', c.created_at)) AS date,
          CAST(SUM(c.total_payin_count) AS INTEGER) AS total_payin_count,
          CAST(ROUND(SUM(c.total_payin_amount)::NUMERIC, 2) AS FLOAT) AS total_payin_amount,
          CAST(ROUND(SUM(c.total_payin_commission)::NUMERIC, 2) AS FLOAT) AS total_payin_commission,
          CAST(SUM(c.total_payout_count) AS INTEGER) AS total_payout_count,
          CAST(ROUND(SUM(c.total_payout_amount)::NUMERIC, 2) AS FLOAT) AS total_payout_amount,
          CAST(ROUND(SUM(c.total_payout_commission)::NUMERIC, 2) AS FLOAT) AS total_payout_commission,
          CAST(SUM(c.total_settlement_count) AS INTEGER) AS total_settlement_count,
          CAST(ROUND(SUM(c.total_settlement_amount)::NUMERIC, 2) AS FLOAT) AS total_settlement_amount,
          CAST(ROUND(SUM(c.total_settlement_commission)::NUMERIC, 2) AS FLOAT) AS total_settlement_commission,
          CAST(SUM(c.total_chargeback_count) AS INTEGER) AS total_chargeback_count,
          CAST(ROUND(SUM(c.total_chargeback_amount)::NUMERIC, 2) AS FLOAT) AS total_chargeback_amount,
          CAST(SUM(c.total_reverse_payout_count) AS INTEGER) AS total_reverse_payout_count,
          CAST(ROUND(SUM(c.total_reverse_payout_amount)::NUMERIC, 2) AS FLOAT) AS total_reverse_payout_amount,
          CAST(ROUND(SUM(c.total_reverse_payout_commission)::NUMERIC, 2) AS FLOAT) AS total_reverse_payout_commission,
          CAST(SUM(c.total_adjustment_count) AS INTEGER) AS total_adjustment_count,
          CAST(ROUND(SUM(c.total_adjustment_amount)::NUMERIC, 2) AS FLOAT) AS total_adjustment_amount,
          CAST(ROUND(SUM(c.total_adjustment_commission)::NUMERIC, 2) AS FLOAT) AS total_adjustment_commission,
          CAST(ROUND(SUM(c.current_balance)::NUMERIC, 2) AS FLOAT) AS current_balance,
          CAST(ROUND(SUM(c.net_balance)::NUMERIC, 2) AS FLOAT) AS net_balance
      FROM "${tableName.CALCULATION}" c
      JOIN "${tableName.USER}" u ON c.user_id = u.id AND u.is_obsolete = FALSE
      JOIN "${tableName.ROLE}" r ON u.role_id = r.id
    `;

    // Queries for Different Roles
    let merchantQuery = `${baseQuery} 
      JOIN "${tableName.MERCHANT}" m ON m.user_id = c.user_id
      WHERE c.is_obsolete = FALSE 
      AND c.created_at BETWEEN '${startDate}' AND '${endDate}'
      AND r.role = 'MERCHANT' `;
    let vendorQuery = `${baseQuery} 
      JOIN "${tableName.VENDOR}" v ON v.user_id = c.user_id
      WHERE c.is_obsolete = FALSE 
      AND c.created_at BETWEEN '${startDate}' AND '${endDate}'
      AND r.role = 'VENDOR' `;

    // Include hierarchy filtering (match against `code` column)
    if (hierarchyUsers.length) {
      merchantQuery += `
        AND EXISTS (
          SELECT 1 FROM merchant m
          WHERE m.user_id = ANY(ARRAY[${hierarchyUsers.map((el) => `'${el}'`)}])
        )`;

      vendorQuery += `
        AND EXISTS (
          SELECT 1 FROM vendor v
          WHERE v.user_id = ANY(ARRAY[${hierarchyUsers.map((el) => `'${el}'`)}])
        )`;
    }

    // Modified user code condition for merchant and vendor queries

    // Admin Query
    if (Role.ADMIN === role || Role.SUPER_ADMIN === role) {
      if (userCodes.length > 0) {
        // If userCodes are provided, filter by them
        let userIds = []; // Initialize empty array for all IDs
        for (const userCode of userCodes) {
          if (userCode) {
            const userHierarchys = await getUserHierarchysDao({
              user_id: userCode,
            });
            const allowedSubmerchants =
              userHierarchys?.[0]?.config?.siblings?.sub_merchants || [];
            // Add current userCode and its submerchants to userIds array
            userIds.push(userCode); // Add the main userCode
            userIds.push(...allowedSubmerchants); // Add all submerchants
          }
        }
        // Remove any duplicates
        userIds = [...new Set(userIds)];

        const userCodeParams = userIds.map((code) => `'${code}'`).join(',');
        merchantQuery += ` AND m.user_id = ANY(ARRAY[${userCodeParams}]) `;
        vendorQuery += ` AND v.user_id = ANY(ARRAY[${userCodeParams}]) `;
      }
      const vQuery = `${vendorQuery}  AND c.company_id = '${company_id}' AND u.company_id = '${company_id}' ${groupBy}`;
      const mQuery = `${merchantQuery}  AND c.company_id = '${company_id}' AND u.company_id = '${company_id}' ${groupBy}`;
      merchantData = (await executeQuery(mQuery, [])).rows;
      vendorData = (await executeQuery(vQuery, [])).rows;
    }

    // Super Admin Query
    if (Role.SUPER_ADMIN === role) {
      merchantData = (await executeQuery(`${merchantQuery}  ${groupBy}`, []))
        .rows;
      vendorData = (await executeQuery(`${vendorQuery}  ${groupBy}`, [])).rows;
    }

    // query for merchant only role
    if (role === Role.MERCHANT) {
      // Get user hierarchy to validate submerchant access
      const userHierarchys = await getUserHierarchysDao({
        user_id: effectiveUserId,
      });
      let userIds = [effectiveUserId]; // Always include merchant's own ID

      // Handle userCodes for merchant totals
      if (userCodes?.length > 0) {
        // Get allowed submerchant IDs from hierarchy
        const allowedSubmerchants =
          userHierarchys?.[0]?.config?.siblings?.sub_merchants || [];
        // Only include valid submerchant IDs
        const validUserIds = userCodes.filter((id) =>
          allowedSubmerchants.includes(id),
        );
        userIds = [...userCodes, ...validUserIds]; // Include both merchant and valid submerchant IDs
      }

      // Create the query with proper type casting for array elements
      const mQuery = `${merchantQuery} 
        AND c.user_id = ANY(ARRAY[${userIds.map((id) => `'${id}'::text`).join(',')}])
        AND c.company_id = $1
        ${groupBy}`;

      merchantData = (await executeQuery(mQuery, [company_id])).rows;
    }

    // query for vendor only role
    if (role === Role.VENDOR) {
      const vQuery = `${vendorQuery}  AND c.user_id = $1  AND c.company_id = $2  ${groupBy}`;
      vendorData = (await executeQuery(vQuery, [effectiveUserId, company_id]))
        .rows;
    }

    if ([Role.SUPER_ADMIN, Role.ADMIN].includes(role)) {
      const condition =
        role === Role.ADMIN ? ` AND c.company_id = '${company_id}' ` : '';
      // If userCodes are provided, filter by them
      let userIds = [];
      if (userCodes.length > 0) {
        // Get user hierarchy to validate access

        // Process each userCode if provided
        if (userCodes?.length > 0) {
          for (const userCode of userCodes) {
            if (userCode) {
              const userHierarchys = await getUserHierarchysDao({
                user_id: userCode,
              });
              const allowedSubmerchants =
                userHierarchys?.[0]?.config?.siblings?.sub_merchants || [];
              // Combine current userCode with its submerchants
              userIds.push(userCode); // Add the main userCode
              userIds.push(...allowedSubmerchants); // Add all submerchants
            }
          }
        }
        // Remove any duplicates
        userIds = [...new Set(userIds)];
      }
      const baseCalQuery = `
        WITH LatestBalances AS (
          SELECT 
            c.user_id,
            c.company_id,
            c.net_balance,
            r.role,
            m.code as merchant_code,
            v.code as vendor_code,
            ROW_NUMBER() OVER (PARTITION BY c.user_id ORDER BY c.created_at DESC) as rn
          FROM "${tableName.CALCULATION}" c
          JOIN "${tableName.USER}" u ON c.user_id = u.id AND u.is_obsolete = FALSE
          JOIN "${tableName.ROLE}" r ON u.role_id = r.id 
          LEFT JOIN "${tableName.MERCHANT}" m ON m.user_id = c.user_id
          LEFT JOIN "${tableName.VENDOR}" v ON v.user_id = c.user_id
          WHERE c.is_obsolete = FALSE
          AND u.is_obsolete = FALSE
          AND c.created_at BETWEEN '${startDate}' AND '${endDate}'
          ${condition}
          ${
            userIds.length > 0
              ? `AND (m.user_id = ANY(ARRAY[${userIds.map((code) => `'${code}'`).join(',')}]) 
            OR v.user_id = ANY(ARRAY[${userCodes.map((code) => `'${code}'`).join(',')}]))`
              : 'AND m.is_obsolete = FALSE OR v.is_obsolete = FALSE'
          }
        )
        SELECT 
          role,
          company_id,
          CAST(ROUND(SUM(net_balance)::NUMERIC, 2) AS FLOAT) as net_balance_sum
        FROM LatestBalances 
        WHERE rn = 1
        GROUP BY role, company_id`;

      const balanceResult = await executeQuery(baseCalQuery);

      // Process results into netBalance object with company filtering
      netBalance = balanceResult.rows.reduce(
        (acc, row) => {
          if (row.role === Role.VENDOR && (!company_id || row.company_id === company_id)) {
            acc.vendor = row.net_balance_sum || 0;
          } else if (row.role === Role.MERCHANT && (!company_id || row.company_id === company_id)) {
            acc.merchant = row.net_balance_sum || 0;
          }
          return acc;
        },
        { vendor: 0, merchant: 0 },
      );
    } else {
      const userHierarchys = await getUserHierarchysDao({
        user_id: effectiveUserId,
      });
      let userIds = [effectiveUserId]; // Always include merchant's own ID

      // Handle userCodes for merchant totals
      if (userCodes?.length > 0) {
        // Get allowed submerchant IDs from hierarchy
        const allowedSubmerchants =
          userHierarchys?.[0]?.config?.siblings?.sub_merchants || [];
        // Only include valid submerchant IDs
        const validUserIds = userCodes.filter((id) =>
          allowedSubmerchants.includes(id),
        );
        userIds = [...new Set([...userCodes, ...validUserIds])]; // Remove duplicates
      }
      // For non-admin roles, use existing query logic

      const endDateConditon = ` AND DATE(c.created_at) = '${endDate}' `;
      const calBaseQuery = `
        WITH LatestCalculations AS (
          SELECT DISTINCT ON (c.user_id) 
            c.user_id,
            c.net_balance
          FROM "${tableName.CALCULATION}" c
          JOIN "${tableName.USER}" u ON c.user_id = u.id AND u.is_obsolete = FALSE
          JOIN "${tableName.ROLE}" r ON u.role_id = r.id AND r.role = 'PLACE_ROLE_HERE'
          WHERE c.is_obsolete = FALSE 
          AND c.user_id = ANY(ARRAY[${userIds.map((id) => `'${id}'`).join(',')}])
          AND c.company_id = '${company_id}'
          ${endDateConditon}
          ORDER BY c.user_id, c.created_at DESC
        )
        SELECT COALESCE(SUM(net_balance), 0) as net_balance_sum
        FROM LatestCalculations`;

      let vendorCalQuery = calBaseQuery.replace('PLACE_ROLE_HERE', Role.VENDOR);
      let merchantCalQuery = calBaseQuery.replace(
        'PLACE_ROLE_HERE',
        Role.MERCHANT,
      );

      netBalance.vendor =
        (await executeQuery(vendorCalQuery)).rows[0]?.net_balance_sum || 0;
      netBalance.merchant =
        (await executeQuery(merchantCalQuery)).rows[0]?.net_balance_sum || 0;
    }

    // Modify total calculations query for merchants based on role
    let merchantTotalQuery = `
      SELECT 
        CAST(SUM(c.total_payin_count) AS INTEGER) AS total_payin_count,
        CAST(ROUND(SUM(c.total_payin_amount)::NUMERIC, 2) AS FLOAT) AS total_payin_amount,
        CAST(ROUND(SUM(c.total_payin_commission)::NUMERIC, 2) AS FLOAT) AS total_payin_commission,
        CAST(SUM(c.total_payout_count) AS INTEGER) AS total_payout_count,
        CAST(ROUND(SUM(c.total_payout_amount)::NUMERIC, 2) AS FLOAT) AS total_payout_amount,
        CAST(ROUND(SUM(c.total_payout_commission)::NUMERIC, 2) AS FLOAT) AS total_payout_commission,
        CAST(SUM(c.total_settlement_count) AS INTEGER) AS total_settlement_count,
        CAST(ROUND(SUM(c.total_settlement_amount)::NUMERIC, 2) AS FLOAT) AS total_settlement_amount,
        CAST(SUM(c.total_settlement_commission) AS INTEGER) AS total_settlement_commission,
        CAST(SUM(c.total_chargeback_count) AS INTEGER) AS total_chargeback_count,
        CAST(ROUND(SUM(c.total_chargeback_amount)::NUMERIC, 2) AS FLOAT) AS total_chargeback_amount,
        CAST(SUM(c.total_reverse_payout_count) AS INTEGER) AS total_reverse_payout_count,
        CAST(ROUND(SUM(c.total_reverse_payout_amount)::NUMERIC, 2) AS FLOAT) AS total_reverse_payout_amount,
        CAST(ROUND(SUM(c.total_reverse_payout_commission)::NUMERIC, 2) AS FLOAT) AS total_reverse_payout_commission,
        CAST(SUM(c.total_adjustment_count) AS INTEGER) AS total_adjustment_count,
        CAST(ROUND(SUM(c.total_adjustment_amount)::NUMERIC, 2) AS FLOAT) AS total_adjustment_amount,
        CAST(ROUND(SUM(c.total_adjustment_commission)::NUMERIC, 2) AS FLOAT) AS total_adjustment_commission,
        CAST(ROUND(SUM(c.current_balance)::NUMERIC, 2) AS FLOAT) AS current_balance,
        CAST(ROUND(SUM(c.net_balance)::NUMERIC, 2) AS FLOAT) AS net_balance
      FROM "${tableName.CALCULATION}" c
      JOIN "${tableName.USER}" u ON c.user_id = u.id AND u.is_obsolete = FALSE 
      JOIN "${tableName.ROLE}" r ON u.role_id = r.id
      JOIN "${tableName.MERCHANT}" m ON c.user_id = m.user_id
      WHERE c.created_at BETWEEN '${startDate}' AND '${endDate}'
      AND r.role = 'MERCHANT'
    `;

    // Add vendor total calculations query
    let vendorTotalQuery = `
      SELECT 
        CAST(SUM(c.total_payin_count) AS INTEGER) AS total_payin_count,
        CAST(ROUND(SUM(c.total_payin_amount)::NUMERIC, 2) AS FLOAT) AS total_payin_amount,
        CAST(ROUND(SUM(c.total_payin_commission)::NUMERIC, 2) AS FLOAT) AS total_payin_commission,
        CAST(SUM(c.total_payout_count) AS INTEGER) AS total_payout_count,
        CAST(ROUND(SUM(c.total_payout_amount)::NUMERIC, 2) AS FLOAT) AS total_payout_amount,
        CAST(ROUND(SUM(c.total_payout_commission)::NUMERIC, 2) AS FLOAT) AS total_payout_commission,
        CAST(SUM(c.total_settlement_count) AS INTEGER) AS total_settlement_count,
        CAST(ROUND(SUM(c.total_settlement_amount)::NUMERIC, 2) AS FLOAT) AS total_settlement_amount,
        CAST(SUM(c.total_settlement_commission) AS INTEGER) AS total_settlement_commission,
        CAST(SUM(c.total_chargeback_count) AS INTEGER) AS total_chargeback_count,
        CAST(ROUND(SUM(c.total_chargeback_amount)::NUMERIC, 2) AS FLOAT) AS total_chargeback_amount,
        CAST(SUM(c.total_reverse_payout_count) AS INTEGER) AS total_reverse_payout_count,
        CAST(ROUND(SUM(c.total_reverse_payout_amount)::NUMERIC, 2) AS FLOAT) AS total_reverse_payout_amount,
        CAST(ROUND(SUM(c.total_reverse_payout_commission)::NUMERIC, 2) AS FLOAT) AS total_reverse_payout_commission,
        CAST(SUM(c.total_adjustment_count) AS INTEGER) AS total_adjustment_count,
        CAST(ROUND(SUM(c.total_adjustment_amount)::NUMERIC, 2) AS FLOAT) AS total_adjustment_amount,
        CAST(ROUND(SUM(c.total_adjustment_commission)::NUMERIC, 2) AS FLOAT) AS total_adjustment_commission,
        CAST(ROUND(SUM(c.current_balance)::NUMERIC, 2) AS FLOAT) AS current_balance,
        CAST(ROUND(SUM(c.net_balance)::NUMERIC, 2) AS FLOAT) AS net_balance,
        CAST(SUM(COALESCE((c.config->>'total_internalSettlement_count')::INTEGER, 0)) AS INTEGER) AS total_internalSettlement_count,
        CAST(ROUND(SUM(COALESCE((c.config->>'total_internalSettlement_amount')::NUMERIC, 0))::NUMERIC, 2) AS FLOAT) AS total_internalSettlement_amount,
        CAST(ROUND(SUM(COALESCE((c.config->>'total_internalSettlement_commission')::NUMERIC, 0))::NUMERIC, 2) AS FLOAT) AS total_internalSettlement_commission
      FROM "${tableName.CALCULATION}" c
      JOIN "${tableName.USER}" u ON c.user_id = u.id AND u.is_obsolete = FALSE
      JOIN "${tableName.ROLE}" r ON u.role_id = r.id
      JOIN "${tableName.VENDOR}" v ON c.user_id = v.user_id
      WHERE c.created_at BETWEEN '${startDate}' AND '${endDate}'
      AND r.role = 'VENDOR'
    `;

    // Add role-based conditions
    if (role === Role.MERCHANT) {
      // Get user hierarchy to validate submerchant access
      const userHierarchys = await getUserHierarchysDao({
        user_id: effectiveUserId,
      });
      let userIds = [effectiveUserId]; // Always include merchant's own ID

      // Handle userCodes for merchant totals
      if (userCodes?.length > 0) {
        // Get allowed submerchant IDs from hierarchy
        const allowedSubmerchants =
          userHierarchys?.[0]?.config?.siblings?.sub_merchants || [];
        // Only include valid submerchant IDs
        const validUserIds = userCodes.filter((id) =>
          allowedSubmerchants.includes(id),
        );
        userIds = [...new Set([...userCodes, ...validUserIds])]; // Remove duplicates
      }

      // Add filter to merchant total query
      merchantTotalQuery += ` AND m.user_id = ANY(ARRAY['${userIds.join("','")}']) `;
      merchantTotalQuery += ` AND c.company_id = '${company_id}'`;
      vendorTotalQuery = null; // Merchant shouldn't see vendor totals
    } else if (role === Role.VENDOR) {
      vendorTotalQuery += ` AND c.user_id = '${effectiveUserId}'`;
      merchantTotalQuery = null; // Vendor shouldn't see merchant totals
    } else if (role === Role.ADMIN || role === Role.SUPER_ADMIN) {
      // Get user hierarchy to validate access
      let userIds = [];

      // Process each userCode if provided
      if (userCodes?.length > 0) {
        for (const userCode of userCodes) {
          if (userCode) {
            const userHierarchys = await getUserHierarchysDao({
              user_id: userCode,
            });
            const allowedSubmerchants =
              userHierarchys?.[0]?.config?.siblings?.sub_merchants || [];
            // Combine current userCode with its submerchants
            userIds.push(userCode); // Add the main userCode
            userIds.push(...allowedSubmerchants); // Add all submerchants
          }
        }

        userIds = [...new Set(userIds)]; // Remove duplicates

        // Add filters to queries using proper array syntax
        if (userIds.length > 0) {
          const userIdsFormatted = userIds.map((id) => `'${id}'`).join(',');
          merchantTotalQuery += ` AND m.user_id = ANY(ARRAY[${userIdsFormatted}]) `;
          vendorTotalQuery += ` AND v.user_id = ANY(ARRAY[${userCodes.map((code) => `'${code}'`).join(',')}]) `;
        }
      }

      merchantTotalQuery += ` AND c.company_id = '${company_id}'`;
      vendorTotalQuery += ` AND c.company_id = '${company_id}'`;
    }

    // Execute queries based on role
    const [merchantTotal, vendorTotal] = await Promise.all([
      merchantTotalQuery
        ? executeQuery(merchantTotalQuery)
        : Promise.resolve({ rows: [{}] }),
      vendorTotalQuery
        ? executeQuery(vendorTotalQuery)
        : Promise.resolve({ rows: [{}] }),
    ]);
    return {
      vendor: vendorData,
      merchant: merchantData,
      netBalance,
      merchantTotalCalculations: merchantTotal.rows[0] || {},
      vendorTotalCalculations: vendorTotal.rows[0] || {},
    };
  } catch (error) {
    logger.error('Error getting calculation data:', error);
    throw error;
  }
};

////for cron job to update net_balance
export const getCalculationforCronDao = async (userId) => {
  try {
    const sql = `
      SELECT *
      FROM public."Calculation" 
      WHERE is_obsolete = false 
      AND user_id = $1
      ORDER BY created_at DESC 
      LIMIT 1
    `;
    // Ensure userId is correctly passed as an array
    const result = await executeQuery(sql, [userId]);
    return result.rows;
  } catch (error) {
    logger.error('Error fetching Calculation', error);
    throw error;
  }
};

export const getAllCalculationforCronDao = async (userId) => {
  try {
    const sql = `
      SELECT *
      FROM public."Calculation" 
      WHERE is_obsolete = false 
      AND user_id = $1
      ORDER BY created_at DESC 
    `;
    // Ensure userId is correctly passed as an array
    const result = await executeQuery(sql, [userId]);
    return result.rows;
  } catch (error) {
    logger.error('Error fetching Calculation', error);
    throw error;
  }
};

export const checkTodayCalculationExistsDao = async () => {
  try {
    const today = dayjs().tz(IST).format('YYYY-MM-DD');
    const sql = `
      SELECT COUNT(*) as count
      FROM public."Calculation" 
      WHERE is_obsolete = false 
      AND DATE(created_at) = $1
      LIMIT 1
    `;
    const result = await executeQuery(sql, [today]);
    return parseInt(result.rows[0].count) > 0;
  } catch (error) {
    logger.error('Error checking today calculation exists:', error);
    throw error;
  }
};

const createCalculationDao = async (conn, data) => {
  try {
    const [sql, params] = buildInsertQuery(tableName.CALCULATION, data);
    let result;
    if (conn && conn.query) {
      result = await conn.query(sql, params);
    } else {
      result = await executeQuery(sql, params);
    }
    return result.rows ? result.rows[0] : result[0]; // Return the first row or result based on the structure
  } catch (error) {
    logger.error('Error creating calculation:', error); // Log the error for debugging
    throw error;
  }
};

const updateCalculationDao = async (id, data, conn) => {
  try {
    const [sql, params] = buildUpdateQuery(tableName.CALCULATION, data, id);
    let result;
    if (conn && conn.query) {
      result = await conn.query(sql, params); // Use connection to execute query
    } else {
      result = await executeQuery(sql, params); // Use executeQuery if no connection
    }
    return result.rows ? result.rows[0] : result[0]; // Return the first row or result based on the structure
  } catch (error) {
    logger.error('Error updating calculation:', error); // Log the error for debugging
    throw error;
  }
};

const deleteCalculationDao = async (conn, id, data) => {
  try {
    const [sql, params] = buildUpdateQuery(tableName.CALCULATION, data, id);

    let result;
    if (conn && conn.query) {
      result = await conn.query(sql, params); // Use connection to execute query
    } else {
      result = await executeQuery(sql, params); // Use executeQuery if no connection
    }

    return result.rows ? result.rows[0] : result[0]; // Return the first row or result based on the structure
  } catch (error) {
    logger.error('Error deleting calculation:', error);
    throw error;
  }
};

export const updateCalculationBalanceDao = async (filters, data, conn) => {
  try {
    const specialFields = {};
    Object.keys(data).forEach((el) => {
      specialFields[el] = '+';
    });
    const [sql, params] = buildUpdateQuery(
      tableName.CALCULATION,
      data,
      filters,
      specialFields,
    );
    if (conn && conn.query) {
      const result = await conn.query(sql, params);
      return result.rows[0];
    }
    const result = await executeQuery(sql, params);
    return result.rows[0];
  } catch (error) {
    logger.error('Error updating calculation:', error);
    throw error;
  }
};

export {
  getCalculationDao,
  createCalculationDao,
  updateCalculationDao,
  deleteCalculationDao,
};
