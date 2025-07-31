import { sendSuccess } from '../../utils/responseHandlers.js';
import {
  createChargeBackService,
  getChargeBacksService,
  updateChargeBackService,
  deleteChargeBackService,
  getChargeBacksBySearchService,
  blockChargebackUserService,
} from './chargeBackService.js';
import {
  VALIDATE_CHARGEBACK_BY_ID,
  VALIDATE_CHARGEBACK_SCHEMA,
  VALIDATE_DELETE_CHARGEBACK,
  VALIDATE_UPDATE_CHARGEBACK_SCHEMA,
} from '../../schemas/chargeBackSchema.js';
import { ValidationError } from '../../utils/appErrors.js';
import { getPayinDetailsByMerchantOrderId } from '../payIn/payInDao.js';
import { NotFoundError } from '../../utils/appErrors.js';
import { getChargeBackDao } from './chargeBackDao.js';
// import { BadRequestError } from '../../utils/appErrors.js';
import { getBankResponseDaoById } from '../bankResponse/bankResponseDao.js';

import { Status } from '../../constants/index.js';
const createChargeBack = async (req, res) => {
  let payload = req.body;
  delete payload.date;
  const { error } = VALIDATE_CHARGEBACK_SCHEMA.validate(req.body);
  if (error) {
    throw new ValidationError(error);
  }
  const PayinDetails = await getPayinDetailsByMerchantOrderId(
    payload.merchant_order_id,
  );

  if (PayinDetails.length == 0) {
    throw new NotFoundError('Invalid Order Id, Please enter valid Order Id');
  }
  const isAlreadyExit = await getChargeBackDao(
    {
      payin_id: PayinDetails[0].payin_id,
    },
    null,
    null,
    'sno',
    'DESC',
  );
  if (isAlreadyExit.length > 0) {
    throw new NotFoundError(
      `ChargeBack with ${payload.merchant_order_id} already exist`,
    );
  }
  if (
    PayinDetails[0].status === Status.ASSIGNED ||
    PayinDetails[0].status === Status.INITIATED
  ) {
    throw new NotFoundError(
      `Merchant_Order_id is in ${PayinDetails[0].status} Status`,
    );
  }
  if (
    PayinDetails[0].status === Status.FAILED &&
    !PayinDetails[0].bank_response_id
  ) {
    throw new NotFoundError(`No Utr Found for this Payin`);
  }
  let bankResponse;
  if (PayinDetails[0].bank_response_id) {
    bankResponse = await getBankResponseDaoById({
      id: PayinDetails[0].bank_response_id,
      company_id: req.user.company_id,
    });
    if (bankResponse) {
      PayinDetails[0].vendor_user_id = bankResponse.user_id;
      PayinDetails[0].bank_acc_id = bankResponse.bank_id;
      PayinDetails[0].user_submitted_utr = bankResponse.utr;
    }
  }
  if (
    PayinDetails[0].status == Status.BANK_MISMATCH ||
    PayinDetails[0].status == Status.FAILED
  ) {
    if (PayinDetails[0].bank_response_id) {
      bankResponse = await getBankResponseDaoById({
        id: PayinDetails[0].bank_response_id,
        company_id: req.user.company_id,
      });
    }
    if (bankResponse?.bank_id) {
      PayinDetails[0].bank_acc_id = bankResponse?.bank_id;
    } else {
      throw new NotFoundError('No Utr Found for this Payin');
    }
  }
  const { company_id, role, user_id, user_name } = req.user;
  // Call the service to create the ChargeBack
  const result = await createChargeBackService(
    payload,
    PayinDetails,
    role,
    company_id,
    user_id,
  );
  return sendSuccess(
    res,
    { id: result.id, created_by: user_name },
    'ChargeBack created successfully',
  );
};

const getChargeBacksById = async (req, res) => {
  const { error } = VALIDATE_CHARGEBACK_BY_ID.validate(req.params);
  if (error) {
    throw new ValidationError(error);
  }
  const { id } = req.params;
  const { company_id, role } = req.user;
  const result = await getChargeBacksService(
    { id: id, company_id: company_id },
    role,
  );

  return sendSuccess(res, result, 'ChargeBack created successfully');
};
const getChargeBacksBySearch = async (req, res) => {
  const { company_id, role, user_id, designation } = req.user;
  const { page, limit, sortOrder, ...rest } = req.query;
  const data = await getChargeBacksBySearchService(
    {
      company_id: company_id,
      ...rest,
      // TODO: search
    },
    role,
    page,
    limit,
    user_id,
    sortOrder,
    designation,
  );
  // Log success message
  // Send success response
  return sendSuccess(res, data, 'ChargeBacks fetched successfully');
};
const getChargeBacks = async (req, res) => {
  const { company_id, role, user_id, designation } = req.user;
  const { page, limit, sortOrder, ...rest } = req.query;
  const data = await getChargeBacksService(
    {
      company_id: company_id,
      ...rest,
      // TODO: search
    },
    role,
    page,
    limit,
    user_id,
    sortOrder,
    designation,
  );
  // Log success message
  // Send success response
  return sendSuccess(res, data, 'ChargeBacks fetched successfully');
};
const blockChargebackUser = async (req, res) => {
  const { error: paramsError } = VALIDATE_DELETE_CHARGEBACK.validate(
    req.params,
  );
  if (paramsError) {
    throw new ValidationError(paramsError);
  }
  const { error: bodyError } = VALIDATE_UPDATE_CHARGEBACK_SCHEMA.validate(
    req.body,
  );
  if (bodyError) {
    throw new ValidationError(bodyError);
  }
  const payload = req.body;
  const { id } = req.params;
  const { company_id, role, user_id, user_name } = req.user;
  payload.updated_by = user_id;
  const result = await blockChargebackUserService(
    { id, company_id },
    payload,
    role,
  );
  let message = 'User Blocked Successfully';
  if (Array.isArray(result.config.blocked_users) && result.config.blocked_users.length === 0) {
    message = 'User Unblocked Successfully';
  }
  return sendSuccess(
    res,
    { id: result.id, updated_by: user_name },
    message,
  );
};

const updateChargeBack = async (req, res) => {
  const { error: paramsError } = VALIDATE_DELETE_CHARGEBACK.validate(
    req.params,
  );
  if (paramsError) {
    throw new ValidationError(paramsError);
  }
  // Validate body (fields for update)
  const { error: bodyError } = VALIDATE_UPDATE_CHARGEBACK_SCHEMA.validate(
    req.body,
  );
  if (bodyError) {
    throw new ValidationError(bodyError);
  }
  const payload = req.body;
  const { id } = req.params;
  const { company_id, role, user_id, user_name } = req.user;
  // Call the service to update the ChargeBack
  payload.updated_by = user_id;
  const result = await updateChargeBackService(
    { id, company_id },
    payload,
    role,
  );
  // Log success message
  // Send a success response to the client
  return sendSuccess(
    res,
    { id: result.id, updated_by: user_name },
    'ChargeBack updated successfully',
  );
};

const deleteChargeBack = async (req, res) => {
  const { error } = VALIDATE_DELETE_CHARGEBACK.validate(req.params);
  if (error) {
    throw new ValidationError(error);
  }
  const { id } = req.params; // Assuming the ChargeBack ID is passed as a parameter
  const { company_id, role, user_id, user_name } = req.user;
  // Call the service to delete the ChargeBack
  const result = await deleteChargeBackService(
    { id, company_id },
    { updated_by: user_id, is_obsolete: true },
    role,
  );
  // Log success message
  // Send a success response to the client
  return sendSuccess(
    res,
    { id: result.id, deleted_by: user_name },
    'ChargeBack deleted successfully',
  );
};

export {
  createChargeBack,
  getChargeBacksById,
  getChargeBacks,
  updateChargeBack,
  getChargeBacksBySearch,
  deleteChargeBack,
  blockChargebackUser,
};
