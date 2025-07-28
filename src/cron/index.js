import express from 'express';
import collectBankData from './bankCron.js';
import collectCalculationData from './calculationCron.js';
import collectPayinData from './notifyCron.js';
import { logger } from '../utils/logger.js';
import formattedSuccessRatiosByMerchant from './successRatioCron.js';
// import  checkPendingStatus  from './pendingPayinCron.js';
const router = express.Router();

/**
 * @swagger
 * /bankCron:
 *   get:
 *     summary: Triggers the bank cron job
 *     description: Executes the cron job that collects and processes bank data.
 *     tags:
 *       - Cron Jobs
 *     responses:
 *       200:
 *         description: Bank cron job successfully executed.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Bank cron job executed successfully."
 */
router.get(
  '/bankCron',
  (req, res) => {
    collectBankData('Asia/Kolkata');
    logger.info('Calling collectBankData CRONJOB with timezone: Asia/Kolkata');
    res.json({ message: 'Cron job is running for Banks' });
  },
  collectBankData,
);

/**
 * @swagger
 * /calculationCron:
 *   get:
 *     summary: Triggers the calculation cron job
 *     description: Executes the cron job that collects and processes calculation data.
 *     tags:
 *       - Cron Jobs
 *     responses:
 *       200:
 *         description: Calculation cron job successfully executed.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Calculation cron job executed successfully."
 */
router.get(
  '/calculationCron',
  (req, res) => {
    collectCalculationData('Asia/Kolkata');
    logger.info(
      'Calling collectCalculationData CRONJOB with timezone: Asia/Kolkata',
    );
    res.json({ message: 'Cron job is running for calculation' });
  },
  collectCalculationData,
);
// router.get(
//   '/checkPendingStatus',
//   (req, res) => {
//     checkPendingStatus('Asia/Kolkata');
//     res.json({ message: 'Cron job is running for pending status' });
//   },
//   checkPendingStatus,
// );
// ;
/**
 * @swagger
 * /notifyPayinDroppedCron:
 *   get:
 *     summary: Triggers the payin dropped notification cron job
 *     description: Executes the cron job that collects and processes payin notification data.
 *     tags:
 *       - Cron Jobs
 *     responses:
 *       200:
 *         description: Payin dropped notification cron job successfully executed.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Payin dropped notification cron job executed successfully."
 */
router.get(
  '/notifyPayinDroppedCron',
  (req, res) => {
    collectPayinData('Asia/Kolkata');
    logger.info('Calling collectPayinData CRONJOB with timezone: Asia/Kolkata');
    res.json({ message: 'Cron job is running for Notify-Url' });
  },
  collectPayinData,
);
router.get(
  '/successRatioCron',
  (req, res) => {
    formattedSuccessRatiosByMerchant();
    logger.info('Calling formattedSuccessRatiosByMerchant CRONJOB');
    res.json({ message: 'Cron job is running for Success Ratio' });
  },
  collectPayinData,
);

export default router;
