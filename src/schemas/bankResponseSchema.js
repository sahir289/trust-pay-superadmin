import Joi from 'joi';

export const CREATE_BANK_RESPONSE_SCHEMA = Joi.object({
  body: Joi.string().required().label('body'),
});

export const UPDATE_BANK_RESPONSE_SCHEMA = Joi.object({
  amount: Joi.number().optional().label('amount'),
  utr: Joi.string().optional().label('utr'),
  is_used: Joi.boolean().optional().label('is_used'),
});

export const RESET_BANK_RESPONSE_SCHEMA = Joi.object({
  amount: Joi.alternatives()
    .try(Joi.number().strict(), Joi.string().allow('').optional())
    .optional(),
  utr: Joi.string().optional(),
  bank_id: Joi.string()
    .guid({ version: ['uuidv4'] })
    .optional(),
  is_used: Joi.boolean().optional(),
  updated_by: Joi.string().optional(),
  previousAmount: Joi.alternatives()
    .try(Joi.number().strict(), Joi.string().allow('').optional())
    .optional(),
});

export const VALIDATE_BANK_RESPONSE_BY_ID = Joi.object({
  id: Joi.string()
    .guid({ version: ['uuidv4'] })
    .required()
    .messages({
      'string.guid': 'ID must be a valid UUID',
      'any.required': 'ID is required',
    }),
});
export const VALIDATE_BANK_RESPONSE_QUERY = Joi.object({
  bank_id: Joi.string()
    .guid({ version: ['uuidv4'] })
    .required()
    .messages({
      'string.guid': 'Bank ID must be a valid UUID',
      'any.required': 'Bank ID is required',
    }),

  sno: Joi.number().integer().required().messages({
    'number.base': 'Sno must be a number',
    'any.required': 'Sno is required',
  }),

  status: Joi.string().required().messages({
    'string.base': 'Status must be a string',
    'any.required': 'Status is required',
  }),

  amount: Joi.number().integer().required().messages({
    'number.base': 'Amount must be a number',
    'any.required': 'Amount is required',
  }),

  utr: Joi.string().pattern(/^\d+$/).required().messages({
    'string.pattern.base': 'UTR must be a numeric string',
    'any.required': 'UTR is required',
  }),

  is_used: Joi.string().valid('Used', 'Unused').required().messages({
    'any.only': 'is_used must be either "Used" or "Unused"',
    'any.required': 'is_used is required',
  }),

  company_id: Joi.string()
    .guid({ version: ['uuidv4'] })
    .required()
    .messages({
      'string.guid': 'Company ID must be a valid UUID',
      'any.required': 'Company ID is required',
    }),
});

export const VALIDATE_BANK_RESPONSE_BY_BANK_ID = Joi.object({
  bank_id: Joi.string()
    .guid({ version: ['uuidv4', 'uuidv5', 'uuidv1'] })
    .required()
    .messages({
      'string.guid': 'ID must be a valid UUID',
      'any.required': 'ID is required',
    }),

  startDate: Joi.date().iso().optional().messages({
    'date.format': 'startDate must be in ISO format (YYYY-MM-DD)',
  }),

  endDate: Joi.date().iso().optional().messages({
    'date.format': 'endDate must be in ISO format (YYYY-MM-DD)',
  }),
});

export const IMPORT_BANK_RESPONSE_SCHEMA = Joi.object({
  bank_id: Joi.string().required(),
  file: Joi.object({
    key: Joi.string().required(),
  }).required(),
  fileType: Joi.string().required(),
});
