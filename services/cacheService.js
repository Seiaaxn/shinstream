const NodeCache = require('node-cache');

// In-memory cache service (can be replaced with Redis in production)
class CacheService {
  constructor() {
    // Optimize cache settings for production
    const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
    
    // Create different cache instances for different data types
    this.apiCache = new NodeCache({ 
      stdTTL: isProduction ? 900 : 600, // 15 minutes in production, 10 minutes in dev
      checkperiod: isProduction ? 180 : 120, // Check every 3 minutes in production
      useClones: false, // Don't clone objects for better performance
      maxKeys: isProduction ? 2000 : 1000 // More cache in production
    });
    
    this.userCache = new NodeCache({ 
      stdTTL: isProduction ? 3600 : 1800, // 1 hour in production, 30 minutes in dev
      checkperiod: isProduction ? 300 : 120,
      useClones: false,
      maxKeys: isProduction ? 500 : 200
    });
    
    this.staticCache = new NodeCache({ 
      stdTTL: isProduction ? 7200 : 3600, // 2 hours in production, 1 hour in dev
      checkperiod: isProduction ? 600 : 300,
      useClones: false,
      maxKeys: isProduction ? 1000 : 500
    });
    
    // Cache statistics
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0
    };
  }

  // Generic cache operations
  async get(key, cacheType = 'api') {
    const cache = this.getCacheInstance(cacheType);
    const value = cache.get(key);
    
    if (value !== undefined) {
      this.stats.hits++;
      return value;
    } else {
      this.stats.misses++;
      return null;
    }
  }

  async set(key, value, ttl = null, cacheType = 'api') {
    const cache = this.getCacheInstance(cacheType);
    const success = cache.set(key, value, ttl);
    
    if (success) {
      this.stats.sets++;
    }
    
    return success;
  }

  async del(key, cacheType = 'api') {
    const cache = this.getCacheInstance(cacheType);
    const deleted = cache.del(key);
    
    if (deleted > 0) {
      this.stats.deletes++;
    }
    
    return deleted > 0;
  }

  async exists(key, cacheType = 'api') {
    const cache = this.getCacheInstance(cacheType);
    return cache.has(key);
  }

  async flush(cacheType = 'api') {
    const cache = this.getCacheInstance(cacheType);
    cache.flushAll();
  }

  // Cache with fallback function
  async getOrSet(key, fallbackFn, ttl = null, cacheType = 'api') {
    let value = await this.get(key, cacheType);
    
    if (value === null) {
      try {
        value = await fallbackFn();
        if (value !== null && value !== undefined) {
          await this.set(key, value, ttl, cacheType);
        }
      } catch (error) {
        console.error('Cache fallback function failed:', error);
        throw error;
      }
    }
    
    return value;
  }

  // Batch operations
  async mget(keys, cacheType = 'api') {
    const cache = this.getCacheInstance(cacheType);
    const values = cache.mget(keys);
    
    // Update stats
    const hits = Object.values(values).filter(v => v !== undefined).length;
    this.stats.hits += hits;
    this.stats.misses += keys.length - hits;
    
    return values;
  }

  async mset(keyValuePairs, ttl = null, cacheType = 'api') {
    const cache = this.getCacheInstance(cacheType);
    const success = cache.mset(keyValuePairs, ttl);
    
    if (success) {
      this.stats.sets += keyValuePairs.length;
    }
    
    return success;
  }

  // Cache patterns
  async getPattern(pattern, cacheType = 'api') {
    const cache = this.getCacheInstance(cacheType);
    const keys = cache.keys();
    const matchingKeys = keys.filter(key => key.includes(pattern));
    
    if (matchingKeys.length === 0) {
      return {};
    }
    
    return this.mget(matchingKeys, cacheType);
  }

  async delPattern(pattern, cacheType = 'api') {
    const cache = this.getCacheInstance(cacheType);
    const keys = cache.keys();
    const matchingKeys = keys.filter(key => key.includes(pattern));
    
    let deleted = 0;
    for (const key of matchingKeys) {
      if (cache.del(key)) {
        deleted++;
        this.stats.deletes++;
      }
    }
    
    return deleted;
  }

  // Cache warming
  async warmCache(key, fallbackFn, ttl = null, cacheType = 'api') {
    try {
      const value = await fallbackFn();
      if (value !== null && value !== undefined) {
        await this.set(key, value, ttl, cacheType);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Cache warming failed:', error);
      return false;
    }
  }

  // Cache invalidation strategies
  async invalidateUserData(userId) {
    const patterns = [
      `user:${userId}:*`,
      `bookmarks:${userId}:*`,
      `watch_history:${userId}:*`,
      `comments:${userId}:*`
    ];
    
    for (const pattern of patterns) {
      await this.delPattern(pattern, 'user');
    }
  }

  async invalidateAnimeData(animeSlug) {
    const patterns = [
      `anime:${animeSlug}:*`,
      `episodes:${animeSlug}:*`,
      `comments:${animeSlug}:*`,
      `ratings:${animeSlug}:*`
    ];
    
    for (const pattern of patterns) {
      await this.delPattern(pattern, 'api');
    }
  }

  // Cache statistics
  getStats() {
    const apiStats = this.apiCache.getStats();
    const userStats = this.userCache.getStats();
    const staticStats = this.staticCache.getStats();
    
    const totalHits = this.stats.hits;
    const totalMisses = this.stats.misses;
    const totalRequests = totalHits + totalMisses;
    
    return {
      global: {
        hits: this.stats.hits,
        misses: this.stats.misses,
        sets: this.stats.sets,
        deletes: this.stats.deletes,
        hitRate: totalRequests > 0 ? (totalHits / totalRequests * 100).toFixed(2) + '%' : '0%'
      },
      api: {
        keys: apiStats.keys,
        hits: apiStats.hits,
        misses: apiStats.misses,
        ksize: apiStats.ksize,
        vsize: apiStats.vsize
      },
      user: {
        keys: userStats.keys,
        hits: userStats.hits,
        misses: userStats.misses,
        ksize: userStats.ksize,
        vsize: userStats.vsize
      },
      static: {
        keys: staticStats.keys,
        hits: staticStats.hits,
        misses: staticStats.misses,
        ksize: staticStats.ksize,
        vsize: staticStats.vsize
      }
    };
  }

  // Health check
  async healthCheck() {
    try {
      const testKey = 'health_check';
      const testValue = Date.now();
      
      await this.set(testKey, testValue, 10, 'api');
      const retrieved = await this.get(testKey, 'api');
      await this.del(testKey, 'api');
      
      return retrieved === testValue;
    } catch (error) {
      console.error('Cache health check failed:', error);
      return false;
    }
  }

  // Helper method to get cache instance
  getCacheInstance(cacheType) {
    switch (cacheType) {
      case 'user':
        return this.userCache;
      case 'static':
        return this.staticCache;
      case 'api':
      default:
        return this.apiCache;
    }
  }

  // Cache key generators
  static generateKey(prefix, ...parts) {
    return `${prefix}:${parts.join(':')}`;
  }

  static generateApiKey(endpoint, params = {}) {
    const paramString = Object.keys(params)
      .sort()
      .map(key => `${key}=${params[key]}`)
      .join('&');
    return `api:${endpoint}:${paramString}`;
  }

  static generateUserKey(userId, resource, ...parts) {
    return this.generateKey('user', userId, resource, ...parts);
  }

  static generateAnimeKey(animeSlug, resource, ...parts) {
    return this.generateKey('anime', animeSlug, resource, ...parts);
  }
}

// Create singleton instance
const cacheService = new CacheService();

// Add static methods to the instance for backward compatibility
cacheService.generateKey = CacheService.generateKey;
cacheService.generateApiKey = CacheService.generateApiKey;
cacheService.generateUserKey = CacheService.generateUserKey;
cacheService.generateAnimeKey = CacheService.generateAnimeKey;

module.exports = cacheService;
