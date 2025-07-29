import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';

// Helper function to get caller file information
const getCallerInfo = (): { file: string; line: number; column: number } => {
  const originalFunc = Error.prepareStackTrace;
  
  let callerFile = 'unknown';
  let callerLine = 0;
  let callerColumn = 0;
  
  try {
    const err = new Error();
    Error.prepareStackTrace = (_, stack) => stack;
    
    const stack = err.stack as unknown as NodeJS.CallSite[];
    
    // Find the first stack frame that's not from this logger file
    const loggerFile = __filename;
    for (let i = 0; i < stack.length; i++) {
      const frame = stack[i];
      const fileName = frame.getFileName();
      
      if (fileName && fileName !== loggerFile && !fileName.includes('node_modules')) {
        // Get relative path from project root
        const relativePath = path.relative(process.cwd(), fileName);
        callerFile = relativePath.startsWith('..') ? path.basename(fileName) : relativePath;
        callerLine = frame.getLineNumber() || 0;
        callerColumn = frame.getColumnNumber() || 0;
        break;
      }
    }
  } catch (e) {
    // Fallback if stack trace fails
  } finally {
    Error.prepareStackTrace = originalFunc;
  }
  
  return { file: callerFile, line: callerLine, column: callerColumn };
};

// Define chalk colors as functions since we'll handle coloring differently
const colors = {
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  reset: '\x1b[0m',
};

// Helper function to colorize text
const colorize = (text: string, color: keyof typeof colors): string => {
  return `${colors[color]}${text}${colors.reset}`;
};

// Custom log levels with colors
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

const logColors: Record<string, keyof typeof colors> = {
  error: 'red',
  warn: 'yellow',
  info: 'blue',
  http: 'magenta',
  debug: 'cyan',
};

// Tell winston about our colors
winston.addColors(logColors);

// Custom format for console output with colors and emojis
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf((info) => {
    const { timestamp, level, message, stack, file, line, ...extra } = info;
    
    // Add emojis for different log levels
    const emojiMap: Record<string, string> = {
      error: '❌',
      warn: '⚠️ ',
      info: 'ℹ️ ',
      http: '🌐',
      debug: '🐛',
    };
    const emoji = emojiMap[level] || '📝';

    // Color the level
    const colorKey = logColors[level];
    const coloredLevel = colorKey ? colorize(level.toUpperCase().padEnd(5), colorKey) : level.toUpperCase().padEnd(5);
    
    // Format timestamp - ensure it's a string
    const timestampStr = typeof timestamp === 'string' ? timestamp : String(timestamp);
    const coloredTimestamp = colorize(timestampStr, 'gray');
    
    // Format file location if available
    const fileLocation = file && line ? colorize(`[${file}:${line}]`, 'cyan') + ' ' : '';
    
    // Format message
    let formattedMessage = String(message);
    
    // Add stack trace for errors
    if (stack && typeof stack === 'string') {
      formattedMessage += '\n' + colorize(stack, 'red');
    }
    
    // Add extra fields if present
    const extraFields = Object.keys(extra).length > 0 ? '\n' + JSON.stringify(extra, null, 2) : '';
    
    return `${emoji} ${coloredTimestamp} [${coloredLevel}] ${fileLocation}${formattedMessage}${extraFields}`;
  })
);

// File format (no colors, structured)
const fileFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Create the logger instance
const logger = winston.createLogger({
  levels: logLevels,
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  defaultMeta: { service: 'heimdall-server' },
  transports: [
    // Console transport with colors
    new winston.transports.Console({
      format: consoleFormat,
    }),
    
    // Rotating file transport for error logs
    new DailyRotateFile({
      filename: 'logs/error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      format: fileFormat,
      maxSize: process.env.LOG_MAX_SIZE || '20m', // Rotate when file reaches specified size
      maxFiles: process.env.LOG_ERROR_MAX_FILES || '14d', // Keep error logs for specified days
      auditFile: 'logs/error-audit.json',
      zippedArchive: process.env.LOG_COMPRESSION === 'true', // Use environment variable for compression
    }),
    
    // Rotating file transport for all logs
    new DailyRotateFile({
      filename: 'logs/combined-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      format: fileFormat,
      maxSize: process.env.LOG_MAX_SIZE || '20m', // Rotate when file reaches specified size
      maxFiles: process.env.LOG_MAX_FILES || '30d', // Keep logs for specified days
      auditFile: 'logs/combined-audit.json',
      zippedArchive: process.env.LOG_COMPRESSION === 'true', // Use environment variable for compression
    }),
  ],
});

// Listen for log rotation events
logger.transports.forEach((transport) => {
  if (transport instanceof DailyRotateFile) {
    transport.on('rotate', (oldFilename, newFilename) => {
      logger.info(`📦 Log rotated: ${oldFilename} → ${newFilename}`);
    });
    
    transport.on('archive', (zipFilename) => {
      logger.info(`🗜️  Log archived: ${zipFilename}`);
    });
    
    transport.on('logRemoved', (removedFilename) => {
      logger.info(`🗑️  Old log removed: ${removedFilename}`);
    });
  }
});

// Create logs directory if it doesn't exist
import { mkdirSync } from 'fs';
try {
  mkdirSync('logs', { recursive: true });
} catch (error) {
  // Directory might already exist
}

// Helper functions for common use cases
export const log = {
  // Standard logging methods with automatic file info
  error: (message: string, meta?: any) => {
    const callerInfo = getCallerInfo();
    logger.error(message, { ...meta, file: callerInfo.file, line: callerInfo.line });
  },
  warn: (message: string, meta?: any) => {
    const callerInfo = getCallerInfo();
    logger.warn(message, { ...meta, file: callerInfo.file, line: callerInfo.line });
  },
  info: (message: string, meta?: any) => {
    const callerInfo = getCallerInfo();
    logger.info(message, { ...meta, file: callerInfo.file, line: callerInfo.line });
  },
  http: (message: string, meta?: any) => {
    const callerInfo = getCallerInfo();
    logger.http(message, { ...meta, file: callerInfo.file, line: callerInfo.line });
  },
  debug: (message: string, meta?: any) => {
    const callerInfo = getCallerInfo();
    logger.debug(message, { ...meta, file: callerInfo.file, line: callerInfo.line });
  },
  
  // Convenience methods for common scenarios
  auth: (message: string, meta?: any) => {
    const callerInfo = getCallerInfo();
    logger.info(`🔐 AUTH: ${message}`, { ...meta, file: callerInfo.file, line: callerInfo.line });
  },
  db: (message: string, meta?: any) => {
    const callerInfo = getCallerInfo();
    logger.debug(`🗄️  DB: ${message}`, { ...meta, file: callerInfo.file, line: callerInfo.line });
  },
  api: (message: string, meta?: any) => {
    const callerInfo = getCallerInfo();
    logger.http(`🌐 API: ${message}`, { ...meta, file: callerInfo.file, line: callerInfo.line });
  },
  security: (message: string, meta?: any) => {
    const callerInfo = getCallerInfo();
    logger.warn(`🛡️  SECURITY: ${message}`, { ...meta, file: callerInfo.file, line: callerInfo.line });
  },
  startup: (message: string, meta?: any) => {
    const callerInfo = getCallerInfo();
    logger.info(`🚀 STARTUP: ${message}`, { ...meta, file: callerInfo.file, line: callerInfo.line });
  },
  
  // Request logging helper
  request: (req: any, res: any) => {
    const { method, url, ip, headers } = req;
    const userAgent = headers['user-agent'] || 'Unknown';
    const start = Date.now();
    const callerInfo = getCallerInfo();
    
    // Log request
    logger.http(`${method} ${url}`, {
      ip,
      userAgent,
      userId: req.user?.userId || 'anonymous',
      file: callerInfo.file,
      line: callerInfo.line,
    });
    
    // Log response when finished
    res.on('finish', () => {
      const duration = Date.now() - start;
      const { statusCode } = res;
      
      logger.http(`${method} ${url} - ${statusCode}`, {
        ip,
        statusCode,
        duration: `${duration}ms`,
        userId: req.user?.userId || 'anonymous',
        file: callerInfo.file,
        line: callerInfo.line,
      });
    });
  },
  
  // Error logging with context and automatic file info
  errorWithContext: (error: Error, context?: string, meta?: any) => {
    const callerInfo = getCallerInfo();
    logger.error(`${context ? `[${context}] ` : ''}${error.message}`, {
      error: error.name,
      stack: error.stack,
      file: callerInfo.file,
      line: callerInfo.line,
      ...meta,
    });
  },
};

// Export the winston logger instance for advanced usage
export { logger };

// Export default
export default log;
