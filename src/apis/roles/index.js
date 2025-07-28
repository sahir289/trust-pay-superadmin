import express from 'express';
import tryCatchHandler from '../../utils/tryCatchHandler.js';
import {
  getRoles,
  createRole,
  updateRole,
  deleteRole,
  getRolesById,
} from './rolesController.js';
import { authorized, isAuthenticated } from '../../middlewares/auth.js';
import { AccessRoles } from '../../constants/index.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Roles
 *   description: API endpoints for managing roles
 */

/**
 * @swagger
 * /roles:
 *   get:
 *     summary: Get all roles
 *     tags: [Roles]
 *     responses:
 *       200:
 *         description: A list of roles
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
 *                   role:
 *                     type: string
 *                     example: "Admin"
 *                   company_id:
 *                     type: integer
 *                     example: 123
 *       500:
 *         description: Internal server error
 */

router.get(
  '/',
  [isAuthenticated, authorized(AccessRoles.ROLES)],
  tryCatchHandler(getRoles),
);

/**
 * @swagger
 * /roles/{id}:
 *   get:
 *     summary: Get a specific role by ID
 *     tags: [Roles]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the role to retrieve
 *     responses:
 *       200:
 *         description: Role details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                   example: 1
 *                 role:
 *                   type: string
 *                   example: "Admin"
 *                 company_id:
 *                   type: integer
 *                   example: 123
 *       404:
 *         description: Role not found
 */
router.get(
  '/:id',
  [isAuthenticated, authorized(AccessRoles.ROLES)],
  tryCatchHandler(getRolesById),
);
/**
 * @swagger
 * /roles/create-role:
 *   post:
 *     summary: Create a new role
 *     tags: [Roles]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               role:
 *                 type: string
 *                 example: "Manager"
 *               company_id:
 *                 type: integer
 *                 example: 123
 *               created_by:
 *                 type: integer
 *                 example: 1
 *     responses:
 *       201:
 *         description: Role created successfully
 *       400:
 *         description: Bad request due to missing/invalid fields
 */
router.post(
  '/create-role',
  [isAuthenticated, authorized(AccessRoles.ROLES)],
  tryCatchHandler(createRole),
);

/**
 * @swagger
 * /roles/update-role/{id}:
 *   put:
 *     summary: Update a role
 *     tags: [Roles]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the role to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               role:
 *                 type: string
 *                 example: "Senior Manager"
 *               company_id:
 *                 type: integer
 *                 example: 123
 *     responses:
 *       200:
 *         description: Role updated successfully
 *       404:
 *         description: Role not found
 */
router.put(
  '/update-role/:id',
  [isAuthenticated, authorized(AccessRoles.ROLES)],
  tryCatchHandler(updateRole),
);

/**
 * @swagger
 * /roles/delete-role/{id}:
 *   delete:
 *     summary: Soft delete a role
 *     tags: [Roles]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the role to delete
 *     responses:
 *       200:
 *         description: Role deleted successfully
 *       404:
 *         description: Role not found
 */
router.delete(
  '/delete-role/:id',
  [isAuthenticated, authorized(AccessRoles.ROLES)],
  tryCatchHandler(deleteRole),
);

export default router;
