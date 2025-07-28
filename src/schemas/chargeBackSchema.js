import Joi from 'joi';

// Validation Schema for Creating a ChargeBack
const VALIDATE_CHARGEBACK_SCHEMA = Joi.object({
  merchant_order_id: Joi.string().required().messages({
    'any.required': 'Merchant Order ID is required',
  }),
  amount: Joi.number().min(0).required().messages({
    'any.required': 'Amount is required',
  }),
  reference_date: Joi.date().required().messages({
    'any.required': 'Reference Date is required',
  }),
});

// Validation Schema for Updating a ChargeBack
const VALIDATE_UPDATE_CHARGEBACK_SCHEMA = Joi.object({
  user: Joi.string().optional(),
  merchant_user_id: Joi.string().optional(),
  vendor_user_id: Joi.string().optional(),
  payin_id: Joi.string().optional(),
  bank_acc_id: Joi.string().optional(),
  amount: Joi.number().min(0).optional(),
  when: Joi.date().optional(),
  created_by: Joi.string().optional(),
  updated_by: Joi.string().optional(),
  company_id: Joi.string()
    .guid({ version: ['uuidv4'] })
    .optional()
    .messages({
      'string.guid': 'Company ID must be a valid UUID',
    }),
  is_obsolete: Joi.boolean().optional(),
  config: Joi.object().optional(),
});

// Validation Schema for Deleting a ChargeBack
const VALIDATE_DELETE_CHARGEBACK = Joi.object({
  id: Joi.string()
    .guid({ version: ['uuidv4'] })
    .required()
    .messages({
      'string.guid': 'ChargeBack ID must be a valid UUID',
      'any.required': 'ChargeBack ID is required',
    }),
});

// Validation Schema for Getting a ChargeBack by ID
const VALIDATE_CHARGEBACK_BY_ID = Joi.object({
  id: Joi.string()
    .guid({ version: ['uuidv4'] })
    .required()
    .messages({
      'string.guid': 'ChargeBack ID must be a valid UUID',
      'any.required': 'ChargeBack ID is required',
    }),
});

export {
  VALIDATE_CHARGEBACK_BY_ID,
  VALIDATE_CHARGEBACK_SCHEMA,
  VALIDATE_DELETE_CHARGEBACK,
  VALIDATE_UPDATE_CHARGEBACK_SCHEMA,
};
