const express = require('express');
const bcrypt = require('bcrypt');
const { getUserByEmail, createUser } = require('../models/database');

const router = express.Router();

router.get('/login', (req, res) => {
  if (req.session.userId) return res.redirect('/');
  res.render('auth/login', { title: 'Masuk - KitaNime', description: 'Masuk ke akun Anda' });
});

router.get('/register', (req, res) => {
  if (req.session.userId) return res.redirect('/');
  res.render('auth/register', { title: 'Daftar - KitaNime', description: 'Buat akun baru' });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).render('auth/login', { title: 'Masuk - KitaNime', error: 'Email dan kata sandi wajib diisi.' });
  }

  try {
    const user = await getUserByEmail(email);
    if (!user) {
      return res.status(401).render('auth/login', { title: 'Masuk - KitaNime', error: 'Email atau kata sandi salah.' });
    }
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.status(401).render('auth/login', { title: 'Masuk - KitaNime', error: 'Email atau kata sandi salah.' });
    }
    req.session.userId = user.id;
    req.session.userName = user.name;
    req.session.userEmail = user.email;
    const redirectTo = req.query.next && typeof req.query.next === 'string' ? req.query.next : '/';
    res.redirect(redirectTo);
  } catch (e) {
    console.error(e);
    res.status(500).render('auth/login', { title: 'Masuk - KitaNime', error: 'Terjadi kesalahan pada server.' });
  }
});

router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).render('auth/register', { title: 'Daftar - KitaNime', error: 'Semua kolom wajib diisi.' });
  }
  try {
    const existing = await getUserByEmail(email);
    if (existing) {
      return res.status(409).render('auth/register', { title: 'Daftar - KitaNime', error: 'Email sudah terdaftar.' });
    }
    const user = await createUser(name, email, password);
    req.session.userId = user.id;
    req.session.userName = user.name;
    req.session.userEmail = user.email;
    res.redirect('/');
  } catch (e) {
    console.error(e);
    res.status(500).render('auth/register', { title: 'Daftar - KitaNime', error: 'Terjadi kesalahan pada server.' });
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

module.exports = router;


