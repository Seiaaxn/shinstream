const express = require('express');
const { addBookmark, removeBookmark, getBookmarksByUser } = require('../models/database');

const router = express.Router();

function requireLogin(req, res, next) {
  if (!req.session.userId) {
    const nextUrl = encodeURIComponent(req.originalUrl);
    return res.redirect(`/auth/login?next=${nextUrl}`);
  }
  next();
}

router.get('/', (req, res) => {
  res.redirect(301, '/account?tab=bookmarks');
});

router.post('/add', requireLogin, async (req, res) => {
  const { animeId, animeTitle, animeSlug, posterUrl } = req.body;
  if (!animeId || !animeSlug) return res.status(400).json({ success: false, message: 'Data tidak lengkap' });
  try {
    await addBookmark(req.session.userId, animeId, animeTitle || '', animeSlug, posterUrl || '');
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false });
  }
});

router.post('/remove', requireLogin, async (req, res) => {
  const { animeId } = req.body;
  if (!animeId) return res.status(400).json({ success: false });
  try {
    await removeBookmark(req.session.userId, animeId);
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false });
  }
});

module.exports = router;


