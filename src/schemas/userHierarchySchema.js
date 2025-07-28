import Joi from 'joi';

// Validation Schema for Creating a UserHierarchy
const VALIDATE_USER_HIERARCHY_SCHEMA = Joi.object({
  role_id: Joi.string()
    .guid({ version: ['uuidv4'] })
    .label('role_id')
    .required(),
  user_id: Joi.string()
    .guid({ version: ['uuidv4'] })
    .label('user_id')
    .required(),
  config: Joi.object().default({}).optional().messages({
    'object.base': 'Config must be a valid object',
  }),
});

// Validation Schema for Updating a UserHierarchy
const VALIDATE_UPDATE_USER_HIERARCHY_STATUS = Joi.object({
  config: Joi.object().optional(),
  updated_by: Joi.string()
    .guid({ version: ['uuidv4'] })
    .optional()
    .messages({
      'string.guid': 'Updated By must be a valid UUID',
    }),
  is_obsolete: Joi.boolean().optional(),
  updated_at: Joi.string().isoDate().optional().messages({
    'string.isoDate': 'Updated At must be a valid date in ISO 8601 format',
  }),
});

// Validation Schema for Deleting a UserHierarchy
const VALIDATE_DELETE_USER_HIERARCHY = Joi.object({
  id: Joi.string()
    .guid({ version: ['uuidv4'] })
    .label('id')
    .required(),
});

// Validation Schema for Getting a UserHierarchy by ID
const VALIDATE_USER_HIERARCHY_BY_ID = Joi.object({
  id: Joi.string()
    .guid({ version: ['uuidv4'] })
    .required()
    .messages({
      'string.guid': 'ID must be a valid UUID',
      'any.required': 'ID is required',
    }),
});

export {
  VALIDATE_USER_HIERARCHY_BY_ID,
  VALIDATE_USER_HIERARCHY_SCHEMA,
  VALIDATE_DELETE_USER_HIERARCHY,
  VALIDATE_UPDATE_USER_HIERARCHY_STATUS,
};
