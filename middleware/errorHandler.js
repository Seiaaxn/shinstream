const { addActivityLog } = require('../models/database');

// Enhanced error handling middleware
const errorHandler = {

  // Global error handler
  globalErrorHandler: (err, req, res, next) => {
    const timestamp = new Date().toISOString();
    const errorId = `ERR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Log error details
    console.error(`[${timestamp}] Error ${errorId}:`, {
      message: err.message,
      stack: err.stack,
      url: req.url,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.session?.userId
    });

    // Log to activity logs if user is authenticated
    if (req.session?.userId) {
      addActivityLog(
        req.session.userId,
        'error',
        `Error ${errorId}: ${err.message}`,
        req.ip,
        req.get('User-Agent')
      ).catch(logErr => console.error('Failed to log error to activity:', logErr));
    }

    // Determine error status and message
    let status = err.status || err.statusCode || 500;
    let message = err.message || 'Internal Server Error';
    let isOperational = err.isOperational || false;

    // Handle specific error types
    if (err.name === 'ValidationError') {
      status = 400;
      message = 'Validation Error';
      isOperational = true;
    } else if (err.name === 'CastError') {
      status = 400;
      message = 'Invalid ID format';
      isOperational = true;
    } else if (err.name === 'MongoError' && err.code === 11000) {
      status = 409;
      message = 'Duplicate entry';
      isOperational = true;
    } else if (err.name === 'JsonWebTokenError') {
      status = 401;
      message = 'Invalid token';
      isOperational = true;
    } else if (err.name === 'TokenExpiredError') {
      status = 401;
      message = 'Token expired';
      isOperational = true;
    } else if (err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED') {
      status = 503;
      message = 'Service temporarily unavailable';
      isOperational = true;
    } else if (err.code === 'ETIMEDOUT') {
      status = 408;
      message = 'Request timeout';
      isOperational = true;
    }

    // Prepare error response
    const errorResponse = {
      error: {
        id: errorId,
        message: isOperational ? message : 'Something went wrong',
        status,
        timestamp
      }
    };

    // Add stack trace in development
    if (process.env.NODE_ENV === 'development') {
      errorResponse.error.stack = err.stack;
      errorResponse.error.details = {
        originalMessage: err.message,
        url: req.url,
        method: req.method,
        ip: req.ip
      };
    }

    // Send appropriate response
    if (req.accepts('json')) {
      res.status(status).json(errorResponse);
    } else {
      res.status(status).render('error', {
        title: `Error ${status} - KitaNime`,
        error: errorResponse.error
      });
    }
  },

  // 404 handler
  notFoundHandler: (req, res, next) => {
    const error = new Error(`Not Found - ${req.originalUrl}`);
    error.status = 404;
    error.isOperational = true;
    next(error);
  },

  // Helper for rendering error pages in routes (DRY)
  renderPageError: (res, status = 500, message = 'Terjadi kesalahan') => {
    res.status(status).render('error', {
      title: `${status === 404 ? 'Tidak Ditemukan' : 'Terjadi Kesalahan'} - KitaNime`,
      error: { status, message }
    });
  },

  // Async error wrapper
  asyncHandler: (fn) => {
    return (req, res, next) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  },

  // Custom error classes
  AppError: class extends Error {
    constructor(message, statusCode, isOperational = true) {
      super(message);
      this.statusCode = statusCode;
      this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
      this.isOperational = isOperational;

      Error.captureStackTrace(this, this.constructor);
    }
  },

  // Validation error handler
  validationErrorHandler: (errors) => {
    const error = new errorHandler.AppError('Validation failed', 400);
    error.errors = errors;
    return error;
  },

  // Database error handler
  databaseErrorHandler: (err) => {
    if (err.code === 'SQLITE_CONSTRAINT') {
      return new errorHandler.AppError('Database constraint violation', 400);
    } else if (err.code === 'SQLITE_BUSY') {
      return new errorHandler.AppError('Database is busy, please try again', 503);
    } else if (err.code === 'SQLITE_CORRUPT') {
      return new errorHandler.AppError('Database corruption detected', 500);
    }
    return new errorHandler.AppError('Database error occurred', 500);
  },

  // API error handler
  apiErrorHandler: (err) => {
    if (err.response) {
      // API responded with error status
      const status = err.response.status;
      const message = err.response.data?.message || `API error: ${status}`;
      return new errorHandler.AppError(message, status);
    } else if (err.request) {
      // API request failed
      return new errorHandler.AppError('API service unavailable', 503);
    } else {
      // Other error
      return new errorHandler.AppError('API request failed', 500);
    }
  },

  // Rate limit error handler
  rateLimitErrorHandler: (req, res, next) => {
    const error = new errorHandler.AppError('Too many requests, please try again later', 429);
    error.retryAfter = req.rateLimit?.resetTime;
    next(error);
  },

  // Security error handler
  securityErrorHandler: (req, res, next) => {
    const error = new errorHandler.AppError('Security violation detected', 403);
    error.isOperational = true;
    next(error);
  },

  // File upload error handler
  fileUploadErrorHandler: (err, req, res, next) => {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return next(new errorHandler.AppError('File too large', 413));
    } else if (err.code === 'LIMIT_FILE_COUNT') {
      return next(new errorHandler.AppError('Too many files', 413));
    } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return next(new errorHandler.AppError('Unexpected file field', 400));
    }
    next(err);
  },

  // Error monitoring and alerting
  errorMonitor: {
    errors: [],
    maxErrors: 100,

    recordError(error, req) {
      this.errors.push({
        timestamp: new Date().toISOString(),
        error: error.message,
        stack: error.stack,
        url: req.url,
        method: req.method,
        ip: req.ip,
        userId: req.session?.userId
      });

      // Keep only recent errors
      if (this.errors.length > this.maxErrors) {
        this.errors = this.errors.slice(-this.maxErrors);
      }

      // Alert on critical errors
      if (error.status >= 500) {
        this.alertCriticalError(error, req);
      }
    },

    alertCriticalError(error, req) {
      // In production, you would send alerts to monitoring services
      console.error('CRITICAL ERROR ALERT:', {
        error: error.message,
        url: req.url,
        ip: req.ip,
        timestamp: new Date().toISOString()
      });
    },

    getErrorStats() {
      const now = new Date();
      const lastHour = new Date(now.getTime() - 60 * 60 * 1000);

      const recentErrors = this.errors.filter(err =>
        new Date(err.timestamp) > lastHour
      );

      const errorCounts = {};
      recentErrors.forEach(err => {
        errorCounts[err.error] = (errorCounts[err.error] || 0) + 1;
      });

      return {
        total: this.errors.length,
        lastHour: recentErrors.length,
        topErrors: Object.entries(errorCounts)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5)
          .map(([error, count]) => ({ error, count }))
      };
    }
  }
};

module.exports = errorHandler;
