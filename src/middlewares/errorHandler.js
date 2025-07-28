import { HTTPError, CustomError } from '../utils/appErrors.js';
import { logger } from '../utils/logger.js';

// eslint-disable-next-line no-unused-vars
const errorHandler = (error, req, res, next) => {
  logger.error(error);
  let statusCode = 500;
  const message = 'Server encountered a problem';
  let err = {
    message,
    statusCode,
  };

  if (error && error instanceof HTTPError) {
    statusCode = error.statusCode;
    err = {
      ...err,
      statusCode: error.statusCode,
      name: error.name,
      message: error.message,
    };
  } else if (error && error instanceof CustomError) {
    statusCode = error.statusCode || statusCode;
    err = {
      ...error,
      message: error.message || message,
    };
  } else if (error) {
    err = { ...error, message };
  }

  const finalRes = {};
  finalRes.error = { ...err };

  res.status(statusCode).json(finalRes);
};

export default errorHandler;
