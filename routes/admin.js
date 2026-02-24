const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();
const {
  getAdminByUsername,
  getAllApiEndpoints,
  updateApiEndpoint,
  getAllAdSlots,
  addAdSlot,
  updateAdSlot,
  deleteAdSlot,
  getSetting,
  updateSetting,
  getAllSettings,
  updateMultipleSettings,
  addActivityLog,
  getActivityLogs,
  getActivityLogsByUser,
  getActivityLogsByAction,
  getActivityLogsCount
} = require('../models/database');
const animeApi = require('../services/animeApi');

function requireAuth(req, res, next) {
  if (req.session.adminUser) {
    next();
  } else {
    res.redirect('/admin/login');
  }
}

// Activity logging middleware
async function logActivity(req, res, next) {
  const originalSend = res.send;
  res.send = function(data) {
    // Log the activity after response is sent
    if (req.session.adminUser && req.method !== 'GET') {
      const action = `${req.method} ${req.route?.path || req.path}`;
      const description = `Admin ${req.session.adminUser.username} performed ${action}`;
      addActivityLog(
        req.session.adminUser.id,
        'admin',
        action,
        description,
        req.ip || req.connection.remoteAddress,
        req.get('User-Agent')
      ).catch(console.error);
    }
    originalSend.call(this, data);
  };
  next();
}

router.get('/login', (req, res) => {
  if (req.session.adminUser) {
    return res.redirect('/admin');
  }

  res.render('admin/login', {
    title: 'Admin Login - KitaNime',
    layout: 'admin/layout',
    error: req.query.error
  });
});

router.post('/login', logActivity, async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.redirect('/admin/login?error=missing_fields');
    }

    const admin = await getAdminByUsername(username);
    if (!admin) {
      return res.redirect('/admin/login?error=invalid_credentials');
    }

    const isValidPassword = await bcrypt.compare(password, admin.password_hash);
    if (!isValidPassword) {
      return res.redirect('/admin/login?error=invalid_credentials');
    }

    req.session.adminUser = {
      id: admin.id,
      username: admin.username,
      email: admin.email
    };

    res.redirect('/admin');
  } catch (error) {
    console.error('Admin login error:', error);
    res.redirect('/admin/login?error=server_error');
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
    }
    res.redirect('/admin/login');
  });
});

router.get('/', requireAuth, async (req, res) => {
  try {
    const [apiEndpoints, adSlots, recentActivities] = await Promise.all([
      getAllApiEndpoints(),
      getAllAdSlots(),
      getActivityLogs(10, 0) // Get latest 10 activities
    ]);

    res.render('admin/dashboard', {
      title: 'Admin Dashboard - KitaNime',
      layout: 'admin/layout',
      user: req.session.adminUser,
      stats: {
        apiEndpoints: apiEndpoints.length,
        adSlots: adSlots.length,
        activeAdSlots: adSlots.filter(slot => slot.is_active).length
      },
      recentActivities,
      req: req
    });
  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.render('admin/error', {
      title: 'Error - Admin KitaNime',
      layout: 'admin/layout',
      error: 'Tidak dapat memuat dashboard'
    });
  }
});

router.get('/api-endpoints', requireAuth, async (req, res) => {
  try {
    const endpoints = await getAllApiEndpoints();

    res.render('admin/api-endpoints', {
      title: 'Kelola API Endpoints - Admin KitaNime',
      layout: 'admin/layout',
      user: req.session.adminUser,
      endpoints,
      req: req
    });
  } catch (error) {
    console.error('API endpoints page error:', error);
    res.render('admin/error', {
      title: 'Error - Admin KitaNime',
      layout: 'admin/layout',
      error: 'Tidak dapat memuat data API endpoints'
    });
  }
});

router.get('/api-health', requireAuth, async (req, res) => {
  try {
    res.render('admin/api-health', {
      title: 'Cek Koneksi API - Admin KitaNime',
      layout: 'admin/layout',
      user: req.session.adminUser,
      req
    });
  } catch (error) {
    res.render('admin/error', { title: 'Error', layout: 'admin/layout', error: 'Tidak dapat membuka halaman health' });
  }
});

router.get('/api-health/check', requireAuth, async (req, res) => {
  try {
    const result = await animeApi.checkConnectivity();
    res.json(result);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.post('/api-endpoints/:id', requireAuth, logActivity, async (req, res) => {
  try {
    const { id } = req.params;
    const { url, is_active } = req.body;

    await updateApiEndpoint(id, url, is_active === 'on');

    res.redirect('/admin/api-endpoints?success=updated');
  } catch (error) {
    console.error('Update API endpoint error:', error);
    res.redirect('/admin/api-endpoints?error=update_failed');
  }
});

router.get('/ad-slots', requireAuth, async (req, res) => {
  try {
    const adSlots = await getAllAdSlots();

    res.render('admin/ad-slots', {
      title: 'Kelola Slot Iklan - Admin KitaNime',
      layout: 'admin/layout',
      user: req.session.adminUser,
      adSlots,
      req: req
    });
  } catch (error) {
    console.error('Ad slots page error:', error);
    res.render('admin/error', {
      title: 'Error - Admin KitaNime',
      layout: 'admin/layout',
      error: 'Tidak dapat memuat data slot iklan'
    });
  }
});

router.post('/ad-slots', requireAuth, logActivity, async (req, res) => {
  try {
    const { name, position, type, content, is_active } = req.body;

    await addAdSlot(name, position, type, content, is_active === 'on');

    res.redirect('/admin/ad-slots?success=added');
  } catch (error) {
    console.error('Add ad slot error:', error);
    res.redirect('/admin/ad-slots?error=add_failed');
  }
});

router.post('/ad-slots/:id', requireAuth, logActivity, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, position, type, content, is_active } = req.body;

    await updateAdSlot(id, name, position, type, content, is_active === 'on');

    res.redirect('/admin/ad-slots?success=updated');
  } catch (error) {
    console.error('Update ad slot error:', error);
    res.redirect('/admin/ad-slots?error=update_failed');
  }
});

router.delete('/ad-slots/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    await deleteAdSlot(id);

    res.json({ success: true });
  } catch (error) {
    console.error('Delete ad slot error:', error);
    res.status(500).json({ error: 'Delete failed' });
  }
});

router.get('/settings', requireAuth, async (req, res) => {
  try {
    const allSettings = await getAllSettings();
    
    // Parse social media JSON
    let socialMedia = {};
    try {
      socialMedia = JSON.parse(allSettings.social_media || '{}');
    } catch (e) {
      socialMedia = {};
    }

    res.render('admin/settings', {
      title: 'Pengaturan - Admin KitaNime',
      layout: 'admin/layout',
      user: req.session.adminUser,
      settings: {
        ...allSettings,
        cookie_consent_enabled: allSettings.cookie_consent_enabled === '1',
        adsense_enabled: allSettings.adsense_enabled === '1',
        social_media: socialMedia
      },
      req: req
    });
  } catch (error) {
    console.error('Settings page error:', error);
    res.render('admin/error', {
      title: 'Error - Admin KitaNime',
      layout: 'admin/layout',
      error: 'Tidak dapat memuat pengaturan'
    });
  }
});

router.post('/settings', requireAuth, logActivity, async (req, res) => {
  try {
    const {
      site_title,
      site_description,
      site_tagline,
      cookie_consent_enabled,
      adsense_enabled,
      contact_email,
      contact_phone,
      contact_address,
      privacy_policy,
      terms_of_service,
      help_center,
      dmca_policy,
      about_us,
      facebook,
      twitter,
      instagram,
      youtube,
      discord
    } = req.body;

    // Prepare social media object
    const socialMedia = {
      facebook: facebook || '',
      twitter: twitter || '',
      instagram: instagram || '',
      youtube: youtube || '',
      discord: discord || ''
    };

    const settingsToUpdate = {
      site_title,
      site_description,
      site_tagline,
      cookie_consent_enabled: cookie_consent_enabled === 'on' ? '1' : '0',
      adsense_enabled: adsense_enabled === 'on' ? '1' : '0',
      contact_email,
      contact_phone,
      contact_address,
      privacy_policy,
      terms_of_service,
      help_center,
      dmca_policy,
      about_us,
      social_media: JSON.stringify(socialMedia)
    };

    await updateMultipleSettings(settingsToUpdate);

    res.redirect('/admin/settings?success=updated');
  } catch (error) {
    console.error('Update settings error:', error);
    res.redirect('/admin/settings?error=update_failed');
  }
});

router.get('/preview', requireAuth, (req, res) => {
  res.render('admin/preview', {
    title: 'Preview Website - Admin KitaNime',
    layout: 'admin/layout',
    user: req.session.adminUser
  });
});

router.get('/activity-logs', requireAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;
    const action = req.query.action;
    const userId = req.query.user_id;

    let logs, totalCount;
    
    if (action) {
      logs = await getActivityLogsByAction(action, limit, offset);
      totalCount = await getActivityLogsCount();
    } else if (userId) {
      logs = await getActivityLogsByUser(userId, limit, offset);
      totalCount = await getActivityLogsCount();
    } else {
      logs = await getActivityLogs(limit, offset);
      totalCount = await getActivityLogsCount();
    }

    const totalPages = Math.ceil(totalCount / limit);

    res.render('admin/activity-logs', {
      title: 'Activity Logs - Admin KitaNime',
      layout: 'admin/layout',
      user: req.session.adminUser,
      logs,
      pagination: {
        currentPage: page,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
        nextPage: page + 1,
        prevPage: page - 1
      },
      filters: {
        action,
        userId
      },
      req
    });
  } catch (error) {
    console.error('Activity logs page error:', error);
    res.render('admin/error', {
      title: 'Error - Admin KitaNime',
      layout: 'admin/layout',
      error: 'Tidak dapat memuat activity logs'
    });
  }
});

module.exports = router;
