import express from 'express';
import tryCatchHandler from '../../utils/tryCatchHandler.js';

import { isAuthenticated, authorized } from '../../middlewares/auth.js';
import { AccessRoles } from '../../constants/index.js';
import {
  createResetHistory,
  deleteResetHistory,
  getResetHistory,
  updateResetHistory,
  getResetHistoryBySearch,
} from './resetController.js';
const router = express.Router();

/**
 * @swagger
 * /ResetHistory:
 *   get:
 *     summary: Get ResetHistory by ID
 *     description: Retrieves details of a specific ResetHistory by its ID.
 *     tags:
 *       - ResetHistory
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the ResetHistory to retrieve.
 *     responses:
 *       200:
 *         description: ResetHistory details retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "ResetHistory retrieved successfully"
 *                 data:
 *                   type: object
 */
router.get(
  '/',
  [isAuthenticated, authorized(AccessRoles.RESET_DATA_HISTORY)],
  tryCatchHandler(getResetHistory),
);
router.get(
  '/search',
  [isAuthenticated, authorized(AccessRoles.RESET_DATA_HISTORY)],
  tryCatchHandler(getResetHistoryBySearch),
);
/**
 * @swagger
 * /ResetHistory/create-ResetHistory:
 *   post:
 *     summary: Create a new ResetHistory
 *     description: Creates a new ResetHistory with the provided details.
 *     tags:
 *       - ResetHistory
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               ResetHistoryName:
 *                 type: string
 *                 example: "Tech Solutions Ltd."
 *     responses:
 *       201:
 *         description: ResetHistory created successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "ResetHistory created successfully"
 *                 data:
 *                   type: object
 */
router.post(
  '/create-ResetHistory',
  [isAuthenticated, authorized(AccessRoles.RESET_DATA_HISTORY)],
  tryCatchHandler(createResetHistory),
);

/**
 * @swagger
 * /ResetHistory/update-ResetHistory/{id}:
 *   put:
 *     summary: Update an existing ResetHistory
 *     description: Updates the details of a specific ResetHistory by ID.
 *     tags:
 *       - ResetHistory
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the ResetHistory to update.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               ResetHistoryName:
 *                 type: string
 *                 example: "Updated ResetHistory Name"
 *     responses:
 *       200:
 *         description: ResetHistory updated successfully.
 */
router.post(
  '/update-ResetHistory/:id',
  [isAuthenticated, authorized(AccessRoles.RESET_DATA_HISTORY)],
  tryCatchHandler(updateResetHistory),
);

/**
 * @swagger
 * /ResetHistory/delete-ResetHistory/{id}:
 *   delete:
 *     summary: Delete a ResetHistory
 *     description: Deletes a ResetHistory by ID.
 *     tags:
 *       - ResetHistory
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the ResetHistory to delete.
 *     responses:
 *       200:
 *         description: ResetHistory deleted successfully.
 */
router.delete(
  '/delete-ResetHistory/:id',
  [isAuthenticated, authorized(AccessRoles.RESET_DATA_HISTORY)],
  tryCatchHandler(deleteResetHistory),
);

export default router;
