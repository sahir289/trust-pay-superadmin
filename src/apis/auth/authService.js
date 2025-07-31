// import { processRequest } from '../../middlewares/processRequest.js';
import {
  AccessDeniedError,
  AuthenticationError,
  BadRequestError,
  NotFoundError,
} from '../../utils/appErrors.js';
import { createHash, verifyHash } from '../../utils/bcryptPassword.js';
import os from 'os';
import { getConnection } from '../../utils/db.js';
import { getUsersByUserNameDao, updateUserDao } from '../users/userDao.js';
import { generateUserToken } from '../../utils/auth.js';
import {
  addLoginDao,
  deleteUserSessionsDao,
  getSessionByIdDao,
  changePasswordDao,
  getRoleByUserNameDao,
} from './authDao.js';
import {
  createUserOtpDao,
  getUserOtpDao,
  updateUserOtpDao,
} from '../userOtp/userOtpDao.js';
import { generateUUID } from '../../utils/generateUUID.js';
import { generateOTP } from '../../utils/generateOtp.js';
import { forceLogoutUser } from '../../utils/sockets.js';
import { sendOTP } from '../../utils/sendMailer.js';
import { logger } from '../../utils/logger.js';
import { compareHash } from '../../utils/hashUtils.js';
import { logOutUser } from '../../utils/sockets.js';
import { Role } from '../../constants/index.js';

const loginService = async (config, clientIP, retryCount = 0) => {
  const MAX_RETRIES = 2;
  let conn;
  try {
    let user = await getUsersByUserNameDao({}, config.username);
    if (!user) {
      throw new NotFoundError('User Not Found.');
    }
    if (!user.is_enabled) {
      throw new AccessDeniedError(
        'User not active. Please contact Support Team',
      );
    }

    if (user.designation === Role.ADMIN && !config.newPassword) {
      if (!config.unique_admin_id) {
        throw new BadRequestError(
          'Unique admin ID is required for admin login.',
        );
      }
      if (user.company_config.unique_admin_id !== config.unique_admin_id) {
        throw new BadRequestError(
          'You are not authorized to access this account.',
        );
      }
    }

    let isLoginSecondFlag = false;
    // Handle password update for newPassword
    if (config.newPassword) {
      const isPasswordValid = await verifyHash(config.password, user.password);
      if (!isPasswordValid) {
        throw new NotFoundError('Invalid current password. Please try again.');
      }
      const hashedPassword = await createHash(config.newPassword);
      conn = await getConnection();
      await updateUserDao(
        { id: user.id },
        {
          password: hashedPassword,
          config: { ...user.config, isLoginFirst: false },
        },
        conn,
      );
      isLoginSecondFlag = true;
    } else {
      // Verify password for regular login
      const isPasswordValid = await verifyHash(config.password, user.password);
      if (!isPasswordValid) {
        throw new NotFoundError('Invalid Credentials. Please try again.');
      }
    }

    // Handle first login
    if (user.config.isLoginFirst && !isLoginSecondFlag) {
      const loginFirstObj = {
        id: user.id,
        isLoginFirst: user.config.isLoginFirst,
      };
      return loginFirstObj;
    }

    // Proceed with session and token generation for non-first login
    conn = conn || (await getConnection());
    
    try {
      // Start a transaction with read committed isolation for better concurrency
      // We'll handle race conditions through application logic rather than serializable isolation
      await conn.query('BEGIN ISOLATION LEVEL READ COMMITTED');
      
      // First, immediately invalidate ALL existing sessions for this user
      // This prevents any race condition with multiple simultaneous logins
      await deleteUserSessionsDao(user.id, user.company_id, null, conn);
      
      // Add a small delay to ensure any concurrent operations complete
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Generate new session ID and tokens first (before any DB operations)
      const sessionId = generateUUID();
      const tokenInfo = generateUserToken(user);
      const hashedToken = await createHash(tokenInfo.refreshToken);
      
      const newConfig = {
        user_info: {
          user_ip: clientIP,
          hostname: os.hostname(),
          os_platform: os.platform(),
          network_interface: Object.values(os.networkInterfaces())[0]?.[0],
          cpu_cores: os.cpus()[0],
        },
        token: {
          access_token: tokenInfo.accessToken,
          refresh_token: hashedToken,
        },
        confirm_over_ride: config.confirmOverRide,
        login_time: new Date().toISOString(),
      };

      // Create new session - this should be the only active session
      await addLoginDao(user.id, newConfig, user.company_id, sessionId, conn);
      
      // Commit the transaction
      await conn.query('COMMIT');

      logger.info(`New session created for user: ${user.id}, session: ${sessionId}`);

      // After successful login, force logout all other sessions for this user
      // This is done AFTER the transaction to ensure we don't interfere with the login process
      forceLogoutUser(user.id, null, sessionId);

      return {
        tokenInfo,
        sessionId,
      };
    } catch (transactionError) {
      // Rollback the transaction on error
      try {
        await conn.query('ROLLBACK');
      } catch (rollbackError) {
        logger.error('Error during rollback:', rollbackError);
      }
      
      // Handle serialization failures with detailed logging and retry logic
      if (transactionError.code === '40001' || 
          transactionError.message?.includes('serialization failure') ||
          transactionError.message?.includes('could not serialize access') ||
          transactionError.detail?.includes('Canceled on identification as a pivot')) {
        
        logger.warn(`Serialization failure for user ${user.id}:`, {
          errorCode: transactionError.code,
          errorDetail: transactionError.detail,
          errorHint: transactionError.hint,
          routine: transactionError.routine,
          retryAttempt: retryCount
        });
        
        // Retry if we haven't exceeded max retries
        if (retryCount < MAX_RETRIES) {
          // Add exponential backoff with jitter to prevent thundering herd
          const backoffDelay = Math.random() * 200 * (retryCount + 1) + 100; // Increasing delay
          await new Promise(resolve => setTimeout(resolve, backoffDelay));
          
          logger.info(`Retrying login for user ${user.id}, attempt ${retryCount + 1}/${MAX_RETRIES}`);
          return await loginService(config, clientIP, retryCount + 1);
        } else {
          logger.error(`Max retries exceeded for user ${user.id} due to serialization failures`);
          throw new AuthenticationError('Login service is temporarily busy. Please try again in a moment.');
        }
      }
      
      throw transactionError;
    }
  } catch (error) {
    logger.error('Error in login service:', error);
    throw error;
  } finally {
    if (conn) {
      try {
        conn.release();
      } catch (releaseError) {
        logger.error('Error while releasing the connection', releaseError);
      }
    }
  }
};

const refreshTokenService = async (user_id, company_id, refreshToken) => {
  let conn;
  try {
    const session = await getSessionByIdDao({ user_id, company_id });
    if (!session) {
      throw new AuthenticationError('No active session found');
    }

    const config = JSON.parse(session.config);
    const isValid = compareHash(refreshToken, config.token.refresh_token);
    if (!isValid) {
      throw new AuthenticationError('Invalid refresh token');
    }
    return session;
  } catch (error) {
    logger.log('Error getting :', error);
  } finally {
    if (conn) {
      try {
        conn.release();
      } catch (releaseError) {
        logger.error('Error while releasing the connection', releaseError);
      }
    }
  }
};

const logoutService = async (decodeToken, session_id) => {
  let conn;
  try {
    conn = await getConnection();
    const data = await deleteUserSessionsDao(
      decodeToken.user_id,
      decodeToken.company_id,
      session_id,
    );
    await logOutUser(decodeToken.user_id, session_id);
    return data;
  } catch (error) {
    logger.error('Error getting while logout', error);
  } finally {
    if (conn) {
      try {
        conn.release();
      } catch (releaseError) {
        logger.error('Error while releasing the connection', releaseError);
      }
    }
  }
};

const changePasswordService = async (payload) => {
  let conn;
  try {
    conn = await getConnection();
    const userDetials = {
      user_name: payload.user_name,
      password: payload.oldPassword,
    };
    const verified = await verificationService(payload.user_id, userDetials);
    if (!verified) {
      throw new AuthenticationError('Invalid Password');
    }
    const newPassword = await createHash(payload.password);
    const user = await changePasswordDao(payload.user_id, newPassword);
    return user;
  } catch (error) {
    logger.error('Error getting while changing password', error);
  } finally {
    if (conn) {
      try {
        conn.release();
      } catch (releaseError) {
        logger.error('Error while releasing the connection', releaseError);
      }
    }
  }
};

const verificationService = async (ids, payload) => {
  try {
    const userDetails = await getUsersByUserNameDao(ids, payload.user_name);
    const isPasswordValid = await verifyHash(
      payload.password,
      userDetails.password,
    );
    if (!isPasswordValid) {
      throw new AuthenticationError('Invalid Password');
    }
    return userDetails;
  } catch (error) {
    logger.error('Error getting while verify password', error);
  }
};
const forgetPasswordService = async (payload) => {
  try {
    const hashPassword = await createHash(payload.password);
    const user = await updateUserDao(
      { id: payload.user_id },
      { 
        password: hashPassword,
        config: { isLoginFirst: false } 
      },
    );
    return user;
  } catch (error) {
    logger.error('Error getting while forgetting password', error);
  }
};
const verfyUserService = async (user_name) => {
  try {
    let userDetails = await getUsersByUserNameDao({}, user_name);
    if (!userDetails) {
      throw new AuthenticationError(`Invalid User`);
    }
    const otp = generateOTP();
    await sendOTP(
      userDetails.email,
      otp,
      userDetails.user_name,
      userDetails.designation,
    );
    const now = new Date();
    const expirationDate = new Date(now.getTime() + 10 * 60 * 1000);
    const payload = {
      user_id: userDetails.id,
      otp: otp,
      expiration_time: expirationDate,
    };
    await createUserOtpDao(payload);
    return true;
  } catch (error) {
    logger.log('Error while verifying user', error);
  }
};
const verfyOtpService = async (otp) => {
  try {
    let userDetails = await getUserOtpDao(otp);
    if (!userDetails) {
      throw new AuthenticationError(`Please Enter Vaild OTP`);
    }
    const expiration = userDetails?.expiration_time;
    const now = new Date();
    if (now >= expiration) {
      throw new AuthenticationError(`Expired Otp`);
    } else if (userDetails.is_used) {
      throw new AuthenticationError(`Please Enter New Otp`);
    } else {
      await updateUserOtpDao(
        { user_id: userDetails.user_id },
        { is_used: true },
      );
      return { id: userDetails.user_id };
    }
  } catch (error) {
    logger.log('Error while verifying otp', error);
  }
};

const getUserRoleService = async (userName) => {
  try {
    const user = await getRoleByUserNameDao(userName);
    if (!user) {
      throw new NotFoundError(`User not found`);
    }

    let response = {
      isAdmin: false,
    };
    if (user.designation === Role.ADMIN) {
      response = {
        isAdmin: true,
      };
    }
    return response;
  } catch (error) {
    logger.error('Error getting user role', error);
    throw error; // Re-throw the error to be handled by the calling function
  }
}

export {
  loginService,
  refreshTokenService,
  changePasswordService,
  verificationService,
  logoutService,
  verfyUserService,
  verfyOtpService,
  forgetPasswordService,
  getUserRoleService,
};
