import { sendSuccess } from '../../utils/responseHandlers.js';
import { getTotalCountService } from './commonService.js';

export const getTotalCount = async (req, res) => {
  const { tableName } = req.params;
  const { role } = req.query;
  const { filters } = req.query;
  const { role: userRole, designation, user_id, company_id } = req.user;
  const userInfo = { userRole, designation, user_id };
  if (filters === undefined) {
    const count = await getTotalCountService(
      tableName,
      role,
      { company_id },
      userInfo,
    );
    return sendSuccess(
      res,
      { count },
      `Total count for ${tableName} retrieved successfully`,
    );
  }
  const filtersObject = decodeURIComponent(filters);
  let filter = JSON.parse(filtersObject);
  const fiterId = { ...filter, company_id };
  const count = await getTotalCountService(tableName, role, fiterId, userInfo);
  return sendSuccess(
    res,
    { count },
    `Total count for ${tableName} retrieved successfully`,
  );
};
