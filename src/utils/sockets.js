import { Server } from 'socket.io';
import config from '../config/config.js';
import chalk from 'chalk';
import { logger } from './logger.js';
// import {
//   getBankaccountDao,
//   updateBankaccountDao,
// } from '../apis/bankAccounts/bankaccountDao.js';
// import { getUserByIdDao } from '../apis/users/userDao.js';

const userSockets = new Map();
let ioInstance = null;

const initializeSocket = (server) => {
  ioInstance = new Server(server, {
    transports: ['websocket', 'polling'],
    cors: {
      origin: [`${config?.reactFrontOrigin}`, `${config?.reactPaymentOrigin}`],
      methods: ['GET', 'POST'],
    },
  });

  ioInstance.on('connection', (socket) => {
    socket.on('connect', () => {
      logger.log(
        chalk.bgRed.white(`[SOCKET] New connection detected: ${socket.id}`),
      );
    });

    socket.on('pingCheck', () => {
      socket.emit('pongCheck');
    });

    // Immediate connection verification to prevent phantom sessions
    socket.on('connectionVerify', (data) => {
      const { userId, sessionId } = data;
      if (userId && sessionId) {
        // Immediately bind this socket to the user
        socket.userId = userId;
        socket.sessionId = sessionId;
        socket.loginTime = Date.now();

        logger.log(
          chalk.bgCyan.white(
            `[SOCKET] Socket ${socket.id} bound to user ${userId}, session ${sessionId}`,
          ),
        );

        // TAB DUPLICATION FIX: Allow multiple tabs from same browser session
        ioInstance.fetchSockets().then((allSockets) => {
          const userSockets = allSockets.filter(
            (s) => s.userId === userId && s.id !== socket.id,
          );

          if (userSockets.length > 0) {
            // Check if all sockets have the same sessionId (same browser/device)
            const sameBrowserSockets = userSockets.filter(
              (s) => s.sessionId === sessionId,
            );
            const differentBrowserSockets = userSockets.filter(
              (s) => s.sessionId !== sessionId,
            );

            logger.log(
              chalk.bgYellow.white(
                `[SOCKET] CONNECTION VERIFY - User ${userId}: ${sameBrowserSockets.length} same browser tabs, ${differentBrowserSockets.length} different devices`,
              ),
            );

            // Only terminate sockets from different browsers/devices, allow same browser tabs
            if (differentBrowserSockets.length > 0) {
              logger.log(
                chalk.bgRed.white(
                  `[SOCKET] Terminating ${differentBrowserSockets.length} different device sessions for user ${userId}`,
                ),
              );

              differentBrowserSockets.forEach((otherSocket) => {
                try {
                  otherSocket.emit('forceLogout', {
                    reason: 'connection_verify_different_device',
                    userId: userId,
                    message:
                      'New login from different device detected - session terminated',
                    nuclear: true,
                    ultraNuclear: true,
                    priority: 'CRITICAL',
                    instant: true,
                  });
                  otherSocket.disconnect(true);
                } catch (error) {
                  logger.error(
                    `[SOCKET] Error in connection verify cleanup: ${error.message}`,
                  );
                }
              });
            } else {
              logger.log(
                chalk.bgGreen.white(
                  `[SOCKET] CONNECTION VERIFY - Allowing ${sameBrowserSockets.length} tabs from same browser for user ${userId}`,
                ),
              );
            }
          }
        });
      }
    });

    // Handle phantom session check for immediate cleanup
    socket.on('phantomSessionCheck', async (data) => {
      const { userId, sessionId } = data;

      if (!userId) {
        return;
      }

      // Immediately bind this socket to the user if not already bound
      if (!socket.userId) {
        socket.userId = userId;
        socket.sessionId = sessionId;
        socket.loginTime = Date.now();

        logger.log(
          chalk.bgMagenta.white(
            `[SOCKET] Socket ${socket.id} bound to user ${userId}, session ${sessionId}`,
          ),
        );
      }

      try {
        logger.log(
          chalk.bgMagenta.white(
            `[SOCKET] Verifying session ${sessionId} for user ${userId}`,
          ),
        );

        // Get all sockets for this user
        const allSockets = await ioInstance.fetchSockets();
        const userSockets = allSockets.filter((s) => s.userId === userId);

        // TAB DUPLICATION FIX: Group by sessionId to identify same browser vs different devices
        if (userSockets.length > 1) {
          const sessionGroups = new Map();

          userSockets.forEach((socket) => {
            const sid = socket.sessionId || 'unknown';
            if (!sessionGroups.has(sid)) {
              sessionGroups.set(sid, []);
            }
            sessionGroups.get(sid).push(socket);
          });

          logger.log(
            chalk.bgYellow.white(
              `[SOCKET] User ${userId} has ${sessionGroups.size} different browser sessions with total ${userSockets.length} tabs`,
            ),
          );

          // If we have sessions from different browsers, keep only the current browser's sessions
          if (sessionGroups.size > 1) {
            logger.log(
              chalk.bgRed.white(
                `[SOCKET] Multiple devices detected for user ${userId}, terminating other devices`,
              ),
            );

            // Find the current session group
            const currentSessionSockets = sessionGroups.get(sessionId) || [];

            // Terminate all sockets NOT in the current session
            const terminationPromises = userSockets
              .filter((s) => s.sessionId !== sessionId)
              .map(async (phantomSocket) => {
                try {
                  phantomSocket.emit('forceLogout', {
                    reason: 'phantom_different_device',
                    userId: userId,
                    message:
                      'Login from different device detected - session terminated',
                    nuclear: true,
                    ultraNuclear: true,
                    priority: 'CRITICAL',
                    instant: true,
                  });
                  phantomSocket.disconnect(true);
                } catch (error) {
                  logger.error(
                    `[SOCKET] Error terminating phantom session: ${error.message}`,
                  );
                }
              });

            await Promise.allSettled(terminationPromises);

            logger.log(
              chalk.bgGreen.white(
                `[SOCKET] Preserved ${currentSessionSockets.length} tabs from current browser for user ${userId}`,
              ),
            );
          } else {
            logger.log(
              chalk.bgGreen.white(
                `[SOCKET] All ${userSockets.length} sessions are from same browser for user ${userId}, allowing multiple tabs`,
              ),
            );
          }
        }
      } catch (error) {
        logger.error(
          `[SOCKET] Error in phantom session check: ${error.message}`,
        );
      }
    });

    const message = chalk.bold.cyan(`Client connected: ${socket.id}`);
    logger.log(message);

    // Listen for both 'login' and 'user-login' events for compatibility
    const handleUserLogin = async (data) => {
      // Handle both string and object data formats for backward compatibility
      const userId = typeof data === 'object' ? data.userId : data;
      const sessionId = typeof data === 'object' ? data.sessionId : null;

      if (!userId) {
        logger.error('[SOCKET] Missing userId in login event');
        return;
      }

      // INSTANT PRE-TERMINATION - Kill ALL existing sessions for this user IMMEDIATELY
      try {
        const allSockets = await ioInstance.fetchSockets();
        const existingUserSockets = allSockets.filter(
          (s) => s.userId === userId && s.id !== socket.id,
        );

        if (existingUserSockets.length > 0) {
          // TAB DUPLICATION FIX: Group by sessionId to identify same browser vs different devices
          const sessionGroups = new Map();

          existingUserSockets.forEach((existingSocket) => {
            const sid = existingSocket.sessionId || 'unknown';
            if (!sessionGroups.has(sid)) {
              sessionGroups.set(sid, []);
            }
            sessionGroups.get(sid).push(existingSocket);
          });

          logger.log(
            chalk.bgYellow.white(
              `[SOCKET] USER LOGIN - User ${userId} has ${sessionGroups.size} different browser sessions`,
            ),
          );

          // Only terminate sessions from different browsers, allow same browser tabs
          const differentBrowserSockets = existingUserSockets.filter(
            (s) => s.sessionId !== sessionId,
          );

          if (differentBrowserSockets.length > 0) {
            logger.log(
              chalk.bgRed.white(
                `[SOCKET] PRE-TERMINATION - Found ${differentBrowserSockets.length} different device sessions for user ${userId}. TERMINATING INSTANTLY.`,
              ),
            );

            // INSTANT parallel termination - no delays whatsoever
            const instantTerminationPromises = differentBrowserSockets.map(
              async (existingSocket) => {
                try {
                  existingSocket.emit('forceLogout', {
                    reason: 'pre_termination_different_device',
                    userId: userId,
                    message:
                      'New login from different device detected - session terminated instantly',
                    nuclear: true,
                    ultraNuclear: true,
                    priority: 'CRITICAL',
                    instant: true,
                  });
                  existingSocket.disconnect(true);
                } catch (error) {
                  logger.error(
                    `[SOCKET] Error in instant termination: ${error.message}`,
                  );
                }
              },
            );

            // Wait for instant termination to complete
            await Promise.allSettled(instantTerminationPromises);

            logger.log(
              chalk.bgGreen.white(
                `[SOCKET] PRE-TERMINATION - Successfully terminated ${differentBrowserSockets.length} different device sessions instantly`,
              ),
            );
          } else {
            logger.log(
              chalk.bgGreen.white(
                `[SOCKET] USER LOGIN - All ${existingUserSockets.length} existing sessions are from same browser, allowing multiple tabs`,
              ),
            );
          }
        }
      } catch (error) {
        logger.error(
          `[SOCKET] Error in instant pre-termination: ${error.message}`,
        );
      }

      // Enhanced logging for all environments
      logger.log(
        chalk.bgBlue.white(
          `[SOCKET] User login event received for userId: ${userId}, sessionId: ${sessionId}, socketId: ${socket.id}`,
        ),
      );
      logger.log(
        chalk.cyan(
          `[SOCKET] Config origins: Front=${config?.reactFrontOrigin}, Payment=${config?.reactPaymentOrigin}`,
        ),
      );
      logger.log(
        chalk.yellow(
          `[SOCKET] Socket origin: ${socket.handshake.headers.origin || 'N/A'}, Referer: ${socket.handshake.headers.referer || 'N/A'}`,
        ),
      );

      // Store socket metadata for better tracking - ensure binding happens only once
      if (!socket.userId) {
        socket.userId = userId;
        socket.sessionId = sessionId;
        socket.loginTime = Date.now();

        logger.log(
          chalk.bgGreen.white(
            `[SOCKET] Socket ${socket.id} bound to user ${userId}, session ${sessionId}`,
          ),
        );
      } else {
        // Socket already bound, just update the login time to mark as newest
        socket.loginTime = Date.now();

        logger.log(
          chalk.bgBlue.white(
            `[SOCKET] Socket ${socket.id} already bound to user ${userId}, updated login time`,
          ),
        );
      }

      // Critical section - handle the session management with care
      try {
        // Get all connected sockets across all namespaces
        const allSockets = await ioInstance.fetchSockets();

        // Find all existing sockets for this user by checking socket.userId property
        const userActiveSockets = allSockets.filter(
          (s) => s.userId === userId && s.id !== socket.id,
        );

        // Log what we found
        logger.log(
          chalk.bgBlue.white(
            `[SOCKET] Found ${userActiveSockets.length} existing sockets for user ${userId}`,
          ),
        );

        // TAB DUPLICATION FIX: Group sockets by sessionId to handle same browser vs different devices
        if (userActiveSockets.length > 0) {
          const sessionGroups = new Map();

          userActiveSockets.forEach((existingSocket) => {
            const sid = existingSocket.sessionId || 'unknown';
            if (!sessionGroups.has(sid)) {
              sessionGroups.set(sid, []);
            }
            sessionGroups.get(sid).push(existingSocket);
          });

          // Only terminate sessions from different browsers/devices
          const differentBrowserSockets = userActiveSockets.filter(
            (s) => s.sessionId !== sessionId,
          );

          if (differentBrowserSockets.length > 0) {
            logger.log(
              chalk.bgRed.white(
                `[SOCKET] ENFORCEMENT - User ${userId} has ${differentBrowserSockets.length} sessions from different devices. TERMINATING DIFFERENT DEVICE SESSIONS ONLY.`,
              ),
            );

            // Send immediate termination commands to different device sessions only
            const terminationPromises = differentBrowserSockets.map(
              async (existingSocket) => {
                logger.log(
                  chalk.red(
                    `[SOCKET] ENFORCEMENT - Terminating different device session ${existingSocket.id}`,
                  ),
                );

                try {
                  // Send EVERY possible logout event for maximum coverage
                  existingSocket.emit('forceLogout', {
                    reason: 'new_login_different_device',
                    userId: userId,
                    sessionId: existingSocket.sessionId || 'unknown',
                    message:
                      'Your session has been terminated due to a new login from another device.',
                    timestamp: new Date().toISOString(),
                    immediate: true,
                    nuclear: true,
                    priority: 'CRITICAL',
                  });

                  existingSocket.emit('session-terminated', {
                    reason: 'new_login_different_device',
                    userId: userId,
                    sessionId: existingSocket.sessionId || 'unknown',
                    message: 'Please login again',
                    immediate: true,
                    priority: 'CRITICAL',
                  });

                  // FIXED: Only send newLogin to OLD sessions being terminated, not the new session
                  existingSocket.emit('newLogin', userId);
                  existingSocket.emit('newlogout', userId);

                  // FORCE disconnect without any delay
                  existingSocket.disconnect(true);

                  logger.log(
                    chalk.red(
                      `[SOCKET] ENFORCEMENT - Terminated different device session ${existingSocket.id}`,
                    ),
                  );
                } catch (error) {
                  logger.error(
                    `[SOCKET] Error terminating socket ${existingSocket.id}: ${error.message}`,
                  );
                  try {
                    existingSocket.disconnect(true);
                  } catch (disconnectError) {
                    logger.error(
                      `[SOCKET] Error force disconnecting socket ${existingSocket.id}: ${disconnectError.message}`,
                    );
                  }
                }
              },
            );

            // Wait for all termination commands to complete (max 500ms)
            try {
              await Promise.allSettled(terminationPromises);
            } catch (error) {
              logger.error(
                `[SOCKET] Error in parallel termination: ${error.message}`,
              );
            }

            logger.log(
              chalk.bgGreen.white(
                `[SOCKET] ENFORCEMENT - Successfully terminated ${differentBrowserSockets.length} different device sessions for user ${userId}`,
              ),
            );
          } else {
            logger.log(
              chalk.bgGreen.white(
                `[SOCKET] USER LOGIN - All ${userActiveSockets.length} existing sessions are from same browser, allowing multiple tabs for user ${userId}`,
              ),
            );
          }
        }

        // Add this socket to our tracking map - only track the new socket
        userSockets.set(userId, [socket.id]);

        // Ultra-aggressive cleanup - INSTANT socket operations
        setTimeout(async () => {
          try {
            // Force logout other sessions immediately for maximum aggressiveness
            await forceLogoutUser(userId, null, sessionId);

            logger.log(
              chalk.bgMagenta.white(
                `[SOCKET] Instant socket cleanup completed for user ${userId}`,
              ),
            );
          } catch (cleanupError) {
            logger.error(
              `[SOCKET] Error in socket cleanup: ${cleanupError.message}`,
            );
          }
        }, 10); // 10ms ultra-fast cleanup

        const loginMessage = chalk.bold.green(
          `[SOCKET] User ${userId} logged in with socket ${socket.id}, ${userActiveSockets.length} old sessions terminated`,
        );
        logger.log(loginMessage);

        // FIXED: No longer emit global newLogin - we send it specifically to old sessions being terminated
      } catch (error) {
        logger.error(`[SOCKET] Error in login handler: ${error.message}`);
        logger.error(error.stack);
      }
    };

    // Listen for both event names for compatibility
    socket.on('login', handleUserLogin);
    socket.on('user-login', handleUserLogin);

    socket.emit('new-entry', { message: 'Hello from server!!!', data: {} });
    ioInstance.emit('broadcast-message', {
      message: 'A new client has connected!',
    });

    socket.on('client-message', (data) => {
      logger.log(`Received from client:`, data);
    });

    socket.on('disconnect', (reason) => {
      // Don't emit logout events for server-side disconnects, timeouts, or connection issues
      const isServerSideDisconnect =
        reason === 'server disconnect' ||
        reason === 'transport close' ||
        reason === 'server shutting down' ||
        reason === 'ping timeout' ||
        reason === 'transport error' ||
        reason === 'connection timeout' ||
        reason.includes('timeout') ||
        reason.includes('error');

      for (const [userId, socketIds] of userSockets.entries()) {
        const updatedSockets = socketIds.filter((id) => id !== socket.id);
        if (updatedSockets.length > 0) {
          userSockets.set(userId, updatedSockets);
          logger.log(
            chalk.blue(
              `User ${userId} disconnected, remaining sockets: ${updatedSockets}`,
            ),
          );
        } else {
          userSockets.delete(userId);
          logger.log(
            chalk.blue(`User ${userId} disconnected, no remaining sockets`),
          );

          // Only emit logout events for intentional client-side disconnects, not timeouts/errors
          if (!isServerSideDisconnect) {
            logger.log(
              chalk.yellow(
                `[SOCKET] Emitting logout event for user ${userId} due to client disconnect`,
              ),
            );
            // You can add specific logout events here if needed
            // ioInstance.emit('userLoggedOut', { userId, reason: 'client_disconnect' });
          } else {
            logger.log(
              chalk.gray(
                `[SOCKET] Skipping logout event for user ${userId} due to server-side/timeout disconnect: ${reason}`,
              ),
            );
          }
        }
      }
      const disconnectMessage = chalk.bold.red(
        `Client disconnected: ${socket.id}, reason: ${reason}`,
      );
      logger.log(disconnectMessage);
    });
  });
  const initMessage = chalk.magentaBright('WebSocket server initialized');
  logger.log(initMessage);

  // Session cleanup monitoring - intelligent logging to prevent spam
  const lastCleanupState = new Map(); // Track last state to prevent spam logging
  const lastCleanupAction = new Map(); // Track when actual cleanup actions occurred

  setInterval(async () => {
    try {
      if (!ioInstance) return;

      const allSockets = await ioInstance.fetchSockets();
      const userSessionMap = new Map();

      // Group sockets by userId
      for (const socket of allSockets) {
        if (socket.userId) {
          if (!userSessionMap.has(socket.userId)) {
            userSessionMap.set(socket.userId, []);
          }
          userSessionMap.get(socket.userId).push(socket);
        }
      }

      const cleanupPromises = [];

      for (const [userId, userSockets] of userSessionMap) {
        if (userSockets.length > 1) {
          // Group sockets by sessionId to handle same browser vs different devices
          const sessionGroups = new Map();

          userSockets.forEach((userSocket) => {
            const sid = userSocket.sessionId || 'unknown';
            if (!sessionGroups.has(sid)) {
              sessionGroups.set(sid, []);
            }
            sessionGroups.get(sid).push(userSocket);
          });

          // Create state key for logging throttling
          const stateKey = `${userId}_${sessionGroups.size}_${userSockets.length}`;
          const lastState = lastCleanupState.get(userId);
          const lastAction = lastCleanupAction.get(userId);

          // Only log if there's actual cleanup needed OR state has significantly changed
          const now = Date.now();
          const hasMultipleDevices = sessionGroups.size > 1;
          const stateChanged = !lastState || lastState.stateKey !== stateKey;
          const longTimeSinceLog = !lastState || (now - lastState.timestamp) > 60000; // 1 minute
          const longTimeSinceAction = !lastAction || (now - lastAction.timestamp) > 300000; // 5 minutes

          // Only log when there's something meaningful to report
          const shouldLog = hasMultipleDevices && (stateChanged || (longTimeSinceLog && longTimeSinceAction));

          // If multiple browser sessions exist, terminate other devices
          if (hasMultipleDevices) {
            if (shouldLog) {
              logger.log(
                chalk.bgYellow.white(
                  `[SOCKET] CLEANUP - User ${userId} has ${sessionGroups.size} different browser sessions with ${userSockets.length} total tabs`,
                ),
              );
              
              logger.log(
                chalk.bgRed.white(
                  `[SOCKET] CLEANUP - User ${userId} has multiple devices. TERMINATING OTHER DEVICES.`,
                ),
              );

              lastCleanupState.set(userId, {
                stateKey,
                timestamp: now,
              });
              
              lastCleanupAction.set(userId, {
                timestamp: now,
              });
            }

            // Get current browser sessions - use the most recent sessionId as reference
            const sessionIds = Array.from(sessionGroups.keys());
            const mostRecentSessionId = sessionIds[sessionIds.length - 1];
            const currentBrowserSockets =
              sessionGroups.get(mostRecentSessionId) || [];

            // Parallel cleanup of sessions from different browsers only
            const sessionCleanupPromises = userSockets
              .filter(
                (userSocket) => userSocket.sessionId !== mostRecentSessionId,
              )
              .map(async (userSocket) => {
                // Only log the termination message when we're doing initial logging
                if (shouldLog) {
                  logger.log(
                    chalk.red(
                      `[SOCKET] CLEANUP - Terminating different device session ${userSocket.id}`,
                    ),
                  );
                }

                try {
                  // Critical priority termination
                  userSocket.emit('forceLogout', {
                    reason: 'cleanup_different_device',
                    userId: userId,
                    sessionId: userSocket.sessionId || 'unknown',
                    message:
                      'Different device detected - only one device allowed',
                    timestamp: new Date().toISOString(),
                    immediate: true,
                    priority: 'CRITICAL',
                    instant: true,
                  });

                  userSocket.emit('session-terminated', {
                    reason: 'cleanup_different_device',
                    userId: userId,
                    sessionId: userSocket.sessionId || 'unknown',
                    message: 'Different device detected - please login again',
                    timestamp: new Date().toISOString(),
                    immediate: true,
                    priority: 'CRITICAL',
                    instant: true,
                  });

                  userSocket.emit('newLogin', userId);
                  userSocket.emit('newlogout', userId);
                  userSocket.disconnect(true);

                  if (shouldLog) {
                    logger.log(
                      chalk.red(
                        `[SOCKET] CLEANUP - Terminated different device session ${userSocket.id}`,
                      ),
                    );
                  }
                } catch (error) {
                  logger.error(`[SOCKET] CLEANUP - Error: ${error.message}`);
                  try {
                    userSocket.disconnect(true);
                  } catch (disconnectError) {
                    logger.error(
                      `[SOCKET] CLEANUP - Disconnect error: ${disconnectError.message}`,
                    );
                  }
                }
              });

            cleanupPromises.push(...sessionCleanupPromises);

            if (shouldLog) {
              logger.log(
                chalk.bgGreen.white(
                  `[SOCKET] CLEANUP - Will preserve ${currentBrowserSockets.length} tabs from most recent browser for user ${userId}`,
                ),
              );
            }
          } else {
            // Single browser session - only log if it's a new state or hasn't been logged recently
            if (stateChanged && !lastState) {
              logger.log(
                chalk.bgGreen.white(
                  `[SOCKET] CLEANUP - User ${userId} has single browser session with ${userSockets.length} tabs - no cleanup needed`,
                ),
              );
              
              lastCleanupState.set(userId, {
                stateKey,
                timestamp: now,
              });
            }
          }
        }
      }

      // Clean up old state tracking to prevent memory leaks
      const cutoffTime = Date.now() - 3600000; // 1 hour
      for (const [userId, state] of lastCleanupState.entries()) {
        if (state.timestamp < cutoffTime) {
          lastCleanupState.delete(userId);
        }
      }
      for (const [userId, action] of lastCleanupAction.entries()) {
        if (action.timestamp < cutoffTime) {
          lastCleanupAction.delete(userId);
        }
      }

      // Execute all cleanup operations in parallel
      if (cleanupPromises.length > 0) {
        try {
          await Promise.allSettled(cleanupPromises);
        } catch (error) {
          logger.error(
            `[SOCKET] CLEANUP - Error in parallel cleanup: ${error.message}`,
          );
        }
      }
    } catch (error) {
      logger.error(`[SOCKET] Error in cleanup: ${error.message}`);
    }
  }, 5000); // Check every 5 seconds
};

const forceLogoutUser = async (
  userId,
  targetSessionId = null,
  excludeSessionId = null,
) => {
  if (!ioInstance) {
    logger.error('Socket.IO not initialized');
    return;
  }

  try {
    logger.log(
      chalk.bgRed.white(
        `[SOCKET] forceLogoutUser - userId: ${userId}, target: ${targetSessionId}, exclude: ${excludeSessionId}`,
      ),
    );

    // Get all connected sockets directly from Socket.IO
    const allSockets = await ioInstance.fetchSockets();

    // Find sockets belonging to this user
    const userActiveSocketsList = allSockets.filter(
      (socket) => socket.userId === userId,
    );

    logger.log(
      chalk.bgRed.white(
        `[SOCKET] Found ${userActiveSocketsList.length} active sockets for user ${userId}`,
      ),
    );

    // Parallel disconnection for maximum speed
    const disconnectionPromises = userActiveSocketsList
      .filter((socket) => {
        // Skip if this is the session we want to exclude
        if (excludeSessionId && socket.sessionId === excludeSessionId) {
          logger.log(
            chalk.green(
              `[SOCKET] Preserving session ${socket.id} with sessionId ${excludeSessionId}`,
            ),
          );
          return false;
        }

        // Skip if this is not the target session (when targeting specific session)
        if (targetSessionId && socket.sessionId !== targetSessionId) {
          logger.log(
            chalk.green(`[SOCKET] Skipping non-target session ${socket.id}`),
          );
          return false;
        }

        return true;
      })
      .map(async (socket) => {
        logger.log(
          chalk.red(`[SOCKET] Force disconnecting socket ${socket.id}`),
        );

        try {
          // Send all logout events with priority
          socket.emit('forceLogout', {
            reason: 'force_logout',
            userId: userId,
            sessionId: socket.sessionId || 'unknown',
            message: 'Session terminated by server.',
            timestamp: new Date().toISOString(),
            immediate: true,
            priority: 'CRITICAL',
          });

          socket.emit('session-terminated', {
            reason: 'force_logout',
            userId: userId,
            sessionId: socket.sessionId || 'unknown',
            message: 'Please login again',
            immediate: true,
            priority: 'CRITICAL',
          });

          socket.emit('newLogin', userId);
          socket.emit('newlogout', userId);

          // IMMEDIATE disconnection
          socket.disconnect(true);

          logger.log(chalk.red(`[SOCKET] Disconnected socket ${socket.id}`));
        } catch (error) {
          logger.error(
            `[SOCKET] Error disconnecting socket ${socket.id}: ${error.message}`,
          );
          try {
            socket.disconnect(true);
          } catch (disconnectError) {
            logger.error(
              `[SOCKET] Error force disconnecting socket ${socket.id}: ${disconnectError.message}`,
            );
          }
        }
      });

    // Execute all disconnections in parallel
    if (disconnectionPromises.length > 0) {
      try {
        await Promise.allSettled(disconnectionPromises);
      } catch (error) {
        logger.error(
          `[SOCKET] Error in parallel disconnection: ${error.message}`,
        );
      }
    }

    // Update tracking map
    if (excludeSessionId) {
      // Keep only the excluded session
      const preservedSockets = userActiveSocketsList.filter(
        (socket) => socket.sessionId === excludeSessionId,
      );
      if (preservedSockets.length > 0) {
        userSockets.set(
          userId,
          preservedSockets.map((s) => s.id),
        );
      } else {
        userSockets.delete(userId);
      }
    } else {
      // Remove all tracking for this user
      userSockets.delete(userId);
    }

    logger.log(
      chalk.green(`[SOCKET] Completed force logout for user ${userId}`),
    );
  } catch (error) {
    logger.error(`[SOCKET] Error in forceLogoutUser: ${error.message}`);
    logger.error(error.stack);
  }

  // Emit global logout event
  ioInstance.emit('userLoggedOut', {
    userId,
    sessionId: targetSessionId,
    reason: 'forced_logout',
  });
};

const deactivateBank = (nickName, bankId, userId, isWarning = false) => {
  if (!ioInstance) {
    logger.error('Socket.IO not initialized');
    return;
  }

  ioInstance.emit(isWarning ? 'bankStatusWarning' : 'bankStatusUpdate', {
    message: isWarning
      ? `The Bank ${nickName} will be Deactivate soon as the Balance will soon reach the Daily Limit`
      : `The Bank ${nickName} is Deactivated`,
    bankId,
    nickname: nickName,
    userId: userId, //send userid to show notification only to vendor whose bank status is updated
    isEnabled: !isWarning ? false : undefined,
  });
};

// New function to emit event when a specific entry is added to a table
const notifyNewTableEntry = async (tableName, entryType, entryData) => {
  if (!ioInstance) {
    logger.error('Socket.IO not initialized');
    return;
  }

  const eventName = `newTableEntry${tableName}`;
  logger.info(eventName, 'eventName');
  const payload = {
    tableName,
    entryType,
    entryData,
    timestamp: new Date().toISOString(),
  };

  logger.log(
    chalk.bold.cyan(
      `Emitting ${eventName} for table ${tableName}, type ${entryType}`,
    ),
  );
  ioInstance.emit(eventName, payload); // Broadcast to all connected clients
};
// New function to emit event when a specific entry is updated/added in a table
const newTableEntry = async (tableName, data) => {
  if (!ioInstance) {
    logger.error('Socket.IO not initialized');
    return;
  }
  const eventName = `newTableEntry${tableName}`;
  logger.log(chalk.bold.cyan(`Emitting ${eventName} for table ${tableName}`));
  ioInstance.emit(eventName, data);
};

const logOutUser = async (user_id) => {
  if (!ioInstance) {
    logger.error('Socket.IO not initialized');
    return;
  }
  const eventName = `newlogout`;
  logger.log(chalk.bold.cyan(`Emitting ${eventName} for ${user_id}`));
  ioInstance.emit(eventName, user_id);
};
//update payour socket notification
// const updatePayout = (id, code, merchant_order_id) => {
//   if (!ioInstance) {
//     logger.error('Socket.IO not initialized');
//     return;
//   }
//   ioInstance.emit('updatedPayout', {
//     message: `Payout for merchant ${code} with order id ${merchant_order_id} has been updated!`,
//     payoutId: id,
//     merchant_order_id: merchant_order_id,
//     code: code,
//   });
// };

// New function to emit event when a specific entry is added to a Calculation table
// const notifyNewCalculationTableEntry = async (tableName, entryData) => {
//   if (!ioInstance) {
//     logger.error('Socket.IO not initialized');
//     return;
//   }

//   if (entryData && entryData.net_balance <= 0) {
//     const banks = await getBankaccountDao({ user_id: entryData.user_id });
//     const bankIds = banks.map((bank) => bank.id);
//     const bankNickNames = banks.map((bank) => bank.nick_name);
//     const user = await getUserByIdDao(entryData.user_id);
//     bankIds.forEach(async (bankId) => {
//       try {
//         await updateBankaccountDao(
//           { id: bankId, company_id: entryData.company_id },
//           { is_enabled: false },
//         );
//         logger.info(`Successfully disabled bank account with ID ${bankId}`);
//       } catch (error) {
//         logger.error(`Failed to update bank account with ID ${bankId}:`, error);
//       }
//     });

//     const eventName = 'newCalculationTableEntry';
//     logger.info(eventName, 'eventName');
//     logger.log(chalk.bold.cyan(`Emitting ${eventName} for table ${tableName}`));
//     ioInstance.emit(eventName, {
//       message: `Due to Insufficient Balance in ${user} account ${bankNickNames} has been Deactivated`,
//     }); // Broadcast to all connected clients
//   }
// };

export {
  initializeSocket,
  forceLogoutUser,
  deactivateBank,
  notifyNewTableEntry,
  // updatePayout,
  newTableEntry,
  logOutUser,
  // notifyNewCalculationTableEntry,
};
