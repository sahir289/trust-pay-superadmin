import { sendSuccess } from '../../utils/responseHandlers.js';
import {
  getComplaintsService,
  createComplaintsService,
  updateComplaintsService,
  deleteComplaintsService,
} from './complaintsServices.js';
import {
  VALIDATE_COMPLAINT_BY_ID,
  VALIDATE_COMPLAINT_SCHEMA,
  VALIDATE_UPDATE_COMPLAINT_STATUS,
  VALIDATE_DELETE_COMPLAINT,
} from '../../schemas/complaintSchema.js';
import { ValidationError } from '../../utils/appErrors.js';

const getComplaints = async (req, res) => {
  const { company_id } = req.user;
  const { page, limit } = req.query;
  // let search = req.query.search;
  const data = await getComplaintsService(
    {
      company_id,
      // TODO: search
    },
    page,
    limit,
  );

  return sendSuccess(res, data, 'get complaints successfully');
};

const getComplaintsById = async (req, res) => {
  const { error } = VALIDATE_COMPLAINT_BY_ID.validate(req.params);
  if (error) {
    throw new ValidationError(error);
  }
  const { id } = req.params;
  const { company_id } = req.user;

  const data = await getComplaintsService({ id, company_id });

  return sendSuccess(res, data, 'get complaint successfully');
};

const createComplaints = async (req, res) => {
  let payload = req.body;
  const { error } = VALIDATE_COMPLAINT_SCHEMA.validate(payload);
  if (error) {
    throw new ValidationError(error);
  }
  const { company_id, user_id } = req.user;
  payload.company_id = company_id;
  payload.created_by = user_id;
  payload.updated_by = user_id;
  await createComplaintsService(payload);

  return sendSuccess(res, {}, 'Create Complaints successfully');
};

const updateComplaints = async (req, res) => {
  const { error: paramsError } = VALIDATE_COMPLAINT_BY_ID.validate(req.params);
  if (paramsError) {
    throw new ValidationError(paramsError);
  }
  // Validate body (fields for update)
  const { error: bodyError } = VALIDATE_UPDATE_COMPLAINT_STATUS.validate(
    req.body,
  );
  if (bodyError) {
    throw new ValidationError(bodyError);
  }
  const { body, params } = req;
  const { company_id, user_id } = req.user;
  body.updated_by = user_id;
  await updateComplaintsService(params.id, company_id, body);

  return sendSuccess(res, {}, 'Update Complaints successfully');
};

const deleteComplaints = async (req, res) => {
  const { error } = VALIDATE_DELETE_COMPLAINT.validate(req.params);
  if (error) {
    throw new ValidationError(error);
  }
  const { params } = req;
  const { company_id, user_id } = req.user;
  const updated_by = user_id;
  const userData = { is_obsolete: true, updated_by };
  await deleteComplaintsService(params.id, company_id, userData);
  return sendSuccess(res, {}, 'Delete Complaints successfully');
};
export {
  getComplaints,
  createComplaints,
  getComplaintsById,
  updateComplaints,
  deleteComplaints,
};
