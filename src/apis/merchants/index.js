import express from 'express';
import tryCatchHandler from '../../utils/tryCatchHandler.js';
import {
  createMerchant,
  deleteMerchant,
  getMerchants,
  updateMerchant,
  getMerchantsById,
  getMerchantCodes,
  getMerchantsBySearch,
  getMerchantByCode,
} from './merchantController.js';
import { authorized, isAuthenticated } from '../../middlewares/auth.js';
import { AccessRoles } from '../../constants/index.js';

const router = express.Router();

/**
 * @swagger
 * /merchants:
 *   get:
 *     summary: Retrieve all merchants
 *     description: Returns a list of all merchants.
 *     tags:
 *       - Merchants
 *     responses:
 *       200:
 *         description: A list of merchants.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   name:
 *                     type: string
 *                   status:
 *                     type: string
 *                     example: "active"
 */
router.get(
  '/',
  [isAuthenticated, authorized(AccessRoles.MERCHANT)],
  tryCatchHandler(getMerchants),
);

router.get(
  '/search',
  [isAuthenticated, authorized(AccessRoles.MERCHANT)],
  tryCatchHandler(getMerchantsBySearch),
);

router.get(
  '/get-merchant-by-code',
  [isAuthenticated, authorized(AccessRoles.MERCHANT)],
  tryCatchHandler(getMerchantByCode),
);

/**
 * @swagger
 * /merchants:
 *   get:
 *     summary: Retrieve all merchants
 *     description: Returns a list of all merchants.
 *     tags:
 *       - Merchants
 *     responses:
 *       200:
 *         description: A list of merchants.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   name:
 *                     type: string
 *                   status:
 *                     type: string
 *                     example: "active"
 */
router.get(
  '/codes',
  [isAuthenticated, authorized(AccessRoles.MERCHANT)],
  tryCatchHandler(getMerchantCodes),
);

/**
 * @swagger
 * /merchants/:id:
 *   get:
 *     summary: Retrieve a merchant by id
 *     description: Returns a merchant by id.
 *     tags:
 *       - Merchants
 *     responses:
 *       200:
 *         description: A merchant by id.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   name:
 *                     type: string
 *                   status:
 *                     type: string
 *                     example: "active"
 */
router.get(
  '/:id',
  [isAuthenticated, authorized(AccessRoles.MERCHANT)],
  tryCatchHandler(getMerchantsById),
);

/**
 * @swagger
 * /merchants/create-merchant:
 *   post:
 *     summary: Create a new merchant
 *     description: Adds a new merchant to the system.
 *     tags:
 *       - Merchants
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Merchant A"
 *               status:
 *                 type: string
 *                 example: "active"
 *     responses:
 *       201:
 *         description: Merchant created successfully.
 *       400:
 *         description: Invalid request data.
 */
router.post(
  '/create-merchant',
  [isAuthenticated, authorized(AccessRoles.MERCHANT)],
  tryCatchHandler(createMerchant),
);

/**
 * @swagger
 * /merchants/update-merchant/{id}:
 *   put:
 *     summary: Update merchant details
 *     description: Updates an existing merchant’s details.
 *     tags:
 *       - Merchants
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id:
 *                 type: string
 *               name:
 *                 type: string
 *               status:
 *                 type: string
 *                 example: "inactive"
 *     responses:
 *       200:
 *         description: Merchant updated successfully.
 *       404:
 *         description: Merchant not found.
 */
router.put(
  '/update-merchant/:id',
  [isAuthenticated, authorized(AccessRoles.MERCHANT)],
  tryCatchHandler(updateMerchant),
);

/**
 * @swagger
 * /merchants/delete-merchant/{id}:
 *   delete:
 *     summary: Delete a merchant
 *     description: Soft deletes a merchant by changing its status.
 *     tags:
 *       - Merchants
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id:
 *                 type: string
 *     responses:
 *       200:
 *         description: Merchant deleted successfully.
 *       404:
 *         description: Merchant not found.
 */

router.delete(
  '/delete-merchant/:id',
  [isAuthenticated, authorized(AccessRoles.MERCHANT)],
  tryCatchHandler(deleteMerchant),
);

export default router;
