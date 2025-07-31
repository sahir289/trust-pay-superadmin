import cron from 'node-cron';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import { transactionWrapper } from '../utils/db.js';
import {
  createCalculationDao,
  getCalculationforCronDao,
  checkCalculationEntryForDateDao,
} from '../apis/calculation/calculationDao.js';
import { getUsersForCronDao } from '../apis/users/userDao.js';
import { logger } from '../utils/logger.js';

// Initialize dayjs plugins
dayjs.extend(utc);
dayjs.extend(timezone);

const IST = 'Asia/Kolkata';

// Track retry attempts
let retryCount = 0;
const MAX_RETRIES = 3; // Total attempts: 1 initial + 2 retries

// Only run cron jobs in production environment
if (process.env.NODE_ENV == 'production') {
  // Main cron job at midnight
  cron.schedule(
    '0 0 * * *',
    async () => {
      retryCount = 0; // Reset retry count for new day
      await executeWithRetry('12:00 AM IST (Attempt 1)');
    },
    {
      timezone: IST,
    },
  );
} else {
  logger.error('Cron jobs are disabled in non-production environments.');
}

// Function to execute cron with retry mechanism
const executeWithRetry = async (attemptDescription) => {
  retryCount++;
  logger.info(`Running calculation cron job in production mode at ${attemptDescription}`);
  
  try {
    await collectCalculationData();
    markExecution(); // Only mark as executed if successful
    logger.info(`Cron job executed successfully on ${attemptDescription}`);
  } catch (error) {
    logger.error(`Cron job failed on ${attemptDescription}:`, error?.message);
    
    // If we haven't reached max retries, schedule next attempt after 10 seconds
    if (retryCount < MAX_RETRIES) {
      const nextAttempt = retryCount + 1;
      logger.info(`Scheduling retry attempt ${nextAttempt} in 10 seconds...`);
      
      setTimeout(async () => {
        await executeWithRetry(`12:00:${(retryCount * 10).toString().padStart(2, '0')} AM IST (Attempt ${nextAttempt})`);
      }, 10000); // 10 seconds delay
    } else {
      logger.error(`All ${MAX_RETRIES} attempts failed. Cron job execution unsuccessful.`);
    }
  }
};

// Function to mark successful execution
const markExecution = () => {
  const currentDate = dayjs().tz(IST).format('YYYY-MM-DD');
  logger.info(`Cron execution marked successfully for date: ${currentDate}`);
};

const collectCalculationData = async () => {
  const executionStartTime = dayjs().tz(IST).format('YYYY-MM-DDTHH:mm:ssZ');
  logger.info(`Starting calculation cron job at: ${executionStartTime}`);

  try {
    // Check if entry for current date already exists
    const currentDate = dayjs().tz(IST).format('YYYY-MM-DD');
    const entryExists = await checkCalculationEntryForDateDao(currentDate);
    if (entryExists) {
      logger.info(`Calculation entry for date ${currentDate} already exists. Skipping cron execution.`);
      return;
    }

    const users = (await transactionWrapper(getUsersForCronDao)()) || [];
    const usersArray = users || [];

    // Create IST time in the exact format we want
    const currentTime = dayjs().tz(IST).format('YYYY-MM-DDTHH:mm:ssZ'); // Will create: 2025-04-23T19:26:00+05:30
    logger.info(`Calculation Cron Running Current time in IST: ${currentTime}`);

    for (const user of usersArray) {
      try {
        const calculation = await getCalculationforCronDao(user.id);
        if (calculation.length > 0) {
          const resetData = {
            user_id: calculation[0].user_id,
            role_id: calculation[0].role_id,
            company_id: calculation[0].company_id,
            net_balance: parseFloat(calculation[0].net_balance),
            // config: calculation[0].config,
            created_at: currentTime, // Store exact IST time
          };
          await processUpdate(resetData);
        }
      } catch (userError) {
        logger.error(
          `Error processing data for user ${user?.id}:`,
          userError?.message,
        );
      }
    }

    const executionEndTime = dayjs().tz(IST).format('YYYY-MM-DDTHH:mm:ssZ');
    logger.info(
      `Cron job executed successfully for all users. Started: ${executionStartTime}, Completed: ${executionEndTime}`,
    );
  } catch (error) {
    logger.error('Error while collecting user data:', error?.message);
    throw error; // Re-throw to ensure fallback mechanisms can detect failures
  }
};
// Function to update the calculation data
async function processUpdate(data) {
  try {
    await createCalculationDao(null, data);
  } catch (error) {
    logger.error('Error while updating calculation data:', error?.message);
  }
}

export default collectCalculationData;
