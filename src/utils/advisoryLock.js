import { BadRequestError } from './appErrors.js';
import { logger } from './logger.js';

export async function checkLockEdit(conn, id, payin) {
  try {
    const lockKey = parseInt(id.replace(/-/g, ''), 16) % 1000000;
    const lockResult = await conn.query(
      'SELECT pg_try_advisory_xact_lock($1) AS acquired',
      [lockKey],
    );
    if (!lockResult.rows[0].acquired) {
      throw new BadRequestError(
        'This record is currently being updated by another user. Please try again later.',
      );
    }
    if (!payin) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    return true;
  } catch (error) {
    logger.error('Error while attempting to check lock for ID', error);
    throw error;
  }
}
