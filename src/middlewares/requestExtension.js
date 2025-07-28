import { generateUUID } from '../utils/generateUUID.js';
import { logger } from '../utils/logger.js';

const methodNotFound = (req, res) => {
  logger.error('the url you are trying to reach is not hosted on our server');
  const err = new Error('Not Found');
  err.status = 404;
  res.status(err.status).json({
    type: 'error',
    message: 'the url you are trying to reach is not hosted on our server',
  });
  // next(err);
};

const addLogIdInRequest = (req, res, next) => {
  req.identifier = generateUUID();

  const logData = {
    Request_uuid: req.identifier,
    url: req.originalUrl,
    userAgent: req.headers['user-agent'],
    method: req.method,
    hostname: req.hostname,
    ip:
      req.headers['x-forwarded-for'] || req.ip || req.connection?.remoteAddress,
    body: req.body,
    query: req.query,
    params: req.params,
    timestamp: new Date().toISOString(),
  };

  if (req.originalUrl && !req.originalUrl.includes('/auth/')) {
    logData.body = req.body;
  } else {
    delete logData.body;
  }

  logger.log(logData);

  next();
};

export { methodNotFound, addLogIdInRequest };
