import { sendSuccess } from '../../utils/responseHandlers.js';
import {
  createVendorService,
  deleteVendorService,
  getVendorsCodeService,
  getVendorsService,
  updateVendorService,
  getVendorsBySearchService,
} from './vendorService.js';
import {
  VALIDATE_VENDOR_BY_ID,
  VALIDATE_UPDATE_VENDOR_STATUS,
  VALIDATE_VENDOR_SCHEMA,
} from '../../schemas/vendorSchema.js';
import { ValidationError } from '../../utils/appErrors.js';
import { transactionWrapper } from '../../utils/db.js';
// import { BadRequestError } from '../../utils/appErrors.js';

const createVendor = async (req, res) => {
  const { error } = VALIDATE_VENDOR_SCHEMA.validate(req.body);
  if (error) {
    throw new ValidationError(error);
  }
  let payload = req.body;
  const { role } = req.user;
  const { company_id, user_id } = req.user;
  payload.company_id = company_id;
  payload.created_by = user_id;
  payload.updated_by = user_id;
  // Call the service to create the Vendor
  const vendor = await transactionWrapper(createVendorService)(payload, role);
  // Log success message
  // Send a success response to the client
  return sendSuccess(res, { id: vendor.id }, 'Vendor created successfully');
};

const getVendors = async (req, res) => {
  const { company_id, role, user_id, designation } = req.user;
  const { page, limit } = req.query;
  const data = await getVendorsService(
    {
      company_id,
      ...req.query,
    },
    role,
    page,
    limit,
    user_id,
    designation,
  );
  return sendSuccess(res, data, 'Vendors fetched successfully');
};

const getVendorsBySearch = async (req, res) => {
  const { role, user_id, designation  } = req.user;
  const { page, limit, company_id } = req.query;
  const data = await getVendorsBySearchService(
    {
      company_id,
      ...req.query,
    },
    role,
    page,
    limit,
    user_id,
    designation,
  );
  return sendSuccess(res, data, 'Vendors fetched successfully');
};

const getVendorCodes = async (req, res) => {
  const { user_id, role, designation } = req.user;
  const { company_id } = req.query;
  // let search = req.query.search;
  const data = await getVendorsCodeService(
    { company_id },
    role,
    user_id,
    designation,
  );
  // Log success message
  // Send success response
  return sendSuccess(res, data, 'Vendors fetched successfully');
};
const getVendorById = async (req, res) => {
  const { error } = VALIDATE_VENDOR_BY_ID.validate(req.params);
  if (error) {
    throw new ValidationError(error);
  }
  const { role } = req.user;
  const { id } = req.params;
  const { company_id } = req.user;
  // Fetch vendors data from the service
  const data = await getVendorsService({ id, company_id }, role);
  // Log success message
  // Send success response
  return sendSuccess(res, data, ' Vendor fetched successfully');
};

const updateVendor = async (req, res) => {
  // Validate Vendor ID (from params)
  const { role, user_name } = req.user;
  const { error: idError } = VALIDATE_VENDOR_BY_ID.validate(req.params);
  if (idError) {
    throw new ValidationError(idError);
  }
  // Validate Vendor Update Status (from body)
  const { error: bodyError } = VALIDATE_UPDATE_VENDOR_STATUS.validate(req.body);
  if (bodyError) {
    throw new ValidationError(bodyError);
  }
  const payload = req.body;
  const { company_id ,user_id } = req.user;
  const { id } = req.params; // Assuming the Vendor ID is passed as a parameter
  // Call the service to update the Vendor
  payload.updated_by = user_id;
  const ids = { id, company_id };
  const vendor = await updateVendorService(ids, payload, role);
  // Log success message
  // Send a success response to the client
  return sendSuccess(
    res,
    { id: vendor.id, updated_by: user_name },
    'Vendor updated successfully',
  );
};

const deleteVendor = async (req, res) => {
  const { user_name, company_id } = req.user;
  const { user_id } = req.params; // Assuming the Vendor ID is passed as a parameter
  // Call the service to delete the Vendor
  const ids = { company_id, user_id };
  const vendor = await deleteVendorService(ids, req.user.user_id);
  // Send a success response to the client
  return sendSuccess(
    res,
    { id: vendor.id, deleted_by: user_name },
    'Vendor deleted successfully',
  );
};

export {
  createVendor,
  getVendorsBySearch,
  getVendors,
  getVendorCodes,
  getVendorById,
  updateVendor,
  deleteVendor,
};
