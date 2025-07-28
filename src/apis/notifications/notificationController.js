// import { transactionWrapper } from '../../utils/db.js';
// import { logger } from '../../utils/logger.js';
// import { sendError, sendSuccess } from '../../utils/responseHandlers.js';
// import {
//   createNotificationsService,
//   getNotificationByIdService,
//   getNotificationCountsService,
//   getNotificationsService,
//   updateNotificationsService,
// } from './notificationService.js';

// export const getNotifications = async (req, res) => {
//   const { user_id, company_id } = req.user || {};
//   const { limit, offset, cursor } = req.query;

//   // Parse and validate pagination parameters
//   const parsedLimit = limit ? parseInt(limit, 10) : 20;
//   const parsedOffset = offset ? parseInt(offset, 10) : undefined;
//   const parsedCursor = cursor ? String(cursor) : undefined;

//   if (isNaN(parsedLimit) || parsedLimit < 1) {
//     logger.warn('Invalid limit parameter', { limit });
//     return sendError(res, 400, 'Invalid limit parameter');
//   }
//   if (parsedOffset !== undefined && (isNaN(parsedOffset) || parsedOffset < 0)) {
//     logger.warn('Invalid offset parameter', { offset });
//     return sendError(res, 400, 'Invalid offset parameter');
//   }
//   // Accept ISO8601 timestamps with or without milliseconds and timezone
//   if (
//     parsedCursor !== undefined &&
//     !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.*$/.test(parsedCursor)
//   ) {
//     logger.warn('Invalid cursor parameter', { cursor });
//     return sendError(res, 400, 'Invalid cursor parameter');
//   }
//   if (parsedOffset !== undefined && parsedCursor !== undefined) {
//     logger.warn('Cannot use both offset and cursor', { offset, cursor });
//     return sendError(res, 400, 'Cannot use both offset and cursor');
//   }

//   // Fetch notifications
//   const result = await getNotificationsService(user_id, company_id, {
//     limit: parsedLimit,
//     offset: parsedOffset,
//     cursor: parsedCursor,
//   });

//   // Send response with notifications and pagination metadata
//   return sendSuccess(res, result, 'Notifications fetched successfully');
// };

// export const getNotificationCounts = async (req, res) => {
//   const { user_id, company_id } = req.user;
//   const notifications = await getNotificationCountsService(user_id, company_id);
//   return sendSuccess(
//     res,
//     notifications,
//     'Notifications Count fetched successfully',
//   );
// };

// export const getNotificationsById = async (req, res) => {
//   const { userId, company_id } = req.user;
//   const { id } = req.params;

//   const notifications = await getNotificationByIdService(
//     id,
//     userId,
//     company_id,
//   );
//   return sendSuccess(res, notifications, 'Notifications fetched successfully');
// };

// export const createNotifications = async (req, res) => {
//   const { user_id, company_id } = req.user;
//   const payload = req.body;
//   const recipient_ids = payload.recipient_ids || [];
//   delete payload.recipient_ids;
//    await transactionWrapper(createNotificationsService)(
//     payload,
//     user_id,
//     company_id,
//     recipient_ids,
//   );

//   return sendSuccess(res, {}, 'Notifications Created successfully');
// };

// export const updateNotifications = async (req, res) => {
//   const { user_id, company_id } = req.user;
//   const { id } = req.body;
//    await updateNotificationsService(
//     id,
//     user_id,
//     company_id,
//   );

//   return sendSuccess(res, {}, 'Notifications Updated successfully');
// };

// export const deleteNotifications = async (req, res) => {
//   const { userId, company_id } = req.user;
//   const payload = req.params;

//   await createNotificationsService(userId, company_id);
//   return sendSuccess(res, {}, 'Notifications Deleted successfully');
// };
