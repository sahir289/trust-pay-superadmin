import { transactionWrapper } from '../../utils/db.js';
import { sendSuccess, sendNewSuccess, sendError } from '../../utils/responseHandlers.js';
import {
  createPayoutService,
  deletePayoutService,
  getPayoutsService,
  updatePayoutService,
  getPayoutsBySearchService,
  checkPayOutStatusService,
  assignedPayoutService,
  walletsPayoutsService,
  getWalletsBalanceService,
} from './payOutService.js';
import {
  PAYOUT_DETAILS_SCHEMA,
  UPDATE_DETAILS_SCHEMA,
  VALIDATE_CHECK_PAY_OUT_STATUS,
  VALIDATE_PAYOUT_BY_ID,
  ASSIGNED_VENDOR_SCHEMA,
  WALLET_PAYOUT_DETAILS_SCHEMA,
} from '../../schemas/payoutSchema.js';
import { ValidationError } from '../../utils/appErrors.js';
import { logger } from '../../utils/logger.js';
// import { BadRequestError } from '../../utils/appErrors.js';

const TestingIp = process.env.LOCAL_IP;

const createPayout = async (req, res) => {
  let payload = req.body;
  let userIp =
    req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.ip;
  if (userIp == '::1') {
    userIp = TestingIp;
  }
  const fromUI = payload.fromUi || false;
  delete payload.fromUi;
  const joiValidation = PAYOUT_DETAILS_SCHEMA.validate(req.body);
  if (joiValidation.error) {
    throw new ValidationError(joiValidation.error);
  }
  const x_api_key = req.headers['x-api-key'];
  if (!payload.user_id && !payload.user) {
    throw new ValidationError('user_id is required');
  }
  payload.user = payload.user_id ? payload.user_id : payload.user;
  delete payload?.user_id;

  let result = {};
  if (req?.user) {
    const { company_id, role, user_id } = req.user;
    payload.company_id = company_id;
    payload.created_by = user_id;
    payload.updated_by = user_id;
    payload.x_api_key = x_api_key;
    result = await transactionWrapper(createPayoutService)(
      req.headers,
      payload,
      role,
      res,
      userIp,
      fromUI,
    );
  } else {
    payload.x_api_key = x_api_key;
    result = await transactionWrapper(createPayoutService)(
      req.headers,
      payload,
      null,
      res,
      userIp,
      fromUI,
    );
  }
  // Log success message
  logger.log('Payout created successfully');

  const updateRes = {
    merchantOrderId: result.merchant_order_id,
    payoutId: result.id,
    amount: result.amount,
  };

  // Send a success response to the client
  if (result.status === 400 || result.status === 404) {
    return sendError(res, result.message, result.status);
  }
  else {
    return sendNewSuccess(res, updateRes, 'Payout created successfully', 201);
  }
};
const getPayoutsById = async (req, res) => {
  const joiValidation = VALIDATE_PAYOUT_BY_ID.validate(req.params);
  if (joiValidation.error) {
    throw new ValidationError(joiValidation.error);
  }
  const { id } = req.params;
  const { company_id, role } = req.user;
  const data = await getPayoutsService({ id, company_id }, role);
  return sendSuccess(res, data, 'Payouts fetched successfully');
};

const getPayouts = async (req, res) => {
  const { company_id, role, user_id, designation } = req.user;
  const { page, limit, sortOrder } = req.query;
  delete req.query.limit;
  delete req.query.sortOrder;
  delete req.query.page;
  const data = await getPayoutsService(
    company_id,
    page,
    limit,
    sortOrder,
    req.query,
    role,
    user_id,
    designation,
  );
  return sendSuccess(res, data, 'Payouts fetched successfully');
};

  const walletsPayouts = async (req, res) => {
    const joiValidation = WALLET_PAYOUT_DETAILS_SCHEMA.validate(req.body);
    if (joiValidation.error) {
      throw new ValidationError(joiValidation.error);
    }
    const { company_id, user_id } = req.user;
    const payload = req.body;
    payload.company_id = company_id;

    let result = await transactionWrapper(walletsPayoutsService)(
        payload,
        user_id,
        res,
      );
    // Log success message
    logger.log('Payout updated successfully');
    const updateRes = {
      balance: result,
    };
  
    // Send a success response to the client
    return sendNewSuccess(res, updateRes, 'Payout updated successfully', 201);
  }

  const getWalletsBalance = async (req, res) => {
    const { company_id } = req.user;
    let result = await getWalletsBalanceService(company_id);
    // Log success message
    logger.log('Wallet Balance fetch successfully');
  
    // Send a success response to the client
    return sendNewSuccess(res, result, 'Wallet Balance fetch successfully', 200);
  }

const getPayoutsBySearch = async (req, res) => {
  const { role, user_id, designation } = req.user;
  const { search, page = 1, limit = 10 , isAmount, company_id } = req.query;
  // if (!search) {
  //   throw new BadRequestError('search is required');
  // }
  const data = await getPayoutsBySearchService(
    {
      company_id,
      search,
      page,
      limit,
      ...req.query,
    },
    role,
    user_id,
    designation,
    isAmount,
  );
  return sendSuccess(res, data, 'Payouts fetched successfully');
};

const updatePayout = async (req, res) => {
  const { company_id, role, user_id, user_name } = req.user;
  const { id } = req.params;
  const payload = req.body;
  const joiValidation = UPDATE_DETAILS_SCHEMA.validate(payload);
  if (joiValidation.error) {
    throw new ValidationError(joiValidation.error);
  }

  payload.updated_by = user_id;
  const ids = { id, company_id };
  const update = await transactionWrapper(updatePayoutService)(
    ids,
    payload,
    role,
  );
  return sendSuccess(
    res,
    { id: update.id, updated_by: user_name },
    'Payout updated successfully',
  );
};
const assignedPayout = async (req, res) => {
  const { user_id, user_name ,company_id} = req.user;
  const { id } = req.params;
  const { payouts_ids } = req.body;
  const joiValidation = ASSIGNED_VENDOR_SCHEMA.validate(req.body);
  if (joiValidation.error) {
    throw new ValidationError(joiValidation.error);
  }
 const updated_by = user_id;
  const ids = { id };
  const update = await transactionWrapper(assignedPayoutService)(
    ids,
    payouts_ids,
    updated_by,
    company_id,
  );
  return sendSuccess(
    res,
    { ids: update, assigned_by: user_name },
    'Payout assigned successfully',
  );
};
const deletePayout = async (req, res) => {
  const joiValidation = VALIDATE_PAYOUT_BY_ID.validate(req.params);
  if (joiValidation.error) {
    throw new ValidationError(joiValidation.error);
  }
  const { id } = req.params; // Assuming the Payout ID is passed as a parameter
  const { company_id, user_id, role } = req.user;
  const updated_by = user_id;
  const ids = { id, company_id };
  // Call the service to delete the Payout
  await deletePayoutService(ids, updated_by, role);
  // Log success message
  // Send a success response to the client
  return sendSuccess(res, {}, 'Payout deleted successfully');
};

const checkPayOutStatus = async (req, res) => {
  const joiValidation = VALIDATE_CHECK_PAY_OUT_STATUS.validate(req.body);
  if (joiValidation.error) {
    throw new ValidationError(joiValidation.error);
  }
  const api_key = req.headers['x-api-key'];
  const data = await checkPayOutStatusService(
    req.body.payoutId,
    req.body.merchantCode,
    req.body.merchantOrderId,
    api_key,
  );
  // sendSuccess(res, data);
  if (data.status === 400 || data.status === 404) {
    return sendError(res, data.message, data.status);
  }
  else {
    return sendNewSuccess(res, data, 'PayOut status fetched successfully');
  }
};

export {
  createPayout,
  getPayoutsBySearch,
  checkPayOutStatus,
  getPayouts,
  updatePayout,
  deletePayout,
  getPayoutsById,
  assignedPayout,
  walletsPayouts,
  getWalletsBalance
};
