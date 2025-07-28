import dayjs from 'dayjs';
import { nanoid } from 'nanoid';
import { Cashfree } from 'cashfree-pg';
import { v4 as uuidv4 } from 'uuid';
import querystring from 'querystring';
import config from '../../config/config.js';
import { razorpay } from '../../webhooks/razorPay.js';
import { getPayoutsDao } from '../payOut/payOutDao.js';
import { checkLockEdit } from '../../utils/advisoryLock.js';
import {
  BankTypes,
  Currency,
  Role,
  Status,
  Type,
} from '../../constants/index.js';
import { calculateCommission, calculateDuration } from '../../helpers/index.js';
import {
  merchantPayinCallback,
  merchantPayoutCallback,
} from '../../callBacksAndWebHook/merchantCallBacks.js';
import {
  generatePayInUrlDao,
  updatePayInUrlDao,
  getPayInUrlDao,
  getPayInUrlsDao,
  getPayinsBySearchDao,
  getAllPayInsDao,
  getPayInPendingDao,
} from './payInDao.js';
import {
  BadRequestError,
  InternalServerError,
  NotFoundError,
} from '../../utils/appErrors.js';
import {
  getBankaccountDao,
  getMerchantBankDao,
  updateBankaccountDao,
  // updateBanktBalanceDao,
} from '../bankAccounts/bankaccountDao.js';
import {
  getBankResponseDao,
  getBankResponseDaoById,
  updateBankResponseDao,
  updateBotResponseDao,
} from '../bankResponse/bankResponseDao.js';
import {
  getMerchantsByCodeDao,
  getMerchantsDao,
  getMerchantByUserIdDao,
  updateMerchantBalanceDao,
} from '../merchants/merchantDao.js';
import {
  getAllCalculationforCronDao,
  getCalculationforCronDao,
  updateCalculationBalanceDao,
} from '../calculation/calculationDao.js';
import {
  getVendorsDao,
  updateVendorDao,
  // updateVendorBalanceDao
} from '../vendors/vendorDao.js';
import {
  getImageContentFromOCr,
  getTelegramFilePath,
  getTelegramImageBase64,
} from '../../helpers/index.js';
import {
  sendAlreadyConfirmedMessageTelegramBot,
  sendBankMismatchMessageTelegramBot,
  sendDisputeMessageTelegramBot,
  sendDuplicateMessageTelegramBot,
  sendErrorMessageNoDepositFoundTelegramBot,
  sendErrorMessageNoMerchantOrderIdFoundTelegramBot,
  sendErrorMessageTelegram,
  sendPaymentStatusMessageTelegramBot,
  sendErrorMessageUtrOrAmountNotFoundImgTelegramBot,
  sendMerchantOrderIDStatusDuplicateTelegramMessage,
  sendSuccessMessageTelegramBot,
  sendTelegramMessage,
  sendUTRMismatchErrorMessageTelegram,
  sendTelegramDisputeMessage,
  sendBankNotAssignedAlertTelegram,
} from '../../utils/sendTelegramMessages.js';
import { tableName } from '../../constants/index.js';
import { newTableEntry } from '../../utils/sockets.js';
import { getConnection } from '../../utils/db.js';
import { createCheckUtrService } from '../checkutr/checkUtrServices.js';
import { createResetHistoryService } from '../resetHistory/resetServices.js';
// import { updateBankaccountService } from '../bankAccounts/bankaccountServices.js';
import { stringifyJSON } from '../../utils/index.js';
import { createHash } from '../../utils/hashUtils.js';
import { logger } from '../../utils/logger.js';
import { getUserHierarchysDao } from '../userHierarchy/userHierarchyDao.js';
import { generateUUID } from '../../utils/generateUUID.js';
import { usedTokens } from '../../app.js';
import { getCompanyByIDDao } from '../company/companyDao.js';
Cashfree.XClientId = config.cashFreeClientId;
Cashfree.XClientSecret = config.XClientSecret;
Cashfree.XEnvironment = Cashfree.Environment.PRODUCTION;

export const generatePayInUrlByHashService = async (conn, req) => {
  try {
    const { user_id, code, ot, key, amount } = req.query;
    if (!user_id || !code || !ot) {
      const data = {
        status: 400,
        message: 'Missing required query parameters: user_id, code, or ot',
      };
      return data;
    }
    // const x_api_key = req.headers['x-api-key'];
    const merchantArr = await getMerchantsByCodeDao(code);
    const bankAssigned = await getMerchantBankDao({
      config_merchants_contains: merchantArr[0].id,
    });
    const [company] = await getCompanyByIDDao({
      id: merchantArr[0].company_id,
    });
    if (bankAssigned.length <= 0) {
      await sendBankNotAssignedAlertTelegram(
        company.config?.telegramBankAlertChatId,
        code,
        company.config?.telegramBotToken,
      );
      // await notifyAdminsAndUsers({
      //   conn,
      //   company_id: merchantArr[0].company_id,
      //   message: `Bank Account has not been linked with Merchant: ${code}`,
      //   payloadUserId: merchantArr[0].user_id,
      //   actorUserId: merchantArr[0].user_id,
      //   category: 'Transaction',
      //   subCategory: 'PayIn',
      // });
      //-- correct error handling
      const data = {
        status: 404,
        message: 'Bank Account has not been linked with Merchant',
      };
      return data;
    }

    // bank is not enabled or no method is enabled for payment - no payment link generates
    //loop over each and cehck
    const allBanksDisabled = bankAssigned.every(
      (bank) => bank.is_enabled === false,
    );
    if (allBanksDisabled) {
      await sendBankNotAssignedAlertTelegram(
        company.config?.telegramBankAlertChatId,
        code,
        company.config?.telegramBotToken,
      );
      // await notifyAdminsAndUsers({
      //   conn,
      //   company_id: merchantArr[0].company_id,
      //   message: `Bank Account has not been linked with Merchant: ${code}`,
      //   payloadUserId: merchantArr[0].user_id,
      //   actorUserId: merchantArr[0].user_id,
      //   category: 'Transaction',
      //   subCategory: 'PayIn',
      // });
      // error handling
      const data = {
        status: 404,
        message: 'Bank Account has not been linked with Merchant',
      };
      return data;
    }
    //loop over evrey bank
    const allPaymentOptionsDisabled = bankAssigned.every((bank) => {
      if (!bank.is_enabled) return true;
      const config = bank.config || {};
      const isPhonepay = config.is_phonepay || false;
      return (
        isPhonepay === false && bank.is_qr === false && bank.is_bank === false
      );
    });

    if (allPaymentOptionsDisabled) {
      const data = {
        status: 404,
        message: 'No Payment Methods Enabled!',
      };
      return data;
    }

    let query = `user_id=${user_id}&code=${code}&ot=${ot}&key=${key}`;
    if (amount) {
      query += `&amount=${amount}`;
    }

    // Create a deterministic hash
    const hash = createHash(`${code}:${key}`);

    // Encode the hash to make it URL-safe
    const encodedHash = encodeURIComponent(hash);

    const updateRes = {
      payInUrl: `${config.reactPaymentOrigin}/transaction/${encodedHash}?${query}`,
    };
    return updateRes;
  } catch (error) {
    logger.error('Error generating payin hash:', error);
    throw error;
  }
};

export const generatePayInUrlService = async (
  conn,
  payload,
  created_by,
  userIp,
  fromUI,
) => {
  try {
    const {
      code,
      user_id,
      merchant_order_id: order_id,
      amount,
      returnUrl,
      notifyUrl,
      ot,
      api_key,
      x_api_key,
    } = payload;
    const merchant_order_id = order_id ? order_id : uuidv4();
    const merchantArr = await getMerchantsByCodeDao(code);
    const merchant = merchantArr[0];
    if (!fromUI && merchant?.config?.whitelist_ips) {
      let whitelist = merchant.config.whitelist_ips;
      // Normalize whitelist to array of trimmed strings
      if (typeof whitelist === 'string') {
        whitelist = whitelist
          .split(',')
          .map((ip) => ip.trim())
          .filter(Boolean);
      } else if (Array.isArray(whitelist)) {
        whitelist = whitelist.map((ip) => String(ip).trim()).filter(Boolean);
      } else {
        whitelist = [];
      }
      // Check if userIp is in whitelist (if whitelist is not empty)
      if (whitelist.length && !whitelist.includes(userIp)) {
        const data = {
          status: 400,
          message: 'IP not whitelisted',
        };
        return data;
      }
    }

    const isOrderIdExist = await getPayInUrlDao({
      merchant_order_id: order_id,
    });

    if (isOrderIdExist) {
      const data = {
        status: 400,
        message: 'Merchant Order ID already exists',
      };
      return data;
    }

    if (!merchant) {
      const data = {
        status: 400,
        message: 'Merchant does not exist',
      };
      return data;
    }

    const merchantAPIKey = merchant.config?.keys;

    if (
      api_key &&
      api_key != merchantAPIKey?.private &&
      api_key != merchantAPIKey?.public
    ) {
      const data = {
        status: 404,
        message: 'Enter valid Api key',
      };
      return data;
    }

    if (
      !api_key &&
      x_api_key != merchantAPIKey?.private &&
      x_api_key != merchantAPIKey?.public
    ) {
      const data = {
        status: 404,
        message: 'Enter valid Api key',
      };
      return data;
    }

    if (amount < merchant.min_payin || amount > merchant.max_payin) {
      const data = {
        status: 400,
        message: `Amount must be between ${merchant.min_payin} and ${merchant.max_payin}`,
      };
      return data;
    }

    const expirationDate =
      ot === 'y'
        ? dayjs().add(10, 'minutes').toISOString()
        : dayjs().add(30, 'days').toISOString();
    const data = {
      upi_short_code: nanoid(5), // code added by us
      amount: amount || 0, // as starting amount will be zero
      status: Status.INITIATED,
      currency: Currency.INR,
      merchant_order_id, // for time being we are using this
      user: user_id,
      merchant_id: merchant.id,
      expiration_date: expirationDate,
      company_id: merchant.company_id,
      config: stringifyJSON({
        urls: {
          return: returnUrl ? returnUrl : merchant.config?.urls?.return || '',
          notify: notifyUrl ? notifyUrl : merchant.config?.urls?.payin_notify || '',
        },
      }),
      created_by,
    };
    const result = await generatePayInUrlDao(data);
    // await newTableEntry(tableName.PAYIN);
    return result;
  } catch (error) {
    throw new BadRequestError(error.message);
  }
};

export const getPayInUrlService = async (id, conn, tele_check = true) => {
  try {
    const currentTime = Date.now();
    const payIn = await getPayInUrlDao({ merchant_order_id: id });

    if (!payIn) {
      throw new NotFoundError('Payment Url is incorrect');
    }
    // Skip expiration check if tele_check is false
    if (payIn.is_url_expires && tele_check) {
      if (payIn.one_time_used === true || payIn.is_url_expires === true) {
        const result = {
          redirect_url: payIn.config?.urls?.return,
        };
        return { error: `Url is expired`, result };
      }
    }
    const config = payIn.config || {};
    if (
      currentTime > Number(payIn.expiration_date) &&
      payIn.status !== Status.INITIATED
    ) {
      // expire payIn
      await updatePayInUrlDao(
        id,
        {
          is_url_expires: true,
          status: Status.DROPPED,
        },
        conn,
      );
      // Notifying merchant about expired URL
      // This is async function but it's just the callback sending function there fore we are not using await
      merchantPayinCallback(config.urls?.notify, {
        status: Status.DROPPED,
        merchantOrderId: payIn.merchant_order_id,
        payinId: payIn.id,
        amount: null,
        req_amount: payIn.amount,
        utr_id: payIn.utr,
      });
      // throw new InternalServerError('PayIn Expired');
    }

    return payIn;
  } catch (error) {
    logger.error('Error get payin url:', error);
    throw error;
  }
};

// TODO: delete this API
export const expirePayInUrlService = async (payInId) => {
  try {
    // const currentTime = Date.now();
    const payIn = await getPayInUrlDao({ id: payInId });
    if (!payIn) {
      throw new NotFoundError('PayIn not found!');
    }
    checkIsPayInExpired(payIn);
    const config = payIn.config || {};
    await updatePayInUrlDao(payInId, {
      is_url_expires: true,
      status: Status.DROPPED,
    });
    // This is async function but it's just the callback sending function there fore we are not using await
    merchantPayinCallback(config.urls?.notify, {
      status: Status.DROPPED,
      merchantOrderId: payIn.merchant_order_id,
      payinId: payIn.id,
      amount: null,
      req_amount: payIn.amount,
      utr_id: payIn.utr,
    });
  } catch (error) {
    logger.error('Error expire payin url:', error);
    throw error;
  }
};

export const assignedBankToPayInUrlService = async (
  merchantOrderId,
  amount,
  type,
) => {
  // Validate the PayIn URL
  try {
    const payIn = await getPayInUrlService(merchantOrderId);
    const payInConfig = payIn.config || {};
    checkIsPayInExpired(payIn);
    if (payIn.status !== Status.INITIATED) {
      if (payIn.status === Status.ASSIGNED) {
        const bank = await getBankaccountDao({
          id: payIn.bank_acc_id,
          company_id: payIn.company_id,
        });
        let response;
        if (type === BankTypes.BANK_TRANSFER) {
          response = {
            return: payIn.config?.urls?.return,
            bank: {
              nick_name: bank[0].nick_name,
              acc_holder_name: bank[0].acc_holder_name,
              acc_no: bank[0].acc_no,
              ifsc: bank[0].ifsc,
            },
          };
        } else {
          response = {
            return: payIn.config?.urls?.return,
            bank: {
              upi_id: bank[0].upi_id,
              acc_holder_name: bank[0].acc_holder_name,
              code: payIn.upi_short_code,
            },
          };
        }
        return response;
      } else {
        throw new BadRequestError('PayIn has been confirmed already!');
      }
    }
    const merchantArr = await getMerchantsDao({ id: payIn.merchant_id });
    const merchant = merchantArr[0] || {};
    if (!merchant) {
      // throw new NotFoundError('No merchant found');
      return { message: `No merchant found` };
    }
    const maxPayIn = Number(merchant.max_payin);
    const minPayIn = Number(merchant.min_payin);
    const amt = Number(amount);

    if (amt > maxPayIn || amt < minPayIn) {
      //-- exact amounts should also be considered
      return { message: `Amount must be between ${minPayIn} and ${maxPayIn}` };
    }
    const banks = await getMerchantBankDao({
      config_merchants_contains: merchant.id,
    });
    //only enabled banks assigned
    const enabledBanks = banks.filter((bank) => {
      const isPayInBank = ['PayIn', 'payIn'].includes(bank.bank_used_for);
      const isActive = bank.is_enabled && isPayInBank;

      if (!isActive) return false;

      const config = bank.config || {};
      const hasAnyMethod =
        bank.is_qr ||
        bank.is_bank ||
        config.is_phonepay ||
        config.is_intent ||
        false;

      if (!hasAnyMethod) return false;

      switch (type) {
        case BankTypes.UPI:
          return bank.is_qr;
        case BankTypes.PHONE_PE:
          return config.is_phonepay || false;
        case BankTypes.BANK_TRANSFER:
          return bank.is_bank;
        case BankTypes.INTENT:
          return config.is_intent || false;
        default:
          return false;
      }
    });

    if (!enabledBanks.length) {
      await updatePayInUrlDao(payIn.id, {
        is_url_expires: true,
        status: Status.DROPPED,
      });
      // This is async function but it's just the callback sending function there fore we are not using await
      merchantPayinCallback(payInConfig.urls?.notify, {
        status: Status.DROPPED,
        merchantOrderId: payIn.merchant_order_id,
        payinId: payIn.id,
        amount: null,
        req_amount: payIn.amount,
        utr_id: payIn.utr,
      });
      throw new NotFoundError(`No enabled bank found!`);
    }
    // Randomly assign one enabled bank account
    const selectedBankDetails =
      enabledBanks[Math.floor(Math.random() * enabledBanks.length)];
    const duration = calculateDuration(payIn.created_at);
    const updatePayIn = await updatePayInUrlDao(payIn.id, {
      amount: parseFloat(amount),
      status: Status.ASSIGNED,
      bank_acc_id: selectedBankDetails.id,
      duration: duration
    });
    // expirePayInIfNeeded(payIn);
    delete updatePayIn.is_obsolete;
    delete updatePayIn.company_id;
    delete selectedBankDetails.is_obsolete;
    delete updatePayIn.company_id;

    Object.assign(updatePayIn, {
      merchant_min_payin: merchant.min_payin,
      merchant_max_payin: merchant.max_payin,
      merchant_code: merchant.code,
      allow_merchant_intent: merchant.allow_intent,
      code: updatePayIn.upi_short_code,
      bank: selectedBankDetails,
    });

    let response;
    if (type === BankTypes.BANK_TRANSFER) {
      response = {
        return: updatePayIn.config?.urls?.return,
        bank: {
          nick_name: selectedBankDetails.nick_name,
          acc_holder_name: selectedBankDetails.acc_holder_name,
          acc_no: selectedBankDetails.acc_no,
          ifsc: selectedBankDetails.ifsc,
        },
      };
    } else {
      response = {
        return: updatePayIn.config?.urls?.return,
        bank: {
          upi_id: selectedBankDetails.upi_id,
          acc_holder_name: selectedBankDetails.acc_holder_name,
          code: updatePayIn.upi_short_code,
        },
      };
    }

    return response;
  } catch (error) {
    logger.error('Error assigned payin url:', error);
    throw error;
  }
};

// Public API Used by Merchants
export const checkPayInStatusService = async (
  payInId,
  merchantCode,
  merchantOrderId,
  api_key,
) => {
  try {
    const merchantArr = await getMerchantsDao({ code: merchantCode });
    const merchant = merchantArr[0];
    if (!merchant) {
      const data = {
        status: 400,
        message: 'Merchant Order ID already exists',
      };
      return data;
    }

    const merchantConfig = merchant.config || {};

    if (
      api_key != merchantConfig.keys?.private &&
      api_key != merchantConfig.keys?.public
    ) {
      const data = {
        status: 404,
        message: 'Enter valid Api key',
      };
      return data;
    }

    const payIn = await getPayInUrlDao({
      id: payInId,
      merchant_order_id: merchantOrderId,
    });

    if (!payIn) {
      const data = {
        status: 404,
        message: 'PayIn not found',
      };
      return data;
    }

    //check is payIn detials belongs to that merchant or not
    if (!(payIn.merchant_id === merchant.id)) {
      const data = {
        status: 404,
        message:
          'merchant_order_id and payIn ID do not belong to the specified merchant',
      };
      return data;
    }

    let botResponse;
    if (payIn.bank_response_id) {
      botResponse = await getBankResponseDao({
        id: payIn.bank_response_id,
        company_id: payIn.company_id,
      });
    }

    return {
      status: payIn.status,
      merchantOrderId: payIn.merchant_order_id,
      amount: [
        Status.INITIATED,
        Status.ASSIGNED,
        Status.DROPPED,
        Status.DUPLICATE,
      ].includes(payIn.status)
        ? null
        : botResponse?.amount
          ? botResponse?.amount
          : null,
      payinId: payIn.id,
      req_amount: payIn.amount,
      utr_id: [
        Status.INITIATED,
        Status.ASSIGNED,
        Status.DROPPED,
        Status.IMG_PENDING,
      ].includes(payIn.status)
        ? ' '
        : botResponse?.utr
          ? botResponse?.utr
          : payIn.user_submitted_utr,
    };
  } catch (error) {
    logger.error('Error check payin:', error);
    throw error;
  }
};

export const payInIntentGenerateOrderService = async (
  payInId,
  amount,
  isRazorpay,
) => {
  // validating if it exist
  try {
    const payIn = await getPayInUrlService(payInId);
    checkIsPayInExpired(payIn);
    if (isRazorpay) {
      const orderRes = await razorpay.orders.create({
        amount: amount * 100,
        currency: Currency.INR,
        receipt: payInId,
      });

      return {
        ...orderRes,
      };
    }

    const requestBody = {
      order_amount: amount,
      order_currency: Currency.INR,
      customer_details: {
        customer_id: 'node_sdk_test',
        customer_email: 'example@gmail.com',
        customer_phone: '9999999999',
      },
      order_meta: {
        return_url:
          'https://test.cashfree.com/pgappsdemos/return.php?order_id={order_id}',
        paymentMethod: 'upi',
      },
    };

    const cashFreeResponse = await Cashfree.PGCreateOrder(
      payInId,
      requestBody,
    ).catch((err) => {
      const data = err?.response?.data || {};
      logger.error(data);
      throw new Error('Error while creating CashFree Order');
    });

    return {
      payment_amount: amount,
      cashFreeResponse,
      payInId,
    };
  } catch (error) {
    logger.error('Error generate intent payin:', error);
    throw error;
  }
};

export const updatePaymentNotificationStatusService = async (
  payInId,
  type,
  company_id,
) => {
  try {
    if (!Object.values(Type).includes(type)) {
      throw new BadRequestError('Invalid notification type.');
    }

    let data;
    if (type === Type.PAYIN) {
      const payIn = await updatePayInUrlDao(payInId, { is_notified: true });
      if (!payIn) {
        throw new NotFoundError('Payin data not found.');
      }

      const bankResponse = await getBankResponseDao({
        id: payIn.bank_response_id,
        company_id,
      });

      data = await merchantPayinCallback(payIn.config?.urls?.notify, {
        status: payIn.status,
        merchantOrderId: payIn.merchant_order_id,
        payinId: payIn.id,
        amount: bankResponse?.amount || null,
        req_amount: payIn.amount,
        utr_id: bankResponse?.utr ? bankResponse.utr : payIn.user_submitted_utr, //--utr_id either bankres and payin
      });
    } else if (type === Type.PAYOUT) {
      // find on the basis of payoutId
      const payouts = await getPayoutsDao({ id: payInId, company_id });
      const payout = payouts[0];
      if (!payout) {
        throw new NotFoundError('Payout data not found.');
      }
      const merchants = await getMerchantsDao({
        id: payout.merchant_id,
        company_id,
      });
      const merchant = merchants[0];
      if (!merchant) {
        throw new NotFoundError('Merchant or payout notify URL not found.');
      }
      ///payout notify url change
      data = await merchantPayoutCallback(
        payouts[0].payout_details.urls.notify,
        {
          code: merchant.code,
          merchantOrderId: payout.merchant_order_id,
          payoutId: payout.id,
          amount: payout.amount,
          status: payout.status,
          utr_id: payout.utr_id || '',
        },
      );
    }

    return data;
  } catch (error) {
    logger.error('Error updating payment status notification:', error);
    throw error;
  }
};

export const updateDepositStatusService = async (
  conn,
  merchantOrderId,
  nick_name,
  company_id,
  updated_by,
) => {
  try {
    const payInData = await getPayInUrlDao({
      merchant_order_id: merchantOrderId,
      company_id,
    });
    if (!payInData) {
      throw new NotFoundError('PayIn data not found');
    }
    const merchants = await getMerchantsDao({
      id: payInData.merchant_id,
      company_id,
    });

    // need to check pay in is for merchant or vendor
    const merchant = merchants[0];

    if (!merchant) {
      throw new NotFoundError('No merchant found against payIn');
    }

    if (payInData.status !== Status.BANK_MISMATCH) {
      throw new BadRequestError(
        'Status is not BANK_MISMATCH, no update applied',
      );
    }

    //call the Bank Res API
    const bankResponse = await getBankResponseDao({
      id: payInData.bank_response_id,
      company_id,
    });

    if (!bankResponse) {
      throw new NotFoundError('No bank response found!');
    }
    let duration;

    const banks = await getBankaccountDao({ nick_name, company_id });
    const bank = banks[0];

    if (!bank) {
      throw new NotFoundError('Bank not found!');
    }

    const vendors = await getVendorsDao({
      user_id: bank.user_id,
      company_id,
    });
    const vendor = vendors[0];
    //calculate the payin commission
    const payinCommission = calculateCommission(
      bankResponse.amount,
      merchant.payin_commission,
    );
    const vendorPayinCommission = calculateCommission(
      bankResponse.amount,
      vendor.payin_commission,
    );

    let successData = [];
    if (bankResponse.is_used) {
      successData = await getOtherSuccessPayIns(bankResponse);
    }
    duration = calculateDuration(payInData.created_at);
    const updatePayInData = {
      status:
        bank.id != bankResponse.bank_id
          ? Status.BANK_MISMATCH
          : parseFloat(bankResponse.amount) !== parseFloat(payInData.amount)
            ? Status.DISPUTE
            : successData.length
              ? Status.DUPLICATE
              : Status.SUCCESS,
      bank_acc_id: bank.id,
      duration: duration,
      updated_by,
    };

    if (updatePayInData.status === Status.SUCCESS) {
      updatePayInData.approved_at = new Date();
      updatePayInData.payin_merchant_commission = payinCommission;
      updatePayInData.payin_vendor_commission = vendorPayinCommission;
      // update merchant caclulation table
      await updateCalculationTable(
        merchant.user_id,
        {
          amount: payInData.amount,
          payinCommission: payinCommission,
        },
        conn,
      );

      // update vendor caclulation table
      // await updateCalculationTable(
      //   bank.user_id,
      //   {
      //     amount: payInData.amount,
      //     payinCommission: vendorPayinCommission,
      //   },
      //   conn,
      // );

      // update merchant balance
      await updateMerchantBalanceDao(
        { id: merchant.id },
        payInData.amount,
        updated_by,
        conn,
      );

      // update vendor balance
      // await updateVendorBalanceDao(
      //   { user_id: bank.user_id },
      //   payInData.amount,
      //   updated_by,
      //   conn,
      // );
    }

    const updatePayInRes = await updatePayInUrlDao(
      payInData.id,
      updatePayInData,
      conn,
    );

    await updateBotResponseDao({ id: bank.id }, { is_used: true }, conn);

    // update bank balance and today balance
    // const bankBalance =
    //   updatePayInData.status === Status.DISPUTE
    //     ? bankResponse.amount
    //     : payInData.amount;

    // await updateBanktBalanceDao({ id: bank.id }, bankBalance, updated_by, conn);

    // await updateBankaccountService(
    //   conn,
    //   { id: bank.id, company_id: payInData.company_id },
    //   {},
    // );
    // This is async function but it's just the callback sending function there fore we are not using await
    merchantPayinCallback(updatePayInRes.config?.urls?.notify, {
      status: updatePayInRes.status,
      merchantOrderId: updatePayInRes.merchant_order_id,
      payinId: updatePayInRes.id,
      req_amount: payInData.amount,
      amount: bankResponse.amount,
      utr_id: bankResponse.utr || '',
    });

    return;
  } catch (error) {
    logger.error('Error updating deposit status:', error);
    throw error;
  }
};

export const resetDepositService = async (
  conn,
  merchant_order_id,
  company_id,
  updated_by,
) => {
  try {
    const payIn = await getPayInUrlDao({
      merchant_order_id: merchant_order_id,
      company_id: company_id,
    });
    if (!payIn) {
      throw new NotFoundError('Merchant Order ID not found');
    }
    await createResetHistoryService(
      conn,
      {
        payin_id: payIn.id,
        pre_status: payIn.status,
        created_by: updated_by,
        updated_by,
        company_id,
      },
      // merchant_order_id,
    );

    const nonResettableStatuses = new Set([
      Status.SUCCESS,
      Status.FAILED,
      Status.ASSIGNED,
      Status.DROPPED,
      Status.INITIATED,
      Status.BANK_MISMATCH,
      Status.DISPUTE,
    ]);

    if (nonResettableStatuses.has(payIn.status)) {
      throw new BadRequestError(
        `The Order Id: ${payIn.merchant_order_id} with Status: ${payIn.status} cannot be reset!`,
      );
    }

    const condition = {
      company_id,
    };
    if (payIn.bank_response_id) {
      condition.id = payIn.bank_response_id;
    } else {
      condition.utr = payIn.user_submitted_utr;
    }
    const bankResponse = await getBankResponseDao(condition);
    const duration = calculateDuration(payIn.created_at);
    const updatePayInData = {
      status: calculateStatus(payIn.created_at),
      payin_merchant_commission: null,
      user_submitted_utr: null,
      bank_response_id: null,
      duration: duration,
      updated_by,
    };

    if (bankResponse && bankResponse.is_used) {
      // check if any entry exists
      const payInSuccess = await getOtherSuccessPayIns(bankResponse);
      ///for update bankresponse with id
      const id = bankResponse.id;
      if (!payInSuccess.length) {
        await updateBotResponseDao(id, { is_used: false }, conn);
      }
    }

    return await updatePayInUrlDao(payIn.id, updatePayInData, conn);
  } catch (error) {
    logger.error('Error reset deposit service:', error);
    throw error;
  }
};

const calculateStatus = (createdAt) => {
  const TEN_MINUTES_IN_MS = 10 * 60 * 1000;
  const currentTime = new Date();
  const createdTime = new Date(createdAt);
  const timeDifference = currentTime - createdTime;

  return timeDifference > TEN_MINUTES_IN_MS ? Status.DROPPED : Status.ASSIGNED;
};

export const getPayinsService = async (
  company_id,
  page,
  limit,
  filters,
  role,
  user_id,
  designation,
) => {
  let conn;
  try {
    const fetchMerchantIds = async (user_ids) => {
      const merchants = await getMerchantByUserIdDao(user_ids);
      return merchants.map((merchant) => merchant.id);
    };

    const fetchBankIds = async (user_id) => {
      try {
        const banks = await getBankaccountDao({
          user_id,
          bank_used_for: 'PayIn',
        });
        if (!banks || banks.length === 0) {
          return [];
        }
        return banks.map((bank) => bank.id);
      } catch (error) {
        logger.error('Error fetching PayIn:', error);
        return [];
      }
    };

    let merchant_user_id = role === Role.MERCHANT ? [user_id] : [];

    if (role === Role.MERCHANT) {
      const userHierarchys = await getUserHierarchysDao({ user_id });
      const userHierarchy = userHierarchys?.[0];

      if (designation === Role.MERCHANT && userHierarchy) {
        const subMerchants =
          userHierarchy?.config?.siblings?.sub_merchants ?? [];
        if (Array.isArray(subMerchants) && subMerchants.length > 0) {
          merchant_user_id = [...merchant_user_id, ...subMerchants];
          filters.merchant_id = await fetchMerchantIds(merchant_user_id);
        } else {
          filters.merchant_id = await fetchMerchantIds([user_id]);
        }
      } else if (designation === Role.SUB_MERCHANT) {
        filters.merchant_id = await fetchMerchantIds([user_id]);
      } else if (designation === Role.MERCHANT_OPERATIONS && userHierarchy) {
        const parentID = userHierarchy?.config?.parent;
        if (parentID) {
          const parentHierarchys = await getUserHierarchysDao({
            user_id: parentID,
          });
          const parentHierarchy = parentHierarchys?.[0];
          const subMerchants =
            parentHierarchy?.config?.siblings?.sub_merchants ?? [];

          const userIdFilter = [...new Set([parentID, ...subMerchants])];
          filters.merchant_id = await fetchMerchantIds(userIdFilter);
        }
      }
    } else if (role === Role.VENDOR) {
      if (designation === Role.VENDOR) {
        filters.bank_acc_id = await fetchBankIds(user_id);
      } else if (designation === Role.VENDOR_OPERATIONS) {
        const userHierarchys = await getUserHierarchysDao({ user_id });
        const parentID = userHierarchys?.[0]?.config?.parent;
        if (parentID) {
          filters.bank_acc_id = await fetchBankIds(parentID);
        }
      }
    }

    if (
      (designation === Role.VENDOR || designation === Role.VENDOR_OPERATIONS) &&
      Array.isArray(filters.bank_acc_id) &&
      filters.bank_acc_id.length === 0
    ) {
      return [];
    }

    conn = await getConnection();
    return await getAllPayInsDao(filters, company_id, page, limit, role);
  } catch (error) {
    throw new InternalServerError(error.message);
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

export const getPayinsBySearchService = async (
  filters,
  role,
  user_id,
  designation,
) => {
  try {
    const fetchMerchantIds = async (user_ids) => {
      const merchants = await getMerchantByUserIdDao(user_ids);
      return merchants.map((merchant) => merchant.id);
    };

    const fetchBankIds = async (user_id) => {
      try {
        const banks = await getBankaccountDao({
          user_id,
          bank_used_for: 'PayIn',
        });
        if (!banks || banks.length === 0) {
          return [];
        }
        return banks.map((bank) => bank.id);
      } catch (error) {
        logger.error('Error fetching PayIn:', error);
        return [];
      }
    };

    let merchant_user_id = role === Role.MERCHANT ? [user_id] : [];

    if (role === Role.MERCHANT) {
      const userHierarchys = await getUserHierarchysDao({ user_id });
      const userHierarchy = userHierarchys?.[0];

      if (designation === Role.MERCHANT && userHierarchy) {
        const subMerchants =
          userHierarchy?.config?.siblings?.sub_merchants ?? [];
        if (Array.isArray(subMerchants) && subMerchants.length > 0) {
          merchant_user_id = [...merchant_user_id, ...subMerchants];
          filters.merchant_id = await fetchMerchantIds(merchant_user_id);
        } else {
          filters.merchant_id = await fetchMerchantIds([user_id]);
        }
      } else if (designation === Role.SUB_MERCHANT) {
        filters.merchant_id = await fetchMerchantIds([user_id]);
      } else if (designation === Role.MERCHANT_OPERATIONS && userHierarchy) {
        const parentID = userHierarchy?.config?.parent;
        if (parentID) {
          const parentHierarchys = await getUserHierarchysDao({
            user_id: parentID,
          });
          const parentHierarchy = parentHierarchys?.[0];
          const subMerchants =
            parentHierarchy?.config?.siblings?.sub_merchants ?? [];

          const userIdFilter = [...new Set([parentID, ...subMerchants])];
          filters.merchant_id = await fetchMerchantIds(userIdFilter);
        }
      }
    } else if (role === Role.VENDOR) {
      if (designation === Role.VENDOR) {
        filters.bank_acc_id = await fetchBankIds(user_id);
      } else if (designation === Role.VENDOR_OPERATIONS) {
        const userHierarchys = await getUserHierarchysDao({ user_id });
        const parentID = userHierarchys?.[0]?.config?.parent;
        if (parentID) {
          filters.bank_acc_id = await fetchBankIds(parentID);
        }
      }
    }

    const pageNum = parseInt(filters.page);
    const limitNum = parseInt(filters.limit);
    if (isNaN(pageNum) || isNaN(limitNum) || pageNum < 1 || limitNum < 1) {
      throw new BadRequestError('Invalid pagination parameters');
    }
    const searchTerms = filters.search
      .split(',')
      .map((term) => term.trim())
      .filter((term) => term.length > 0);

    if (searchTerms.length === 0) {
      throw new BadRequestError('Please provide valid search terms');
    }
    const offset = (pageNum - 1) * limitNum;

    if (
      (designation === Role.VENDOR || designation === Role.VENDOR_OPERATIONS) &&
      Array.isArray(filters.bank_acc_id) &&
      filters.bank_acc_id.length === 0
    ) {
      return [];
    }

    const data = await getPayinsBySearchDao(
      filters,
      searchTerms,
      limitNum,
      offset,
      role,
      // filterColumns,
    );

    return data;
  } catch (error) {
    logger.error('Error while fetching Payin by search', error);
    throw new InternalServerError(error.message);
  }
};

export const processPayInService = async (
  conn,
  payload,
  updated_by,
  tele_check = true,
  img_utr = false,
) => {
  try {
    const {
      userSubmittedUtr,
      merchantOrderId,
      amount,
      from_telegram,
      telegramMessage,
      telegramBotToken,
      user_submitted_image,
      // : payload.fileKey
    } = payload;
    // validate payIn
    // throw error if not exist or expires
    const payIn = await getPayInUrlService(merchantOrderId, conn, tele_check);

    if (
      (payIn.one_time_used === true || payIn.is_url_expires === true) &&
      tele_check
    ) {
      const result = {
        redirect_url: payIn.config?.urls?.return,
      };
      return { error: `This payin url is already used`, result };
    }
    //lock payin transaction
    const lockKey = `${payIn.bank_acc_id}${userSubmittedUtr}`;
    await checkLockEdit(conn, lockKey, true);
    const banks = await getBankaccountDao({
      id: payIn?.bank_acc_id,
      company_id: payIn.company_id,
    });
    const bank = banks[0];

    if (!bank) {
      throw new NotFoundError('Bank not found!');
    }

    const duration = calculateDuration(payIn.created_at);
    const otherPayIns = await getPayInUrlsDao({
      user_submitted_utr: userSubmittedUtr,
    });
    const updatePayInData = {
      amount,
      //img_utr only for updating utr directly when image uploaded
      user_submitted_utr:
        tele_check || img_utr
          ? userSubmittedUtr
          : payIn?.user_submitted_utr
            ? payIn?.user_submitted_utr
            : null,
      status:
        img_utr && payIn.status === Status.IMG_PENDING
          ? 'PENDING'
          : payIn.status,
      is_url_expires: true,
      one_time_used: true,
      duration,
      user_submitted_image: user_submitted_image || payIn.user_submitted_image,
      is_notified: true,
      updated_by: updated_by || '',
    };
    let bankResponse = {};
    if (payIn.bank_response_id) {
      bankResponse =
        (await getBankResponseDao({ id: payIn.bank_response_id })) || {};
    } else if (!bankResponse || !bankResponse.utr) {
      bankResponse =
        (await getBankResponseDao({
          utr: userSubmittedUtr,
          status: '/success',
        })) || {};
    }
    const result = {
      status: payIn.status,
      merchantOrderId: payIn.merchant_order_id,
      payinId: payIn.id,
      amount: bankResponse.amount,
      req_amount: payIn.amount,
      utr_id: payIn.user_submitted_utr,
    };

    if (
      [
        Status.SUCCESS,
        Status.DUPLICATE,
        Status.DISPUTE,
        Status.BANK_MISMATCH,
      ].includes(payIn.status)
    ) {
      if (payIn.status === Status.DUPLICATE) {
        result.utr_id =
          bankResponse.utr || payIn.user_submitted_utr || userSubmittedUtr;
      }
      // This is async function but it's just the callback sending function there fore we are not using await
      merchantPayinCallback(payIn.config?.urls?.notify, result);
      return result;
    }

    if (otherPayIns.length || bankResponse.is_used) {
      updatePayInData.status = Status.DUPLICATE;
      result.status = Status.DUPLICATE;
      updatePayInData.duration = duration;
      result.utr_id =
        bankResponse.utr || payIn.user_submitted_utr || userSubmittedUtr;
      await updatePayInUrlDao(payIn.id, updatePayInData, conn);
      // This is async function but it's just the callback sending function there fore we are not using await
      merchantPayinCallback(payIn.config?.urls?.notify, result);
      return {
        ...result,
        message: 'Duplicate entry found!',
      };
    }

    if (!bankResponse || Object.keys(bankResponse).length === 0) {
      bankResponse =
        (await getBankResponseDao({
          utr: userSubmittedUtr,
          status: '/success',
        })) || {};
    }

    if (bankResponse.id) {
      await updateBotResponseDao(bankResponse.id, { is_used: true }, conn);
    }

    if (bankResponse.bank_id && bankResponse.bank_id !== payIn.bank_acc_id) {
      updatePayInData.status = Status.BANK_MISMATCH;
      updatePayInData.bank_response_id = bankResponse.id;
      updatePayInData.duration = duration;
      // updatePayInData.approved_at = new Date().toISOString();
      result.status = Status.BANK_MISMATCH;
      result.utr_id =
        bankResponse.utr || payIn.user_submitted_utr || userSubmittedUtr;
      await updatePayInUrlDao(payIn.id, updatePayInData, conn);
      // This is async function but it's just the callback sending function there fore we are not using await
      merchantPayinCallback(payIn.config?.urls?.notify, result);

      if (from_telegram) {
        const botBank = await getBankaccountDao({ id: bankResponse.bank_id });
        await sendBankMismatchMessageTelegramBot(
          telegramMessage.chat.id,
          payIn?.bank_acc_id ? bank.nick_name : 'null',
          botBank[0].nick_name,
          telegramBotToken,
          telegramMessage.message_id,
        );
        return true;
      } else {
        return {
          ...result,
          message: `${payIn.merchant_order_id} is in Bank Mismatched with ${payIn.user_submitted_utr || bankResponse.utr} `,
        };
      }
    }

    if (bankResponse.id) {
      updatePayInData.status =
        parseFloat(amount) === parseFloat(bankResponse.amount)
          ? Status.SUCCESS
          : Status.DISPUTE;
      updatePayInData.bank_response_id = bankResponse.id;
      updatePayInData.approved_at =(updatePayInData.status == Status.SUCCESS) ?new Date().toISOString() : null;
      result.amount = bankResponse.amount;
      result.utr_id =
        bankResponse.utr || payIn.user_submitted_utr || userSubmittedUtr;
    } else {
      updatePayInData.status = Status.PENDING;
      result.utr_id =
        bankResponse.utr || payIn.user_submitted_utr || userSubmittedUtr;
    }

    result.status = updatePayInData.status;

    let merchant;
    if (updatePayInData.status === Status.SUCCESS) {
      // update merchant balance
      // await updateMerchantBalanceDao(
      //   { id: payIn.merchant_id },
      //   bankResponse.amount,
      //   updated_by,
      //   conn,
      // );
      // update vendor balance
      // await updateVendorBalanceDao(
      //   { user_id: bank.user_id },
      //   bankResponse.amount,
      //   updated_by,
      //   conn,
      // );

      merchant = await getMerchantsDao({ id: payIn.merchant_id });
      const commissions = calculateCommission(
        bankResponse.amount,
        Number(merchant[0].payin_commission),
      );
      updatePayInData.payin_merchant_commission = Number(commissions);
      const bank = await getBankaccountDao({
        id: bankResponse.bank_id,
      });
      const vendors = await getVendorsDao({
        user_id: bank[0].user_id,
      });
      const vendor = vendors[0];
      const vendorCommission = calculateCommission(
        bankResponse.amount,
        Number(vendor.payin_commission),
      );
      updatePayInData.payin_vendor_commission = Number(vendorCommission);
      await updateCalculationTable(
        merchant[0].user_id,
        {
          payinCommission: Number(commissions),
          amount: Number(bankResponse.amount),
        },
        conn,
      );
      // await updateCalculationTable(
      //   bank.user_id,
      //   {
      //     payinCommission: vendorCommission,
      //     amount: bankResponse.amount,
      //   },
      //   conn,
      // );
    }

    // if (updatePayInData.status === Status.DISPUTE) {
    // update bank balance
    // (updated_by = updated_by ? updated_by : bank.updated_by),
    //   await updateBanktBalanceDao(
    //     { id: bank.id },
    //     payIn.amount,
    //     updated_by,
    //     conn,
    //   );
    // await updateBankaccountService(
    //   conn,
    //   { id: bank.id, company_id: payIn.company_id },
    //   {},
    // );
    // }

    await updatePayInUrlDao(payIn.id, updatePayInData, conn);
    await newTableEntry(tableName.PAYIN);
    // This is async function but it's just the callback sending function there fore we are not using await
    merchantPayinCallback(payIn.config?.urls?.notify, result);

    if (from_telegram) {
      if (
        !updatePayInData?.status ||
        !telegramMessage?.chat?.id ||
        !telegramBotToken
      ) {
        throw new BadRequestError('Missing required parameters');
      }

      try {
        switch (updatePayInData.status) {
          case Status.DISPUTE:
            await sendDisputeMessageTelegramBot(
              telegramMessage.chat.id,
              updatePayInData.amount,
              bankResponse.amount,
              telegramBotToken,
              telegramMessage.message_id,
            );
            break;
          case Status.DUPLICATE:
            await sendDuplicateMessageTelegramBot(
              telegramMessage.chat.id,
              updatePayInData.user_submitted_utr,
              payIn.merchant_order_id,
              telegramBotToken,
              telegramMessage.message_id,
            );
            break;
          default:
            await sendSuccessMessageTelegramBot(
              telegramMessage.chat.id,
              payIn.merchant_order_id,
              telegramBotToken,
              telegramMessage.message_id,
            );
            break;
        }
      } catch (error) {
        logger.error('Error handling Telegram message:', error);
      }
      // if (
      //   [
      //     Status.SUCCESS,
      //     Status.BANK_MISMATCH,
      //     Status.DISPUTE,
      //     Status.DROPPED,
      //   ].includes(payIn.status)
      // ) {
      // await notifyAdminsAndUsers({
      //   conn,
      //   company_id: payIn.company_id,
      //   message: `Payin with merchant order id: ${payIn.merchant_order_id} has been updated.`,
      //   payloadUserId: merchant[0].user_id,
      //   actorUserId: bank.user_id,
      //   category: 'Transaction',
      //   subCategory: 'PayIn',
      // });
      // }
    } else {
      return result;
    }
  } catch (error) {
    logger.error('Error processing PayIn:', error);
    throw error;
  }
};

// const calculateCommissions = async (merchantId, vendorId, amount) => {
//   const merchant = await getMerchantsDao({ id: merchantId });
//   const vendor = await getVendorsDao({ user_id: vendorId });

//   return {
//     payin_merchant_commission: calculateCommission(
//       amount,
//       merchant[0]?.payin_commission,
//     ),
//     payin_vendor_commission: calculateCommission(
//       amount,
//       vendor[0]?.payin_commission,
//     ),
//   };
// };

export const telegramResponseService = async (conn, message) => {
  try {
    const { photo } = message;
    const TELEGRAM_BOT_TOKEN = config.telegramOcrBotToken;

    if (!photo) {
      logger.error('No Telegram Message Photo found!', message);
      return;
    }

    const lastPhoto = Array.isArray(photo) ? photo.pop() : photo;
    const filePath = await getTelegramFilePath(lastPhoto?.file_id);
    const image = await getTelegramImageBase64(filePath);
    const content = await getImageContentFromOCr(image);
    sendTelegramMessage(
      message.chat?.id,
      content,
      TELEGRAM_BOT_TOKEN,
      message.message_id,
    );
    if (!content || !content.utr || !content.amount) {
      sendErrorMessageUtrOrAmountNotFoundImgTelegramBot(
        message.chat?.id,
        TELEGRAM_BOT_TOKEN,
        message.message_id,
      );
      return;
    }

    if (!message.caption) {
      sendErrorMessageNoMerchantOrderIdFoundTelegramBot(
        message.chat?.id,
        TELEGRAM_BOT_TOKEN,
        message.message_id,
      );
      return;
    }

    // Fetch initial data concurrently
    const [payIn, bankResponse] = await Promise.all([
      getPayInUrlDao({ merchant_order_id: message.caption }),
      getBankResponseDao({ utr: content.utr }),
    ]);

    // Early validation for missing critical data
    if (!payIn) {
      await sendErrorMessageTelegram(
        message.chat?.id,
        message.caption,
        TELEGRAM_BOT_TOKEN,
        message.message_id,
      );
      return;
    }
    if (!bankResponse) {
      await sendErrorMessageNoDepositFoundTelegramBot(
        message.chat?.id,
        content.utr,
        TELEGRAM_BOT_TOKEN,
        message.message_id,
      );
      return;
    }
    if (payIn.status === Status.FAILED) {
      await sendPaymentStatusMessageTelegramBot(
        message.chat?.id,
        message.caption,
        TELEGRAM_BOT_TOKEN,
        message.message_id,
        Status.FAILED,
      );
      return;
    }
    if (payIn.status === Status.INITIATED) {
      await sendPaymentStatusMessageTelegramBot(
        message.chat?.id,
        message.caption,
        TELEGRAM_BOT_TOKEN,
        message.message_id,
        Status.INITIATED,
      );
      return;
    }
    // Fetch related pay-in URLs concurrently
    const [otherBankResponsePayIns, otherUtrPayIns, otherBotResponsePayIns] =
      await Promise.all([
        payIn.bank_response_id
          ? getPayInUrlsDao({ bank_response_id: payIn.bank_response_id })
          : Promise.resolve([]),
        getPayInUrlsDao({ user_submitted_utr: content.utr }),
        bankResponse.id
          ? getPayInUrlsDao({ bank_response_id: bankResponse.id })
          : Promise.resolve([]),
      ]);

    // Check for duplicates
    const hasDuplicate = otherUtrPayIns.some(
      (item) => item.status === Status.DUPLICATE,
    );

    // Conditionally refresh otherBotResponsePayIns only if duplicate is found
    const updatedBotResponsePayIns =
      hasDuplicate || bankResponse.id
        ? await getPayInUrlsDao({ bank_response_id: bankResponse.id })
        : otherBotResponsePayIns;

    // Handle already notified or confirmed cases
    if (
      payIn.is_notified &&
      [Status.SUCCESS, Status.BANK_MISMATCH, Status.DISPUTE].includes(
        payIn.status,
      )
    ) {
      await sendAlreadyConfirmedMessageTelegramBot(
        message.chat.id,
        content.utr,
        TELEGRAM_BOT_TOKEN,
        message.message_id,
        otherUtrPayIns,
        payIn,
      );
      return;
    }

    // Handle UTR mismatch
    if (
      payIn.status === Status.PENDING &&
      payIn.user_submitted_utr !== content.utr
    ) {
      await sendUTRMismatchErrorMessageTelegram(
        message.chat?.id,
        content.utr,
        payIn.user_submitted_utr,
        TELEGRAM_BOT_TOKEN,
        message.message_id,
      );
      return;
    }

    // Handle duplicate status
    if (payIn.status === Status.DUPLICATE) {
      if (hasDuplicate) {
        await sendMerchantOrderIDStatusDuplicateTelegramMessage(
          message.chat.id,
          payIn,
          content.utr,
          TELEGRAM_BOT_TOKEN,
          message.message_id,
          otherBotResponsePayIns,
        );
        return;
      } else {
        await sendMerchantOrderIDStatusDuplicateTelegramMessage(
          message.chat.id,
          payIn,
          content.utr,
          TELEGRAM_BOT_TOKEN,
          message.message_id,
          otherUtrPayIns,
        );
        return;
      }
    }

    // Determine duplicate entries
    const duplicateEntry =
      otherBankResponsePayIns.length > 1
        ? otherBankResponsePayIns
        : otherUtrPayIns.length > 0
          ? otherUtrPayIns
          : updatedBotResponsePayIns;

    // Handle used bank response or duplicate entries
    if (bankResponse.is_used || duplicateEntry.length) {
      await sendAlreadyConfirmedMessageTelegramBot(
        message.chat.id,
        content.utr,
        TELEGRAM_BOT_TOKEN,
        message.message_id,
        duplicateEntry,
        payIn,
      );
      return;
    }

    await processPayInService(
      conn,
      {
        amount: payIn.amount,
        merchantOrderId: message.caption,
        userSubmittedUtr: content.utr,
        from_telegram: true,
        telegramMessage: message,
        telegramBotToken: TELEGRAM_BOT_TOKEN,
      },
      null,
      false,
    );
  } catch (error) {
    logger.error('Error processing Telegram response:', error);
    throw error;
  }
};

export const processPayInByImageService = async (conn, payload) => {
  try {
    const { base64Image, merchantOrderId } = payload;
    const content = await getImageContentFromOCr(base64Image);
    let payInData;
    payInData = await getPayInUrlService(merchantOrderId);

    if (payInData.one_time_used === true || payInData.is_url_expires === true) {
      const result = {
        redirect_url: payInData.config?.urls?.return,
      };
      return { error: `This payin url is already used`, result };
    }
    if (!content || !content.utr) {
      const  duration = calculateDuration(payInData.created_at);
      const payIn = await updatePayInUrlDao(payInData.id, {
        status: Status.IMG_PENDING,
        amount: payload.amount,
        is_url_expires: true,
        one_time_used: true,
        user_submitted_image: payload.fileKey,
        duration,
      });

      return {
        status: 'IMG_PENDING',
        amount: payload.amount,
        merchant_order_id: merchantOrderId,
        return_url: payIn.config?.urls?.return,
      };
    }

    return await processPayInService(conn, {
      ...payload,
      userSubmittedUtr: content.utr,
      amount: payInData.amount,
      user_submitted_image: payload.fileKey,
    });
  } catch (error) {
    logger.error('Error processing PayIn by image:', error);
    throw error;
  }
};

export const disputeDuplicateTransactionService = async (
  conn,
  payload,
  company_id,
  updated_by,
) => {
  try {
    const { payInId, merchantOrderId, confirmed, amount } = payload;
    const payIn = await getPayInUrlDao({ id: payInId, company_id });

    if (!payIn) {
      throw new BadRequestError('Invalid PayIn');
    }

    let makeItSuccess = true,
      bankId = payIn.bank_acc_id,
      updateBalance = true,
      isMismatch = false;

    if (payIn.status !== Status.DISPUTE) {
      throw new BadRequestError('PayIn Status is not DISPUTE');
    }

    if (!payIn.bank_response_id) {
      throw new NotFoundError('Bank Response not found!');
    }

    const bankResponse = await getBankResponseDao({
      id: payIn.bank_response_id,
      // is_used: true,
      company_id,
    });
    const merchants = await getMerchantsDao({
      id: payIn.merchant_id,
      company_id,
    });
    const merchant = merchants[0];
    const banks = await getBankaccountDao({ id: bankId, company_id });
    const bank = banks[0];

    if (!bank) {
      throw new NotFoundError('Bank not found!');
    }

    const vendors = await getVendorsDao({
      user_id: bank.user_id,
      company_id,
    });
    const vendor = vendors[0];

    if (!merchant) {
      throw new NotFoundError('Merchant Not Found!');
    }

    const toAmount = confirmed || amount;
    const payinCommission = calculateCommission(
      toAmount,
      merchant.payin_commission,
    );
    const vendorPayinCommission = calculateCommission(
      toAmount,
      vendor.payin_commission,
    );

    if (merchantOrderId) {
      var payInData = await getPayInUrlDao({
        merchant_order_id: merchantOrderId,
      });
      if (!payInData) {
        throw new NotFoundError('PayIn not found against merchant order id');
      }

      if (payInData.merchant_id !== payIn.merchant_id) {
        throw new BadRequestError('Please provide valid merchant order id');
      }

      if (
        ![Status.ASSIGNED, Status.DROPPED, Status.DUPLICATE].includes(
          payInData.status,
        )
      ) {
        throw new BadRequestError(
          `PayIn Status: ${payInData.status} is not Accepted`,
        );
      }

      if (payInData.status === Status.DUPLICATE) {
        if (payIn.user_submitted_utr != payInData.user_submitted_utr) {
          throw new BadRequestError(
            `UTR ${payIn.user_submitted_utr} MisMatches with ${payInData.user_submitted_utr} User Submitted UTR `,
          );
        }
      }
      if (
        payIn.user_submitted_utr &&
        payIn.user_submitted_utr != bankResponse.utr
      ) {
        throw new BadRequestError(
          `UTR ${payIn.user_submitted_utr} MisMatches with ${bankResponse.utr} User Submitted UTR `,
        );
      }

      if (merchantOrderId !== payIn.merchant_order_id) {
        makeItSuccess = false;
      }
    }
    const duration = calculateDuration(payIn.created_at);
    let response = {};
    let newEntryResponse = {};
    if (!makeItSuccess) {
      const newStatus =
        payInData.bank_acc_id != payIn.bank_acc_id
          ? Status.BANK_MISMATCH
          : parseFloat(payInData.amount) != parseFloat(toAmount)
            ? Status.DISPUTE
            : Status.SUCCESS;
      // make new pay in success
      if (newStatus === Status.SUCCESS) {
        newEntryResponse = await updatePayInUrlDao(payInData.id, {
          is_url_expires: true,
          one_time_used: true,
          is_notified: true,
          duration,
          status: newStatus,
          approved_at: new Date(),
          payin_merchant_commission: payinCommission,
          payin_vendor_commission: vendorPayinCommission,
          bank_response_id: payIn.bank_response_id,
          updated_by,
        });
        await updateCalculationTable(merchant.user_id, {
          payinCommission,
          amount: toAmount,
        });
      } else {
        newEntryResponse = await updatePayInUrlDao(payInData.id, {
          is_url_expires: true,
          one_time_used: true,
          is_notified: true,
          duration,
          status: newStatus,
          bank_response_id: payIn.bank_response_id,
          updated_by,
        });
      }

      if ([Status.BANK_MISMATCH, Status.SUCCESS].includes(newStatus)) {
        bankId = payInData.bank_acc_id;
        isMismatch = true;
      } else {
        updateBalance = false;
      }
      // This is async function but it's just the callback sending function there fore we are not using await
      merchantPayinCallback(payIn.config?.urls?.notify, {
        status: newStatus,
        merchantOrderId: merchantOrderId,
        payinId: payInData.id,
        amount: toAmount,
        req_amount: payInData.amount,
        utr_id: bankResponse.utr,
      });
    }

    const updatePayload = {
      is_url_expires: true,
      one_time_used: true,
      is_notified: true,
      duration,
      updated_by,
    };

    if (makeItSuccess) {
      updatePayload.status = Status.SUCCESS;
      updatePayload.amount = toAmount;
      updatePayload.payin_merchant_commission = payinCommission;
      updatePayload.payin_vendor_commission = vendorPayinCommission;
    } else {
      updatePayload.status = Status.FAILED;
    }

    response = await updatePayInUrlDao(payIn.id, updatePayload);
    // await updateVendorBalanceDao(
    //   { user_id: bankResponse.user_id },
    //   toAmount,
    //   updated_by,
    //   conn,
    // );
    // This is async function but it's just the callback sending function there fore we are not using await
    merchantPayinCallback(payIn.config?.urls?.notify, {
      status: updatePayload.status,
      merchantOrderId: payIn.merchant_order_id,
      payinId: payIn.id,
      amount: toAmount,
      req_amount: payIn.amount,
      utr_id: bankResponse.utr,
    });

    if (updateBalance && !isMismatch) {
      await updateMerchantBalanceDao(
        { id: payIn.merchant_id },
        toAmount,
        updated_by,
        conn,
      );
      await updateCalculationTable(merchant.user_id, {
        payinCommission,
        amount: toAmount,
      });
    }
    const [company] = await getCompanyByIDDao({
      id: payIn.company_id,
    });

    await sendTelegramDisputeMessage(
      company.config?.telegramDuplicateDisputeChatId,
      payIn,
      response,
      newEntryResponse,
      bank.nick_name,
      bankResponse.utr,
      company.config?.telegramBotToken,
    );
    // Notify admins and users about payin status updates
    // const notifyPayload = {
    //   conn,
    //   payloadUserId: merchant.user_id,
    //   actorUserId: updated_by,
    //   category: 'Transaction',
    //   subCategory: 'PayIn',
    //   additionalRecipients: [vendor.user_id],
    // };

    // const notifications = [];

    // if (
    //   newEntryResponse &&
    //   typeof newEntryResponse === 'object' &&
    //   newEntryResponse.merchant_order_id !== undefined &&
    //   response?.merchant_order_id !== newEntryResponse.merchant_order_id
    // ) {
    // notifications.push(
    //   notifyAdminsAndUsers({
    //     ...notifyPayload,
    //     company_id: response.company_id,
    //     message: `Payin with merchant order id: ${response.merchant_order_id} has been Failed.`,
    //   }),
    //   notifyAdminsAndUsers({
    //     ...notifyPayload,
    //     company_id: newEntryResponse.company_id,
    //     message: `Payin with merchant order id: ${newEntryResponse.merchant_order_id} has been updated.`,
    //   }),
    // );
    // } else {
    // notifications.push(
    //   notifyAdminsAndUsers({
    //     ...notifyPayload,
    //     company_id: response.company_id,
    //     message: `Payin with merchant order id: ${response.merchant_order_id} has been updated.`,
    //   }),
    // );
    // }

    // await Promise.all(notifications);
    await newTableEntry(tableName.PAYIN);
    return response;
  } catch (error) {
    logger.error('Error in disputeDuplicateTransactionService:', error.message);
    throw error;
  }
};

export const telegramCheckUTRService = async (
  conn,
  utr,
  merchant_order_id,
  company_id,
  updated_by,
) => {
  try {
    const bankResponse = await getBankResponseDao({
      utr: utr,
      status: '/success',
    });
    let otherBankResponse = {};
    const payIn = await getPayInUrlDao({ merchant_order_id });
    if (!bankResponse) {
      throw new NotFoundError(`UTR ${utr} not found`);
    } else if (bankResponse.status !== '/success') {
      throw new BadRequestError(
        `UTR ${utr} found with ${bankResponse.status} STATUS`,
      );
    } else if (!payIn) {
      throw new NotFoundError(
        `MerchantOrderID ${merchant_order_id} not found`,
      );
    } else if (payIn?.user_submitted_utr && utr !== payIn?.user_submitted_utr) {
      throw new BadRequestError(
        `${utr} UTR Does Not match with ${payIn?.merchant_order_id} Merchant Order ID`,
      );
    }

    await createCheckUtrService(
      conn,
      {
        payin_id: payIn.id,
        utr,
        company_id: company_id,
        created_by: updated_by,
        updated_by,
      },
      merchant_order_id,
      utr,
    );

    if (payIn.bank_response_id) {
      otherBankResponse =
        (await getBankResponseDao({ id: payIn.bank_response_id })) || {};
    }

    // check old code flow
    if (payIn.status === Status.SUCCESS) {
      return {
        message: `${payIn.merchant_order_id} is already confirmed with ${payIn.user_submitted_utr || otherBankResponse.utr || ''}`,
      };
    }

    const isAlreadyExit = await getPayInUrlDao({
      bank_response_id: bankResponse.id,
    });

    if (isAlreadyExit) {
      return {
        message: `Utr: ${utr} is ${isAlreadyExit.status} with ${isAlreadyExit.merchant_order_id}`,
      };
    }

    if (![Status.ASSIGNED, Status.DROPPED].includes(payIn.status)) {
      return {
        status: payIn.status,
        message: `${payIn.merchant_order_id} is in ${payIn.status} with ${payIn.user_submitted_utr || otherBankResponse.utr || ''}`,
      };
    }
    // updatePayInUrlDao({ id: payIn.id }, { is_url_expires: false }, conn);

    return await processPayInService(
      conn,
      {
        userSubmittedUtr: utr,
        merchantOrderId: merchant_order_id,
        amount: payIn.amount,
      },
      updated_by,
      false,
    );
  } catch (error) {
    logger.error('Error in telegramCheckUTRService:', error);
    throw error;
  }
};

export const getPayinsServiceById = async (id) => {
  try {
    return await getPayInUrlDao({ id });
  } catch (error) {
    logger.error('Error in getPayinsServiceById:', error);
    throw error;
  }
};

export const updateUtrPayinService = async (conn, id, user_id, utr) => {
  try {
    const updatedUtr = utr && !utr.endsWith('FAILED') ? utr + 'FAILED' : utr;
    const payload = {
      user_submitted_utr: updatedUtr,
      bank_response_id: null,
      updated_by: user_id,
    };
    const updateUtr = await updatePayInUrlDao(id, payload, conn);
    return updateUtr;
  } catch (error) {
    logger.error('Error in updateUtrPayinService:', error);
    throw error;
  }
};

export const checkPendingPayinStatusService = async (
  conn,
  user_id,
  company_id,
  user_name,
) => {
  try {
    const payins = await getPayInPendingDao({
      company_id,
      status: Status.PENDING,
    });
    const processedPayinIds = [];
    for (const currentPayin of payins) {
      let duration;
      const botResFilters = {
        is_used: false,
        status: '/success',
        utr: currentPayin.user_submitted_utr,
      };
      const botRes = await getBankResponseDao(botResFilters);
      let bot = [botRes];
      if (botRes) {
        const bankResponse = bot[0];
        const bankDetails = await getBankaccountDao({
          id: currentPayin.bank_acc_id,
        });
        const merchantData = await getMerchantsByCodeDao(
          currentPayin?.merchant,
        );
        const vendor = await getVendorsDao({ user_id: bankDetails[0].user_id });
        const payinMerchantCommission = calculateCommission(
          bankResponse.amount,
          merchantData[0].payin_commission,
        );
        const payinVendorCommission = calculateCommission(
          bankResponse.amount,
          vendor[0].payin_commission,
        );
        // Check for bank ID mismatch
        duration = calculateDuration(currentPayin.created_at);
        if (bankDetails[0].id !== bankResponse.bank_id) {
          const payInData = {
            status: Status.BANK_MISMATCH,
            is_notified: true,
            user_submitted_utr: bankResponse.utr,
            bank_response_id: bankResponse.id,
            // approved_at: new Date(),
            duration: duration,
            updated_by: user_id,
          };
          const updatePayInDataRes = await updatePayInUrlDao(
            currentPayin.id,
            payInData,
            conn,
          );
          await updateBotResponseDao(
            bankResponse.id,
            { is_used: true, updated_by: user_name },
            conn,
          );

          if (updatePayInDataRes) {
            // This is async function but it's just the callback sending function there fore we are not using await
            merchantPayinCallback(updatePayInDataRes.config.urls?.notify, {
              status: updatePayInDataRes.status,
              merchantOrderId: updatePayInDataRes.merchant_order_id,
              payinId: updatePayInDataRes.id,
              amount: bankResponse.amount,
              req_amount: updatePayInDataRes.amount,
              utr_id: updatePayInDataRes.utr,
            });
          }
          processedPayinIds.push(currentPayin.id);
          logger.warn(`Bank mismatch for payin ${currentPayin.id}:`, {
            payin_bank_id: currentPayin.bank_acc_id,
            bank_response_bank_id: bankResponse.bank_id,
          });
        }

        // Check for amount mismatch
        else if (currentPayin.amount !== bankResponse.amount) {
          duration = calculateDuration(currentPayin.created_at);
          const payInData = {
            status: Status.DISPUTE,
            is_notified: true,
            user_submitted_utr: bankResponse.utr,
            bank_response_id: bankResponse.id,
            // approved_at: new Date(),
            payin_merchant_commission: payinMerchantCommission,
            payin_vendor_commission: payinVendorCommission,
            duration: duration,
            updated_by: user_id,
          };
          const updatePayInDataRes = await updatePayInUrlDao(
            currentPayin.id,
            payInData,
            conn,
          );
          await updateBotResponseDao(
            bankResponse.id,
            { is_used: true, updated_by: user_name },
            conn,
          );

          if (updatePayInDataRes) {
            // This is async function but it's just the callback sending function there fore we are not using await
            merchantPayinCallback(updatePayInDataRes.config.urls?.notify, {
              status: updatePayInDataRes.status,
              merchantOrderId: updatePayInDataRes.merchant_order_id,
              payinId: updatePayInDataRes.id,
              amount: bankResponse.amount,
              req_amount: updatePayInDataRes.amount,
              utr_id: updatePayInDataRes.utr,
            });
          }
          logger.warn(`Amount dispute for payin ${currentPayin.id}:`, {
            payin_amount: currentPayin.amount,
            bank_response_amount: bankResponse.amount,
          });
          processedPayinIds.push(currentPayin.id);
        }

        // If checks pass, update with provided payload and mark as valid
        else {
          duration = calculateDuration(currentPayin.created_at);
          const payInData = {
            status: Status.SUCCESS,
            is_notified: true,
            user_submitted_utr: botRes.utr,
            // approved_at: new Date(),
            duration: duration,
            payin_merchant_commission: payinMerchantCommission,
            payin_vendor_commission: payinVendorCommission,
            bank_response_id: botRes.id,
            updated_by: user_id,
          };
          const updatePayInDataRes = await updatePayInUrlDao(
            currentPayin.id,
            payInData,
            conn,
          );
          await updateBotResponseDao(
            bankResponse.id,
            { is_used: true, updated_by: user_name },
            conn,
          );
          await updateCalculationTable(
            merchantData[0].user_id,
            {
              amount: bankResponse.amount,
              payinCommission: payinMerchantCommission,
            },
            conn,
          );
          // This is async function but it's just the callback sending function there fore we are not using await
          merchantPayinCallback(updatePayInDataRes.config.urls?.notify, {
            status: updatePayInDataRes.status,
            merchantOrderId: updatePayInDataRes.merchant_order_id,
            payinId: updatePayInDataRes.id,
            amount: bankResponse.amount,
            req_amount: updatePayInDataRes.amount,
            utr_id: updatePayInDataRes.utr,
          });
          processedPayinIds.push(currentPayin.id);
          logger.log(`Valid match found for payin ${currentPayin.id}`);
        }
      }
    }
    if (processedPayinIds.length >= 1) {
      await newTableEntry(tableName.PAYIN);
    }
    return processedPayinIds;
  } catch (error) {
    logger.error('Error in checkPendingPayinStatusService:', error);
    throw error;
  }
};

export const verifyPayinsService = async (
  merchantOrderId,
  user_location,
  oneTimeUsed,
) => {
  try {
    const payIn = await getPayInUrlService(merchantOrderId);

    if (!payIn) {
      throw new BadRequestError('Invalid merchant order id');
    }

    if (
      usedTokens.has(merchantOrderId) ||
      payIn.one_time_used === true ||
      oneTimeUsed === 'true'
    ) {
      // Update config and one_time_used in a single DB call
      const updatedConfig = stringifyJSON({
        ...payIn.config,
        user: user_location,
        page_reload: true,
      });

      await updatePayInUrlDao(payIn.id, {
        config: updatedConfig,
        one_time_used: true,
      });

      const result = {
        redirect_url: payIn.config?.urls?.return,
      };
      return { error: `This payin url is already used`, result };
    }

    const updatedConfig = stringifyJSON({
      ...payIn.config,
      user: user_location,
    });
    const merchant = await getMerchantsDao({ id: payIn.merchant_id });
    const blockedUsers = merchant[0].config.blocked_users;
    if (Array.isArray(blockedUsers)) {
      const isUserBlocked = blockedUsers.some(
        (user) => user.userId === payIn.user,
      );
      const isIpBlocked = blockedUsers.some(
        (user) => user.user_ip === user_location.user_ip,
      );
      if (isUserBlocked || isIpBlocked) {
        throw new BadRequestError('User Access Denied !');
      }
    }
    const updateResult = await updatePayInUrlDao(payIn.id, {
      config: updatedConfig,
      one_time_used: oneTimeUsed || false,
    });

    if (!updateResult) {
      throw new InternalServerError('Failed to update payin URL');
    }
    if (oneTimeUsed === 'true' && updateResult.one_time_used) {
      // If already used
      const result = {
        redirect_url: payIn.config?.urls?.return,
      };
      return { error: `This payin url is already used`, result };
    }

    const banks = await getMerchantBankDao({
      config_merchants_contains: merchant[0].id,
    });
    const enabledBanks = banks.filter((bank) => {
      const isPayInBank = ['PayIn', 'payIn'].includes(bank.bank_used_for);
      const isActive = bank.is_enabled && isPayInBank;
      const hasAnyMethod =
        bank.is_qr ||
        bank.is_bank ||
        bank.config?.is_phonepay ||
        bank.config?.is_intent;
      return isActive && hasAnyMethod;
    });

    const result = {
      expiryTime: payIn.expiration_date,
      amount: payIn.amount,
      one_time_used: payIn.one_time_used,
      status: payIn.status,
      min_amount: merchant[0].min_payin,
      max_amount: merchant[0].max_payin,
      is_qr: enabledBanks.some((bank) => bank.is_qr),
      is_phonepay: enabledBanks.some((bank) => bank.config?.is_phonepay),
      is_bank: enabledBanks.some((bank) => bank.is_bank),
      redirect_url: payIn.config?.urls?.return,
    };
    const response = {
      ...result,
      merchantOrderId,
    };
    usedTokens.add(merchantOrderId);
    logger.info('PayIn URL verified successfully:', response);
    return result;
  } catch (error) {
    logger.error('Error in verifyPayinsService:', error);
    throw error;
  }
};

export const generateUpiUrlService = async (payload) => {
  try {
    if (isNaN(payload.amount) || payload.amount <= 0) {
      return new BadRequestError('Invalid amount');
    }

    const vpaRegex = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;
    if (!vpaRegex.test(payload.payeeVPA)) {
      return new BadRequestError('Invalid VPA format');
    }

    const uuid = generateUUID();
    const transactionId = `IND${uuid.replace(/-/g, '')}`.slice(0, 32);

    const params = {
      tr: transactionId,
      am: parseFloat(payload.amount).toFixed(2),
      pa: payload.payeeVPA,
      pn: payload.payeeName?.trim() || '',
      tn: payload.transactionNote?.trim() || '',
      cu: 'INR',
    };

    // Optional fields
    if (payload.merchantCode) params.mc = payload.merchantCode;
    if (payload.businessName) params.bn = payload.businessName.trim();
    if (payload.mode) params.mode = payload.mode;
    if (payload.purpose) params.purpose = payload.purpose;
    // params.appid = 'inb_admin'; // Optional, Paytm-specific

    const encodedParams = querystring.stringify(params);

    // Intent UPI links
    const paytmUrl = `upi://pay?${encodedParams}&ap=net.one97.paytm`;
    const gpayUrl = `upi://pay?${encodedParams}&ap=com.google.android.apps.nbu.paisa.user`;
    const phonepeUrl = `upi://pay?${encodedParams}&ap=com.phonepe.app`;
    const genericUpiUrl = `upi://pay?${encodedParams}`;

    return {
      phonepeUrl,
      // phonepeQr,
      gpayUrl,
      // gpayQr,
      paytmUrl,
      // paytmQr,
      genericUpiUrl,
      // genericUpiQr,
      transactionId,
    };
    // return data;

    // const params = {
    //   pa: payload.payeeVPA,
    //   pn: payload.payeeName?.trim() || 'Payee',
    //   tr: transactionId,
    //   am: parseFloat(payload.amount).toFixed(2),
    //   tn: payload.transactionNote?.trim() || 'Payment',
    //   cu: 'INR',
    // };

    // const upiParams = Object.entries(params)
    //   .map(([key, val]) => `${key}=${encodeURIComponent(val)}`)
    //   .join('&');
    // const upiUrl = `upi://pay?${upiParams}`;

    // const upiUrl = `upi://pay?${querystring.stringify(params)}`;

    // const upiQr = await QRCode.toDataURL(upiUrl);
    // return {
    //   upiUrl,
    //   upiQr,
    //   transactionId,
    // };
  } catch (error) {
    logger.error('Error in generateUpiUrlService:', error);
    throw error;
  }
};

const checkIsPayInExpired = (payIn) => {
  if (Number(payIn.expiration_date) < Date.now() || payIn.is_url_expires) {
    // throw new BadRequestError('PayIn has been expired already!');
    return { message: `PayIn has been expired already!` };
  }

  return false;
};

export const updateCalculationTable = async (user_id, data, conn) => {
  try {
    if (isNaN(Number(data.amount) - Number(data.payinCommission))) {
      throw new BadRequestError('Invalid amount or commission');
    }
    if (user_id) {
      const calculationData = await getCalculationforCronDao(user_id);
      if (!calculationData[0]) {
        throw new NotFoundError('Calculation not found!');
      }

      const totalAmount = Number(data.amount) - Number(data.payinCommission);
      const calculationId = calculationData[0].id;
      await updateCalculationBalanceDao(
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
    }
  } catch (error) {
    logger.error('Error in updateCalculationTable:', error);
    throw error;
  }
};

const getOtherSuccessPayIns = async (bankResponse, includeSuccess = true) => {
  try {
    const extraCondition = {};
    if (includeSuccess) {
      extraCondition.status = Status.SUCCESS;
    }
    let successData = await getPayInUrlsDao({
      bank_response_id: bankResponse.id,
      ...extraCondition,
    });
    if (!successData.length) {
      successData = await getPayInUrlsDao({
        user_submitted_utr: bankResponse.utr,
        ...extraCondition,
      });
    }

    return successData;
  } catch (error) {
    logger.error('Error in getOtherSuccessPayIns:', error);
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
  count
) => {
  try {
    if (!currentCalculation) return;

    const updates = {
      total_payin_commission: amountDiff > 0 ? commission : -commission,
      total_payin_amount: amountDiff,
      total_payin_count : count?count:0,
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
            total_adjustment_commission:
              amountDiff > 0 ? commission : -commission,
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
    logger.error('Error updating calculation balances:', error);
    throw error;
  }
};

export const updatePayInService = async (
  conn,
  payload,
  merchant_order_id,
  user_id,
  company_id,
) => {
  try {
    let bankResponseDataUtr;
    let updatedBankAccIdData;
    // Validate payload
    if (!payload && (!payload.amount || !payload.utr || !payload.bank_acc_id)) {
      throw new BadRequestError(
        'At least one of amount, utr, or bank_acc_id must be provided',
      );
    }

    // Fetch pay-in and bank response concurrently
    const [payIn, bankResponse] = await Promise.all([
      getPayInUrlDao({ merchant_order_id }),
      getBankResponseDao({
        id: (await getPayInUrlDao({ merchant_order_id })).bank_response_id,
      }),
    ]);

    if (!payIn) {
      throw new BadRequestError('Invalid merchant order id');
    }
    if (!bankResponse) {
      throw new NotFoundError('Bank Response not found');
    }

    let amountDiff = 0;
    let vendorCommission = 0;
    let merchantCommission = 0;

    const [vendor, merchant] = await Promise.all([
      getVendorsDao({
        user_id: (await getBankaccountDao({ id: bankResponse.bank_id }))[0]
          .user_id,
      }),
      getMerchantsDao({ id: payIn.merchant_id }),
    ]);

    // const merchant_user_id = merchant[0].user_id;
    // const vendor_user_id = vendor[0].user_id;
    // Handle amount updates
    if (
      payload?.amount &&
      !isNaN(payload.amount) &&
      payload.amount !== bankResponse.amount
    ) {
      amountDiff = payload.amount - bankResponse.amount;

      // Fetch bank, vendor, and merchant data concurrently
      const [bank] = await Promise.all([
        getBankaccountDao({ id: bankResponse.bank_id }),
      ]);

      if (!bank[0] || !vendor[0] || !merchant[0]) {
        throw new NotFoundError('Bank, vendor, or merchant not found');
      }
      // Calculate commissions
      vendorCommission = calculateCommission(
        Math.abs(amountDiff),
        vendor[0].payin_commission,
      );
      merchantCommission = calculateCommission(
        Math.abs(amountDiff),
        merchant[0].payin_commission,
      );

      // Fetch calculation data for vendor and merchant
      const [vendorCalculationData, merchantCalculationData] =
        await Promise.all([
          getAllCalculationforCronDao(vendor[0].user_id),
          getAllCalculationforCronDao(merchant[0].user_id),
        ]);

      if (!vendorCalculationData[0] || !merchantCalculationData[0]) {
        throw new NotFoundError('Calculation data not found');
      }

      // Filter calculations by date
      const approvedDate = getDateWithoutTime(payIn.approved_at);

      const vendorCurrentCalculations = vendorCalculationData.filter(
        (calc) => approvedDate === getDateWithoutTime(calc.created_at),
      );
      const vendorCalculations = vendorCalculationData.filter(
        (calc) => approvedDate < getDateWithoutTime(calc.created_at),
      );
      const merchantCurrentCalculations = merchantCalculationData.filter(
        (calc) => approvedDate === getDateWithoutTime(calc.created_at),
      );
      const merchantCalculations = merchantCalculationData.filter(
        (calc) => approvedDate < getDateWithoutTime(calc.created_at),
      );

      if (!vendorCurrentCalculations[0] || !merchantCurrentCalculations[0]) {
        throw new NotFoundError('Matching calculation not found');
      }

      // Batch all updates in a single transaction
      await Promise.all([
        updateBankResponseDao(
          { id: bankResponse.id, company_id: company_id },
          { amount: payload.amount, updated_by: user_id },
          conn,
        ),
        updateBankaccountDao(
          { id: bankResponse.bank_id, company_id: company_id },
          {
            balance: bank[0].balance + amountDiff,
            today_balance: bank[0].today_balance + amountDiff,
            updated_by: user_id,
          },
          conn,
        ),
        updateVendorDao(
          { id: vendor[0].user_id, company_id: company_id },
          { balance: vendor[0].balance + amountDiff, updated_by: user_id },
          conn,
        ),
        updateCalculationBalances(
          vendorCurrentCalculations,
          vendorCalculations,
          amountDiff,
          vendorCommission,
          conn,
        ),
        updateCalculationBalances(
          merchantCurrentCalculations,
          merchantCalculations,
          amountDiff,
          merchantCommission,
          conn,
        ),
      ]);
    }
    // Handle UTR updates
    else if (payload?.utr) {
      const bot = await getBankResponseDao({ utr: payload?.utr, company_id });
      if (bot) {
        logger.error(`Bank response found: ${payload?.utr}`);
        throw new NotFoundError(
          'This UTR has already been used. Please provide a new one.',
        );
      }
      bankResponseDataUtr = await updateBankResponseDao(
        { id: bankResponse.id, company_id: company_id },
        { utr: payload.utr, updated_by: user_id },
        conn,
      );
    }
    // Handle bank account ID updates
    else if (payload?.bank_acc_id) {
      const [prevBank, newBank] = await Promise.all([
        getBankaccountDao({ id: bankResponse.bank_id }),
        getBankaccountDao({ id: payload.bank_acc_id }),
      ]);

      if (!prevBank[0] || !newBank[0]) {
        throw new NotFoundError('Bank account not found');
      }

      if (newBank[0].id === prevBank[0].id) {
        throw new BadRequestError('Please provide a different bank account ID');
      }
      if (newBank[0].user_id !== prevBank[0].user_id) {
        const [prevVendor, newVendor] = await Promise.all([
          getVendorsDao({ user_id: prevBank[0].user_id }),
          getVendorsDao({ user_id: newBank[0].user_id }),
        ]);

        if (!prevVendor[0] || !newVendor[0]) {
          throw new NotFoundError('Vendor not found');
        }

        const [prevVendorCalc, newVendorCalc] = await Promise.all([
          getAllCalculationforCronDao(prevVendor[0].user_id),
          getAllCalculationforCronDao(newVendor[0].user_id),
        ]);


        if (!prevVendorCalc[0] || !newVendorCalc[0]) {
          throw new NotFoundError('Calculation data not found');
        }

        const approvedDate = getDateWithoutTime(bankResponse.created_at);

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
          Math.abs(bankResponse.amount),
          prevVendor[0].payin_commission,
        );
        const newVendorCommission = calculateCommission(
          Math.abs(bankResponse.amount),
          newVendor[0].payin_commission,
        );

        await Promise.all([
          updateCalculationBalances(
            prevVendorCurrentCalcs,
            prevVendorNextCurrentCalcs,
            -bankResponse.amount,
            -prevVendorCommission,
            conn,
            -1,
          ),
          updateCalculationBalances(
            newVendorCurrentCalcs,
            newVendorNextCurrentCalcs,
            bankResponse.amount,
            newVendorCommission,
            conn,
            1,
          ),
        ]);
      }

      const [newBankData] =
        await Promise.all([
          updateBankaccountDao(
            { id: prevBank[0].id, company_id: company_id },
            {
              balance: prevBank[0].balance - bankResponse.amount,
              today_balance: prevBank[0].today_balance - bankResponse.amount,
              updated_by: user_id,
            },
            conn,
          ),
          updateBankaccountDao(
            { id: newBank[0].id, company_id: company_id },
            {
              balance: newBank[0].balance + bankResponse.amount,
              today_balance: newBank[0].today_balance + bankResponse.amount,
              updated_by: user_id,
            },
            conn,
          ),
          updateBankResponseDao(
            { id: bankResponse.id, company_id: company_id },
            { bank_id: payload.bank_acc_id, updated_by: user_id },
            conn,
          ),
        ]);
      if (!newBankData) {
        throw new NotFoundError('Bank account not found');
      }
      updatedBankAccIdData = newBankData;
    }

    delete payload.utr;

    const bankResponseId = await getPayInUrlDao({ merchant_order_id });
    if (!bankResponseId) {
      throw new NotFoundError('Bank Response ID not found for this pay-in');
    }
    const bankResponseData = await getBankResponseDaoById({
      id: bankResponseId.bank_response_id,
      company_id: company_id,
    });
    const payInBank = await getBankaccountDao({
      id: payIn.bank_acc_id,
      company_id: company_id,
    });
    if (!payInBank[0]) {
      throw new NotFoundError('Bank Response not found for this pay-in');
    }
    // Parse existing config and add update history
    let existingConfig = {};
    try {
      existingConfig =
        typeof payIn.config === 'string'
          ? JSON.parse(payIn.config)
          : payIn.config || {};
    } catch (e) {
      logger.error('Error parsing existing config:', e);
      existingConfig = {};
    }
    // Add update history to config
    const updateHistory = {
      updated_by: user_id,
      updated_at: new Date(),
      amount: payIn.amount,
      utr: bankResponseData?.utr,
      bank_acc_id: payInBank[0]?.id,
      nick_name: payInBank[0]?.nick_name,
      payin_vendor_commission: payIn.payin_vendor_commission,
      payin_merchant_commission: payIn.payin_merchant_commission,
    };

    // Create new config object
    const newConfig = {
      ...existingConfig,
      history: Array.isArray(existingConfig.history)
        ? [...existingConfig.history, updateHistory]
        : [updateHistory],
      urls: existingConfig.urls || {},
    };

    // Update pay-in details
    const updatedPayIn = await updatePayInUrlDao(
      payIn.id,
      {
        ...payload,
        updated_by: user_id,
        user_submitted_utr: payIn.user_submitted_utr ? payload.utr : null,
        config: newConfig,
        payin_merchant_commission:
          amountDiff > 0
            ? payIn.payin_merchant_commission + merchantCommission
            : payIn.payin_merchant_commission - merchantCommission,
        payin_vendor_commission:
          amountDiff > 0
            ? payIn.payin_vendor_commission + vendorCommission
            : payIn.payin_vendor_commission - vendorCommission,
      },
      conn,
    );

    // await notifyAdminsAndUsers({
    //   conn,
    //   company_id: payIn.company_id,
    //   message: `Payin with merchant order id: ${payIn.merchant_order_id} has been updated.`,
    //   payloadUserId: merchant_user_id,
    //   actorUserId: user_id,
    //   category: 'Transaction',
    //   subCategory: 'PayIn',
    //   additionalRecipients: [vendor_user_id],
    // });
    const updatedPayInData = {
      ...updatedPayIn,
      nick_name: updatedBankAccIdData?.nick_name,
      bank_res_details: {
        utr: bankResponseDataUtr?.utr || bankResponseData?.utr,
        amount: updatedPayIn?.amount,
      },
    };
    await newTableEntry(tableName.PAYIN, updatedPayInData);

    return updatedPayInData;
  } catch (error) {
    logger.error(`Error in updatePayInService: ${error.message}`, {
      error,
      merchant_order_id,
      user_id,
    });
    throw error;
  }
};
