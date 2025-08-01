import { transactionWrapper } from '../../utils/db.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import {
  createCompanyService,
  deleteCompanyService,
  getCompanyNamesService,
  getCompanyService,
  updateCompanyService,
} from './companyServices.js';
import {
  VALIDATE_COMPANY_SCHEMA,
  VALIDATE_COMPANY_BY_ID,
  VALIDATE_UPDATE_COMPANY_STATUS,
} from '../../schemas/companySchema.js';
import { ValidationError } from '../../utils/appErrors.js';

const getCompany = async (req, res) => {
  const search = req.query.search;
  const data = await getCompanyService(search);
  return sendSuccess(res, data, 'get Company successfully');
};

const getCompanyNamesController = async (req, res) => {
  const data = await getCompanyNamesService();
  return sendSuccess(res, data, 'get Company names successfully');
};

const getCompanyById = async (req, res) => {
  const joiValidation = VALIDATE_COMPANY_BY_ID.validate(req.params);
  if (joiValidation.error) {
    throw new ValidationError(joiValidation.error);
  }
  const { id } = req.params;
  const data = await getCompanyService({ id: id });
  return sendSuccess(res, data, 'get Company successfully');
};

const createCompany = async (req, res) => {
  let payload = req.body;
  const joiValidation = VALIDATE_COMPANY_SCHEMA.validate(payload);
  if (joiValidation.error) {
    throw new ValidationError(joiValidation.error);
  }

  const data = await transactionWrapper(createCompanyService)(payload);
  return sendSuccess(res, data, 'Create Company successfully');
};

const updateCompany = async (req, res) => {
  const payload = req.body;
  const joiValidation = VALIDATE_UPDATE_COMPANY_STATUS.validate(payload);
  if (joiValidation.error) {
    throw new ValidationError(joiValidation.error);
  }
  const Validation = VALIDATE_COMPANY_BY_ID.validate(req.params);
  if (Validation.error) {
    throw new ValidationError(Validation.error);
  }
  const { id } = req.params;
  // const data =
  await updateCompanyService({ id: id }, payload);
  return sendSuccess(res, {}, 'Update Company successfully');
};

const deleteCompany = async (req, res) => {
  const Validation = VALIDATE_COMPANY_BY_ID.validate(req.params);
  if (Validation.error) {
    throw new ValidationError(Validation.error);
  }
  const { id } = req.params;
  await deleteCompanyService({ id: id });

  return sendSuccess(res, {}, 'Delete Company successfully');
};

export {
  getCompany,
  getCompanyById,
  createCompany,
  updateCompany,
  deleteCompany,
  getCompanyNamesController,
};
