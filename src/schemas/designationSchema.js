import Joi from 'joi';

export const CREATE_DESIGNATION_SCHEMA = Joi.object({
  designation: Joi.string().label('designation').required(),
});

export const UPDATE_DESIGNATION_SCHEMA = Joi.object({
  designation: Joi.string().label('designation').required(),
});

export const VALIDATE_DESIGNATION_BY_ID = Joi.object({
  id: Joi.string()
    .guid({ version: ['uuidv4'] })
    .required()
    .messages({
      'string.guid': 'ID must be a valid UUID',
      'any.required': 'ID is required',
    }),
});
