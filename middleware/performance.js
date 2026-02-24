const performanceObserver = require('perf_hooks').PerformanceObserver;
const { performance } = require('perf_hooks');

// Performance monitoring middleware
const performanceMiddleware = {
  
  // Request timing middleware
  requestTiming: (req, res, next) => {
    const startTime = performance.now();
    const startMemory = process.memoryUsage();
    
    // Add performance tracking to response
    res.on('finish', () => {
      const endTime = performance.now();
      const endMemory = process.memoryUsage();
      const duration = endTime - startTime;
      
      // Adjust thresholds based on environment
      const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
      const slowThreshold = isProduction ? 2000 : 1000; // 2s in production, 1s in dev
      const memoryThreshold = isProduction ? 20 * 1024 * 1024 : 10 * 1024 * 1024; // 20MB in production, 10MB in dev
      
      // Log slow requests
      if (duration > slowThreshold) {
        console.warn(`Slow request detected: ${req.method} ${req.url} - ${duration.toFixed(2)}ms`);
      }
      
      // Log memory usage for heavy requests
      const memoryDiff = endMemory.heapUsed - startMemory.heapUsed;
      if (memoryDiff > memoryThreshold) {
        console.warn(`High memory usage: ${req.method} ${req.url} - ${(memoryDiff / 1024 / 1024).toFixed(2)}MB`);
      }
      
      // Log performance metrics in production for monitoring
      if (isProduction && duration > 500) {
        console.log(`Performance: ${req.method} ${req.url} - ${duration.toFixed(2)}ms - ${(memoryDiff / 1024 / 1024).toFixed(2)}MB`);
      }
      
      // Add performance headers (only if not already sent)
      if (!res.headersSent) {
        res.setHeader('X-Response-Time', `${duration.toFixed(2)}ms`);
        res.setHeader('X-Memory-Usage', `${(memoryDiff / 1024 / 1024).toFixed(2)}MB`);
      }
    });
    
    next();
  },

  // Database query monitoring
  dbQueryMonitor: (query, params, duration) => {
    if (duration > 100) { // 100ms
      console.warn(`Slow database query (${duration}ms):`, query);
    }
    
    // Log all queries in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`DB Query (${duration}ms):`, query, params);
    }
  },

  // Memory usage monitoring
  memoryMonitor: () => {
    const memUsage = process.memoryUsage();
    const formatBytes = (bytes) => (bytes / 1024 / 1024).toFixed(2);
    
    return {
      rss: `${formatBytes(memUsage.rss)}MB`,
      heapTotal: `${formatBytes(memUsage.heapTotal)}MB`,
      heapUsed: `${formatBytes(memUsage.heapUsed)}MB`,
      external: `${formatBytes(memUsage.external)}MB`,
      arrayBuffers: `${formatBytes(memUsage.arrayBuffers)}MB`
    };
  },

  // CPU usage monitoring
  cpuMonitor: () => {
    const cpuUsage = process.cpuUsage();
    return {
      user: cpuUsage.user,
      system: cpuUsage.system
    };
  },

  // Cache performance monitoring
  cacheMonitor: {
    hits: 0,
    misses: 0,
    
    recordHit() {
      this.hits++;
    },
    
    recordMiss() {
      this.misses++;
    },
    
    getStats() {
      const total = this.hits + this.misses;
      return {
        hits: this.hits,
        misses: this.misses,
        total,
        hitRate: total > 0 ? (this.hits / total * 100).toFixed(2) + '%' : '0%'
      };
    },
    
    reset() {
      this.hits = 0;
      this.misses = 0;
    }
  },

  // API response time monitoring
  apiResponseMonitor: {
    responses: new Map(),
    
    recordResponse(endpoint, duration, statusCode) {
      if (!this.responses.has(endpoint)) {
        this.responses.set(endpoint, {
          count: 0,
          totalTime: 0,
          minTime: Infinity,
          maxTime: 0,
          statusCodes: {}
        });
      }
      
      const stats = this.responses.get(endpoint);
      stats.count++;
      stats.totalTime += duration;
      stats.minTime = Math.min(stats.minTime, duration);
      stats.maxTime = Math.max(stats.maxTime, duration);
      stats.statusCodes[statusCode] = (stats.statusCodes[statusCode] || 0) + 1;
    },
    
    getStats() {
      const result = {};
      for (const [endpoint, stats] of this.responses) {
        result[endpoint] = {
          count: stats.count,
          avgTime: (stats.totalTime / stats.count).toFixed(2) + 'ms',
          minTime: stats.minTime === Infinity ? 0 : stats.minTime.toFixed(2) + 'ms',
          maxTime: stats.maxTime.toFixed(2) + 'ms',
          statusCodes: stats.statusCodes
        };
      }
      return result;
    },
    
    reset() {
      this.responses.clear();
    }
  },

  // Performance metrics endpoint
  getMetrics: (req, res) => {
    const metrics = {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: performanceMiddleware.memoryMonitor(),
      cpu: performanceMiddleware.cpuMonitor(),
      cache: performanceMiddleware.cacheMonitor.getStats(),
      api: performanceMiddleware.apiResponseMonitor.getStats(),
      environment: process.env.NODE_ENV
    };
    
    res.json(metrics);
  },

  // Performance optimization suggestions
  getOptimizationSuggestions: () => {
    const suggestions = [];
    const memUsage = process.memoryUsage();
    const cacheStats = performanceMiddleware.cacheMonitor.getStats();
    
    // Memory usage suggestions
    if (memUsage.heapUsed > 100 * 1024 * 1024) { // 100MB
      suggestions.push('High memory usage detected. Consider implementing garbage collection optimization.');
    }
    
    // Cache hit rate suggestions
    if (cacheStats.total > 0 && cacheStats.hitRate < 50) {
      suggestions.push('Low cache hit rate. Consider reviewing cache strategy and TTL values.');
    }
    
    // API response time suggestions
    const apiStats = performanceMiddleware.apiResponseMonitor.getStats();
    for (const [endpoint, stats] of Object.entries(apiStats)) {
      if (parseFloat(stats.avgTime) > 1000) { // 1 second
        suggestions.push(`Slow API endpoint detected: ${endpoint} (avg: ${stats.avgTime}). Consider optimization.`);
      }
    }
    
    return suggestions;
  },

  // Performance health check
  healthCheck: (req, res) => {
    const memUsage = process.memoryUsage();
    const isHealthy = memUsage.heapUsed < 200 * 1024 * 1024; // 200MB threshold
    
    res.status(isHealthy ? 200 : 503).json({
      status: isHealthy ? 'healthy' : 'unhealthy',
      memory: performanceMiddleware.memoryMonitor(),
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    });
  }
};

// Initialize performance observer
if (process.env.NODE_ENV === 'development') {
  const obs = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.duration > 100) { // 100ms
        console.log(`Performance entry: ${entry.name} - ${entry.duration.toFixed(2)}ms`);
      }
    }
  });
  
  obs.observe({ entryTypes: ['measure', 'navigation'] });
}

module.exports = performanceMiddleware;
