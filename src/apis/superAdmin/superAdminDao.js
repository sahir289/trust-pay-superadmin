import { executeQuery } from '../../utils/db.js';
import { logger } from '../../utils/logger.js';
import { Role, Status } from '../../constants/index.js';

export const getDashboardStatsDao = async (company_id) => {
  try {
    // Parse company_id - handle both single values and comma-separated arrays
    let companyIds = null;
    if (company_id) {
      if (typeof company_id === 'string' && company_id.includes(',')) {
        companyIds = company_id.split(',').map(id => id.trim()).filter(id => id);
      } else if (company_id) {
        companyIds = [company_id];
      }
    }

    // Build dynamic WHERE conditions based on whether company_id is provided
    const buildWhereClause = (additionalConditions) => {
      if (companyIds && companyIds.length > 0) {
        const placeholders = companyIds.map((_, index) => `$${index + 1}`).join(', ');
        return `WHERE company_id IN (${placeholders}) AND ${additionalConditions}`;
      }
      return `WHERE ${additionalConditions}`;
    };

    const params = companyIds && companyIds.length > 0 ? companyIds : [];

    const query = `
      SELECT 
        (SELECT COUNT(*) FROM "Merchant" m ${buildWhereClause('m.is_enabled = true AND m.is_obsolete = false')}) as active_merchants,
        (SELECT COUNT(*) FROM "Vendor" v ${buildWhereClause('v.is_obsolete = false')}) as active_vendors,
        (SELECT COUNT(*) FROM "User" u 
         JOIN "Role" r ON u.role_id = r.id 
         ${buildWhereClause(`u.is_enabled = true AND u.is_obsolete = false AND r.role NOT IN ('${Role.MERCHANT}', '${Role.VENDOR}')`)}) as active_users,
        (SELECT COUNT(DISTINCT at.user_id) FROM "AccessToken" at ${buildWhereClause('at.is_obsolete = false AND DATE(at.created_at) = CURRENT_DATE')}) as login_users_today,
        (SELECT COUNT(DISTINCT p.user) FROM "Payin" p ${buildWhereClause(`p.is_obsolete = false AND p.status IN ('${Status.ASSIGNED}', '${Status.SUCCESS}', '${Status.DROPPED}', '${Status.DUPLICATE}', '${Status.INITIATED}', '${Status.DISPUTE}', '${Status.REVERSED}', '${Status.IMG_PENDING}', '${Status.PENDING}', '${Status.REJECTED}', '${Status.TEST_SUCCESS}', '${Status.TEST_DROPPED}', '${Status.BANK_MISMATCH}', '${Status.FAILED}', '${Status.USER_DROPPED}', '${Status.APPROVED}') AND DATE(p.created_at) = CURRENT_DATE`)}) as distinct_payment_link_users
    `;

    const result = await executeQuery(query, params);
    return result.rows[0];
  } catch (error) {
    logger.error('Error while fetching dashboard stats:', error);
    throw error;
  }
};

export const getPendingTransactionsDao = async (company_id) => {
  try {
    // Parse company_id - handle both single values and comma-separated arrays
    let companyIds = null;
    if (company_id) {
      if (typeof company_id === 'string' && company_id.includes(',')) {
        companyIds = company_id.split(',').map(id => id.trim()).filter(id => id);
      } else if (company_id) {
        companyIds = [company_id];
      }
    }

    // Build dynamic WHERE conditions based on whether company_id is provided
    const buildWhereClause = (additionalConditions) => {
      if (companyIds && companyIds.length > 0) {
        const placeholders = companyIds.map((_, index) => `$${index + 1}`).join(', ');
        return `WHERE company_id IN (${placeholders}) AND ${additionalConditions}`;
      }
      return `WHERE ${additionalConditions}`;
    };

    const params = companyIds && companyIds.length > 0 ? companyIds : [];

    const query = `
      SELECT 
        (SELECT COUNT(*) FROM "Payin" p ${buildWhereClause(`p.is_obsolete = false AND p.status IN ('${Status.PENDING}', '${Status.DISPUTE}', '${Status.BANK_MISMATCH}')`)}) as pending_payin_count,
        (SELECT COUNT(*) FROM "Payout" po ${buildWhereClause(`po.is_obsolete = false AND po.status = '${Status.INITIATED}'`)}) as pending_payout_count,
        (SELECT COUNT(*) FROM "Settlement" s ${buildWhereClause(`s.is_obsolete = false AND s.status = '${Status.INITIATED}'`)}) as pending_settlement_count
    `;

    const result = await executeQuery(query, params);
    return result.rows[0];
  } catch (error) {
    logger.error('Error while fetching pending transactions:', error);
    throw error;
  }
};

export const getTransactionCalculationsDao = async (company_id) => {
  try {
    // Parse company_id - handle both single values and comma-separated arrays
    let companyIds = null;
    if (company_id) {
      if (typeof company_id === 'string' && company_id.includes(',')) {
        companyIds = company_id.split(',').map(id => id.trim()).filter(id => id);
      } else if (company_id) {
        companyIds = [company_id];
      }
    }

    // Build dynamic WHERE conditions based on whether company_id is provided
    const buildWhereClause = (additionalConditions) => {
      if (companyIds && companyIds.length > 0) {
        const placeholders = companyIds.map((_, index) => `$${index + 1}`).join(', ');
        return `WHERE c.company_id IN (${placeholders}) AND ${additionalConditions}`;
      }
      return `WHERE ${additionalConditions}`;
    };

    const params = companyIds && companyIds.length > 0 ? companyIds : [];

    const query = `
      SELECT 
        -- Merchant calculations (revenue for company)
        COALESCE(SUM(CASE WHEN r.role = '${Role.MERCHANT}' THEN c.total_payin_amount ELSE 0 END), 0) as merchant_total_payin_amount,
        COALESCE(SUM(CASE WHEN r.role = '${Role.MERCHANT}' THEN c.total_payin_commission ELSE 0 END), 0) as merchant_total_payin_commission,
        COALESCE(SUM(CASE WHEN r.role = '${Role.MERCHANT}' THEN c.total_payout_amount ELSE 0 END), 0) as merchant_total_payout_amount,
        COALESCE(SUM(CASE WHEN r.role = '${Role.MERCHANT}' THEN c.total_payout_commission ELSE 0 END), 0) as merchant_total_payout_commission,
        COALESCE(SUM(CASE WHEN r.role = '${Role.MERCHANT}' THEN c.total_reverse_payout_amount ELSE 0 END), 0) as merchant_total_reverse_payout_amount,
        COALESCE(SUM(CASE WHEN r.role = '${Role.MERCHANT}' THEN c.total_reverse_payout_commission ELSE 0 END), 0) as merchant_total_reverse_payout_commission,

        -- Vendor calculations (expense for company)
        COALESCE(SUM(CASE WHEN r.role = '${Role.VENDOR}' THEN c.total_payin_commission ELSE 0 END), 0) as vendor_total_payin_commission,
        COALESCE(SUM(CASE WHEN r.role = '${Role.VENDOR}' THEN c.total_payout_commission ELSE 0 END), 0) as vendor_total_payout_commission,
        COALESCE(SUM(CASE WHEN r.role = '${Role.VENDOR}' THEN c.total_reverse_payout_commission ELSE 0 END), 0) as vendor_total_reverse_payout_commission
      FROM "Calculation" c
      JOIN "User" u ON c.user_id = u.id
      JOIN "Role" r ON u.role_id = r.id
      ${buildWhereClause('c.is_obsolete = false')}
    `;

    const result = await executeQuery(query, params);
    return result.rows[0];
  } catch (error) {
    logger.error('Error while fetching transaction calculations:', error);
    throw error;
  }
};

export const getTransactionRatiosDao = async (company_id) => {
  try {
    // Parse company_id - handle both single values and comma-separated arrays
    let companyIds = null;
    if (company_id) {
      if (typeof company_id === 'string' && company_id.includes(',')) {
        companyIds = company_id.split(',').map(id => id.trim()).filter(id => id);
      } else if (company_id) {
        companyIds = [company_id];
      }
    }

    // Build dynamic WHERE conditions based on whether company_id is provided
    const buildWhereClause = (additionalConditions) => {
      if (companyIds && companyIds.length > 0) {
        const placeholders = companyIds.map((_, index) => `$${index + 1}`).join(', ');
        return `WHERE company_id IN (${placeholders}) AND ${additionalConditions}`;
      }
      return `WHERE ${additionalConditions}`;
    };

    const params = companyIds && companyIds.length > 0 ? companyIds : [];

    const query = `
      SELECT 
        -- Total payin links generated (all payin records)
        (SELECT COUNT(*) FROM "Payin" p ${buildWhereClause('p.is_obsolete = false')}) as total_payin_links,
        
        -- Successful payins (status = 'SUCCESS')
        (SELECT COUNT(*) FROM "Payin" p ${buildWhereClause(`p.is_obsolete = false AND p.status = '${Status.SUCCESS}'`)}) as successful_payins,
        
        -- UTR submissions (payins where user_submitted_utr is not null and not empty)
        (SELECT COUNT(*) FROM "Payin" p ${buildWhereClause(`p.is_obsolete = false AND p.user_submitted_utr IS NOT NULL AND p.user_submitted_utr != ''`)}) as utr_submissions
    `;

    const result = await executeQuery(query, params);
    return result.rows[0];
  } catch (error) {
    logger.error('Error while fetching transaction ratios:', error);
    throw error;
  }
};
