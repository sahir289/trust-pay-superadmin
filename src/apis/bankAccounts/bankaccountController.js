import {
  columns,
  merchantColumns,
  Role,
  vendorColumns,
} from '../../constants/index.js';
import {
  BANK_ACCOUNT_SCHEMA,
  UPDATE_BANK_ACCOUNT_SCHEMA,
  VALIDATE_BANK_RESPONSE_BY_ID,
} from '../../schemas/bankAccoountSchema.js';
import { ValidationError } from '../../utils/appErrors.js';
import { transactionWrapper } from '../../utils/db.js';
import { sendError, sendSuccess } from '../../utils/responseHandlers.js';
import { getBankaccountDao, getMerchantBankDao } from './bankaccountDao.js';
import {
  getBankaccountService,
  createBankaccountService,
  updateBankaccountService,
  deleteBankaccountService,
  getBankaccountServiceNickName,
  getBankAccountBySearchService,
} from './bankaccountServices.js';

const getBankaccount = async (req, res) => {
  const { company_id } = req.user;
  const { role, user_id, designation } = req.user;
  const { page, limit, bank_used_for } = req.query;
  const filters = {
    bank_used_for,
  };
  const data = await getBankaccountService(
    filters,
    company_id,
    role,
    page,
    limit,
    user_id,
    designation,
  );
  return sendSuccess(res, data, 'get Banks successfully');
};

const getBankAccountBySearch = async (req, res) => {
  const { role, user_id, designation } = req.user;
  const { page, limit, bank_used_for, search, company_id } = req.query;
  const filters = {
    bank_used_for,
  };
  if (company_id) {
    filters.company_id = company_id;
  }
  const data = await getBankAccountBySearchService(
    filters,
    role,
    page,
    limit,
    user_id,
    designation,
    search,
  );
  return sendSuccess(res, data, 'get Banks successfully');
};

const getBankaccountNickName = async (req, res) => {
  const { type, user, company_id } = req.query;
  const { role, user_id, designation } = req.user;
  const data = await getBankaccountServiceNickName(
    company_id,
    type,
    role,
    user_id,
    designation,
    user,
  );
  return sendSuccess(res, data, 'get Banks successfully');
};

const getBankaccountById = async (req, res) => {
  const { id } = req.params;
  const { company_id, role } = req.user;
  const data = await getBankaccountService(
    {
      company_id: company_id,
      id: id,
    },
    role,
  );
  return sendSuccess(res, data, 'get Bank successfully');
};

const createBankaccount = async (req, res) => {
  let payload = req.body;
  if (!payload.payin_count) {
    payload.payin_count = 0;
  }
  delete payload.qr;
  const joiValidation = BANK_ACCOUNT_SCHEMA.validate(payload);
  if (joiValidation.error) {
    throw new ValidationError(joiValidation.error);
  }
  const phonePe = payload.is_phonepay ? true : false;
  const intent = payload.is_intent ? true : false;
  payload.bank_used_for == 'PayIn'
    ? (payload.config = {
        merchants: [],
        is_phonepay: phonePe,
        is_intent: intent,
      })
    : (payload.config = {});
  delete payload.is_phonepay;
  delete payload.is_intent;
  const { user_id, designation, role, user_name } = req.user;
  payload.created_by = user_id;
  payload.updated_by = user_id;

  //error for nick name must be unique
  const unique = await getBankaccountDao(
    { nick_name: payload.nick_name },
    null,
    null,
    role,
  );
  if (unique.length > 0) {
    return sendError(res, 'Nick Name Must Be Unique', 400);
  }
  // const data =
  const bankDetail = await transactionWrapper(createBankaccountService)(
    payload,
    designation,
    user_id,
    payload.company_id,
  );
  return sendSuccess(
    res,
    { id: bankDetail.id, created_by: user_name },
    'Created Banks successfully',
  );
};

const updateBankaccount = async (req, res) => {
  const { id } = req.params;
  const { user_name, role, user_id } = req.user;
  let payload = req.body;
  const joiValidation = UPDATE_BANK_ACCOUNT_SCHEMA.validate(req.body);
  if (joiValidation.error) {
    throw new ValidationError(joiValidation.error);
  }
  payload.updated_by = user_id;
  const ids = { id, company_id: payload.company_id };
  // const data =
  const updatebank = await transactionWrapper(updateBankaccountService)(
    ids,
    payload,
    role,
    payload.company_id,
    user_id,
  );
  return sendSuccess(
    res,
    { id: updatebank.id, updated_by: user_name },
    'Updated Banks successfully',
  );
};

const getMerchantBank = async (req, res) => {
  // Fetch the bank account details for the given merchant ID
  const { company_id, user_id } = req.user;
  const { role } = req.user;
  const filterColumns =
    role === Role.MERCHANT
      ? merchantColumns.BANK_ACCOUNT
      : role === Role.VENDOR
        ? vendorColumns.BANK_ACCOUNT
        : columns.BANK_ACCOUNT;

  // const bankRes = await getMerchantBankDao({
  //   company_id,
  //   user_id
  // }, role);
  const bankRes = await getMerchantBankDao(
    { company_id: company_id, user_id: user_id },
    null,
    null,
    null,
    null,
    filterColumns,
  );
  return sendSuccess(res, bankRes, 'Bank details fetched successfully');
};

const deleteBankaccount = async (req, res) => {
  const { id } = req.params;
  const joiValidation = VALIDATE_BANK_RESPONSE_BY_ID.validate(id);
  if (joiValidation.error) {
    throw new ValidationError(joiValidation.error);
  }
  const { user_name, user_id } = req.user;
  const payload = {
    company_id: req.headers['company_id'],
  };
  const ids = { id, company_id: payload.company_id };
  // const data =
  const deletebank = await transactionWrapper(deleteBankaccountService)(
    ids,
    user_id,
  );
  return sendSuccess(
    res,
    { id: deletebank.id, deleted_by: user_name },
    'Deleted Banks Successfully',
  );
};
export {
  getBankaccount,
  getBankAccountBySearch,
  getBankaccountById,
  createBankaccount,
  updateBankaccount,
  deleteBankaccount,
  getMerchantBank,
  getBankaccountNickName,
};
