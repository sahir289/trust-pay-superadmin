import dayjs from 'dayjs';
import { getBankaccountDao } from '../bankAccounts/bankaccountDao.js';
import { getMerchantsDaoArray } from '../merchants/merchantDao.js';
import { getVendorsDaoArray } from '../vendors/vendorDao.js';
import {
  getMerchantReportDao,
  getPayInMerchantReportDao,
  getPayInVendorReportDao,
  getPayOutMerchantReportDao,
  getPayOutVendorReportDao,
  getVendorReportDao,
} from './reportsDao.js';
import { getUserHierarchysDao } from '../userHierarchy/userHierarchyDao.js';
import { getDesignationDao } from '../designation/designationDao.js';
import { getUsersDao } from '../users/userDao.js';
import { Role } from '../../constants/index.js';
import { logger } from '../../utils/logger.js';

const getPayInReportService = async (req) => {
  try {
    const { company_id, role } = req.user;
    const { code, startDate, endDate, status, updatedPayin } = req.query;
    let startDateTime, endDateTime;
    if (startDate && endDate) {
      startDateTime = dayjs
        .tz(`${startDate} 00:00:00`, 'Asia/Kolkata')
        .toISOString();
      endDateTime = dayjs
        .tz(`${endDate} 23:59:59.999`, 'Asia/Kolkata')
        .toISOString();
    }
    const codes = code.split(',');
    let merchantIds = [];
    let vendorIds = [];
    let bankIds = [];
    let result;
    const merchantDetails = await getMerchantsDaoArray(company_id, codes);
    merchantIds = merchantDetails.map((merchant) => merchant.id);
    if (merchantIds.length > 0) {
      result = await getPayInMerchantReportDao(
        merchantIds,
        startDateTime,
        endDateTime,
        company_id,
        role,
        status,
        updatedPayin
      );
    } else {
      const vendorDetails = await getVendorsDaoArray(company_id, codes);
      bankIds = vendorDetails.map((banks) => banks.user_id);
      const bankDetails = await getBankaccountDao({ user_id: bankIds });
      vendorIds = bankDetails.map((merchant) => merchant.id);
      result = await getPayInVendorReportDao(
        vendorIds,
        startDateTime,
        endDateTime,
        company_id,
        role,
        status,
        updatedPayin
      );
    }
    return result;
  } catch (error) {
    logger.error('Error while fetching report', error);
    // Handle and rethrow errors with appropriate context
    throw error;
  }
};

const getPayOutReportService = async (req) => {
  try {
    const { company_id, role } = req.user;
    const { code, startDate, endDate, status } = req.query;
    const startDateTime = dayjs
      .tz(`${startDate} 00:00:00`, 'Asia/Kolkata')
      .toISOString();
    const endDateTime = dayjs
      .tz(`${endDate} 23:59:59.999`, 'Asia/Kolkata')
      .toISOString();

    const codes = code.split(',');
    let merchantIds = [];
    let vendorIds = [];
    let result;
    const merchantDetails = await getMerchantsDaoArray(company_id, codes);
    merchantIds = merchantDetails.map((merchant) => merchant.id);
    if (merchantIds.length > 0) {
      result = await getPayOutMerchantReportDao(
        merchantIds,
        startDateTime,
        endDateTime,
        company_id,
        role,
        status,
      );
    } else {
      const vendorDetails = await getVendorsDaoArray(company_id, codes);
      vendorIds = vendorDetails.map((merchant) => merchant.id);
      result = await getPayOutVendorReportDao(
        vendorIds,
        startDateTime,
        endDateTime,
        company_id,
        role,
        status,
      );
    }
    return result;
  } catch (error) {
    logger.error('Error while fetching report', error);
    throw error;
  }
};

const getClientsAccountReportService = async (req) => {
  try {
    const { company_id, role } = req.user;
    const { code, startDate, endDate, role_name, page, limit } = req.query;

    let result;
    let subMerchants = [];
    let userHierarchy = [];
    let userIds =
      typeof code === 'string'
        ? code.split(',').map((id) => id.trim())
        : Array.isArray(code)
          ? code
          : [code];

    if (role_name === Role.MERCHANT) {
      const user = await getUsersDao({ company_id, id: userIds });
      const designation = await getDesignationDao({
        id: user[0]?.designation_id,
      });
      if (designation[0]?.designation === Role.MERCHANT) {
        try {
          userHierarchy = await getUserHierarchysDao({ user_id: userIds });
          subMerchants = userHierarchy
            .filter((h) => Array.isArray(h?.config?.siblings?.sub_merchants))
            .flatMap((h) => h.config.siblings.sub_merchants);
          if (subMerchants.length > 0) {
            userIds = [...new Set([...userIds, ...subMerchants])];
          }
        } catch (error) {
          logger.error('Error fetching user hierarchy:', error);
        }
      }

      // Fetch parent and child data WITHOUT pagination to ensure proper merging
      const parentData = await getMerchantReportDao(
        company_id,
        typeof code === 'string'
          ? code.split(',').map((id) => id.trim())
          : Array.isArray(code)
            ? code
            : [code],
        startDate,
        endDate,
        null, // Remove page parameter
        null, // Remove limit parameter  
        role,
      );
      let childData = [];
      if (subMerchants.length > 0) {
        childData = await getMerchantReportDao(
          company_id,
          subMerchants,
          startDate,
          endDate,
          null, // Remove page parameter
          null, // Remove limit parameter
          role,
        );
      }

      if (Array.isArray(parentData)) {
        // Normalize date to avoid timestamp mismatches
        const normalizeDate = (date) =>
          dayjs.tz(date, 'Asia/Kolkata').format('YYYY-MM-DD');

        // Fetch user_id for parent codes if not in parentData
        const parentCodes = parentData.map((p) => p.code);
        const parentUsers = await getUsersDao({ company_id, id: parentCodes });
        const codeToUserIdMap = {};
        parentUsers.forEach((u) => {
          codeToUserIdMap[u.id] = u.id; // Assuming u.id is user_id
        });

        // Create a map for parent data by user_id and normalized created_at
        const parentMap = {};
        parentData.forEach((parent) => {
          const userId = parent.calculation_user_id;
          const key = `${userId}_${normalizeDate(parent.created_at)}`;
          parentMap[key] = {
            ...parent,
            created_at: normalizeDate(parent.created_at),
            user_id: userId,
          };
        });

        // Sum child data into parent using userHierarchy for mapping
        if (
          Array.isArray(childData) &&
          Array.isArray(userHierarchy) &&
          childData.length > 0
        ) {
          // Build child-to-parent mapping from userHierarchy with case-insensitive keys
          const childToParentMap = {};
          const validParentUserIds = new Set(Object.values(codeToUserIdMap));
          userHierarchy.forEach((h) => {
            const parentUserId = h.user_id;
            const subMerchantsArr = Array.isArray(
              h?.config?.siblings?.sub_merchants,
            )
              ? h.config.siblings.sub_merchants
              : [];
            subMerchantsArr.forEach((childCode) => {
              childToParentMap[childCode] = parentUserId;
            });
          });

          childData.forEach((child) => {
            // Map child to parent user_id using childToParentMap, case-insensitive
            const childCodeNormalized = child.calculation_user_id;
            let mappedParentUserId = childToParentMap[childCodeNormalized];

            // Fallback to child.parent_code if available and valid
            if (
              !mappedParentUserId &&
              child.parent_code &&
              validParentUserIds.has(child.parent_code)
            ) {
              mappedParentUserId = child.parent_code;
            }

            if (!mappedParentUserId) {
              logger.warn(
                `Skipping child code ${child.code} (normalized: ${childCodeNormalized}) due to no valid parent user_id in childToParentMap or parent_code`,
              );
              return; // Skip unmapped children
            }

            const parentKey = `${mappedParentUserId}_${normalizeDate(child.created_at)}`;
            let parentEntry = parentMap[parentKey];

            if (!parentEntry) {
              // Create a default parent entry only if mappedParentUserId is valid
              if (validParentUserIds.has(mappedParentUserId)) {
                // Find the corresponding code for the user_id
                const parentCode =
                  Object.keys(codeToUserIdMap).find(
                    (code) => codeToUserIdMap[code] === mappedParentUserId,
                  ) || mappedParentUserId;
                parentEntry = {
                  code: parentCode,
                  created_at: normalizeDate(child.created_at),
                  user_id: mappedParentUserId,
                };
                parentMap[parentKey] = parentEntry;
              } else {
                logger.warn(
                  `No valid parent found for child code ${child.code} (mapped to user_id ${mappedParentUserId}) with created_at ${child.created_at}`,
                );
                return; // Skip if user_id is not in parentData
              }
            }

            Object.keys(child).forEach((key) => {
              if (
                key !== 'code' &&
                key !== 'parent_code' &&
                key !== 'created_at' &&
                !isNaN(parseFloat(child[key]))
              ) {
                parentEntry[key] =
                  (parentEntry[key] || 0) + parseFloat(child[key]);
              }
            });
            parentMap[parentKey] = parentEntry; // Update parentMap
          });
        } else {
          logger.warn('childData or userHierarchy is empty or not an array:', {
            childData,
            userHierarchy,
          });
        }

        result = Object.values(parentMap)
          .map(({ ...rest }) => rest)
          .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

        // Apply pagination to the final aggregated result
        if (page && limit) {
          const pageNum = parseInt(page);
          const limitNum = parseInt(limit);
          const startIndex = (pageNum - 1) * limitNum;
          const endIndex = startIndex + limitNum;
          result = result.slice(startIndex, endIndex);
        }
      } else {
        result = [];
        logger.warn('parentData is not an array:', parentData);
      }
    } else {
      result = await getVendorReportDao(
        company_id,
        userIds,
        startDate,
        endDate,
        page,
        limit,
        role,
      );
    }

    return result;
  } catch (error) {
    logger.error('Error while fetching report', error);
    // Handle and rethrow errors with appropriate context
    throw error;
  }
};

export {
  getPayInReportService,
  getPayOutReportService,
  getClientsAccountReportService,
};
