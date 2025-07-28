import { tableName } from '../../constants/index.js';
import {
  buildInsertQuery,
  buildSelectQuery,
  buildUpdateQuery,
  executeQuery,
} from '../../utils/db.js';
import { logger } from '../../utils/logger.js';
import { buildSearchFilterObj } from '../../utils/searchBuilder.js';
export const createUserHierarchyDao = async (data, conn) => {
  try {
    const [sql, params] = buildInsertQuery(tableName.USER_HIERARCHY, data);
    if (conn && conn.query) {
      const result = await conn.query(sql, params);
      return result.rows[0];
    }
    const result = await executeQuery(sql, params);
    return result.rows[0];
  } catch (error) {
    logger.error('Error in create UserHierarchy Dao:', error);
    throw error;
  }
};

export const getUserHierarchysDao = async (
  filters,
  page,
  pageSize,
  sortBy,
  sortOrder,
  columns = [],
) => {
  try {
    const baseQuery = `SELECT ${columns.length ? columns.join(', ') : '*'} FROM "${tableName.USER_HIERARCHY}" WHERE 1=1`;
    //TODO: columns.USER_HEIRARCHY dynamic search
    if (filters.search) {
      filters.or = buildSearchFilterObj(filters.search, tableName.MERCHANT);
      delete filters.search;
    }
    const [sql, queryParams] = buildSelectQuery(
      baseQuery,
      filters,
      page,
      pageSize,
      sortBy,
      sortOrder,
    );
    // Execute query
    const result = await executeQuery(sql, queryParams);
    return result.rows;
  } catch (error) {
    logger.error('Error in get UserHierarchy Dao:', error);
    throw error;
  }
};

export const updateUserHierarchyDao = async (id, data, conn) => {
  try {
    const [sql, params] = buildUpdateQuery(tableName.USER_HIERARCHY, data, id);
    let result;
    if (conn) {
      result = await conn.query(sql, params);
      return result.rows[0];
    }
    result = await executeQuery(sql, params);
    return result.rows[0];
  } catch (error) {
    logger.error('Error in updateUserHierarchyDao:', error);
    throw error;
  }
};

export const deleteUserHierarchyDao = async (id, data) => {
  try {
    const [sql, params] = buildUpdateQuery(tableName.USER_HIERARCHY, data, id);
    const result = await executeQuery(sql, params);
    return result.rows[0];
  } catch (error) {
    logger.error('Error in deleteUserHierarchyDao:', error);
    throw error;
  }
};
