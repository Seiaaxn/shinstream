const express = require('express');
const axios = require('axios');
const { getActiveApiEndpoint } = require('../models/database');

const router = express.Router();

async function resolveUpstreamBaseUrl() {
  // Prefer explicit upstream to avoid recursion if API_BASE_URL points to /v1
  const explicit = process.env.UPSTREAM_API_BASE_URL;
  if (explicit && explicit.startsWith('http')) return explicit.replace(/\/$/, '');
  const dbUrl = await getActiveApiEndpoint();
  if (dbUrl && dbUrl.startsWith('http')) return dbUrl.replace(/\/$/, '');
  return 'https://anime-stream-delta.vercel.app/v1';
}

// Handle root /v1 endpoint
router.get('/', (req, res) => {
  console.log('✅ /v1 endpoint accessed successfully');
  res.json({
    ok: true,
    message: 'KitaNime API v1',
    version: '1.0.0',
    endpoints: {
      home: '/v1/home',
      search: '/v1/search',
      anime: '/v1/anime/{slug}',
      ongoing: '/v1/ongoing-anime',
      complete: '/v1/complete-anime',
      genres: '/v1/genres',
      movies: '/v1/movies'
    },
    documentation: 'https://anime-stream-delta.vercel.app/api-docs',
    timestamp: new Date().toISOString()
  });
});

// Proxy all requests under /v1/* to the upstream API
const proxyRequest = async (req, res) => {
  try {
    const upstreamBase = await resolveUpstreamBaseUrl();
    const targetUrl = `${upstreamBase}${req.url}`; // req.url already starts with /...

    const config = {
      method: req.method,
      url: targetUrl,
      params: req.query,
      timeout: 10000,
      headers: {
        'User-Agent': 'KitaNime/1.0',
        'Accept': req.get('Accept') || 'application/json',
        'Content-Type': req.get('Content-Type') || 'application/json'
      }
    };

    // Add body for POST/PUT/PATCH requests
    if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
      config.data = req.body;
    }

    const response = await axios(config);

    const contentType = response.headers['content-type'] || 'application/json';
    res.status(response.status).set('content-type', contentType).send(response.data);
  } catch (error) {
    console.error(`Proxy request failed for ${req.method} ${req.url}:`, error.message);
    
    const status = error.response?.status || 502;
    let message = { error: 'Upstream request failed' };
    
    if (error.response?.data) {
      message = error.response.data;
    } else if (error.code === 'ECONNREFUSED') {
      message = { error: 'Upstream service unavailable' };
    } else if (error.code === 'ETIMEDOUT') {
      message = { error: 'Upstream request timeout' };
    }
    
    res.status(status).json({ 
      ok: false, 
      upstream: true, 
      status, 
      message,
      timestamp: new Date().toISOString()
    });
  }
};

// Handle all HTTP methods for /v1/* routes
router.get(/.* /, proxyRequest);
router.post(/.* /, proxyRequest);
router.put(/.* /, proxyRequest);
router.patch(/.* /, proxyRequest);
router.delete(/.* /, proxyRequest);

module.exports = router;


