// import config from '../config/config.js';
import { AUTH_HEADER_KEY } from '../utils/constants.js';
import {
  // AccessDeniedError,
  AuthenticationError,
  InternalServerError,
} from '../utils/appErrors.js';
import { verifyToken } from '../utils/auth.js';
import { logger } from '../utils/logger.js';
import { getSessionByIdDao } from '../apis/auth/authDao.js';

const logoutSet = new Set();

const isAuthenticated = async (req, res, next) => {
  const token = req.header(AUTH_HEADER_KEY);

  try {
    if (!token) {
      throw new AuthenticationError('No token provided');
    }

    if (logoutSet.has(token)) {
      throw new AuthenticationError('Token expired or User logged out.');
    }

    logger.info(`Validating token for session: ${token.slice(0, 10)}...`);
    const decoded = verifyToken(token);

    // Additional check: Verify session exists and is active in database
    try {
      const activeSession = await getSessionByIdDao({
        user_id: decoded.user_id,
        company_id: decoded.company_id
      });

      if (!activeSession) {
        // Session doesn't exist in database, add token to logout set
        logoutSet.add(token);
        throw new AuthenticationError('Session expired or invalid. Please login again.');
      }

      // Session exists, proceed
      req.user = decoded;
      req.sessionId = activeSession.session_id;
      next();
    } catch (dbError) {
      logger.error('Database session validation error:', dbError);
      throw new AuthenticationError('Session validation failed. Please login again.');
    }
    
  } catch (error) {
    logger.error('Error in authentication middleware:', error);
    next(new AuthenticationError(error.message));
  }
};

const authorized =
  (allowedRoles = []) =>
  (req, res, next) => {
    try {
      const { designation } = req.user;

      // Ensure allowedRoles is an array
      if (!Array.isArray(allowedRoles)) {
        throw new TypeError('allowedRoles must be an array');
      }

      // Check if the user's designation is included in the allowed roles
      if (!designation || !allowedRoles.includes(designation)) {
        throw new AuthenticationError('Access denied');
      }
      next();
    } catch (error) {
      logger.error('Error in authorization middleware:', error);
      next(new InternalServerError(error.message));
    }
  };

export { isAuthenticated, logoutSet, authorized };
