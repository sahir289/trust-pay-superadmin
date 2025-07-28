import express from 'express';
import tryCatchHandler from '../../utils/tryCatchHandler.js';
import {
  createPayout,
  deletePayout,
  getPayouts,
  updatePayout,
  getPayoutsById,
  getPayoutsBySearch,
  checkPayOutStatus,
  walletsPayouts,
  assignedPayout,
  getWalletsBalance
} from './payOutController.js';
import { authorized, isAuthenticated } from '../../middlewares/auth.js';
import { AccessRoles } from '../../constants/index.js';
const router = express.Router();

/**
 * @swagger
 * /payout:
 *   get:
 *     summary: Retrieve all payouts
 *     description: Returns a list of all payouts.
 *     tags:
 *       - Payout
 *     responses:
 *       200:
 *         description: A list of payouts.
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
 *       401:
 *         description: Unauthorized access
 */
router.get(
  '/',
  [isAuthenticated, authorized(AccessRoles.PAYOUT)],
  tryCatchHandler(getPayouts),
);

/**
 * @swagger
 * /payout/{id}:
 *   get:
 *     summary: Retrieve a specific payout by ID
 *     description: Retrieves the details of a specific payout by its ID.
 *     tags:
 *       - Payout
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the payout to retrieve.
 *     responses:
 *       200:
 *         description: Payout details retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 name:
 *                   type: string
 *                 status:
 *                   type: string
 *       404:
 *         description: Payout not found.
 *       401:
 *         description: Unauthorized access
 */
router.get(
  '/search',
  [isAuthenticated, authorized(AccessRoles.PAYOUT)],
  tryCatchHandler(getPayoutsBySearch),
);
router.get(
  '/wallets-balance',
  [isAuthenticated, authorized(AccessRoles.PAYOUT)],
  tryCatchHandler(getWalletsBalance),
); 
router.get(
  '/:id',
  [isAuthenticated, authorized(AccessRoles.PAYOUT)],
  tryCatchHandler(getPayoutsById),
);
/**
 * @swagger
 * /payout/create-payout:
 *   post:
 *     summary: Create a new payout
 *     description: Adds a new payout to the system.
 *     tags:
 *       - Payout
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Payout A"
 *               status:
 *                 type: string
 *                 example: "active"
 *     responses:
 *       201:
 *         description: Payout created successfully.
 *       400:
 *         description: Invalid request data.
 *       401:
 *         description: Unauthorized access
 */
router.post(
  '/create-payout',
  // [isAuthenticated, authorized(AccessRoles.PAYOUT)],
  tryCatchHandler(createPayout),
);

/**
 * @swagger
 * /payout/check-payout-status:
 *   post:
 *     summary: Check Pay-Out Status
 *     description: Checks the status of a specific Pay-In URL.
 *     tags: [PayOut]
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
 *         description: Pay-Out status retrieved successfully.
 *       500:
 *         description: Internal server error
 */
router.post('/check-payout-status', tryCatchHandler(checkPayOutStatus));

/**
 * @swagger
 * /payout/update-payout/{id}:
 *   put:
 *     summary: Update payout details
 *     description: Updates an existing payout's details by its ID.
 *     tags:
 *       - Payout
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the payout to update.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Updated Payout"
 *               status:
 *                 type: string
 *                 example: "inactive"
 *     responses:
 *       200:
 *         description: Payout updated successfully.
 *       404:
 *         description: Payout not found.
 *       401:
 *         description: Unauthorized access
 */
router.put(
  '/update-payout/:id',
  [isAuthenticated, authorized(AccessRoles.PAYOUT)],
  tryCatchHandler(updatePayout),
);
router.put(
  '/assign-vendor-payout/:id',
  [isAuthenticated, authorized(AccessRoles.PAYOUT)],
  tryCatchHandler(assignedPayout),
);
/**
 * @swagger
 * /payout/delete-payout/{id}:
 *   delete:
 *     summary: Delete a payout
 *     description: Soft deletes a payout by changing its status to inactive.
 *     tags:
 *       - Payout
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the payout to delete.
 *     responses:
 *       200:
 *         description: Payout deleted successfully.
 *       404:
 *         description: Payout not found.
 *       401:
 *         description: Unauthorized access
 */
router.delete(
  '/delete-payout/:id',
  [isAuthenticated, authorized(AccessRoles.PAYOUT)],
  tryCatchHandler(deletePayout),
);

router.post(
  '/wallets',
  [isAuthenticated, authorized(AccessRoles.PAYOUT)],
  tryCatchHandler(walletsPayouts),
); 

// router.post(
//   '/payouts',
//   [isAuthenticated, authorized(AccessRoles.PAYOUT)],
//   tryCatchHandler(createPayout),
// );

export default router;
