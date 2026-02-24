const winston = require('winston');
const path = require('path');

// Determine environment
const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';

// Custom format for console output
const consoleFormat = winston.format.combine(
    winston.format.colorize({ all: true }),
    winston.format.timestamp({ format: 'HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
        const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
        return `[${timestamp}] ${level}: ${message}${metaStr}`;
    })
);

// JSON format for production
const jsonFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
);

// Create logger instance
const logger = winston.createLogger({
    level: isProduction ? 'info' : 'debug',
    format: isProduction ? jsonFormat : consoleFormat,
    defaultMeta: { service: 'kitanime' },
    transports: [
        new winston.transports.Console({
            format: isProduction ? jsonFormat : consoleFormat
        })
    ],
    // Don't exit on error
    exitOnError: false
});

// Add file transport in development (not on Vercel)
if (!isProduction && !process.env.VERCEL) {
    const logsDir = path.join(__dirname, '..', 'logs');

    logger.add(new winston.transports.File({
        filename: path.join(logsDir, 'error.log'),
        level: 'error',
        format: jsonFormat
    }));

    logger.add(new winston.transports.File({
        filename: path.join(logsDir, 'combined.log'),
        format: jsonFormat
    }));
}

// Helper methods for common logging patterns
const loggerHelpers = {
    // Log API request
    apiRequest: (method, url, duration) => {
        logger.info(`API ${method} ${url}`, { duration: `${duration}ms`, type: 'api_request' });
    },

    // Log API error
    apiError: (endpoint, error) => {
        logger.error(`API error: ${endpoint}`, { error: error.message, type: 'api_error' });
    },

    // Log cache hit/miss
    cacheHit: (key) => {
        logger.debug(`Cache hit: ${key}`, { type: 'cache_hit' });
    },

    cacheMiss: (key) => {
        logger.debug(`Cache miss: ${key}`, { type: 'cache_miss' });
    },

    // Log database query
    dbQuery: (query, duration) => {
        if (duration > 100) {
            logger.warn(`Slow query (${duration}ms)`, { query, type: 'slow_query' });
        } else {
            logger.debug(`DB query (${duration}ms)`, { type: 'db_query' });
        }
    },

    // Log request performance
    requestPerf: (method, url, duration) => {
        const level = duration > 2000 ? 'warn' : 'debug';
        logger[level](`${method} ${url} - ${duration}ms`, { type: 'request_perf' });
    }
};

// Export both logger and helpers
module.exports = {
    logger,
    ...loggerHelpers,
    // Shorthand methods
    info: (msg, meta) => logger.info(msg, meta),
    warn: (msg, meta) => logger.warn(msg, meta),
    error: (msg, meta) => logger.error(msg, meta),
    debug: (msg, meta) => logger.debug(msg, meta)
};
