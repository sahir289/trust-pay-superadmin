import express from 'express';
import tryCatchHandler from '../../utils/tryCatchHandler.js';
import {
  createVendor,
  deleteVendor,
  getVendors,
  updateVendor,
  getVendorById,
  getVendorCodes,
  getVendorsBySearch,
} from './vendorController.js';
import { authorized, isAuthenticated } from '../../middlewares/auth.js';
import { AccessRoles } from '../../constants/index.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Vendors
 *   description: API endpoints for managing vendors
 */

/**
 * @swagger
 * /vendors:
 *   get:
 *     summary: Retrieve all vendors
 *     description: Returns a list of all vendors.
 *     tags: [Vendors]
 *     responses:
 *       200:
 *         description: A list of vendors.
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
  [isAuthenticated, authorized(AccessRoles.VENDOR)],
  tryCatchHandler(getVendors),
);
router.get(
  '/search',
  [isAuthenticated, authorized(AccessRoles.VENDOR)],
  tryCatchHandler(getVendorsBySearch),
);
/**
 * @swagger
 * /vendors:
 *   get:
 *     summary: Retrieve all vendors
 *     description: Returns a list of all vendors.
 *     tags: [Vendors]
 *     responses:
 *       200:
 *         description: A list of vendors.
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
  [isAuthenticated, authorized(AccessRoles.VENDOR)],
  tryCatchHandler(getVendorCodes),
);

/**
 * @swagger
 * /vendors/{id}:
 *   get:
 *     summary: Get vendor by ID
 *     description: Fetches details of a vendor by its ID.
 *     tags: [Vendors]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: The ID of the vendor to fetch.
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Vendor details.
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
 *         description: Vendor not found.
 */
router.get(
  '/:id',
  [isAuthenticated, authorized(AccessRoles.VENDOR)],
  tryCatchHandler(getVendorById),
);

/**
 * @swagger
 * /vendors/create-vendor:
 *   post:
 *     summary: Create a new vendor
 *     description: Adds a new vendor to the system.
 *     tags: [Vendors]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Vendor A"
 *               status:
 *                 type: string
 *                 example: "active"
 *     responses:
 *       201:
 *         description: Vendor created successfully.
 *       400:
 *         description: Invalid request data.
 */
router.post(
  '/create-vendor',
  [isAuthenticated, authorized(AccessRoles.VENDOR)],
  tryCatchHandler(createVendor),
);

/**
 * @swagger
 * /vendors/update-vendor/{id}:
 *   put:
 *     summary: Update vendor details
 *     description: Updates an existing vendor’s details.
 *     tags: [Vendors]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: The ID of the vendor to update.
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
 *               status:
 *                 type: string
 *                 example: "inactive"
 *     responses:
 *       200:
 *         description: Vendor updated successfully.
 *       404:
 *         description: Vendor not found.
 */
router.put(
  '/update-vendor/:id',
  [isAuthenticated, authorized(AccessRoles.VENDOR)],
  tryCatchHandler(updateVendor),
);

/**
 * @swagger
 * /vendors/delete-vendor/{id}:
 *   delete:
 *     summary: Delete a vendor
 *     description: Soft deletes a vendor by changing its status.
 *     tags: [Vendors]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: The ID of the vendor to delete.
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Vendor deleted successfully.
 *       404:
 *         description: Vendor not found.
 */
router.delete(
  '/delete-vendor/:user_id',
  [isAuthenticated, authorized(AccessRoles.VENDOR)],
  tryCatchHandler(deleteVendor),
);

export default router;
