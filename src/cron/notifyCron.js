import cron from 'node-cron';
import moment from 'moment-timezone';
import { getPayInUrlsDao, updatePayInUrlDao } from '../apis/payIn/payInDao.js';
import { merchantPayinCallback } from '../callBacksAndWebHook/merchantCallBacks.js';
import { logger } from '../utils/logger.js';
import { calculateDuration } from '../helpers/index.js'; 

if (process.env.NODE_ENV == 'production') {
  cron.schedule('*/10 * * * * *', () => {
    collectPayinData('Asia/Kolkata');
  });

  logger.info('Running cron job in production environment');
} else {
  logger.error('Cron jobs are disabled in non-production environments.');
}

const collectPayinData = async (timezone = 'Asia/Kolkata') => {
  const currentTime = moment().tz(timezone, true);
  const expireTime = currentTime.clone().subtract(10, 'minutes').toISOString();
  try {
    // Get payins already DROPPED but not notified
    const payinsDropped = await getPayInUrlsDao({
      status: ['FAILED', 'DROPPED'],
      is_notified: 'false',
    });
    // Update INITIATED payins older than 10 minutes
    const payinsInitiated = await getPayInUrlsDao({ status: 'INITIATED' });
    for (const payin of payinsInitiated) {
      if (new Date(payin?.created_at) <= new Date(expireTime)) {
        const duration = calculateDuration(payin.created_at);
        await updatePayInUrlDao(payin.id, {
          status: 'FAILED',
          is_url_expires: true,
          duration,
        });
        logger.info(`INITIATED PayIn ${payin.id} FAILED due to timeout`);
      } else if (payin.config.page_reload) {
        const duration = calculateDuration(payin.created_at);
        const updatedData = {
          status: 'FAILED',
          is_url_expires: true,
          duration,
        };
        await updatePayInUrlDao(payin.id, updatedData);
        logger.info(`INITIATED PayIn ${payin.id} FAILED due to page_reload`);
      }
    }
    // Update ASSIGNED payins older than 10 minutes
    const payinsAssigned = await getPayInUrlsDao({ status: 'ASSIGNED' });
    for (const payin of payinsAssigned) {
      if (new Date(payin?.updated_at) <= new Date(expireTime)) {
        const duration = calculateDuration(payin.created_at);
        const updatedData = {
          status: 'DROPPED',
          is_url_expires: true,
          duration,
        };
        await updatePayInUrlDao(payin.id, updatedData);
        logger.info(`ASSIGNED PayIn ${payin.id} dropped due to timeout`);
      } else if (payin.config.page_reload) {
        const duration = calculateDuration(payin.created_at);
        const updatedData = {
          status: 'DROPPED',
          is_url_expires: true,
          duration,
        };
        await updatePayInUrlDao(payin.id, updatedData);
        logger.info(`ASSIGNED PayIn ${payin.id} dropped due to page_reload`);
      }
    }
    // Process notifications for dropped but unnotified payins
    if (payinsDropped?.length) {
      await processPayinNotifications(payinsDropped);
    }
  } catch (error) {
    logger.error('Error while collecting payin data:', error);
  }
};

async function processPayinNotifications(payins) {
  for (const payin of payins) {
    const notificationData = {
      status: payin.status,
      merchantOrderId: payin?.merchant_order_id || null,
      payinId: payin?.id || null,
      amount: null,
      req_amount: payin?.amount || null,
      utrId: payin?.user_submitted_utr || null,
      utr_id: payin?.user_submitted_utr || null,
    };
    try {
      if (payin?.config?.urls?.notify) {
        // This is async function but it's just the callback sending function there fore we are not using await
        merchantPayinCallback(payin?.config?.urls?.notify, notificationData);
        await updatePayInUrlDao(payin.id, {is_notified: 'true'});
      } else {
        logger.warn('Notify URL is missing for payin', { payinId: payin?.id });
      }
    } catch (error) {
      logger.error('Error processing payin:', {
        error: error.message,
        payinId: payin?.id,
        notify_url: payin?.config?.urls?.notify,
      });
    }
  }
}

export default collectPayinData;
