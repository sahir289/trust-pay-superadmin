import express from 'express';
import { getTotalCount } from './commonController.js';
import { isAuthenticated, authorized } from '../../middlewares/auth.js';
import { AccessRoles } from '../../constants/index.js';

const router = express.Router();

/**
 * @swagger
 * /common/count/{tableName}:
 *   get:
 *     summary: Get total count for a module
 *     description: Returns the total count of records for a given module.
 *     tags:
 *       - Common
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tableName
 *         required: true
 *         schema:
 *           type: string
 *         description: Name of the table/module
 *       - in: query
 *         name: role
 *         required: false
 *         schema:
 *           type: string
 *         description: Role of the user
 *     responses:
 *       200:
 *         description: Total count retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 count:
 *                   type: integer
 *                   example: 100
 */
router.get(
  '/count/:tableName',
  [isAuthenticated, authorized(AccessRoles.ALL)],
  getTotalCount,
);

export default router;
