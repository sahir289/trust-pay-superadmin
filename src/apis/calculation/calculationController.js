import { sendSuccess } from '../../utils/responseHandlers.js';
import {
  getCalculationService,
  createCalculationService,
  updateCalculationService,
  deleteCalculationService,
  calculateSuccessRatiosService,
} from './calculationService.js';
import { transactionWrapper } from '../../utils/db.js';
import {
  VALIDATE_CALCULATION_SCHEMA,
  VALIDATE_UPDATE_CALCULATION_STATUS,
} from '../../schemas/calculationSchema.js';
import { BadRequestError, ValidationError } from '../../utils/appErrors.js';
import { logger } from '../../utils/logger.js';
const getCalculationById = async (req, res) => {
  // Validate request parameters using Joi schema
  // const { role } = req.user;

  if (!req.params) {
    throw new BadRequestError('User_id Required');
  }
  const { user_id } = req.params;
  const { company_id, role } = req.user;
  const data = await getCalculationService(
    {
      user_id,
      company_id,
    },
    role,
  );
  // Respond with the calculation data
  return sendSuccess(res, data, 'Get Calculation successfully');
};

const getCalculation = async (req, res) => {
  // You can add additional validation here if needed, depending on the request
  const { company_id, user_id, designation, role } = req.user;
  const data = await getCalculationService(
    {
      company_id,
      user_id,
      designation,
      users: req.query.users,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
    },
    role,
  );
  return sendSuccess(res, data, 'Get Calculations successfully');
};

const createCalculation = async (req, res) => {
  const { role } = req.user;
  const { error } = VALIDATE_CALCULATION_SCHEMA.validate(req.body);
  if (error) {
    throw new ValidationError(error);
  }
  let payload = req.body;
  const { company_id } = req.user;
  // Validate the request body using Joi schema
  payload.company_id = company_id;
  if (!payload) {
    logger.error('payload is required');
    throw new BadRequestError('payload is required');
  }
  await transactionWrapper(createCalculationService)(payload, role);
  return sendSuccess(res, {}, 'Create Calculation successfully');
};

const updateCalculation = async (req, res) => {
  const { role } = req.user;

  // Validate the request body and params using Joi schema
  const { error: bodyError } = VALIDATE_UPDATE_CALCULATION_STATUS.validate(
    req.body,
  );
  if (!req.params) {
    throw new BadRequestError('id Required');
  }
  if (bodyError) {
    throw new ValidationError(bodyError);
  }
  const payload = req.body;
  const { id } = req.params;
  const { company_id } = req.user;
  const ids = { company_id, id };
  // Assuming the Payout ID is passed as a parameter
  // Call the service to update the Payout
  await transactionWrapper(updateCalculationService)(ids, payload, role);
  return sendSuccess(res, {}, 'Update Calculation successfully');
};

// const result = await transactionWrapper(updatePayoutService)(id, payload);
const deleteCalculation = async (req, res) => {
  const { role } = req.user;
  // Validate the request params using Joi schema
  if (!req.params) {
    throw new BadRequestError('id Required');
  }
  const { company_id } = req.user;
  const { id } = req.params;
  const ids = { id, company_id };
  await transactionWrapper(deleteCalculationService)(ids, role);
  return sendSuccess(res, {}, 'Delete Calculation successfully');
};

export const calculateSuccessRatios = async (req, res) => {
  try {
    const { date, user_ids } = req.body;

    if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
      throw new BadRequestError('user_ids array is required');
    }

    const data = await calculateSuccessRatiosService(date, user_ids);
    return sendSuccess(res, data, 'Success ratios fetched successfully');
  } catch (error) {
    logger.error('Error fetching success ratio data:', error);
    throw error;
  }
};

export {
  getCalculationById,
  getCalculation,
  createCalculation,
  updateCalculation,
  deleteCalculation,
};
