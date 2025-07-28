import Joi from 'joi';

const WITHDRAW_BY_ID_SCHEMA = Joi.object({
  payInId: Joi.string().label('payInId').required(),
});

export { WITHDRAW_BY_ID_SCHEMA };
