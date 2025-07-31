import express from 'express';
import tryCatchHandler from '../../utils/tryCatchHandler.js';
import {
  createBankaccount,
  deleteBankaccount,
  getBankaccountById,
  getBankaccount,
  updateBankaccount,
  getBankaccountNickName,
  getBankAccountBySearch,
} from './bankaccountController.js';
const router = express.Router();
import { authorized, isAuthenticated } from '../../middlewares/auth.js';
import { AccessRoles } from '../../constants/index.js';

/**
 * @swagger
 * tags:
 *   name: Bank Accounts
 *   description: API endpoints for managing bank accounts
 */

/**
 * @swagger
 * /bankAccounts:
 *   get:
 *     summary: Get all bank accounts
 *     description: Returns a list of all bank accounts.
 *     tags: [Bank Accounts]
 *     responses:
 *       200:
 *         description: A list of bank accounts
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
  '/get',
  [isAuthenticated, authorized(AccessRoles.BANK_ACCOUNT)],
  tryCatchHandler(getBankaccount),
);

router.get(
  '/',
  [isAuthenticated, authorized(AccessRoles.BANK_ACCOUNT)],
  tryCatchHandler(getBankAccountBySearch),
);

/**
 * @swagger
 * /bankAccounts:
 *   get:
 *     summary: Get all bank accounts
 *     description: Returns a list of all bank accounts.
 *     tags: [Bank Accounts]
 *     responses:
 *       200:
 *         description: A list of bank accounts
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
  '/banknames',
  [isAuthenticated, authorized(AccessRoles.ALL)],
  tryCatchHandler(getBankaccountNickName),
);

/**
 * @swagger
 * /bankAccounts/{id}:
 *   get:
 *     summary: Get a bank account by ID
 *     description: Returns the details of a specific bank account.
 *     tags: [Bank Accounts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the bank account to fetch
 *     responses:
 *       200:
 *         description: The requested bank account
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
 *         description: Bank account not found
 *       500:
 *         description: Internal server error
 */
router.get(
  '/:id',
  [isAuthenticated, authorized(AccessRoles.BANK_ACCOUNT)],
  tryCatchHandler(getBankaccountById),
);
/**
 * @swagger
 * /bankAccounts/create-bankAccount:
 *   post:
 *     summary: Create a new bank account
 *     description: Creates a new bank account and returns the created account.
 *     tags: [Bank Accounts]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               bankAccountsname:
 *                 type: string
 *                 description: The name of the bank account (e.g., username or account name)
 *               created_by:
 *                 type: integer
 *                 description: ID of the user creating the bank account
 *     responses:
 *       201:
 *         description: Bank account created successfully
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
 *       400:
 *         description: Bad request (validation error)
 *       500:
 *         description: Internal server error
 */
router.post(
  '/create-bank',
  [isAuthenticated, authorized(AccessRoles.BANK_ACCOUNT)],
  tryCatchHandler(createBankaccount),
);

/**
 * @swagger
 * /bankAccounts/get-merchantBanks:
 *   get:
 *     summary: Get all merchant bank accounts
 *     description: Returns a list of all merchant bank accounts.
 *     tags: [Bank Accounts]
 *     responses:
 *       200:
 *         description: A list of merchant bank accounts
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
 *                     example: "merchant_account"
 *       500:
 *         description: Internal server error
 */
// router.get('/get-merchantBanks', [isAuthenticated, authorized(AccessRoles.BANK_ACCOUNT)], tryCatchHandler(getMerchantBank));

/**
 * @swagger
 * /bankAccounts/update-bankAccount/{id}:
 *   put:
 *     summary: Update a bank account
 *     description: Updates the details of a specific bank account.
 *     tags: [Bank Accounts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the bank account to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               bankAccountsname:
 *                 type: string
 *                 description: The updated name of the bank account
 *               updated_by:
 *                 type: integer
 *                 description: ID of the user updating the bank account
 *     responses:
 *       200:
 *         description: Bank account updated successfully
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
 *         description: Bank account not found
 *       400:
 *         description: Bad request (validation error)
 *       500:
 *         description: Internal server error
 */
router.put(
  '/update-bank/:id',
  [isAuthenticated, authorized(AccessRoles.BANK_ACCOUNT)],
  tryCatchHandler(updateBankaccount),
);

/**
 * @swagger
 * /bankAccounts/delete-bankAccount/{id}:
 *   delete:
 *     summary: Delete a bank account
 *     description: Deletes a specific bank account by ID.
 *     tags: [Bank Accounts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the bank account to delete
 *     responses:
 *       200:
 *         description: Bank account deleted successfully
 *       404:
 *         description: Bank account not found
 *       500:
 *         description: Internal server error
 */
router.delete(
  '/delete-bank/:id',
  [isAuthenticated, authorized(AccessRoles.BANK_ACCOUNT)],
  tryCatchHandler(deleteBankaccount),
);

export default router;
