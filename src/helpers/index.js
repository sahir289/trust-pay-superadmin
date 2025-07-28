import axios from 'axios';
import config from '../config/config.js';
import { logoutSet } from '../middlewares/auth.js';
import { AuthenticationError } from '../utils/appErrors.js';
import { verifyToken } from '../utils/auth.js';
import { logger } from '../utils/logger.js';
import { BadRequestError } from '../utils/appErrors.js';
// Function to calculate balances based on role
export const calculateBalances = (
  calc,
  prevCalc,
  isMerchant,
  isReverse,
  amount = 0,
) => {
  const baseCalculation =
    calc.total_payin_amount -
    calc.total_payout_amount -
    (calc.total_payin_commission -
      calc.total_payout_commission +
      calc.total_reverse_payout_commission) -
    calc.total_chargeback_amount +
    calc.total_reverse_payout_amount;
  return {
    currentBalance: isMerchant
      ? isReverse
        ? baseCalculation - calc.total_settlement_amount
        : baseCalculation + calc.total_settlement_amount
      : isReverse
        ? baseCalculation + calc.total_settlement_amount
        : baseCalculation - calc.total_settlement_amount,

    netBalance:
      prevCalc.net_balance +
      (isMerchant
        ? isReverse
          ? +amount - calc.total_settlement_amount
          : -amount + calc.total_settlement_amount
        : isReverse
          ? +amount + calc.total_settlement_amount
          : -amount - calc.total_settlement_amount),
  };
};

export const calculateCommission = (amount, percentage) => {
  const numAmount = Number(amount);
  const percent = Number(percentage);
  return (numAmount * percent) / 100;
};

export const calculateTwoNumbers = (data1, data, operator) => {
  const numAmount = Number(data1);
  const numAmount1 = Number(data);
  if (isNaN(numAmount)) {
    throw new BadRequestError('Invalid first amount');
  }
  if (isNaN(numAmount1)) {
    throw new BadRequestError('Invalid second amount');
  }
  if (operator === '+') {
    return numAmount + numAmount1;
  } else if (operator === '-') {
    return numAmount - numAmount1;
  } else if (operator === '/') {
    return numAmount / numAmount1;
  } else {
    throw new BadRequestError('Invalid operator. Use "+" or "-"');
  }
};

export const calculateDuration = (createdAt) => {
  const durMs = new Date() - new Date(createdAt);
  const durSeconds = Math.floor((durMs / 1000) % 60)
    .toString()
    .padStart(2, '0');
  const durMinutes = Math.floor((durMs / (1000 * 60)) % 60)
    .toString()
    .padStart(2, '0');
  const durHours = Math.floor((durMs / (1000 * 60 * 60)) % 24)
    .toString()
    .padStart(2, '0');
  const duration = `${durHours}:${durMinutes}:${durSeconds}`;
  return duration;
};

export const getTelegramFilePath = async (fileId) => {
  if (!fileId) {
    logger.error('No telegram photo file id found!');
    return;
  }

  if (!config.telegramOcrBotToken) {
    logger.error('Telegram Bot Token not foun!');
    return;
  }

  const url = `https://api.telegram.org/bot${config.telegramOcrBotToken}/getFile?file_id=${fileId}`;
  const res = await axios.get(url);
  return res.data.result.file_path;
};

export const getTelegramImageBase64 = async (filePath) => {
  if (!filePath) {
    logger.error('No telegram photo file path found!');
    return;
  }

  if (!config.telegramOcrBotToken) {
    logger.error('Telegram Bot Token not foun!');
    return;
  }
  const url = `https://api.telegram.org/file/bot${config.telegramOcrBotToken}/${filePath}`;
  const res = await axios.get(url, {
    responseType: 'arraybuffer',
  });

  return globalThis.Buffer.from(res.data, 'binary').toString('base64');
};

export const getImageContentFromOCr = async (image) => {
  if (!image) {
    logger.log('No image provided for OCR!');
    return;
  }

  const res = await axios.post(`${config.ocr.url}`, {
    image,
  });

  if (res.data.status === 'failure') {
    logger.log('Unable to get content from image with ocr', res.data);
    return;
  }

  const data = res.data?.data || {};

  return {
    amount: data.amount?.replace(',', ''),
    utr: data.transaction_id,
    bankName: data.bank_name,
    timeStamp: data.timestamp,
  };
};

// Helper function to convert a readable stream to a buffer
export const streamToBase64 = (readableStream) => {
  return new Promise((resolve, reject) => {
    const chunks = [];
    readableStream.on('data', (chunk) => chunks.push(chunk));
    readableStream.on('end', () => {
      const buffer = globalThis.Buffer.concat(chunks);
      const base64 = buffer.toString('base64');
      resolve(base64);
    });
    readableStream.on('error', reject);
  });
};

export async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  const buffer = globalThis.Buffer.concat(chunks);
  return buffer;
}

// export const filterResponse = async (data, key) => {
//     if (typeof data === 'object' && data !== null && key in data) {
//         logger.log({[key]: data[key]},"datakey1")

//       return { [key]: data[key] };
//     }
//     return {};
//   }

export const filterResponse = (data, keys) => {
  if (Array.isArray(data)) {
    logger.log('Data is an array');

    return data.map((item) => {
      const filteredItem = {};
      keys.forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(item, key)) {
          filteredItem[key] = item[key];
        } else {
          logger.error(item, key, 'Key not found in object');
        }
      });
      return filteredItem;
    });
  } else if (typeof data === 'object' && data !== null) {
    logger.error('Data is an object');

    const filteredItem = {};
    keys.forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        filteredItem[key] = data[key];
      } else {
        logger.error('Key not found in object');
      }
    });
    return filteredItem;
  } else {
    logger.error('Data is neither an array nor an object');
    return null;
  }
};

export const decodeAuthToken = (token) => {
  if (!token) {
    return {};
  }

  if (logoutSet.has(token)) {
    throw new AuthenticationError('Token expired or User logged out.');
  }

  return verifyToken(token);
};
