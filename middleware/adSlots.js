const { getAdSlotsByPosition, getSetting, waitForDatabase } = require('../models/database');

// Cache for ad slots to reduce database calls
let adSlotsCache = new Map();
const AD_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

async function getCachedAdSlots(position) {
  const cached = adSlotsCache.get(position);
  if (cached && Date.now() - cached.timestamp < AD_CACHE_TTL) {
    return cached.value;
  }
  
  try {
    const value = await getAdSlotsByPosition(position);
    adSlotsCache.set(position, {
      value,
      timestamp: Date.now()
    });
    return value;
  } catch (error) {
    console.error(`Error getting ad slots for ${position}:`, error);
    return [];
  }
}

async function adSlots(req, res, next) {
  try {
    // Wait for database to be fully ready
    const dbReady = await waitForDatabase(2000); // Reduced timeout
    
    if (dbReady) {
      try {
        const adsenseEnabled = await getSetting('adsense_enabled');

        const [headerAds, sidebarTopAds, sidebarBottomAds, contentBottomAds, playerBottomAds] = await Promise.all([
          getCachedAdSlots('header'),
          getCachedAdSlots('sidebar-top'),
          getCachedAdSlots('sidebar-bottom'),
          getCachedAdSlots('content-bottom'),
          getCachedAdSlots('player-bottom')
        ]);

        res.locals.adSlots = {
          header: headerAds || [],
          sidebarTop: sidebarTopAds || [],
          sidebarBottom: sidebarBottomAds || [],
          contentBottom: contentBottomAds || [],
          playerBottom: playerBottomAds || []
        };
        
        res.locals.adsenseEnabled = adsenseEnabled === '1';

        next();
        return;
      } catch (dbError) {
        console.error('Database error in ad slots middleware:', dbError);
        // Fall through to defaults
      }
    }
    
    // Use defaults if database is not ready or there's an error
    res.locals.adSlots = {
      header: [],
      sidebarTop: [],
      sidebarBottom: [],
      contentBottom: [],
      playerBottom: []
    };
    res.locals.adsenseEnabled = false;
    next();
    
  } catch (error) {
    console.error('Ad slots middleware error:', error);
    res.locals.adSlots = {
      header: [],
      sidebarTop: [],
      sidebarBottom: [],
      contentBottom: [],
      playerBottom: []
    };
    res.locals.adsenseEnabled = false;
    next();
  }
}

module.exports = adSlots;
