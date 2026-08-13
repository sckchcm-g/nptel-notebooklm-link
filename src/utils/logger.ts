// ============================================================
// src/utils/logger.ts
// Winston logger — writes to console + rotating log files.
// ============================================================

import winston from 'winston';
import path from 'path';
import { SETTINGS } from '../config/settings.js';

const { combine, timestamp, printf, colorize, errors } = winston.format;

const logFormat = printf(({ level, message, timestamp, stack }) => {
  return `${timestamp} [${level}]: ${stack ?? message}`;
});

export const logger = winston.createLogger({
  level: process.env['LOG_LEVEL'] ?? 'info',
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    logFormat,
  ),
  transports: [
    new winston.transports.Console({
      format: combine(
        colorize({ all: true }),
        errors({ stack: true }),
        timestamp({ format: 'HH:mm:ss' }),
        logFormat,
      ),
    }),
    new winston.transports.File({
      filename: path.join(SETTINGS.logsDir, 'error.log'),
      level: 'error',
      // lazy: true avoids crash if logsDir doesn't exist yet (created by init)
      lazy: true,
    }),
    new winston.transports.File({
      filename: path.join(SETTINGS.logsDir, 'combined.log'),
      lazy: true,
    }),
  ],
});
