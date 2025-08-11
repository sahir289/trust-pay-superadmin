import { sendSuccess } from '../../utils/responseHandlers.js';
import {
  getActiveUsersService,
  getPendingTransactionsService,
  getTransactionCalculationsService,
  getTransactionRatiosService,
} from './superAdminServices.js';

const getActiveUsers = async (req, res) => {
  const { company_id } = req.query;
  const data = await getActiveUsersService(company_id);
  sendSuccess(res, data, 'Dashboard stats fetched successfully');
};

const getPendingTransactions = async (req, res) => {
  const { company_id } = req.query;
  const data = await getPendingTransactionsService(company_id);
  sendSuccess(res, data, 'Pending transactions count fetched successfully');
};

const getTransactionCalculations = async (req, res) => {
  const { company_id } = req.query;
  const data = await getTransactionCalculationsService(company_id);
  sendSuccess(res, data, 'Transaction calculations fetched successfully');
};

const getTransactionRatios = async (req, res) => {
  const { company_id } = req.query;
  const data = await getTransactionRatiosService(company_id);
  sendSuccess(res, data, 'Transaction ratios fetched successfully');
};

export {
  getActiveUsers,
  getPendingTransactions,
  getTransactionCalculations,
  getTransactionRatios,
};
