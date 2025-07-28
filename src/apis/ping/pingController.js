import { sendSuccess } from '../../utils/responseHandlers.js';
import { pingService } from './pingService.js';

const pingController = async (req, res) => {
  const data = await pingService(req, res);
  return sendSuccess(res, data);
};

export { pingController };
