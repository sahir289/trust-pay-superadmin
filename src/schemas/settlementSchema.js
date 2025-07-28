import Joi from 'joi';

export const CREATE_SETTLEMENT_SCHEMA = Joi.object({
  user_id: Joi.string()
    .guid({ version: ['uuidv4'] })
    .label('user_id')
    .optional(),
  merchant: Joi.string().label('merchant').optional(),
  status: Joi.string().label('status').optional(),
  //added fields
  amount: Joi.number().label('amount').optional(),
  utr: Joi.string().label('utr').optional(),
  method: Joi.string().label('method').optional(),
  bank_name: Joi.string().label('bank_name').optional(),
  acc_holder_name: Joi.string().label('acc_holder_name').optional(),
  acc_no: Joi.string().label('acc_no').optional(),
  bank_id: Joi.string().label('bank_name').optional(),
  ifsc: Joi.string().label('ifsc').optional(),
  created_by: Joi.string().label('created_by').optional(),
  updated_by: Joi.string().label('updated_by').optional(),
  //---allow description for cash / AED settlements
  description: Joi.string().label('description').optional(),
  // --allow wallet balance for crypto
  wallet_balance: Joi.string().label('wallet_balance').optional(),
  config: Joi.object({
    reference_id: Joi.string().label('reference_id').optional(),
    debit_credit: Joi.string()
      .valid('RECEIVED', 'SENT')
      .label('debit_credit')
      .optional(),
  })
    .label('config')
    .optional(),
  company_id: Joi.string().label('company_id').optional(),
});

export const UPDATE_SETTLEMENT_SCHEMA = Joi.object({
  user_id: Joi.string()
    .guid({ version: ['uuidv4'] })
    .label('user_id')
    .optional(),
  amount: Joi.number().label('amount').optional(),
  status: Joi.string().label('status').optional(),
  method: Joi.string().label('method').optional(),
  created_by: Joi.string().label('created_by').optional(),
  company_id: Joi.string().label('company_id').optional(),
  updated_by: Joi.string().label('updated_by').optional(),
  config: Joi.object({
    reference_id: Joi.string().allow('').label('reference_id').optional(),
    wallet_balance: Joi.string().allow('').label('wallet_balance').optional(),
    rejected_reason: Joi.string().allow('').label('rejected_reason').optional(),
    ifsc: Joi.string().allow('').label('ifsc').optional(),
    utr: Joi.string().label('utr').optional(), //-- allow adding in config
    amount: Joi.number().label('amount').optional(), //-- allow adding in config
    acc_no: Joi.string().allow('').label('acc_no').optional(), // --sent as string
    acc_holder_name: Joi.string().allow('').label('acc_holder_name').optional(),
    bank_name: Joi.string().allow('').label('bank_name').optional(),
    bank_id: Joi.string().label('bank_name').optional(),
    beneficiary_bank_name: Joi.string()
      .allow('')
      .label('beneficiary_bank_name')
      .optional(),
    description: Joi.string().label('description').optional(), //-- allow adding in config
    debit_credit: Joi.string()
      .valid('RECEIVED', 'SENT')
      .label('debit_credit')
      .optional(),
  })
    .label('config')
    .optional(),
});

export const VALIDATE_SETTLEMENT_BY_ID = Joi.object({
  id: Joi.string()
    .guid({ version: ['uuidv4'] })
    .optional()
    .messages({
      'string.guid': 'ID must be a valid UUID',
      'any.optional': 'ID is optional',
    }),
});

export const VALIDATE_SETTLEMENT_BY_ID_DELETE = Joi.string()
  .guid({ version: ['uuidv4'] })
  .optional()
  .messages({
    'string.guid': 'ID must be a valid UUID',
    'any.optional': 'ID is optional',
  });
