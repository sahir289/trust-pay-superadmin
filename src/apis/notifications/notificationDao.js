// /* eslint-disable no-useless-escape */
// import { tableName } from '../../constants/index.js';
// import {
//   buildInsertQuery,
//   buildUpdateQuery,
//   executeQuery,
// } from '../../utils/db.js';
// import { logger } from '../../utils/logger.js';
// // import { newTableEntry } from '../../utils/sockets.js';

// export const getNotificationsDao = async (user_id, company_id) => {
//   try {
//     const sql = `
//        SELECT
//             n.id,
//             n.message,
//             u."first_name" || ' ' || u."last_name" AS user,
//             n.created_at,
//             n.config
//         FROM
//             public."Notifications" n
//         LEFT JOIN "User" u ON u."id" = n.user_id
//         WHERE n.user_id = $1
//         AND n.company_id = $2
//         AND n.is_obsolete = false
//         ORDER BY
//             n.created_at DESC
//         `;
//     const values = [user_id, company_id];
//     const result = await executeQuery(sql, values);
//     if (result.rows.length === 0) {
//       return [];
//     }
//     return result.rows;
//   } catch (error) {
//     logger.error('Error in get Notifications Dao:', error);
//     throw error;
//   }
// };

// export const getNotificationByIdDao = async (id, company_id) => {
//   try {
//     const ids = Array.isArray(id)
//       ? id.map((x) => (typeof x === 'string' ? x : x.id))
//       : [typeof id === 'string' ? id : id.id];

//     const isMultiple = ids.length > 1;
//     const idPlaceholders = ids.map((_, idx) => `$${idx + 1}`).join(', ');

//     const sql = `
//       SELECT
//         n.id,
//         n.message,
//         u."first_name" || ' ' || u."last_name" AS user,
//         n.created_at,
//         n.config
//       FROM
//         public."Notifications" n
//       LEFT JOIN "User" u ON u."id" = n.user_id
//       WHERE n.id ${isMultiple ? `IN (${idPlaceholders})` : `= $1`}
//         AND n.company_id = $${ids.length + 1}
//         AND n.is_obsolete = false
//       ORDER BY
//         n.created_at DESC;
//     `;
//     const values = [...ids, company_id];
//     const result = await executeQuery(sql, values);
//     return result.rows || [];
//   } catch (error) {
//     logger.error('Error in getNotificationByIdDao:', error);
//     throw error;
//   }
// };

// export const getNotificationCountsByIdDao = async (id, company_id) => {
//   try {
//     const ids = Array.isArray(id)
//       ? id.map((x) => (typeof x === 'string' ? x : x.id))
//       : [typeof id === 'string' ? id : id.id];

//     const isMultiple = ids.length > 1;
//     const idPlaceholders = ids.map((_, idx) => `$${idx + 1}`).join(', ');

//     // 1. Get total count
//     const totalSql = `
//       SELECT COUNT(*) AS total_count
//       FROM public."Notifications" n
//       WHERE n.id ${isMultiple ? `IN (${idPlaceholders})` : `= $1`}
//         AND n.company_id = $${ids.length + 1}
//         AND n.is_obsolete = false
//     `;
//     const totalValues = [...ids, company_id];
//     const totalResult = await executeQuery(totalSql, totalValues);
//     const total_count = totalResult.rows[0]?.total_count || '0';

//     // 2. Get category and sub_category counts
//     const catSql = `
//       SELECT
//         COALESCE(NULLIF(n.config->>'category', ''), 'Other') AS category,
//         COALESCE(NULLIF(n.config->>'sub_category', ''), 'Other') AS sub_category,
//         COUNT(*) AS count
//       FROM public."Notifications" n
//       WHERE n.id ${isMultiple ? `IN (${idPlaceholders})` : `= $1`}
//         AND n.company_id = $${ids.length + 1}
//         AND n.is_obsolete = false
//       GROUP BY category, sub_category
//     `;
//     const catValues = [...ids, company_id];
//     const catResult = await executeQuery(catSql, catValues);

//     // Build the nested structure
//     const category_count = {};
//     for (const row of catResult.rows) {
//       const { category, sub_category, count } = row;
//       if (!category_count[category]) {
//         category_count[category] = {
//           [`${category}_count`]: 0,
//           sub_category_count: {},
//         };
//       }
//       category_count[category][`${category}_count`] += Number(count);
//       if (sub_category && sub_category !== 'Other') {
//         category_count[category].sub_category_count[sub_category] =
//           (category_count[category].sub_category_count[sub_category] || 0) +
//           Number(count);
//       }
//     }

//     return {
//       total_count,
//       category_count,
//     };
//   } catch (error) {
//     logger.error('Error in getNotificationCountsByIdDao:', error);
//     throw error;
//   }
// };

// export const getNotificationRecipientByNotificationDao = async (company_id) => {
//   try {
//     const sql = `
//         SELECT
//             nr.id,
//             nr.notification_id,
//             nr.created_at,
//             nr.updated_at,
//             nr.config
//         FROM
//             public."NotificationRecipients" nr
//         WHERE nr.company_id = $1
//         AND nr.is_obsolete = false
//         ORDER BY
//             nr.created_at DESC;
//     `;
//     const values = [company_id];
//     const result = await executeQuery(sql, values);

//     if (result.rows.length === 0) {
//       return [];
//     }
//     return result.rows;
//   } catch (error) {
//     logger.error(
//       'Error in get NotificationRecipient by Notifications Dao:',
//       error,
//     );
//     throw new error.message();
//   }
// };

// export const getNotificationRecipientByNotificationIdDao = async (
//   id,
//   company_id,
// ) => {
//   try {
//     // If id is an array, use IN clause; else, use equality
//     const isArray = Array.isArray(id);
//     const ids = isArray
//       ? id.map((x) => (typeof x === 'string' ? x : x.id))
//       : [typeof id === 'string' ? id : id.id];
//     const placeholders = ids.map((_, idx) => `$${idx + 1}`).join(', ');
//     const sql = `
//     SELECT
//         nr.id,
//         nr.notification_id,
//         nr.created_at,
//         nr.updated_at,
//         nr.config
//     FROM
//         public."NotificationRecipients" nr
//     WHERE nr.notification_id ${isArray ? `IN (${placeholders})` : `= $1`}
//     AND nr.company_id = $${ids.length + 1}
//     AND nr.is_obsolete = false
//     ORDER BY
//         nr.created_at DESC;
// `;
//     const values = [...ids, company_id];
//     const result = await executeQuery(sql, values);

//     if (result.rows.length === 0) {
//       return [];
//     }
//     return result.rows;
//   } catch (error) {
//     logger.error(
//       'Error in get NotificationRecipient by Notification Id Dao:',
//       error,
//     );
//     throw new error.message();
//   }
// };

// export const createNotificationsDao = async (payload) => {
//   try {
//     const [sql, params] = buildInsertQuery(tableName.NOTIFICATIONS, payload);
//     const result = await executeQuery(sql, params);

//     if (result.rows.length === 0) {
//       return [];
//     }
//     return result.rows;
//   } catch (error) {
//     logger.error('Error in get Notifications Dao:', error);
//     throw new error.message();
//   }
// };

// export const createNotificationsRecipientDao = async (payload) => {
//   try {
//     const [sql, params] = buildInsertQuery(
//       tableName.NOTIFICATION_RECIPIENTS,
//       payload,
//     );
//     const result = await executeQuery(sql, params);

//     if (result.rows.length === 0) {
//       return [];
//     }
//     return result.rows;
//   } catch (error) {
//     logger.error('Error in get Notifications Recipient Dao:', error);
//     throw new error.message();
//   }
// };

// export const updateNotificationsDao = async (id, payload) => {
//   try {
//     const [sql, params] = buildUpdateQuery(
//       tableName.NOTIFICATION_RECIPIENTS,
//       payload,
//       {
//         id,
//       },
//     );
//     const result = await executeQuery(sql, params);
//     if (result.rows.length === 0) {
//       return [];
//     }
//     return result.rows;
//   } catch (error) {
//     logger.error('Error in get Notifications Dao:', error);
//     throw new error.message();
//   }
// };

// export const getNotificationsByUserDao = async (
//   user_id,
//   company_id,
//   limit,
//   offset,
//   cursor,
//   category,
//   sub_category,
// ) => {
//   try {
//     // Use a CTE to limit the notifications before aggregation
//     let baseWhere = `
//       n.company_id = $1
//       AND n.is_obsolete = false
//       AND nr.company_id = $1
//       AND nr.is_obsolete = false
//       AND EXISTS (
//         SELECT 1
//         FROM jsonb_array_elements(nr.config->'recipients') AS r
//         WHERE r->>'recipient_id' = $2
//       )
//     `;
//     const values = [company_id, user_id];
//     let paramIdx = 3;

//     if (category) {
//       baseWhere += ` AND n.config->>'category' = $${paramIdx++}`;
//       values.push(category);
//     }
//     if (sub_category) {
//       baseWhere += ` AND n.config->>'sub_category' = $${paramIdx++}`;
//       values.push(sub_category);
//     }

//     if (cursor) {
//       // Ensure cursor is in valid ISO 8601 format for PostgreSQL
//       let cursorValue = cursor;
//       if (typeof cursor === 'string') {
//         // Replace the first space (between date and time) with 'T'
//         cursorValue = cursorValue.replace(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}\.\d+)(.*)$/, '$1T$2$3');
//         // Remove any remaining spaces
//         cursorValue = cursorValue.replace(/\s+/g, '');
//         // Fix timezone: if the offset is missing a "+" or "-", add "+"
//         if (/T\d{2}:\d{2}:\d{2}\.\d{1,9}(\d{2}:\d{2})$/.test(cursorValue)) {
//           cursorValue = cursorValue.replace(/(\.\d{1,9})(\d{2}:\d{2})$/, '$1+$2');
//         }
//         cursorValue = cursorValue.replace(/([+\-])(\d{2})(\d{2})$/, '$1$2:$3');
//       }
//       baseWhere += ` AND n.created_at < $${paramIdx++}`;
//       values.push(cursorValue);
//     }

//     let offsetClause = '';
//     if (offset !== undefined) {
//       offsetClause = ` OFFSET $${paramIdx++}`;
//       values.push(offset);
//     }

//     // Always push limit as last parameter
//     values.push(limit);

//     let sql = `
//       WITH limited_notifications AS (
//         SELECT
//           n.id,
//           n.message,
//           n.config,
//           n.created_at,
//           n.user_id,
//           nr.config AS nr_config,
//           u."first_name",
//           u."last_name"
//         FROM
//           public."Notifications" n
//         INNER JOIN public."NotificationRecipients" nr
//           ON n.id = nr.notification_id
//         LEFT JOIN public."User" u
//           ON u.id = n.user_id
//         WHERE
//           ${baseWhere}
//         ORDER BY n.created_at DESC
//         ${offsetClause}
//         LIMIT $${paramIdx}
//       )
//       SELECT
//         COALESCE(
//           NULLIF(limited_notifications.config->>'sub_category', ''),
//           NULLIF(limited_notifications.config->>'category', ''),
//           'Other'
//         ) AS group_key,
//         json_agg(
//           json_build_object(
//             'id', limited_notifications.id,
//             'message', limited_notifications.message,
//             'user', limited_notifications."first_name" || ' ' || limited_notifications."last_name",
//             'created_at', limited_notifications.created_at,
//             'config', limited_notifications.config,
//             'category', COALESCE(NULLIF(limited_notifications.config->>'category', ''), 'Other'),
//             'sub_category', COALESCE(NULLIF(limited_notifications.config->>'sub_category', ''), 'Other'),
//             'is_read', EXISTS (
//               SELECT 1
//               FROM jsonb_array_elements(limited_notifications.nr_config->'recipients') AS r
//               WHERE r->>'recipient_id' = $2 AND (r->>'is_read')::boolean = true
//             )
//           )
//         ) AS notifications
//       FROM limited_notifications
//       GROUP BY group_key
//       ORDER BY MAX(limited_notifications.created_at) DESC;
//     `;

//     const result = await executeQuery(sql, values);
//     return result.rows || [];
//   } catch (error) {
//     logger.error('Error in getNotificationsByUserDao:', {
//       error,
//       user_id,
//       company_id,
//       limit,
//       offset,
//       cursor,
//       category,
//       sub_category,
//     });
//     throw new Error(error.message);
//   }
// };
