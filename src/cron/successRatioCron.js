import { sendTelegramDashboardSuccessRatioMessage } from '../utils/sendTelegramMessages.js';
import { getPayInUrlsDao } from '../apis/payIn/payInDao.js';
import cron from 'node-cron';
import { getMerchantsDao } from '../apis/merchants/merchantDao.js';
import { getCompanyDao } from '../apis/company/companyDao.js';
import config from '../config/config.js';
import { logger } from '../utils/logger.js';

// Function to process success ratios for all companies
const formattedSuccessRatiosForAllCompanies = async () => {
  try {
    logger.info('Starting success ratio processing for all companies');
    
    // Get all companies
    const companies = await getCompanyDao({});
    
    if (!companies || companies.length === 0) {
      logger.info('No companies found');
      return;
    }

    // Process each company (sequential processing for safety)
    // for (const company of companies) {
    //   try {
    //     logger.info(`Processing success ratios for company: ${company.id}`);
    //     await formattedSuccessRatiosByMerchant(company.id);
    //   } catch (error) {
    //     logger.error(`Error processing success ratios for company ${company.id}: ${error}`);
    //   }
    // }
    
    // Alternative: Parallel processing (uncomment if you want faster processing)
    await Promise.allSettled(
      companies.map(async (company) => {
        try {
          logger.info(`Processing success ratios for company: ${company.id}`);
          await formattedSuccessRatiosByMerchant(company.id);
          await formattedSuccessRatiosByMerchantUpdatedAt(company.id);
        } catch (error) {
          logger.error(`Error processing success ratios for company ${company.id}: ${error}`);
        }
      })
    );
    
    logger.info('Completed success ratio processing for all companies');
  } catch (error) {
    logger.error(`Error in formattedSuccessRatiosForAllCompanies: ${error}`);
  }
};

const formattedSuccessRatiosByMerchant = async (company_id) => {
  try {
    logger.info(`Success Ratio CRON Started for company: ${company_id}`);
    
    // Get company details with config
    const companies = await getCompanyDao({ id: company_id });
    const company = companies && companies.length > 0 ? companies[0] : null;
    
    if (!company) {
      logger.error(`Company not found: ${company_id}`);
      return;
    }

    // Get company-specific configurations or fallback to global config
    const telegramRatioAlertsChatId = company.config?.telegramRatioAlertsChatId || config?.telegramRatioAlertsChatId;
    const telegramBotToken = company.config?.telegramBotToken || config?.telegramBotToken;

    if (!telegramRatioAlertsChatId || !telegramBotToken) {
      logger.warn(`Missing Telegram config for company ${company_id}, skipping success ratio report`);
      return;
    }

    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0); // Start of current day

    // Define rolling intervals
    const rollingIntervals = [
      { label: 'Last 5m', duration: 5 * 60 * 1000, type: 'rolling' },
      { label: 'Last 10m', duration: 10 * 60 * 1000, type: 'rolling' },
      { label: 'Last 15m', duration: 15 * 60 * 1000, type: 'rolling' },
      { label: 'Last 30m', duration: 30 * 60 * 1000, type: 'rolling' },
      { label: 'Last 1h', duration: 60 * 60 * 1000, type: 'rolling' },
      { label: 'Last 3h', duration: 3 * 60 * 60 * 1000, type: 'rolling' },
      { label: 'Last 6h', duration: 6 * 60 * 60 * 1000, type: 'rolling' },
      { label: 'Last 12h', duration: 12 * 60 * 60 * 1000, type: 'rolling' },
      { label: 'Last 24h', duration: 24 * 60 * 60 * 1000, type: 'rolling' }
    ];

    // Combine intervals
    const intervals = [
      ...rollingIntervals,
      { label: 'Today SR', startTime: startOfDay, endTime: now, type: 'daily' },
    ];

    // fetch all transactions for the company
    const allPayIns = await getPayInUrlsDao({ company_id: company_id });
    const merchants = await getMerchantsDao({ company_id: company_id }, null, null);
    // group transactions by merchant_id
    const transactionsByMerchant = allPayIns.reduce((map, payin) => {
      if (!map[payin.merchant_id]) map[payin.merchant_id] = [];
      map[payin.merchant_id].push({
        updated_at: new Date(payin.updated_at),
        created_at: new Date(payin.created_at),
        status: payin.status,
        user_submitted_utr: payin.user_submitted_utr,
      });
      return map;
    }, {});

    const merchantsWithTransactions = merchants.filter(
      (merchant) =>
        Array.isArray(transactionsByMerchant[merchant.id]) &&
        transactionsByMerchant[merchant.id].length > 0,
    );

    const fullMessages = [];
    
    // Sort merchants case-insensitively by code
    const sortedMerchants = merchantsWithTransactions.sort((a, b) => {
      const codeA = a.code ? a.code.toLowerCase() : '';
      const codeB = b.code ? b.code.toLowerCase() : '';
      return codeA.localeCompare(codeB);
    });

    for (const merchant of sortedMerchants) {
      const merchantTransactions = transactionsByMerchant[merchant.id];

      // Check both PayIn and UTR ratios for last 24 hours
      const last24HoursTransactions = merchantTransactions.filter(tx => {
        const txTime = new Date(tx.created_at);
        return txTime >= new Date(now - 24 * 60 * 60 * 1000);
      });

      // Calculate PayIn Success Ratio
      const last24HoursTotal = last24HoursTransactions.length;
      const last24HoursSuccess = last24HoursTransactions.filter(tx => tx.status === 'SUCCESS').length;
      const last24HoursRatio = last24HoursTotal === 0 ? 0 : (last24HoursSuccess / last24HoursTotal) * 100;

      // Calculate UTR Submission Ratio
      const last24HoursUTR = last24HoursTransactions.filter(tx => 
        tx.user_submitted_utr && tx.user_submitted_utr.length > 0
      ).length;
      const last24HoursUTRRatio = last24HoursTotal === 0 ? 0 : (last24HoursUTR / last24HoursTotal) * 100;

      // Skip if either PayIn or UTR ratio is 0%
      if (last24HoursTotal === 0 || last24HoursRatio === 0 || last24HoursUTRRatio === 0) {
        logger.info(`Skipping merchant ${merchant.code} - PayIn Ratio: ${last24HoursRatio}%, UTR Ratio: ${last24HoursUTRRatio}%`);
        continue;
      }

      const intervalDetails = intervals
        .map(interval => {
          const currentTime = new Date();
          const filteredTransactions = merchantTransactions.filter(tx => {
            const txTime = new Date(tx.created_at);
            
            if (interval.type === 'rolling') {
              // For rolling windows (Last 5m, Last 10m, etc.)
              return txTime >= new Date(currentTime - interval.duration);
            } else {
              // For hourly and daily intervals
              return txTime >= interval.startTime && txTime <= interval.endTime;
            }
          });

          const total = filteredTransactions.length;
          const success = filteredTransactions.filter(tx => tx.status === 'SUCCESS').length;

          const successRatio = total === 0 
            ? '0.00%'
            : Math.min(Math.max(((success / total) * 100), 0), 100).toFixed(2) + '%';

          const statusIcon = success === 0 ? '⚠️' : '✅';
          return `${statusIcon} ${interval.label}: ${success}/${total} = ${successRatio}`;
        })
        .join('\n');

      const intervalDetailsUtr = intervals
        .map((interval) => {
          const currentTime = new Date();
          // Filter transactions based on interval type
          const filteredTransactions = merchantTransactions.filter(tx => {
            const txTime = new Date(tx.created_at);
            
            if (interval.type === 'rolling') {
              // For rolling windows (Last 5m, Last 10m, etc.)
              return txTime >= new Date(currentTime - interval.duration);
            } else if (interval.type === 'daily') {
              // For today's total
              return txTime >= interval.startTime && txTime <= interval.endTime;
            }
            return false;
          });

          const total = filteredTransactions.length;
          const utrSubmission = filteredTransactions.filter(
            (tx) => tx.user_submitted_utr && tx.user_submitted_utr.length > 0
          ).length;

          const statusIcon = utrSubmission === 0 ? '⚠️' : '✅';
          const utrSubmissionRatio = total === 0
            ? '0.00%'
            : Math.min(Math.max(((utrSubmission / total) * 100), 0), 100).toFixed(2) + '%';

          return `${statusIcon} ${interval.label}: ${utrSubmission}/${total} = ${utrSubmissionRatio}`;
        })
        .join('\n');

      const fullMessage = {
        merchantCode: merchant.code,
        intervalDetails,
        intervalDetailsUtr,
      };
      fullMessages.push(fullMessage);
    }

    // Only send message if there are merchants to report
    if (fullMessages.length > 0) {
      await sendTelegramDashboardSuccessRatioMessage(
        telegramRatioAlertsChatId,
        fullMessages,
        telegramBotToken,
      );
    } else {
      logger.info('No merchants with transactions in last 24 hours to report');
    }

    logger.info(`Success Ratio CRON Ended for company: ${company_id}`);
  } catch (error) {
    logger.error(`Error in success ratio processing for company ${company_id}: ${error.message}`);
  }
};
export default formattedSuccessRatiosForAllCompanies;

const formattedSuccessRatiosByMerchantUpdatedAt = async (company_id) => {
  try {
    logger.info(`Success Ratio CRON Started For Updated At for company: ${company_id}`);
    
    // Get company details with config
    const companies = await getCompanyDao({ id: company_id });
    const company = companies && companies.length > 0 ? companies[0] : null;
    
    if (!company) {
      logger.error(`Company not found: ${company_id}`);
      return;
    }

    // Get company-specific configurations or fallback to global config
    const telegramRatioAlertsChatIdUpdatedData = company.config?.telegramRatioAlertsChatIdUpdatedData || config?.telegramRatioAlertsChatIdUpdatedData;
    const telegramBotToken = company.config?.telegramBotToken || config?.telegramBotToken;

    if (!telegramRatioAlertsChatIdUpdatedData || !telegramBotToken) {
      logger.warn(`Missing Telegram config for company ${company_id}, skipping success ratio report`);
      return;
    }

    const now = new Date();
    const intervals = [
      { label: 'Last 5m', duration: 5 * 60 * 1000 },
      { label: 'Last 15m', duration: 15 * 60 * 1000 },
      { label: 'Last 30m', duration: 30 * 60 * 1000 },
      { label: 'Last 1h', duration: 60 * 60 * 1000 },
      { label: 'Last 3h', duration: 3 * 60 * 60 * 1000 },
      { label: 'Last 24h', duration: 24 * 60 * 60 * 1000 },
    ];

    // fetch all transactions
    const allPayIns = await getPayInUrlsDao({ company_id: company_id });
    const merchants = await getMerchantsDao({ company_id: company_id }, null, null);
    // group transactions by merchant_id
    const transactionsByMerchant = allPayIns.reduce((map, payin) => {
      if (!map[payin.merchant_id]) map[payin.merchant_id] = [];
      map[payin.merchant_id].push({
        updated_at: new Date(payin.updated_at),
        status: payin.status,
        user_submitted_utr: payin.user_submitted_utr,
      });
      return map;
    }, {});

    const merchantsWithTransactions = merchants.filter(
      (merchant) =>
        Array.isArray(transactionsByMerchant[merchant.id]) &&
        transactionsByMerchant[merchant.id].length > 0,
    );

    const fullMessages = [];
    // Sort merchants by code case-insensitively
    const sortedMerchants = merchantsWithTransactions.sort((a, b) => {
      const codeA = a.code ? a.code.toLowerCase() : '';
      const codeB = b.code ? b.code.toLowerCase() : '';
      return codeA.localeCompare(codeB);
    });

    for (const merchant of sortedMerchants) {
      const merchantTransactions = transactionsByMerchant[merchant.id];

      // Check both PayIn and UTR ratios for last 24 hours
      const last24Hours = new Date(now - 24 * 60 * 60 * 1000);
      const last24HoursTransactions = merchantTransactions.filter(
        tx => tx.updated_at >= last24Hours
      );

      const last24HoursTotal = last24HoursTransactions.length;
      const last24HoursSuccess = last24HoursTransactions.filter(tx => tx.status === 'SUCCESS').length;
      const last24HoursRatio = last24HoursTotal === 0 ? 0 : (last24HoursSuccess / last24HoursTotal) * 100;

      // Calculate UTR Submission Ratio
      const last24HoursUTR = last24HoursTransactions.filter(tx => 
        tx.user_submitted_utr && tx.user_submitted_utr.length > 0
      ).length;
      const last24HoursUTRRatio = last24HoursTotal === 0 ? 0 : (last24HoursUTR / last24HoursTotal) * 100;

      // Skip if either PayIn or UTR ratio is 0%
      if (last24HoursTotal === 0 || last24HoursRatio === 0 || last24HoursUTRRatio === 0) {
        logger.info(`Skipping merchant ${merchant.code} (Updated At) - PayIn Ratio: ${last24HoursRatio}%, UTR Ratio: ${last24HoursUTRRatio}%`);
        continue;
      }

      const intervalDetails = intervals
        .map(({ label, duration }) => {
          const startTime = new Date(now - duration);

          const filteredTransactions = merchantTransactions.filter(
            (tx) => tx.updated_at >= startTime,
          );

          const total = filteredTransactions.length;
          const success = filteredTransactions.filter(
            (tx) => tx.status === 'SUCCESS',
          ).length;

          const successRatio =
            total === 0
              ? '0.00%'
              : Math.min(((success / total) * 100).toFixed(2), 100) + '%';
          const statusIcon = success === 0 ? '⚠️' : '✅';

          return `${statusIcon} ${label}: ${success}/${total} = ${successRatio}`;
        })
        .join('\n');

      const intervalDetailsUtr = intervals
        .map(({ label, duration }) => {
          const startTime = new Date(now - duration);

          const filteredTransactions = merchantTransactions.filter(
            (tx) => tx.updated_at >= startTime,
          );

          const total = filteredTransactions.length;

          const utrSubmission = filteredTransactions.filter(
            (tx) => tx.user_submitted_utr && tx.user_submitted_utr.length > 0,
          ).length;

          const statusIcon = utrSubmission === 0 ? '⚠️' : '✅';

          const utrSubmissionRatio =
            total === 0
              ? '0.00%'
              : Math.min(((utrSubmission / total) * 100).toFixed(2), 100) + '%';

          return `${statusIcon} ${label}: ${utrSubmission}/${total} = ${utrSubmissionRatio}`;
        })
        .join('\n');

      const fullMessage = {
        merchantCode: merchant.code,
        intervalDetails,
        intervalDetailsUtr,
      };
      fullMessages.push(fullMessage);
    }

    // Only send message if there are merchants to report
    if (fullMessages.length > 0) {
      await sendTelegramDashboardSuccessRatioMessage(
        telegramRatioAlertsChatIdUpdatedData,
        fullMessages,
        telegramBotToken
      );
    } else {
      logger.info('No merchants with successful transactions in last 24 hours to report (Updated At)');
    }

    logger.info(`Success Ratio CRON Ended for company: ${company_id}`);
  } catch (error) {
    logger.error('Error ', error.message);
  }
};

//run only on server - side /production level
if (process.env.NODE_ENV === 'production') {
  cron.schedule('*/10 * * * *', () => {
    formattedSuccessRatiosForAllCompanies();
  });
} else {
  logger.error('Cron jobs are disabled in non-production environments.');
}
