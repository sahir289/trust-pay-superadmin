import express from 'express';
import tryCatchHandler from '../../utils/tryCatchHandler.js';
import {
  loginController,
  logoutController,
  refreshTokenController,
  verificationController,
  changePasswordController,
  verfyUserController,
  verfyOtpController,
  forgetPasswordController,
  getUserRoleController,
} from './authController.js';
import { isAuthenticated } from '../../middlewares/auth.js';

const router = express.Router();

/**
 * @swagger
 * /login:
 *   get:
 *     summary: login check
 *     description: Returns a status message to verify the user is authorized or not.
 *     tags:
 *       - login Check
 *     responses:
 *       200:
 *         description: login successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "login successfully!"
 */
router.post('/login', tryCatchHandler(loginController)); // login route

router.post('/refresh-token', tryCatchHandler(refreshTokenController));

router.get('/get-user-role', tryCatchHandler(getUserRoleController));

/**
 * @swagger
 * /logout:
 *   get:
 *     summary: logout user
 *     description: Returns a status message to verify the user is authorized or not.
 *     tags:
 *       - logout user
 *     responses:
 *       200:
 *         description: logout successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "logout successfully!"
 */
router.post('/logout', isAuthenticated, tryCatchHandler(logoutController));

router.post('/otp_verification', tryCatchHandler(verfyOtpController));

router.post('/reset_password', tryCatchHandler(forgetPasswordController));

router.post('/user_verification', tryCatchHandler(verfyUserController));

router.post(
  '/change-password',
  isAuthenticated,
  tryCatchHandler(changePasswordController),
);

router.post(
  '/password-verification',
  isAuthenticated,
  tryCatchHandler(verificationController),
);

export default router;
