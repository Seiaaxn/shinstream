# 🎌 KitaNime - Anime Streaming Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D16.0.0-brightgreen.svg)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-4.x-green.svg)](https://expressjs.com/)
[![Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black.svg)](https://vercel.com/)

KitaNime adalah platform streaming anime modern yang dibangun dengan Node.js dan Express.js. Platform ini menyediakan akses ke berbagai anime dengan kualitas HD, sistem bookmark, riwayat tonton, dan fitur-fitur canggih lainnya.

## ✨ Fitur Utama

### 🎬 Streaming & Konten
- **Streaming Anime HD** - Kualitas video tinggi dengan loading cepat
- **Koleksi Lengkap** - Anime ongoing, complete, dan movie
- **Kategori Genre** - Filter anime berdasarkan genre favorit
- **Pencarian Cerdas** - Sistem pencarian yang akurat dan cepat
- **Batch Download** - Download episode dalam format batch

### 👤 Sistem User
- **Registrasi & Login** - Sistem autentikasi yang aman
- **Profil User** - Manajemen profil dan preferensi
- **Bookmark System** - Simpan anime favorit untuk ditonton nanti
- **Riwayat Tonton** - Track progress menonton anime
- **Sistem Komentar** - Berinteraksi dengan pengguna lain

### 🛡️ Keamanan & Performance
- **Rate Limiting** - Perlindungan dari abuse dan spam
- **Security Headers** - Implementasi keamanan web modern
- **Caching System** - Optimasi performa dengan caching
- **Error Handling** - Sistem error handling yang robust
- **Input Validation** - Validasi dan sanitasi input

### 🎨 User Interface
- **Responsive Design** - Tampilan optimal di semua device
- **Dark Mode** - Mode gelap untuk kenyamanan mata
- **Modern UI/UX** - Interface yang clean dan user-friendly
- **Loading States** - Feedback visual yang informatif

## 🏗️ Arsitektur Sistem

### Backend Structure
```
├── api/                    # OtakuDesu API Service
│   ├── src/
│   │   ├── lib/           # Scraping utilities
│   │   ├── utils/         # Helper functions
│   │   └── types/         # Type definitions
│   └── routes/            # API endpoints
├── config/                # Configuration files
├── middleware/            # Custom middleware
├── models/               # Database models
├── routes/               # Main application routes
├── services/             # Business logic services
└── views/                # Pug templates
```

### Frontend Structure
```
├── public/
│   ├── css/              # Stylesheets
│   ├── js/               # JavaScript files
│   ├── images/           # Static images
│   └── fonts/            # Custom fonts
└── views/                # Server-side templates
```

## 🚀 Quick Start

### Prerequisites
- Node.js >= 16.0.0
- npm atau yarn
- Git

### Installation

1. **Clone Repository**
```bash
git clone https://github.com/yourusername/Anime-Stream.git
cd Anime-Stream
```

2. **Install Dependencies**
```bash
# Install main application dependencies
npm install

# Install API service dependencies
cd api
npm install
cd ..
```

3. **Environment Setup**
```bash
# Copy environment template
cp ENV_SAMPLE.txt .env

# Edit .env file with your configuration
nano .env
```

4. **Start Development Server**
```bash
# Start API service (Terminal 1)
cd api
npm run dev

# Start main application (Terminal 2)
npm run dev
```

5. **Access Application**
- Main App: https://anime-stream-delta.vercel.app
- API Service: https://anime-stream-delta.vercel.app/v1

## ⚙️ Konfigurasi

### Environment Variables

Buat file `.env` berdasarkan `ENV_SAMPLE.txt`:

```env
NODE_ENV=development
PORT=3001
TRUST_PROXY=0
SESSION_SECRET=your-strong-secret-key
API_BASE_URL=https://anime-stream-delta.vercel.app/v1
CORS_ORIGIN=https://anime-stream-delta.vercel.app
```

### Database Configuration

Aplikasi menggunakan SQLite database yang akan dibuat otomatis saat pertama kali dijalankan. Database file akan tersimpan di `data/kitanime.db`.

## 📚 API Documentation

### Base URL
- Development: `https://anime-stream-delta.vercel.app/v1`
- Production: `https://anime-stream-delta.vercel.app/v1`

### Endpoints

#### 🏠 Home & Discovery
```http
GET /v1/home
```
Mengambil data anime terbaru dan trending.

#### 🔍 Search
```http
GET /v1/search?keyword=naruto
```
Pencarian anime berdasarkan keyword.

#### 📺 Anime Details
```http
GET /v1/anime/{slug}
GET /v1/anime/{slug}/episodes
GET /v1/anime/{slug}/episodes/{episode}
```

#### 🎭 Genres
```http
GET /v1/genres
GET /v1/genres/{slug}?page=1
```

#### 📋 Complete & Ongoing
```http
GET /v1/complete-anime?page=1
GET /v1/ongoing-anime?page=1
```

#### 🎬 Episode
```http
GET /v1/episode/{slug}
```

### Response Format

Semua API response mengikuti format JSON standar:

```json
{
  "status": "success",
  "data": {
    // Response data
  },
  "pagination": {
    "currentPage": 1,
    "totalPages": 10,
    "hasNext": true,
    "hasPrev": false
  }
}
```

## 🚀 Deployment

### Vercel Deployment

1. **Connect Repository**
   - Login ke [Vercel](https://vercel.com)
   - Import project dari GitHub

2. **Environment Variables**
   Set environment variables di Vercel dashboard:
   ```
   NODE_ENV=production
   SESSION_SECRET=your-production-secret
   API_BASE_URL=https://your-api-domain.com/v1
   ```

3. **Deploy**
   - Vercel akan otomatis deploy saat ada push ke main branch
   - Custom domain bisa dikonfigurasi di dashboard

### Manual Deployment

1. **Build Application**
```bash
npm install --production
```

2. **Start Production Server**
```bash
NODE_ENV=production npm start
```

3. **Using PM2 (Recommended)**
```bash
npm install -g pm2
pm2 start app.js --name "kitanime"
pm2 startup
pm2 save
```

## 🛠️ Development

### Project Structure
- `app.js` - Main application entry point
- `api/` - Separate API service for data scraping
- `routes/` - Express.js route handlers
- `middleware/` - Custom middleware functions
- `views/` - Pug template files
- `public/` - Static assets

### Code Style
- Gunakan ESLint untuk code linting
- Follow JavaScript ES6+ standards
- Gunakan async/await untuk asynchronous operations
- Implement proper error handling

### Testing
```bash
# Run tests (jika ada)
npm test

# Run linting
npm run lint
```

## 🔧 Customization

### Adding New Features
1. Buat route baru di `routes/`
2. Implement business logic di `services/`
3. Buat view template di `views/`
4. Update navigation di layout template

### Styling
- CSS framework: Tailwind CSS
- Custom styles: `public/css/theme.css`
- Dark mode: `public/css/dark-mode-enhanced.css`

### Database Schema
Database menggunakan SQLite dengan tabel:
- `users` - User accounts
- `bookmarks` - User bookmarks
- `watch_history` - Watch history
- `comments` - User comments

## 🤝 Contributing

Kami sangat menghargai kontribusi dari komunitas! Silakan baca [CONTRIBUTING.md](CONTRIBUTING.md) untuk panduan lengkap.

### Cara Berkontribusi
1. Fork repository
2. Buat feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add some AmazingFeature'`)
4. Push ke branch (`git push origin feature/AmazingFeature`)
5. Buat Pull Request

## 📄 License

Project ini dilisensikan di bawah MIT License - lihat file [LICENSE](LICENSE) untuk detail.

## ⚠️ Disclaimer

- Project ini dibuat untuk tujuan edukasi dan pembelajaran
- Kami tidak menyimpan atau mendistribusikan konten anime
- Semua konten anime adalah milik pemilik aslinya
- Gunakan dengan bijak dan patuhi hukum yang berlaku

## 📞 Support

Jika Anda mengalami masalah atau memiliki pertanyaan:

- 📧 Email: support@kitanime.com
- 🐛 Issues: [GitHub Issues](https://github.com/yourusername/Anime-Stream/issues)
- 💬 Discussions: [GitHub Discussions](https://github.com/yourusername/Anime-Stream/discussions)

## 🙏 Acknowledgments

- [OtakuDesu](https://otakudesu.watch) - Sumber data anime
- [Express.js](https://expressjs.com) - Web framework
- [Pug](https://pugjs.org) - Template engine
- [Tailwind CSS](https://tailwindcss.com) - CSS framework
- [Vercel](https://vercel.com) - Deployment platform

---

<div align="center">
  <p>Dibuat dengan ❤️ oleh KitaNime Team</p>
  <p>⭐ Jangan lupa berikan star jika project ini membantu Anda!</p>
</div>
