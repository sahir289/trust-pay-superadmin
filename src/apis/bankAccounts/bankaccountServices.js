import { Role } from '../../constants/index.js';
import { BadRequestError, InternalServerError } from '../../utils/appErrors.js';
import {
  beginTransaction,
  commit,
  getConnection,
  rollback,
} from '../../utils/db.js';
import { stringifyJSON } from '../../utils/index.js';
import { logger } from '../../utils/logger.js';
// import { notifyAdminsAndUsers } from '../../utils/notifyUsers.js';
import { deactivateBank } from '../../utils/sockets.js';
import {
  // getBankResponseDaoAll,
  updateBotResponseDao,
  getBankResponsesforFreeze,
} from '../bankResponse/bankResponseDao.js';
// import { getCalculationDao } from '../calculation/calculationDao.js';
import { getUserHierarchysDao } from '../userHierarchy/userHierarchyDao.js';
import {
  getBankaccountDao,
  createBankaccountDao,
  updateBankaccountDao,
  deleteBankaccountDao,
  getBankAccountDaoNickName,
  getBankAccountsBySearchDao,
  getAllBankaccountDao,
} from './bankaccountDao.js';

const getBankaccountService = async (
  filters,
  company_id,
  role,
  page,
  limit,
  user_id,
  designation,
) => {
  try {
    if (role == Role.VENDOR) {
      filters.user_id = [user_id];
    }
    const userHierarchys = await getUserHierarchysDao({ user_id });
    if (designation == Role.VENDOR_OPERATIONS) {
      const parentID = userHierarchys[0]?.config?.parent;
      if (parentID) {
        filters.user_id = [parentID];
      }
    }

    const pageNumber = parseInt(page, 10) || 1;
    const pageSize = parseInt(limit, 10) || 10;
    return await getAllBankaccountDao(
      { company_id, ...filters },
      pageNumber,
      pageSize,
    );
  } catch (error) {
    logger.error('error getting while  getting banks', error);
    throw error;
  }
};

const getBankAccountBySearchService = async (
  filters,
  role,
  page,
  limit,
  user_id,
  designation,
  search
) => {
  try {
    if (role == Role.VENDOR) {
      filters.user_id = [user_id];
    }
    const userHierarchys = await getUserHierarchysDao({ user_id });
    if (designation == Role.VENDOR_OPERATIONS) {
      const parentID = userHierarchys[0]?.config?.parent;
      if (parentID) {
        filters.user_id = [parentID];
      }
    }

    const pageNumber = parseInt(page, 10) || 1;
    const pageSize = parseInt(limit, 10) || 10;
    let searchTerms;
    if (search) {
      searchTerms = search
        .split(',')
        .map((term) => term.trim())
        .filter((term) => term.length > 0);
    }
    const banks = await getBankAccountsBySearchDao(
      { ...filters },
      pageNumber,
      pageSize,
      searchTerms,
    );
    return banks;
  } catch (error) {
    logger.error('error getting while getting check utr by search', error);
    throw new InternalServerError(error.message);
  }
};

const getBankaccountServiceNickName = async (
  company_id,
  type,
  role,
  user_id,
  designation,
  user,
) => {
  let conn;
  try {
    conn = await getConnection();
    await beginTransaction(conn);

    let filters = {};
    if (role == Role.VENDOR) {
      filters.user_id = [user_id];
    }
    if (user) {
      filters.user_id = [user];
    }
    const userHierarchys = await getUserHierarchysDao({ user_id });
    if (designation == Role.VENDOR_OPERATIONS) {
      const parentID = userHierarchys[0]?.config?.parent;
      if (parentID) {
        filters.user_id = [parentID];
      }
    }

    const result = await getBankAccountDaoNickName(
      conn,
      company_id,
      type,
      filters,
    );
    await commit(conn);
    return result;
  } catch (error) {
    if (conn) {
      try {
        await rollback(conn);
      } catch (rollbackError) {
        logger.error('Error during transaction rollback', rollbackError);
      }
    }
    throw error;
  } finally {
    if (conn) {
      try {
        conn.release();
      } catch (releaseError) {
        logger.error('Error while releasing the connection', releaseError);
      }
    }
  }
};

const createBankaccountService = async (
  conn,
  payload,
  designation,
  user_id,
  // company_id,
) => {
  try {
    //child add bankaccount for its parent
    if (designation === Role.VENDOR_OPERATIONS) {
      const childHierarchy = await getUserHierarchysDao({ user_id });
      const parentUserId = childHierarchy[0].config.parent;
      payload.user_id = parentUserId;
    }
    const result = await createBankaccountDao(payload);
    // await notifyAdminsAndUsers({
    //   conn,
    //   company_id: company_id,
    //   message: `A new ${payload.bank_used_for} bank account with nick name ${payload.nick_name} has been created.`,
    //   payloadUserId: payload.user_id,
    //   actorUserId: user_id,
    //   category: 'Bank Account',
    // });
    return result;
  } catch (error) {
    logger.error('error getting while  creating banks', error);
    throw new BadRequestError('Error getting while  creating banks');
  }
};

const updateBankaccountService = async (
  conn,
  ids,
  payload,
  role,
  // company_id,
  // user_id,
) => {
  try {
    let result;

    const bank = await getBankaccountDao({
      id: ids.id,
      company_id: ids.company_id,
    });

    if (payload?.is_enabled === false) {
      // Clear merchants array when bank is disabled
      payload = {
        ...payload,
        config: {
          ...payload.config,
          merchants: [],
        },
      };
    }

    //show notification only to vendor whose bank status is updated
    let userId = bank[0].user_id;
    const userHierarchys = await getUserHierarchysDao({ user_id: userId });
    if (role === Role.VENDOR_OPERATIONS) {
      userId = userHierarchys[0]?.config?.parent;
    }
    if (
      Object.keys(payload).length === 1 &&
      payload.latest_balance &&
      bank[0].is_enabled &&
      (bank[0].config?.max_limit && bank[0].config?.max_limit !== 0)
    ) {
      if (payload.latest_balance >= bank[0].config?.max_limit) {
        payload.is_enabled = false;
        deactivateBank(bank[0].nick_name, ids.id, userId);
        // await notifyAdminsAndUsers({
        //   conn,
        //   company_id: company_id,
        //   message: `The Bank with the ${bank[0].nick_name} id Deactivate`,
        //   payloadUserId: user_id,
        //   actorUserId: user_id,
        //   category: 'Bank Account',
        //   subCategory: null,
        //   additionalRecipients: [],
        //   role,
        // });
      } else if (payload.latest_balance === bank[0].config?.max_limit) {
        deactivateBank(bank[0].nick_name, ids.id, true);
        // await notifyAdminsAndUsers({
        //   conn,
        //   company_id: company_id,
        //   message: `The Bank with the ${bank[0].nick_name} will be Deactivate soon as the Balance will soon reach the Daily Limit`,
        //   payloadUserId: user_id,
        //   actorUserId: user_id,
        //   category: 'Bank Account',
        //   subCategory: null,
        //   additionalRecipients: [],
        //   role,
        // });
      }
    }
    delete payload.latest_balance;

    //added merchant_added key in config which contains date on which merchant is added along with its id
    if (payload?.config?.merchant_added) {
      const existingMerchantDetails = bank?.config?.merchant_added || {};
      const newMerchantDetails = {};

      for (const key in payload.config.merchant_added) {
        const merchantId = key.replace(/^\[?"?|"?\]$/g, '');
        newMerchantDetails[merchantId] = payload.config.merchant_added[key];
      }

      payload.config.merchant_added = {
        ...existingMerchantDetails,
        ...newMerchantDetails,
      };
    }

    const payloadData = JSON.parse(stringifyJSON(payload));
    if (Object.keys(payload).length > 0) {
      result = await updateBankaccountDao(
        { id: ids.id, company_id: ids.company_id },
        payload,
        conn,
      );
    }
    if (payloadData?.config?.is_freeze === true) {
      const bankResponse = await   getBankResponsesforFreeze({
        bank_id: ids.id,
        is_used: false,
        status: '/success',
      });
      if (bankResponse.length > 0) {
        for (let i = 0; i < bankResponse.length; i++) {
          for (let i = 0; i < bankResponse.length; i++) {
            await updateBotResponseDao(bankResponse[i].id, {
              status: '/freezed',
            },conn);
          }
        }
      }
    }
    if (payloadData?.config?.is_freeze === false) {
      const bankResponse = await getBankResponsesforFreeze({
        bank_id: ids.id,
        is_used: false,
        status: '/freezed',
      });
      if (bankResponse.length > 0) {
        for (let i = 0; i < bankResponse.length; i++) {
          await updateBotResponseDao(
            bankResponse[i].id,
            {
              status: '/success',
            },
            conn,
          );
        }
      }
    }
    // if (role !== Role.BOT) {
    //   await notifyAdminsAndUsers({
    //     conn,
    //     company_id: company_id,
    //     message: `The bank account with nick name ${bank[0].nick_name} has been updated.`,
    //     payloadUserId: user_id,
    //     actorUserId: user_id,
    //     category: 'Bank Account',
    //   });
    // }
    return result;
  } catch (error) {
    logger.error('error getting while  updating banks', error);
    throw error;
  }
};

const deleteBankaccountService = async (conn, ids, user_id) => {
  try {
    const payload = { is_obsolete: true, updated_by: user_id };
    const result = await deleteBankaccountDao(
      conn,
      { id: ids.id, company_id: ids.company_id },
      payload,
    );
    // await notifyAdminsAndUsers({
    //   conn,
    //   company_id: ids.company_id,
    //   message: `Bank with nick name ${result.nick_name} has been deleted.`,
    //   payloadUserId: user_id,
    //   actorUserId: user_id,
    //   category: 'Bank Account',
    // });
    return result;
  } catch (error) {
    logger.error('error getting while deleting banks', error);
    throw new BadRequestError('Error getting while  deleting banks');
  }
};

export {
  getBankaccountService,
  getBankAccountBySearchService,
  createBankaccountService,
  updateBankaccountService,
  deleteBankaccountService,
  getBankaccountServiceNickName,
};
