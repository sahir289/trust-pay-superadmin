import {
  CREATE_BANK_RESPONSE_SCHEMA,
  IMPORT_BANK_RESPONSE_SCHEMA,
  RESET_BANK_RESPONSE_SCHEMA,
  UPDATE_BANK_RESPONSE_SCHEMA,
  VALIDATE_BANK_RESPONSE_BY_ID,
  // VALIDATE_BANK_RESPONSE_QUERY,
} from '../../schemas/bankResponseSchema.js';
import { ValidationError } from '../../utils/appErrors.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import {
  getBankResponseService,
  getClaimResponseService,
  getBankMessageServices,
  createBankResponseService,
  updateBankResponseService,
  getBankResponseBySearchService,
  importBankResponseService,
  resetBankResponseService,
} from './bankResponseServices.js';
import { BadRequestError } from '../../utils/appErrors.js';

import { transactionWrapper } from '../../utils/db.js';
import { Role, tableName } from '../../constants/index.js';
import config from '../../config/config.js';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { s3 } from '../../helpers/Aws.js';
import { streamToBuffer } from '../../helpers/index.js';
import { newTableEntry } from '../../utils/sockets.js';
const getBankResponse = async (req, res) => {
  const { role, company_id } = req.user;
  const { page, limit, search, updated, sortOrder, sortBy, ...rest } =
    req.query;
  delete req.query.sortOrder;
  delete req.query.sortBy;
  const payload = {
    ...req.query,
    company_id,
    ...rest,
  };
  const data = await getBankResponseService(
    payload,
    role,
    page,
    limit,
    search,
    updated,
    sortBy,
    sortOrder,
  );
  return sendSuccess(res, data, 'Bank response retrieved successfully');
};

const getClaimResponse = async (req, res) => {
  const { company_id } = req.user;
  const payload = {
    ...req.query,
    company_id,
  };
  const data = await getClaimResponseService(payload);
  return sendSuccess(res, data, 'Bank response retrieved successfully');
};

const getBankResponseBySearch = async (req, res) => {
  const { role, company_id } = req.user;
  const { page, limit, search, updated, sortOrder, sortBy, ...rest } =
    req.query;
  delete req.query.sortOrder;
  delete req.query.sortBy;
  const payload = {
    ...req.query,
    company_id,
    ...rest,
  };
  const data = await getBankResponseBySearchService(
    payload,
    role,
    page,
    limit,
    search,
    updated,
    sortBy,
    sortOrder,
  );
  return sendSuccess(res, data, 'BankResponse fetched successfully');
};

const createBankResponse = async (req, res) => {
  const { role, user_name, company_id, user_id } = req.user;
  const payload = req.body?.body;
  const { error } = CREATE_BANK_RESPONSE_SCHEMA.validate(req.body);
  if (error) {
    throw new ValidationError(error);
  }
  const result = await createBankResponseService(
    payload,
    company_id,
    role,
    user_name,
    user_id,
  );
  await newTableEntry(tableName.BANK_RESPONSE);
  sendSuccess(res, result, 'Created Bank Response successfully');
};

const createBankBotResponse = async (req, res) => {
  const x_auth_token = req.headers['x-auth-token'];
  const payload = req.body?.body;
  const { error } = CREATE_BANK_RESPONSE_SCHEMA.validate(req.body);
  if (error) {
    throw new ValidationError(error);
  }
  const result = await createBankResponseService(
    payload,
    x_auth_token,
    Role.BOT,
    null,
  );
  await newTableEntry(tableName.BANK_RESPONSE);
  sendSuccess(res, result, 'Created Bank Bot Response successfully');
};

const updateBankResponse = async (req, res) => {
  const { role, user_name } = req.user;
  const { error: idError } = VALIDATE_BANK_RESPONSE_BY_ID.validate(req.params);
  if (idError) {
    throw new ValidationError(idError);
  }
  const { error: bodyError } = UPDATE_BANK_RESPONSE_SCHEMA.validate(req.body);
  if (bodyError) {
    throw new ValidationError(bodyError);
  }
  const payload = req.body;
  const { company_id } = req.user;
  const { id } = req.params;
  const ids = { id, company_id };
  const updateResponse = await updateBankResponseService(ids, payload, role);
  return sendSuccess(
    res,
    { id: updateResponse.id, updated_by: user_name },
    'BankResponse updated successfully',
  );
};

const getBankMessage = async (req, res) => {
  const { company_id } = req.user;
  const { role } = req.user;
  const { bank_id, startDate, endDate, page, limit } = req.query;
  const data = await getBankMessageServices(
    bank_id,
    startDate,
    endDate,
    company_id,
    role,
    page,
    limit,
  );
  return sendSuccess(res, data, 'Get BankResponse successfully');
};

const resetBankResponseController = async (req, res) => {
  const { company_id, user_name, role, user_id } = req.user;
  const { id } = req.params;
  const { amount, utr, bank_id } = req.body;

  // Validate request body
  const { error } = RESET_BANK_RESPONSE_SCHEMA.validate(req.body);
  if (error) {
    throw new ValidationError(error);
  }

  // Call service to handle the reset logic
  const result = await transactionWrapper(resetBankResponseService)(id, {
    company_id,
    user_name,
    user_id,
    role,
    amount,
    utr,
    bank_id,
  });

  return sendSuccess(res, result, result.message);
};

const importBankResponse = async (req, res) => {
  const { role, user_name, company_id } = req.user;
  const payload = {
    ...req.body,
    ...req.params,
  };

  const { error } = IMPORT_BANK_RESPONSE_SCHEMA.validate({
    ...req.body,
    file: { key: req.file?.key },
  });

  if (error) {
    throw new ValidationError(error);
  }

  if (!req.file) {
    throw new BadRequestError('PDF File not found!');
  }

  const command = new GetObjectCommand({
    Bucket: config.bucketName,
    Key: req.file.key,
  });

  const { Body } = await s3.send(command);
  // Convert S3 Body (ReadableStream) to Buffer
  const pdfBuffer = await streamToBuffer(Body);

  const result = await transactionWrapper(importBankResponseService)(
    {
      ...payload,
      pdfBuffer, // Pass the buffer directly
      file: { key: req.file?.key },
    },
    company_id,
    role,
    user_name,
  );
  sendSuccess(res, result, 'Created Bank Response successfully');
};

export {
  getBankResponse,
  getClaimResponse,
  createBankResponse,
  createBankBotResponse,
  updateBankResponse,
  getBankMessage,
  getBankResponseBySearch,
  resetBankResponseController,
  importBankResponse,
};
