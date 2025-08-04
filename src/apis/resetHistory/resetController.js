import { InternalServerError } from '../../utils/appErrors.js';
import { transactionWrapper } from '../../utils/db.js';
import { logger } from '../../utils/logger.js';
import { sendSuccess } from '../../utils/responseHandlers.js';
import {
  createResetHistoryService,
  getResetHistoryBySearchService,
  deleteResetHistoryService,
  getResetHistoryService,
  updateResetHistoryService,
} from './resetServices.js';
const getResetHistory = async (req, res) => {
  try {
    const { company_id } = req.user;
    const { page, limit, startDate, endDate, sortBy, sortOrder } = req.query;
    const data = await getResetHistoryService(
      company_id,
      page,
      limit,
      sortBy || 'sno',
      sortOrder || 'DESC',
      startDate,
      endDate,
    );
    return sendSuccess(res, data, 'reset history successfully');
  } catch (error) {
    logger.error('error getting while fetching reports', error);
  }
};
const getResetHistoryBySearch = async (req, res) => {
  const { role } = req.user;
  const { search, page = 1, limit = 10, company_id } = req.query;
  // if (!search) {
  //   throw new BadRequestError('search is required');
  // }
  const data = await getResetHistoryBySearchService(
    {
      company_id,
      search,
      page,
      limit,
      ...req.query,
    },
    role,
  );
  return sendSuccess(res, data, 'History fetched successfully');
};
const createResetHistory = async (req, res) => {
  try {
    const payload = req.body;
    const { user_id, company_id } = req.user;
    payload.created_by = user_id;
    payload.updated_by = user_id;
    payload.company_id = company_id;

    if (!payload) {
      logger.error('payload is required');
      throw new InternalServerError('payload is required');
    }
    const data = await transactionWrapper(createResetHistoryService)(payload);
    return sendSuccess(res, data, 'reset history successfully');
  } catch (error) {
    logger.error('error getting while fetching reports', error);
  }
};

const updateResetHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const { company_id } = req.user;
    const data = await updateResetHistoryService(id, company_id);
    return sendSuccess(res, data, 'reset history successfully');
  } catch (error) {
    logger.error('error getting while fetching reports', error);
  }
};

const deleteResetHistory = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      logger.error('payload is required');
      throw new InternalServerError('payload is required');
    }
    const data = await deleteResetHistoryService(id);
    return sendSuccess(res, data, 'reset history successfully');
  } catch (error) {
    logger.error('error getting while fetching reports', error);
  }
};

export {
  getResetHistory,
  createResetHistory,
  updateResetHistory,
  getResetHistoryBySearch,
  deleteResetHistory,
};
