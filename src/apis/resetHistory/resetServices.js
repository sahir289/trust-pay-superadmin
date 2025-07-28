import { InternalServerError } from '../../utils/appErrors.js';
import {
  getBankResponseDao,
  updateBotResponseDao,
} from '../bankResponse/bankResponseDao.js';
import {
  getPayInUrlDao,
  getPayInUrlsDao,
  updatePayInUrlDao,
} from '../payIn/payInDao.js';
import {
  createResetHistoryDao,
  deleteResetHistoryDao,
  getResetHistoryBySearchDao,
  getResetHistoryDao,
} from './resetDao.js';
import { BadRequestError } from '../../utils/appErrors.js';
import { logger } from '../../utils/logger.js';
// import { notifyAdminsAndUsers } from '../../utils/notifyUsers.js';
const getResetHistoryService = async (
  id,
  page,
  limit,
  sortBy,
  sortOrder,
  startDate,
  endDate,
) => {
  try {
    // const pageNumber = parseInt(page, 10) || 1;
    // const pageSize = parseInt(limit, 10) || 10;
    const result = await getResetHistoryDao(
      { company_id: id },
      page,
      limit,
      sortBy,
      sortOrder,
      startDate,
      endDate,
    );
    return result;
  } catch (error) {
    logger.error('error getting while reset history', error);
    throw new InternalServerError('Error getting while reset history');
  }
};
const getResetHistoryBySearchService = async (filters) => {
  try {
    const pageNum = parseInt(filters.page);
    const limitNum = parseInt(filters.limit);

    // Validate pagination parameters
    if (isNaN(pageNum) || isNaN(limitNum) || pageNum < 1 || limitNum < 1) {
      throw new BadRequestError('Invalid pagination parameters');
    }

    // Process search terms
    const searchTerms = filters.search
      ? filters.search
          .split(',')
          .map((term) => term.trim())
          .filter((term) => term.length > 0)
      : [];

    if (searchTerms.length === 0) {
      throw new BadRequestError('Please provide valid search terms');
    }

    const offset = (pageNum - 1) * limitNum;

    // Determine columns based on role
    // const filterColumns =
    //   role === Role.MERCHANT
    //     ? merchantColumns.SETTLEMENT
    //     : role === Role.VENDOR
    //       ? vendorColumns.SETTLEMENT
    //       : columns.SETTLEMENT;

    // Call DAO function
    const data = await getResetHistoryBySearchDao(
      filters.company_id,
      searchTerms,
      limitNum,
      offset,
      // filterColumns,
    );

    return data;
  } catch (error) {
    logger.error('Error while fetching Payin by search', error);
    throw new InternalServerError(error.message);
  }
};

const createResetHistoryService = async (conn, payload) => {
  try {
    const result = await createResetHistoryDao(payload,conn);
    // await notifyAdminsAndUsers({
    //   conn,
    //   company_id: payload.company_id,
    //   message: `PayIn with merchant order id: ${merchant_order_id} has been reset.`,
    //   payloadUserId: payload.updated_by,
    //   actorUserId: payload.updated_by,
    //   category: 'Data Entries',
    // });
    return result;
  } catch (error) {
    logger.error('error getting while reset history', error);
    throw new InternalServerError('Error getting while reset history');
  }
};

const updateResetHistoryService = async (id, company_id) => {
  try {
    const payInData = await getPayInUrlDao({ merchant_order_id: id });
    // await sendResetEntryTelegramMessage(
    //   config?.telegramEntryResetChatId,
    //   payInData,
    //   config?.telegramBotToken,
    // );
    if (payInData?.status !== 'SUCCESS' && payInData?.status !== 'FAILED') {
      const utr = payInData.user_submitted_utr;
      const botRes = await getBankResponseDao({ utr: utr });

      let getallPayinDataByUtr;
      getallPayinDataByUtr = await getPayInUrlsDao({ user_submitted_utr: utr });

      if (getallPayinDataByUtr) {
        const hasSuccess = getallPayinDataByUtr.some(
          (item) => item.status === 'SUCCESS',
        );
        if (!hasSuccess && botRes?.id) {
          await updateBotResponseDao({ id: botRes?.id }, { is_used: false });
        }
      }
      // const result =
      await updatePayInUrlDao(
        { id: payInData?.id, company_id: company_id },
        {
          status: 'ASSIGNED',
          confirmed: null,
          payin_merchant_commission: null,
          payin_vendor_commission: null,
          user_submitted_utr: null,
          duration: null,
        },
      );
      return 'Transaction Reset Successfully';
    } else {
      return 'Transaction status is SUCCESS or FAILED, no update applied';
    }
  } catch (error) {
    logger.error('error getting while reset history', error);
    throw new InternalServerError('Error getting while reset history');
  }
};
const deleteResetHistoryService = async (id) => {
  try {
    const result = await deleteResetHistoryDao(id, { is_obsolete: true });
    return result;
  } catch (error) {
    logger.error('error getting while reset history', error);
    throw new InternalServerError('Error getting while reset history');
  }
};

export {
  getResetHistoryService,
  createResetHistoryService,
  updateResetHistoryService,
  getResetHistoryBySearchService,
  deleteResetHistoryService,
};
