import { sendSuccess } from '../../utils/responseHandlers.js';
import {
  getRoleService,
  createRoleService,
  updateRoleService,
  deleteRoleService,
} from './rolesService.js';
import {
  VALIDATE_ROLE_SCHEMA,
  VALIDATE_UPDATE_ROLE_STATUS,
  VALIDATE_DELETE_ROLE,
  VALIDATE_ROLE_BY_ID,
} from '../../schemas/roleSchema.js';
import { transactionWrapper } from '../../utils/db.js';
import { ValidationError } from '../../utils/appErrors.js';

const getRoles = async (req, res) => {
  // let search = req.query.search ;
  const data = await getRoleService({
    ...req.query,
  });

  return sendSuccess(res, data, 'get Roles successfully');
};

const getRolesById = async (req, res) => {
  const { error } = VALIDATE_ROLE_BY_ID.validate(req.params); // Validate ID from params
  if (error) {
    throw new ValidationError(error);
  }
  const { id } = req.params;
  const { company_id } = req.user;
  const data = await getRoleService({ id, company_id });

  return sendSuccess(res, data, 'get Roles by ID successfully');
};

const createRole = async (req, res) => {
  const joiValidation = VALIDATE_ROLE_SCHEMA.validate(req.body); // Validate body
  if (joiValidation.error) {
    throw new ValidationError(joiValidation.error);
  }
  let payload = req.body;
  const { company_id, user_id } = req.user;
  payload.company_id = company_id;
  payload.created_by = user_id;
  payload.updated_by = user_id;
  await transactionWrapper(createRoleService)(payload);

  return sendSuccess(res, {}, 'Create Role successfully');
};

const updateRole = async (req, res) => {
  const { error: bodyError } = VALIDATE_UPDATE_ROLE_STATUS.validate(req.body); // Validate update body
  if (bodyError) {
    throw new ValidationError(bodyError);
  }
  const { error: paramsError } = VALIDATE_ROLE_BY_ID.validate(req.params); // Validate ID from params
  if (paramsError) {
    throw new ValidationError(paramsError);
  }
  const payload = req.body;
  const { id } = req.params;
  const { company_id, user_id } = req.user;
  payload.updated_by = user_id;
  await transactionWrapper(updateRoleService)({ id, company_id }, payload);

  return sendSuccess(res, {}, 'Update Role successfully');
};

const deleteRole = async (req, res) => {
  const { error } = VALIDATE_DELETE_ROLE.validate(req.params); // Validate ID from params
  if (error) {
    throw new ValidationError(error);
  }
  const { id } = req.params;
  const { company_id, user_id } = req.user;
  const ids = { id, company_id };
  const userData = { is_obsolete: true, updated_by: user_id };
  await deleteRoleService(ids, userData);

  return sendSuccess(res, {}, 'Delete Role successfully');
};

export { getRoles, getRolesById, createRole, updateRole, deleteRole };
