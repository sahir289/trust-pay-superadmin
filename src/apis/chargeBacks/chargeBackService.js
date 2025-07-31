import { InternalServerError } from '../../utils/appErrors.js';
import {
  beginTransaction,
  commit,
  getConnection,
  rollback,
} from '../../utils/db.js';
import {
  createChargeBackDao,
  deleteChargeBackDao,
  getChargeBackDao,
  updateChargeBackDao,
  getChargeBacksBySearchDao,
  getChargebackByIdDao,
  getAllChargeBackDao,
} from './chargeBackDao.js';
import {
  columns,
  merchantColumns,
  Role,
  vendorColumns,
} from '../../constants/index.js';
import { BadRequestError } from '../../utils/appErrors.js';
import { filterResponse } from '../../helpers/index.js';
import { getCalculationforCronDao } from '../calculation/calculationDao.js';
import { updateCalculationBalanceDao } from '../calculation/calculationDao.js';
import { logger } from '../../utils/logger.js';
import { getUserHierarchysDao } from '../userHierarchy/userHierarchyDao.js';
// import { getVendorsDao,updateVendorDao } from '../vendors/vendorDao.js';
import { getPayInDaoByCode } from '../payIn/payInDao.js';
import { getCompanyDao, updateCompanyDao } from '../company/companyDao.js';
// import { notifyAdminsAndUsers } from '../../utils/notifyUsers.js';
const createChargeBackService = async (
  payload,
  PayinDetails,
  role,
  company_id,
  user_id,
) => {
  let conn;
  try {
    // const filterColumns =
    //   role === Role.MERCHANT
    //     ? merchantColumns.CHARGE_BACK
    //     : role === Role.VENDOR
    //       ? vendorColumns.CHARGE_BACK
    //       : columns.CHARGE_BACK;
    conn = await getConnection();
    await beginTransaction(conn); // Start a transaction
    payload.vendor_user_id = PayinDetails[0].vendor_user_id;
    payload.merchant_user_id = PayinDetails[0].merchant_user_id;
    payload.payin_id = PayinDetails[0].payin_id;
    payload.bank_acc_id = PayinDetails[0].bank_acc_id;
    payload.created_by = user_id;
    payload.updated_by = user_id;
    payload.company_id = company_id;
    // const merchantOrderId = PayinDetails[0].merchant_order_id;
    delete payload.merchant_order_id;
    ///create chargeback
    const data = await createChargeBackDao(payload);
    // update calculations
    // update merchant calculations
    let MerchantuserId = data.merchant_user_id;
    // const merchantData = await getMerchantsDao({ user_id: MerchantuserId });
    const merchantCalculation = await getCalculationforCronDao(MerchantuserId);
    // await updateMerchantDao(
    //       { user_id: MerchantuserId },
    //       { balance: merchantData[0].balance - payload.amount },
    //       conn,
    //     );
    let amount = Number(payload.amount);
    let merchantId = merchantCalculation[0].id;
    await updateCalculationBalanceDao(
      { id: merchantId },
      {
        total_chargeback_count: 1,
        total_chargeback_amount: amount,
        current_balance: -amount,
        net_balance: -amount,
      },
      conn,
    );
    // update vendor calculations
    let VendorUserId = data.vendor_user_id;
    // const vendorData = await getVendorsDao({ user_id: VendorUserId });
    // await updateVendorDao(
    //       { user_id: VendorUserId },
    //       { balance: vendorData[0].balance - payload.amount },
    //       conn
    //      )
    const vendorCalculation = await getCalculationforCronDao(VendorUserId);
    let VendorId = vendorCalculation[0].id;
    await updateCalculationBalanceDao(
      { id: VendorId },
      {
        total_chargeback_count: 1,
        total_chargeback_amount: amount,
        current_balance: -amount,
        net_balance: -amount,
      },
      conn,
    );
    await commit(conn); // Commit the transaction
    // await notifyAdminsAndUsers({
    //   conn,
    //   company_id: payload.company_id,
    //   message: `The new ChargeBack of amount ${payload.amount} against Merchant Order ID ${merchantOrderId} has been created.`,
    //   payloadUserId: payload.vendor_user_id,
    //   actorUserId: payload.merchant_user_id,
    //   category: 'ChargeBack',
    // });
    return data;
  } catch (error) {
    logger.error('Error while creating ChargeBack', error);
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

const getChargeBacksService = async (
  filters,
  role,
  page,
  limit,
  user_id,
  sortOrder = 'DESC',
  // designation,
) => {
  try {
    // Determine columns based on role
    const filterColumns =
      role === Role.MERCHANT
        ? merchantColumns.CHARGE_BACK
        : role === Role.VENDOR
          ? vendorColumns.CHARGE_BACK
          : columns.CHARGE_BACK;

    if (role == Role.MERCHANT) {
      filters.merchant_user_id = [user_id];
    }
    if (role == Role.VENDOR) {
      filters.vendor_user_id = [user_id];
    }

    if (role === Role.MERCHANT) {
      // user_id is unique
      const userHierarchys = await getUserHierarchysDao({ user_id });
      if (userHierarchys || userHierarchys.length > 0) {
        const userHierarchy = userHierarchys[0];

        if (
          userHierarchy?.config ||
          Array.isArray(userHierarchy?.config?.siblings?.sub_merchants)
        ) {
          filters.merchant_user_id = [
            ...filters.merchant_user_id,
            ...(userHierarchy?.config?.siblings?.sub_merchants ?? []),
          ];
        }
      }
    }

    // Parse and validate pagination parameters
    const pageNumber =
      page === 'no_pagination'
        ? null
        : Math.max(1, parseInt(String(page), 10) || 1);
    const pageSize =
      limit === 'no_pagination'
        ? null
        : Math.max(1, Math.min(100, parseInt(String(limit), 10) || 10)); // Added upper limit

    // Call DAO with all required parameters
    const chargeBacks = await getAllChargeBackDao(
      filters,
      pageNumber,
      pageSize,
      'sno',
      sortOrder,
      filterColumns,
      role,
    );

    // logger.info('Fetched ChargeBacks successfully', {
    //   role,
    //   page: pageNumber,
    //   limit: pageSize,
    //   filterCount: Object.keys(filters).length,
    // });

    return chargeBacks;
  } catch (error) {
    logger.error('Error while fetching ChargeBacks', {
      error: error instanceof Error ? error.message : String(error),
      role,
      filters,
      page,
      limit,
    });
    throw new InternalServerError(
      error instanceof Error ? error.message : 'Failed to fetch chargebacks',
    );
  }
};
const getChargeBacksBySearchService = async (
  filters,
  role,
  page,
  limit,
  user_id,
  sortOrder = 'DESC',
  // designation,
) => {
  try {
    // Determine columns based on role
    const filterColumns =
      role === Role.MERCHANT
        ? merchantColumns.CHARGE_BACK
        : role === Role.VENDOR
          ? vendorColumns.CHARGE_BACK
          : columns.CHARGE_BACK;

    if (role == Role.MERCHANT) {
      filters.merchant_user_id = [user_id];
    }
    if (role == Role.VENDOR) {
      filters.vendor_user_id = [user_id];
    }

    if (role === Role.MERCHANT) {
      // user_id is unique
      const userHierarchys = await getUserHierarchysDao({ user_id });
      if (userHierarchys || userHierarchys.length > 0) {
        const userHierarchy = userHierarchys[0];

        if (
          userHierarchy?.config ||
          Array.isArray(userHierarchy?.config?.siblings?.sub_merchants)
        ) {
          filters.merchant_user_id = [
            ...filters.merchant_user_id,
            ...(userHierarchy?.config?.siblings?.sub_merchants ?? []),
          ];
        }
      }
    }

    // Parse and validate pagination parameters
    const pageNumber =
      page === 'no_pagination'
        ? null
        : Math.max(1, parseInt(String(page), 10) || 1);
    const pageSize =
      limit === 'no_pagination'
        ? null
        : Math.max(1, Math.min(100, parseInt(String(limit), 10) || 10)); // Added upper limit
    let searchTerms;
    if (filters.search) {
       searchTerms = filters.search
        .split(',')
        .map((term) => term.trim())
        .filter((term) => term.length > 0);
    }
   
    // Call DAO with all required parameters
    const chargeBacks = await getChargeBacksBySearchDao(
      filters,
      pageNumber,
      pageSize,
      'sno',
      sortOrder,
      filterColumns,
      role,
      searchTerms,
    );

    // logger.info('Fetched ChargeBacks successfully', {
    //   role,
    //   page: pageNumber,
    //   limit: pageSize,
    //   filterCount: Object.keys(filters).length,
    // });

    return chargeBacks;
  } catch (error) {
    logger.error('Error while fetching chargeback by search', error);
    throw new InternalServerError(error.message);
  }
};

const blockChargebackUserService = async (ids) => {
  let conn;
  try {
    conn = await getConnection();
    await beginTransaction(conn);
    const id = ids.id;
    const chargebackdata = await getChargeBackDao(
      { id },
      1,
      10,
      'created_at',
      'DESC',
    );
    const payinId = chargebackdata[0].payin_id;
    const companyId = ids.company_id;
    const payindata = await getPayInDaoByCode({
      id: payinId,
      company_id: companyId,
    });
    const userIp = payindata[0].config?.user?.user_ip;
    const company = await getCompanyDao({ id: companyId });
    const userId = payindata[0].user;
    const existingBlockedUsers = company[0]?.config?.blocked_users || [];
    const alreadyExists = existingBlockedUsers.some(
      (entry) => entry.userId === userId && entry.user_ip === userIp,
    );
    let merchantDetails;
    let updatedBlockedUsers;
    if (alreadyExists) {
     const updatedBlockedUsers = existingBlockedUsers.filter(
        (entry) => !(entry.userId === userId && entry.user_ip === userIp),
      );
      const updatedConfig = {
        ...company[0].config,
        blocked_users: updatedBlockedUsers,
      };
      merchantDetails = await updateCompanyDao(
        { id: companyId },
        { config: updatedConfig },
      );
     
    } else {
      updatedBlockedUsers = [
        ...existingBlockedUsers,
        { userId: userId, user_ip: userIp },
      ];
      const updatedConfig = {
        ...company[0].config,
        blocked_users: updatedBlockedUsers,
      };

      merchantDetails = await updateCompanyDao(
        { id: companyId },
        { config: updatedConfig },
      );
      await updateChargeBackDao(
        { id: chargebackdata[0].id },
        { config: updatedConfig }
      );
    }

    await commit(conn);
    // await notifyAdminsAndUsers({
    //   conn,
    //   company_id: companyId,
    //   message: `The user with ID ${userId} has been Blocked for ChargeBacks against Merchant Order Id ${payindata[0].merchant_order_id}.`,
    //   payloadUserId: payload.updated_by,
    //   actorUserId: payload.updated_by,
    //   category: 'ChargeBack',
    // });
    return merchantDetails;
  } catch (error) {
    if (conn) {
      try {
        await rollback(conn);
      } catch (rollbackError) {
        logger.error('Error during transaction rollback', rollbackError);
      }
      throw error;
    }
    logger.error('Error while updating ChargeBack', error);
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

const updateChargeBackService = async (ids, payload) => {
  let conn;
  try {
    const chargebackdata = await getChargebackByIdDao({
      id: ids.id,
      company_id: ids.company_id,
    });
    const chargeBack = chargebackdata[0];
    const today = new Date().toISOString().split('T')[0];
    const createdAtDate = new Date(chargeBack.created_at)
      .toISOString()
      .split('T')[0];

    if (createdAtDate !== today) {
      throw new BadRequestError('Chargeback data must be from today');
    }
    conn = await getConnection();
    await beginTransaction(conn);
    const data = await updateChargeBackDao(ids, payload);
    let MerchantuserId = data.merchant_user_id;
    const merchantCalculation = await getCalculationforCronDao(MerchantuserId);
    let amount = Number(data.amount - chargeBack.amount);
    if (data.amount > chargeBack.amount) {
      amount = Math.abs(amount);
    } else {
      amount = -Math.abs(amount);
    }
    let merchantId = merchantCalculation[0].id;
    await updateCalculationBalanceDao(
      { id: merchantId },
      {
        total_chargeback_count: 1,
        total_chargeback_amount: amount,
        current_balance: -amount,
        net_balance: -amount,
      },
      conn,
    );
    // update vendor calculations
    let VendorUserId = data.vendor_user_id;
    const vendorCalculation = await getCalculationforCronDao(VendorUserId);
    let VendorId = vendorCalculation[0].id;
    await updateCalculationBalanceDao(
      { id: VendorId },
      {
        total_chargeback_count: 1,
        total_chargeback_amount: amount,
        current_balance: -amount,
        net_balance: -amount,
      },
      conn,
    );
    await commit(conn); // Commit the transaction
    return data;
  } catch (error) {
    if (conn) {
      try {
        await rollback(conn); // Rollback the transaction in case of error
      } catch (rollbackError) {
        logger.error('Error during transaction rollback', rollbackError);
      }
    }
    logger.error('Error while updating ChargeBack', error);
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

const deleteChargeBackService = async (ids, payload, role) => {
  let conn;
  try {
    const filterColumns =
      role === Role.MERCHANT
        ? merchantColumns.CHARGE_BACK
        : role === Role.VENDOR
          ? vendorColumns.CHARGE_BACK
          : columns.CHARGE_BACK;

    conn = await getConnection();
    await beginTransaction(conn); // Start a transaction

    const data = await deleteChargeBackDao(ids, payload); // Adjust DAO call for delete
    await commit(conn); // Commit the transaction

    const finalResult = filterResponse(data, filterColumns);
    return finalResult;
  } catch (error) {
    if (conn) {
      try {
        await rollback(conn); // Rollback the transaction in case of error
      } catch (rollbackError) {
        logger.error('Error during transaction rollback', rollbackError);
      }
    }
    logger.error('Error while deleting ChargeBack', error);
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

export {
  createChargeBackService,
  getChargeBacksService,
  getChargeBacksBySearchService,
  updateChargeBackService,
  deleteChargeBackService,
  blockChargebackUserService,
};
