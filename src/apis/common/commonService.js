import { getTotalCountDao } from './commonDao.js';
import { tableName, Role } from '../../constants/index.js';
import { getMerchantByUserIdDao } from '../merchants/merchantDao.js';
import { getBankaccountDao } from '../bankAccounts/bankaccountDao.js';
import { getUserHierarchysDao } from '../userHierarchy/userHierarchyDao.js';
import { getVendorsDao } from '../vendors/vendorDao.js';
import { getRoleDao } from '../roles/rolesDao.js';
import { logger } from '../../utils/logger.js';
import { getBankResponseByUTR } from '../bankResponse/bankResponseDao.js';
import { getUserByCompanyCreatedAtDao } from '../users/userDao.js';

export const getTotalCountService = async (
  tablename,
  role,
  filters,
  userInfo,
) => {
  try {
    const isMerchantOrVendor =
      userInfo.userRole === Role.MERCHANT || userInfo.userRole === Role.VENDOR;
    const isOperations =
      userInfo.designation === Role.MERCHANT_OPERATIONS ||
      userInfo.designation === Role.VENDOR_OPERATIONS;
    let userIdFilter = [];
    const company_id = filters?.company_id;

    if (filters?.beneficiary_role) {
      const role_id = await getRoleDao({ role: filters.beneficiary_role });
      filters.role_id = role_id[0]?.id;
      if (filters.beneficiary_role === Role.VENDOR) {
        const [adminRole] = await getRoleDao({ role: Role.ADMIN });
        filters.role_id = [filters.role_id, adminRole?.id];
      }
      delete filters.beneficiary_role;
      delete filters.company_id;
    }

    if (tablename === tableName.CHARGE_BACK && filters?.bank_name) {
      const bank = await getBankaccountDao(
        { nick_name: filters.bank_name },
        1,
        10,
        role,
        userInfo.designation,
      );
      delete filters.bank_name; // Remove bank_name from filters
      if (bank && bank.length > 0) {
        filters.bank_acc_id = bank.map((b) => b.id);
      } else {
        filters.bank_acc_id = [];
      }
    } else if (tablename === tableName.CHARGE_BACK && filters?.utr) {
      const bankResponse = await getBankResponseByUTR(filters.utr);
      delete filters.utr; // Remove utr from filters
      if (bankResponse && bankResponse.length > 0) {
        filters.bank_acc_id = bankResponse.map((b) => b.id);
      } else {
        filters.bank_acc_id = [];
      }
    }

    // user hierarchy
    const getHierarchy = async (userId) =>
      (await getUserHierarchysDao({ user_id: userId }))?.[0];

    // sub-merchants and operations
    const getSubMerchantsAndOps = async (hierarchy, includeOps = true) => {
      const subMerchants = hierarchy?.config?.siblings?.sub_merchants ?? [];
      const ops = includeOps
        ? (hierarchy?.config?.child?.operations ?? [])
        : [];
      const subOps = [];
      for (const subId of subMerchants) {
        const subHierarchy = await getHierarchy(subId);
        subOps.push(...(subHierarchy?.config?.child?.operations ?? []));
      }
      return [...subMerchants, ...ops, ...subOps];
    };

    const fetchMerchantIds = async (userIds) =>
      (await getMerchantByUserIdDao(userIds)).map((m) => m.id);
    const fetchBankIds = async (user_id) => {
      try {
        const banks = await getBankaccountDao({
          user_id,
          bank_used_for: 'PayIn',
        });
        return banks?.map((bank) => bank.id) || [];
      } catch (error) {
        logger.error(`Error fetching bank IDs for user_id: ${user_id}`, error);
        return [];
      }
    };

    const fetchVendorIds = async (userIds) =>
      (await getVendorsDao({ user_id: userIds })).map((v) => v.id);

    const applyUserFilter = async (hierarchy, includeParent = false) => {
      userIdFilter.push(userInfo.user_id);
      if (includeParent && isOperations) {
        const parentId = hierarchy?.config?.parent;
        if (parentId) userIdFilter.push(parentId);
      }
      userIdFilter.push(...(await getSubMerchantsAndOps(hierarchy)));
      return [...new Set(userIdFilter)];
    };

    if (!isMerchantOrVendor) {
      if (tablename === tableName.BENEFICIARY_ACCOUNTS) {
        if (filters?.role) {
          const role_id = await getRoleDao({ role: filters.role });
          filters.role_id = role_id[0]?.id;
          delete filters.role;
        }
        delete filters.company_id;
      }
      let updated = false;
      if (filters?.updated) {
        updated = filters.updated;
        delete filters.updated;
      }
      // Handle updatedPayin filter
      let updatedPayin = false;
      if (filters?.updatedPayin) {
        updatedPayin = filters.updatedPayin;
        delete filters.updatedPayin;
      }

      return await getTotalCountDao(
        tablename,
        role,
        filters,
        userInfo.userRole,
        updated,
        updatedPayin,
      );
    }

    const hierarchy = await getHierarchy(userInfo.user_id);

    // USER table
    if (tablename === tableName.USER) {
      userIdFilter = await applyUserFilter(hierarchy, true);
      if (isOperations && role === Role.MERCHANT) {
        const parentId = hierarchy?.config?.parent;
        if (parentId) {
          const parentHierarchy = await getHierarchy(parentId);
          userIdFilter.push(...(await getSubMerchantsAndOps(parentHierarchy)));
        }
      }
      filters.id = userIdFilter.length === 1 ? userIdFilter[0] : userIdFilter;
    }

    // MERCHANT or VENDOR table
    if (tablename === tableName.MERCHANT || tablename === tableName.VENDOR) {
      userIdFilter = isOperations
        ? [hierarchy?.config?.parent].filter(Boolean)
        : [userInfo.user_id];
      filters.user_id =
        userIdFilter.length === 1 ? userIdFilter[0] : userIdFilter;
    }

    // CHARGE_BACK table
    if (tablename === tableName.CHARGE_BACK) {
      userIdFilter = isOperations
        ? [hierarchy?.config?.parent].filter(Boolean)
        : [userInfo.user_id];
      userIdFilter.push(...(hierarchy?.config?.siblings?.sub_merchants ?? []));
      const filterKey =
        userInfo.userRole === Role.MERCHANT
          ? 'merchant_user_id'
          : 'vendor_user_id';
      filters[filterKey] =
        userIdFilter.length === 1 ? userIdFilter[0] : userIdFilter;
    }

    // SETTLEMENT table
    if (tablename === tableName.SETTLEMENT) {
      // if (userInfo.userRole === Role.MERCHANT) {
      //   userIdFilter.push(
      //     ...(hierarchy?.config?.siblings?.sub_merchants ?? []),
      //   );
      // }
      if (
        userInfo.userRole === Role.MERCHANT &&
        userInfo.designation === Role.MERCHANT_OPERATIONS
      ) {
        userIdFilter.push(hierarchy?.config?.parent ?? null);
      } else if (
        userInfo.userRole === Role.VENDOR &&
        userInfo.designation === Role.VENDOR_OPERATIONS
      ) {
        userIdFilter.push(hierarchy?.config?.parent ?? null);
      } else {
        userIdFilter = [userInfo.user_id];
      }
      filters.user_id =
        userIdFilter.length === 1 ? userIdFilter[0] : userIdFilter;
    }

    // PAYIN table
    if (tablename === tableName.PAYIN) {
      if (userInfo.userRole === Role.MERCHANT) {
        userIdFilter = [userInfo.user_id];
        if (userInfo.designation === Role.MERCHANT) {
          const subMerchants = hierarchy?.config?.siblings?.sub_merchants ?? [];
          const merchantIds = await fetchMerchantIds([
            ...userIdFilter,
            ...subMerchants,
          ]);
          userIdFilter.push(...merchantIds);
        } else if (userInfo.designation === Role.SUB_MERCHANT) {
          userIdFilter.push(...(await fetchMerchantIds([userInfo.user_id])));
        } else if (isOperations) {
          const parentId = hierarchy?.config?.parent;
          userIdFilter.push(parentId);
          if (parentId) {
            const parentHierarchy = await getHierarchy(parentId);
            const subMerchants =
              parentHierarchy?.config?.siblings?.sub_merchants ?? [];
            userIdFilter.push(
              ...(await fetchMerchantIds([
                ...new Set([parentId, ...subMerchants]),
              ])),
            );
          }
        }
        filters.merchant_id =
          userIdFilter.length === 1 ? userIdFilter[0] : userIdFilter;
      } else {
        const targetId = isOperations
          ? hierarchy?.config?.parent
          : userInfo.user_id;
        logger.info(`Fetching bank IDs for targetId: ${targetId}`);
        if (targetId) {
          const bankIds = await fetchBankIds(targetId);
          if (bankIds.length > 0) {
            userIdFilter.push(...bankIds);
            filters.bank_acc_id =
              userIdFilter.length === 1 ? userIdFilter[0] : userIdFilter;
          } else {
            logger.warn(
              `No PayIn bank accounts found for user_id: ${targetId}`,
            );
            filters.bank_acc_id = null; // Handle case with no bank accounts
          }
        } else {
          logger.warn(`No targetId available for PAYIN filtering`);
          filters.bank_acc_id = null;
        }
      }
    }

    // PAYOUT table
    if (tablename === tableName.PAYOUT) {
      if (userInfo.userRole === Role.MERCHANT) {
        userIdFilter = [userInfo.user_id];
        if (userInfo.designation === Role.MERCHANT) {
          const subMerchants = hierarchy?.config?.siblings?.sub_merchants ?? [];
          userIdFilter.push(
            ...(await fetchMerchantIds([...userIdFilter, ...subMerchants])),
          );
        } else if (userInfo.designation === Role.SUB_MERCHANT) {
          userIdFilter.push(...(await fetchMerchantIds([userInfo.user_id])));
        } else if (isOperations) {
          const parentId = hierarchy?.config?.parent;
          if (parentId) {
            const parentHierarchy = await getHierarchy(parentId);
            const subMerchants =
              parentHierarchy?.config?.siblings?.sub_merchants ?? [];
            userIdFilter.push(
              ...(await fetchMerchantIds([
                ...new Set([parentId, ...subMerchants]),
              ])),
            );
          }
        }
        filters.merchant_id =
          userIdFilter.length === 1 ? userIdFilter[0] : userIdFilter;
      } else {
        const targetId = isOperations
          ? hierarchy?.config?.parent
          : userInfo.user_id;
        if (targetId) userIdFilter.push(...(await fetchVendorIds([targetId])));
        filters.vendor_id =
          userIdFilter.length === 1 ? userIdFilter[0] : userIdFilter;
      }
    }

    // Beneficiary table
    if (tablename === tableName.BENEFICIARY_ACCOUNTS) {
      userIdFilter = isOperations
        ? [hierarchy?.config?.parent].filter(Boolean)
        : [userInfo.user_id];
      if (userInfo.userRole === Role.MERCHANT) {
        userIdFilter.push(
          ...(hierarchy?.config?.siblings?.sub_merchants ?? []),
        );
      } else if (userInfo.userRole === Role.VENDOR) {
        // const [adminRole] = await getRoleDao({ role: Role.ADMIN });
        const adminUser = await getUserByCompanyCreatedAtDao(
          company_id,
          Role.ADMIN,
        );
        userIdFilter.push(adminUser.id);
        filters['config->>is_enabled'] = 'true';
      }
      filters.user_id =
        userIdFilter.length === 1 ? userIdFilter[0] : userIdFilter;
    }

    // BANK_ACCOUNT table
    if (
      tablename === tableName.BANK_ACCOUNT &&
      userInfo.userRole === Role.VENDOR
    ) {
      userIdFilter = isOperations
        ? [hierarchy?.config?.parent].filter(Boolean)
        : [userInfo.user_id];
      filters.user_id =
        userIdFilter.length === 1 ? userIdFilter[0] : userIdFilter;
    }

    // MERCHANT_REPORT table
    if (
      tablename === tableName.CALCULATION &&
      userInfo.userRole === Role.MERCHANT
    ) {
      userIdFilter = [userInfo.user_id];
      if (userInfo.userRole === Role.MERCHANT) {
        userIdFilter.push(
          ...(hierarchy?.config?.siblings?.sub_merchants ?? []),
        );
      }
      filters.user_id =
        userIdFilter.length === 1 ? userIdFilter[0] : userIdFilter;
    }

    // VENDOR_REPORT table
    if (
      tablename === tableName.CALCULATION &&
      userInfo.userRole === Role.VENDOR
    ) {
      userIdFilter = isOperations
        ? [hierarchy?.config?.parent].filter(Boolean)
        : [userInfo.user_id];
      filters.user_id =
        userIdFilter.length === 1 ? userIdFilter[0] : userIdFilter;
    }

    let updated = false;
    let updatedPayin = false;
    if (filters?.updated) {
      updated = filters.updated;
      delete filters.updated;
    }
    if (filters?.updatedPayin) {
      updatedPayin = filters.updatedPayin;
      delete filters.updatedPayin;
    }
    return await getTotalCountDao(
      tablename,
      role,
      filters,
      updated,
      updatedPayin,
    );
  } catch (error) {
    logger.error(
      `Error in getTotalCountService for table ${tablename}:`,
      error,
    );
    throw error;;
  }
};
