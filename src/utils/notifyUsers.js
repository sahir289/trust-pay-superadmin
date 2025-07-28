// // Update the import path below if the file location is different
// import { getAdminUserIdsDao } from "../apis/users/userDao.js";
// import { createNotificationsService } from "../apis/notifications/notificationService.js";

// export async function notifyAdminsAndUsers({
//   conn,
//   company_id,
//   message,
//   payloadUserId,
//   actorUserId,
//   category,
//   subCategory = null,
//   additionalRecipients = [],
//   role,
// }) {
//   // Fetch admin user IDs for the company
//   const adminUsers = await getAdminUserIdsDao(company_id);
//   const adminUserIds = Array.isArray(adminUsers)
//     ? adminUsers.map(user => user.id)
//     : [];

//   // Build unique recipient list
//   const recipientUsers = Array.from(
//     new Set([
//       ...adminUserIds,
//       ...payloadUserId,
//       actorUserId,
//       ...additionalRecipients,
//     ].filter(id => id !== null && id !== undefined))
//   );

//   // Call the notification service
//   await createNotificationsService(
//     conn,
//     { message },
//     actorUserId,
//     company_id,
//     recipientUsers,
//     category,
//     subCategory,
//     role
//   );
// }
