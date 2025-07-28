import Joi from 'joi';

// Validation Schema for Creating a Company
const VALIDATE_COMPANY_SCHEMA = Joi.object({
  first_name: Joi.string().min(1).max(255).required().messages({
    'string.min': 'First Name must be at least 1 character long',
    'string.max': 'First Name must be less than 255 characters long',
    'any.required': 'First Name is required',
  }),
  last_name: Joi.string().min(1).max(255).required().messages({
    'string.min': 'Last Name must be at least 1 character long',
    'string.max': 'Last Name must be less than 255 characters long',
    'any.required': 'Last Name is required',
  }),
  email: Joi.string().email().required().messages({
    'string.email': 'Email must be a valid email address',
    'any.required': 'Email is required',
  }),
  contact_no: Joi.string().min(10).max(15).required().messages({
    'string.min': 'Contact Number must be at least 10 characters long',
    'string.max': 'Contact Number must be less than 15 characters long',
    'any.required': 'Contact Number is required',
  }),
  user_name: Joi.string().min(1).max(255).optional(),
  code: Joi.string().min(1).max(255).optional(),
  config: Joi.object().default({}).messages({
    'object.base': 'Config must be a valid object',
  }),
});

// Validation Schema for Updating a Company
const VALIDATE_UPDATE_COMPANY_STATUS = Joi.object({
  first_name: Joi.string().min(1).max(255).optional(),
  last_name: Joi.string().min(1).max(255).optional(),
  email: Joi.string().email().optional(),
  contact_no: Joi.string().min(10).max(15).optional(),
  config: Joi.object().optional(),
});

// Validation Schema for Deleting a Company
const VALIDATE_DELETE_COMPANY = Joi.object({
  id: Joi.string()
    .guid({ version: ['uuidv4'] })
    .label('id')
    .required(),
});

// Validation Schema for Getting a Company by ID
const VALIDATE_COMPANY_BY_ID = Joi.object({
  id: Joi.string()
    .guid({ version: ['uuidv4'] })
    .required()
    .messages({
      'string.guid': 'ID must be a valid UUID',
      'any.required': 'ID is required',
    }),
});

export {
  VALIDATE_COMPANY_BY_ID,
  VALIDATE_COMPANY_SCHEMA,
  VALIDATE_DELETE_COMPANY,
  VALIDATE_UPDATE_COMPANY_STATUS,
};
