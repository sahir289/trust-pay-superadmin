import express from 'express';
import tryCatchHandler from '../../utils/tryCatchHandler.js';
import {
  createCheckUtr,
  deleteCheckUtr,
  getCheckUtr,
  getCheckUtrBySearch,
  updateCheckUtr,
} from './checkUtrController.js';
import { isAuthenticated, authorized } from '../../middlewares/auth.js';
import { AccessRoles } from '../../constants/index.js';
const router = express.Router();

/**
 * @swagger
 * /CheckUtr:
 *   get:
 *     summary: Get CheckUtr by ID
 *     description: Retrieves details of a specific CheckUtr by its ID.
 *     tags:
 *       - CheckUtr
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the CheckUtr to retrieve.
 *     responses:
 *       200:
 *         description: CheckUtr details retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "CheckUtr retrieved successfully"
 *                 data:
 *                   type: object
 */
router.get(
  '/',
  [isAuthenticated, authorized(AccessRoles.CHECK_UTR_HISTORY)],
  tryCatchHandler(getCheckUtr),
);

router.get(
  '/search/',
  [isAuthenticated, authorized(AccessRoles.CHECK_UTR_HISTORY)],
  tryCatchHandler(getCheckUtrBySearch),
);

/**
 * @swagger
 * /CheckUtr/create-CheckUtr:
 *   post:
 *     summary: Create a new CheckUtr
 *     description: Creates a new CheckUtr with the provided details.
 *     tags:
 *       - CheckUtr
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               CheckUtrName:
 *                 type: string
 *                 example: "Tech Solutions Ltd."
 *     responses:
 *       201:
 *         description: CheckUtr created successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "CheckUtr created successfully"
 *                 data:
 *                   type: object
 */
router.post(
  '/create',
  [isAuthenticated, authorized(AccessRoles.CHECK_UTR_HISTORY)],
  tryCatchHandler(createCheckUtr),
);

/**
 * @swagger
 * /CheckUtr/update-CheckUtr/{id}:
 *   put:
 *     summary: Update an existing CheckUtr
 *     description: Updates the details of a specific CheckUtr by ID.
 *     tags:
 *       - CheckUtr
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the CheckUtr to update.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               CheckUtrName:
 *                 type: string
 *                 example: "Updated CheckUtr Name"
 *     responses:
 *       200:
 *         description: CheckUtr updated successfully.
 */
router.put(
  '/update-CheckUtr/:id',
  [isAuthenticated, authorized(AccessRoles.CHECK_UTR_HISTORY)],
  tryCatchHandler(updateCheckUtr),
);

/**
 * @swagger
 * /CheckUtr/delete-CheckUtr/{id}:
 *   delete:
 *     summary: Delete a CheckUtr
 *     description: Deletes a CheckUtr by ID.
 *     tags:
 *       - CheckUtr
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the CheckUtr to delete.
 *     responses:
 *       200:
 *         description: CheckUtr deleted successfully.
 */
router.delete(
  '/delete-CheckUtr/:id',
  [isAuthenticated, authorized(AccessRoles.CHECK_UTR_HISTORY)],
  tryCatchHandler(deleteCheckUtr),
);

export default router;
