import { Role } from '../../constants/index.js';
import {
  BENEFICIARY_ACCOUNT_SCHEMA,
  UPDATE_BENEFICIARY_ACCOUNT_SCHEMA,
  VALIDATE_BENEFICIARY_ACCOUNT_BY_ID,
} from '../../schemas/BeneficiaryAccountSchema.js';
import {  ValidationError } from '../../utils/appErrors.js';
import { transactionWrapper } from '../../utils/db.js';
import { logger } from '../../utils/logger.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import {
  getBeneficiaryAccountService,
  createBeneficiaryAccountService,
  updateBeneficiaryAccountService,
  deleteBeneficiaryAccountService,
  getBeneficiaryAccountServiceByBankName,
  getBeneficiaryAccountBySearchService,
} from './beneficiaryAccountServices.js';

const getBeneficiaryAccount = async (req, res) => {
  const { role, user_id, designation, company_id } = req.user;
  const { page, limit, beneficiary_role, beneficiary_user_id } = req.query;
  let { is_enabled } = req.query;
  const filters = {
    beneficiary_role,
  };
  if (beneficiary_user_id) {
    filters.user_id = beneficiary_user_id;
  }
  if (role === Role.VENDOR) {
    is_enabled = true; // Vendor can only see enabled beneficiaries
  }
  if (is_enabled) {
    filters['config->>is_enabled'] = is_enabled ? 'true' : 'false';
  }
  const data = await getBeneficiaryAccountService(
    filters,
    role,
    page,
    limit,
    user_id,
    designation,
    company_id,
  );
  logger.log('get Beneficiary successfully', role);
  return sendSuccess(res, data, 'get Beneficiary successfully');
};

const getBeneficiaryAccountBySearch = async (req, res) => {
  const { role, user_id, designation } = req.user;
  const { page, limit, beneficiary_role, beneficiary_user_id , search, company_id } = req.query;
  let { is_enabled } = req.query;
  const filters = {
    beneficiary_role,
    search
  };
  if (beneficiary_user_id) {
    filters.user_id = beneficiary_user_id;
  }
  if (role === Role.VENDOR) {
    is_enabled = true; // Vendor can only see enabled beneficiaries
  }
  if (is_enabled) {
    filters['config->>is_enabled'] = is_enabled ? 'true' : 'false';
  }
  const data = await getBeneficiaryAccountBySearchService(
    filters,
    role,
    page,
    limit,
    user_id,
    designation,
    company_id,
  );
  logger.log('get Beneficiary successfully', role);
  return sendSuccess(res, data, 'get Beneficiary successfully');
};

const getBeneficiaryAccountByBankName = async (req, res) => {
  const { type } = req.query;
  const { company_id, role, user_id, designation } = req.user;
  const data = await getBeneficiaryAccountServiceByBankName(
    company_id,
    type,
    role,
    user_id,
    designation,
  );
  return sendSuccess(res, data, 'get Beneficiary successfully');
};

const getBeneficiaryAccountById = async (req, res) => {
  const { id } = req.params;
  const { role } = req.user;
  const data = await getBeneficiaryAccountService(
    {
      id: id,
    },
    role,
  );
  return sendSuccess(res, data, 'get Bank successfully');
};

const createBeneficiaryAccount = async (req, res) => {
  let payload = req.body;
  const joiValidation = BENEFICIARY_ACCOUNT_SCHEMA.validate(payload);
  if (joiValidation.error) {
    throw new ValidationError(joiValidation.error);
  }
  const { user_id, company_id } = req.user;
  payload.created_by = user_id;
  payload.updated_by = user_id;
  payload.company_id = company_id;
  // const data =
  await transactionWrapper(createBeneficiaryAccountService)(
    payload,
    company_id,
  );
  return sendSuccess(res, {}, 'Beneficiary Created successfully');
};

const updateBeneficiaryAccount = async (req, res) => {
  const { id } = req.params;
  let payload = req.body;
  const joiValidation = UPDATE_BENEFICIARY_ACCOUNT_SCHEMA.validate(req.body);
  if (joiValidation.error) {
    throw new ValidationError(joiValidation.error);
  }
  const { company_id, user_id, role } = req.user;
  payload.updated_by = user_id;
  const ids = { id, company_id };
  // const data =
  await transactionWrapper(updateBeneficiaryAccountService)(ids, payload, role);
  return sendSuccess(res, {}, 'Beneficiary Updated successfully');
};

const deleteBeneficiaryAccount = async (req, res) => {
  const { id } = req.params;
  const joiValidation = VALIDATE_BENEFICIARY_ACCOUNT_BY_ID.validate(id);
  if (joiValidation.error) {
    throw new ValidationError(joiValidation.error);
  }
  const { company_id } = req.user;
  const ids = { id, company_id };
  // const data =
  await transactionWrapper(deleteBeneficiaryAccountService)(ids);
  return sendSuccess(res, {}, 'deleted Beneficiary successfully');
};
export {
  getBeneficiaryAccount,
  getBeneficiaryAccountBySearch,
  getBeneficiaryAccountById,
  createBeneficiaryAccount,
  updateBeneficiaryAccount,
  deleteBeneficiaryAccount,
  getBeneficiaryAccountByBankName,
};
