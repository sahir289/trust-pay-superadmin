/* eslint-disable no-useless-escape */
import {
  BadRequestError,
  // InternalServerError,
  NotFoundError,
} from '../../utils/appErrors.js';
import dayjs from 'dayjs';
import { merchantPayinCallback } from '../../callBacksAndWebHook/merchantCallBacks.js';
import {
  getBankResponseDao,
  createBankResponseDao,
  getBankMessageDao,
  updateBotResponseDao,
  getBankResponseDaoAll,
  updateBankResponseDao,
  getClaimResponseDao,
  getBankResponseBySearchDao,
  resetBankResponseDao,
} from './bankResponseDao.js';
import { logger } from '../../utils/logger.js';
import {
  getBankaccountDao,
  updateBankaccountDao,
} from '../bankAccounts/bankaccountDao.js';
import { getPayInUrlsDao, updatePayInUrlDao } from '../payIn/payInDao.js';
import { getMerchantsDao } from '../merchants/merchantDao.js';
import { calculateCommission } from '../../utils/calculation.js';
import { getVendorsDao, updateVendorDao } from '../vendors/vendorDao.js';
import { newTableEntry } from '../../utils/sockets.js';
import {
  columns,
  merchantColumns,
  Role,
  Status,
  tableName,
  vendorColumns,
} from '../../constants/index.js';
import {
  getAllCalculationforCronDao,
  getCalculationforCronDao,
  updateCalculationBalanceDao,
} from '../calculation/calculationDao.js';
import {
  beginTransaction,
  commit,
  getConnection,
  rollback,
} from '../../utils/db.js';
import { filterResponse } from '../../helpers/index.js';
// import { notifyNewTableEntry } from '../../utils/sockets.js';
import { updateBankaccountService } from '../bankAccounts/bankaccountServices.js';
import PDFParser from 'pdf2json';
import {  calculateDuration } from '../../helpers/index.js';
// import { notifyAdminsAndUsers } from '../../utils/notifyUsers.js';

const createBankResponseService = async (
  payload,
  companyId,
  role,
  name,
  // user_id,
) => {
  try {
    const filterColumns =
      role === Role.MERCHANT
        ? merchantColumns.BANK_RESPONSE
        : role === Role.VENDOR
          ? vendorColumns.BANK_RESPONSE
          : columns.BANK_RESPONSE;

    const splitData = payload.split(' ');
    const amount = parseFloat(splitData[0]);
    const upi_short_code = splitData.length > 1 ? splitData[1] : '';
    const utr = splitData[2];
    const bank_id = splitData[3];
    const from_UI = splitData[4];
    let vendor;

    // Early validation
    const isValidAmount = amount >= 1 && amount <= 500000;
    if (!isValidAmount) {
      throw new BadRequestError(`amount must be between 1 and 500000`);
    }

    // UTR validation
    const validateUTR = (utr, from_UI) => {
      if (!from_UI) return true;
      const validSeparators = [',', ';', '|'];
      const hasSeparators = validSeparators.some((sep) => utr.includes(sep));
      if (hasSeparators) {
        const utrArray = utr
          .split(/[,;|]/)
          .map((u) => u.trim())
          .filter((u) => u);
        return !utrArray.some((u) => !/^[a-zA-Z0-9]+$/.test(u));
      }
      return /^[a-zA-Z0-9]+$/.test(utr);
    };

    if (!validateUTR(utr, from_UI)) {
      return { message: 'UTRs can only contain alphanumeric characters.' };
    }

    const created_by = name || 'Bank Response';
    const updated_by = name || 'Bank Response';
    const company_id = companyId;
    const isValidAmountCode = !!(
      upi_short_code &&
      upi_short_code !== 'nil' &&
      upi_short_code.length === 5
    );

    const acceptedStatus = [
      Status.SUCCESS,
      Status.DISPUTE,
      Status.BANK_MISMATCH,
      Status.FAILED,
      Status.DUPLICATE,
    ];
    if(upi_short_code!=='undefined' && upi_short_code!=='nil' && !isValidAmountCode) {
      throw new BadRequestError(`Please Enter valid Amount Code!`);
    }
    
    let utrAlreadyExist;
    if (isValidAmountCode) {
      utrAlreadyExist = await getBankResponseDao(
        { upi_short_code, company_id },
        null,
        null,
        null,
        null,
        filterColumns,
      );
      if (!utrAlreadyExist) {
        utrAlreadyExist = await getBankResponseDao(
          { utr, company_id },
          null,
          null,
          null,
          null,
          filterColumns,
        );
      }

    } else {
      utrAlreadyExist = await getBankResponseDao(
        { utr, company_id },
        null,
        null,
        null,
        null,
        filterColumns,
      );
    }

    const isRepeated = utrAlreadyExist;

    const updatedData = {
      status: isRepeated ? '/repeated' : '/success',
      amount,
      utr,
      bank_id,
      // config: { from_UI },
      is_used: 'false',
      created_by,
      updated_by,
      company_id,
      ...(isValidAmountCode && { upi_short_code }),
    };

    // if (isValidAmountCode) {
    //   const isAmountCodeExist = await getBankResponseDao(
    //     { upi_short_code, company_id },
    //     null,
    //     null,
    //     null,
    //     null,
    //     filterColumns,
    //   );
    //   if (isAmountCodeExist) {
    //     return { message: 'Amount code already exist' };
    //   }
    // }

    // const sendNotification = async (status, data) => {
    //   await notifyNewTableEntry(tableName.BANK_RESPONSE, status, data);
    // };

    let botRes;

    // Use a transaction for all DB operations for a single entry
    let localConn;
    let shouldRelease = false;
    try {
      localConn = await getConnection();
      shouldRelease = true;
      await beginTransaction(localConn);

      botRes = await createBankResponseDao(localConn, updatedData);
      // await sendNotification(updatedData.status.replace('/', ''), {
      //   id: botRes.id,
      //   utr: botRes.utr,
      //   amount: botRes.amount,
      //   bank_id: botRes.bank_id,
      //   company_id: botRes.company_id,
      //   created_by: botRes.created_by,
      // });

      if (updatedData.status === '/repeated') {
        await commit(localConn);
        // if (shouldRelease) localConn.release();
        if (isValidAmountCode) {
          return {
            message: `Entry with REPEATED AMOUNT CODE Added ${upi_short_code}`,
          };
        } else {
          return { message: `Entry with REPEATED UTR Added ${utr}` };
        }
      }

      ////for bank account ////vendor calculation
      if (botRes.status === '/success') {
        const bankDetails = await getBankaccountDao(
          {
            id: botRes?.bank_id,
            company_id: companyId,
          },
          null,
          null,
          role,
        );
        if (
          isNaN(bankDetails[0].balance) ||
          isNaN(bankDetails[0].today_balance)
        ) {
          throw new BadRequestError('Invalid amount or commission');
        }
        const res = await updateBankaccountDao(
          { id: botRes?.bank_id },
          {
            balance:
              parseFloat(bankDetails[0].balance) + parseFloat(botRes.amount),
            today_balance:
              parseFloat(bankDetails[0].today_balance) +
              parseFloat(botRes.amount),
            payin_count: parseFloat(bankDetails[0].payin_count + 1),
          },
          localConn,
        );
        await updateBankaccountService(
          localConn,
          { id: botRes?.bank_id, company_id: companyId },
          { latest_balance: res.today_balance },
          role,
          companyId,
          bankDetails[0].user_id,
        );
        vendor = await getVendorsDao({
          user_id: bankDetails[0].user_id,
        });
        if (isNaN(vendor[0].balance)) {
          throw new BadRequestError('Invalid amount or commission');
        }
        await updateVendorDao(
          { id: vendor[0].id },
          {
            balance: parseFloat(vendor[0].balance) + parseFloat(botRes.amount),
          },
          localConn,
        );
        const payinVendorCommission = calculateCommission(
          botRes.amount,
          vendor[0].payin_commission,
        );
        await updateCalculationTable(vendor[0].user_id, {
          payinCommission: payinVendorCommission,
          amount: botRes.amount,
        });
      }
      let duration;
      let checkPayInUtr;
      if (isValidAmountCode) {
        checkPayInUtr = await getPayInUrlsDao({
          upi_short_code: upi_short_code,
        });
      } else {
        checkPayInUtr = await getPayInUrlsDao({ user_submitted_utr: utr });
      }
      if (checkPayInUtr?.length > 0) {
        const payInUtr =
          checkPayInUtr.length === 1
            ? checkPayInUtr[0]
            : checkPayInUtr[checkPayInUtr.length - 1];
        if (upi_short_code && isValidAmountCode) {
          const getDataByUtr = await getBankResponseDaoAll(
            { utr: payInUtr.user_submitted_utr, company_id },
            null,
            null,
            filterColumns,
            null,
            null,
          );
          const botUtrIsUsed =
            getDataByUtr.rows.length > 1 &&
            getDataByUtr.some((item) => item.is_used);
          if (!acceptedStatus.includes(payInUtr.status) && botUtrIsUsed) {
            await commit(localConn);
            // if (shouldRelease) localConn.release();
            return {
              message: `The entry is already ${payInUtr.status} with UTR`,
            };
          }
        }
        const isBankExist = await getBankaccountDao(
          { id: bank_id, company_id },
          null,
          null,
          role,
        );
        if (!isBankExist || payInUtr.bank_acc_id !== bank_id) {
          if (
            (payInUtr.user_submitted_utr !== utr &&
              isValidAmountCode &&
              upi_short_code !== payInUtr.upi_short_code) ||
            (isValidAmountCode && upi_short_code !== payInUtr.upi_short_code)
          ) {
            await commit(localConn);
            // if (shouldRelease) localConn.release();
            if (isValidAmountCode && payInUtr.upi_short_code) {
              return {
                message: `⛔ Amount Code: ${upi_short_code} does not match with User Submitted Amount Code: ${payInUtr.upi_short_code}`,
              };
            } else {
              return {
                message: `⛔ UTR: ${utr} does not match with User Submitted UTR: ${payInUtr.user_submitted_utr}`,
              };
            }
          }
          duration = calculateDuration(payInUtr.created_at);
          const payInData = {
            status: Status.BANK_MISMATCH,
            is_notified: true,
            user_submitted_utr: botRes.utr,
            bank_response_id: botRes.id,
            // approved_at: new Date(),
            // config: { from_UI },
            duration,
          };
          const updatePayInDataRes = await updatePayInUrlDao(
            payInUtr.id,
            payInData,
            localConn,
          );
          await updateBotResponseDao(botRes.id, { is_used: true }, localConn);
          if (updatePayInDataRes) {
            await newTableEntry(tableName.PAYIN);
            // This is async function but it's just the callback sending function there fore we are not using await
            merchantPayinCallback(updatePayInDataRes.config.urls?.notify, {
              status: updatePayInDataRes.status,
              merchantOrderId: updatePayInDataRes.merchant_order_id,
              payinId: updatePayInDataRes.id,
              amount: botRes.amount,
              req_amount: updatePayInDataRes.amount,
              utr_id: updatePayInDataRes.user_submitted_utr,
            });
          }
          // await sendNotification(Status.BANK_MISMATCH, {
          //   id: payInUtr.id,
          //   user_submitted_utr: botRes.utr,
          //   bank_response_id: botRes.id,
          //   merchant_order_id: updatePayInDataRes?.merchant_order_id,
          // });
          await commit(localConn);
          // if (shouldRelease) localConn.release();
          return {
            message: `Bank Mismatch with ${updatePayInDataRes?.merchant_order_id}`,
          };
        }

        const existingResponse = await getBankResponseDao(
          { utr, is_used: true, company_id },
          null,
          null,
          null,
          null,
          filterColumns,
        );
        if (existingResponse?.length > 0) {
          await commit(localConn);
          // if (shouldRelease) localConn.release();
          return { message: `The UTR already exists` };
        }
        const merchantData = await getMerchantsDao(
          { id: payInUtr.merchant_id },
          null,
          null,
          null,
          null,
        );
        const payinMerchantCommission = calculateCommission(
          botRes.amount,
          merchantData[0].payin_commission,
        );
        const bankAccountDetails = await getBankaccountDao(
          { id: payInUtr.bank_acc_id, company_id },
          null,
          null,
          role,
        );
        const vendorData = await getVendorsDao(
          { user_id: bankAccountDetails[0].user_id },
          null,
          null,
          null,
          null,
        );
        const payinVendorCommission = calculateCommission(
          botRes.amount,
          vendorData[0].payin_commission,
        );
        // const durMs = new Date() - payInUtr.created_at;
        // const durSeconds = Math.floor((durMs / 1000) % 60)
        //   .toString()
        //   .padStart(2, '0');
        // const durMinutes = Math.floor((durSeconds / 60) % 60)
        //   .toString()
        //   .padStart(2, '0');
        // const durHours = Math.floor((durMinutes / 60) % 24)
        //   .toString()
        //   .padStart(2, '0');
        // const duration = `${durHours}:${durMinutes}:${durSeconds}`;
        // const duration = calculateDuration(payInUtr.created_at);

        if (
          payInUtr.amount === amount ||
          (isValidAmountCode &&
            isValidAmountCode === payInUtr.upi_short_code &&
            payInUtr.amount === amount)
        ) {
          if (
            (payInUtr.user_submitted_utr !== utr &&
              isValidAmountCode &&
              upi_short_code !== payInUtr.upi_short_code) ||
            (isValidAmountCode && upi_short_code !== payInUtr.upi_short_code)
          ) {
            await commit(localConn);
            // if (shouldRelease) localConn.release();
            if (isValidAmountCode && payInUtr.upi_short_code) {
              return {
                message: `⛔ Amount Code: ${upi_short_code} does not match with User Submitted Amount Code: ${payInUtr.upi_short_code}`,
              };
            } else {
              return {
                message: `⛔ UTR: ${utr} does not match with User Submitted UTR: ${payInUtr.user_submitted_utr}`,
              };
            }
          }
          duration = calculateDuration(payInUtr.created_at);
          const payInData = {
            status: Status.SUCCESS,
            is_notified: true,
            user_submitted_utr: botRes.utr,
            approved_at: new Date(),
            duration,
            payin_merchant_commission: payinMerchantCommission,
            payin_vendor_commission: payinVendorCommission,
            // config: { from_UI },
            bank_response_id: botRes.id,
          };
          const updatePayin = await updatePayInUrlDao(
            payInUtr.id,
            payInData,
            localConn,
          );
          await updateBotResponseDao(botRes.id, { is_used: true }, localConn);
          await newTableEntry(tableName.PAYIN);
          // This is async function but it's just the callback sending function there fore we are not using await
          merchantPayinCallback(updatePayin.config.urls?.notify, {
            status: updatePayin.status,
            merchantOrderId: updatePayin.merchant_order_id,
            payinId: updatePayin.id,
            amount: botRes.amount,
            req_amount: updatePayin.amount,
            utr_id: updatePayin.user_submitted_utr,
          });
          const merchantDataBalance = merchantData[0].balance + amount;
          if (isNaN(merchantDataBalance)) {
            throw new BadRequestError('Invalid amount or commission');
          }
          await updateCalculationTable(merchantData[0].user_id, {
            payinCommission: payinMerchantCommission,
            amount: botRes.amount,
          });
          await commit(localConn);
          // if (shouldRelease) localConn.release();
          return {
            message: `UTR ${utr} matches the User Submitted UTR: ${payInUtr.user_submitted_utr} and the payment was successful.`,
          };
        } else {
          if (
            (payInUtr.user_submitted_utr !== utr &&
              isValidAmountCode &&
              upi_short_code !== payInUtr.upi_short_code) ||
            (isValidAmountCode && upi_short_code !== payInUtr.upi_short_code)
          ) {
            await commit(localConn);
            // if (shouldRelease) localConn.release();
            if (isValidAmountCode && payInUtr.upi_short_code) {
              return {
                message: `⛔ Amount Code: ${upi_short_code} does not match with User Submitted Amount Code: ${payInUtr.upi_short_code}`,
              };
            } else {
              return {
                message: `⛔ UTR: ${utr} does not match with User Submitted UTR: ${payInUtr.user_submitted_utr}`,
              };
            }
          }
          duration = calculateDuration(payInUtr.created_at);
          const payInData = {
            status: Status.DISPUTE,
            is_notified: true,
            user_submitted_utr: botRes.utr,
            bank_response_id: botRes.id,
            // approved_at: new Date(),
            duration,
            payin_merchant_commission: payinMerchantCommission,
            payin_vendor_commission: payinVendorCommission,
            // config: { from_UI },
          };
          const updatePayInDataRes = await updatePayInUrlDao(
            payInUtr.id,
            payInData,
            localConn,
          );
          await updateBotResponseDao(botRes.id, { is_used: true }, localConn);
          if (updatePayInDataRes) {
            await newTableEntry(tableName.PAYIN);
            // This is async function but it's just the callback sending function there fore we are not using await
            merchantPayinCallback(updatePayInDataRes.config.urls?.notify, {
              status: updatePayInDataRes.status,
              merchantOrderId: updatePayInDataRes.merchant_order_id,
              payinId: updatePayInDataRes.id,
              amount: botRes.amount,
              req_amount: updatePayInDataRes.amount,
              utr_id: updatePayInDataRes.user_submitted_utr,
            });
          }

          // await sendNotification(Status.DISPUTE, {
          //   id: payInUtr.id,
          //   user_submitted_utr: botRes.utr,
          //   bank_response_id: botRes.id,
          //   merchant_order_id: updatePayInDataRes?.merchant_order_id,
          // });
          await commit(localConn);
          // if (shouldRelease) localConn.release();
          return {
            message: `Entry is in Dispute with ${updatePayInDataRes?.merchant_order_id}`,
          };
        }
      }

      await commit(localConn);
      return { message: `Entry created successfully` };
    } catch (err) {
      if (localConn) {
        try {
          await rollback(localConn);
        } catch (rollbackErr) {
          logger.error('Error during rollback:', rollbackErr);
        }
      }
      throw err;
    } finally {
      if (shouldRelease && localConn) {
        try {
          localConn.release();
        } catch (releaseErr) {
          logger.error('Error releasing connection:', releaseErr);
        }
      }
    }
  } catch (error) {
    logger.error('Error in createBankResponseService:', error.message);
    throw error;
  }
};

const updateCalculationTable = async (user_id, data, conn) => {
  try {
    if (isNaN(data.amount - data.payinCommission)) {
      throw new BadRequestError('Invalid amount or commission');
    }
    if (user_id) {
      const calculationData = await getCalculationforCronDao(user_id);
      if (!calculationData[0]) {
        throw new NotFoundError('Calculation not found!');
      }
      const calculationId = calculationData[0].id;
      const totalAmount = Number(data.amount) - Number(data.payinCommission);
      const response = await updateCalculationBalanceDao(
        { id: calculationId },
        {
          total_payin_count: 1,
          total_payin_amount: data.amount,
          total_payin_commission: data.payinCommission,
          current_balance: totalAmount,
          net_balance: totalAmount,
        },
        conn,
      );
      return response;
    }
  } catch (error) {
    logger.error('Error in updateCalculationTable:', error);
    throw error;
  }
};

const getClaimResponseService = async (payload) => {
  try {
    let filters = Object.fromEntries(
      Object.entries({
        date: payload.date || undefined,
        bank_id: payload.bank_id || undefined,
        company_id: payload.company_id || undefined,
      }).filter(([, v]) => v !== undefined),
    );
    filters = {
      ...filters,
    };
    return await getClaimResponseDao(filters);
  } catch (error) {
    logger.error('Error in getBankResponseService:', error);
    throw error;
  }
};

const getBankResponseService = async (
  payload,
  role,
  page,
  limit,
  search,
  updated,
  sortBy,
  sortOrder,
) => {
  try {
    const filterColumns =
      role === Role.MERCHANT
        ? merchantColumns.BANK_RESPONSE
        : role === Role.VENDOR
          ? vendorColumns.BANK_RESPONSE
          : columns.BANK_RESPONSE;

    const sno = Number(payload.sno) > 0 ? Number(payload.sno) : undefined;
    const amount =
      Number(payload.amount) > 0 ? Number(payload.amount) : undefined;

    let filters = Object.fromEntries(
      Object.entries({
        sno,
        status: payload.status || undefined,
        amount,
        utr: payload.utr || undefined,
        bank_id: payload.bank_id || undefined,
        is_used: payload.is_used || undefined,
        company_id: payload.company_id || undefined,
      }).filter(([, v]) => v !== undefined),
    );
    filters = {
      ...(search ? { search } : {}),
      ...filters,
    };
    sortBy = sortBy ? sortBy : updated ? 'updated_at' : 'sno';
    return await getBankResponseDaoAll(
      filters,
      page,
      limit,
      filterColumns,
      updated,
      sortBy,
      sortOrder || 'DESC',
      payload.startDate || undefined,
      payload.endDate || undefined,
    );
  } catch (error) {
    logger.error('Error in getBankResponseService:', error);
    throw error;
  }
};

const  getBankResponseBySearchService = async (
  payload,
  role,
  page,
  limit,
  search,
  updated,
  sortBy,
  sortOrder,
) => {
  try {
    const filterColumns =
      role === Role.MERCHANT
        ? merchantColumns.BANK_RESPONSE
        : role === Role.VENDOR
          ? vendorColumns.BANK_RESPONSE
          : columns.BANK_RESPONSE;

    const sno = Number(payload.sno) > 0 ? Number(payload.sno) : undefined;
    const amount =
      Number(payload.amount) > 0 ? Number(payload.amount) : undefined;

    let filters = Object.fromEntries(
      Object.entries({
        sno,
        status: payload.status || undefined,
        amount,
        utr: payload.utr || undefined,
        bank_id: payload.bank_id || undefined,
        is_used: payload.is_used || undefined,
        company_id: payload.company_id || undefined,
        upi_short_code: payload.upi_short_code || undefined,
        updated_by: payload.updated_by || undefined,
        updated_at: payload.updated_at || undefined,
      }).filter(([, v]) => v !== undefined),
    );
    filters = {
      ...(search ? { search } : {}),
      ...filters,
    };
    sortBy = sortBy ? sortBy : updated ? 'updated_at' : 'sno';

    const data = await getBankResponseBySearchDao(
      filters,
      page,
      limit,
      filterColumns,
      updated,
      sortBy,
      sortOrder || 'DESC',
      payload.startDate || undefined,
      payload.endDate || undefined,
    );

    return data;
  } catch (error) {
    logger.error('Error while fetching Payin by search', error);
    throw error;
  }
};
const updateBankResponseService = async (id, payload, role) => {
  let conn;
  try {
    const filterColumns =
      role === Role.MERCHANT
        ? merchantColumns.BANK_RESPONSE
        : role === Role.VENDOR
          ? vendorColumns.BANK_RESPONSE
          : columns.BANK_RESPONSE;
    conn = await getConnection();
    await beginTransaction(conn); // Start a transaction
    const data = await updateBankResponseDao(id, payload, conn); // Adjust DAO call for update
    await commit(conn); // Commit the transaction
    const finalResult = filterResponse(data, filterColumns);
    return finalResult;
  } catch (error) {
    if (conn) {
      try {
        await rollback(conn); // Rollback the transaction in case of error
      } catch (rollbackError) {
        logger.error('Error while rollback in BankResponse', rollbackError);
      }
    }
    logger.error('Error while updating BankResponse', error);
    throw error;
  } finally {
    if (conn) {
      try {
        conn.release(); // Release the connection back to the pool
      } catch (releaseError) {
        logger.error(
          'Error while release connection in BankResponse',
          releaseError,
        );
      }
    }
  }
};

const getBankMessageServices = async (
  bank_id,
  startDate,
  endDate,
  company_id,
  role,
  page,
  limit,
) => {
  try {
    const filterColumns =
      role === Role.MERCHANT
        ? merchantColumns.BANK_RESPONSE
        : role === Role.VENDOR
          ? vendorColumns.BANK_RESPONSE
          : columns.BANK_RESPONSE;
    const pageNumber = parseInt(page, 10) || 1;
    const pageSize = parseInt(limit, 10) || 10;
    return await getBankMessageDao(
      bank_id,
      startDate,
      endDate,
      company_id,
      pageNumber,
      pageSize,
      null,
      null,
      filterColumns,
    );
  } catch (error) {
    logger.error('Error while getting BankResponse', error);
    throw error;
  }
};

const resetBankResponseService = async (conn, id, userData) => {
  const { company_id, user_name, user_id, role, amount, utr, bank_id } =
    userData;

  try {
    // Fetch bank response
    const botRes = await getBankResponseDao({ id, company_id });
    if (!botRes) {
      logger.error(`Bank response not found for ID: ${id}`);
      throw new NotFoundError('Bank response not found');
    }

    // Check for successful pay-in
    let payInData = await getPayInUrlsDao({ user_submitted_utr: botRes.utr });
    if (!payInData?.length) {
      payInData = await getPayInUrlsDao({ bank_response_id: botRes.id });
    }

    const hasSuccess = payInData?.some(
      (item) => item.status === Status.SUCCESS,
    );
    if (hasSuccess) {
      const successPayIn = payInData.find(
        (item) => item.status === Status.SUCCESS,
      );
      logger.warn(
        `UTR already confirmed for Merchant Order ID: ${successPayIn.merchant_order_id}`,
        'warn',
      );
      throw new BadRequestError(
        `UTR is already confirmed with Merchant Order ID ${successPayIn.merchant_order_id}. No changes applied. Previous Amount: ${botRes.amount}`,
      );
    }

    const changes = {
      amount: botRes.amount,
      utr: botRes.utr,
      bank_id: botRes.bank_id,
      config: botRes.config || {},
      bank_name: (await getBankaccountDao({ id: botRes.bank_id }))[0]
        ?.nick_name,
    };

    // Prepare base update data
    let updateData = {
      is_used: false,
      updated_by: user_name,
      config: botRes.config || {},
    };

    // Handle specific updates based on input
    let message = 'Bot response reset successful';
    if (typeof amount === 'number' && !isNaN(amount)) {
      const result = await handleAmountUpdate({
        botRes,
        amount,
        user_name,
        company_id,
        role,
        payInData,
        user_id,
        conn,
      });
      updateData = result.updateData;
      changes.config.previousAmount = botRes.amount;
      changes.amount = amount;
      message = result.message;
    }

    if (utr) {
      const bot = await getBankResponseDao({ utr: utr, company_id });
      if (bot) {
        logger.error(`Bank response found: ${utr}`);
        throw new NotFoundError(
          'This UTR has already been used. Please provide a new one.',
        );
      }
      const utrResult = await handleUtrUpdate({
        botRes,
        utr,
        user_id,
        user_name,
        conn,
      });
      updateData = utrResult;
      changes.utr = utr;
      changes.config.previousUTR = botRes.utr;
    }

    if (bank_id) {
      const newBank = await getBankaccountDao({ id: bank_id });
      const bankResult = await handleBankIdUpdate({
        botRes,
        bank_id,
        company_id,
        user_id,
        user_name,
        conn,
      });
      updateData = bankResult;
      changes.bank_id = bank_id;
      changes.nick_name = newBank[0]?.nick_name;
      changes.config.previousBank = (
        await getBankaccountDao({ id: botRes.bank_id })
      )[0]?.nick_name;
    }

    if (!amount && !utr && !bank_id) {
      await updatePayInData({ payInData, user_name, botRes });
      await resetBankResponseDao(id, updateData);
    }

    // logger.info(`Bank response reset successful for ID: ${id}`, 'info');
    // await notifyAdminsAndUsers({
    //   conn,
    //   company_id: company_id,
    //   message: `The entry with UTR ${botRes.utr} has been updated.`,
    //   payloadUserId: user_id,
    //   actorUserId: user_id,
    //   category: 'Data Entries',
    // });

    const results = {
      message,
      id,
      data: changes,
      updated_by: user_name,
      updated_at: new Date().toISOString(),
    };
    await newTableEntry(tableName.BANK_RESPONSE, results);
    return results;
  } catch (error) {
    logger.error(`Error resetting bank response for ID: ${id}`, error.message);
    throw error;
  }
};

// Handle amount update
const handleAmountUpdate = async ({
  botRes,
  amount,
  user_name,
  role,
  payInData,
  user_id,
  conn,
}) => {
  try {
    const previousAmount = botRes.amount;
    const previousUpdater = botRes.updated_by;
    const updateData = {
      updated_by: user_name,
      config: { ...(botRes.config || {}), previousAmount, previousUpdater },
      is_used: false,
      amount,
    };

    if (amount !== previousAmount) {
      const bankDetails = await getBankaccountDao({ id: botRes.bank_id });
      if (!bankDetails[0]) throw new NotFoundError('Bank account not found');

      const bank = bankDetails[0];
      const vendor = await getVendorsDao({ user_id: bank.user_id });
      if (!vendor[0]) throw new NotFoundError('Vendor not found');

      const updatedAmount =
        botRes.amount > amount
          ? `-${Math.abs(botRes.amount - amount)}`
          : `+${Math.abs(amount - botRes.amount)}`;

      const payinCommission = calculateCommission(
        updatedAmount,
        vendor[0].payin_commission,
      );
      const [vendorCalculationData] =
        await Promise.all([
          getAllCalculationforCronDao(vendor[0].user_id),
        ]);
      if (!vendorCalculationData[0]) {
        throw new NotFoundError('Calculation data not found');
      }
      const approvedDate = getDateWithoutTime(botRes.created_at);
      const vendorCurrentCalculations = vendorCalculationData.filter(
        (calc) => approvedDate === getDateWithoutTime(calc.created_at),
      );
      const vendorCalculations = vendorCalculationData.filter(
        (calc) => approvedDate < getDateWithoutTime(calc.created_at),
      );
      if (!vendorCurrentCalculations[0]) {
        throw new NotFoundError('Matching calculation not found');
      }
      // updateCalculationBalances;
      await Promise.all([
        // updateCalculationTable(vendor[0].user_id, {
        //   payinCommission,
        //   amount: updatedAmount,
        // }),
        updateCalculationBalances(
          vendorCurrentCalculations,
          vendorCalculations,
          updatedAmount,
          payinCommission,
          conn,
        ),
        updateBankaccountDao(
          { id: bank.id },
          {
            balance: parseFloat(bank.balance) + parseFloat(updatedAmount),
            today_balance:
              parseFloat(bank.today_balance) + parseFloat(updatedAmount),
          },
        ).then((res) => {
          if (res.is_enabled) {
            updateBankaccountService(
              conn,
              { id: bank.id, company_id: res.company_id },
              { latest_balance: res.today_balance },
              role,
              res.company_id,
              user_id,
            );
          }
        }),
        updatePayInData({ payInData, user_name, botRes }),
        updateBotResponseDao(botRes.id, updateData, conn),
      ]);
    }

    return {
      updateData,
      message: `Bot response reset successful. Previous Amount: ${previousAmount}`,
    };
  } catch (error) {
    logger.error('Error in handle bank resp. amount update:', error.message);
    throw error;
  }
};

// Handle UTR update
const handleUtrUpdate = async ({ botRes, utr, user_id, user_name, conn }) => {
  try {
    const previousUTR = botRes.utr;
    const previousUpdater = botRes.updated_by;
    const updateData = {
      utr: utr,
      updated_by: user_name,
      config: { ...(botRes.config || {}), previousUTR, previousUpdater },
    };
    const payIn = await getPayInUrlsDao({ user_submitted_utr: utr });
    if (
      payIn?.length &&
      payIn[0].user_submitted_utr &&
      ![Status.SUCCESS, Status.FAILED].includes(payIn[0].status)
    ) {
      await updatePayInUrlDao(payIn[0].id, {
        user_submitted_utr: utr,
        updated_by: user_id,
      });
      await newTableEntry(tableName.PAYIN);
    }
    await updateBotResponseDao(botRes.id, updateData, conn);
  } catch (error) {
    logger.error('Error in handle bank utr update:', error.message);
    throw error;
  }
};

// Handle bank ID update
const handleBankIdUpdate = async ({
  botRes,
  bank_id,
  company_id,
  user_id,
  user_name,
  conn,
}) => {
  try {
    const [prevBank, newBank] = await Promise.all([
      getBankaccountDao({ id: botRes.bank_id }),
      getBankaccountDao({ id: bank_id }),
    ]);
    const previousBank = prevBank[0].nick_name;
    const previousUpdater = botRes.updated_by;
    const updateData = {
      bank_id: newBank[0].id,
      updated_by: user_name,
      config: { ...(botRes.config || {}), previousBank, previousUpdater },
    };

    if (!prevBank[0] || !newBank[0])
      throw new NotFoundError('Bank account not found');
    if (newBank[0].id === prevBank[0].id) {
      throw new BadRequestError('Please provide a different bank account ID');
    }

    const [prevVendor, newVendor] = await Promise.all([
      getVendorsDao({ user_id: prevBank[0].user_id }),
      getVendorsDao({ user_id: newBank[0].user_id }),
    ]);
    if (!prevVendor[0] || !newVendor[0])
      throw new NotFoundError('Vendor not found');

    const [prevVendorCalc, newVendorCalc] = await Promise.all([
      getAllCalculationforCronDao(prevVendor[0].user_id),
      getAllCalculationforCronDao(newVendor[0].user_id),
    ]);

    if (!prevVendorCalc[0] || !newVendorCalc[0]) {
      throw new NotFoundError('Calculation data not found');
    }

    const approvedDate = getDateWithoutTime(botRes.created_at);
    const prevVendorCurrentCalcs = prevVendorCalc.filter(
      (calc) => approvedDate === getDateWithoutTime(calc.created_at),
    );
    const newVendorCurrentCalcs = newVendorCalc.filter(
      (calc) => approvedDate === getDateWithoutTime(calc.created_at),
    );
    const prevVendorNextCurrentCalcs = prevVendorCalc.filter(
      (calc) => approvedDate < getDateWithoutTime(calc.created_at),
    );
    const newVendorNextCurrentCalcs = newVendorCalc.filter(
      (calc) => approvedDate < getDateWithoutTime(calc.created_at),
    );

    if (!prevVendorCurrentCalcs[0] || !newVendorCurrentCalcs[0]) {
      throw new NotFoundError('Matching calculation not found');
    }

    const prevVendorCommission = calculateCommission(
      Math.abs(botRes.amount),
      prevVendor[0].payin_commission,
    );
    const newVendorCommission = calculateCommission(
      Math.abs(botRes.amount),
      newVendor[0].payin_commission,
    );

    await Promise.all([
      updateBankaccountDao(
        { id: prevBank[0].id, company_id },
        {
          payin_count: prevBank[0].payin_count - 1,
          balance: prevBank[0].balance - botRes.amount,
          today_balance: prevBank[0].today_balance - botRes.amount,
          updated_by: user_id,
        },
      ),
      updateBankaccountDao(
        { id: newBank[0].id, company_id },
        {
          payin_count: newBank[0].payin_count + 1,
          balance: newBank[0].balance + botRes.amount,
          today_balance: newBank[0].today_balance + botRes.amount,
          updated_by: user_id,
        },
      ),
      updateBotResponseDao(botRes.id, updateData, conn),
      updateCalculationBalances(
        prevVendorCurrentCalcs,
        prevVendorNextCurrentCalcs,
        -botRes.amount,
        -prevVendorCommission,
        conn,
        -1,
      ),
      updateCalculationBalances(
        newVendorCurrentCalcs,
        newVendorNextCurrentCalcs,
        botRes.amount,
        newVendorCommission,
        conn,
        1,
      ),
    ]);
  } catch (error) {
    logger.error('Error in handle bank id update:', error.message);
    throw error;
  }
};

// Update pay-in data
const updatePayInData = async ({ payInData, user_name, botRes }) => {
  try {
    const isEqualUTR = payInData?.some(
      (item) => item.user_submitted_utr === botRes.utr,
    );
    const isEqualBotResponse = payInData?.some(
      (item) => item.bank_response_id === botRes.id,
    );

    let updatePayinID;
    if (isEqualUTR) {
      updatePayinID = payInData.filter(
        (item) =>
          item.user_submitted_utr === botRes.utr &&
          item.status !== Status.FAILED,
      );
    } else if (isEqualBotResponse) {
      updatePayinID = payInData.filter(
        (item) =>
          item.bank_response_id === botRes.id &&
          [Status.FAILED, Status.DISPUTE, Status.BANK_MISMATCH].includes(
            item.status,
          ),
      );
    }

    if (updatePayinID?.length) {
      const updatePayinData = {
        status:
          new Date().getTime() -
            new Date(updatePayinID[0].created_at).getTime() <
          10 * 60 * 1000
            ? Status.ASSIGNED
            : Status.DROPPED,
        user_submitted_utr: null,
        bank_response_id: null,
        updated_by: user_name,
      };
      await updatePayInUrlDao(updatePayinID[0].id, updatePayinData);
      await newTableEntry(tableName.PAYIN);
    }
  } catch (error) {
    logger.error('Error in updatePayin Data', error.message);
    throw error;
  }
};

// Function to clean and normalize text
function cleanText(text) {
  return text
    .replace(/[\n\r]+/g, ' ') // Replace newlines with spaces
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .trim();
}

// Function to extract reference number (UTR, NEFT, IMPS)
function extractReferenceNumber(description) {
  // UPI: 12-digit number
  const upiMatch = description.match(/UPI[:\/]([0-9]{12})/i);
  if (upiMatch) return upiMatch[1];

  // NEFT: 10-16 digit alphanumeric
  const neftMatch = description.match(
    /NEFT[\/-](?:CR|INWARD)?[\/-]?([A-Za-z0-9]{10,16})/i,
  );
  if (neftMatch) return neftMatch[1];

  // IMPS: 10-12 digit number
  const impsMatch = description.match(/IMPS[\/:]([0-9]{10,12})/i);
  if (impsMatch) return impsMatch[1];

  return null;
}

// Function to parse amount (handles INR prefix, commas, and signs)
function parseAmount(amount) {
  if (!amount || amount === '-' || amount === 'NIL') return null;
  const isNegative = amount.startsWith('-');
  const cleaned = amount.replace(/[^0-9.]/g, '');
  const value = parseFloat(cleaned);
  return isNegative ? -value : value;
}

// Function to format transaction as space-separated string
function formatTransaction(transaction) {
  return `${transaction.amount} undefined ${transaction.utr} ${transaction.bank_id} ${transaction.isProcessed}`;
}

// Function to extract credited transactions from PDF buffer
async function extractCreditedTransactions(pdfBuffer, bankId) {
  try {
    const parser = new PDFParser();
    const data = await new Promise((resolve, reject) => {
      parser.on('pdfParser_dataReady', (pdfData) => resolve(pdfData));
      parser.on('pdfParser_dataError', (err) => reject(err));
      parser.parseBuffer(pdfBuffer);
    });

    const transactions = [];
    let isTransactionSection = false;
    let headers = [];
    let amountColumnIndex = -1;
    let balanceColumnIndex = -1;
    let previousBalance = null;
    let rowAccumulator = [];
    let currentRow = [];

    // Iterate through pages
    for (const page of data.Pages) {
      let currentTransaction = {};

      // Iterate through text elements
      for (const text of page.Texts) {
        const decodedText = decodeURIComponent(text.R[0].T);
        const cleanedText = cleanText(decodedText);
        if (!cleanedText) continue;

        // Detect start of transaction table
        if (
          !isTransactionSection &&
          (/Date/i.test(cleanedText) ||
            /(Amount|Balance|Transaction|Credit|Credits|Debit|Debits)/i.test(
              cleanedText,
            ))
        ) {
          isTransactionSection = true;
          headers = cleanedText.split(/\s+/).filter((h) => h);
          amountColumnIndex = headers.findIndex((h) =>
            /Amount|Transaction|Credit|Credits/i.test(h),
          );
          balanceColumnIndex = headers.findIndex((h) => /Balance/i.test(h));
          continue;
        }

        // Check if the text is a date to start a new row
        if (
          cleanedText.match(/^\d{2}[,\/-]\d{2}[,\/-]\d{4}$/) ||
          cleanedText.match(/^\d{2}\s+[A-Za-z]{3}\s+\d{4}$/)
        ) {
          if (currentRow.length > 0) {
            // Process the previous row
            const columns = currentRow
              .join(' ')
              .split(/\s+/)
              .filter((c) => c);

            if (
              columns[0].match(/^\d{2}[,\/-]\d{2}[,\/-]\d{4}$/) ||
              columns[0].match(/^\d{2}\s+[A-Za-z]{3}\s+\d{4}$/)
            ) {
              isTransactionSection = true;
              if (Object.keys(currentTransaction).length > 0) {
                transactions.push(currentTransaction);
              }
              currentTransaction = { date: columns[0] };

              // Combine description until numeric value
              let descriptionParts = [];
              let i = 1;
              while (
                i < columns.length &&
                !columns[i].match(/^-?\d+[,.]?\d*$/) &&
                !columns[i].match(/^INR\s*\d+[,.]?\d*$/)
              ) {
                descriptionParts.push(columns[i]);
                i++;
              }
              currentTransaction.description = descriptionParts.join(' ');
              currentTransaction.referenceNumber = extractReferenceNumber(
                currentTransaction.description,
              );

              // Assign amount and balance
              if (amountColumnIndex !== -1 && columns[amountColumnIndex]) {
                currentTransaction.amount = parseAmount(
                  columns[amountColumnIndex],
                );
              } else {
                for (let j = columns.length - 1; j >= 1; j--) {
                  if (
                    columns[j].match(/^-?\d+[,.]?\d*$/) ||
                    columns[j].match(/^INR\s*\d+[,.]?\d*$/)
                  ) {
                    if (!currentTransaction.balance) {
                      currentTransaction.amount = parseAmount(columns[j]);
                      break;
                    }
                  }
                }
              }

              if (balanceColumnIndex !== -1 && columns[balanceColumnIndex]) {
                currentTransaction.balance = parseAmount(
                  columns[balanceColumnIndex],
                );
              } else {
                for (let j = columns.length - 1; j >= 1; j--) {
                  if (
                    columns[j].match(/^-?\d+[,.]?\d*$/) &&
                    !currentTransaction.amount
                  ) {
                    currentTransaction.balance = parseAmount(columns[j]);
                    break;
                  }
                }
              }

              // Infer amount from balance change
              if (
                !currentTransaction.amount &&
                currentTransaction.balance &&
                previousBalance !== null
              ) {
                const balanceChange =
                  currentTransaction.balance - previousBalance;
                if (balanceChange > 0) {
                  currentTransaction.amount = balanceChange;
                }
              }

              // Fallback: Check description for credit keywords
              if (
                !currentTransaction.amount &&
                currentTransaction.description.match(/Received|Deposit|Credit/i)
              ) {
                const amountMatch =
                  currentTransaction.description.match(/(\d+[,.]?\d*)/);
                if (amountMatch)
                  currentTransaction.amount = parseFloat(amountMatch[1]);
              }

              // Add bank_id and isProcessed
              currentTransaction.bank_id = bankId;
              currentTransaction.isProcessed = true;

              previousBalance = currentTransaction.balance || previousBalance;
            }
          }
          // Start a new row
          currentRow = [cleanedText];
        } else if (isTransactionSection) {
          // Add to current row
          currentRow.push(cleanedText);
        } else {
          // Accumulate non-transaction text
          rowAccumulator.push(cleanedText);
        }
      }

      // Process the last row
      if (currentRow.length > 0) {
        const columns = currentRow
          .join(' ')
          .split(/\s+/)
          .filter((c) => c);

        if (
          columns[0].match(/^\d{2}[,\/-]\d{2}[,\/-]\d{4}$/) ||
          columns[0].match(/^\d{2}\s+[A-Za-z]{3}\s+\d{4}$/)
        ) {
          if (Object.keys(currentTransaction).length > 0) {
            transactions.push(currentTransaction);
          }
          currentTransaction = { date: columns[0] };

          let descriptionParts = [];
          let i = 1;
          while (
            i < columns.length &&
            !columns[i].match(/^-?\d+[,.]?\d*$/) &&
            !columns[i].match(/^INR\s*\d+[,.]?\d*$/)
          ) {
            descriptionParts.push(columns[i]);
            i++;
          }
          currentTransaction.description = descriptionParts.join(' ');
          currentTransaction.referenceNumber = extractReferenceNumber(
            currentTransaction.description,
          );

          if (amountColumnIndex !== -1 && columns[amountColumnIndex]) {
            currentTransaction.amount = parseAmount(columns[amountColumnIndex]);
          } else {
            for (let j = columns.length - 1; j >= 1; j--) {
              if (
                columns[j].match(/^-?\d+[,.]?\d*$/) ||
                columns[j].match(/^INR\s*\d+[,.]?\d*$/)
              ) {
                if (!currentTransaction.balance) {
                  currentTransaction.amount = parseAmount(columns[j]);
                  break;
                }
              }
            }
          }

          if (balanceColumnIndex !== -1 && columns[balanceColumnIndex]) {
            currentTransaction.balance = parseAmount(
              columns[balanceColumnIndex],
            );
          } else {
            for (let j = columns.length - 1; j >= 1; j--) {
              if (
                columns[j].match(/^-?\d+[,.]?\d*$/) &&
                !currentTransaction.amount
              ) {
                currentTransaction.balance = parseAmount(columns[j]);
                break;
              }
            }
          }

          if (
            !currentTransaction.amount &&
            currentTransaction.balance &&
            previousBalance !== null
          ) {
            const balanceChange = currentTransaction.balance - previousBalance;
            if (balanceChange > 0) {
              currentTransaction.amount = balanceChange;
            }
          }

          if (
            !currentTransaction.amount &&
            currentTransaction.description.match(/Received|Deposit|Credit/i)
          ) {
            const amountMatch =
              currentTransaction.description.match(/(\d+[,.]?\d*)/);
            if (amountMatch)
              currentTransaction.amount = parseFloat(amountMatch[1]);
          }

          // Add bank_id and isProcessed
          currentTransaction.bank_id = bankId;
          currentTransaction.isProcessed = true;

          previousBalance = currentTransaction.balance || previousBalance;
          transactions.push(currentTransaction);
        }
      }
    }

    // Filter credited transactions and format as strings
    const creditedTransactions = transactions
      .filter((t) => t.amount && t.amount > 0 && t.referenceNumber) // Exclude utr == "N/A"
      .map((t) => ({
        amount: t.amount,
        utr: t.referenceNumber,
        bank_id: t.bank_id,
        isProcessed: t.isProcessed,
      }))
      .map((t) => formatTransaction(t));

    return creditedTransactions;
  } catch (error) {
    logger.error('Error in extractCreditedTransactions:', error);
    throw error;
  }
}

// Main service function
const importBankResponseService = async (
  conn,
  payload,
  companyId,
  role,
  name,
) => {
  try {
    // Validate payload
    if (!payload || !payload.pdfBuffer) {
      throw new BadRequestError('No valid PDF buffer provided in payload');
    }

    // Extract credited transactions
    const creditedTransactions = await extractCreditedTransactions(
      payload.pdfBuffer,
      payload.bank_id,
    );

    for (const transaction of creditedTransactions) {
      await createBankResponseService(conn, transaction, companyId, role, name);
    }

    return {
      message: `${payload.fileType} imported successfully`,
    };
  } catch (error) {
    logger.error('Error in importBankResponseService:', error);
    throw error;
  }
};

// Helper function to compare dates without time
const getDateWithoutTime = (date) => {
  return new Date(date)
    .toLocaleDateString('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    .split('/')
    .join('-');
};

// Helper function to update calculation balances
const updateCalculationBalances = async (
  currentCalculation,
  nextCalculations,
  amountDiff,
  commission,
  conn,
  count = 0,
) => {
  try {
    if (!currentCalculation) return;
    const updates = {
      total_payin_count: count,
      total_payin_commission: commission,
      total_payin_amount: amountDiff,
      current_balance: amountDiff - commission,
      net_balance: amountDiff - commission,
    };
const todayDate = dayjs().tz('Asia/Kolkata').format('YYYY-MM-DD');
    // Update current calculation
    await updateCalculationBalanceDao(
      { id: currentCalculation[0].id },
      updates,
      conn,
    );

    if (nextCalculations.length > 0) {
      // Update subsequent calculations
      for (const calc of nextCalculations) {
          const calculationDate = dayjs(calc.created_at)
                  .tz('Asia/Kolkata')
            .format('YYYY-MM-DD');
            let data = {};
            if (calculationDate === todayDate) {
              data = {
                total_adjustment_amount: amountDiff,
                total_adjustment_commission:commission,
                total_adjustment_count: 1,
              };
            }
        await updateCalculationBalanceDao(
          { id: calc.id },
          {
            net_balance: amountDiff - commission,
            ...data,
          },
          conn,
        );
      }
    }
  } catch (error) {
    logger.error('Error in updateCalculationBalances:', error);
    throw error;
  }
};

export {
  getBankResponseService,
  getClaimResponseService,
  createBankResponseService,
  updateBankResponseService,
  getBankMessageServices,
  getBankResponseBySearchService,
  resetBankResponseService,
  importBankResponseService,
};
