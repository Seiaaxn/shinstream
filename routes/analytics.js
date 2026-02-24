const express = require('express');
const router = express.Router();
const { trackAnimeEvent, trackSearch, trackStreaming, trackUserAction } = require('../middleware/analytics');

/**
 * Analytics tracking routes
 * Endpoints untuk tracking custom events
 */

// Track anime view
router.post('/track/anime-view', (req, res) => {
  try {
    const { animeTitle, animeSlug, episode } = req.body;
    
    const event = trackAnimeEvent('view', {
      title: animeTitle,
      slug: animeSlug,
      episode: episode
    });

    res.json({
      status: 'success',
      message: 'Anime view tracked',
      event: event
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to track anime view',
      error: error.message
    });
  }
});

// Track search query
router.post('/track/search', (req, res) => {
  try {
    const { query, resultsCount } = req.body;
    
    const event = trackSearch(query, resultsCount);

    res.json({
      status: 'success',
      message: 'Search tracked',
      event: event
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to track search',
      error: error.message
    });
  }
});

// Track streaming events
router.post('/track/streaming', (req, res) => {
  try {
    const { action, videoTitle, videoDuration } = req.body;
    
    const event = trackStreaming(action, {
      title: videoTitle,
      duration: videoDuration
    });

    res.json({
      status: 'success',
      message: 'Streaming event tracked',
      event: event
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to track streaming event',
      error: error.message
    });
  }
});

// Track user actions
router.post('/track/user-action', (req, res) => {
  try {
    const { action, properties } = req.body;
    
    const event = trackUserAction(action, properties);

    res.json({
      status: 'success',
      message: 'User action tracked',
      event: event
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to track user action',
      error: error.message
    });
  }
});

// Get analytics status
router.get('/status', (req, res) => {
  const isEnabled = process.env.NODE_ENV === 'production' && process.env.VERCEL;
  
  res.json({
    status: 'success',
    analytics: {
      enabled: isEnabled,
      environment: process.env.NODE_ENV,
      vercel: !!process.env.VERCEL
    }
  });
});

module.exports = router;
