import Joi from 'joi';

export const BENEFICIARY_ACCOUNT_SCHEMA = Joi.object({
  user_id: Joi.string()
    .guid({ version: ['uuidv4'] })
    .label('user_id')
    .allow(null, '')
    .optional(),
  upi_id: Joi.string().label('upi_id').allow(null, '').optional(),
  type: Joi.string().allow(null, '').label('type').optional(),
  acc_holder_name: Joi.string().label('acc_holder_name').required(),
  acc_no: Joi.string().label('acc_no').required(),
  ifsc: Joi.string().label('ifsc').required(),
  bank_name: Joi.string().label('bank_name').required(),
  config: Joi.object().label('config').optional(),
  initial_balance: Joi.number().label('initial_balance').optional().default(0),
});

export const UPDATE_BENEFICIARY_ACCOUNT_SCHEMA = Joi.object({
  upi_id: Joi.string().label('upi_id').allow(null, '').optional(),
  acc_holder_name: Joi.string().label('acc_holder_name').optional(),
  acc_no: Joi.string().label('acc_no').optional(),
  ifsc: Joi.string().label('ifsc').optional(),
  bank_name: Joi.string().label('bank_name').optional(),
  config: Joi.object().label('config').optional(),
  user_id: Joi.string().label('user_id').optional(),
});

export const VALIDATE_BENEFICIARY_ACCOUNT_BY_ID = Joi.string()
  .required()
  .messages({
    'any.optional': 'ID is optional',
  });
