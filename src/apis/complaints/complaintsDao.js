import {
  executeQuery,
  buildInsertQuery,
  buildUpdateQuery,
  buildSelectQuery,
} from '../../utils/db.js';
import { tableName } from '../../constants/index.js';
import { logger } from '../../utils/logger.js';
// Get Complaints with pagination, sorting, and filtering
const getComplaintsDao = async (filters, page, pageSize, sortBy, sortOrder) => {
  try {
    const baseQuery = `SELECT id,status,payin_id FROM "${tableName.COMPLAINTS}" WHERE 1=1`;
    //TODO: columns.COMPLAINTS dynamic search
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
    logger.error('Error fetching complaints:', error);
    throw error;
  }
};

// Create a new Complaint
const createComplaintsDao = async (data) => {
  try {
    // If you want to generate UUID or modify data before insertion, do it here.
    // data.id = generateUUID(); // Uncomment if UUID generation is needed
    const [sql, params] = buildInsertQuery(tableName.COMPLAINTS, data);
    const result = await executeQuery(sql, params);
    return result.rows[0];
  } catch (error) {
    logger.error('Error creating complaint:', error);
    throw error;
  }
};

// Update an existing Complaint
const updateComplaintsDao = async (id, data) => {
  try {
    const [sql, params] = buildUpdateQuery(tableName.COMPLAINTS, data, id);
    const result = await executeQuery(sql, params);
    return result.rows[0];
  } catch (error) {
    logger.error('Error updating complaint:', error);
    throw error;
  }
};

// Delete a Complaint
const deleteComplaintsDao = async (id, data) => {
  try {
    const [sql, params] = buildUpdateQuery(tableName.COMPLAINTS, data, id);
    const result = await executeQuery(sql, params);
    return result.rows[0];
  } catch (error) {
    logger.error('Error deleting complaint:', error);
    throw error;
  }
};

export {
  getComplaintsDao,
  createComplaintsDao,
  updateComplaintsDao,
  deleteComplaintsDao,
};
