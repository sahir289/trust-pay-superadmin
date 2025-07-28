import { pingDao } from './pingDao.js';

const pingService = async (req, res) => {
  return await pingDao(req, res);
};

export { pingService };
