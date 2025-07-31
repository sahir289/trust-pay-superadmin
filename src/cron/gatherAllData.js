import cron from 'node-cron';
import { getMerchantsDao } from '../apis/merchants/merchantDao.js';
import { getCalculationDao } from '../apis/calculation/calculationDao.js';
import { getBankaccountDao } from '../apis/bankAccounts/bankaccountDao.js';
import { sendTelegramDashboardReportMessage } from '../utils/sendTelegramMessages.js';
import config from '../config/config.js';
import { getConnection } from '../utils/db.js';
import { getVendorsDao } from '../apis/vendors/vendorDao.js';
import { logger } from '../utils/logger.js';
import { getUserHierarchysDao } from '../apis/userHierarchy/userHierarchyDao.js';
import { getCompanyDao } from '../apis/company/companyDao.js';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone.js';
import utc from 'dayjs/plugin/utc.js';
import collectBankData from './bankCron.js';

// Initialize dayjs plugins
dayjs.extend(utc);
dayjs.extend(timezone);

// Track retry attempts for both cron jobs
let dailyRetryCount = 0;
let hourlyRetryCount = 0;
const MAX_RETRIES = 3; // Total attempts: 1 initial + 2 retries

//run only on server - side /production level
if (process.env.NODE_ENV === 'production') {
  cron.schedule('0 0 * * *', async () => {
    dailyRetryCount = 0; // Reset retry count for new day
    await executeWithRetry('daily', 'Daily gather all cron job at 12:00 AM IST (Attempt 1)');
  });

  cron.schedule('0 1-23 * * *', async () => {
    hourlyRetryCount = 0; // Reset retry count for new hour
    const currentHour = dayjs().tz('Asia/Kolkata').hour();
    await executeWithRetry('hourly', `Hourly gather all cron job at ${currentHour}:00 IST (Attempt 1)`);
  });
} else {
  logger.error('Cron jobs are disabled in non-production environments.');
}

// Function to execute cron with retry mechanism
const executeWithRetry = async (cronType, attemptDescription) => {
  const isDaily = cronType === 'daily';
  const retryCount = isDaily ? ++dailyRetryCount : ++hourlyRetryCount;
  
  logger.info(`Running ${attemptDescription}`);
  
  try {
    if (isDaily) {
      await gatherAllDataForAllCompanies('N', 'Asia/Kolkata');
    } else {
      await gatherAllDataForAllCompanies('H', 'Asia/Kolkata');
    }
    logger.info(`${cronType} cron job executed successfully on ${attemptDescription}`);
  } catch (error) {
    logger.error(`${cronType} cron job failed on ${attemptDescription}:`, error?.message);
    
    // If we haven't reached max retries, schedule next attempt after 10 seconds
    if (retryCount < MAX_RETRIES) {
      const nextAttempt = retryCount + 1;
      logger.info(`Scheduling ${cronType} retry attempt ${nextAttempt} in 10 seconds...`);
      
      setTimeout(async () => {
        const currentTime = dayjs().tz('Asia/Kolkata');
        let nextAttemptDesc;
        
        if (isDaily) {
          const seconds = retryCount * 10;
          nextAttemptDesc = `Daily gather all cron job at 12:00:${seconds.toString().padStart(2, '0')} AM IST (Attempt ${nextAttempt})`;
        } else {
          const currentHour = currentTime.hour();
          const seconds = retryCount * 10;
          nextAttemptDesc = `Hourly gather all cron job at ${currentHour}:00:${seconds.toString().padStart(2, '0')} IST (Attempt ${nextAttempt})`;
        }
        
        await executeWithRetry(cronType, nextAttemptDesc);
      }, 10000); // 10 seconds delay
    } else {
      logger.error(`All ${MAX_RETRIES} attempts failed for ${cronType} cron job. Execution unsuccessful.`);
    }
  }
};

// Function to gather data for all companies
const gatherAllDataForAllCompanies = async (type = 'N', timezone = 'Asia/Kolkata') => {
  try {
    logger.info('Starting gather data for all companies');
    
    // Get all companies
    const companies = await getCompanyDao({});
    
    if (!companies || companies.length === 0) {
      logger.info('No companies found');
      return;
    }

    // Process each company (sequential processing for safety)
    // for (const company of companies) {
    //   try {
    //     logger.info(`Processing company: ${company.id}`);
    //     await gatherAllData(company.id, type, timezone);
    //   } catch (error) {
    //     logger.error(`Error processing company ${company.id}: ${error}`);
    //   }
    // }
    
    // Alternative: Parallel processing (uncomment if you want faster processing)
    await Promise.allSettled(
      companies.map(async (company) => {
        try {
          logger.info(`Processing company: ${company.id}`);
          await gatherAllData(company.id, type, timezone);
        } catch (error) {
          logger.error(`Error processing company ${company.id}: ${error}`);
        }
      })
    );
    
    logger.info('Completed gather data for all companies');
    
    // Run bank CRON after all companies have been processed (only for daily reports)
    if (type === 'N') {
      logger.info('Bank CRON Started for all companies');
      await collectBankData(timezone);
      logger.info('Bank CRON Ended for all companies');
    }
  } catch (error) {
    logger.error(`Error in gatherAllDataForAllCompanies: ${error}`);
  }
};

const gatherAllData = async (company_id, type = 'N', timezone = 'Asia/Kolkata') => {
  let conn;
  try {
    conn = await getConnection();

    let sDate;
    let eDate;
    if (typeof timezone !== 'string') {
      timezone = 'Asia/Kolkata';
    }

    const currentDate = dayjs().tz(timezone);
    if (type === 'H') {
      sDate = currentDate.clone().startOf('day').toDate();
      eDate = currentDate.clone().toDate();
    } else if (type === 'N') {
      sDate = currentDate.clone().subtract(1, 'day').startOf('day').toDate();
      eDate = currentDate.clone().subtract(1, 'day').endOf('day').toDate();
    } else {
      sDate = currentDate.clone().subtract(1, 'day').toDate();
      eDate = currentDate.clone().toDate();
    }

    logger.info(`Dashboard Report CRON Started for company: ${company_id}`);
    
    // Get company details with config
    const companies = await getCompanyDao({ id: company_id });
    const company = companies && companies.length > 0 ? companies[0] : null;
    
    if (!company) {
      logger.error(`Company not found: ${company_id}`);
      return;
    }

    // Get company-specific configurations or fallback to global config
    const telegramDashboardChatId = company.config?.telegramDashboardChatId || config?.telegramDashboardChatId;
    const telegramBotToken = company.config?.telegramBotToken || config?.telegramBotToken;

    if (!telegramDashboardChatId || !telegramBotToken) {
      logger.warn(`Missing Telegram config for company ${company_id}, skipping report`);
      return;
    }

    const merchants = await getMerchantsDao({ company_id: company_id }, null, null);
    let merchant = [];
    let totalpayinsMerchant = 0;
    let totalpayoutsMerchant = 0;
    const allHierarchies = await getUserHierarchysDao({ company_id: company_id });
    const subMerchantIds = new Set();
    allHierarchies.forEach((hierarchy) => {
      const subMerchants = hierarchy?.config?.siblings?.sub_merchants || [];
      subMerchants.forEach((subMerchantId) =>
        subMerchantIds.add(subMerchantId),
      );
    });
    for (const merch of merchants) {
      const calculationData = await getCalculationDao({
        user_id: merch.user_id,
        company_id: company_id,
        sDate,
        eDate,
      });
      let totalPayinAmount = 0;
      let totalPayinCount = 0;
      let totalPayoutAmount = 0;
      let totalPayoutCount = 0;

      for (const data of calculationData) {
        totalPayinAmount += data.total_payin_amount || 0;
        totalPayinCount += data.total_payin_count || 0;
        totalPayoutAmount += data.total_payout_amount || 0;
        totalPayoutCount += data.total_payout_count || 0;
      }
      //submerchants removed
      if (!subMerchantIds.has(merch.user_id)) {
        merchant.push({
          merchantId: merch.code,
          totalPayin: totalPayinAmount,
          totalPayinCount: totalPayinCount,
          totalPayout: totalPayoutAmount,
          totalPayoutCount: totalPayoutCount,
        });
      }

      totalpayinsMerchant += totalPayinAmount;
      totalpayoutsMerchant += totalPayoutAmount;
      merchant.sort((a, b) => a.merchantId.localeCompare(b.merchantId));
    }

    let vendorObjpayIn = {};
    let vendorObjpayOut = [];
    let totalBankDepositAllVendors = 0;
    let totalBankWithdrawalAllVendors = 0;

    const banksData = await getBankaccountDao(
      { bank_used_for: 'PayIn', company_id: company_id },
      null,
      null,
      'ADMIN',
    );
    const banks = banksData
      .filter(({ today_balance }) => today_balance !== 0)
      .map(({ user_id, nick_name, today_balance, payin_count }) => {
        totalBankDepositAllVendors += today_balance;
        return {
          user_id,
          bankName: nick_name,
          TotalDeposit: today_balance,
          TotalCount: payin_count,
        };
      });

    let vendorData;

    for (const bank of banks) {
      vendorData = await getVendorsDao(
        { user_id: bank.user_id, company_id: company_id },
        null,
        null,
        'created_at',
        'DESC',
      );
      if (vendorData.length > 0) {
        const vendor = vendorData[0];
        const vendorCode = vendor.code;

        if (!vendorObjpayIn[vendorCode]) {
          vendorObjpayIn[vendorCode] = { banks: [] };
        }

        vendorObjpayIn[vendorCode].banks.push({
          bankName: bank.bankName,
          TotalDeposit: bank.TotalDeposit,
          TotalCount: bank.TotalCount,
        });
      }
    }

    const banksDataOut = await getBankaccountDao(
      { bank_used_for: 'PayOut', company_id: company_id },
      null,
      null,
      'ADMIN',
    );
    const banksOut = banksDataOut
      .filter(({ today_balance }) => today_balance !== 0)
      .map(({ user_id, nick_name, today_balance, payin_count }) => {
        totalBankWithdrawalAllVendors += today_balance;
        return {
          user_id,
          bankName: nick_name,
          TotalDeposit: today_balance,
          TotalCount: payin_count,
        };
      });
    let vendorDataOut;
    for (const banksO of banksOut) {
      vendorDataOut = await getVendorsDao(
        { user_id: banksO.user_id, company_id: company_id },
        null,
        null,
        'created_at',
        'DESC',
      );
      if (vendorDataOut.length > 0) {
        const vendor = vendorDataOut[0];
        const vendorCode = vendor.code;
        if (!vendorObjpayOut[vendorCode]) {
          vendorObjpayOut[vendorCode] = { banks: [] };
        }

        vendorObjpayOut[vendorCode].banks.push({
          bankName: banksO.bankName,
          TotalDeposit: banksO.TotalDeposit,
          TotalCount: banksO.TotalCount,
        });
      }
    }

    await sendTelegramDashboardReportMessage(
      telegramDashboardChatId,
      merchant,
      totalpayinsMerchant,
      totalpayoutsMerchant,
      vendorObjpayIn,
      vendorObjpayOut,
      totalBankDepositAllVendors,
      totalBankWithdrawalAllVendors,
      telegramBotToken,
      type === 'H' ? 'Hourly Report' : 'Daily Report',
    );
    logger.info(`Dashboard Report CRON Ended for company: ${company_id}`);
  } catch (error) {
    logger.error(`Error in gatherAllData for company ${company_id}: ${error}`);
  } finally {
    if (conn) {
      conn.release();
    }
  }
};

export default gatherAllDataForAllCompanies;
