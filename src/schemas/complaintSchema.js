import Joi from 'joi';

// Validation Schema for Creating a Complaint
const VALIDATE_COMPLAINT_SCHEMA = Joi.object({
  status: Joi.string().required(),
  payin_id: Joi.string()
    .guid({ version: ['uuidv4'] })
    .required()
    .messages({
      'string.guid': 'Payin ID must be a valid UUID',
      'any.required': 'Payin ID is required',
    }),
  email: Joi.string().email().required().messages({
    'string.email': 'Email must be a valid email address',
    'any.required': 'Email is required',
  }),
  config: Joi.object().default({}).optional().messages({
    'object.base': 'Config must be a valid object',
  }),
});

// Validation Schema for Updating a Complaint
const VALIDATE_UPDATE_COMPLAINT_STATUS = Joi.object({
  status: Joi.string().valid().optional(),
  payin_id: Joi.string()
    .guid({ version: ['uuidv4'] })
    .optional(),
  email: Joi.string().email().optional(),
  config: Joi.object().optional(),
  updated_by: Joi.string().optional(),
});

// Validation Schema for Deleting a Complaint
const VALIDATE_DELETE_COMPLAINT = Joi.object({
  id: Joi.string()
    .guid({ version: ['uuidv4'] })
    .label('id')
    .required(),
});

// Validation Schema for Getting a Complaint by ID
const VALIDATE_COMPLAINT_BY_ID = Joi.object({
  id: Joi.string()
    .guid({ version: ['uuidv4'] })
    .required()
    .messages({
      'string.guid': 'ID must be a valid UUID',
      'any.required': 'ID is required',
    }),
});

export {
  VALIDATE_COMPLAINT_BY_ID,
  VALIDATE_COMPLAINT_SCHEMA,
  VALIDATE_DELETE_COMPLAINT,
  VALIDATE_UPDATE_COMPLAINT_STATUS,
};
