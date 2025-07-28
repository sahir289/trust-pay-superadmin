import { logger } from './logger.js';

const sendSuccess = (
  res,
  Data = {},
  message = '',
  status = 200,
  total,
  page,
) => {
  let finalRes = {
    error: {},
    meta: {},
    data: {},
  };

  if (message) {
    finalRes.meta.message = message;
  }
  if (Data) {
    finalRes.data = Data;
  }
  if (total) {
    finalRes = { ...finalRes, total };
  }
  if (page) {
    finalRes = { ...finalRes, page };
  }
  if (res.req.method != 'GET') {
    logger.info(message, { status, data: finalRes.data });
  } else {
    logger.info(message, { status });
  }
  return res.status(status).json(finalRes);
};

const sendNewSuccess = (res, Data = {}, message = '', status = 200) => {
  const finalRes = {
    message: message || '',
    statusCode: status,
    data: Data || {},
  };
  logger.info(message, { status, data: finalRes.data });
  return res.status(200).json(finalRes);
};

const sendError = (res, message, statusCode) => {
  const error = {
    error: {
      additionalInfo: {},
      level: 'info',
      timestamp: new Date().toISOString(),
    },
  };

  if (message) {
    error.error.message = message;
  }
  if (statusCode) {
    error.error.status = statusCode;
  }
  logger.error(error);
  return res.status(statusCode).json(error);
};

export { sendSuccess, sendError, sendNewSuccess };
