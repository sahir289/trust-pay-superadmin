import { InternalServerError } from '../../utils/appErrors.js';
import { createHash } from '../../utils/bcryptPassword.js';
import { getConnection } from '../../utils/db.js';
import { generateUUID } from '../../utils/generateUUID.js';
import { generatePassword } from '../../utils/generatePassword.js';
import { sendCredentialsEmail } from '../../utils/sendMailer.js';
import {
  createUserDao,
  getUserByIdDao,
  getUsersByUserNameDao,
  getUsersDao,
  updateUserDao,
  getUsersBySearchDao,
  getAllUsersDao,
} from './userDao.js';
import { getDesignationDao } from '../designation/designationDao.js';
import { getRoleDao } from '../roles/rolesDao.js';
import { filterResponse } from '../../helpers/index.js';
import {
  columns,
  merchantColumns,
  Role,
  vendorColumns,
} from '../../constants/index.js';
import { createMerchantService } from '../merchants/merchantService.js';
import { createVendorService } from '../vendors/vendorService.js';
import { BadRequestError } from '../../utils/appErrors.js';
import { logger } from '../../utils/logger.js';
import {
  createUserHierarchyDao,
  getUserHierarchysDao,
  updateUserHierarchyDao,
} from '../userHierarchy/userHierarchyDao.js';
import { getMerchantByUserIdDao } from '../merchants/merchantDao.js';
import { getCompanyByIDDao } from '../company/companyDao.js';
// import { notifyAdminsAndUsers } from '../../utils/notifyUsers.js';

const getUsersService = async (
  ids,
  role,
  page,
  limit,
  designation,
  user_id,
) => {
  try {
    const filterColumns =
      role === Role.MERCHANT
        ? merchantColumns.USER
        : role === Role.VENDOR
          ? vendorColumns.USER
          : columns.USER;

    const pageNumber = parseInt(page, 10) || 1;
    const pageSize = parseInt(limit, 10) || 10;

    let userIdFilter = [];

    if (role === Role.VENDOR || role === Role.MERCHANT) {
      const userHierarchyData = await getUserHierarchysDao({ user_id });
      const userHierarchy = userHierarchyData[0];

      if (
        designation === Role.VENDOR_OPERATIONS ||
        designation === Role.MERCHANT_OPERATIONS
      ) {
        const parentUserId = userHierarchy?.config?.parent;
        if (parentUserId) {
          userIdFilter.push(parentUserId);

          const parentHierarchyData = await getUserHierarchysDao({
            user_id: parentUserId,
          });
          const parentHierarchy = parentHierarchyData[0];

          if (role === Role.MERCHANT) {
            const subMerchants =
              parentHierarchy?.config?.siblings?.sub_merchants ?? [];
            userIdFilter.push(...subMerchants);

            // Fetch child.operations from each submerchant
            for (const subId of subMerchants) {
              const subHierarchyData = await getUserHierarchysDao({
                user_id: subId,
              });
              const subHierarchy = subHierarchyData?.[0];
              const subOps = subHierarchy?.config?.child?.operations ?? [];
              userIdFilter.push(...subOps);
            }
          }

          const parentOps = parentHierarchy?.config?.child?.operations ?? [];
          userIdFilter.push(...parentOps);
        }
      } else {
        userIdFilter.push(user_id);
        const subMerchants =
          userHierarchy?.config?.siblings?.sub_merchants ?? [];
        userIdFilter.push(...subMerchants);

        // Add submerchant child.operations
        for (const subId of subMerchants) {
          const subHierarchyData = await getUserHierarchysDao({
            user_id: subId,
          });
          const subHierarchy = subHierarchyData?.[0];
          const subOps = subHierarchy?.config?.child?.operations ?? [];
          userIdFilter.push(...subOps);
        }

        const childOperations = userHierarchy?.config?.child?.operations ?? [];
        userIdFilter.push(...childOperations);
      }

      userIdFilter = [...new Set(userIdFilter)];
      ids.id = userIdFilter.length === 1 ? userIdFilter[0] : userIdFilter;
    }
    return await getAllUsersDao(
      ids,
      pageNumber,
      pageSize,
      null,
      null,
      filterColumns,
    );
  } catch (error) {
    logger.error('error getting while fetching user', error);
    throw error;
  }
};

const getUsersBySearchService = async (
  ids,
  role,
  page,
  limit,
  designation,
  user_id,
) => {
  try {
    const filterColumns =
      role === Role.MERCHANT
        ? merchantColumns.USER
        : role === Role.VENDOR
          ? vendorColumns.USER
          : columns.USER;

    const pageNumber = parseInt(page, 10) || 1;
    const pageSize = parseInt(limit, 10) || 10;

    let userIdFilter = [];

    if (role === Role.VENDOR || role === Role.MERCHANT) {
      const userHierarchyData = await getUserHierarchysDao({ user_id });
      const userHierarchy = userHierarchyData[0];

      if (
        designation === Role.VENDOR_OPERATIONS ||
        designation === Role.MERCHANT_OPERATIONS
      ) {
        const parentUserId = userHierarchy?.config?.parent;
        if (parentUserId) {
          userIdFilter.push(parentUserId);

          const parentHierarchyData = await getUserHierarchysDao({
            user_id: parentUserId,
          });
          const parentHierarchy = parentHierarchyData[0];

          if (role === Role.MERCHANT) {
            const subMerchants =
              parentHierarchy?.config?.siblings?.sub_merchants ?? [];
            userIdFilter.push(...subMerchants);

            // Fetch child.operations from each submerchant
            for (const subId of subMerchants) {
              const subHierarchyData = await getUserHierarchysDao({
                user_id: subId,
              });
              const subHierarchy = subHierarchyData?.[0];
              const subOps = subHierarchy?.config?.child?.operations ?? [];
              userIdFilter.push(...subOps);
            }
          }

          const parentOps = parentHierarchy?.config?.child?.operations ?? [];
          userIdFilter.push(...parentOps);
        }
      } else {
        userIdFilter.push(user_id);
        const subMerchants =
          userHierarchy?.config?.siblings?.sub_merchants ?? [];
        userIdFilter.push(...subMerchants);

        // Add submerchant child.operations
        for (const subId of subMerchants) {
          const subHierarchyData = await getUserHierarchysDao({
            user_id: subId,
          });
          const subHierarchy = subHierarchyData?.[0];
          const subOps = subHierarchy?.config?.child?.operations ?? [];
          userIdFilter.push(...subOps);
        }

        const childOperations = userHierarchy?.config?.child?.operations ?? [];
        userIdFilter.push(...childOperations);
      }

      userIdFilter = [...new Set(userIdFilter)];
      ids.id = userIdFilter.length === 1 ? userIdFilter[0] : userIdFilter;
    }
    let searchTerms;
    if (ids.search) {
      searchTerms = ids.search
      .split(',')
      .map((term) => term.trim())
      .filter((term) => term.length > 0);
    }
    
    
    const data = await getUsersBySearchDao(
      ids,
      searchTerms,
      pageNumber,
      pageSize,
      filterColumns,
    );

    return data;
  } catch (error) {
    logger.error('Error while fetching users by search', error);
    throw new InternalServerError(error.message);
  }
};
const getUserByIdService = async (ids, role) => {
  let conn;
  try {
    const filterColumns =
      role === Role.MERCHANT
        ? merchantColumns.USER
        : role === Role.VENDOR
          ? vendorColumns.USER
          : columns.USER;
    conn = await getConnection();
    const result = await getUserByIdDao(conn, ids);

    const finalResult = filterResponse(result, filterColumns);
    return finalResult;
  } catch (error) {
    logger.error('error getting while getting user by id', error);
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

const getUsersByUserNameService = async (username, ids, role) => {
  let conn;
  try {
    const filterColumns =
      role === Role.MERCHANT
        ? merchantColumns.USER
        : role === Role.VENDOR
          ? vendorColumns.USER
          : columns.USER;
    conn = await getConnection();
    const data = await getUsersByUserNameDao(ids, username, conn);
    const finalResult = filterResponse(data, filterColumns);
    return finalResult;
  } catch (error) {
    logger.error('error getting while fetching user', error);
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

const createUserService = async (conn, payload, role) => {
  try {
    const { user_name } = payload;
    let company_id = payload.company_id;
    const user = await getUsersByUserNameDao(company_id, user_name);
    if (user?.user_name || user?.email || user?.contact_no) {
      throw new BadRequestError('User already exists');
    }
    // else {
    //   const verifyEmail = await getUsersDao({ email: email });
    //   if (verifyEmail.length > 0) {
    //     throw new BadRequestError('Email already exists');
    //   }
    // }
    const Password = generatePassword(user_name);
    const hashPassword = await createHash(Password);
    payload.password = hashPassword;
    const userPayload = {
      role_id: payload.role_id,
      designation_id: payload.designation_id,
      first_name: payload.first_name,
      last_name: payload.last_name,
      email: payload.email,
      contact_no: payload.contact_no,
      user_name: payload.user_name,
      password: payload.password,
      is_enabled: payload.is_enabled,
      company_id: payload.company_id,
      created_by: payload.created_by,
      updated_by: payload.updated_by,
      config: { isLoginFirst: true },
    };
    const payin_notify = payload.payin_notify;
    const payout_notify = payload.payout_notify;
    const Return = payload.return;
    const site = payload.site;
    delete payload.payin_notify;
    delete payload.payout_notify;
    delete payload.return;
    delete payload.site;
    const User = await createUserDao(userPayload, conn);

    const designation = await getDesignationDao({ id: payload.designation_id });

    const userRole = await getRoleDao({ id: payload.role_id });
    const userDesignation = await getDesignationDao({
      id: payload.designation_id,
    });
    let unique_id = payload?.unique_admin_id;
    if (userDesignation[0]?.designation == Role.ADMIN || userDesignation[0]?.designation == Role.SUPER_ADMIN) {
      const company = await getCompanyByIDDao({ id: payload.company_id });
      if(company?.length > 0){ 
        unique_id = company[0]?.config?.unique_admin_id && company[0]?.config?.unique_admin_id;
    }
    }
      if (
        userDesignation[0]?.designation == Role.MERCHANT_OPERATIONS ||
        userDesignation[0]?.designation == Role.VENDOR_OPERATIONS
      ) {
        ///for operations

        const hierarchy = await getUserHierarchysDao({
          user_id: payload?.parent_id ? payload?.parent_id : payload.created_by,
        });
        const hierarchyConfig = hierarchy[0]?.config;
        const currentChildren = hierarchy[0]?.config?.child?.operations || [];
        await updateUserHierarchyDao(
          { id: hierarchy[0]?.id },
          {
            config: {
              ...hierarchyConfig,
              child: { operations: [...currentChildren, User.id] },
            },
          },
          conn,
        );
        if (
          userDesignation[0].designation == Role.VENDOR_OPERATIONS ||
          userDesignation[0].designation == Role.MERCHANT_OPERATIONS
        ) {
          await createUserHierarchyDao(
            {
              user_id: User.id,
              created_by: payload.created_by,
              updated_by: payload.updated_by,
              company_id: payload.company_id,
              config: {
                parent: payload?.parent_id
                  ? payload?.parent_id
                  : payload.created_by,
              },
            },
            conn,
          );
        }
      }

    let merchant = {};
    ///for merchant sub-merchant
    if (
      userDesignation[0]?.designation === Role.MERCHANT ||
      userDesignation[0]?.designation === Role.SUB_MERCHANT
    ) {
      let userCode;
      let sub_code;
      if (userDesignation[0]?.designation === Role.SUB_MERCHANT) {
        const user_id = payload?.parent_id
          ? payload?.parent_id
          : payload.created_by;
        userCode = await getMerchantByUserIdDao(user_id);
        sub_code = `${userCode[0].code}(${payload.code})`;
      }
      const Private = generateUUID();
      const Public = generateUUID();
      const merchantPayload = {
        user_id: User.id,
        role_id: payload.role_id,
        role: userRole[0].role,
        designation: userDesignation[0].designation,
        company_id: payload.company_id,
        first_name: payload.first_name,
        last_name: payload.last_name,
        code: payload.code,
        balance: Number(0),
        min_payin: Number(payload.min_payin),
        max_payin: Number(payload.max_payin),
        payin_commission: Number(payload.payin_commission),
        min_payout: Number(payload.min_payout),
        max_payout: Number(payload.max_payout),
        payout_commission: Number(payload.payout_commission),
        parent_id: payload?.parent_id ? payload?.parent_id : payload.created_by,
        created_by: payload.created_by,
        updated_by: payload.updated_by,
        config: {
          urls: {
            payin_notify: payin_notify,
            payout_notify: payout_notify,
            return: Return,
            site: site,
            whitelist_ips: payload.whitelist_ips,
          },
          keys: {
            private: Private,
            public: Public,
          },
          allow_intent: false,
          allow_payout: false,
          ...(sub_code && { sub_code }),
        },
      };
      merchant = await createMerchantService(conn, merchantPayload);
    }
    ///for vendor
    if (userDesignation[0]?.designation === Role.VENDOR) {
      const vendorPayload = {
        user_id: User.id,
        role_id: payload.role_id,
        company_id: payload.company_id,
        first_name: payload.first_name,
        last_name: payload.last_name,
        code: payload.code,
        balance: Number(0),
        payin_commission: Number(payload.payin_commission),
        payout_commission: Number(payload.payout_commission),
        created_by: payload.created_by,
        updated_by: payload.updated_by,
      };
      await createVendorService(conn, vendorPayload, role);
    }

    if (User) {
      try {
        const data = await sendCredentialsEmail({
          email: User.email,
          username: User.user_name,
          password: Password,
          code: merchant?.config ? merchant.code : '',
          secretKey: merchant?.config ? merchant.config.keys.private : '',
          publicKey: merchant?.config ? merchant.config.keys.public : '',
          designation: designation[0]?.designation,
          unique_id,
        });

        if (!data) {
          throw new InternalServerError('Failed to send email');
        }
      } catch (error) {
        logger.log('Error while sending email:', error);
        throw error;
      }
    }

    // const finalResult = filterResponse(User, filterColumns);
    // await notifyAdminsAndUsers({
    //   conn,
    //   company_id: payload.company_id,
    //   message: `New User with username: ${payload.user_name} has been created.`,
    //   payloadUserId: payload.created_by,
    //   actorUserId: payload.created_by,
    //   category: 'User',
    // });
    return User;
  } catch (error) {
    logger.error('Error in createUserService:', error);

    throw error;
  }
};

const userUpdateService = async (conn, ids, payload) => {
  try {
    // if (payload.email) {
    //   const verifyEmail = await getUsersDao({ email: payload.email });
    //   if (verifyEmail.length > 0) {
    //     throw new BadRequestError('Email already Registered');
    //   }
    // }
    const User = await updateUserDao(ids, payload, conn);
    // await notifyAdminsAndUsers({
    //   conn,
    //   company_id: ids.company_id,
    //   message: `User with username: ${User.user_name} has been updated.`,
    //   payloadUserId: payload.updated_by,
    //   actorUserId: payload.updated_by,
    //   category: 'User',
    // });
    return User;
  } catch (error) {
    logger.error('error getting while updating user', error);
    throw error;
  }
};

const sendMailService = async (payload) => {
  try {
    const { user_id } = payload;
    const user = await getUsersDao({ id: user_id });
    const role = await getRoleDao({ id: user[0].role_id });
    const designation = await getDesignationDao({ id: user[0].designation_id });
    let merchant;
    if (role[0].role === Role.MERCHANT) {
      merchant = await getMerchantByUserIdDao(user_id);
    }
    return await sendCredentialsEmail({
      email: user[0].email,
      username: user[0].user_name,
      code: merchant ? user[0].code : '',
      secretKey: merchant ? merchant[0].config.keys.private : '',
      publicKey: merchant ? merchant[0].config.keys.public : '',
      designation: designation[0].designation,
    });
  } catch (error) {
    logger.error('error getting while sending mail', error);
    throw error;
  }
};

export {
  getUsersService,
  getUserByIdService,
  getUsersBySearchService,
  getUsersByUserNameService,
  createUserService,
  userUpdateService,
  sendMailService,
};
