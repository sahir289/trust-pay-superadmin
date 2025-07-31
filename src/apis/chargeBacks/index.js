import express from 'express';
import tryCatchHandler from '../../utils/tryCatchHandler.js';
import {
  createChargeBack,
  deleteChargeBack,
  getChargeBacks,
  updateChargeBack,
  getChargeBacksById,
  getChargeBacksBySearch,
  blockChargebackUser,
} from './chargeBackController.js';
import { authorized, isAuthenticated } from '../../middlewares/auth.js';
import { AccessRoles } from '../../constants/index.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: ChargeBacks
 *   description: API endpoints for managing chargebacks
 */

/**
 * @swagger
 * /chargeBacks:
 *   get:
 *     summary: Get all chargebacks
 *     description: Fetches all chargebacks from the system.
 *     tags: [ChargeBacks]
 *     responses:
 *       200:
 *         description: Successfully retrieved chargebacks.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "get chargebacks successfully"
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         example: 1
 *                       amount:
 *                         type: number
 *                         example: 100.50
 *                       reason:
 *                         type: string
 *                         example: "fraudulent transaction"
 *       500:
 *         description: Internal server error
 */
router.get(
  '/',
  [isAuthenticated, authorized(AccessRoles.CHARGE_BACK.GET)],
  tryCatchHandler(getChargeBacksBySearch),
);
router.get(
  '/reports',
  [isAuthenticated, authorized(AccessRoles.CHARGE_BACK.GET)],
  tryCatchHandler(getChargeBacks),
);
/**
 * @swagger
 * /chargeBacks/{id}:
 *   get:
 *     summary: Get a chargeback by ID
 *     description: Fetches a specific chargeback by its ID.
 *     tags: [ChargeBacks]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the chargeback to fetch.
 *     responses:
 *       200:
 *         description: Successfully retrieved the chargeback.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                   example: 1
 *                 amount:
 *                   type: number
 *                   example: 100.50
 *                 reason:
 *                   type: string
 *                   example: "fraudulent transaction"
 *       404:
 *         description: ChargeBack not found.
 *       500:
 *         description: Internal server error
 */
router.get(
  '/:id',
  [isAuthenticated, authorized(AccessRoles.CHARGE_BACK.GET)],
  tryCatchHandler(getChargeBacksById),
);

/**
 * @swagger
 * /chargeBacks/create-chargeback:
 *   post:
 *     summary: Create a chargeback
 *     description: Adds a new chargeback to the system.
 *     tags: [ChargeBacks]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               amount:
 *                 type: number
 *                 description: The amount of the chargeback.
 *                 example: 100.50
 *               reason:
 *                 type: string
 *                 description: The reason for the chargeback.
 *                 example: "fraudulent transaction"
 *     responses:
 *       201:
 *         description: ChargeBack created successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "ChargeBack created successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     amount:
 *                       type: number
 *                       example: 100.50
 *                     reason:
 *                       type: string
 *                       example: "fraudulent transaction"
 *       400:
 *         description: Bad request (validation error).
 *       500:
 *         description: Internal server error.
 */
router.post(
  '/create-chargeback',
  [isAuthenticated, authorized(AccessRoles.CHARGE_BACK.CREATE_DELETE)],
  tryCatchHandler(createChargeBack),
);

/**
 * @swagger
 * /chargeBacks/update-chargeback/{id}:
 *   put:
 *     summary: Update a chargeback
 *     description: Updates an existing chargeback in the system.
 *     tags: [ChargeBacks]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the chargeback to update.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               amount:
 *                 type: number
 *                 description: The updated amount for the chargeback.
 *                 example: 150.00
 *               reason:
 *                 type: string
 *                 description: The updated reason for the chargeback.
 *                 example: "unauthorized transaction"
 *     responses:
 *       200:
 *         description: ChargeBack updated successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "ChargeBack updated successfully"
 *       400:
 *         description: Bad request (validation error).
 *       404:
 *         description: ChargeBack not found.
 *       500:
 *         description: Internal server error.
 */
router.put(
  '/update-chargeback/:id',
  [isAuthenticated, authorized(AccessRoles.CHARGE_BACK.UPDATE_READ)],
  tryCatchHandler(updateChargeBack),
);

router.put(
  '/blockuser-chargeback/:id',
  [isAuthenticated, authorized(AccessRoles.CHARGE_BACK.UPDATE_READ)],
  tryCatchHandler(blockChargebackUser),
);

/**
 * @swagger
 * /chargeBacks/delete-chargeback/{id}:
 *   delete:
 *     summary: Delete a chargeback
 *     description: Marks a chargeback as deleted in the system.
 *     tags: [ChargeBacks]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the chargeback to delete.
 *     responses:
 *       200:
 *         description: ChargeBack deleted successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "ChargeBack deleted successfully"
 *       404:
 *         description: ChargeBack not found.
 *       500:
 *         description: Internal server error.
 */
router.delete(
  '/delete-chargeback/:id',
  [isAuthenticated, authorized(AccessRoles.CHARGE_BACK.UPDATE_READ)],
  tryCatchHandler(deleteChargeBack),
);

export default router;
