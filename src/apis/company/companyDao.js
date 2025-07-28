import {
  buildInsertQuery,
  buildSelectQuery,
  buildUpdateQuery,
  executeQuery,
} from '../../utils/db.js';
import { tableName } from '../../constants/index.js';
import { logger } from '../../utils/logger.js';

const getCompanyDao = async (filters, page, pageSize, sortBy, sortOrder) => {
  try {
    const baseQuery = `SELECT id,first_name,last_name,config FROM "${tableName.COMPANY}" WHERE 1=1`;
    //TODO: columns.Company dynamic search
    const [sql, queryParams] = buildSelectQuery(
      baseQuery,
      filters,
      page,
      pageSize,
      sortBy,
      sortOrder,
    );
    const result = await executeQuery(sql, queryParams);
    return result.rows.length > 0 ? result.rows : result.rows[0];
  } catch (error) {
    logger.error('Error fetching company:', error);
    throw error;
  }
};

const getCompanyByIDDao = async (
  filters,
) => {
  try {
    const baseQuery = `SELECT id,config FROM "${tableName.COMPANY}" WHERE 1=1`;
    const [sql, queryParams] = buildSelectQuery(
      baseQuery,
      filters,
    );
    const result = await executeQuery(sql, queryParams);
    return result.rows.length > 0 ? result.rows : result.rows[0];
  } catch (error) {
    logger.error('Error fetching company:', error);
    throw error;
  }
};

const createCompanyDao = async (conn, payload) => {
  try {
    const [sql, params] = buildInsertQuery(tableName.COMPANY, payload);
    if (conn && conn.query) {
      const result = await conn.query(sql, params);
      return result.rows[0];
    }
    const result = await executeQuery(sql, params);
    return result.rows;
  } catch (error) {
    logger.error('Error fetching company:', error);
    throw error;
  }
};

const updateCompanyDao = async (id, data) => {
  try {
    const [sql, params] = buildUpdateQuery(tableName.COMPANY, data, id);
    const result = await executeQuery(sql, params);
    return result.rows[0];
  } catch (error) {
    logger.error('Error updating company:', error); // Log the error for debugging
    throw error;
  }
};

const deleteCompanyDao = async (id, data) => {
  try {
    const [sql, params] = buildUpdateQuery(tableName.COMPANY, data, id);
    const result = await executeQuery(sql, params);
    return result.rows[0];
  } catch (error) {
    logger.error('Error deleting company:', error); // Log the error for debugging
    throw error;
  }
};

export {
  getCompanyDao,
  createCompanyDao,
  updateCompanyDao,
  deleteCompanyDao,
  getCompanyByIDDao,
};
