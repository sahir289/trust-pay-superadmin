import { BadRequestError } from '../../utils/appErrors.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import {
  createUserService,
  getUserByIdService,
  getUsersByUserNameService,
  getUsersService,
  userUpdateService,
  getUsersBySearchService,
  sendMailService,
} from './userService.js';
import { CREATE_USER_SCHEMA } from '../../schemas/userSchema.js';
import { ValidationError } from '../../utils/appErrors.js';
import { transactionWrapper } from '../../utils/db.js';
import { logger } from '../../utils/logger.js';
import { getUsersContactDao } from './userDao.js';
const getUsers = async (req, res) => {
  // const reqBody = req.body;
  const { role, company_id, user_id, designation } = req.user;
  const { page, limit } = req.query;
  const data = await getUsersService(
    {
      company_id,
      ...req.query,
    },
    role,
    page,
    limit,
    designation,
    user_id,
  );
  return sendSuccess(res, data, 'getUsers successfully');
};

const getUsersBySearch = async (req, res) => {
  const { role, user_id, designation } = req.user;
  const { page, limit, company_id } = req.query;
  const data = await getUsersBySearchService(
    {
      company_id,
      ...req.query,
    },
    role,
    page,
    limit,
    designation,
    user_id,
  );
  return sendSuccess(res, data, 'getUsers successfully');
};

const getUsersByUserName = async (req, res) => {
  const { role, company_id } = req.user;
  const { username } = req.body;
  const ids = { company_id };
  if (!username) {
    logger.error('Username is required');
    throw new BadRequestError('Username is required');
  }
  const data = await getUsersByUserNameService(username, ids, role);
  return sendSuccess(res, data, 'getUsers successfully');
};

const getUserById = async (req, res) => {
  const { role, role_id, designation_id, company_id } = req.user;
  const { id } = req.params;
  const ids = { role_id, designation_id, company_id, id };
  const data = await getUserByIdService(ids, role);
  return sendSuccess(res, data, 'getting User by id successfully');
};

const createUser = async (req, res) => {
  const joiValidation = CREATE_USER_SCHEMA.validate(req.body);
  if (joiValidation.error) {
    throw new ValidationError(joiValidation.error);
  }
  const { role, user_id, designation, user_name } = req.user;
  let payload = req.body;
  const verifyContact = await getUsersContactDao(
    payload.company_id,
    payload.contact_no,
  );
  if (verifyContact) {
    throw new BadRequestError('Contact number already exists');
  }

  payload.is_enabled = true;
  payload.created_by = user_id;
  payload.updated_by = user_id;
  const user = await transactionWrapper(createUserService)(
    payload,
    role,
    designation,
  );
  return sendSuccess(
    res,
    { id: user.id, created_by: user_name },
    'Create user successfully',
  );
};

const updateUser = async (req, res) => {
  const { company_id, user_id, user_name } = req.user;
  let payload = req.body;
  payload.updated_by = user_id;
  const id = req.params.id;
  const ids = { id, company_id };
  const user = await transactionWrapper(userUpdateService)(ids, payload);
  return sendSuccess(
    res,
    { id: user.id, updated_by: user_name },
    'Update user successfully',
  );
};

const sendMail = async (req, res) => {
  const { user_name } = req.user;
  let payload = req.body;
  await sendMailService(payload);
  return sendSuccess(
    res,
    { mail_sent_by: user_name },
    'Mail send successfully',
  );
};

export {
  getUsers,
  getUsersBySearch,
  getUserById,
  getUsersByUserName,
  createUser,
  updateUser,
  sendMail,
};
