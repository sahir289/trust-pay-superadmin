// Importing DAO functions for database operations
import {
  createCalculationDao,
  updateCalculationDao,
  deleteCalculationDao,
  getCalculationsSumDao,
} from './calculationDao.js';

// Importing transaction wrapper for handling database transactions
import {
  columns,
  merchantColumns,
  Role,
  vendorColumns,
} from '../../constants/index.js';
import { filterResponse } from '../../helpers/index.js';
// import { InternalServerError } from '../../utils/appErrors.js';
import { logger } from '../../utils/logger.js';
import { getMerchantsDao } from '../../apis/merchants/merchantDao.js';
import { getPayInUrlsDao } from '../../apis/payIn/payInDao.js';
import { getConnection } from '../../utils/db.js';
import dayjs from 'dayjs';
import { BadRequestError } from '../../utils/appErrors.js';

// Service to fetch calculation data
const getCalculationService = async (filters, role) => {
  try {
    // Validate required fields
    if (!filters || !role) {
      throw new BadRequestError('Missing required parameters');
    }
    const result = await getCalculationsSumDao({
      ...filters,
      role,
    });

    return (
      result || {
        vendor: [],
        merchant: [],
        netBalance: {
          vendor: 0,
          merchant: 0,
        },
        merchantTotalCalculations: {},
        vendorTotalCalculations: {},
      }
    );
  } catch (error) {
    logger.error('Error while fetching calculation data:', 'error', error);
    throw error;
  }
};

// Service to create a new calculation record
const createCalculationService = async (conn, payload, role) => {
  try {
    const filterColumns =
      role === Role.MERCHANT
        ? merchantColumns.CALCULATION
        : role === Role.VENDOR
          ? vendorColumns.CALCULATION
          : columns.CALCULATION;
    const data = await createCalculationDao(conn, payload); // Ensuring transaction safety
    const finalResult = filterResponse(data, filterColumns);
    return finalResult;
  } catch (error) {
    logger.error('Error while creating calculation record:', error);
    throw error;
  }
};

// Service to update an existing calculation record
const updateCalculationService = async (conn, filters, payload, role) => {
  try {
    const filterColumns =
      role === Role.MERCHANT
        ? merchantColumns.CALCULATION
        : role === Role.VENDOR
          ? vendorColumns.CALCULATION
          : columns.CALCULATION;
    const data = await updateCalculationDao(filters, payload, conn);
    const finalResult = filterResponse(data, filterColumns);
    return finalResult;
  } catch (error) {
    logger.error('Error while updating calculation record:', error);
    throw error;
  } finally {
    if (conn) {
      try {
        conn.release();
      } catch (releaseError) {
        logger.error('Error while releasing the connection:', releaseError);
      }
    }
  }
};

// Service to mark a calculation record as obsolete (soft delete)
const deleteCalculationService = async (conn, id, role) => {
  try {
    const filterColumns =
      role === Role.MERCHANT
        ? merchantColumns.CALCULATION
        : role === Role.VENDOR
          ? vendorColumns.CALCULATION
          : columns.CALCULATION;
    const userData = { is_obsolete: true };
    const data = await deleteCalculationDao(conn, id, userData);
    const finalResult = filterResponse(data, filterColumns);
    return finalResult;
  } catch (error) {
    logger.error('Error while deleting calculation record:', error);
    throw error;
  }
};

const calculateSuccessRatios = async (merchants, date, user_id) => {
  try {
    const targetMerchant = merchants.find((m) => m.user_id === user_id);
    if (!targetMerchant) {
      logger.warn(`No merchant found for user_id: ${user_id}`);
      return null;
    }

    const selectedDate = date ? dayjs(date) : dayjs();
    const isCurrentDate = selectedDate.isSame(dayjs(), 'day');

    const intervals = isCurrentDate
      ? [
          { label: 'Last 5m', duration: 5 * 60 * 1000 },
          { label: 'Last 15m', duration: 15 * 60 * 1000 },
          { label: 'Last 30m', duration: 30 * 60 * 1000 },
          { label: 'Last 1h', duration: 60 * 60 * 1000 },
          { label: 'Last 3h', duration: 3 * 60 * 60 * 1000 },
          { label: 'Last 24h', duration: 24 * 60 * 60 * 1000 },
        ]
      : [
          { label: '04:00', start: 0, end: 4 },
          { label: '08:00', start: 4, end: 8 },
          { label: '12:00', start: 8, end: 12 },
          { label: '16:00', start: 12, end: 16 },
          { label: '20:00', start: 16, end: 20 },
          { label: '24:00', start: 20, end: 24 },
        ];

    // Modified: Use merchant_id instead of user_id
    const allPayins = await getPayInUrlsDao({
      merchant_id: targetMerchant.id,
    });

    // Process only the target merchant's transactions
    const merchantTransactions = allPayins.map((payin) => ({
      updated_at: new Date(payin.updated_at),
      status: payin.status,
      user_submitted_utr: payin.user_submitted_utr,
    }));

    const stats = intervals.map((interval) => {
      let filteredTx;

      if (isCurrentDate) {
        const startTime = new Date(dayjs().valueOf() - interval.duration);
        filteredTx = merchantTransactions.filter(
          (tx) => tx.updated_at >= startTime,
        );
      } else {
        const startTime = selectedDate
          .hour(interval.start)
          .startOf('hour')
          .toDate();
        const endTime = selectedDate
          .hour(interval.end)
          .startOf('hour')
          .toDate();
        filteredTx = merchantTransactions.filter(
          (tx) => tx.updated_at >= startTime && tx.updated_at < endTime,
        );
      }

      const total = filteredTx.length;
      const success = filteredTx.filter((tx) => tx.status === 'SUCCESS').length;
      const utrSubmitted = filteredTx.filter(
        (tx) => tx.user_submitted_utr?.length > 0,
      ).length;

      return {
        interval: interval.label,
        total,
        success,
        utrSubmitted,
        successRatio: total === 0 ? 0 : (success / total) * 100,
        utrRatio: total === 0 ? 0 : (utrSubmitted / total) * 100,
      };
    });

    return [
      {
        merchantCode: targetMerchant.code,
        stats,
        date: selectedDate.format('YYYY-MM-DD'),
      },
    ];
  } catch (error) {
    logger.error('Error calculating success ratios:', error);
    throw error;
  }
};

const calculateSuccessRatiosService = async (date, user_ids) => {
  let conn;
  try {
    conn = await getConnection();

    // Get merchants data using user_ids
    const merchants = await getMerchantsDao({
      user_id: user_ids,
    });

    // Process each merchant in parallel using user_ids
    const successRatiosPromises = user_ids.map(async (userId) => {
      return calculateSuccessRatios(merchants, date, userId);
    });

    const results = await Promise.all(successRatiosPromises);
    const successRatios = results.filter(Boolean).flat();

    return { successRatios };
  } catch (error) {
    logger.error('Error in calculateSuccessRatiosService:', error);
    throw error;
  } finally {
    if (conn) {
      conn.release();
    }
  }
};

// Exporting services for use in other modules
export {
  calculateSuccessRatiosService,
  getCalculationService,
  createCalculationService,
  updateCalculationService,
  deleteCalculationService,
};
