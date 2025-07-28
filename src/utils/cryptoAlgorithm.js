/* eslint-disable no-undef */
import crypto from 'crypto';
import config from '../config/config.js';

export const crypto512Algo = (
  x_api_key,
  payinId,
  merchant_order_id,
  amount,
) => {
  const salt = crypto.randomBytes(256).toString('hex');
  const hashString = `${x_api_key}|${payinId}|${merchant_order_id}|${amount}|${salt}`;
  return crypto.createHash('sha512').update(hashString).digest('hex');
};

export const createHashApiKey = () => {
  const publicKey = crypto.randomBytes(32).toString('hex');
  const secretKey = crypto.randomBytes(64).toString('hex');
  return { publicKey, secretKey };
};

export const generateSecureSignature = (
  x_api_key,
  payinId,
  merchant_order_id,
  secret_key,
) => {
  const timestamp = Math.floor(Date.now() / 1000);
  const payload = `${x_api_key}|${payinId}|${merchant_order_id}|${timestamp}`;
  const signature = crypto
    .createHmac('sha512', secret_key)
    .update(payload)
    .digest('hex');
  return { signature, timestamp };
};

export const verifySecureSignature = (
  x_api_key,
  payinId,
  merchant_order_id,
  signature,
  timestamp,
  secret_key,
) => {
  const now = Math.floor(Date.now() / 1000);
  if (now - timestamp > 300) return false; // 5-minute expiry
  const payload = `${x_api_key}|${payinId}|${merchant_order_id}|${timestamp}`;
  const expectedSignature = crypto
    .createHmac('sha512', secret_key)
    .update(payload)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature),
  );
};

export const generatePaymentUrlToken = (
  x_api_key,
  merchant_order_id,
  ot = 'n',
) => {
  const expiry = Math.floor(Date.now() / 1000) + 24 * 60 * 60; // 24 hour expiry but will update later depends on the need
  const payload = `${merchant_order_id}|${ot}|${expiry}`;
  const token = crypto
    .createHmac('sha512', x_api_key)
    .update(payload)
    .digest('hex');
  return {
    token,
    expiry,
    ot,
    url: `${config.reactPaymentOrigin}/transaction?merchant_order_id=${merchant_order_id}&token=${token}&expiry=${expiry}&ot=${ot}`,
  };
};
