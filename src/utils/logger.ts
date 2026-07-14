import { config } from '../config/index.js';
import type { LogLevel, LogLevelInfo } from '../types/index.js';

const LEVELS: Record<LogLevel, LogLevelInfo> = {
  debug: { priority: 0, color: '\x1b[35m', label: 'DEBUG' },
  info: { priority: 1, color: '\x1b[32m', label: 'INFO ' },
  warn: { priority: 2, color: '\x1b[33m', label: 'WARN ' },
  error: { priority: 3, color: '\x1b[31m', label: 'ERROR' }
};

const RESET = '\x1b[0m';
const DIM = '\x1b[2m';

const getLogLevelPriority = (level: LogLevel): number => {
  return LEVELS[level]?.priority ?? 1;
};

const currentPriority = getLogLevelPriority(config.LOG_LEVEL as LogLevel);

const log = (level: LogLevel, message: string, ...optionalParams: unknown[]): void => {
  const levelInfo = LEVELS[level];
  if (levelInfo.priority < currentPriority) return;

  const timestamp = new Date().toISOString();
  const prefix = `${DIM}[${timestamp}]${RESET} ${levelInfo.color}${levelInfo.label}${RESET}`;
  
  if (optionalParams.length > 0) {
    console.log(`${prefix} ${message}`, ...optionalParams);
  } else {
    console.log(`${prefix} ${message}`);
  }
};

export const logger = {
  debug: (message: string, ...args: unknown[]): void => log('debug', message, ...args),
  info: (message: string, ...args: unknown[]): void => log('info', message, ...args),
  warn: (message: string, ...args: unknown[]): void => log('warn', message, ...args),
  error: (message: string, ...args: unknown[]): void => log('error', message, ...args)
};
