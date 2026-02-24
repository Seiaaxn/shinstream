const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const helmet = require('helmet');
const compression = require('compression');
const cors = require('cors');
// Removed unused imports to reduce startup overhead
const createSessionConfig = require('./config/session');
const env = require('./config/env');
const logger = require('./services/logger');

const indexRoutes = require('./routes/index');
const animeRoutes = require('./routes/anime');
const adminRoutes = require('./routes/admin');
const apiRoutes = require('./routes/api');
const proxyRoutes = require('./routes/proxy');
const accountRoutes = require('./routes/account');
const authRoutes = require('./routes/auth');
const bookmarkRoutes = require('./routes/bookmarks');
const commentRoutes = require('./routes/comments');
const watchHistoryRoutes = require('./routes/watch-history');
const analyticsRoutes = require('./routes/analytics');

const cookieConsent = require('./middleware/cookieConsent');
const adSlots = require('./middleware/adSlots');
const {
  apiLimiter,
  authLimiter,
  commentLimiter,
  searchLimiter,
  streamLimiter,
  speedLimiter,
  adminLimiter,
  dynamicLimiter,
  ipBasedLimiter
} = require('./middleware/rateLimiter');
const {
  sanitizeInput,
  xssProtection,
  sqlInjectionProtection,
  csrfProtection,
  securityHeaders,
  requestSizeLimit,
  fileUploadSecurity,
  ipFilter,
  userAgentValidation
} = require('./middleware/security');
const {
  requestTiming,
  getMetrics,
  healthCheck
} = require('./middleware/performance');
const {
  globalErrorHandler,
  notFoundHandler,
  asyncHandler,
  AppError,
  fileUploadErrorHandler
} = require('./middleware/errorHandler');

const { analyticsMiddleware } = require('./middleware/analytics');

const { initializeDatabase } = require('./models/database');

const app = express();
const PORT = env.port;
app.disable('x-powered-by');
if (env.trustProxy) {
  app.set('trust proxy', 1);
}

// Initialize database before setting up middleware
let dbInitialized = false;
const initDatabase = async () => {
  if (!dbInitialized) {
    try {
      // Wait for database to be ready
      const { waitForDatabase } = require('./models/database');
      const dbReady = await waitForDatabase(10000); // Wait up to 10 seconds

      if (!dbReady) {
        throw new Error('Database failed to initialize within timeout');
      }

      logger.info('Database initialized successfully');
      dbInitialized = true;
    } catch (error) {
      logger.error('Failed to initialize database:', error);
      throw error;
    }
  }
};

// Enhanced security middleware
app.use(securityHeaders);
app.use(ipFilter);
app.use(userAgentValidation);
app.use(requestSizeLimit);
app.use(sanitizeInput);
app.use(xssProtection);
app.use(sqlInjectionProtection);

// Enable gzip/deflate/brotli for dynamic responses
app.use(compression({
  level: 6, // Balanced compression level
  threshold: 1024, // Only compress responses > 1KB
  filter: (req, res) => {
    // Don't compress if already compressed
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  }
}));
app.use(cors({
  origin: env.corsOrigin,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Performance monitoring and request logging
app.use(requestTiming);
app.use(speedLimiter);

// Lightweight request logger with response time in development
app.use((req, res, next) => {
  res.locals.req = req;
  if (process.env.NODE_ENV !== 'production') {
    const start = process.hrtime.bigint();
    res.on('finish', () => {
      const end = process.hrtime.bigint();
      const ms = Number(end - start) / 1e6;
      logger.debug(`${new Date().toISOString()}] ${req.method} ${req.url} ${res.statusCode} - ${ms.toFixed(1)}ms`);
    });
  }
  next();
});

// Add request timeout middleware
app.use((req, res, next) => {
  req.setTimeout(30000, () => {
    res.status(408).json({ error: 'Request timeout' });
  });
  next();
});

// Handle OPTIONS requests for CORS
app.options('/stream', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type');
  res.setHeader('Access-Control-Max-Age', '600');
  res.status(200).end();
});

app.options('/proxy', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Max-Age', '600');
  res.status(200).end();
});

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Use proper session store for production
app.use(session(createSessionConfig()));

// Expose user info to views
app.use((req, res, next) => {
  res.locals.currentUser = req.session.userId ? {
    id: req.session.userId,
    name: req.session.userName,
    email: req.session.userEmail
  } : null;
  next();
});

// Static assets with sensible caching
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '7d',
  etag: true,
  lastModified: true,
  setHeaders: (res, filePath) => {
    const ext = path.extname(filePath);
    const cacheable = ['.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico', '.woff', '.woff2'];
    if (cacheable.includes(ext)) {
      res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
    }
  }
}));

// Favicon route
app.get('/favicon.ico', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'images', 'favicon.ico'));
});

// PWA files - explicit routes for Vercel compatibility
app.get('/sw.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Service-Worker-Allowed', '/');
  res.sendFile(path.join(__dirname, 'public', 'sw.js'));
});

app.get('/manifest.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.sendFile(path.join(__dirname, 'public', 'manifest.json'));
});

// Middleware that depends on database - will be set up after database initialization
// app.use(cookieConsent);
// app.use(adSlots);
app.use(analyticsMiddleware);

// Environment-based middleware configuration
app.use((req, res, next) => {
  res.locals.env = {
    NODE_ENV: process.env.NODE_ENV,
    SITE_URL: process.env.SITE_URL || 'https://anime-stream-delta.vercel.app',
    API_BASE_URL: process.env.API_BASE_URL || 'https://anime-stream-delta.vercel.app/v1',
    ASSETS_URL: process.env.ASSETS_URL || 'https://anime-stream-delta.vercel.app',
    CDN_URL: process.env.CDN_URL || 'https://anime-stream-delta.vercel.app',
    STATIC_URL: process.env.STATIC_URL || 'https://anime-stream-delta.vercel.app/public',
    ENABLE_ANALYTICS: process.env.ENABLE_ANALYTICS === 'true',
    ENABLE_ADSENSE: process.env.ENABLE_ADSENSE === 'true',
    ENABLE_CACHING: process.env.ENABLE_CACHING === 'true',
    ENABLE_COMPRESSION: process.env.ENABLE_COMPRESSION === 'true',
    VERCEL: process.env.VERCEL === '1'
  };
  next();
});

// Apply rate limiting to specific routes
app.use('/auth', authLimiter);
app.use('/comments', commentLimiter);
app.use('/search', searchLimiter);
app.use('/stream', streamLimiter);
app.use('/admin', adminLimiter);

// Performance and health endpoints
app.get('/metrics', getMetrics);
app.get('/health', healthCheck);

// Debug middleware for /v1 requests
app.use('/v1', (req, res, next) => {
  logger.debug(`/v1 request: ${req.method} ${req.url}`);
  next();
});

// Main routes - API routes first to avoid conflicts
app.use('/v1', proxyRoutes);
app.use('/api', apiLimiter, apiRoutes);

// Redirect /genre to /genres (fix 404)
app.get('/genre', (req, res) => res.redirect(301, '/genres'));

app.use('/anime', animeRoutes);
app.use('/admin', adminRoutes);
app.use('/', indexRoutes);
app.use('/account', dynamicLimiter, accountRoutes);
app.use('/auth', authRoutes);
app.use('/bookmarks', bookmarkRoutes);
app.use('/comments', commentRoutes);
app.use('/watch-history', watchHistoryRoutes);
app.use('/analytics', analyticsRoutes);

// File upload error handling
app.use(fileUploadErrorHandler);

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(globalErrorHandler);

async function startServer() {
  try {
    await initDatabase();

    // Now that database is ready, set up database-dependent middleware
    app.use(cookieConsent);
    app.use(adSlots);
    logger.info('Database-dependent middleware set up successfully');

    // Only start server if not in Vercel environment
    if (!process.env.VERCEL) {
      app.listen(PORT, () => {
        logger.info(`KitaNime server running on port ${PORT}`);
        logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      });
    }
  } catch (error) {
    logger.error('Failed to start server:', error);
    if (!process.env.VERCEL) {
      process.exit(1);
    }
  }
}

// Initialize for both local and Vercel environments
startServer();

module.exports = app;