import { config } from '../config/index.js';

const LEVELS = {
  debug: { priority: 0, color: '\x1b[35m', label: 'DEBUG' },
  info: { priority: 1, color: '\x1b[32m', label: 'INFO ' },
  warn: { priority: 2, color: '\x1b[33m', label: 'WARN ' },
  error: { priority: 3, color: '\x1b[31m', label: 'ERROR' }
};

const RESET = '\x1b[0m';
const DIM = '\x1b[2m';

const getLogLevelPriority = (level) => {
  return LEVELS[level]?.priority ?? 1;
};

const currentPriority = getLogLevelPriority(config.LOG_LEVEL);

const log = (level, message, ...optionalParams) => {
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
  debug: (message, ...args) => log('debug', message, ...args),
  info: (message, ...args) => log('info', message, ...args),
  warn: (message, ...args) => log('warn', message, ...args),
  error: (message, ...args) => log('error', message, ...args)
};
