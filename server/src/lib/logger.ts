import winston from 'winston';

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
    const { timestamp, level, message, stack, ...extra } = info;
    
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
    
    // Format message
    let formattedMessage = String(message);
    
    // Add stack trace for errors
    if (stack && typeof stack === 'string') {
      formattedMessage += '\n' + colorize(stack, 'red');
    }
    
    // Add extra fields if present
    const extraFields = Object.keys(extra).length > 0 ? '\n' + JSON.stringify(extra, null, 2) : '';
    
    return `${emoji} ${coloredTimestamp} [${coloredLevel}] ${formattedMessage}${extraFields}`;
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
    
    // File transports
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: fileFormat,
    }),
    
    new winston.transports.File({
      filename: 'logs/combined.log',
      format: fileFormat,
    }),
  ],
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
  // Standard logging methods
  error: (message: string, meta?: any) => logger.error(message, meta),
  warn: (message: string, meta?: any) => logger.warn(message, meta),
  info: (message: string, meta?: any) => logger.info(message, meta),
  http: (message: string, meta?: any) => logger.http(message, meta),
  debug: (message: string, meta?: any) => logger.debug(message, meta),
  
  // Convenience methods for common scenarios
  auth: (message: string, meta?: any) => logger.info(`🔐 AUTH: ${message}`, meta),
  db: (message: string, meta?: any) => logger.debug(`🗄️  DB: ${message}`, meta),
  api: (message: string, meta?: any) => logger.http(`🌐 API: ${message}`, meta),
  security: (message: string, meta?: any) => logger.warn(`🛡️  SECURITY: ${message}`, meta),
  startup: (message: string, meta?: any) => logger.info(`🚀 STARTUP: ${message}`, meta),
  
  // Request logging helper
  request: (req: any, res: any) => {
    const { method, url, ip, headers } = req;
    const userAgent = headers['user-agent'] || 'Unknown';
    const start = Date.now();
    
    // Log request
    logger.http(`${method} ${url}`, {
      ip,
      userAgent,
      userId: req.user?.userId || 'anonymous',
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
      });
    });
  },
  
  // Error logging with context
  errorWithContext: (error: Error, context?: string, meta?: any) => {
    logger.error(`${context ? `[${context}] ` : ''}${error.message}`, {
      error: error.name,
      stack: error.stack,
      ...meta,
    });
  },
};

// Export the winston logger instance for advanced usage
export { logger };

// Export default
export default log;
