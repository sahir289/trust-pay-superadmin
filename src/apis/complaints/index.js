import express from 'express';
import tryCatchHandler from '../../utils/tryCatchHandler.js';
import {
  createComplaints,
  deleteComplaints,
  getComplaints,
  getComplaintsById,
  updateComplaints,
} from './complaintsController.js';
import { authorized, isAuthenticated } from '../../middlewares/auth.js';
import { AccessRoles } from '../../constants/index.js';
const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Complaints
 *   description: API endpoints for managing complaints
 */

/**
 * @swagger
 * /complaints:
 *   get:
 *     summary: Get all complaints
 *     tags: [Complaints]
 *     responses:
 *       200:
 *         description: Successfully retrieved the list of complaints
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Complaints retrieved successfully"
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         example: 1
 *                       complaint_type:
 *                         type: string
 *                         example: "Technical Issue"
 *                       description:
 *                         type: string
 *                         example: "User cannot log in"
 *                       user_id:
 *                         type: integer
 *                         example: 123
 *       500:
 *         description: Internal server error
 */
router.get(
  '/',
  [isAuthenticated, authorized(AccessRoles.COMPLAINTS)],
  tryCatchHandler(getComplaints),
);

/**
 * @swagger
 * /complaints/{id}:
 *   get:
 *     summary: Get a specific complaint by ID
 *     tags: [Complaints]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the complaint to retrieve
 *     responses:
 *       200:
 *         description: Complaint details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Complaint retrieved successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     complaint_type:
 *                       type: string
 *                       example: "Technical Issue"
 *                     description:
 *                       type: string
 *                       example: "User cannot log in"
 *                     user_id:
 *                       type: integer
 *                       example: 123
 *       404:
 *         description: Complaint not found
 *       500:
 *         description: Internal server error
 */
router.get(
  '/:id',
  [isAuthenticated, authorized(AccessRoles.COMPLAINTS)],
  tryCatchHandler(getComplaintsById),
);

/**
 * @swagger
 * /complaints/create-complaint:
 *   post:
 *     summary: Create a new complaint
 *     tags: [Complaints]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               complaint_type:
 *                 type: string
 *                 example: "Technical Issue"
 *               description:
 *                 type: string
 *                 example: "User cannot log in"
 *               user_id:
 *                 type: integer
 *                 example: 123
 *     responses:
 *       201:
 *         description: Complaint created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Complaint created successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     complaint_type:
 *                       type: string
 *                       example: "Technical Issue"
 *                     description:
 *                       type: string
 *                       example: "User cannot log in"
 *                     user_id:
 *                       type: integer
 *                       example: 123
 *       400:
 *         description: Bad request (validation error)
 *       500:
 *         description: Internal server error
 */
router.post(
  '/create-complaint',
  [isAuthenticated, authorized(AccessRoles.COMPLAINTS)],
  tryCatchHandler(createComplaints),
);

/**
 * @swagger
 * /complaints/update-complaint/{id}:
 *   put:
 *     summary: Update an existing complaint
 *     tags: [Complaints]
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
 *                 example: "Updated Issue"
 *               description:
 *                 type: string
 *                 example: "User is now able to log in"
 *     responses:
 *       200:
 *         description: Complaint updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Complaint updated successfully"
 *       404:
 *         description: Complaint not found
 *       500:
 *         description: Internal server error
 */
router.put(
  '/update-complaint/:id',
  [isAuthenticated, authorized(AccessRoles.COMPLAINTS)],
  tryCatchHandler(updateComplaints),
);

/**
 * @swagger
 * /complaints/delete-complaint/{id}:
 *   delete:
 *     summary: Soft delete a complaint
 *     tags: [Complaints]
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Complaint deleted successfully"
 *       404:
 *         description: Complaint not found
 *       500:
 *         description: Internal server error
 */
router.delete(
  '/delete-complaint/:id',
  [isAuthenticated, authorized(AccessRoles.COMPLAINTS)],
  tryCatchHandler(deleteComplaints),
);

export default router;
