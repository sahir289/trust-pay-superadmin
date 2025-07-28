import Joi from 'joi';

// Validation Schema for Creating a Calculation
const VALIDATE_CALCULATION_SCHEMA = Joi.object({
  role_id: Joi.string()
    .guid({ version: ['uuidv4'] })
    .label('role_id')
    .required(),
  user_id: Joi.string()
    .guid({ version: ['uuidv4'] })
    .label('user_id')
    .required(),
  total_payin_count: Joi.number().integer().min(0).default(0),
  total_payin_amount: Joi.number().min(0).default(0),
  total_payin_commission: Joi.number().min(0).default(0),
  total_payout_count: Joi.number().integer().min(0).default(0),
  total_payout_amount: Joi.number().min(0).default(0),
  total_payout_commission: Joi.number().min(0).default(0),
  total_settlement_count: Joi.number().integer().min(0).default(0),
  total_settlement_amount: Joi.number().min(0).default(0),
  total_chargeback_count: Joi.number().integer().min(0).default(0),
  total_chargeback_amount: Joi.number().min(0).default(0),
  current_balance: Joi.number().min(0).default(0),
  net_balance: Joi.number().min(0).default(0),
  config: Joi.object().optional().default({}),
});

// Validation Schema for Updating a Calculation
const VALIDATE_UPDATE_CALCULATION_STATUS = Joi.object({
  is_obsolete: Joi.boolean().optional(),
  total_payin_count: Joi.number().integer().min(0).optional(),
  total_payin_amount: Joi.number().min(0).optional(),
  total_payin_commission: Joi.number().min(0).optional(),
  total_payout_count: Joi.number().integer().min(0).optional(),
  total_payout_amount: Joi.number().min(0).optional(),
  total_payout_commission: Joi.number().min(0).optional(),
  total_settlement_count: Joi.number().integer().min(0).optional(),
  total_settlement_amount: Joi.number().min(0).optional(),
  total_chargeback_count: Joi.number().integer().min(0).optional(),
  total_chargeback_amount: Joi.number().min(0).optional(),
  current_balance: Joi.number().min(0).optional(),
  net_balance: Joi.number().min(0).optional(),
  config: Joi.object().optional(),
});

// Validation Schema for Deleting a Calculation
const VALIDATE_DELETE_CALCULATION = Joi.object({
  id: Joi.string()
    .guid({ version: ['uuidv4'] })
    .label('id')
    .required(),
});

// Validation Schema for Getting a Calculation by User ID
const VALIDATE_CALCULATION_BY_USER_ID = Joi.object({
  id: Joi.string()
    .guid({ version: ['uuidv4'] })
    .required()
    .messages({
      'string.guid': 'ID must be a valid UUID',
      'any.required': 'ID is required',
    }),
});

export {
  VALIDATE_CALCULATION_BY_USER_ID,
  VALIDATE_CALCULATION_SCHEMA,
  VALIDATE_DELETE_CALCULATION,
  VALIDATE_UPDATE_CALCULATION_STATUS,
};
