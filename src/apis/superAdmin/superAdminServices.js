import { logger } from '../../utils/logger.js';
import { getDashboardStatsDao, getPendingTransactionsDao, getTransactionCalculationsDao, getTransactionRatiosDao } from './superAdminDao.js';

const getActiveUsersService = async (company_id) => {
  try {
    const stats = await getDashboardStatsDao(company_id);
    
    return {
      active_merchants: parseInt(stats.active_merchants) || 0,
      active_vendors: parseInt(stats.active_vendors) || 0,
      active_users: parseInt(stats.active_users) || 0,
      login_users_today: parseInt(stats.login_users_today) || 0,
      distinct_payment_link_users: parseInt(stats.distinct_payment_link_users) || 0
    };
  } catch (error) {
    logger.error('Error while fetching dashboard stats', error);
    throw error;
  }
};

const getPendingTransactionsService = async (company_id) => {
  try {
    const stats = await getPendingTransactionsDao(company_id);
    
    return {
      pending_payin_count: parseInt(stats.pending_payin_count) || 0,
      pending_payout_count: parseInt(stats.pending_payout_count) || 0,
      pending_settlement_count: parseInt(stats.pending_settlement_count) || 0,
      total_pending_transactions: (parseInt(stats.pending_payin_count) || 0) + 
                                 (parseInt(stats.pending_payout_count) || 0) + 
                                 (parseInt(stats.pending_settlement_count) || 0)
    };
  } catch (error) {
    logger.error('Error while fetching pending transactions', error);
    throw error;
  }
};

const getTransactionCalculationsService = async (company_id) => {
  try {
    const stats = await getTransactionCalculationsDao(company_id);
    
    const merchantPayinCommission = parseFloat(stats.merchant_total_payin_commission) || 0;
    const merchantPayoutCommission = parseFloat(stats.merchant_total_payout_commission) || 0;
    const merchantReversePayoutCommission = parseFloat(stats.merchant_total_reverse_payout_commission) || 0;
    const vendorPayinCommission = parseFloat(stats.vendor_total_payin_commission) || 0;
    const vendorPayoutCommission = parseFloat(stats.vendor_total_payout_commission) || 0;
    const vendorReversePayoutCommission = parseFloat(stats.vendor_total_reverse_payout_commission) || 0;

    return {
      // Merchant data (revenue for company)
      merchant_total_payin_amount: parseFloat(stats.merchant_total_payin_amount) || 0,
      merchant_total_payin_commission: merchantPayinCommission,
      merchant_total_payout_amount: parseFloat(stats.merchant_total_payout_amount) || 0,
      merchant_total_payout_commission: merchantPayoutCommission,
      merchant_total_reverse_payout_amount: parseFloat(stats.merchant_total_reverse_payout_amount) || 0,
      merchant_total_reverse_payout_commission: merchantReversePayoutCommission,

      // Vendor data (expense for company)
      vendor_total_payin_commission: vendorPayinCommission,
      vendor_total_payout_commission: vendorPayoutCommission,
      vendor_total_reverse_payout_commission: vendorReversePayoutCommission,

      // Calculated totals
      total_revenue: (merchantPayinCommission + merchantPayoutCommission + merchantReversePayoutCommission),
      total_expense: (vendorPayinCommission + vendorPayoutCommission + vendorReversePayoutCommission)
    };
  } catch (error) {
    logger.error('Error while fetching transaction calculations', error);
    throw error;
  }
};

const getTransactionRatiosService = async (company_id) => {
  try {
    const stats = await getTransactionRatiosDao(company_id);
    
    const totalPayinLinks = parseInt(stats.total_payin_links) || 0;
    const successfulPayins = parseInt(stats.successful_payins) || 0;
    const utrSubmissions = parseInt(stats.utr_submissions) || 0;

    // Calculate ratios as percentages
    const payinSuccessRate = totalPayinLinks > 0 
      ? ((successfulPayins / totalPayinLinks) * 100).toFixed(2)
      : '0.00';

    const utrSubmissionRate = totalPayinLinks > 0 
      ? ((utrSubmissions / totalPayinLinks) * 100).toFixed(2)
      : '0.00';

    return {
      total_payin_links: totalPayinLinks,
      successful_payins: successfulPayins,
      utr_submissions: utrSubmissions,
      payin_success_rate: `${payinSuccessRate}%`,
      utr_submission_rate: `${utrSubmissionRate}%`,
    };
  } catch (error) {
    logger.error('Error while fetching transaction ratios', error);
    throw error;
  }
};

export {
  getActiveUsersService,
  getPendingTransactionsService,
  getTransactionCalculationsService,
  getTransactionRatiosService,
};
