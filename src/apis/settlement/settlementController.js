import {
  CREATE_SETTLEMENT_SCHEMA,
  UPDATE_SETTLEMENT_SCHEMA,
  VALIDATE_SETTLEMENT_BY_ID_DELETE,
} from '../../schemas/settlementSchema.js';
import { NotFoundError, ValidationError } from '../../utils/appErrors.js';
import { transactionWrapper } from '../../utils/db.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import {
  createSettlementService,
  deleteSettlementService,
  getSettlementService,
  getSettlementServiceById,
  getSettlementsBySearchService,
  updateSettlementService,
} from './settlementServices.js';
import { BadRequestError } from '../../utils/appErrors.js';
import { getBankResponseDao } from '../bankResponse/bankResponseDao.js';
import { getUserHierarchysDao } from '../userHierarchy/userHierarchyDao.js';
import { Role } from '../../constants/index.js';
import { getBankaccountDao } from '../bankAccounts/bankaccountDao.js';
import { logger } from '../../utils/logger.js';
const getSettlementControllerById = async (req, res) => {
  const { id } = req.params;
  const { company_id } = req.user;
  const { role } = req.user;
  const ids = { id, company_id, role };
  const data = await getSettlementServiceById(ids);
  sendSuccess(res, data, 'got settlement');
};

const getSettlementController = async (req, res) => {
  // Extract user data and query parameters
  const { company_id, user_id, role, designation } = req.user || {};
  const { role_name, page, limit, search, sortBy, sortOrder, ...filters } =
    req.query;

  const parsedPage = page === 'no_pagination' ? null : Number(page) || 1;
  const parsedLimit = limit === 'no_pagination' ? null : Number(limit) || 10;

  // Prepare filters object
  const filterParams = {
    ...(search && { search }),
    ...(role_name && { role: role_name }),
    ...filters,
  };

  // Convert page and limit to numbers
  const pageNum = parseInt(parsedPage, 10);
  const limitNum = parseInt(parsedLimit, 10);

  // Call service with structured parameters
  const settlementData = await getSettlementService(
    { company_id, role_name },
    filterParams,
    pageNum,
    limitNum,
    sortBy,
    sortOrder,
    role,
    user_id,
    designation,
  );

  if (!settlementData || settlementData.length === 0) {
    return sendSuccess(res, [], 'No settlements found');
  }

  // Send success response
  return sendSuccess(res, settlementData, 'Settlements retrieved successfully');
};

const getSettlementsBySearch = async (req, res) => {
  const { company_id, role, user_id, designation } = req.user;
  const { search, page = 1, limit = 10, role_name } = req.query;
  if (!search) {
    throw new BadRequestError('search is required');
  }
  const data = await getSettlementsBySearchService(
    {
      company_id,
      search,
      page,
      limit,
      role_name,
      ...req.query,
    },
    role,
    designation,
    user_id,
  );
  return sendSuccess(res, data, 'settlements fetched successfully');
};

const createSettlementController = async (req, res) => {
  const payload = req.body;
  const { company_id, user_id, user_name, designation } = req.user;
  payload.company_id = company_id;
  payload.created_by = user_id;
  payload.updated_by = user_id;
  payload.status = 'INITIATED';
  let User_id = user_id;
  if (
    designation === Role.MERCHANT_OPERATIONS ||
    designation === Role.VENDOR_OPERATIONS
  ) {
    const userHierarchys = await getUserHierarchysDao({ user_id });
    if (userHierarchys || userHierarchys.length > 0) {
      const userHierarchy = userHierarchys[0];
      if (userHierarchy?.config?.parent) {
        User_id = userHierarchy?.config?.parent ?? null;
      }
    }
  }

  payload.user_id = payload.user_id === null ? User_id : payload.user_id; // no codes sent when vendor login

  const joiValidation = CREATE_SETTLEMENT_SCHEMA.validate(payload);
  if (joiValidation.error) {
    throw new ValidationError(joiValidation.error);
  }
  //-- utr and amount for internal tranfer case
  if (payload.amount && payload.utr) {
    const bankRes = await getBankResponseDao({
      utr: payload.utr,
      status: '/success',
    });
    if (!bankRes) {
      throw new NotFoundError('No entry found!');
    }
    const bankRess = await getBankaccountDao({ id: bankRes.bank_id });
    if (payload.user_id !== bankRess[0].user_id) {
      throw new NotFoundError('The vendor code does not match the UTR.');
    }
    if (bankRes.amount !== payload.amount) {
      throw new NotFoundError('Amount is in mismatch! Please verify.');
    }
  }

  const data = {
    method: payload.method,
    amount: payload.amount,
    user_id: payload.user_id,
    company_id,
    created_by: user_id,
    status: 'INITIATED',
    config: {
      wallet_balance: payload.wallet_balance, //--wallet balance also added in config
      description: payload.description, //--description also added in config
      ifsc: payload.ifsc,
      acc_no: payload.acc_no,
      acc_holder_name: payload.acc_holder_name,
      bank_name: payload.bank_name,
      bank_id: payload.bank_id,
      amount: payload.amount,
      reference_id: payload.utr,
      debit_credit: payload.config?.debit_credit ?? 'RECEIVED',
    },
  };
  // const data =
  const settlement = await transactionWrapper(createSettlementService)(data);
  logger.info('Created Settlement Successfully', settlement);
  sendSuccess(
    res,
    { id: settlement.id, created_by: user_name },
    'Created Settlement Successfully',
  );
};

const updateSettlementController = async (req, res) => {
  const { id } = req.params;
  const { role, user_name, user_id } = req.user;
  const payload = { ...req.body };
  payload.updated_by = user_id;
  const { company_id } = req.user;
  const ids = { id, company_id, role };
  ///temperary deleting this ..we need to refact get settlement dao query
  delete payload.config.company_id;
  const joiValidation = UPDATE_SETTLEMENT_SCHEMA.validate(payload);
  if (joiValidation.error) {
    throw new ValidationError(joiValidation.error);
  }
  const data = await transactionWrapper(updateSettlementService)(
    ids,
    payload,
    role,
  );
  sendSuccess(
    res,
    { id: data.id, updated_by: user_name },
    'Updated settlement',
  );
};

const deleteSettlementController = async (req, res) => {
  const { id } = req.params;
  const { company_id, user_id, user_name } = req.user;
  const { role } = req.user;
  const ids = { id, company_id, user_id, role };
  const joiValidation = VALIDATE_SETTLEMENT_BY_ID_DELETE.validate(id);
  if (joiValidation.error) {
    throw new ValidationError(joiValidation.error);
  }
  // const updatedData =
  const settlement = await transactionWrapper(deleteSettlementService)(ids);
  sendSuccess(
    res,
    { id: settlement.id, deleted_by: user_name },
    'Deleted settlement Successfully',
  );
};

export {
  updateSettlementController,
  deleteSettlementController,
  createSettlementController,
  getSettlementControllerById,
  getSettlementController,
  getSettlementsBySearch,
};
