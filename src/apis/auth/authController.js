import { logoutSet } from '../../middlewares/auth.js';
import { INSERT_AUTH_SCHEMA } from '../../schemas/authSchema.js';
import { BadRequestError, ValidationError } from '../../utils/appErrors.js';
import { generateUserToken, verifyToken } from '../../utils/auth.js';
// import { verifyToken } from '../../utils/auth.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import { updateSessionDao } from './authDao.js';
import {
  loginService,
  // logoutService,
  refreshTokenService,
  changePasswordService,
  verificationService,
  verfyUserService,
  verfyOtpService,
  forgetPasswordService,
  logoutService,
  getUserRoleService,
} from './authService.js';

const loginController = async (req, res) => {
  let clientIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const payload = { ...req.body };
  const options = { abortEarly: false };
  const joiValidation = INSERT_AUTH_SCHEMA.validate(payload, options);
  if (joiValidation.error) {
    throw new ValidationError(joiValidation.error);
  }
  const data = await loginService(payload, clientIP);
  ///for first login user
  if (data.isLoginFirst) {
    return sendSuccess(res, data, "user's first login");
  }
  res.cookie('refreshToken', data.refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'Strict',
  });
  const token = {
    accessToken: data.tokenInfo.accessToken,
    sessionId: data.sessionId,
  };
  return sendSuccess(res, token, 'login successfully');
};

const refreshTokenController = async (req, res) => {
  const { refreshToken } = req.cookies;
  if (!refreshToken) {
    throw new BadRequestError('Unauthorized access, Try to login again');
  }
  const decoded = verifyToken(refreshToken, { ignoreExpiration: true });
  const session = await refreshTokenService(
    decoded.user_id,
    decoded.company_id,
    refreshToken,
  );
  const newAccessToken = generateUserToken(decoded);

  const config = JSON.parse(session.config);
  config.token.access_token = newAccessToken;
  await updateSessionDao(
    decoded.user_id,
    decoded.company_id,
    session.session_id,
    config,
  );
  const token = { accessToken: newAccessToken };

  return sendSuccess(res, token, 'Refresh token generated successfully');
};

const logoutController = async (req, res) => {
  const { session_id } = req.body;
  const token = req.header('x-auth-token');
  const decodeToken = verifyToken(token);
  await logoutService(decodeToken, session_id);
  logoutSet.add(token);
  return sendSuccess(res, {}, 'logout successfully');
};

const verificationController = async (req, res) => {
  const { user_name,user_id,company_id } = req.user;
  const { password } = req.body;
  let ids = { user_id, company_id };
  const validate = await verificationService(ids, { user_name, password });
  if (!validate) {
    throw new BadRequestError('Invalid password');
  }

  return sendSuccess(res, {}, 'Verification successful');
};
const changePasswordController = async (req, res) => {
  const { user_id, user_name } = req.user;
  const { oldPassword, password } = req.body;
  const changedPassword = await changePasswordService({
    user_id,
    user_name,
    password,
    oldPassword,
  });
  if (!changedPassword) {
    throw new BadRequestError('Invalid old password');
  }
  return sendSuccess(res, {}, 'Password Changed Successfully');
};

const verfyUserController = async (req, res) => {
  const { user_name } = req.body;
  const verfyUser = await verfyUserService(user_name);
  if (!verfyUser) {
    throw new BadRequestError("Invalid User's Info");
  }
  return sendSuccess(res, {}, 'Verified User Successfully');
};

const verfyOtpController = async (req, res) => {
  const { otp } = req.body;
  const verfyUser = await verfyOtpService(otp);
  if (!verfyUser) {
    throw new BadRequestError('Invalid OTP');
  }
  return sendSuccess(res, verfyUser, 'Verified Otp Successfully');
};

const forgetPasswordController = async (req, res) => {
  const { password, user_id } = req.body;
  const verfyUser = await forgetPasswordService({ password, user_id });
  if (!verfyUser) {
    throw new BadRequestError("Invalid User's Info");
  }
  return sendSuccess(res, {}, 'Password Reset Successfully');
};

const getUserRoleController = async (req, res) => {
  const { userName } = req.query;
  const role = await getUserRoleService(userName);
  return sendSuccess(res, role, 'User role fetched successfully');
};

export {
  loginController,
  refreshTokenController,
  changePasswordController,
  logoutController,
  verificationController,
  verfyUserController,
  verfyOtpController,
  forgetPasswordController,
  getUserRoleController,
};
