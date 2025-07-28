import { InternalServerError } from '../../utils/appErrors.js';
import { logger } from '../../utils/logger.js';
import {
  getComplaintsDao,
  createComplaintsDao,
  updateComplaintsDao,
  deleteComplaintsDao,
} from './complaintsDao.js';

// Service to get complaints
const getComplaintsService = async (filters, page, limit) => {
  try {
    const data = await getComplaintsDao(filters, page, limit);
    return data;
  } catch (error) {
    logger.error('Error while fetching complaints', error);
    throw error;
  }
};

// Service to create a new complaint
const createComplaintsService = async (payload) => {
  try {
    const data = await createComplaintsDao(payload);
    return data;
  } catch (error) {
    logger.error('Error while creating complaint', error);
    throw error;
  }
};

// Service to update an existing complaint
const updateComplaintsService = async (id, company_id, body) => {
  try {
    if (!body || !id) {
      throw new InternalServerError('Missing required fields: body or id');
    }
    const data = await updateComplaintsDao({ id, company_id }, body);
    return data;
  } catch (error) {
    logger.error('Error while updating complaint', error);
    throw error;
  }
};

// Service to delete a complaint
const deleteComplaintsService = async (id, company_id, userData) => {
  try {
    const data = await deleteComplaintsDao({ id, company_id }, userData);
    return data;
  } catch (error) {
    logger.error('Error while deleting complaint', error);
    throw error;
  }
};

export {
  getComplaintsService,
  createComplaintsService,
  updateComplaintsService,
  deleteComplaintsService,
};
