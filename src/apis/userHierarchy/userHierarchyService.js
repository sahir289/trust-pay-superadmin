import {
  beginTransaction,
  commit,
  getConnection,
  rollback,
} from '../../utils/db.js';
import {
  createUserHierarchyDao,
  deleteUserHierarchyDao,
  getUserHierarchysDao,
  updateUserHierarchyDao,
} from './userHierarchyDao.js';
import { columns, merchantColumns, Role } from '../../constants/index.js';
import { filterResponse } from '../../helpers/index.js';
import { logger } from '../../utils/logger.js';
const createUserHierarchyService = async (payload, role) => {
  let conn;
  try {
    const filterColumns =
      role === Role.MERCHANT
        ? merchantColumns.USER_HIERARCHY
        : columns.USER_HIERARCHY;
    conn = await getConnection();
    await beginTransaction(conn); // Start a transaction
    const data = await createUserHierarchyDao(payload);
    await commit(conn); // Commit the transaction

    const finalResult = filterResponse(data, filterColumns);
    return finalResult;
  } catch (error) {
    if (conn) {
      try {
        await rollback(conn); // Rollback the transaction in case of error
      } catch (rollbackError) {
        logger.log('Error during transaction rollback', rollbackError);
      }
    }
    logger.error('Error while creating UserHierarchy', error);
    throw error;
  } finally {
    if (conn) {
      try {
        conn.release(); // Release the connection back to the pool
      } catch (releaseError) {
        logger.log('Error while releasing the connection', releaseError);
      }
    }
  }
};

const getUserHierarchyService = async (filters, role, page, limit) => {
  try {
    const filterColumns =
      role === Role.MERCHANT
        ? merchantColumns.USER_HIERARCHY
        : columns.USER_HIERARCHY;
    const pageNumber = parseInt(page, 10) || 1;
    const pageSize = parseInt(limit, 10) || 10;
    return await getUserHierarchysDao(
      filters,
      pageNumber,
      pageSize,
      null,
      null,
      filterColumns,
    );
  } catch (error) {
    logger.error('Error while fetching UserHierarchys', error);
    throw error;
  }
};

const updateUserHierarchyService = async (id, payload, role) => {
  let conn;
  try {
    const filterColumns =
      role === Role.MERCHANT
        ? merchantColumns.USER_HIERARCHY
        : columns.USER_HIERARCHY;
    conn = await getConnection();
    await beginTransaction(conn); // Start a transaction
    const data = await updateUserHierarchyDao(id, payload); // Adjust DAO call for update
    await commit(conn); // Commit the transaction

    const finalResult = await filterResponse(data, filterColumns);
    return finalResult;
  } catch (error) {
    if (conn) {
      try {
        await rollback(conn); // Rollback the transaction in case of error
      } catch (rollbackError) {
        logger.error('Error during transaction rollback', rollbackError);
      }
    }
    logger.error('Error while updating UserHierarchy', error);
    throw error;
  } finally {
    if (conn) {
      try {
        conn.release(); // Release the connection back to the pool
      } catch (releaseError) {
        logger.error('Error while releasing the connection', releaseError);
      }
    }
  }
};

const deleteUserHierarchyService = async (ids, updated_by, role) => {
  let conn;
  try {
    const filterColumns =
      role === Role.MERCHANT
        ? merchantColumns.USER_HIERARCHY
        : columns.USER_HIERARCHY;
    conn = await getConnection();
    await beginTransaction(conn); // Start a transaction
    const payload = { is_obsolete: true, updated_by };
    const data = await deleteUserHierarchyDao(ids, payload); // Adjust DAO call for delete
    await commit(conn); // Commit the transaction
    const finalResult = await filterResponse(data, filterColumns);
    return finalResult;
  } catch (error) {
    if (conn) {
      try {
        await rollback(conn); // Rollback the transaction in case of error
      } catch (rollbackError) {
        logger.error('Error during transaction rollback', rollbackError);
      }
    }
    logger.error('Error while deleting UserHierarchy', error);
    throw error;
  } finally {
    if (conn) {
      try {
        conn.release(); // Release the connection back to the pool
      } catch (releaseError) {
        logger.error('Error while releasing the connection', releaseError);
      }
    }
  }
};

export {
  createUserHierarchyService,
  getUserHierarchyService,
  updateUserHierarchyService,
  deleteUserHierarchyService,
};
