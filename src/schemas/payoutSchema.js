import Joi from 'joi';

export const PAYOUT_DETAILS_SCHEMA = Joi.object({
  ifsc_code: Joi.string().label('ifsc_code').required(),
  method: Joi.string().label('method').optional(),
  bank_acc_id: Joi.string().label('bank_acc_id').optional(),
  reason: Joi.string().label('reason').optional(),
  user_id: Joi.string().label('user_id').optional(),
  user: Joi.string().label('user').optional(),
  code: Joi.string().label('code').required(),
  acc_holder_name: Joi.string().label('acc_holder_name').required(),
  acc_no: Joi.string().label('acc_no').required(),
  bank_name: Joi.string().label('bank_name').required(),
  amount: Joi.number().label('amount').required(),
  utr_id: Joi.string().label('utr_id').optional(),
  merchant_order_id: Joi.string().label('merchant_order_id').optional(),
  notifyUrl: Joi.string().uri().label('notify_url').optional(),
});

export const WALLET_PAYOUT_DETAILS_SCHEMA = Joi.object({
  amount: Joi.number().label('amount').required(),
  mode: Joi.string().label('transaction_type').required(),
  payOutids: Joi.array()
    .items(Joi.string().guid({ version: ['uuidv4'] }))
    .label('payOutids')
    .required(),
});

export const UPDATE_DETAILS_SCHEMA = Joi.object({
  user: Joi.string().label('user').optional(),
  amount: Joi.number().label('amount').optional(),
  status: Joi.string().label('status').optional(),
  currency: Joi.string().length(3).label('currency').optional(),
  acc_no: Joi.string().length(10).label('acc_no').optional(),
  acc_holder_name: Joi.string().label('acc_holder_name').optional(),
  ifsc_code: Joi.string().label('ifsc_code').optional(),
  bank_name: Joi.string().label('bank_name').optional(),
  bank_acc_id: Joi.string().label('bank_acc_id').optional(),
  upi_id: Joi.string().email().label('upi_id').optional(), // UPI ID could be in email format
  utr_id: Joi.string().label('utr_id').optional(),
  is_enable: Joi.boolean().label('is_enable').default(true), // `is_enable` should be a boolean
  rejected_reason: Joi.string().label('rejected_reason').optional(),
  payout_merchant_commission: Joi.number()
    .label('payout_merchant_commission')
    .optional(),
  payout_vendor_commission: Joi.number()
    .label('payout_vendor_commission')
    .optional(),
  approved_at: Joi.date().iso().label('approved_at').optional(),
  rejected_at: Joi.date().iso().allow(null).label('rejected_at'), // Allow null if rejected_at is null
  config: Joi.object({
    notify_url: Joi.string().uri().label('notify_url').optional(),
    method: Joi.string().label('method').optional(),
    rejected_reason: Joi.string().label('rejected_reason').optional(),
  })
    .label('config')
    .optional(),
  updated_by: Joi.string().label('updated_by').optional(),
  is_obsolete: Joi.boolean().label('is_obsolete').optional(),
  vendor_id: Joi.alternatives()
    .try(Joi.string(), Joi.valid(null))
    .label('vendor_id')
    .optional(),
});
export const ASSIGNED_VENDOR_SCHEMA = Joi.object({
  payouts_ids: Joi.array()
    .items(
      Joi.string().uuid({ version: ['uuidv4'] }),
    )
    .optional(), 
});

export const VALIDATE_PAYOUT_BY_ID = Joi.object({
  id: Joi.string()
    .guid({ version: ['uuidv4'] })
    .required()
    .messages({
      'string.guid': 'ID must be a valid UUID',
      'any.required': 'ID is required',
    }),
});

export const VALIDATE_CHECK_PAY_OUT_STATUS = Joi.object({
  payoutId: Joi.string()
    .guid({ version: ['uuidv4'] })
    .label('payOutId')
    .optional(),
  merchantCode: Joi.string().label('merchantCode').required(),
  merchantOrderId: Joi.string().label('merchantOrderId').required(),
});
