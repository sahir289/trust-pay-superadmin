import { sendSuccess } from '../../utils/responseHandlers.js';
import {
  createUserHierarchyService,
  updateUserHierarchyService,
  getUserHierarchyService,
  deleteUserHierarchyService,
} from './userHierarchyService.js';
import {
  VALIDATE_UPDATE_USER_HIERARCHY_STATUS,
  VALIDATE_DELETE_USER_HIERARCHY,
  VALIDATE_USER_HIERARCHY_SCHEMA,
  VALIDATE_USER_HIERARCHY_BY_ID,
} from '../../schemas/userHierarchySchema.js';
import { ValidationError } from '../../utils/appErrors.js';

const createUserHierarchy = async (req, res) => {
  const { error } = VALIDATE_USER_HIERARCHY_SCHEMA.validate(req.body);
  if (error) {
    throw new ValidationError(error);
  }
  let payload = req.body;
  const { company_id, user_id, role } = req.user;
  payload.company_id = company_id;
  payload.created_by = user_id;
  payload.updated_by = user_id;
  await createUserHierarchyService(payload, role);
  // Send a success response to the client
  return sendSuccess(res, {}, 'UserHierarchy created successfully');
};

const getUserHierarchys = async (req, res) => {
  const { company_id, role } = req.user;
  const { page, limit } = req.query;
  // const search = req.query.search;
  // Fetch vendors data from the service
  const data = await getUserHierarchyService(
    {
      company_id,
      ...req.query,
    },
    role,
    page,
    limit,
  );
  // Log success message
  return sendSuccess(res, data, 'UserHierarchy fetched successfully');
};

const getUserHierarchysById = async (req, res) => {
  const { error } = VALIDATE_USER_HIERARCHY_BY_ID.validate(req.params);
  if (error) {
    throw new ValidationError(error);
  }
  const { id } = req.params;
  const { company_id, role } = req.user;
  // Fetch vendors data from the service
  const ids = { id, company_id };
  const payload = {};
  const data = await getUserHierarchyService(ids, payload, role);

  return sendSuccess(res, data, 'UserHierarchy fetched successfully');
};

const updateUserHierarchy = async (req, res) => {
  const { error: paramsError } = VALIDATE_USER_HIERARCHY_BY_ID.validate(
    req.params,
  );
  if (paramsError) {
    throw new ValidationError(paramsError);
  }
  // Validate body (fields for update)
  const { error: bodyError } = VALIDATE_UPDATE_USER_HIERARCHY_STATUS.validate(
    req.body,
  );
  if (bodyError) {
    throw new ValidationError(bodyError);
  }
  const payload = req.body;
  const { id } = req.params; // Assuming the UserHierarchy ID is passed as a parameter
  const { company_id, role, user_id } = req.user;
  payload.updated_by = user_id;
  const ids = { id, company_id };
  // Call the service to update the UserHierarchy
   await updateUserHierarchyService(ids, payload, role);

  // Log success message

  // Send a success response to the client
  return sendSuccess(res, {}, 'UserHierarchy updated successfully');
};

const deleteUserHierarchy = async (req, res) => {
  const { error: paramsError } = VALIDATE_DELETE_USER_HIERARCHY.validate(
    req.params,
  );
  if (paramsError) {
    throw new ValidationError(paramsError);
  }
  // Validate body (fields for update)

  const { id } = req.params; // Assuming the UserHierarchy ID is passed as a parameter

  const { company_id, role, user_id } = req.user;
  const updated_by = user_id;
  const ids = { company_id, id };
  // Call the service to delete the UserHierarchy
  await deleteUserHierarchyService(ids, updated_by, role);

  // Send a success response to the client
  return sendSuccess(res, {}, 'UserHierarchy deleted successfully');
};

export {
  createUserHierarchy,
  getUserHierarchysById,
  getUserHierarchys,
  updateUserHierarchy,
  deleteUserHierarchy,
};
