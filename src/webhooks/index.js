import { updatePayInUrlDao } from '../apis/payIn/payInDao.js';
import { getPayInUrlService } from '../apis/payIn/payInService.js';
import { merchantPayinCallback } from '../callBacksAndWebHook/merchantCallBacks.js';
import { Status } from '../constants/index.js';
import { BadRequestError, NotFoundError } from '../utils/appErrors.js';

export const payInUpdateCashfreeWebhook = async (req, res) => {
  const payload = req.body;
  res.json({ status: 200, message: 'Cash free Webhook Called successfully' });
  const payInDataById = await getPayInUrlService(payload.data.order.order_id);
  if (!payInDataById) {
    throw new NotFoundError('Payment not found');
  }
  const durMs = new Date() - payInDataById.createdAt;
  const durSeconds = Math.floor((durMs / 1000) % 60)
    .toString()
    .padStart(2, '0');
  const durMinutes = Math.floor((durSeconds / 60) % 60)
    .toString()
    .padStart(2, '0');
  const durHours = Math.floor((durMinutes / 60) % 24)
    .toString()
    .padStart(2, '0');
  const duration = `${durHours}:${durMinutes}:${durSeconds}`;
  if (
    payload.data.payment.payment_status === Status.FAILED ||
    payload.data.payment.payment_status === Status.USER_DROPPED
  ) {
    throw new BadRequestError(
      `Payment Failed due to: ${payload.data.payment.payment_message}`,
    );
  }
  const payInData = {
    confirmed: payload.data.order.order_amount,
    amount: payload.data.order.order_amount,
    status:
      payload.data.payment.payment_status === Status.USER_DROPPED
        ? Status.DROPPED
        : payload.data.payment.payment_status,
    utr: payload.data.payment.bank_reference,
    user_submitted_utr: payload.data.payment.bank_reference,
    approved_at: new Date().toISOString(),
    is_url_expires: true,
    user_submitted_image: null,
    duration: duration,
    method: 'CashFree',
    is_notified: true,
  };
  const updatePayinRes = await updatePayInUrlDao(payInDataById.id, payInData);
  const notifyData = {
    status: updatePayinRes?.status,
    merchantOrderId: updatePayinRes?.merchant_order_id,
    payinId: payInDataById.id,
    amount: updatePayinRes?.confirmed,
    req_amount: updatePayinRes.amount,
    utr_id:
      updatePayinRes?.status === Status.SUCCESS ||
      updatePayinRes?.status === Status.DISPUTE
        ? updatePayinRes?.utr
        : '',
  };
  // This is async function but it's just the callback sending function there fore we are not using await
  merchantPayinCallback(updatePayinRes?.config?.notify_url, notifyData);
};
