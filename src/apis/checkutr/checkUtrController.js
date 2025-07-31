import { BadRequestError } from '../../utils/appErrors.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import {
  createCheckUtrService,
  deleteCheckUtrService,
  getCheckUtrBySearchService,
  getCheckUtrService,
  updateCheckUtrService,
} from './checkUtrServices.js';
import { getPayinDetailsByMerchantOrderId } from '../payIn/payInDao.js';
import { transactionWrapper } from '../../utils/db.js';

const getCheckUtr = async (req, res) => {
  const { company_id } = req.user;
  const { page, limit, sortOrder } = req.query;
  delete req.query.page;
  delete req.query.limit;
  const filters = {
    company_id,
    ...req.query,
  };
  const data = await getCheckUtrService(filters, page, limit, sortOrder);
  return sendSuccess(res, data, 'get checkutr successfully');
};

const getCheckUtrBySearch = async (req, res) => {
  const { company_id } = req.user;
  const { search, page = 1, limit = 10 } = req.query;
  // if (!search) {
  //   throw new BadRequestError('search is required');
  // }
  const data = await getCheckUtrBySearchService(
    company_id,
    search,
    page,
    limit,
  );
  return sendSuccess(res, data, 'get checkUtr by search successfully');
};

const createCheckUtr = async (req, res) => {
  const payload = req.body;
  const payinData = await getPayinDetailsByMerchantOrderId(
    payload.merchant_order_id,
  );
  payload.payin_id = payinData[0].payin_id;
  const { company_id, user_id, user_name } = req.user;
  payload.company_id = company_id;
  payload.created_by = user_id;
  payload.updated_by = user_id;
  const { merchant_order_id, utr } = payload;
  delete payload.merchant_order_id;
  if (!payload) {
    throw new BadRequestError('payload is required');
  }
  const checkUtr = await transactionWrapper(createCheckUtrService)(
    payload,
    merchant_order_id,
    utr,
  );
  return sendSuccess(
    res,
    { id: checkUtr.id, created_by: user_name },
    'Check Utr successfully',
  );
};

const updateCheckUtr = async (req, res) => {
  const payload = req.body;
  const { id } = req.params;
  await updateCheckUtrService(id, payload);
  return sendSuccess(res, {}, 'Update CheckUtr successfully');
};

const deleteCheckUtr = async (req, res) => {
  const { id } = req.params;
  if (!id) {
    throw new BadRequestError('payload is required');
  }
  await deleteCheckUtrService(id);
  return sendSuccess(res, {}, 'Delete CheckUtr successfully');
};

export {
  getCheckUtr,
  getCheckUtrBySearch,
  createCheckUtr,
  updateCheckUtr,
  deleteCheckUtr,
};
