import express from 'express';
import tryCatchHandler from '../../utils/tryCatchHandler.js';
import {
  createBeneficiaryAccount,
  deleteBeneficiaryAccount,
  getBeneficiaryAccountById,
  getBeneficiaryAccount,
  updateBeneficiaryAccount,
  getBeneficiaryAccountByBankName,
  getBeneficiaryAccountBySearch,
} from './beneficiaryAccountController.js';
const router = express.Router();
import { authorized, isAuthenticated } from '../../middlewares/auth.js';
import { AccessRoles } from '../../constants/index.js';

/**
 * @swagger
 * tags:
 *   name: Beneficiary Accounts
 *   description: API endpoints for managing beneficiary accounts
 */

/**
 * @swagger
 * /beneficiaryAccounts:
 *   get:
 *     summary: Get all beneficiary accounts
 *     description: Returns a list of all beneficiary accounts.
 *     tags: [Beneficiary Accounts]
 *     responses:
 *       200:
 *         description: A list of beneficiary accounts
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                     example: 1
 *                   bankAccountsname:
 *                     type: string
 *                     example: "john_doe"
 *       500:
 *         description: Internal server error
 */
router.get(
  '/',
  [isAuthenticated, authorized(AccessRoles.BENEFICIARY_ACCOUNTS)],
  tryCatchHandler(getBeneficiaryAccount),
);

router.get(
  '/search',
  [isAuthenticated, authorized(AccessRoles.BENEFICIARY_ACCOUNTS)],
  tryCatchHandler(getBeneficiaryAccountBySearch),
);

/**
 * @swagger
 * /beneficiaryAccounts:
 *   get:
 *     summary: Get all beneficiary accounts
 *     description: Returns a list of all beneficiary accounts.
 *     tags: [Beneficiary Accounts]
 *     responses:
 *       200:
 *         description: A list of beneficiary accounts
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                     example: 1
 *                   bankAccountsname:
 *                     type: string
 *                     example: "john_doe"
 *       500:
 *         description: Internal server error
 */
router.get(
  '/beneficiarybanknames',
  [isAuthenticated, authorized(AccessRoles.ALL)],
  tryCatchHandler(getBeneficiaryAccountByBankName),
);

/**
 * @swagger
 * /beneficiaryAccounts/{id}:
 *   get:
 *     summary: Get a beneficiary account by ID
 *     description: Returns the details of a specific beneficiary account.
 *     tags: [Beneficiary Accounts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the beneficiary account to fetch
 *     responses:
 *       200:
 *         description: The requested beneficiary account
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                   example: 1
 *                 bankAccountsname:
 *                   type: string
 *                   example: "john_doe"
 *       404:
 *         description: Beneficiary account not found
 *       500:
 *         description: Internal server error
 */
router.get(
  '/:id',
  [isAuthenticated, authorized(AccessRoles.BENEFICIARY_ACCOUNTS)],
  tryCatchHandler(getBeneficiaryAccountById),
);
/**
 * @swagger
 * /beneficiaryAccounts/create-beneficiary:
 *   post:
 *     summary: Create a new beneficiary account
 *     description: Creates a new beneficiary account and returns the created account.
 *     tags: [Beneficiary Accounts]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               bankName:
 *                 type: string
 *                 description: The name of the beneficiary account (e.g., username or account name)
 *               created_by:
 *                 type: integer
 *                 description: ID of the user creating the beneficiary account
 *     responses:
 *       201:
 *         description: Beneficiary account created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                   example: 1
 *                 bankName:
 *                   type: string
 *                   example: "john_doe"
 *       400:
 *         description: Bad request (validation error)
 *       500:
 *         description: Internal server error
 */
router.post(
  '/create-beneficiary',
  [isAuthenticated, authorized(AccessRoles.BENEFICIARY_ACCOUNTS)],
  tryCatchHandler(createBeneficiaryAccount),
);

/**
 * @swagger
 * /beneficiaryAccounts/update-beneficiary/{id}:
 *   put:
 *     summary: Update a beneficiary account
 *     description: Updates the details of a specific beneficiary account.
 *     tags: [Beneficiary Accounts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the beneficiary account to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               bankAccountsname:
 *                 type: string
 *                 description: The updated name of the beneficiary account
 *               updated_by:
 *                 type: integer
 *                 description: ID of the user updating the beneficiary account
 *     responses:
 *       200:
 *         description: Beneficiary account updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                   example: 1
 *                 bankAccountsname:
 *                   type: string
 *                   example: "john_doe_updated"
 *       404:
 *         description: Beneficiary account not found
 *       400:
 *         description: Bad request (validation error)
 *       500:
 *         description: Internal server error
 */
router.put(
  '/update-beneficiary/:id',
  [isAuthenticated, authorized(AccessRoles.BENEFICIARY_ACCOUNTS)],
  tryCatchHandler(updateBeneficiaryAccount),
);

/**
 * @swagger
 * /beneficiaryAccounts/delete-beneficiary/{id}:
 *   delete:
 *     summary: Delete a beneficiary account
 *     description: Deletes a specific beneficiary account by ID.
 *     tags: [Beneficiary Accounts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the beneficiary account to delete
 *     responses:
 *       200:
 *         description: Beneficiary account deleted successfully
 *       404:
 *         description: Beneficiary account not found
 *       500:
 *         description: Internal server error
 */
router.delete(
  '/delete-beneficiary/:id',
  [isAuthenticated, authorized(AccessRoles.BENEFICIARY_ACCOUNTS)],
  tryCatchHandler(deleteBeneficiaryAccount),
);

export default router;
