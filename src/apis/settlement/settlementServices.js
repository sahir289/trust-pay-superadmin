import {
  BadRequestError,
  InternalServerError,
  NotFoundError,
} from '../../utils/appErrors.js';
import {
  createSettlementDao,
  deleteSettlementDao,
  getSettlementDao,
  updateSettlementDao,
  getSettlementsBySearchDao,
} from './settlementDao.js';
import {
  getCalculationforCronDao,
  updateCalculationBalanceDao,
  updateCalculationDao
} from '../calculation/calculationDao.js';
import {
  getMerchantsDao,
} from '../merchants/merchantDao.js';
import {
  columns,
  merchantColumns,
  Role,
  Status,
  vendorColumns,
} from '../../constants/index.js';
import { logger } from '../../utils/logger.js';
import { getUserHierarchysDao } from '../userHierarchy/userHierarchyDao.js';
import {
  getBankResponseByUTR,
  getInternalBankResponseByUTR,
  updateBankResponseDao,
} from '../bankResponse/bankResponseDao.js';
import { getVendorsDao } from '../vendors/vendorDao.js';
import { calculateCommission } from '../../utils/calculation.js';
import { checkLockEdit } from '../../utils/advisoryLock.js';
// import { notifyAdminsAndUsers } from '../../utils/notifyUsers.js';
// import { getUsersDao } from '../users/userDao.js';
import {
  getBeneficiaryAccountDao,
  updateBeneficiaryAccountDao,
} from '../beneficiaryAccounts/beneficiaryAccountDao.js';

const getSettlementServiceById = async (ids) => {
  try {
    const filterColumns =
      ids.role === Role.MERCHANT
        ? merchantColumns.SETTLEMENT
        : ids.role === Role.VENDOR
          ? vendorColumns.SETTLEMENT
          : columns.SETTLEMENT;
    return await getSettlementDao(
      { id: ids.id, company_id: ids.company_id },
      null,
      null,
      null,
      null,
      filterColumns,
    );
  } catch (error) {
    logger.error('error getting while  getting settlements', error);
    throw error;
  }
};

const getSettlementService = async (
  ids,
  filters,
  page,
  limit,
  sortBy,
  sortOrder,
  role,
  user_id,
  designation,
) => {
  try {
    // Validate required parameters
    if (!ids?.company_id) {
      throw new BadRequestError('Company ID is required');
    }

    // Determine column selection based on role
    const filterColumns = (() => {
      switch (ids.role) {
        case Role.MERCHANT:
          return merchantColumns.SETTLEMENT;
        case Role.VENDOR:
          return vendorColumns.SETTLEMENT;
        default:
          return columns.SETTLEMENT;
      }
    })();

    if (role == Role.MERCHANT && designation != Role.MERCHANT_OPERATIONS) {
      filters.user_id = [user_id];
    }
    if (role == Role.VENDOR && designation != Role.VENDOR_OPERATIONS) {
      filters.user_id = [user_id];
    }
    if (role === Role.MERCHANT) {
      // if (userHierarchys || userHierarchys.length > 0) {
      //   const userHierarchy = userHierarchys[0];
      //   if (
      //     userHierarchy?.config ||
      //     Array.isArray(userHierarchy?.config?.siblings?.sub_merchants)
      //   ) {
      //     filters.user_id = [
      //       ...filters.user_id,
      //       ...(userHierarchy?.config?.siblings?.sub_merchants ?? []),
      //     ];
      //   }
      // }
      if (designation === Role.MERCHANT_OPERATIONS) {
        const userHierarchys = await getUserHierarchysDao({ user_id });
        if (userHierarchys || userHierarchys.length > 0) {
          const userHierarchy = userHierarchys[0];
          if (userHierarchy?.config?.parent) {
            filters.user_id = [userHierarchy?.config?.parent ?? null];
          }
        }
      }
    } else if (role === Role.VENDOR) {
      if (designation === Role.VENDOR_OPERATIONS) {
        const userHierarchys = await getUserHierarchysDao({ user_id });
        if (userHierarchys || userHierarchys.length > 0) {
          const userHierarchy = userHierarchys[0];
          if (userHierarchy?.config?.parent) {
            filters.user_id = [userHierarchy?.config?.parent ?? null];
          }
        }
      }
    }
    // Prepare filter object, ensuring all properties are included
    const daoFilters = {
      company_id: ids.company_id,
      ...(ids.role_name && { role: ids.role_name }),
      ...filters,
    };

    // Call DAO with validated parameters
    const settlementData = await getSettlementDao(
      daoFilters,
      page,
      limit,
      sortBy || 'sno',
      sortOrder || 'DESC',
      filterColumns,
    );

    return settlementData;
  } catch (error) {
    logger.error('Error in getSettlementService:', error);
    throw error;
  }
};

const getSettlementsBySearchService = async (
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

    delete filters.search;
    if (searchTerms.length === 0) {
      throw new BadRequestError('Please provide valid search terms');
    }
    const offset = (pageNum - 1) * limitNum;

    const filterColumns =
      role === Role.MERCHANT
        ? merchantColumns.SETTLEMENT
        : role === Role.VENDOR
          ? vendorColumns.SETTLEMENT
          : columns.SETTLEMENT;

    if (role == Role.MERCHANT) {
      filters.user_id = [user_id];
    }
    if (role == Role.VENDOR) {
      filters.user_id = [user_id];
    }

    if (role === Role.MERCHANT || designation === Role.MERCHANT_OPERATIONS) {
      const userHierarchys = await getUserHierarchysDao({ user_id });
      if (userHierarchys || userHierarchys.length > 0) {
        const userHierarchy = userHierarchys[0];

        if (
          userHierarchy?.config ||
          Array.isArray(userHierarchy?.config?.siblings?.sub_merchants)
        ) {
          filters.user_id = [
            ...filters.user_id,
            ...(userHierarchy?.config?.siblings?.sub_merchants ?? []),
          ];
        }
      }
      if (designation === Role.MERCHANT_OPERATIONS) {
        if (userHierarchys || userHierarchys.length > 0) {
          const userHierarchy = userHierarchys[0];

          if (userHierarchy?.config?.parent) {
            filters.user_id = [userHierarchy?.config?.parent ?? null];
          }
        }
      }
    } else if (role === Role.VENDOR) {
      if (designation === Role.VENDOR_OPERATIONS) {
        const userHierarchys = await getUserHierarchysDao({ user_id });
        if (userHierarchys || userHierarchys.length > 0) {
          const userHierarchy = userHierarchys[0];

          if (userHierarchy?.config?.parent) {
            filters.user_id = [userHierarchy?.config?.parent ?? null];
          }
        }
      }
    }

    const data = await getSettlementsBySearchDao(
      filters,
      searchTerms,
      limitNum,
      offset,
      filterColumns,
      role,
    );

    return data;
  } catch (error) {
    logger.error('Error while fetching chargeback by search', error);
    throw error;
  }
};

const createSettlementService = async (conn, payload) => {
  try {
    if (
      payload.method === 'INTERNAL_QR_TRANSFER' ||
      payload.method === 'INTERNAL_BANK_TRANSFER'
    ) {
      const bankResponses = await getBankResponseByUTR(
        payload?.config?.reference_id,
      );
      if (!bankResponses) {
        throw new NotFoundError('Bank response not found for the provided UTR');
      }

      if (
        bankResponses.is_used === false &&
        bankResponses.status === Status.BOT
      ) {
        // Get vendor and calculation data
        const [vendorData, calculationData] = await Promise.all([
          getVendorsDao({ user_id: payload.user_id }),
          getCalculationforCronDao(payload.user_id),
        ]);
        if (!vendorData?.length) {
          throw new NotFoundError('Vendor not found');
        }
        if (!calculationData?.length) {
          throw new NotFoundError('Calculation data not found');
        }

        const VendorCommission = vendorData[0].payin_commission || 0;
        const commission = calculateCommission(
          payload.amount,
          VendorCommission,
        );

        // Update vendor balance - Fix: Pass number instead of object
        // const vendorAcc = vendorData[0].balance + payload.amount;
        // await updateVendorBalanceDao(
        //   { id: vendorData[0].id },
        //   Number(vendorAcc),
        //   payload.updated_by,
        //   conn,
        // );

        await updateBankResponseDao(
          { id: bankResponses.id },
          { status: '/internalTransfer' },
        );
        // Update calculation
        const updatedCalculation = {
          total_settlement_count: 1,
          total_settlement_amount: -payload.amount,
          total_settlement_commission: commission,
          current_balance: -payload.amount + commission,
          net_balance: -payload.amount + commission,
        };

        await updateCalculationBalanceDao(
          { id: calculationData[0].id },
          updatedCalculation,
          conn,
        );
     const InternalSettlementConfig = {
          total_internalSettlement_amount:
            calculationData[0].config.total_internalSettlement_amount > 0
              ? calculationData[0].config.total_internalSettlement_amount +
                payload.amount
              : payload.amount,
          total_internalSettlement_count:
            calculationData[0].config.total_internalSettlement_count > 0
              ? calculationData[0].config.total_internalSettlement_count + 1
              : 1,
          total_internalSettlement_commission:
            calculationData[0].config.total_internalSettlement_commission > 0
              ? calculationData[0].config.total_internalSettlement_commission +
                commission
              : commission,
        };
      await updateCalculationDao({id: calculationData[0].id},{config:InternalSettlementConfig},conn);
        payload.status = Status.SUCCESS;
        return await createSettlementDao(payload,conn);
      }

      throw new BadRequestError('UTR is already used');
    }
    // For other methods, proceed with settlement creation
    // const [user] = await getUsersDao({ id: payload.user_id });
    // await notifyAdminsAndUsers({
    //   conn,
    //   company_id: payload.company_id,
    //   message: `Settlement for Client: ${user.code} has been created.`,
    //   payloadUserId: payload.user_id,
    //   actorUserId: payload.user_id,
    //   category: 'Settlement',
    // });
    const adjustedValue =
    payload.config.debit_credit === 'RECEIVED'
      ? Number(payload.amount) > 0
        ? -Number(payload.amount)
        : Number(payload.amount)
      : Math.abs(Number(payload.amount));
    payload.amount = adjustedValue;
    return await createSettlementDao(payload);
  } catch (error) {
    logger.error('Error while creating Settlement', error);
    throw new InternalServerError(
      error.message || 'Failed to create settlement',
    );
  }
};

const updateSettlementService = async (conn, ids, payload) => {
  try {
    await checkLockEdit(conn, ids.id);
    payload.config = payload.config || {};
    const data = await getSettlementDao(
      {
        id: ids.id,
        company_id: ids.company_id,
      },
      null,
      null,
      null,
      null,
    );

    //getting error reference_id undefined fixed when approving settlement
    if (
      payload.config.reference_id !== undefined &&
      data[0]?.config?.reference_id === payload.config.reference_id &&
      (payload.config.reference_id !== '' || !payload.config.rejected_reason)
    ) {
      throw new BadRequestError(`UTR already exists`);
    }
    const calculationData = await getCalculationforCronDao(data[0].user_id);

    if (payload.config.reference_id) {
      payload.status = Status.SUCCESS;
      payload.approved_at = new Date();
      if (!data) {
        throw new InternalServerError('no data found');
      }
      let updatedCalculation;
      const merchant_data = await getMerchantsDao({
        user_id: data[0].user_id,
      });
      if (merchant_data.length > 0) {
        if (Array.isArray(calculationData) && calculationData.length > 0) {
          const amount = payload?.amount || 0;
          // calcultion for merchant APPROVE settlement
          updatedCalculation = {
            total_settlement_count: 1,
            total_settlement_amount: amount,
            current_balance: -amount,
            net_balance: -amount,
          };
        }
      } else {
        if (Array.isArray(calculationData) && calculationData.length > 0) {
          const amount = payload?.amount || 0;
          // calcution for vendor APPROVE settlement
          updatedCalculation = {
            total_settlement_count: 1,
            total_settlement_amount: amount,
            current_balance: amount,
            net_balance: amount,
          };
        }
      }

      //if calculation data not exists dont update
      if (calculationData.length > 0) {
        const { id } = calculationData[0];
        await updateCalculationBalanceDao({ id }, updatedCalculation, conn);
      }
      // const merchantData = await getMerchantsDao(
      //   { user_id: data[0].user_id },
      //   null,
      //   null,
      //   null,
      //   null,
      // );

      if (data[0].role === Role.VENDOR) {
        // const vendorData = await getVendorsDao({ user_id: data[0].user_id });
        if (data[0].method === 'BANK') {
          const [beneficiaryAcc] = await getBeneficiaryAccountDao({
            user_id: data[0].config.bank_id,
          });

          let beneficiaryClosingBalance;
          if (
            payload?.config?.debit_credit &&
            payload?.config?.debit_credit === 'send'
          ) {
            beneficiaryClosingBalance =
              beneficiaryAcc.config?.closing_balance - payload?.amount;
          } else {
            beneficiaryClosingBalance =
              beneficiaryAcc.config?.closing_balance + payload?.amount;
          }

          const beneficiaryUpdatedConfig = {
            ...beneficiaryAcc.config,
            closing_balance: beneficiaryClosingBalance,
          };
          await updateBeneficiaryAccountDao(
            { id: beneficiaryAcc.id, company_id: beneficiaryAcc.company_id },
            beneficiaryUpdatedConfig,
            conn,
            false,
          );

          payload.config = {
            ...payload.config,
            beneficiary_initial_balance: beneficiaryAcc.config?.closing_balance,
            beneficiary_closing_balance: beneficiaryClosingBalance,
          };
        }
      }
        // const vendorBalance = vendorData[0].balance - payload?.amount;

        // await updateVendorBalanceDao(
        //   { id: vendorData[0].id },
        //   { balance: vendorBalance },
        //   payload.user_id,
        //   conn,
        // );
      // } else if (data[0].role === Role.MERCHANT) {
      //   // const merchantAcc = merchantData[0].balance - payload?.amount;
      //   // await updateMerchantDao(
      //   //   { id: merchantData[0].id },
      //   //   { balance: merchantAcc },
      //   //   conn,
      //   // );
      // }
    }

    if (payload.config.rejected_reason) {
      payload.status = Status.REJECTED;
      payload.rejected_at = new Date();
    }

    if (payload.status === Status.INITIATED) {
      const merchant_data = await getMerchantsDao({
        user_id: data[0].user_id,
      });
      if (merchant_data.length > 0) {
        // payload.config.reference_id = '';
        // payload.config.rejected_reason = '';
        payload.status = Status.REVERSED;
        payload.rejected_at = new Date();
        let updatedCalculation;
        const amount = payload?.amount || 0;

        // calcultion for merchant rejected Settlement

        updatedCalculation = {
          total_settlement_count: 1,
          total_settlement_amount: -amount,
          current_balance: amount,
          net_balance: amount,
        };
        //if calculation data not exists dont update
        if (calculationData.length > 0) {
          const { id } = calculationData[0];
          await updateCalculationBalanceDao({ id }, updatedCalculation, conn);
        }
      } else {
        // calcution for vendor rejected Settlement
        // payload.config.reference_id = '';
        // payload.config.rejected_reason = '';
        payload.status = Status.REVERSED;
        payload.rejected_at = new Date();
        let updatedCalculation;
        const amount = payload?.amount || 0;
        if (
          data[0].method === 'INTERNAL_QR_TRANSFER' ||
          data[0].method === 'INTERNAL_BANK_TRANSFER'
        ) {
          payload.status = Status.REVERSED;
          payload.rejected_at = new Date();
          const [vendorData, calculationData] = await Promise.all([
            getVendorsDao({ user_id: data[0].user_id }),
            getCalculationforCronDao(data[0].user_id),
          ]);
          if (!vendorData?.length) {
            throw new NotFoundError('Vendor not found');
          }
          if (!calculationData?.length) {
            throw new NotFoundError('Calculation data not found');
          }
          const bankResponses = await getInternalBankResponseByUTR(
            data[0]?.config?.reference_id,
          );
          if (!bankResponses) {
            throw new NotFoundError(
              'Bank response not found for the provided UTR',
            );
          }
          if (bankResponses.is_used === true) {
            throw new BadRequestError('UTR is already used');
          }
          await updateBankResponseDao(
            { id: bankResponses.id },
            { status: '/success' },
            conn,
          );
          const VendorCommission = vendorData[0].payin_commission || 0;
          const commission = calculateCommission(
            payload.amount,
            VendorCommission,
          );
          const InternalSettlementConfig = {
            total_internalSettlement_amount:
              calculationData[0].config.total_internalSettlement_amount > 0
                ? calculationData[0].config.total_internalSettlement_amount -
                  payload.amount
                : -payload.amount,
            total_internalSettlement_count:
              calculationData[0].config.total_internalSettlement_count > 0
                ? calculationData[0].config.total_internalSettlement_count - 1
                : -1,
            total_internalSettlement_commission:
              calculationData[0].config.total_internalSettlement_commission > 0
                ? calculationData[0].config
                    .total_internalSettlement_commission - commission
                : -commission,
          };
          await updateCalculationDao(
            { id: calculationData[0].id },
            { config: InternalSettlementConfig },
            conn,
          );
          // Update vendor balance - Fix: Pass number instead of object
          // const vendorAcc = vendorData[0].balance + payload.amount;
          // await updateVendorBalanceDao(
          //   { id: vendorData[0].id },
          //   Number(vendorAcc),
          //   payload.updated_by,
          //   conn,
          // );

          updatedCalculation = {
            total_settlement_count: 1,
            total_settlement_commission: -commission,
            total_settlement_amount: amount,
            current_balance: amount - commission,
            net_balance: amount - commission,
          };
        } else {
          if (data[0].role === Role.VENDOR && data[0].method === 'BANK') {
            const [beneficiaryAcc] = await getBeneficiaryAccountDao({
              user_id: data[0].config.bank_id,
            });
            let beneficiaryClosingBalance;
            if (
              data?.config?.debit_credit &&
              data?.config?.debit_credit === 'send'
            ) {
              beneficiaryClosingBalance =
                beneficiaryAcc?.config?.closing_balance + payload?.amount;
            } else {
              beneficiaryClosingBalance =
                beneficiaryAcc?.config?.closing_balance - payload?.amount;
            }
            const beneficiaryUpdatedConfig = {
              ...beneficiaryAcc?.config,
              closing_balance: beneficiaryClosingBalance,
            };
            await updateBeneficiaryAccountDao(
              { id: beneficiaryAcc.id, company_id: beneficiaryAcc.company_id },
              beneficiaryUpdatedConfig,
              conn,
              false,
            );

            if (
              data?.congig?.debit_credit &&
              data?.config?.debit_credit === 'send'
            ) {
              payload.config = {
                ...data.config,
                beneficiary_closing_balance:
                  data.config?.closing_balance + payload?.amount,
              };
            } else {
              payload.config = {
                ...data.config,
                beneficiary_initial_balance:
                  data.config?.initial_balance - payload?.amount === 0
                    ? data.config?.initial_balance
                    : Number(data.config?.initial_balance) -
                      Number(payload?.amount),
                beneficiary_closing_balance:
                  Number(data.config?.closing_balance) -
                  Number(payload?.amount),
              };
            }
          }

          updatedCalculation = {
            total_settlement_count: 1,
            total_settlement_amount: -amount,
            current_balance: -amount,
            net_balance: -amount,
          };
        }
        //if calculation data not exists dont update
        if (calculationData.length > 0) {
          const { id } = calculationData[0];
          await updateCalculationBalanceDao({ id }, updatedCalculation, conn);
        }
      }
    }
    if (payload.status) {
      if (
        data[0].status === Status.REJECTED &&
        payload.status === Status.SUCCESS
      ) {
        throw new BadRequestError(
          'Cannot change payout status from rejected to approved',
        );
      }
      // if(
      //   data[0].status === Status.SUCCESS &&
      //   payload.status === Status.REJECTED &&
      //   data[0].method !== 'INTERNAL_QR_TRANSFER' &&
      //   data[0].method !== 'INTERNAL_BANK_TRANSFER'
      // ) {
      //   throw new BadRequestError(
      //     'Cannot change payout status from approved to rejected',
      //   );
      // }
      if (payload.status === data[0].status) {
        throw new BadRequestError(
          'Payout status cannot be updated to the same value',
        );
      }
    }
    const updateData = await updateSettlementDao(
      conn,
      { id: ids.id, company_id: ids.company_id },
      payload,
    );
    // await notifyAdminsAndUsers({
    //   conn,
    //   company_id: ids.company_id,
    //   message: `Settlement for Client: ${data[0].code} has been updated.`,
    //   payloadUserId: payload.user_id,
    //   actorUserId: payload.user_id,
    //   category: 'Settlement',
    // });
    return updateData;
  } catch (error) {
    logger.error('Error while updating Settlement', 'error', error);
    throw error;
  }
};

const deleteSettlementService = async (conn, ids) => {
  try {
    const updatedData = await deleteSettlementDao(
      conn,
      { id: ids.id, company_id: ids.company_id },
      { is_obsolete: true, updated_by: ids.user_id },
    );
    return updatedData;
  } catch (error) {
    logger.error('error getting while deleting settlement', error);
    throw error;
  }
};

export {
  getSettlementService,
  createSettlementService,
  getSettlementServiceById,
  updateSettlementService,
  deleteSettlementService,
  getSettlementsBySearchService,
};
