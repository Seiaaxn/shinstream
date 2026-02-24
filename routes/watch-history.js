const express = require('express');
const router = express.Router();
const { getWatchHistory } = require('../models/database');

function requireLogin(req, res, next) {
  if (!req.session.userId) {
    return res.redirect('/auth/login?next=/watch-history');
  }
  next();
}

router.get('/', (req, res) => {
  res.redirect(301, '/account?tab=history');
});

module.exports = router;
