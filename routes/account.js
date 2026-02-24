const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getUserById, updateUserProfile, updateUserPassword, setUserAvatar, getBookmarksByUser, getWatchHistory } = require('../models/database');

const router = express.Router();

function requireLogin(req, res, next) {
  if (!req.session.userId) return res.redirect('/auth/login?next=/account');
  next();
}

// Handle file uploads differently for Vercel vs local environment
const isVercel = process.env.VERCEL === '1';
let uploadDir;
let uploadEnabled = false;

if (isVercel) {
  // In Vercel, file uploads are disabled due to serverless limitations
  console.log('File uploads disabled in Vercel environment');
  uploadEnabled = false;
} else {
  // Local development - use public/uploads/avatars
  uploadDir = path.join(__dirname, '..', 'public', 'uploads', 'avatars');
  try {
    fs.mkdirSync(uploadDir, { recursive: true });
    uploadEnabled = true;
    console.log('File uploads enabled for local development');
  } catch (error) {
    console.error('Failed to create upload directory:', error);
    uploadEnabled = false;
  }
}

// Only configure multer if uploads are enabled
let upload = null;
if (uploadEnabled) {
  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const safe = `u${req.session.userId}_${Date.now()}${ext}`;
      cb(null, safe);
    }
  });

  upload = multer({
    storage,
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
    fileFilter: (req, file, cb) => {
      const allowed = ['.png', '.jpg', '.jpeg', '.webp'];
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, allowed.includes(ext));
    }
  });
}

router.get('/', requireLogin, async (req, res) => {
  try {
    const tab = req.query.tab || 'profile';
    const user = await getUserById(req.session.userId);
    const { success, error } = req.query;

    let data = {};
    if (tab === 'bookmarks') {
      const bookmarks = await getBookmarksByUser(req.session.userId);
      data = { bookmarks };
    } else if (tab === 'history') {
      const page = parseInt(req.query.page) || 1;
      const limit = 20;
      const offset = (page - 1) * limit;
      const watchHistory = await getWatchHistory(req.session.userId, limit, offset);
      data = {
        watchHistory,
        pagination: {
          page,
          limit,
          hasMore: watchHistory.length === limit,
          baseUrl: '/account?tab=history' // for pagination links
        }
      };
    }

    res.render('account/profile', {
      title: 'Akun Saya - KitaNime',
      description: 'Kelola akun, bookmark, dan riwayat tonton Anda',
      userProfile: user,
      activeTab: tab,
      success,
      error,
      ...data
    });

  } catch (e) {
    console.error('Account page error:', e);
    res.status(500).render('error', {
      title: 'Terjadi Kesalahan',
      error: { status: 500, message: 'Gagal memuat halaman akun.' }
    });
  }
});

router.post('/profile', requireLogin, async (req, res) => {
  const { name, email } = req.body;
  try {
    await updateUserProfile(req.session.userId, name, email);
    req.session.userName = name;
    req.session.userEmail = email;
    res.redirect('/account?success=profile_updated');
  } catch (e) {
    res.redirect('/account?error=profile_failed');
  }
});

router.post('/password', requireLogin, async (req, res) => {
  const { old_password, new_password } = req.body;
  try {
    await updateUserPassword(req.session.userId, old_password, new_password);
    res.redirect('/account?success=password_updated');
  } catch (e) {
    const code = e && e.message === 'INVALID_OLD_PASSWORD' ? 'invalid_old_password' : 'password_failed';
    res.redirect(`/account?error=${code}`);
  }
});

// Avatar upload route - only works when uploads are enabled
if (uploadEnabled && upload) {
  router.post('/avatar', requireLogin, upload.single('avatar'), async (req, res) => {
    try {
      if (!req.file) {
        return res.redirect('/account?error=no_file');
      }
      const relPath = `/uploads/avatars/${req.file.filename}`;
      await setUserAvatar(req.session.userId, relPath);
      res.redirect('/account?success=avatar_updated');
    } catch (e) {
      console.error('Avatar upload error:', e);
      res.redirect('/account?error=avatar_failed');
    }
  });
} else {
  // Disabled upload route for Vercel
  router.post('/avatar', requireLogin, (req, res) => {
    res.redirect('/account?error=uploads_disabled');
  });
}

router.get('/test', (req, res) => {
  res.send('Account test route is working');
});

module.exports = router;