import Joi from 'joi';

// Validation Schema for Creating a Merchant
const VALIDATE_MERCHANT_SCHEMA = Joi.object({
  user_id: Joi.string()
    .guid({ version: ['uuidv4'] })
    .required()
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
  min_payin: Joi.number().min(0).required().messages({
    'number.min': 'Min Payin must be a positive number',
    'any.required': 'Min Payin is required',
  }),
  max_payin: Joi.number().min(0).required().messages({
    'number.min': 'Max Payin must be a positive number',
    'any.required': 'Max Payin is required',
  }),
  payin_commission: Joi.number().min(0).required().messages({
    'number.min': 'Payin Commission must be a positive number',
    'any.required': 'Payin Commission is required',
  }),
  min_payout: Joi.number().min(0).required().messages({
    'number.min': 'Min Payout must be a positive number',
    'any.required': 'Min Payout is required',
  }),
  max_payout: Joi.number().min(0).required().messages({
    'number.min': 'Max Payout must be a positive number',
    'any.required': 'Max Payout is required',
  }),
  payout_commission: Joi.number().min(0).required().messages({
    'number.min': 'Payout Commission must be a positive number',
    'any.required': 'Payout Commission is required',
  }),
  is_test_mode: Joi.boolean().default(false),
  is_enabled: Joi.boolean().default(true),
  dispute_enabled: Joi.boolean().default(true),
  is_demo: Joi.boolean().default(false),
  balance: Joi.number().min(0).required().messages({
    'number.min': 'Balance must be a positive number',
    'any.required': 'Balance is required',
  }),
  config: Joi.object().default({}).messages({
    'object.base': 'Config must be a valid object',
  }),
});

// Validation Schema for Updating a Merchant
const VALIDATE_UPDATE_MERCHANT_STATUS = Joi.object({
  first_name: Joi.string().min(1).max(255).optional(),
  last_name: Joi.string().min(1).max(255).optional(),
  min_payin: Joi.number().min(0).optional(),
  max_payin: Joi.number().min(0).optional(),
  payin_commission: Joi.number().min(0).optional(),
  min_payout: Joi.number().min(0).optional(),
  max_payout: Joi.number().min(0).optional(),
  payout_commission: Joi.number().min(0).optional(),
  is_test_mode: Joi.boolean().optional(),
  is_enabled: Joi.boolean().optional(),
  dispute_enabled: Joi.boolean().optional(),
  is_demo: Joi.boolean().optional(),
  balance: Joi.number().min(0).optional(),
  config: Joi.object().optional(),
  is_obsolete: Joi.boolean().optional(),
  whitelist_ips: Joi.string().allow('').optional(),
  updated_by: Joi.string()
    .guid({ version: ['uuidv4'] })
    .optional()
    .messages({
      'string.guid': 'Updated By must be a valid UUID',
    }),
  created_by: Joi.string()
    .guid({ version: ['uuidv4'] })
    .optional()
    .messages({
      'string.guid': 'Created By must be a valid UUID',
    }),
  created_at: Joi.string().isoDate().optional().messages({
    'string.isoDate': 'Created At must be a valid date in ISO 8601 format',
  }),
  updated_at: Joi.string().isoDate().optional().messages({
    'string.isoDate': 'Updated At must be a valid date in ISO 8601 format',
  }),
});

// Validation Schema for Deleting a Merchant
const VALIDATE_DELETE_MERCHANT = Joi.object({
  id: Joi.string()
    .guid({ version: ['uuidv4'] })
    .label('id')
    .required(),
});

// Validation Schema for Getting a Merchant by ID
const VALIDATE_MERCHANT_BY_ID = Joi.object({
  id: Joi.string()
    .guid({ version: ['uuidv4'] })
    .required()
    .messages({
      'string.guid': 'ID must be a valid UUID',
      'any.required': 'ID is required',
    }),
});

export {
  VALIDATE_MERCHANT_BY_ID,
  VALIDATE_MERCHANT_SCHEMA,
  VALIDATE_DELETE_MERCHANT,
  VALIDATE_UPDATE_MERCHANT_STATUS,
};
