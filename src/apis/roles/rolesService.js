import { logger } from '../../utils/logger.js';
import {
  getRoleDao,
  createRoleDao,
  updateRoleDao,
  deleteRoleDao,
} from './rolesDao.js';

const getRoleService = async (filters) => {
  try {
    const data = await getRoleDao(filters);
    return data;
  } catch (error) {
    logger.error('Error while fetching role', error);
    throw error;
  }
};

const createRoleService = async (conn, payload) => {
  try {
    const data = await createRoleDao(conn, payload);

    return data;
  } catch (error) {
    logger.error('Error while updating Role', error);
    throw error;
  }
};

const updateRoleService = async (conn, id, body) => {
  try {
    const data = await updateRoleDao(conn, id, body);
    return data;
  } catch (error) {
    logger.error('Error while updating Role', 'error', error);
    throw error;
  }
};

const deleteRoleService = async (id, userData) => {
  try {
    const data = await deleteRoleDao(id, userData);
    return data;
  } catch (error) {
    logger.error('Error while updating Role', 'error', error);
    throw error;
  }
};

export {
  getRoleService,
  createRoleService,
  updateRoleService,
  deleteRoleService,
};
