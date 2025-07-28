import { stringifyJSON } from "./index.js";

class HTTPError extends Error {
  statusCode = 500;
  name = '';

  constructor(message) {
    let errorMessage = '';
    if (message instanceof Object) {
      try {
        errorMessage = stringifyJSON(message);
      } catch (err) {
        errorMessage = 'Could not stringify message: ' + err.message;
      }
    } else {
      errorMessage = message;
    }

    super(errorMessage);
    Error.captureStackTrace(this, this.constructor);
    this.name = this.constructor.name;
  }
}

class HTTPClientError extends HTTPError {}

class HTTPServerError extends HTTPError {}

class BadRequestError extends HTTPClientError {
  statusCode = 400;

  constructor(message = 'Bad request') {
    super(message);
  }
}

class AuthenticationError extends HTTPClientError {
  statusCode = 401;

  constructor(message = 'Authorization Error') {
    super(message);
  }
}

class AccessDeniedError extends HTTPClientError {
  statusCode = 401;

  constructor(message = 'Access denied') {
    super(message);
  }
}

class NotFoundError extends HTTPClientError {
  statusCode = 404;

  constructor(message = 'Not found') {
    super(message);
  }
}

class DuplicateDataError extends HTTPClientError {
  statusCode = 409;

  constructor(message = 'Conflict') {
    super(message);
  }
}

class InternalServerError extends HTTPServerError {
  statusCode = 500;

  constructor(message = 'Server encountered a problem') {
    super(message);
  }
}

class DbError extends HTTPServerError {
  statusCode = 502;

  constructor(message = 'Database error') {
    super(message);
  }
}

const parseValidationMessage = (errorDetails) => {
  const { details } = errorDetails;
  let errString = '';
  details.forEach((d) => {
    let msg = d.message;
    msg = msg.replace('"', '').replace('"', '');
    errString = errString ? `${errString}, ${msg}` : msg;
  });
  return errString;
};
class ValidationError extends BadRequestError {
  constructor(message) {
    super(parseValidationMessage(message));
  }
}

export class CustomError extends Error {
  constructor(status, message, additionalInfo) {
    super(message);
    this.status = status;
    this.message = message;
    this.additionalInfo = additionalInfo;
  }
}

export {
  HTTPError,
  HTTPClientError,
  HTTPServerError,
  BadRequestError,
  AuthenticationError,
  AccessDeniedError,
  NotFoundError,
  DuplicateDataError,
  DbError,
  InternalServerError,
  ValidationError,
};
