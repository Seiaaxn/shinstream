const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');
const logger = require('../services/logger');

// Handle database path for different environments
const isVercel = process.env.VERCEL === '1';
let dataDir, dbPath;

if (isVercel) {
  // In Vercel, use /tmp directory which is writable
  dataDir = '/tmp';
  dbPath = path.join(dataDir, 'kitanime.db');
  logger.info('Using /tmp directory for database in Vercel environment');
} else {
  // Local development - use data directory
  dataDir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(dataDir)) {
    try { fs.mkdirSync(dataDir, { recursive: true }); } catch (e) { /* ignore */ }
  }
  dbPath = path.join(dataDir, 'kitanime.db');
  logger.info('Using local data directory for database');
}

// Create database connection with proper error handling
let db;
let dbReady = false;
let dbInitialized = false;

const createDatabaseConnection = () => {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        logger.error('Error opening database:', err.message);
        reject(err);
      } else {
        logger.info('Connected to SQLite database');

        // Configure database settings optimized for production
        db.serialize(() => {
          const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';

          // Enable WAL mode for better concurrent access
          db.run('PRAGMA journal_mode=WAL');
          // Enable foreign keys
          db.run('PRAGMA foreign_keys=ON');

          if (isProduction) {
            // Production optimizations
            db.run('PRAGMA synchronous=NORMAL');
            db.run('PRAGMA cache_size=20000'); // Increased cache for production
            db.run('PRAGMA temp_store=MEMORY');
            db.run('PRAGMA mmap_size=536870912'); // 512MB memory mapping for production
            db.run('PRAGMA page_size=4096');
            db.run('PRAGMA optimize');
            // Additional production settings
            db.run('PRAGMA auto_vacuum=INCREMENTAL');
            db.run('PRAGMA incremental_vacuum');
          } else {
            // Development settings
            db.run('PRAGMA synchronous=FULL');
            db.run('PRAGMA cache_size=10000');
            db.run('PRAGMA temp_store=MEMORY');
            db.run('PRAGMA mmap_size=268435456'); // 256MB memory mapping
            db.run('PRAGMA page_size=4096');
            db.run('PRAGMA optimize');
          }

          // Mark database as ready
          dbReady = true;
          resolve(db);
        });
      }
    });
  });
};

// Initialize database connection and tables
createDatabaseConnection()
  .then(async (database) => {
    // Initialize tables after connection is established
    try {
      await initializeDatabase();
      dbInitialized = true;
      logger.info('Database and tables initialized successfully');
    } catch (err) {
      logger.error('Failed to initialize database tables:', err);
      dbInitialized = false;
    }
  })
  .catch(err => {
    logger.error('Failed to create database connection:', err);
    dbReady = false;
    dbInitialized = false;
  });

// Connection pool simulation for better performance
const connectionPool = {
  connections: [],
  maxConnections: 5,
  activeConnections: 0,

  async getConnection() {
    if (this.activeConnections < this.maxConnections) {
      this.activeConnections++;
      return db;
    }
    // In a real implementation, you'd queue requests or create new connections
    return db;
  },

  releaseConnection() {
    this.activeConnections = Math.max(0, this.activeConnections - 1);
  }
};

// Enhanced query executor with better error handling
const executeQuery = (query, params = []) => {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    db.all(query, params, (err, rows) => {
      const duration = Date.now() - startTime;
      if (err) {
        logger.error(`Query failed (${duration}ms):`, query, err.message);
        reject(err);
      } else {
        if (duration > 100) { // Log slow queries
          logger.warn(`Slow query detected (${duration}ms):`, query);
        }
        resolve(rows || []);
      }
    });
  });
};

const executeQuerySingle = (query, params = []) => {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    db.get(query, params, (err, row) => {
      const duration = Date.now() - startTime;
      if (err) {
        logger.error(`Query failed (${duration}ms):`, query, err.message);
        reject(err);
      } else {
        if (duration > 100) {
          logger.warn(`Slow query detected (${duration}ms):`, query);
        }
        resolve(row || null);
      }
    });
  });
};

const executeUpdate = (query, params = []) => {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    db.run(query, params, function (err) {
      const duration = Date.now() - startTime;
      if (err) {
        logger.error(`Update failed (${duration}ms):`, query, err.message);
        reject(err);
      } else {
        if (duration > 100) {
          logger.warn(`Slow update detected (${duration}ms):`, query);
        }
        resolve({ changes: this.changes, lastID: this.lastID });
      }
    });
  });
};

async function initializeDatabase() {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database connection not available'));
      return;
    }

    db.serialize(() => {
      // Create tables
      db.run(`CREATE TABLE IF NOT EXISTS api_endpoints (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        url TEXT NOT NULL,
        is_active INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS ad_slots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        position TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('adsense', 'banner')),
        content TEXT NOT NULL,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS admin_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        email TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT NOT NULL UNIQUE,
        value TEXT,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      // Users table for account and login
      db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        avatar_url TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      // Bookmarks table, unique per user per anime_id
      db.run(`CREATE TABLE IF NOT EXISTS bookmarks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        anime_id TEXT NOT NULL,
        anime_title TEXT,
        anime_slug TEXT,
        poster_url TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, anime_id),
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      )`);

      // Activity logs table for admin panel
      db.run(`CREATE TABLE IF NOT EXISTS activity_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        user_type TEXT DEFAULT 'admin',
        action TEXT NOT NULL,
        description TEXT,
        ip_address TEXT,
        user_agent TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      // Comments system tables
      db.run(`CREATE TABLE IF NOT EXISTS comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        anime_slug TEXT NOT NULL,
        episode_number INTEGER,
        parent_id INTEGER,
        content TEXT NOT NULL,
        is_approved INTEGER DEFAULT 1,
        is_pinned INTEGER DEFAULT 0,
        likes_count INTEGER DEFAULT 0,
        replies_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY(parent_id) REFERENCES comments(id) ON DELETE CASCADE
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS comment_likes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        comment_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, comment_id),
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY(comment_id) REFERENCES comments(id) ON DELETE CASCADE
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS comment_reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        comment_id INTEGER NOT NULL,
        reason TEXT NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY(comment_id) REFERENCES comments(id) ON DELETE CASCADE
      )`);

      // User preferences and settings
      db.run(`CREATE TABLE IF NOT EXISTS user_preferences (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL UNIQUE,
        theme TEXT DEFAULT 'auto',
        auto_play_next INTEGER DEFAULT 0,
        video_quality TEXT DEFAULT 'auto',
        comment_notifications INTEGER DEFAULT 1,
        email_notifications INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      )`);

      // Watch history and progress tracking
      db.run(`CREATE TABLE IF NOT EXISTS watch_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        anime_slug TEXT NOT NULL,
        episode_number INTEGER NOT NULL,
        watch_time REAL DEFAULT 0,
        total_duration REAL DEFAULT 0,
        completed INTEGER DEFAULT 0,
        last_watched DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, anime_slug, episode_number),
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      )`);

      // Anime ratings and reviews
      db.run(`CREATE TABLE IF NOT EXISTS anime_ratings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        anime_slug TEXT NOT NULL,
        rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 10),
        review TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, anime_slug),
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      )`);

      // Create indexes for better query performance
      db.run(`CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_bookmarks_user_id ON bookmarks(user_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_bookmarks_anime_id ON bookmarks(anime_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_api_endpoints_active ON api_endpoints(is_active)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_ad_slots_position ON ad_slots(position)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_ad_slots_active ON ad_slots(is_active)`);

      // Comments system indexes
      db.run(`CREATE INDEX IF NOT EXISTS idx_comments_anime_slug ON comments(anime_slug)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_comments_user_id ON comments(user_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON comments(parent_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments(created_at)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_comments_episode ON comments(anime_slug, episode_number)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_comment_likes_user_id ON comment_likes(user_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_comment_likes_comment_id ON comment_likes(comment_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_comment_reports_comment_id ON comment_reports(comment_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_comment_reports_status ON comment_reports(status)`);

      // User preferences and watch history indexes
      db.run(`CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_watch_history_user_id ON watch_history(user_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_watch_history_anime ON watch_history(anime_slug)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_watch_history_last_watched ON watch_history(last_watched)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_anime_ratings_user_id ON anime_ratings(user_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_anime_ratings_anime_slug ON anime_ratings(anime_slug)`);

      // Insert default data with error handling
      insertDefaultData()
        .then(() => {
          logger.info('Database initialization completed successfully');
          resolve();
        })
        .catch(err => {
          logger.error('Error during database initialization:', err);
          reject(err);
        });
    });
  });
}

// Ensure new columns exist on older databases - only run after database is ready
const ensureColumnsExist = () => {
  if (!db || !dbReady) {
    logger.debug('Database not ready, skipping column check');
    return;
  }

  try {
    db.get("PRAGMA table_info(users)", (err, row) => {
      if (!err) {
        db.all("PRAGMA table_info(users)", (e2, rows) => {
          if (!e2) {
            const hasAvatar = rows.some(r => r.name === 'avatar_url');
            if (!hasAvatar) {
              db.run("ALTER TABLE users ADD COLUMN avatar_url TEXT", () => {
                logger.info('Added avatar_url column to users table');
              });
            }
          }
        });
      }
    });
  } catch (error) {
    logger.error('Error checking user table columns:', error);
  }
};

// Run column check after database initialization
setTimeout(ensureColumnsExist, 1000);

async function insertDefaultData() {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database connection not available'));
      return;
    }

    let completed = 0;
    const total = 4;
    let hasError = false;

    const checkComplete = () => {
      completed++;
      if (completed === total && !hasError) {
        resolve();
      }
    };

    const handleError = (err) => {
      if (!hasError) {
        hasError = true;
        reject(err);
      }
    };

    // Insert default API endpoint
    db.get("SELECT COUNT(*) as count FROM api_endpoints", (err, row) => {
      if (err) {
        logger.error('Error checking api_endpoints:', err);
        handleError(err);
        return;
      }

      if (row.count === 0) {
        db.run(`INSERT INTO api_endpoints (name, url, is_active) VALUES
          ('Default API', 'https://anime-stream-delta.vercel.app/v1', 1)`, (err) => {
          if (err) {
            logger.error('Error inserting default API endpoint:', err);
            handleError(err);
          } else {
            logger.info('Default API endpoint inserted');
            checkComplete();
          }
        });
      } else {
        checkComplete();
      }
    });

    // Insert default admin user
    db.get("SELECT COUNT(*) as count FROM admin_users", async (err, row) => {
      if (err) {
        logger.error('Error checking admin_users:', err);
        handleError(err);
        return;
      }

      if (row.count === 0) {
        try {
          const hashedPassword = await bcrypt.hash('admin123', 10);
          db.run(`INSERT INTO admin_users (username, password_hash, email) VALUES
            ('admin', ?, 'admin@kitanime.com')`, [hashedPassword], (err) => {
            if (err) {
              logger.error('Error inserting default admin user:', err);
              handleError(err);
            } else {
              logger.info('Default admin user inserted');
              checkComplete();
            }
          });
        } catch (error) {
          logger.error('Error hashing admin password:', error);
          handleError(error);
        }
      } else {
        checkComplete();
      }
    });

    // Insert default ad slots
    db.get("SELECT COUNT(*) as count FROM ad_slots", (err, row) => {
      if (err) {
        logger.error('Error checking ad_slots:', err);
        handleError(err);
        return;
      }

      if (row.count === 0) {
        db.run(`INSERT INTO ad_slots (name, position, type, content, is_active) VALUES
          ('Header Banner', 'header', 'banner', '<img src="/images/ads/header-banner.jpg" alt="Advertisement" class="w-full h-20 object-cover rounded-lg">', 1),
          ('Sidebar Top', 'sidebar-top', 'adsense', '<ins class="adsbygoogle" style="display:block" data-ad-client="ca-pub-xxxxxxxxxx" data-ad-slot="xxxxxxxxxx" data-ad-format="auto"></ins>', 1),
          ('Content Bottom', 'content-bottom', 'banner', '<img src="/images/ads/content-banner.jpg" alt="Advertisement" class="w-full h-32 object-cover rounded-lg">', 1)`, (err) => {
          if (err) {
            logger.error('Error inserting default ad slots:', err);
            handleError(err);
          } else {
            logger.info('Default ad slots inserted');
            checkComplete();
          }
        });
      } else {
        checkComplete();
      }
    });

    // Insert default settings
    db.get("SELECT COUNT(*) as count FROM settings", (err, row) => {
      if (err) {
        logger.error('Error checking settings:', err);
        handleError(err);
        return;
      }

      if (row.count === 0) {
        db.run(`INSERT INTO settings (key, value, description) VALUES
          ('site_title', 'KitaNime - Streaming Anime Subtitle Indonesia', 'Judul website'),
          ('site_description', 'Nonton anime subtitle Indonesia terlengkap dan terbaru', 'Deskripsi website'),
          ('cookie_consent_enabled', '1', 'Enable cookie consent popup'),
          ('adsense_enabled', '0', 'Enable Google AdSense'),
          ('contact_email', 'admin@kitanime.com', 'Email kontak'),
          ('contact_phone', '+62 123 456 7890', 'Nomor telepon kontak'),
          ('contact_address', 'Jakarta, Indonesia', 'Alamat kontak'),
          ('privacy_policy', 'Kebijakan Privasi:\n\n1. Informasi yang Kami Kumpulkan\n2. Cara Kami Menggunakan Informasi\n3. Perlindungan Data\n4. Cookie dan Teknologi Pelacakan\n5. Hak Anda\n6. Perubahan Kebijakan', 'Kebijakan privasi website'),
          ('terms_of_service', 'Syarat dan Ketentuan:\n\n1. Penggunaan Layanan\n2. Akun Pengguna\n3. Konten dan Hak Kekayaan Intelektual\n4. Larangan Penggunaan\n5. Tanggung Jawab\n6. Perubahan Layanan', 'Syarat dan ketentuan layanan'),
          ('help_center', 'Pusat Bantuan:\n\n1. Cara Menggunakan Website\n2. Masalah Teknis\n3. Akun dan Profil\n4. Pembayaran dan Donasi\n5. FAQ\n6. Hubungi Kami', 'Pusat bantuan pengguna'),
          ('dmca_policy', 'Kebijakan DMCA:\n\n1. Pemberitahuan Pelanggaran Hak Cipta\n2. Prosedur Penghapusan\n3. Kontra-Pemberitahuan\n4. Pengulangan Pelanggaran\n5. Informasi Kontak DMCA', 'Kebijakan DMCA dan hak cipta'),
          ('about_us', 'Tentang KitaNime:\n\nKitaNime adalah platform streaming anime terlengkap dengan subtitle Indonesia. Kami berkomitmen menyediakan pengalaman menonton anime yang terbaik dengan kualitas HD dan update terbaru setiap hari.', 'Tentang website'),
          ('social_media', '{"facebook":"","twitter":"","instagram":"","youtube":"","discord":""}', 'Link media sosial (JSON format)')`, (err) => {
          if (err) {
            logger.error('Error inserting default settings:', err);
            handleError(err);
          } else {
            logger.info('Default settings inserted');
            checkComplete();
          }
        });
      } else {
        checkComplete();
      }
    });
  });
}

const dbHelpers = {

  getActiveApiEndpoint: async () => {
    try {
      const row = await executeQuerySingle("SELECT url FROM api_endpoints WHERE is_active = 1 LIMIT 1");
      return row ? row.url : null;
    } catch (error) {
      logger.error('Error getting active API endpoint:', error);
      return null;
    }
  },

  getAllApiEndpoints: async () => {
    try {
      return await executeQuery("SELECT * FROM api_endpoints ORDER BY created_at DESC");
    } catch (error) {
      logger.error('Error getting all API endpoints:', error);
      return [];
    }
  },

  updateApiEndpoint: (id, url, isActive) => {
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        if (isActive) {

          db.run("UPDATE api_endpoints SET is_active = 0");
        }

        db.run("UPDATE api_endpoints SET url = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
          [url, isActive ? 1 : 0, id], function (err) {
            if (err) reject(err);
            else resolve(this.changes);
          });
      });
    });
  },

  getAdSlotsByPosition: (position) => {
    return new Promise((resolve, reject) => {
      db.all("SELECT * FROM ad_slots WHERE position = ? AND is_active = 1", [position], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  },

  getAllAdSlots: () => {
    return new Promise((resolve, reject) => {
      db.all("SELECT * FROM ad_slots ORDER BY position, created_at DESC", (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  },

  addAdSlot: (name, position, type, content, isActive) => {
    return new Promise((resolve, reject) => {
      db.run("INSERT INTO ad_slots (name, position, type, content, is_active) VALUES (?, ?, ?, ?, ?)",
        [name, position, type, content, isActive ? 1 : 0], function (err) {
          if (err) reject(err);
          else resolve(this.lastID);
        });
    });
  },

  updateAdSlot: (id, name, position, type, content, isActive) => {
    return new Promise((resolve, reject) => {
      db.run("UPDATE ad_slots SET name = ?, position = ?, type = ?, content = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [name, position, type, content, isActive ? 1 : 0, id], function (err) {
          if (err) reject(err);
          else resolve(this.changes);
        });
    });
  },

  deleteAdSlot: (id) => {
    return new Promise((resolve, reject) => {
      db.run("DELETE FROM ad_slots WHERE id = ?", [id], function (err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });
  },

  getAdminByUsername: (username) => {
    return new Promise((resolve, reject) => {
      db.get("SELECT * FROM admin_users WHERE username = ?", [username], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  },

  getSetting: (key) => {
    return new Promise((resolve, reject) => {
      db.get("SELECT value FROM settings WHERE key = ?", [key], (err, row) => {
        if (err) reject(err);
        else resolve(row ? row.value : null);
      });
    });
  },

  updateSetting: (key, value) => {
    return new Promise((resolve, reject) => {
      db.run("UPDATE settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?",
        [value, key], function (err) {
          if (err) reject(err);
          else resolve(this.changes);
        });
    });
  },

  getAllSettings: () => {
    return new Promise((resolve, reject) => {
      db.all("SELECT key, value FROM settings", (err, rows) => {
        if (err) reject(err);
        else {
          const settings = {};
          rows.forEach(row => {
            settings[row.key] = row.value;
          });
          resolve(settings);
        }
      });
    });
  },

  updateMultipleSettings: (settings) => {
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        const stmt = db.prepare("UPDATE settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?");
        let completed = 0;
        const total = Object.keys(settings).length;

        if (total === 0) {
          resolve();
          return;
        }

        Object.entries(settings).forEach(([key, value]) => {
          stmt.run([value, key], function (err) {
            if (err) {
              reject(err);
              return;
            }
            completed++;
            if (completed === total) {
              stmt.finalize();
              resolve();
            }
          });
        });
      });
    });
  },

  // User helpers
  createUser: async (name, email, password) => {
    const passwordHash = await bcrypt.hash(password, 10);
    return new Promise((resolve, reject) => {
      db.run("INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)",
        [name, email, passwordHash], function (err) {
          if (err) reject(err);
          else resolve({ id: this.lastID, name, email });
        });
    });
  },

  getUserByEmail: (email) => {
    return new Promise((resolve, reject) => {
      db.get("SELECT * FROM users WHERE email = ?", [email], (err, row) => {
        if (err) reject(err);
        else resolve(row || null);
      });
    });
  },

  getUserById: (id) => {
    return new Promise((resolve, reject) => {
      db.get("SELECT id, name, email, avatar_url FROM users WHERE id = ?", [id], (err, row) => {
        if (err) reject(err);
        else resolve(row || null);
      });
    });
  },

  updateUserProfile: (id, name, email) => {
    return new Promise((resolve, reject) => {
      db.run(
        "UPDATE users SET name = ?, email = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [name, email, id],
        function (err) {
          if (err) reject(err);
          else resolve(this.changes);
        }
      );
    });
  },

  setUserAvatar: (id, avatarUrl) => {
    return new Promise((resolve, reject) => {
      db.run(
        "UPDATE users SET avatar_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [avatarUrl, id],
        function (err) {
          if (err) reject(err);
          else resolve(this.changes);
        }
      );
    });
  },

  updateUserPassword: async (id, oldPassword, newPassword) => {
    return new Promise((resolve, reject) => {
      db.get("SELECT password_hash FROM users WHERE id = ?", [id], async (err, row) => {
        if (err) return reject(err);
        if (!row) return reject(new Error('User not found'));
        try {
          const ok = await bcrypt.compare(oldPassword, row.password_hash);
          if (!ok) return reject(new Error('INVALID_OLD_PASSWORD'));
          const newHash = await bcrypt.hash(newPassword, 10);
          db.run("UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [newHash, id], function (e2) {
            if (e2) reject(e2); else resolve(this.changes);
          });
        } catch (e) { reject(e); }
      });
    });
  },

  // Bookmark helpers
  addBookmark: (userId, animeId, animeTitle, animeSlug, posterUrl) => {
    return new Promise((resolve, reject) => {
      db.run(
        "INSERT OR IGNORE INTO bookmarks (user_id, anime_id, anime_title, anime_slug, poster_url) VALUES (?, ?, ?, ?, ?)",
        [userId, animeId, animeTitle, animeSlug, posterUrl],
        function (err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
  },

  removeBookmark: (userId, animeId) => {
    return new Promise((resolve, reject) => {
      db.run("DELETE FROM bookmarks WHERE user_id = ? AND anime_id = ?", [userId, animeId], function (err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });
  },

  getBookmarksByUser: (userId) => {
    return new Promise((resolve, reject) => {
      db.all(
        "SELECT anime_id, anime_title, anime_slug, poster_url, created_at FROM bookmarks WHERE user_id = ? ORDER BY created_at DESC",
        [userId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  },

  isBookmarked: (userId, animeId) => {
    return new Promise((resolve, reject) => {
      db.get("SELECT 1 FROM bookmarks WHERE user_id = ? AND anime_id = ? LIMIT 1", [userId, animeId], (err, row) => {
        if (err) reject(err);
        else resolve(!!row);
      });
    });
  },

  // Activity log helpers
  addActivityLog: (userId, userType, action, description, ipAddress, userAgent) => {
    return new Promise((resolve, reject) => {
      db.run(
        "INSERT INTO activity_logs (user_id, user_type, action, description, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?)",
        [userId, userType, action, description, ipAddress, userAgent],
        function (err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
  },

  getActivityLogs: (limit = 50, offset = 0) => {
    return new Promise((resolve, reject) => {
      db.all(
        "SELECT al.*, u.name as user_name FROM activity_logs al LEFT JOIN users u ON al.user_id = u.id ORDER BY al.created_at DESC LIMIT ? OFFSET ?",
        [limit, offset],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  },

  getActivityLogsByUser: (userId, limit = 50, offset = 0) => {
    return new Promise((resolve, reject) => {
      db.all(
        "SELECT * FROM activity_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?",
        [userId, limit, offset],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  },

  getActivityLogsByAction: (action, limit = 50, offset = 0) => {
    return new Promise((resolve, reject) => {
      db.all(
        "SELECT * FROM activity_logs WHERE action = ? ORDER BY created_at DESC LIMIT ? OFFSET ?",
        [action, limit, offset],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  },

  getActivityLogsCount: () => {
    return new Promise((resolve, reject) => {
      db.get("SELECT COUNT(*) as count FROM activity_logs", (err, row) => {
        if (err) reject(err);
        else resolve(row ? row.count : 0);
      });
    });
  },

  // Comments system helpers
  addComment: (userId, animeSlug, episodeNumber, parentId, content) => {
    return new Promise((resolve, reject) => {
      db.run(
        "INSERT INTO comments (user_id, anime_slug, episode_number, parent_id, content) VALUES (?, ?, ?, ?, ?)",
        [userId, animeSlug, episodeNumber, parentId, content],
        function (err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
  },

  getComments: (animeSlug, episodeNumber = null, limit = 50, offset = 0) => {
    return new Promise((resolve, reject) => {
      let query = `
        SELECT c.*, u.name as user_name, u.avatar_url,
               (SELECT COUNT(*) FROM comment_likes cl WHERE cl.comment_id = c.id) as likes_count,
               (SELECT COUNT(*) FROM comments c2 WHERE c2.parent_id = c.id) as replies_count
        FROM comments c
        LEFT JOIN users u ON c.user_id = u.id
        WHERE c.anime_slug = ? AND c.is_approved = 1 AND c.parent_id IS NULL
      `;
      let params = [animeSlug];

      if (episodeNumber !== null) {
        query += " AND (c.episode_number = ? OR c.episode_number IS NULL)";
        params.push(episodeNumber);
      }

      query += " ORDER BY c.is_pinned DESC, c.created_at DESC LIMIT ? OFFSET ?";
      params.push(limit, offset);

      db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  },

  getCommentReplies: (parentId, limit = 20, offset = 0) => {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT c.*, u.name as user_name, u.avatar_url,
               (SELECT COUNT(*) FROM comment_likes cl WHERE cl.comment_id = c.id) as likes_count
        FROM comments c
        LEFT JOIN users u ON c.user_id = u.id
        WHERE c.parent_id = ? AND c.is_approved = 1
        ORDER BY c.created_at ASC
        LIMIT ? OFFSET ?
      `;
      db.all(query, [parentId, limit, offset], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  },

  likeComment: (userId, commentId) => {
    return new Promise((resolve, reject) => {
      db.run(
        "INSERT OR IGNORE INTO comment_likes (user_id, comment_id) VALUES (?, ?)",
        [userId, commentId],
        function (err) {
          if (err) reject(err);
          else {
            // Update likes count
            db.run(
              "UPDATE comments SET likes_count = (SELECT COUNT(*) FROM comment_likes WHERE comment_id = ?) WHERE id = ?",
              [commentId, commentId],
              (err2) => {
                if (err2) reject(err2);
                else resolve(this.changes);
              }
            );
          }
        }
      );
    });
  },

  unlikeComment: (userId, commentId) => {
    return new Promise((resolve, reject) => {
      db.run(
        "DELETE FROM comment_likes WHERE user_id = ? AND comment_id = ?",
        [userId, commentId],
        function (err) {
          if (err) reject(err);
          else {
            // Update likes count
            db.run(
              "UPDATE comments SET likes_count = (SELECT COUNT(*) FROM comment_likes WHERE comment_id = ?) WHERE id = ?",
              [commentId, commentId],
              (err2) => {
                if (err2) reject(err2);
                else resolve(this.changes);
              }
            );
          }
        }
      );
    });
  },

  isCommentLiked: (userId, commentId) => {
    return new Promise((resolve, reject) => {
      db.get(
        "SELECT 1 FROM comment_likes WHERE user_id = ? AND comment_id = ? LIMIT 1",
        [userId, commentId],
        (err, row) => {
          if (err) reject(err);
          else resolve(!!row);
        }
      );
    });
  },

  reportComment: (userId, commentId, reason, description) => {
    return new Promise((resolve, reject) => {
      db.run(
        "INSERT INTO comment_reports (user_id, comment_id, reason, description) VALUES (?, ?, ?, ?)",
        [userId, commentId, reason, description],
        function (err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
  },

  deleteComment: (commentId, userId) => {
    return new Promise((resolve, reject) => {
      db.run(
        "DELETE FROM comments WHERE id = ? AND user_id = ?",
        [commentId, userId],
        function (err) {
          if (err) reject(err);
          else resolve(this.changes);
        }
      );
    });
  },

  // User preferences helpers
  getUserPreferences: (userId) => {
    return new Promise((resolve, reject) => {
      db.get("SELECT * FROM user_preferences WHERE user_id = ?", [userId], (err, row) => {
        if (err) reject(err);
        else resolve(row || null);
      });
    });
  },

  updateUserPreferences: (userId, preferences) => {
    return new Promise((resolve, reject) => {
      const { theme, auto_play_next, video_quality, comment_notifications, email_notifications } = preferences;
      db.run(
        `INSERT OR REPLACE INTO user_preferences 
         (user_id, theme, auto_play_next, video_quality, comment_notifications, email_notifications, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [userId, theme, auto_play_next, video_quality, comment_notifications, email_notifications],
        function (err) {
          if (err) reject(err);
          else resolve(this.changes);
        }
      );
    });
  },

  // Watch history helpers
  updateWatchHistory: (userId, animeSlug, episodeNumber, watchTime, totalDuration, completed = 0) => {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT OR REPLACE INTO watch_history 
         (user_id, anime_slug, episode_number, watch_time, total_duration, completed, last_watched)
         VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [userId, animeSlug, episodeNumber, watchTime, totalDuration, completed],
        function (err) {
          if (err) reject(err);
          else resolve(this.changes);
        }
      );
    });
  },

  getWatchHistory: (userId, limit = 50, offset = 0) => {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT wh.*, 
               (SELECT COUNT(*) FROM watch_history wh2 WHERE wh2.anime_slug = wh.anime_slug AND wh2.user_id = wh.user_id) as total_episodes_watched
        FROM watch_history wh
        WHERE wh.user_id = ?
        ORDER BY wh.last_watched DESC
        LIMIT ? OFFSET ?
      `;
      db.all(query, [userId, limit, offset], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  },

  getWatchProgress: (userId, animeSlug) => {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT episode_number, watch_time, total_duration, completed, last_watched
        FROM watch_history
        WHERE user_id = ? AND anime_slug = ?
        ORDER BY episode_number ASC
      `;
      db.all(query, [userId, animeSlug], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  },

  // Anime ratings helpers
  addAnimeRating: (userId, animeSlug, rating, review = null) => {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT OR REPLACE INTO anime_ratings (user_id, anime_slug, rating, review, updated_at)
         VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [userId, animeSlug, rating, review],
        function (err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
  },

  getAnimeRating: (userId, animeSlug) => {
    return new Promise((resolve, reject) => {
      db.get(
        "SELECT * FROM anime_ratings WHERE user_id = ? AND anime_slug = ?",
        [userId, animeSlug],
        (err, row) => {
          if (err) reject(err);
          else resolve(row || null);
        }
      );
    });
  },

  getAnimeAverageRating: (animeSlug) => {
    return new Promise((resolve, reject) => {
      db.get(
        "SELECT AVG(rating) as average_rating, COUNT(*) as total_ratings FROM anime_ratings WHERE anime_slug = ?",
        [animeSlug],
        (err, row) => {
          if (err) reject(err);
          else resolve({
            average_rating: row ? parseFloat(row.average_rating || 0) : 0,
            total_ratings: row ? row.total_ratings : 0
          });
        }
      );
    });
  },

  getAnimeReviews: (animeSlug, limit = 20, offset = 0) => {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT ar.*, u.name as user_name, u.avatar_url
        FROM anime_ratings ar
        LEFT JOIN users u ON ar.user_id = u.id
        WHERE ar.anime_slug = ? AND ar.review IS NOT NULL AND ar.review != ''
        ORDER BY ar.created_at DESC
        LIMIT ? OFFSET ?
      `;
      db.all(query, [animeSlug, limit, offset], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }
};

// Function to check if database is fully initialized
const isDatabaseReady = () => {
  return dbReady && dbInitialized && db;
};

// Function to wait for database to be ready
const waitForDatabase = async (maxWaitTime = 5000) => {
  const startTime = Date.now();
  while (!isDatabaseReady() && (Date.now() - startTime) < maxWaitTime) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  return isDatabaseReady();
};

module.exports = {
  db,
  initializeDatabase,
  isDatabaseReady,
  waitForDatabase,
  ...dbHelpers
};
