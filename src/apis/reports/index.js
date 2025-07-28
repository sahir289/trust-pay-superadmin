import express from 'express';
import tryCatchHandler from '../../utils/tryCatchHandler.js';
import { isAuthenticated } from '../../middlewares/auth.js';
import {
  getClientsAccountReportController,
  getPayInReportController,
  getPayOutReportController,
} from './reportsController.js';

/**
 * @swagger
 * tags:
 *   name: Reports
 *   description: API endpoints related to payout and vendor reports
 */

const router = express.Router();

/**
 * @swagger
 * /reports/get-all-payouts:
 *   get:
 *     summary: Get all payout transactions
 *     description: Fetches all payout data from the system.
 *     tags: [Reports]
 *     responses:
 *       200:
 *         description: List of all payouts.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                     example: 123
 *                   vendorCode:
 *                     type: string
 *                     example: "ABC123"
 *                   amount:
 *                     type: number
 *                     example: 5000.50
 *       500:
 *         description: Server error
 */
router.get(
  '/get-payouts-report',
  isAuthenticated,
  tryCatchHandler(getPayOutReportController),
);

/**
 * @swagger
 * /reports/get-all-payins:
 *   get:
 *     summary: Get all pay-in transactions
 *     description: Fetches all pay-in data from the system.
 *     tags: [Reports]
 *     responses:
 *       200:
 *         description: List of all pay-ins.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                     example: 456
 *                   amount:
 *                     type: number
 *                     example: 1000.00
 *       500:
 *         description: Server error
 */
router.get(
  '/get-payins-reports',
  isAuthenticated,
  tryCatchHandler(getPayInReportController),
);

/**
 * @swagger
 * /reports/get-all-merchants:
 *   get:
 *     summary: Get all merchants
 *     description: Fetches a list of all merchants.
 *     tags: [Reports]
 *     responses:
 *       200:
 *         description: List of all merchants.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                     example: 789
 *                   name:
 *                     type: string
 *                     example: "Merchant A"
 *       500:
 *         description: Server error
 */
router.get(
  '/get-accounts-reports',
  isAuthenticated,
  tryCatchHandler(getClientsAccountReportController),
);
//handled same with above function

export default router;
