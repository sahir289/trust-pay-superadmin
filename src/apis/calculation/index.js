import express from 'express';
import tryCatchHandler from '../../utils/tryCatchHandler.js';
import {
  getCalculation,
  getCalculationById,
  createCalculation,
  updateCalculation,
  deleteCalculation,
  calculateSuccessRatios,
} from './calculationController.js';
import { authorized, isAuthenticated } from '../../middlewares/auth.js';
import { AccessRoles } from '../../constants/index.js';
const router = express.Router();

router.post('/success_ratio', tryCatchHandler(calculateSuccessRatios));

/**
 * @swagger
 * tags:
 *   name: Calculations
 *   description: API endpoints for managing calculations
 */

/**
 * @swagger
 * /calculations:
 *   get:
 *     summary: Get all calculations
 *     tags: [Calculations]
 *     responses:
 *       200:
 *         description: A list of all calculations
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   formula:
 *                     type: string
 *                   parameters:
 *                     type: array
 *                     items:
 *                       type: number
 *                   created_by:
 *                     type: integer
 *                   created_at:
 *                     type: string
 *                     format: date-time
 *                   updated_at:
 *                     type: string
 *                     format: date-time
 *       500:
 *         description: Internal server error
 */
router.get(
  '/',
  [isAuthenticated, authorized(AccessRoles.CALCULATION)],
  tryCatchHandler(getCalculation),
);

/**
 * @swagger
 * /calculations/{id}:
 *   get:
 *     summary: Get a calculation by ID
 *     tags: [Calculations]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the calculation to fetch
 *     responses:
 *       200:
 *         description: The requested calculation
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                 formula:
 *                   type: string
 *                 parameters:
 *                   type: array
 *                   items:
 *                     type: number
 *                 created_by:
 *                   type: integer
 *                 created_at:
 *                   type: string
 *                   format: date-time
 *                 updated_at:
 *                   type: string
 *                   format: date-time
 *       404:
 *         description: Calculation not found
 *       500:
 *         description: Internal server error
 */
router.get(
  '/:user_id',
  [isAuthenticated, authorized(AccessRoles.CALCULATION)],
  tryCatchHandler(getCalculationById),
);

/**
 * @swagger
 * /calculations/create-calculation:
 *   post:
 *     summary: Create a new calculation
 *     tags: [Calculations]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               formula:
 *                 type: string
 *                 description: The formula for the calculation
 *               parameters:
 *                 type: array
 *                 items:
 *                   type: number
 *                 description: The parameters for the calculation
 *               created_by:
 *                 type: integer
 *                 description: ID of the user creating the calculation
 *     responses:
 *       201:
 *         description: Calculation created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                 formula:
 *                   type: string
 *                 parameters:
 *                   type: array
 *                   items:
 *                     type: number
 *                 created_by:
 *                   type: integer
 *                 created_at:
 *                   type: string
 *                   format: date-time
 *                 updated_at:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Bad request (validation error)
 *       500:
 *         description: Internal server error
 */
router.post(
  '/create-calculation',
  [isAuthenticated, authorized(AccessRoles.CALCULATION)],
  tryCatchHandler(createCalculation),
);

/**
 * @swagger
 * /calculations/update-calculation/{id}:
 *   put:
 *     summary: Update a calculation
 *     tags: [Calculations]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the calculation to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               formula:
 *                 type: string
 *                 description: The formula for the calculation
 *               parameters:
 *                 type: array
 *                 items:
 *                   type: number
 *                 description: The parameters for the calculation
 *     responses:
 *       200:
 *         description: Calculation updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                 formula:
 *                   type: string
 *                 parameters:
 *                   type: array
 *                   items:
 *                     type: number
 *                 created_by:
 *                   type: integer
 *                 created_at:
 *                   type: string
 *                   format: date-time
 *                 updated_at:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Bad request (validation error)
 *       404:
 *         description: Calculation not found
 *       500:
 *         description: Internal server error
 */
router.put(
  '/update-calculation/:id',
  [isAuthenticated, authorized(AccessRoles.CALCULATION)],
  tryCatchHandler(updateCalculation),
);

/**
 * @swagger
 * /calculations/delete-calculation/{id}:
 *   delete:
 *     summary: Soft delete a calculation
 *     tags: [Calculations]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the calculation to delete
 *     responses:
 *       200:
 *         description: Calculation deleted successfully
 *       404:
 *         description: Calculation not found
 *       500:
 *         description: Internal server error
 */
router.delete(
  '/delete-calculation/:id',
  [isAuthenticated, authorized(AccessRoles.CALCULATION)],
  tryCatchHandler(deleteCalculation),
);

export default router;
