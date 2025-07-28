import Joi from 'joi';
import { BankTypes } from '../constants/index.js';

export const ASSIGN_PAYIN_SCHEMA = Joi.object({
  ot: Joi.string().label('ot').optional(),
  amount: Joi.number().positive().label('amount').optional(),
  code: Joi.string().label('code').required(),
  api_key: Joi.string().label('api_key').optional(),
  merchant_order_id: Joi.string().label('merchant_order_id').optional(),
  user_id: Joi.string().label('user_id').required(),
  key: Joi.string().label('key').optional(),
  hash_code: Joi.string().label('hash_code').optional(),
  returnUrl: Joi.string().label('returnUrl').optional(),
  notifyUrl: Joi.string().label('notifyUrl').optional(),
});

export const VALIDATE_PAYIN_SCHEMA = Joi.object({
  merchantOrderId: Joi.string().label('merchantOrderId').required(),
  oneTimeUsed: Joi.boolean().optional(),
});

export const VALIDATE_ASSIGNED_BANT_TO_PAY = Joi.object({
  merchantOrderId: Joi.string().label('merchantOrderId').required(),
  amount: Joi.number().positive().label('amount').required(),
  type: Joi.string()
    .valid(...Object.values(BankTypes))
    .label('type')
    .required(),
});

export const VALIDATE_EXPIRE_PAY_IN_URL = Joi.object({
  payInId: Joi.string()
    .guid({ version: ['uuidv4'] })
    .label('payInId')
    .required(),
});

export const VALIDATE_CHECK_PAY_IN_STATUS = Joi.object({
  payinId: Joi.string()
    .guid({ version: ['uuidv4'] })
    .label('payInId')
    .required(),
  merchantCode: Joi.string().label('merchantCode').required(),
  merchantOrderId: Joi.string().label('merchantOrderId').required(),
});

export const VALIDATE_PAY_IN_INTENT_GENERATE_ORDER = Joi.object({
  payInId: Joi.string()
    .guid({ version: ['uuidv4'] })
    .label('payInId')
    .required(),
  amount: Joi.number().positive().label('amount').required(),
  isRazorpay: Joi.boolean().label('isRazorpay').required(),
});
export const VALIDATE_UPDATE_PAYMENT_NOTIFICATION_STATUS = Joi.object({
  payInId: Joi.string()
    .guid({ version: ['uuidv4'] })
    .label('payInId')
    .required(),
  type: Joi.string().label('type').required(),
});

export const VALIDATE_UPDATE_DEPOSIT_SERVICE_STATUS = Joi.object({
  merchantOrderId: Joi.string().label('merchantOrderId').required(),
  nick_name: Joi.string().label('nick_name').required(),
});

export const VALIDATE_RESET_DEPOSIT = Joi.object({
  merchant_order_id: Joi.string().label('merchant_order_id').required(),
});
//schema for process payin
export const PROCESS_PAYIN_IMAGE = Joi.object({
  amount: Joi.number().label('amount').required(),
  file: Joi.object({
    key: Joi.string().required(),
  })
    .label('file')
    .required(),
});

export const VALIDATE_PROCESS_PAYIN = Joi.object({
  merchantOrderId: Joi.string().label('merchantOrderId').required(),
  userSubmittedUtr: Joi.string()
    .pattern(/^[A-Za-z0-9]*$/)
    .label('userSubmittedUtr')
    .required()
    .messages({
      'string.pattern.base':
        '"userSubmittedUtr" must contain only letters and numbers (no spaces)',
      'string.empty': '"userSubmittedUtr" is required',
    }),
  user_submitted_image: Joi.string(),
  amount: Joi.number().label('amount').min(1).required(),
  code: Joi.string().label('code').optional(),
});

export const VALIDATE_PROCESS_PAYIN_BY_IMAGE = Joi.object({
  file: Joi.any()
    .required()
    .meta({ type: 'file' })
    .description('Image file to be uploaded')
    .custom((value, helpers) => {
      const validMimeTypes = ['image/jpeg', 'image/png', 'image/gif'];
      if (!validMimeTypes.includes(value.mimetype)) {
        return helpers.error('file.invalidType', { value });
      }

      const maxSize = 5 * 1024 * 1024; // 5MB in bytes
      if (value.size > maxSize) {
        return helpers.error('file.tooLarge', { value });
      }

      return value;
    })
    .messages({
      'file.invalidType': 'File must be a valid image (jpeg, png, or gif)',
      'file.tooLarge': 'File size must not exceed 5MB',
      // 'any.required': 'File is required',
    }),
});

export const VALIDATE_DISPUTE_DUPLICATE_TRANSACTION = Joi.object({
  payInId: Joi.string()
    .guid({ version: ['uuidv4'] })
    .label('payInId')
    .required(),
  merchantOrderId: Joi.string().label('merchantOrderId').optional(),
  confirmed: Joi.number().min(1).label('confirmed').optional(),
  amount: Joi.number().min(1).label('amount').optional(),
});

export const VALIDATE_CHECK_UTR = Joi.object({
  utr: Joi.string().label('utr').required(),
  merchantOrderId: Joi.string().label('merchantOrderId').required(),
});

export const VALIDATE_UPDATE_PAYIN_SCHEMA = Joi.object({
  merchant_order_id: Joi.string().label('merchant_order_id').required(),
  amount: Joi.number().positive().label('amount').optional(),
  utr: Joi.string().label('utr').optional(),
  bank_acc_id: Joi.string().label('bank_id').optional(),
});
