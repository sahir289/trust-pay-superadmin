import Joi from 'joi';

export const CREATE_USER_SCHEMA = Joi.object({
  role_id: Joi.string()
    .guid({ version: ['uuidv4'] })
    .label('role_id')
    .required(),
  designation_id: Joi.string()
    .guid({ version: ['uuidv4'] })
    .label('designation_id')
    .required(),
  first_name: Joi.string().label('first_name').required(),
  last_name: Joi.string().label('last_name').required(),
  email: Joi.string().email().label('email').required(),
  contact_no: Joi.string()
    .pattern(/^\d{10,12}$/)
    .label('contact_no')
    .required(), // Allows 10-15 digit numbers
  user_name: Joi.string().label('user_name').required(),
  // password: Joi.string().label('password').required(),
  code: Joi.string().label('code').optional(),
  is_enabled: Joi.boolean().label('is_enabled').optional(),

  // Payin & Payout Configurations
  min_payin: Joi.number().min(0).label('min_payin').optional(),
  max_payin: Joi.number()
    .min(Joi.ref('min_payin'))
    .label('max_payin')
    .optional(),
  payin_commission: Joi.number()
    .min(0)
    .max(100)
    .label('payin_commission')
    .optional(),
  min_payout: Joi.number().min(0).label('min_payout').optional(),
  max_payout: Joi.number()
    .min(Joi.ref('min_payout'))
    .label('max_payout')
    .optional(),
  payout_commission: Joi.number()
    .min(0)
    .max(100)
    .label('payout_commission')
    .optional(),
  // Optional Fields
  payin_notify: Joi.string().uri().label('payin_notify').optional(),
  payout_notify: Joi.string().uri().label('payout_notify').optional(),
  return: Joi.string().uri().label('return').optional(),
  site: Joi.string().uri().label('site').optional(),
  config: Joi.object().label('config').optional(),
  parent_id: Joi.string().label('parent_id').optional(),
  whitelist_ips: Joi.string().label('whitelist_ips').optional(),
});

export const VALIDATE_USER_BY_ID = Joi.object({
  id: Joi.string()
    .guid({ version: ['uuidv4'] })
    .optional()
    .messages({
      'string.guid': 'ID must be a valid UUID',
      'any.optional': 'ID is optional',
    }),
});
