import Joi from 'joi';

// Validation Schema for Creating a Vendor
const VALIDATE_VENDOR_SCHEMA = Joi.object({
  user_id: Joi.string()
    .guid({ version: ['uuidv4'] })
    .optional()
    .messages({
      'string.guid': 'User_ID must be a valid UUID',
      'any.required': 'User_ID is required',
    }),
  role_id: Joi.string()
    .guid({ version: ['uuidv4'] })
    .required()
    .messages({
      'string.guid': 'Role_ID must be a valid UUID',
      'any.required': 'Rokle_ID is required',
    }),
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
  code: Joi.string().min(1).max(255).required().messages({
    'string.min': 'Code must be at least 1 character long',
    'string.max': 'Code must be less than 255 characters long',
    'any.required': 'Code is required',
  }),
  payin_commission: Joi.number().min(0).required().messages({
    'number.min': 'Payin Commission must be a positive number',
    'any.required': 'Payin Commission is required',
  }),
  payout_commission: Joi.number().min(0).required().messages({
    'number.min': 'Payout Commission must be a positive number',
    'any.required': 'Payout Commission is required',
  }),
  balance: Joi.number().min(0).required().messages({
    'number.min': 'Balance must be a positive number',
    'any.required': 'Balance is required',
  }),
  config: Joi.object().default({}).optional().messages({
    'object.base': 'Config must be a valid object',
  }),
});

// Validation Schema for Updating a Vendor
const VALIDATE_UPDATE_VENDOR_STATUS = Joi.object({
  first_name: Joi.string().min(1).max(255).optional(),
  last_name: Joi.string().min(1).max(255).optional(),
  payin_commission: Joi.number().min(0).optional(),
  payout_commission: Joi.number().min(0).optional(),
  balance: Joi.number().min(0).optional(),
  config: Joi.object().optional(),
  is_obsolete: Joi.boolean().optional(),
  updated_by: Joi.string()
    .guid({ version: ['uuidv4'] })
    .optional()
    .messages({
      'string.guid': 'Updated By must be a valid UUID',
    }),
  updated_at: Joi.string().isoDate().optional().messages({
    'string.isoDate': 'Updated At must be a valid date in ISO 8601 format',
  }),
});

// Validation Schema for Deleting a Vendor
const VALIDATE_DELETE_VENDOR = Joi.object({
  id: Joi.string()
    .guid({ version: ['uuidv4'] })
    .label('id')
    .required(),
});

// Validation Schema for Getting a Vendor by ID
const VALIDATE_VENDOR_BY_ID = Joi.object({
  id: Joi.string()
    .guid({ version: ['uuidv4'] })
    .required()
    .messages({
      'string.guid': 'ID must be a valid UUID',
      'any.required': 'ID is required',
    }),
});

export {
  VALIDATE_VENDOR_BY_ID,
  VALIDATE_VENDOR_SCHEMA,
  VALIDATE_DELETE_VENDOR,
  VALIDATE_UPDATE_VENDOR_STATUS,
};
