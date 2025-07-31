import express from 'express';
import tryCatchHandler from '../../utils/tryCatchHandler.js';
import { authorized, isAuthenticated } from '../../middlewares/auth.js';
import { AccessRoles } from '../../constants/index.js';
import {
  assignedBankToPayInUrl,
  checkPayInStatus,
  disputeDuplicateTransaction,
  generatePayInUrl,
  // getPayins,
  payInIntentGenerateOrder,
  processPayIn,
  processPayInByImage,
  resetDeposit,
  telegramCheckUTR,
  telegramOCR,
  updateDepositStatus,
  updatePaymentNotificationStatus,
  validatePayInUrl,
  generateHashForPayIn,
  getPayinsBySearch,
  generateUpiUrl,
  updateUtrPayins,
  checkPendingPayinStatus,
  updatePayIn,
  processPayInIMGUTR,
} from './payInController.js';
import { payInUpdateCashfreeWebhook } from '../../webhooks/index.js';
import { multerUpload } from '../../utils/index.js';
import getUserLocationMiddleware from '../../middlewares/locationRestrict.js';
const router = express.Router();

// Public API's

router.get('/generate-hash', tryCatchHandler(generateHashForPayIn));

/**
 * @swagger
 * /payin:
 *   get:
 *     summary: Generate Pay-In URL
 *     description: Generates a Pay-In URL for a payment process.
 *     tags: [PayIn]
 *     responses:
 *       200:
 *         description: Pay-In URL generated successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Pay-In URL generated successfully"
 *                 data:
 *                   type: string
 *                   example: "https://payinurl.com"
 *       500:
 *         description: Internal server error
 */
router.get('/generate-payin', tryCatchHandler(generatePayInUrl));

/**
 * @swagger
 * /payin/validate-payIn-url/{merchantOrderId}:
 *   get:
 *     summary: Validate Pay-In URL
 *     description: Validates if the Pay-In URL is valid.
 *     tags: [PayIn]
 *     parameters:
 *       - in: path
 *         name: merchantOrderId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the Pay-In URL to validate.
 *     responses:
 *       200:
 *         description: Pay-In URL validated successfully.
 *       404:
 *         description: Pay-In URL not found
 */
router.get(
  '/validate-payIn-url/:merchantOrderId',
  getUserLocationMiddleware,
  tryCatchHandler(validatePayInUrl),
);

/**
 * @swagger
 * /payin/generate-upi-url:
 *   post:
 *     summary: Generate UPI app URL.
 *     description: Generate UPI app URL for user redirection.
 *     tags: [PayIn]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               amount:
 *                 type: number
 *               userId:
 *                 type: string
 *               merchantCode:
 *                 type: string
 *     responses:
 *       200:
 *         description: Pay-In URL generated successfully.
 *       404:
 *         description: Pay-In URL not found.
 */
router.post('/generate-upi-url', tryCatchHandler(generateUpiUrl));

/**
 * @swagger
 * /payin/assign-bank/{merchantOrderId}:
 *   post:
 *     summary: Assign bank to Pay-In URL
 *     description: Assigns a bank to a specific Pay-In URL.
 *     tags: [PayIn]
 *     parameters:
 *       - in: path
 *         name: merchantOrderId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the Pay-In URL.
 *     responses:
 *       200:
 *         description: Bank assigned to Pay-In URL successfully.
 *       404:
 *         description: Pay-In URL not found
 */
router.post(
  '/assign-bank/:merchantOrderId',
  tryCatchHandler(assignedBankToPayInUrl),
);

/**
 * @swagger
 * /payin/check-payin-status:
 *   post:
 *     summary: Check Pay-In Status
 *     description: Checks the status of a specific Pay-In URL.
 *     tags: [PayIn]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               payInId:
 *                 type: string
 *                 example: "12345"
 *     responses:
 *       200:
 *         description: Pay-In status retrieved successfully.
 *       500:
 *         description: Internal server error
 */
router.post('/check-payin-status', tryCatchHandler(checkPayInStatus));

/**
 * @swagger
 * /payin/generate-intent-order/{payInId}:
 *   post:
 *     summary: Generate Pay-In Intent Order
 *     description: Generates a Pay-In intent order for the specified Pay-In URL.
 *     tags: [PayIn]
 *     parameters:
 *       - in: path
 *         name: payInId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the Pay-In URL to generate the intent for.
 *     responses:
 *       200:
 *         description: Pay-In intent order generated successfully.
 *       404:
 *         description: Pay-In URL not found
 */
router.post(
  '/generate-intent-order/:payInId',
  tryCatchHandler(payInIntentGenerateOrder),
);

/**
 * @swagger
 * /payin/process/{merchantOrderId}:
 *   post:
 *     summary: Process a Pay-In
 *     description: Processes a Pay-In for the specified Pay-In URL.
 *     tags: [PayIn]
 *     parameters:
 *       - in: path
 *         name: merchantOrderId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the Pay-In URL to process.
 *     responses:
 *       200:
 *         description: Pay-In processed successfully.
 *       404:
 *         description: Pay-In URL not found
 */
router.post('/process/:merchantOrderId', tryCatchHandler(processPayIn));

/**
 * @swagger
 * /payin/process-by-image/{merchantOrderId}:
 *   post:
 *     summary: Process Pay-In by Image
 *     description: Processes a Pay-In using an image of the payment confirmation.
 *     tags: [PayIn]
 *     parameters:
 *       - in: path
 *         name: merchantOrderId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the Pay-In URL to process.
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: The payment confirmation image to upload.
 *     responses:
 *       200:
 *         description: Pay-In processed using the image successfully.
 *       404:
 *         description: Pay-In URL not found
 */
router.post(
  '/process-by-image/:merchantOrderId',
  multerUpload.single('file'),
  tryCatchHandler(processPayInByImage),
);

// Telegram API's
router.post('/telegram-ocr', tryCatchHandler(telegramOCR));

/**
 * @swagger
 * /payin/update-payment-cashfree-webhook:
 *   post:
 *     summary: Update Payment Cashfree Webhook
 *     description: Receives webhook data from Cashfree and updates the payment status.
 *     tags: [PayIn]
 *     responses:
 *       200:
 *         description: Payment status updated from Cashfree webhook successfully.
 */
router.post(
  '/update-payment-cashfree-webhook',
  tryCatchHandler(payInUpdateCashfreeWebhook),
);

// Authenticated API's
router.use(isAuthenticated);
router.use(authorized(AccessRoles.PAYIN));

router.post('/telegram-check-utr', tryCatchHandler(telegramCheckUTR));

/**
 * @swagger
 * /payin/update-payment-notified-status/{payInId}:
 *   put:
 *     summary: Update Payment Notification Status
 *     description: Updates the payment notification status of a Pay-In.
 *     tags: [PayIn]
 *     parameters:
 *       - in: path
 *         name: payInId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the Pay-In URL to update.
 *     responses:
 *       200:
 *         description: Payment notification status updated successfully.
 */
router.put(
  '/update-payment-notified-status/:payInId',
  tryCatchHandler(updatePaymentNotificationStatus),
);

/**
 * @swagger
 * /payin/update-deposit-status/{merchantId}:
 *   put:
 *     summary: Update Deposit Status
 *     description: Updates the deposit status for a specific merchant.
 *     tags: [PayIn]
 *     parameters:
 *       - in: path
 *         name: merchantId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the merchant whose deposit status is to be updated.
 *     responses:
 *       200:
 *         description: Deposit status updated successfully.
 *       404:
 *         description: Merchant not found
 */
router.put(
  '/update-deposit-status/:merchantOrderId',
  tryCatchHandler(updateDepositStatus),
);

/**
 * @swagger
 * /payin/reset-payment:
 *   post:
 *     summary: Reset Payment Status
 *     description: Resets the payment status for a specific Pay-In URL.
 *     tags: [PayIn]
 *     responses:
 *       200:
 *         description: Payment status reset successfully.
 *       404:
 *         description: Pay-In URL not found
 */
router.post('/reset-payment', tryCatchHandler(resetDeposit));

/**
 * @swagger
 * /payin/dispute-duplicate/{payInId}:
 *   put:
 *     summary: Dispute Duplicate Payment
 *     description: Disputes a duplicate payment for a specific Pay-In URL.
 *     tags: [PayIn]
 *     parameters:
 *       - in: path
 *         name: payInId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the Pay-In URL to dispute.
 *     responses:
 *       200:
 *         description: Duplicate payment disputed successfully.
 */
router.put(
  '/dispute-duplicate/:payInId',
  tryCatchHandler(disputeDuplicateTransaction),
);

/**
 * @swagger
 * /payin/payin-data:
 *   get:
 *     summary: Get Pay-In Data
 *     description: Retrieves all the Pay-In data.
 *     tags: [PayIn]
 *     responses:
 *       200:
 *         description: Pay-In data retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Pay-In data retrieved successfully"
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *       500:
 *         description: Internal server error
 */
// router.get('/', tryCatchHandler(getPayins));

router.post('/processIMGUTR/:merchantOrderId', tryCatchHandler(processPayInIMGUTR));

router.put('/updateFailedPayinUtr/:id', tryCatchHandler(updateUtrPayins));

router.get(
  '/checkPendingPayinStatus',
  tryCatchHandler(checkPendingPayinStatus),
);

router.get('/', tryCatchHandler(getPayinsBySearch));

router.put('/updatePayin/:merchant_order_id', tryCatchHandler(updatePayIn));

export default router;
