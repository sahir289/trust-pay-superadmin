import express from 'express';
import tryCatchHandler from '../../utils/tryCatchHandler.js';
import {
  createUserHierarchy,
  deleteUserHierarchy,
  getUserHierarchys,
  updateUserHierarchy,
  getUserHierarchysById,
} from './userHierarchyController.js';
import { authorized, isAuthenticated } from '../../middlewares/auth.js';
import { AccessRoles } from '../../constants/index.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: User Hierarchy
 *   description: API endpoints for managing user hierarchies
 */

/**
 * @swagger
 * /userHierarchy:
 *   get:
 *     summary: Retrieve all userHierarchys
 *     description: Returns a list of all userHierarchys.
 *     tags: [User Hierarchy]
 *     responses:
 *       200:
 *         description: A list of userHierarchys.
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
  [isAuthenticated, authorized(AccessRoles.USER_HIERARCHY.UPDATE_READ)],
  tryCatchHandler(getUserHierarchys),
);

/**
 * @swagger
 * /userHierarchy/{id}:
 *   get:
 *     summary: Retrieve a specific userHierarchy by ID
 *     description: Returns the details of a userHierarchy based on the provided ID.
 *     tags: [User Hierarchy]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: The ID of the user hierarchy to retrieve.
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: A userHierarchy object.
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
 *                   example: "active"
 *       404:
 *         description: UserHierarchy not found.
 */
router.get(
  '/:id',
  [isAuthenticated, authorized(AccessRoles.USER_HIERARCHY.UPDATE_READ)],
  tryCatchHandler(getUserHierarchysById),
);

/**
 * @swagger
 * /userHierarchy/create-userHierarchy:
 *   post:
 *     summary: Create a new userHierarchy
 *     description: Adds a new userHierarchy to the system.
 *     tags: [User Hierarchy]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "UserHierarchy A"
 *               status:
 *                 type: string
 *                 example: "active"
 *     responses:
 *       201:
 *         description: UserHierarchy created successfully.
 *       400:
 *         description: Invalid request data.
 */
router.post(
  '/create-userHierarchy',
  [isAuthenticated, authorized(AccessRoles.USER_HIERARCHY.CREATE_DELETE)],
  tryCatchHandler(createUserHierarchy),
);

/**
 * @swagger
 * /userHierarchy/update-userHierarchy/{id}:
 *   put:
 *     summary: Update userHierarchy details
 *     description: Updates an existing userHierarchy’s details by its ID.
 *     tags: [User Hierarchy]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: The ID of the userHierarchy to update.
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Updated UserHierarchy"
 *               status:
 *                 type: string
 *                 example: "inactive"
 *     responses:
 *       200:
 *         description: UserHierarchy updated successfully.
 *       404:
 *         description: UserHierarchy not found.
 */
router.put(
  '/update-userHierarchy/:id',
  [isAuthenticated, authorized(AccessRoles.USER_HIERARCHY.UPDATE_READ)],
  tryCatchHandler(updateUserHierarchy),
);

/**
 * @swagger
 * /userHierarchy/delete-userHierarchy/{id}:
 *   delete:
 *     summary: Delete a userHierarchy
 *     description: Soft deletes a userHierarchy by changing its status to inactive.
 *     tags: [User Hierarchy]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: The ID of the userHierarchy to delete.
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: UserHierarchy deleted successfully.
 *       404:
 *         description: UserHierarchy not found.
 */
router.delete(
  '/delete-userHierarchy/:id',
  [isAuthenticated, authorized(AccessRoles.USER_HIERARCHY.CREATE_DELETE)],
  tryCatchHandler(deleteUserHierarchy),
);

export default router;
