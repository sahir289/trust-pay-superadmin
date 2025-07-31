import app from './src/app.js';
import { createServer } from 'http';
import chalk from 'chalk';
import config from './src/config/config.js';
import { initializeSocket } from './src/utils/sockets.js';
import { logger } from './src/utils/logger.js';
import { closePool } from './src/utils/db.js';

const server = createServer(app);

initializeSocket(server);

const PORT = config?.port || 8080;

const normalizePort = (val) => {
  const port = parseInt(val, 10);
  if (Number.isNaN(port)) {
    // named pipe
    return val;
  }
  if (port >= 0) {
    // port number
    return port;
  }
  return false;
};

const port = normalizePort(PORT);
const onError = (error) => {
  if (error.syscall !== 'listen') return gracefulShutdown('Server error', error);
  switch (error.code) {
    case 'EACCES':
      error.message = `${port} requires elevated privileges`;
      break;
    case 'EADDRINUSE':
      error.message = `${port} is already in use`;
      break;
    default:
      throw error;
  }
  gracefulShutdown('Server listen error', error);
};

const onListening = () => {
  const addr = server.address();
  const bind = typeof addr === 'string' ? `pipe ${addr}` : `port ${addr.port}`;
  const styledServerMessage = chalk.blue(
    `the server started listening on ${bind}`,
  );
  logger.log(styledServerMessage);
  const docsUrl = `http://localhost:${PORT}/v1/api-docs`;
  const styledMessage = chalk.bold.yellow(`API docs available at ${docsUrl}`);
  logger.log(styledMessage);
};

// process.on('SIGINT', () => {
//   const message = chalk.bold.red('stopping the server');
//   logger.error(message);
//   process.exit();
// });

// process.on('uncaughtException', (err) => {
//   logger.error('There was an uncaught error', err);
//   process.exit(1);
// });

// process.on('unhandledRejection', (reason, promise) => {
//   logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
// });

let shuttingDown = false;

async function gracefulShutdown(label, err) {
  if (shuttingDown) return;
  shuttingDown = true;
  const styledMessageError = chalk.bold.red(`${label}`);
  
  // console the error in stderr (synchronously) so PM2 always captures it
  if (err) console.error(`${label}:`, err);

  if (err) {
    logger.error(styledMessageError, { message: err.message, stack: err.stack }); 
  } else {
    logger.warn(styledMessageError);
  }

  //  we need to close the resources (HTTP server, DB, etc.)
  try {
    await Promise.allSettled([
      new Promise((res) => server.close(res)),
      closePool(),
      new Promise((res) => logger.on('finish', res)).then(() => logger.end()),
    ]);
  } finally {
    process.exit(err ? 1 : 0);
  }
}

process.on('SIGINT', () => gracefulShutdown('SIGINT received'));

// docker / kubernetes or PM2 stop
process.on('SIGTERM', () => gracefulShutdown('SIGTERM received'));

process.on('uncaughtException', (err) =>
  gracefulShutdown('Uncaught Exception', err),
);

process.on('unhandledRejection', (reason) =>
  gracefulShutdown(
    'Unhandled Rejection',
    reason instanceof Error ? reason : new Error(String(reason)), 
  ),
);

server.listen(PORT, onListening);
server.on('error', onError);

