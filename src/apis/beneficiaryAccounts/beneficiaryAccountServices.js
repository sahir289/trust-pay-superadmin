import { Role } from '../../constants/index.js';
import { BadRequestError } from '../../utils/appErrors.js';
import {
  beginTransaction,
  commit,
  getConnection,
  rollback,
} from '../../utils/db.js';
import { logger } from '../../utils/logger.js';
import { getRoleDao } from '../roles/rolesDao.js';
import { getUserHierarchysDao } from '../userHierarchy/userHierarchyDao.js';
import {
  getUserByCompanyCreatedAtDao,
  getUserByIdDao,
  // getUserByRoleDao,
} from '../users/userDao.js';
import {
  getBeneficiaryAccountDao,
  createBeneficiaryAccountDao,
  updateBeneficiaryAccountDao,
  getBeneficiaryAccountDaoByBankName,
  getBeneficiaryAccountBySearchDao,
  getBeneficiaryAccountDaoAll,
  deleteBeneficiaryDao,
} from './beneficiaryAccountDao.js';
// import { notifyAdminsAndUsers } from '../../utils/notifyUsers.js';

const getBeneficiaryAccountService = async (
  filters,
  role,
  page,
  limit,
  user_id,
  designation,
  company_id,
) => {
  try {
    let merchant_user_id = role === Role.MERCHANT ? [user_id] : [];

    if (role === Role.MERCHANT) {
      const userHierarchys = await getUserHierarchysDao({ user_id });
      const userHierarchy = userHierarchys?.[0];

      if (designation === Role.MERCHANT && userHierarchy) {
        const subMerchants =
          userHierarchy?.config?.siblings?.sub_merchants ?? [];
        if (Array.isArray(subMerchants) && subMerchants.length > 0) {
          merchant_user_id = [...merchant_user_id, ...subMerchants];
          filters.user_id = [merchant_user_id];
        } else {
          filters.user_id = [user_id];
        }
      } else if (designation === Role.SUB_MERCHANT) {
        filters.user_id = [user_id];
      } else if (designation === Role.MERCHANT_OPERATIONS && userHierarchy) {
        const parentID = userHierarchy?.config?.parent;
        if (parentID) {
          const parentHierarchys = await getUserHierarchysDao({
            user_id: parentID,
          });
          const parentHierarchy = parentHierarchys?.[0];
          const subMerchants =
            parentHierarchy?.config?.siblings?.sub_merchants ?? [];

          const userIdFilter = [...new Set([parentID, ...subMerchants])];
          filters.user_id = [userIdFilter];
        }
      }
    } else if (role === Role.VENDOR) {
      if (designation == Role.VENDOR) {
        filters.user_id = [user_id];
      } else if (designation == Role.VENDOR_OPERATIONS) {
        const userHierarchys = await getUserHierarchysDao({ user_id });
        const parentID = userHierarchys[0]?.config?.parent;
        if (parentID) {
          filters.user_id = [parentID];
        }
      }
      const adminUser = await getUserByCompanyCreatedAtDao(
        company_id,
        Role.ADMIN,
      );
      filters.user_id = [...filters.user_id, adminUser.id];
    } else if ((role === Role.ADMIN || role === Role.SUPER_ADMIN) && filters?.user_id) {
      // filters.user_id = [user_id];
      const adminUser = await getUserByCompanyCreatedAtDao(
        company_id,
        Role.ADMIN,
      );
      filters.user_id = [filters.user_id, adminUser.id];
    }

    let role_id;
    if (filters?.beneficiary_role) {
      role_id = await getRoleDao({ role: filters.beneficiary_role });
      filters.role_id = role_id[0]?.id;
      if (filters.beneficiary_role === Role.VENDOR) {
        const [adminRole] = await getRoleDao({ role: Role.ADMIN });
        filters.role_id = [filters.role_id, adminRole?.id];
      }
      delete filters.beneficiary_role;
    }

    const pageNumber = parseInt(page, 10) || 1;
    const pageSize = parseInt(limit, 10) || 10;
    filters.company_id = company_id;

    return await getBeneficiaryAccountDaoAll(
      { ...filters },
      pageNumber,
      pageSize,
      role,
    );
  } catch (error) {
    logger.error('error getting while  getting banks', error);
    throw error;
  }
};

const getBeneficiaryAccountBySearchService = async (
  role,
  search,
  filters,
  page,
  limit,
  user_id,
  designation,
  company_id,
) => {
  try {
    let merchant_user_id = role === Role.MERCHANT ? [user_id] : [];

    if (role === Role.MERCHANT) {
      const userHierarchys = await getUserHierarchysDao({ user_id });
      const userHierarchy = userHierarchys?.[0];

      if (designation === Role.MERCHANT && userHierarchy) {
        const subMerchants =
          userHierarchy?.config?.siblings?.sub_merchants ?? [];
        if (Array.isArray(subMerchants) && subMerchants.length > 0) {
          merchant_user_id = [...merchant_user_id, ...subMerchants];
          filters.user_id = [merchant_user_id];
        } else {
          filters.user_id = [user_id];
        }
      } else if (designation === Role.SUB_MERCHANT) {
        filters.user_id = [user_id];
      } else if (designation === Role.MERCHANT_OPERATIONS && userHierarchy) {
        const parentID = userHierarchy?.config?.parent;
        if (parentID) {
          const parentHierarchys = await getUserHierarchysDao({
            user_id: parentID,
          });
          const parentHierarchy = parentHierarchys?.[0];
          const subMerchants =
            parentHierarchy?.config?.siblings?.sub_merchants ?? [];
          const userIdFilter = [...new Set([parentID, ...subMerchants])];
          filters.user_id = [userIdFilter];
        }
      }
    } else if (role === Role.VENDOR) {
      if (designation == Role.VENDOR) {
        filters.user_id = [user_id];
        const adminUser = await getUserByCompanyCreatedAtDao(
          company_id,
          Role.ADMIN,
        );
        filters.user_id = [...filters.user_id, adminUser.id];
      } else if (designation == Role.VENDOR_OPERATIONS) {
        const userHierarchys = await getUserHierarchysDao({ user_id });
        const parentID = userHierarchys[0]?.config?.parent;
        if (parentID) {
          filters.user_id = [parentID];
        }
        const adminUser = await getUserByCompanyCreatedAtDao(
          company_id,
          Role.ADMIN,
        );
        filters.user_id = [...filters.user_id, adminUser.id];
      }
      const adminUser = await getUserByCompanyCreatedAtDao(
        company_id,
        Role.ADMIN,
      );
      filters.user_id = [...filters.user_id, adminUser.id];
    }

    let role_id;
    if (filters?.beneficiary_role) {
      role_id = await getRoleDao({ role: filters.beneficiary_role });
      filters.role_id = role_id[0]?.id;
      if (filters.beneficiary_role === Role.VENDOR) {
        const [adminRole] = await getRoleDao({ role: Role.ADMIN });
        filters.role_id = [filters.role_id, adminRole?.id];
      }
      delete filters.beneficiary_role;
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    if (isNaN(pageNum) || isNaN(limitNum) || pageNum < 1 || limitNum < 1) {
      throw new BadRequestError('Invalid pagination parameters');
    }

    const searchTerms = search
      .split(',')
      .map((term) => term.trim())
      .filter((term) => term.length > 0);
    if (searchTerms.length === 0) {
      throw new BadRequestError('Please provide valid search items');
    }

    const result = await getBeneficiaryAccountBySearchDao(
      role,
      searchTerms,
      pageNum,
      limitNum,
      filters,
    );

    return result;
  } catch (error) {
    logger.error('Error in get BeneficiaryAccountBySearchService:', error);
    throw error;
  }
};

const getBeneficiaryAccountServiceByBankName = async (
  company_id,
  type,
  role,
  user_id,
  designation,
) => {
  let conn;
  try {
    conn = await getConnection();
    await beginTransaction(conn);

    let filters = {};
    if (role == Role.VENDOR) {
      filters.user_id = [user_id];
    }
    const userHierarchys = await getUserHierarchysDao({ user_id });
    if (designation == Role.VENDOR_OPERATIONS) {
      const parentID = userHierarchys[0]?.config?.parent;
      if (parentID) {
        filters.user_id = [parentID];
      }
    }

    const result = await getBeneficiaryAccountDaoByBankName(
      conn,
      company_id,
      type,
      filters,
    );
    await commit(conn);
    return result;
  } catch (error) {
    if (conn) {
      try {
        await rollback(conn);
      } catch (rollbackError) {
        logger.error('Error during transaction rollback', rollbackError);
      }
    }
    throw error;
  } finally {
    if (conn) {
      try {
        conn.release();
      } catch (releaseError) {
        logger.error('Error while releasing the connection', releaseError);
      }
    }
  }
};

const createBeneficiaryAccountService = async (conn, payload, company_id) => {
  try {
    // Set user_id to created_by if not already set
    payload.user_id = payload.user_id || payload.created_by;

    // Fetch user and role
    const [user] = await getUserByIdDao(conn, { id: payload.user_id });
    if (!user) throw new BadRequestError('User not found');
    const [roleObj] = await getRoleDao({ role: user.role });
    if (!roleObj) throw new BadRequestError('Role not found');
    payload.role_id = roleObj.id;

    // Prepare config based on role
    if ((roleObj.role === Role.ADMIN || roleObj.role === Role.SUPER_ADMIN)) {
      const adminUser = await getUserByCompanyCreatedAtDao(
        company_id,
        Role.ADMIN,
      );
      if (adminUser) payload.user_id = adminUser.id;
      payload.config = {
        type: payload?.type,
        initial_balance: payload?.initial_balance || 0,
        closing_balance: payload?.initial_balance || 0,
        is_enabled: false,
      };
      delete payload.type; // Remove type if it's not needed in config
      delete payload?.initial_balance; // Remove initial_balance if it's not needed in config
    } else if (roleObj.role === Role.VENDOR) {
      payload.config = {
        type: 'Personal',
        initial_balance: 0,
        closing_balance: 0,
        is_enabled: true,
      };
      delete payload?.type;
      delete payload?.initial_balance; // Remove initial_balance if it's not needed in config
    } else if (roleObj.role === Role.MERCHANT) {
      payload.config = {
        type: 'Personal',
      };
      delete payload?.type;
    }

    // Check for duplicates
    if ([Role.VENDOR, Role.MERCHANT, Role.ADMIN, Role.SUPER_ADMIN].includes(roleObj.role)) {
      const filters = { acc_no: payload.acc_no };
      if (roleObj.role === Role.VENDOR) filters.user_id = payload.user_id;
      const exists = await getBeneficiaryAccountDao(
        filters,
        null,
        null,
        roleObj.role,
      );
      if (exists.length > 0)
        throw new BadRequestError(
          'Beneficiary account already exists for this merchant',
        );
    }

    // Create account
    const result = await createBeneficiaryAccountDao(conn, payload);

    // Notify users
    // const vendorUsers = await getUserByRoleDao(company_id, Role.VENDOR);
    // const vendorUserIds = vendorUsers.map((u) => u.id);
    // const notifyIds =
    //   roleObj.role === Role.ADMIN ? vendorUserIds : [payload.user_id];
    // await notifyAdminsAndUsers({
    //   conn,
    //   company_id,
    //   message: `The new Beneficiary Account with Bank Name ${payload.bank_name} has been created.`,
    //   payloadUserId: notifyIds,
    //   actorUserId: payload.updated_by,
    //   category: 'Beneficiary Account',
    // });

    return result;
  } catch (error) {
    logger.error('Error creating beneficiary account', error);
    throw error;
  }
};

const updateBeneficiaryAccountService = async (conn, ids, payload) => {
  try {
    const [banks] = await getBeneficiaryAccountDao({
      id: ids.id,
      company_id: ids.company_id,
    });

    if (!banks) {
      throw new BadRequestError('Beneficiary account not found');
    }

    return await updateBeneficiaryAccountDao({ id: ids.id, company_id: ids.company_id }, payload, conn);

    // let notifyIds = [];
    // if (role === Role.ADMIN) {
    // Notify users
    // const vendorUsers = await getUserByRoleDao(ids.company_id, Role.VENDOR);
    // const vendorUserIds = vendorUsers.map((u) => u.id);
    // notifyIds = role === Role.ADMIN ? vendorUserIds : [payload.updated_by];
    // }

    // await notifyAdminsAndUsers({
    //   conn,
    //   company_id: ids.company_id,
    //   message: `The Beneficiary Account with Bank Name ${banks.bank_name} has been updated.`,
    //   payloadUserId: notifyIds,
    //   actorUserId: payload.updated_by,
    //   category: 'Beneficiary Account',
    // });
  } catch (error) {
    logger.error('error getting while updating banks', error);
    throw new BadRequestError('Error getting while updating banks');
  }
};

const deleteBeneficiaryAccountService = async (conn, ids) => {
  try {
    let result = await deleteBeneficiaryDao(
      conn,
      { id: ids.id, company_id: ids.company_id },
      { is_obsolete: true },
    );
    return result;
  } catch (error) {
    logger.error('error getting while deleting banks', error);
    throw new BadRequestError('Error getting while  deleting banks');
  }
};

export {
  getBeneficiaryAccountService,
  getBeneficiaryAccountBySearchService,
  createBeneficiaryAccountService,
  updateBeneficiaryAccountService,
  deleteBeneficiaryAccountService,
  getBeneficiaryAccountServiceByBankName,
};
