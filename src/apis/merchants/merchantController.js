/* eslint-disable no-unused-vars */
import { sendSuccess } from '../../utils/responseHandlers.js';
import {
  createMerchantService,
  deleteMerchantService,
  getMerchantByIdService,
  getMerchantsByCodeService,
  getMerchantsBySearchService,
  getMerchantsService,
  getMerchantsServiceCode,
  updateMerchantService,
} from './merchantService.js';
import {
  VALIDATE_UPDATE_MERCHANT_STATUS,
  VALIDATE_MERCHANT_SCHEMA,
} from '../../schemas/merchantSchema.js';
import { BadRequestError, ValidationError } from '../../utils/appErrors.js';
import { transactionWrapper } from '../../utils/db.js';
import { createHashApiKey } from '../../utils/cryptoAlgorithm.js';
import { logger } from '../../utils/logger.js';

const createMerchant = async (req, res) => {
  const { body: payload, user } = req;
  const { company_id, user_id, role } = user;
  const { secretKey, publicKey } = createHashApiKey();

  // transform payload in a single, immutable operation
  let merchantData = {
    ...payload,
    config: {
      ...payload.config,
      urls: {
        payin_notify: payload.payin_notify,
        payout_notify: payload.payout_notify,
        return: payload.return_url,
        site: payload.site,
      },
      keys: {
        private: secretKey,
        public: publicKey,
      },
    },
  };

  // *** removed unnecessary fields using object destructuring as it is not needed in the service ***
  const { payin_notify, payout_notify, return_url, site, ...cleanedPayload } =
    merchantData;

  const validation = VALIDATE_MERCHANT_SCHEMA.validate(cleanedPayload);
  if (validation.error) {
    throw new ValidationError(validation.error);
  }
  const finalPayload = {
    ...cleanedPayload,
    company_id,
    created_by: user_id,
    updated_by: user_id,
  };
  await transactionWrapper(createMerchantService)(finalPayload, role);

  return sendSuccess(res, null, 'Merchant created successfully');
};

const getMerchants = async (req, res) => {
  const { company_id, role, designation, user_id } = req.user;
  const { page, limit } = req.query;
  const data = await getMerchantsService(
    {
      company_id,
      ...req.query,
    },
    role,
    page,
    limit,
    designation,
    user_id,
  );
  logger.log('get Merchants successfully');
  return sendSuccess(res, data, 'Merchants fetched successfully');
};

const getMerchantByCode = async (req, res) => {
  const { code } = req.query;
  const data = await getMerchantsByCodeService(code);
  logger.log('get Merchants successfully');
  return sendSuccess(res, data, 'Merchants fetched successfully');
};

const getMerchantsBySearch = async (req, res) => {
  const { role, designation, user_id } = req.user;
  const { search, page = 1, limit = 10, company_id } = req.query;
  // if (!search) {
  //   throw new BadRequestError('search is required');
  // }
  const data = await getMerchantsBySearchService(
    {
      company_id,
      search,
      page,
      limit,
      ...req.query,
    },
    role,
    designation,
    user_id,
  );
  logger.log('get Merchants successfully');
  return sendSuccess(res, data, 'Merchants fetched successfully');
};

const getMerchantCodes = async (req, res) => {
  const { role, user_id, designation } = req.user;
  const { includeSubMerchants, includeOnlyMerchants, company_id } = req.query;
  const filters = { company_id };
  const data = await getMerchantsServiceCode(
    filters,
    role,
    designation,
    user_id,
    includeSubMerchants,
    includeOnlyMerchants,
  );
  logger.log('get Merchants successfully');
  return sendSuccess(res, data, 'Merchants fetched successfully');
};

const getMerchantsById = async (req, res) => {
  const { role } = req.user;
  if (!req.params) {
    throw new BadRequestError('id required in request');
  }
  const { id } = req.params;
  const { company_id } = req.user;
  // Fetch merchants data from the service
  const data = await getMerchantByIdService({ id, company_id }, role, true);
  // Send success response
  return sendSuccess(res, data, 'Merchant fetched successfully');
};

const updateMerchant = async (req, res) => {
  if (!req.params) {
    throw new BadRequestError('id required in request');
  }
  let payload = req.body;
  const { error: bodyError } =
    VALIDATE_UPDATE_MERCHANT_STATUS.validate(payload);
  if (bodyError) {
    throw new ValidationError(bodyError);
  }
  const { id } = req.params;
  const { company_id, user_id, role, user_name } = req.user;
  payload.updated_by = user_id;
  const ids = { id, company_id };
  // Call the service to update the Merchant
  const merchant = await transactionWrapper(updateMerchantService)(
    ids,
    payload,
    role,
  );
  // Log success message
  // Send a success response to the client
  return sendSuccess(
    res,
    { id: merchant.id, updated_by: user_name },
    'Merchant updated successfully',
  );
};

const deleteMerchant = async (req, res) => {
  const { role } = req.user;
  if (!req.params) {
    throw new BadRequestError('id required in request');
  }
  const { id } = req.params; // Assuming the Merchant ID is passed as a parameter
  // Call the service to delete the Merchant
  const { company_id, user_id, user_name } = req.user;
  const updated_by = user_id;
  const ids = { id, company_id };
  const merchant = await deleteMerchantService(ids, updated_by, role);
  // Log success message

  // Send a success response to the client
  return sendSuccess(
    res,
    { id: merchant.id, deleted_by: user_name },
    'Merchant deleted successfully',
  );
};

export {
  createMerchant,
  getMerchants,
  getMerchantsBySearch,
  updateMerchant,
  deleteMerchant,
  getMerchantsById,
  getMerchantCodes,
  getMerchantByCode,
};
