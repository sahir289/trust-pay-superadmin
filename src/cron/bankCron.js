// import cron from 'node-cron';
import moment from 'moment-timezone';
import { getConnection } from '../utils/db.js';
import { logger } from '../utils/logger.js';

// if (process.env.NODE_ENV == 'production') {
//   logger.log('Running cron job in production environment');
//   cron.schedule(
//     '0 0 * * *',
//     () => {
//       collectBankData('Asia/Kolkata');
//     },
//     {
//       timezone: 'Asia/Kolkata',
//     },
//   );
// } else {
//   logger.error('Cron jobs are disabled in non-production environments.');
// }

const collectBankData = async (timezone = 'Asia/Kolkata') => {
  const startTime = moment().tz(timezone, true);
  let conn;
  try {
    conn = await getConnection();
    //added payin_count to update everyday
    const sql =
      'UPDATE public."BankAccount" SET today_balance = 0 , payin_count = 0 ';
    await conn.query(sql);
    logger.info(
      'Successfully updated today_balance for all bank accounts.',
      startTime,
    );
  } catch (error) {
    logger.error('Error while updating bank account data:', error?.message);
  } finally {
    if (conn) {
      try {
        conn.release();
      } catch (releaseError) {
        logger.error('Error releasing DB connection:', releaseError?.message);
      }
    }
  }
};
export default collectBankData;
