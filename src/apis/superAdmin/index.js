import express from 'express';
import tryCatchHandler from '../../utils/tryCatchHandler.js';
import { authorized, isAuthenticated } from '../../middlewares/auth.js';
import { AccessRoles } from '../../constants/index.js';
import {
  getActiveUsers,
  getPendingTransactions,
  getTransactionCalculations,
  getTransactionRatios,
} from './superAdminController.js';

const router = express.Router();

// Dashboard stats endpoint - returns all counts
router.get(
  '/get-active-users',
  [isAuthenticated, authorized(AccessRoles.SUPER_ADMIN_BOARD)],
  tryCatchHandler(getActiveUsers),
);

router.get(
  '/get-pending-transactions',
  [isAuthenticated, authorized(AccessRoles.SUPER_ADMIN_BOARD)],
  tryCatchHandler(getPendingTransactions),
);

router.get(
  '/get-transaction-calculations',
  [isAuthenticated, authorized(AccessRoles.SUPER_ADMIN_BOARD)],
  tryCatchHandler(getTransactionCalculations),
);

router.get(
  '/get-ratios',
  [isAuthenticated, authorized(AccessRoles.SUPER_ADMIN_BOARD)],
  tryCatchHandler(getTransactionRatios),
);

export default router;
