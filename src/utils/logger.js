import fs from 'fs';
import winston, { createLogger, format } from 'winston';
import DailyRotate from 'winston-daily-rotate-file';
import CloudWatchTransport from 'winston-cloudwatch';
import appConfig from '../config/config.js';
import chalk from 'chalk';
import { stringifyJSON } from './index.js';

const env = appConfig?.nodeProductionLogs;
const aws = appConfig?.aws;
const logDir = 'log';

class Logger {
  #logger;
  constructor() {
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir);
    }

    // AWS CloudWatch Transport Configuration
    const cloudWatchConfig = {
      logGroupName: aws.cloudWatchLogGroup,
      logStreamName: `${env}-logs`,
      awsRegion: aws.region,
      awsAccessKeyId: aws.accessKeyId,
      awsSecretAccessKey: aws.secretAccessKey,
      retentionInDays: 30,
      jsonMessage: true,
    };

    // custom format to add IP address to metadata
    const addIpFormat = format((info) => {
      if (info.metadata && info.metadata.ip) {
        info.ip = info.metadata.ip;
      }
      return info;
    });

    this.#logger = createLogger({
      format: format.combine(
        addIpFormat(),
        format.errors({ stack: true }),
        format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        format.metadata({
          fillExcept: ['message', 'level', 'timestamp', 'stack'],
        }), // it will flatten metadata
        format.json(),
      ),
      transports: [
        new DailyRotate({
          filename: `${logDir}/%DATE%-error-results.log`,
          datePattern: 'YYYY-MM-DD',
          level: 'error',
        }),
        new DailyRotate({
          filename: `${logDir}/%DATE%-info-results.log`,
          datePattern: 'YYYY-MM-DD',
          level: 'info',
        }),
        new DailyRotate({
          filename: `${logDir}/%DATE%-warning-results.log`,
          datePattern: 'YYYY-MM-DD',
          level: 'warn',
        }),
        new CloudWatchTransport(cloudWatchConfig),
      ],
      exitOnError: false,
    });

    // Add console transport for development with custom formatting

    this.#logger.add(
      new winston.transports.Console({
        format: format.combine(
          format.colorize(),
          format.timestamp({
            format: () => {
              const options = {
                weekday: 'short',
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false,
                timeZone: 'Asia/Kolkata',
              };
              return new Date()
                .toLocaleString('en-US', options)
                .replace(',', '');
            },
          }),
          format.metadata({
            fillExcept: ['message', 'level', 'timestamp', 'stack'],
          }),
          format.printf(({ timestamp, level, message, metadata }) => {
            const typeChalk =
              level === 'error'
                ? chalk.red(level)
                : level === 'warn'
                  ? chalk.yellowBright(level)
                  : chalk.cyanBright(level);

            // it will only include metaString if metadata has meaningful data
            const metaString = (() => {
              if (!metadata || Object.keys(metadata).length === 0) {
                return '';
              }
              // check if metadata only contains an empty metadata object
              if (
                Object.keys(metadata).length === 1 &&
                metadata.metadata &&
                Object.keys(metadata.metadata).length === 0
              ) {
                return '';
              }
              return stringifyJSON(metadata);
            })();

            return `[${typeChalk}] [${timestamp}] ${message} ${metaString}`.trim();
          }),
        ),
      }),
    );
  }

  log(level, message, meta) {
    // Handle cases where message is an object and no meta is provided
    if (typeof message === 'object' && !meta) {
      meta = message;
      message = 'Log entry';
    }
    // Only pass meta to winston if it has meaningful data
    if (meta && Object.keys(meta).length > 0) {
      this.#logger.log(level, message, meta);
    } else {
      this.#logger.log(level, message);
    }
  }
}

export default Logger;
const winstonLogger = new Logger();

export const logger = {
  log: (message, meta) => winstonLogger.log('info', message, meta),
  info: (message, meta) => winstonLogger.log('info', message, meta),
  warn: (message, meta) => winstonLogger.log('warn', message, meta),
  error: (message, meta) => winstonLogger.log('error', message, meta),
};
