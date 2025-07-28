/* eslint-disable no-unused-vars */
// Import required functions and classes
import { updateBankaccountByIdDao } from '../apis/bankAccounts/bankaccountDao';
import { getMerchantsDao } from '../apis/merchants/merchantDao';
import { getPayoutsDao, updatePayoutDao } from '../apis/payOut/payOutDao';
import { NotFoundError } from '../utils/appErrors';
import { merchantPayoutCallback } from './merchantCallBacks';
import { Status } from '../constants';
import { logger } from '../utils/logger.js';

// Define the optimized ekoTransactionStatusCallback function
export const ekoTransactionStatusCallback = async (req, res) => {
  const payload = req.body;
  const tid = payload.tid;

  try {
    const singleWithdrawData = await getPayoutsDao({ id: tid });
    if (!singleWithdrawData) {
      return NotFoundError('Payment not found');
    }

    // Prepare the updated data object
    const updatedData = {
      status:
        payload.txstatus_desc.toUpperCase() === Status.SUCCESS
          ? payload.txstatus_desc.toUpperCase()
          : Status.REJECTED,
      amount: Number(payload.amount),
      utr_id: payload.tid ? String(payload.tid) : '',
      approved_at:
        payload.txstatus_desc.toUpperCase() === Status.SUCCESS
          ? payload.timestamp
          : null,
      rejected_at:
        payload.txstatus_desc.toUpperCase() !== Status.SUCCESS
          ? payload.timestamp
          : null,
    };

    const merchant = await getMerchantsDao(singleWithdrawData.merchant_id);
    const data = await updatePayoutDao(singleWithdrawData.id, updatedData);

    // Log the updated payout status
    logger.info('Payout Updated by Eko callback', {
      status: data.status,
    });

    // Update the bank account if 'from_bank' is present in the payload
    if (payload.from_bank) {
      await updateBankaccountByIdDao(
        data.from_bank,
        parseFloat(data.amount),
        payload.status,
      );
    }

    // Log the merchant payout URL
    const merchantPayoutUrl = merchant.payout_notify_url;

    // TODO: Implement the notification to the merchant's payout URL
    if (merchantPayoutUrl !== null) {
      await merchantPayoutCallback(merchantPayoutUrl, {
        code: merchant.code,
        merchantOrderId: singleWithdrawData.merchant_order_id,
        payoutId: singleWithdrawData.id,
        amount: singleWithdrawData.amount,
        status: payload.status,
        utr_id: payload.utr ? payload.utr : '',
      });
    }

    return data;
  } catch (err) {
    // Log any errors while updating the payout
    logger.error('getting error while updating payout', err);
  }
};
