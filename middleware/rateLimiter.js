const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');

// Rate limiting configurations
const createRateLimit = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      error: message || 'Too many requests, please try again later.',
      retryAfter: Math.ceil(windowMs / 1000)
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        error: message || 'Too many requests, please try again later.',
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }
  });
};

// General API rate limiting
const apiLimiter = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  100, // limit each IP to 100 requests per windowMs
  'Too many API requests from this IP, please try again later.'
);

// Strict rate limiting for authentication
const authLimiter = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  5, // limit each IP to 5 requests per windowMs
  'Too many authentication attempts, please try again later.'
);

// Comment posting rate limiting
const commentLimiter = createRateLimit(
  60 * 1000, // 1 minute
  10, // limit each IP to 10 comments per minute
  'Too many comments posted, please slow down.'
);

// Search rate limiting
const searchLimiter = createRateLimit(
  60 * 1000, // 1 minute
  30, // limit each IP to 30 searches per minute
  'Too many search requests, please slow down.'
);

// Video streaming rate limiting (more lenient)
const streamLimiter = createRateLimit(
  60 * 1000, // 1 minute
  60, // limit each IP to 60 stream requests per minute
  'Too many streaming requests, please slow down.'
);

// Speed limiter for gradual slowdown
const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 50, // allow 50 requests per 15 minutes, then...
  delayMs: () => 500 // begin adding 500ms of delay per request above 50
});

// Admin rate limiting (more strict)
const adminLimiter = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  20, // limit each IP to 20 admin requests per windowMs
  'Too many admin requests, please try again later.'
);

// Dynamic rate limiting based on user status
const dynamicLimiter = (req, res, next) => {
  // Authenticated users get higher limits
  if (req.session && req.session.userId) {
    return createRateLimit(
      15 * 60 * 1000, // 15 minutes
      200, // 200 requests for authenticated users
      'Rate limit exceeded for authenticated users.'
    )(req, res, next);
  } else {
    return createRateLimit(
      15 * 60 * 1000, // 15 minutes
      50, // 50 requests for anonymous users
      'Rate limit exceeded for anonymous users.'
    )(req, res, next);
  }
};

// IP-based rate limiting with whitelist
const ipBasedLimiter = (req, res, next) => {
  const clientIP = req.ip || req.connection.remoteAddress;
  
  // Whitelist certain IPs (admin, trusted sources)
  const whitelistedIPs = process.env.WHITELISTED_IPS ? 
    process.env.WHITELISTED_IPS.split(',') : [];
  
  if (whitelistedIPs.includes(clientIP)) {
    return next(); // Skip rate limiting for whitelisted IPs
  }
  
  return apiLimiter(req, res, next);
};

module.exports = {
  apiLimiter,
  authLimiter,
  commentLimiter,
  searchLimiter,
  streamLimiter,
  speedLimiter,
  adminLimiter,
  dynamicLimiter,
  ipBasedLimiter,
  createRateLimit
};
