import { columns, Role, vendorColumns } from '../../constants/index.js';
import { filterResponse } from '../../helpers/index.js';

import {
  beginTransaction,
  commit,
  getConnection,
  rollback,
} from '../../utils/db.js';
import { logger } from '../../utils/logger.js';
import {
  createUserHierarchyDao,
  getUserHierarchysDao,
} from '../userHierarchy/userHierarchyDao.js';
import {
  createVendorDao,
  deleteVendorDao,
  getVendorsCodeDao,
  getVendorsBySearchDao,
  updateVendorDao,
  getAllVendorsDao,
} from './vendorDao.js';
import { BadRequestError } from '../../utils/appErrors.js';
import { createCalculationDao } from '../calculation/calculationDao.js';
import { updateBankaccountDao } from '../bankAccounts/bankaccountDao.js';
import { updateUserDao } from '../users/userDao.js';
// import { notifyAdminsAndUsers } from '../../utils/notifyUsers.js';
import { deleteBeneficiaryDao } from '../beneficiaryAccounts/beneficiaryAccountDao.js';
const createVendorService = async (conn, payload) => {
  try {
    let role_id = payload.role_id;
    delete payload.role_id;
    const data = await createVendorDao(payload, conn);
    const calculationPayload = {
      user_id: data.user_id,
      role_id: role_id,
      company_id: data.company_id,
    };
    await createCalculationDao(conn, calculationPayload);
    await createUserHierarchyDao(
      {
        user_id: data.user_id,
        // role_id: Role_id,
        created_by: data.created_by,
        updated_by: data.updated_by,
        company_id: data.company_id,
      },
      conn,
    );
    // await notifyAdminsAndUsers({
    //   conn,
    //   company_id: data.company_id,
    //   message: `New Vendor with code: ${data.code} has been created.`,
    //   payloadUserId: data.updated_by,
    //   actorUserId: data.updated_by,
    //   category: 'Client',
    //   subCategory: 'Vendor'
    // });
    return data;
  } catch (error) {
    logger.error('Error while creating Vendor', error);
    throw error;
  }
};

const getVendorsService = async (
  filters,
  roleIs,
  page,
  limit,
  user_id,
  designation,
) => {
  try {
    const pageNumber = parseInt(page, 10) || 1;
    const pageSize = parseInt(limit, 10) || 10;
    let parentUserId;
    if (roleIs === Role.VENDOR) {
      if (designation === Role.VENDOR_OPERATIONS) {
        const UserHierarchy = await getUserHierarchysDao({ user_id });
        const userHierarchy = UserHierarchy[0];
        parentUserId = userHierarchy?.config?.parent;
        filters.user_id = parentUserId;
      } else {
        parentUserId = user_id;
        filters.user_id = parentUserId;
      }
    }
    return await getAllVendorsDao(
      filters,
      pageNumber,
      pageSize,
      null,
      null,
      roleIs, //-role specific details
    );
  } catch (error) {
    logger.error('Error while fetching vendors', error);
    throw error;
  }
};

const getVendorsCodeService = async (filters, roleIs, user_id, designation) => {
  let conn;
  try {
    conn = await getConnection(); // Get DB connection
    await beginTransaction(conn); // Start transaction
    let parentUserId;
    if (roleIs === Role.VENDOR) {
      if (designation === Role.VENDOR_OPERATIONS) {
        const UserHierarchy = await getUserHierarchysDao({ user_id });
        const userHierarchy = UserHierarchy[0];
        parentUserId = userHierarchy?.config?.parent;
        filters.user_id = parentUserId;
      } else {
        parentUserId = user_id;
        filters.user_id = parentUserId;
      }
    }
    const data = await getVendorsCodeDao(filters, conn);

    await commit(conn); // Commit transaction
    return data;
  } catch (error) {
    if (conn) {
      try {
        await rollback(conn); // Rollback in case of error
      } catch (rollbackError) {
        logger.error('Error during transaction rollback:', rollbackError);
      }
    }
    logger.error('Error while fetching vendors:', error);
    throw error;
  } finally {
    if (conn) {
      try {
        conn.release(); // Ensure connection is released
      } catch (releaseError) {
        logger.error('Error releasing connection:', releaseError);
      }
    }
  }
};
const getVendorsBySearchService = async (
  filters,
  role,
  designation,
  user_id,
) => {
  try {
    const pageNum = parseInt(filters.page);
    const limitNum = parseInt(filters.limit);
    if (isNaN(pageNum) || isNaN(limitNum) || pageNum < 1 || limitNum < 1) {
      throw new BadRequestError('Invalid pagination parameters');
    }
    const searchTerms = filters.search
      .split(',')
      .map((term) => term.trim())
      .filter((term) => term.length > 0);

    if (searchTerms.length === 0) {
      throw new BadRequestError('Please provide valid search terms');
    }
    const offset = (pageNum - 1) * limitNum;

    const filterColumns =
      role === Role.VENDOR ? vendorColumns.VENDOR : columns.VENDOR;
    // TODO: add designation constants
    let parentUserId;
    if (role === Role.VENDOR) {
      if (designation === Role.VENDOR_OPERATIONS) {
        const UserHierarchy = await getUserHierarchysDao({ user_id });
        const userHierarchy = UserHierarchy[0];
        parentUserId = userHierarchy?.config?.parent;
        filters.user_id = parentUserId;
      } else {
        parentUserId = user_id;
        filters.user_id = parentUserId;
      }
    }
    const data = await getVendorsBySearchDao(
      filters,
      searchTerms,
      limitNum,
      offset,
      filterColumns,
    );

    return data;
  } catch (error) {
    logger.error('Error while fetching vendors by search', error);
    throw error;
  }
};

const updateVendorService = async (id, payload, role) => {
  let conn;
  try {
    const filterColumns =
      role === Role.VENDOR ? vendorColumns.VENDOR : columns.VENDOR;
    conn = await getConnection();
    await beginTransaction(conn); // Start a transaction
    const data = await updateVendorDao(id, payload, conn); // Adjust DAO call for update
    await commit(conn); // Commit the transaction
    const finalResult = filterResponse(data, filterColumns);
    // await notifyAdminsAndUsers({
    //   conn,
    //   company_id: data.company_id,
    //   message: `Vendor with code: ${data.code} has been updated.`,
    //   payloadUserId: data.updated_by,
    //   actorUserId: data.updated_by,
    //   category: 'Client',
    //   subCategory: 'Vendor'
    // });
    return finalResult;
  } catch (error) {
    if (conn) {
      try {
        await rollback(conn); // Rollback the transaction in case of error
      } catch (rollbackError) {
        logger.error(
          'Error during transaction rollback',
          'error',
          rollbackError,
        );
      }
    }
    logger.error('Error while updating Vendor', error);
    throw error;
  } finally {
    if (conn) {
      try {
        conn.release(); // Release the connection back to the pool
      } catch (releaseError) {
        logger.error(
          'Error while releasing the connection',
          'error',
          releaseError,
        );
      }
    }
  }
};

const deleteVendorService = async (ids, user_id) => {
  let conn;
  try {
    conn = await getConnection();
    await beginTransaction(conn); // Start a transaction
    const payload = { is_obsolete: true, updated_by: user_id };
    const data = await deleteVendorDao(conn, ids, payload); // Adjust DAO call for delete
    //delete banks and childs for particular user
    if (data) {
      const payloadBank = {
        config: { is_freeze: true, isFromDeletedParent: true },
        is_qr: false,
        is_bank: false,
        is_enabled: false,
        updated_by: user_id,
      };
      await updateUserDao({ id: ids.user_id }, payload, conn);
      await deleteBeneficiaryDao(
        conn,
        { user_id: ids.user_id },
        { is_obsolete: true },
      );
      await updateBankaccountDao(
        { user_id: ids.user_id },
        payloadBank,
        conn,
        true,
      );
      //for childs user hierachys
      const UserHierarchy = await getUserHierarchysDao({
        user_id: ids.user_id,
      });
      if (UserHierarchy[0]?.config?.child?.operations) {
        const userIds = UserHierarchy[0].config.child.operations;
        for (const userId of userIds) {
          await updateUserDao({ id: userId }, payload, conn);
        }
      }
    }
    // await notifyAdminsAndUsers({
    //   conn,
    //   company_id: ids.company_id,
    //   message: `Vendor with code: ${data.code} has been deleted.`,
    //   payloadUserId: user_id,
    //   actorUserId: user_id,
    //   category: 'Client',
    //   subCategory: 'Vendor'
    // });
    await commit(conn); // Commit the transaction
    return data;
  } catch (error) {
    if (conn) {
      try {
        await rollback(conn); // Rollback the transaction in case of error
      } catch (rollbackError) {
        logger.error(
          'Error during transaction rollback',
          'error',
          rollbackError,
        );
      }
    }
    logger.error('Error while deleting Vendor', error);
    throw error;
  } finally {
    if (conn) {
      try {
        conn.release(); // Release the connection back to the pool
      } catch (releaseError) {
        logger.error(
          'Error while releasing the connection',
          'error',
          releaseError,
        );
      }
    }
  }
};

export {
  createVendorService,
  getVendorsService,
  updateVendorService,
  deleteVendorService,
  getVendorsBySearchService,
  getVendorsCodeService,
};
