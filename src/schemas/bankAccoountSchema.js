import Joi from 'joi';

export const BANK_ACCOUNT_SCHEMA = Joi.object({
  user_id: Joi.string()
    .guid({ version: ['uuidv4'] })
    .label('user_id')
    .optional(),
  upi_id: Joi.string().label('upi_id').allow(null, '').optional(),
  upi_params: Joi.string().label('upi_params').optional(),
  nick_name: Joi.string().label('nick_name').optional(),
  acc_holder_name: Joi.string().label('acc_holder_name').optional(),
  acc_no: Joi.string().label('acc_no').optional(),
  ifsc: Joi.string().label('ifsc').optional(),
  bank_name: Joi.string().label('bank_name').optional(),
  updated_by: Joi.string().label('updated_by').optional(),
  is_bank: Joi.boolean().label('is_bank').optional(),
  min: Joi.number().min(1).label('min').optional(),
  max: Joi.number().min(1).label('max').optional(),
  is_enabled: Joi.boolean().label('is_enabled').optional(),
  is_phonepay: Joi.boolean().label('is_phonepay').optional(),
  is_intent: Joi.boolean().label('is_intent').optional(),
  is_qr: Joi.boolean().label('is_qr').optional(),
  payin_count: Joi.number().integer().min(0).label('payin_count').optional(),
  balance: Joi.number().label('balance').optional(),
  today_balance: Joi.number().label('today_balance').optional(),
  bank_used_for: Joi.string().label('bank_used_for').optional(),
  config: Joi.object().label('config').optional(),
  company_id: Joi.string().label('company_id').optional(),
});

export const UPDATE_BANK_ACCOUNT_SCHEMA = Joi.object({
  is_intent: Joi.boolean().label('is_intent').optional(),
  is_phonepay: Joi.boolean().label('is_phonepay').optional(),
  upi_id: Joi.string().label('upi_id').allow(null, '').optional(),
  upi_params: Joi.string().label('upi_params').optional().allow(''),
  nick_name: Joi.string().label('nick_name').optional(),
  acc_holder_name: Joi.string().label('acc_holder_name').optional(),
  acc_no: Joi.string().label('acc_no').optional(),
  ifsc: Joi.string().label('ifsc').optional(),
  bank_name: Joi.string().label('bank_name').optional(),
  is_qr: Joi.boolean().label('is_qr').optional(),
  is_bank: Joi.boolean().label('is_bank').optional(),
  min: Joi.number().min(1).label('min').optional(),
  max: Joi.number().min(1).label('max').optional(),
  is_enabled: Joi.boolean().label('is_enabled').optional(),
  payin_count: Joi.number().integer().min(0).label('payin_count').optional(),
  balance: Joi.number().label('balance').optional(),
  today_balance: Joi.number().label('today_balance').optional(),
  bank_used_for: Joi.string().label('bank_used_for').optional(),
  config: Joi.object().label('config').optional(),
});

export const VALIDATE_BANK_RESPONSE_BY_ID = Joi.string()
  .guid({ version: ['uuidv4'] })
  .optional()
  .messages({
    'string.guid': 'ID must be a valid UUID',
    'any.optional': 'ID is optional',
  });
