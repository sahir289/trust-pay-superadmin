import { logger } from '../../utils/logger.js';
import {
  getDesignationDao,
  createDesignationDao,
  updateDesignationDao,
  deleteDesignationDao,
} from './designationDao.js';

const getDesignationService = async (user, page, limit) => {
  try {
    const result = await getDesignationDao(user, page, limit);
    return result;
  } catch (error) {
    logger.error('error getting while Designation', error);
    throw error;
  }
};

const createDesignationService = async (conn, payload) => {
  try {
    const result = await createDesignationDao(conn, payload);
    return result;
  } catch (error) {
    logger.error('error getting while Designation', error);
    throw error;
  }
};

const updateDesignationService = async (id, payload) => {
  try {
    const result = await updateDesignationDao(id, payload);
    return result;
  } catch (error) {
    logger.error('error getting while Designation', error);
    throw error;
  }
};

const deleteDesignationService = async (id) => {
  try {
    const result = await deleteDesignationDao(id, {
      is_obsolete: true,
    });
    return result;
  } catch (error) {
    logger.error('error getting while Designation', error);
    throw error;
  }
};

export {
  getDesignationService,
  createDesignationService,
  updateDesignationService,
  deleteDesignationService,
};
