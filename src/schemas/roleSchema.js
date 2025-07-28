import Joi from 'joi';

// Validation Schema for Creating a Role
const VALIDATE_ROLE_SCHEMA = Joi.object({
  role: Joi.string().min(1).max(255).required().messages({
    'string.min': 'Role name must be at least 1 character long',
    'string.max': 'Role name must be less than 255 characters long',
    'any.required': 'Role name is required',
  }),
  config: Joi.object().optional().default({}).messages({
    'object.base': 'Config must be a valid object',
  }),
});
// Validation Schema for Updating a Role
const VALIDATE_UPDATE_ROLE_STATUS = Joi.object({
  role: Joi.string().min(1).max(255).optional(),
  is_obsolete: Joi.boolean().optional(),
  updated_by: Joi.string().optional(),
  config: Joi.object().optional(),
});

// Validation Schema for Deleting a Role
const VALIDATE_DELETE_ROLE = Joi.object({
  id: Joi.string()
    .guid({ version: ['uuidv4'] })
    .label('id')
    .required()
    .messages({
      'string.guid': 'ID must be a valid UUID',
      'any.required': 'ID is required',
    }),
});

// Validation Schema for Getting a Role by ID
const VALIDATE_ROLE_BY_ID = Joi.object({
  id: Joi.string()
    .guid({ version: ['uuidv4'] })
    .required()
    .messages({
      'string.guid': 'ID must be a valid UUID',
      'any.required': 'ID is required',
    }),
});

export {
  VALIDATE_ROLE_BY_ID,
  VALIDATE_ROLE_SCHEMA,
  VALIDATE_DELETE_ROLE,
  VALIDATE_UPDATE_ROLE_STATUS,
};
