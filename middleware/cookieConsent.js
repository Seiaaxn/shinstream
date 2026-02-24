const { getSetting, waitForDatabase } = require('../models/database');

// Cache for settings to reduce database calls
let settingsCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getCachedSetting(key) {
  const cached = settingsCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.value;
  }
  
  try {
    const value = await getSetting(key);
    settingsCache.set(key, {
      value,
      timestamp: Date.now()
    });
    return value;
  } catch (error) {
    console.error(`Error getting setting ${key}:`, error);
    return null;
  }
}

async function cookieConsent(req, res, next) {
  try {
    // Wait for database to be fully ready
    const dbReady = await waitForDatabase(2000); // Reduced timeout
    
    if (dbReady) {
      try {
        const consentEnabled = await getCachedSetting('cookie_consent_enabled');
        
        if (consentEnabled === '1') {
          const hasConsent = req.cookies.cookie_consent;
          res.locals.showCookieConsent = !hasConsent;
          res.locals.cookieConsentGiven = !!hasConsent;
        } else {
          res.locals.showCookieConsent = false;
          res.locals.cookieConsentGiven = true;
        }
        
        next();
        return;
      } catch (dbError) {
        console.error('Database error in cookie consent middleware:', dbError);
        // Fall through to defaults
      }
    }
    
    // Use defaults if database is not ready or there's an error
    res.locals.showCookieConsent = false;
    res.locals.cookieConsentGiven = true;
    next();
    
  } catch (error) {
    console.error('Cookie consent middleware error:', error);
    res.locals.showCookieConsent = false;
    res.locals.cookieConsentGiven = true;
    next();
  }
}

module.exports = cookieConsent;
