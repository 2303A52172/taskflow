const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { query, queryOne, run } = require('../db/database');
const { authenticate, JWT_SECRET } = require('../middleware/auth');

const COLORS = ['#6ee7b7', '#818cf8', '#fb923c', '#f87171', '#38bdf8', '#a78bfa', '#fbbf24'];

// POST /api/auth/signup
router.post('/signup', async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password are required' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Invalid email format' });

  const existing = queryOne('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
  if (existing) return res.status(409).json({ error: 'Email already registered' });

  const validRoles = ['admin', 'manager', 'member'];
  const userRole = validRoles.includes(role) ? role : 'member';
  const hashed = await bcrypt.hash(password, 10);
  const id = uuidv4();
  const color = COLORS[Math.floor(Math.random() * COLORS.length)];

  run('INSERT INTO users (id, name, email, password, role, avatar_color) VALUES (?, ?, ?, ?, ?, ?)',
    [id, name.trim(), email.toLowerCase(), hashed, userRole, color]);

  const token = jwt.sign({ id }, JWT_SECRET, { expiresIn: '7d' });
  res.status(201).json({ token, user: { id, name: name.trim(), email: email.toLowerCase(), role: userRole, avatar_color: color } });
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

  const user = queryOne('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

  const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, avatar_color: user.avatar_color } });
});

// GET /api/auth/me
router.get('/me', authenticate, (req, res) => {
  res.json(req.user);
});

module.exports = router;
