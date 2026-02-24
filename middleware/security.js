const helmet = require('helmet');
const validator = require('validator');
const rateLimit = require('express-rate-limit');

// Enhanced security middleware
const securityMiddleware = {

  // Input validation and sanitization
  sanitizeInput: (req, res, next) => {
    // Recursively sanitize string inputs
    const sanitizeObject = (obj) => {
      if (typeof obj === 'string') {
        return validator.escape(obj.trim());
      } else if (Array.isArray(obj)) {
        return obj.map(sanitizeObject);
      } else if (obj && typeof obj === 'object') {
        const sanitized = {};
        for (const [key, value] of Object.entries(obj)) {
          sanitized[key] = sanitizeObject(value);
        }
        return sanitized;
      }
      return obj;
    };

    if (req.body) {
      req.body = sanitizeObject(req.body);
    }
    if (req.query) {
      req.query = sanitizeObject(req.query);
    }
    if (req.params) {
      req.params = sanitizeObject(req.params);
    }

    next();
  },

  // XSS Protection
  xssProtection: (req, res, next) => {
    // Remove any script tags from input
    const removeScripts = (obj) => {
      if (typeof obj === 'string') {
        return obj.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
      } else if (Array.isArray(obj)) {
        return obj.map(removeScripts);
      } else if (obj && typeof obj === 'object') {
        const cleaned = {};
        for (const [key, value] of Object.entries(obj)) {
          cleaned[key] = removeScripts(value);
        }
        return cleaned;
      }
      return obj;
    };

    if (req.body) {
      req.body = removeScripts(req.body);
    }

    next();
  },

  // SQL Injection Protection
  sqlInjectionProtection: (req, res, next) => {
    const dangerousPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/i,
      /(\b(OR|AND)\s+\d+\s*=\s*\d+)/i,
      /(\b(OR|AND)\s+'.*'\s*=\s*'.*')/i,
      /(UNION\s+SELECT)/i,
      /(DROP\s+TABLE)/i,
      /(DELETE\s+FROM)/i,
      /(INSERT\s+INTO)/i,
      /(UPDATE\s+SET)/i
    ];

    const checkForSQLInjection = (obj) => {
      if (typeof obj === 'string') {
        for (const pattern of dangerousPatterns) {
          if (pattern.test(obj)) {
            throw new Error('Potential SQL injection detected');
          }
        }
      } else if (Array.isArray(obj)) {
        obj.forEach(checkForSQLInjection);
      } else if (obj && typeof obj === 'object') {
        Object.values(obj).forEach(checkForSQLInjection);
      }
    };

    try {
      checkForSQLInjection(req.body);
      checkForSQLInjection(req.query);
      checkForSQLInjection(req.params);
      next();
    } catch (error) {
      res.status(400).json({ error: 'Invalid input detected' });
    }
  },

  // CSRF Protection (simplified for compatibility)
  csrfProtection: (req, res, next) => {
    // Basic CSRF protection implementation
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
      return next();
    }

    const token = req.body._csrf || req.headers['x-csrf-token'];
    const sessionToken = req.session.csrfSecret;

    if (!token || !sessionToken || token !== sessionToken) {
      return res.status(403).json({ error: 'CSRF token mismatch' });
    }

    next();
  },

  // Security headers optimized for production (includes CSP)
  securityHeaders: helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdn.tailwindcss.com", "https://cdn.plyr.io"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com", "https://cdn.plyr.io", "https://cdnjs.cloudflare.com", "https://pagead2.googlesyndication.com", "https://cdn.vercel-insights.com", "https://vitals.vercel-insights.com"],
        scriptSrcElem: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com", "https://cdn.plyr.io", "https://cdnjs.cloudflare.com", "https://pagead2.googlesyndication.com", "https://cdn.vercel-insights.com", "https://vitals.vercel-insights.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:", "http:"],
        mediaSrc: ["'self'", "https:", "http:"],
        connectSrc: ["'self'", "https:", "http:", "https://vitals.vercel-insights.com", "https://pagead2.googlesyndication.com", "https://cdn.vercel-insights.com"],
        frameSrc: ["'self'", "https:", "https://googleads.g.doubleclick.net"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null
      }
    },
    crossOriginEmbedderPolicy: false,
    hsts: process.env.NODE_ENV === 'production' ? {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    } : false,
    noSniff: true,
    xssFilter: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    // Additional production security headers
    ...(process.env.NODE_ENV === 'production' && {
      permissionsPolicy: {
        camera: [],
        microphone: [],
        geolocation: [],
        payment: []
      }
    })
  }),

  // Request size limiting
  requestSizeLimit: (req, res, next) => {
    const contentLength = parseInt(req.get('content-length') || '0');
    const maxSize = 10 * 1024 * 1024; // 10MB

    if (contentLength > maxSize) {
      return res.status(413).json({ error: 'Request entity too large' });
    }

    next();
  },

  // File upload security
  fileUploadSecurity: (req, res, next) => {
    if (req.file) {
      // Check file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(req.file.mimetype)) {
        return res.status(400).json({ error: 'Invalid file type' });
      }

      // Check file size (2MB max)
      if (req.file.size > 2 * 1024 * 1024) {
        return res.status(400).json({ error: 'File too large' });
      }

      // Check for malicious content in filename
      if (req.file.originalname.includes('..') || req.file.originalname.includes('/')) {
        return res.status(400).json({ error: 'Invalid filename' });
      }
    }

    next();
  },

  // IP whitelist/blacklist
  ipFilter: (req, res, next) => {
    const clientIP = req.ip || req.connection.remoteAddress;

    // Blacklisted IPs
    const blacklistedIPs = process.env.BLACKLISTED_IPS ?
      process.env.BLACKLISTED_IPS.split(',') : [];

    if (blacklistedIPs.includes(clientIP)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    next();
  },

  // User agent validation
  userAgentValidation: (req, res, next) => {
    const userAgent = req.get('User-Agent');

    // Skip validation in development mode
    if (process.env.NODE_ENV === 'development') {
      return next();
    }

    // Block requests with suspicious user agents
    const suspiciousPatterns = [
      /bot/i,
      /crawler/i,
      /spider/i,
      /scraper/i,
      /curl/i,
      /wget/i
    ];

    // Allow certain bots (Google, Bing, etc.)
    const allowedBots = [
      /googlebot/i,
      /bingbot/i,
      /slurp/i,
      /duckduckbot/i
    ];

    const isAllowedBot = allowedBots.some(pattern => pattern.test(userAgent));
    const isSuspicious = suspiciousPatterns.some(pattern => pattern.test(userAgent));

    if (isSuspicious && !isAllowedBot) {
      return res.status(403).json({ error: 'Access denied' });
    }

    next();
  },

  // Rate limiting for specific endpoints
  endpointRateLimit: (endpoint, windowMs, max) => {
    return rateLimit({
      windowMs,
      max,
      keyGenerator: (req) => {
        return `${req.ip}-${endpoint}`;
      },
      message: {
        error: `Too many requests to ${endpoint}, please try again later.`
      }
    });
  }
};

module.exports = securityMiddleware;
