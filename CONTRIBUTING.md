# 🤝 Contributing to KitaNime

Terima kasih atas minat Anda untuk berkontribusi pada KitaNime! Kami sangat menghargai setiap kontribusi yang membantu mengembangkan platform streaming anime ini.

## 📋 Daftar Isi

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Contribution Guidelines](#contribution-guidelines)
- [Pull Request Process](#pull-request-process)
- [Issue Reporting](#issue-reporting)
- [Development Workflow](#development-workflow)
- [Code Style Guide](#code-style-guide)
- [Testing Guidelines](#testing-guidelines)
- [Documentation](#documentation)

## 📜 Code of Conduct

### Our Pledge

Kami berkomitmen untuk menciptakan lingkungan yang terbuka dan ramah untuk semua kontributor, terlepas dari:
- Usia, ukuran tubuh, disabilitas, etnis
- Karakteristik seksual, identitas dan ekspresi gender
- Tingkat pengalaman, pendidikan, status sosial-ekonomi
- Kebangsaan, penampilan, ras, agama
- Identitas dan orientasi seksual

### Expected Behavior

- Gunakan bahasa yang ramah dan inklusif
- Hormati perbedaan pendapat, sudut pandang, dan pengalaman
- Terima kritik konstruktif dengan baik
- Fokus pada yang terbaik untuk komunitas
- Tunjukkan empati terhadap anggota komunitas lainnya

### Unacceptable Behavior

- Penggunaan bahasa atau gambar yang bersifat seksual
- Trolling, komentar menghina/merendahkan, dan serangan pribadi atau politik
- Pelecehan publik atau pribadi
- Publikasi informasi pribadi tanpa izin
- Perilaku lain yang tidak pantas dalam lingkungan profesional

## 🚀 Getting Started

### Prerequisites

Sebelum berkontribusi, pastikan Anda memiliki:

- Node.js >= 16.0.0
- npm atau yarn
- Git
- Text editor (VS Code direkomendasikan)
- Pengetahuan dasar JavaScript, HTML, CSS

### Fork & Clone

1. **Fork Repository**
   - Klik tombol "Fork" di halaman GitHub repository
   - Clone fork Anda ke local machine

2. **Clone Repository**
   ```bash
   git clone https://github.com/YOUR_USERNAME/Anime-Stream.git
   cd Anime-Stream
   ```

3. **Add Upstream Remote**
   ```bash
   git remote add upstream https://github.com/ORIGINAL_OWNER/Anime-Stream.git
   ```

## 🛠️ Development Setup

### 1. Install Dependencies

```bash
# Install main application dependencies
npm install

# Install API service dependencies
cd api
npm install
cd ..
```

### 2. Environment Configuration

```bash
# Copy environment template
cp ENV_SAMPLE.txt .env

# Edit .env file
nano .env
```

### 3. Start Development Servers

```bash
# Terminal 1: Start API service
cd api
npm run dev

# Terminal 2: Start main application
npm run dev
```

### 4. Verify Setup

- Main App: http://localhost:3001
- API Service: http://localhost:3000
- Health Check: http://localhost:3001/health

## 📝 Contribution Guidelines

### Types of Contributions

Kami menerima berbagai jenis kontribusi:

#### 🐛 Bug Reports
- Jelaskan bug dengan detail
- Sertakan langkah reproduksi
- Berikan informasi environment
- Lampirkan screenshot jika relevan

#### ✨ Feature Requests
- Jelaskan fitur yang diinginkan
- Berikan use case yang jelas
- Pertimbangkan dampak pada existing features
- Diskusikan dengan maintainer sebelum implementasi

#### 📚 Documentation
- Perbaiki typo atau kesalahan
- Tambahkan contoh penggunaan
- Terjemahkan dokumentasi
- Perbaiki struktur dokumentasi

#### 🎨 UI/UX Improvements
- Perbaiki responsive design
- Tingkatkan accessibility
- Optimasi user experience
- Tambahkan animasi atau transisi

#### 🔧 Code Improvements
- Refactor code yang kompleks
- Optimasi performa
- Perbaiki security issues
- Tambahkan error handling

### Before You Start

1. **Check Existing Issues**
   - Cari issue yang sudah ada
   - Komentar di issue yang relevan
   - Hindari duplikasi work

2. **Create New Issue (if needed)**
   - Jelaskan masalah atau fitur yang ingin dikerjakan
   - Tunggu approval dari maintainer
   - Assign issue ke diri sendiri

3. **Plan Your Changes**
   - Buat branch baru untuk setiap feature/fix
   - Tulis commit message yang jelas
   - Test perubahan Anda secara menyeluruh

## 🔄 Pull Request Process

### 1. Create Feature Branch

```bash
# Update main branch
git checkout main
git pull upstream main

# Create new branch
git checkout -b feature/amazing-feature
# atau
git checkout -b fix/bug-description
```

### 2. Make Changes

- Implement perubahan Anda
- Test secara menyeluruh
- Update dokumentasi jika perlu
- Follow code style guide

### 3. Commit Changes

```bash
# Add changes
git add .

# Commit with descriptive message
git commit -m "feat: add user profile editing functionality

- Add profile edit form
- Implement image upload
- Add validation for user inputs
- Update user model to support new fields

Closes #123"
```

### 4. Push Changes

```bash
git push origin feature/amazing-feature
```

### 5. Create Pull Request

- Go to GitHub repository
- Click "New Pull Request"
- Select your branch
- Fill PR template
- Request review from maintainers

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Tested locally
- [ ] Added/updated tests
- [ ] All tests pass

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No breaking changes (or documented)

## Screenshots (if applicable)
Add screenshots to help explain your changes

## Related Issues
Closes #123
```

## 🐛 Issue Reporting

### Bug Report Template

```markdown
**Describe the bug**
A clear description of what the bug is.

**To Reproduce**
Steps to reproduce the behavior:
1. Go to '...'
2. Click on '....'
3. Scroll down to '....'
4. See error

**Expected behavior**
What you expected to happen.

**Screenshots**
If applicable, add screenshots.

**Environment:**
- OS: [e.g. Windows 10, macOS 12, Ubuntu 20.04]
- Browser: [e.g. Chrome 91, Firefox 89]
- Node.js version: [e.g. 16.14.0]
- Application version: [e.g. 1.0.0]

**Additional context**
Any other context about the problem.
```

### Feature Request Template

```markdown
**Is your feature request related to a problem?**
A clear description of what the problem is.

**Describe the solution you'd like**
A clear description of what you want to happen.

**Describe alternatives you've considered**
Alternative solutions or features you've considered.

**Additional context**
Any other context or screenshots about the feature request.
```

## 🔄 Development Workflow

### Branch Naming Convention

```bash
# Features
feature/user-authentication
feature/dark-mode
feature/search-filters

# Bug fixes
fix/login-error
fix/memory-leak
fix/responsive-issue

# Documentation
docs/api-documentation
docs/deployment-guide

# Refactoring
refactor/database-queries
refactor/component-structure

# Performance
perf/optimize-images
perf/reduce-bundle-size
```

### Commit Message Convention

Gunakan [Conventional Commits](https://www.conventionalcommits.org/):

```bash
# Format
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

#### Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

#### Examples:
```bash
feat(auth): add OAuth login support
fix(api): resolve memory leak in episode streaming
docs(readme): update installation instructions
style(ui): improve button hover effects
refactor(db): optimize anime search queries
perf(images): implement lazy loading for posters
test(api): add unit tests for search endpoint
chore(deps): update dependencies to latest versions
```

## 📏 Code Style Guide

### JavaScript/Node.js

```javascript
// Use const/let instead of var
const express = require('express');
let userCount = 0;

// Use arrow functions for callbacks
app.get('/api/anime', async (req, res) => {
  try {
    const anime = await getAnimeData(req.params.id);
    res.json({ status: 'success', data: anime });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Use async/await instead of promises
async function fetchAnimeData(id) {
  const response = await axios.get(`/api/anime/${id}`);
  return response.data;
}

// Use meaningful variable names
const animeList = await getAnimeList();
const currentUser = req.session.user;

// Use JSDoc for functions
/**
 * Get anime details by slug
 * @param {string} slug - Anime slug
 * @returns {Promise<Object>} Anime data
 */
async function getAnimeBySlug(slug) {
  // Implementation
}
```

### HTML/Pug Templates

```pug
// Use semantic HTML
section.anime-list
  h2.title Latest Anime
  .anime-grid
    each anime in animeList
      article.anime-card
        img.poster(src=anime.poster alt=anime.title)
        h3.title= anime.title
        p.episode= anime.episode
        .rating
          span.stars= anime.rating
          span.genre= anime.genres.join(', ')
```

### CSS/Styling

```css
/* Use BEM methodology */
.anime-card {
  display: flex;
  flex-direction: column;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.anime-card__poster {
  width: 100%;
  height: 200px;
  object-fit: cover;
}

.anime-card__title {
  font-size: 1.2rem;
  font-weight: 600;
  margin: 0.5rem 0;
}

.anime-card__episode {
  color: #666;
  font-size: 0.9rem;
}

/* Use CSS custom properties */
:root {
  --primary-color: #3b82f6;
  --secondary-color: #64748b;
  --border-radius: 8px;
  --spacing-unit: 1rem;
}
```

## 🧪 Testing Guidelines

### Unit Tests

```javascript
// tests/anime.test.js
const request = require('supertest');
const app = require('../app');

describe('Anime API', () => {
  test('GET /api/anime should return anime list', async () => {
    const response = await request(app)
      .get('/api/anime')
      .expect(200);
    
    expect(response.body.status).toBe('success');
    expect(Array.isArray(response.body.data)).toBe(true);
  });

  test('GET /api/anime/:slug should return anime detail', async () => {
    const response = await request(app)
      .get('/api/anime/one-piece')
      .expect(200);
    
    expect(response.body.data.title).toBe('One Piece');
  });
});
```

### Integration Tests

```javascript
// tests/integration/search.test.js
describe('Search Integration', () => {
  test('Search should return relevant results', async () => {
    const response = await request(app)
      .get('/api/search?keyword=naruto')
      .expect(200);
    
    const results = response.body.data;
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].title.toLowerCase()).toContain('naruto');
  });
});
```

### Running Tests

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- tests/anime.test.js

# Run tests in watch mode
npm run test:watch
```

## 📚 Documentation

### Code Documentation

```javascript
/**
 * Anime service for handling anime-related operations
 * @class AnimeService
 */
class AnimeService {
  /**
   * Get anime by slug
   * @param {string} slug - Anime slug
   * @param {Object} options - Query options
   * @param {boolean} options.includeEpisodes - Include episodes data
   * @returns {Promise<Object>} Anime data
   * @throws {Error} When anime not found
   * @example
   * const anime = await animeService.getBySlug('one-piece', {
   *   includeEpisodes: true
   * });
   */
  async getBySlug(slug, options = {}) {
    // Implementation
  }
}
```

### API Documentation

Update API documentation when adding new endpoints:

```markdown
### New Endpoint

#### Get Anime Recommendations
```http
GET /v1/recommendations?user_id={id}&limit={limit}
```

**Parameters:**
- `user_id` (optional): User ID for personalized recommendations
- `limit` (optional): Number of recommendations (default: 10)

**Response:**
```json
{
  "status": "success",
  "data": [
    {
      "title": "Attack on Titan",
      "slug": "attack-on-titan",
      "score": 0.95,
      "reason": "Based on your watch history"
    }
  ]
}
```
```

## 🏷️ Release Process

### Version Numbering

KitaNime menggunakan [Semantic Versioning](https://semver.org/):

- **MAJOR** (1.0.0): Breaking changes
- **MINOR** (0.1.0): New features, backward compatible
- **PATCH** (0.0.1): Bug fixes, backward compatible

### Release Checklist

- [ ] All tests pass
- [ ] Documentation updated
- [ ] CHANGELOG.md updated
- [ ] Version bumped in package.json
- [ ] Release notes prepared
- [ ] Tag created
- [ ] Release published

## 🎯 Getting Help

### Communication Channels

- **GitHub Issues**: Bug reports, feature requests
- **GitHub Discussions**: General questions, ideas
- **Email**: dev@kitanime.com (for sensitive issues)

### Resources

- [Node.js Documentation](https://nodejs.org/docs/)
- [Express.js Guide](https://expressjs.com/guide/)
- [Pug Template Engine](https://pugjs.org/api/getting-started.html)
- [Tailwind CSS](https://tailwindcss.com/docs)

## 🙏 Recognition

Kontributor akan diakui di:

- README.md contributors section
- Release notes
- Project documentation
- GitHub contributors page

## 📄 License

Dengan berkontribusi, Anda setuju bahwa kontribusi Anda akan dilisensikan di bawah [MIT License](LICENSE).

---

<div align="center">
  <p>🤝 Terima kasih telah berkontribusi pada KitaNime!</p>
  <p>Bersama-sama kita bisa membuat platform streaming anime yang lebih baik</p>
</div>
