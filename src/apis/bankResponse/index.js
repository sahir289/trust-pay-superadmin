import express from 'express';
import tryCatchHandler from '../../utils/tryCatchHandler.js';
import {
  createBankResponse,
  getBankResponse,
  getBankMessage,
  updateBankResponse,
  getBankResponseBySearch,
  createBankBotResponse,
  getClaimResponse,
  importBankResponse,
  resetBankResponseController,
} from './bankResponseController.js';
import { isAuthenticated, authorized } from '../../middlewares/auth.js';
import { AccessRoles } from '../../constants/index.js';
import { multerUpload } from '../../utils/index.js';
const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: BankResponse
 *   description: Api endpoints for managing bankResponse
 */

router.get(
  '/claim',
  [isAuthenticated, authorized(AccessRoles.BANK_RESPONSE)],
  tryCatchHandler(getClaimResponse),
);

/**
 * @swagger
 * /bankResponse:
 *   get:
 *     summary: Get all bankResponse
 *     tags: [BankResponse]
 *     responses:
 *       200:
 *         description: A list of bankResponse
 *       500:
 *         description: Internal server error
 */
router.post('/create-bot-message', tryCatchHandler(createBankBotResponse));

/**
 * @swagger
 * tags:
 *   name: BankResponse
 *   description: Api endpoints for managing bankResponse
 */

/**
 * @swagger
 * /bankResponse:
 *   get:
 *     summary: Get all bankResponse
 *     tags: [BankResponse]
 *     responses:
 *       200:
 *         description: A list of bankResponse
 *       500:
 *         description: Internal server error
 */
router.post(
  '/create-message',
  [isAuthenticated, authorized(AccessRoles.BANK_RESPONSE)],
  tryCatchHandler(createBankResponse),
);

/**
 * @swagger
 * /bankResponse/create-complaint:
 *   post:
 *     summary: Create a new complaint
 *     tags: [BankResponse]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               complaint_type:
 *                 type: string
 *               description:
 *                 type: string
 *               user_id:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Complaint created successfully
 *       400:
 *         description: Bad request
 */
router.get(
  '/',
  [isAuthenticated, authorized(AccessRoles.BANK_RESPONSE)],
  tryCatchHandler(getBankResponse),
);

router.get(
  '/search',
  [isAuthenticated, authorized(AccessRoles.BANK_RESPONSE)],
  tryCatchHandler(getBankResponseBySearch),
);
/**
 * @swagger
 * /bankResponse/update-complaint/{id}:
 *   put:
 *     summary: Update a complaint
 *     tags: [BankResponse]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the complaint to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               complaint_type:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: Complaint updated successfully
 *       404:
 *         description: Complaint not found
 */

router.get(
  '/get-bank-message',
  [isAuthenticated, authorized(AccessRoles.BANK_RESPONSE)],
  tryCatchHandler(getBankMessage),
);

/**
 * @swagger
 * /bankResponse/update-message/{id}:
 *   put:
 *     summary: update a BankResponse
 *     tags: [BankResponse]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the BankResponse to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               complaint_type:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: BankResponse updated successfully
 *       404:
 *         description: BankResponse not found
 */

router.put(
  '/update-message/:id',
  [isAuthenticated, authorized(AccessRoles.BANK_RESPONSE)],
  tryCatchHandler(updateBankResponse),
);

/**
 * @swagger
 * /bankResponse/delete-complaint/{id}:
 *   delete:
 *     summary: Soft delete a complaint
 *     tags: [BankResponse]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the complaint to delete
 *     responses:
 *       200:
 *         description: Complaint deleted successfully
 *       404:
 *         description: Complaint not found
 */

router.put(
  '/reset-message/:id',
  [isAuthenticated, authorized(AccessRoles.BANK_RESPONSE)],
  tryCatchHandler(resetBankResponseController),
);

router.post(
  '/import-bank-response',
  multerUpload.single('file'),
  [isAuthenticated, authorized(AccessRoles.BANK_RESPONSE)],
  tryCatchHandler(importBankResponse),
);

export default router;
