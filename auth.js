const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'change_me_in_env';
const TOKEN_COOKIE = 'auth_token';

// Create a pooled connection for promise API (separate from callback pool in db.js)
const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
});

async function ensureUsersTable() {
    await db.query(`CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role ENUM('citizen','official','analyst') NOT NULL DEFAULT 'citizen',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
}

function signToken(payload) {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

function setAuthCookie(res, token) {
    const isProd = process.env.NODE_ENV === 'production';
    res.cookie(TOKEN_COOKIE, token, {
        httpOnly: true,
        sameSite: isProd ? 'strict' : 'lax',
        secure: isProd,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/',
    });
}

function clearAuthCookie(res) {
    res.clearCookie(TOKEN_COOKIE, { path: '/' });
}

function authMiddleware(req, res, next) {
    const token = req.cookies && req.cookies[TOKEN_COOKIE];
    if (!token) return res.status(401).json({ success: false, message: 'Unauthorized' });
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (e) {
        return res.status(401).json({ success: false, message: 'Invalid token' });
    }
}

router.post('/register', async (req, res) => {
    await ensureUsersTable();
    const { email, password, role } = req.body || {};
    if (!email || !password) return res.status(400).json({ success: false, message: 'Email and password required' });
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return res.status(400).json({ success: false, message: 'Invalid email format' });
    if (String(password).length < 6) return res.status(400).json({ success: false, message: 'Password too short' });
    const selectedRole = ['citizen','official','analyst'].includes(role) ? role : 'citizen';
    try {
        const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
        if (existing.length) return res.status(409).json({ success: false, message: 'Email already registered' });
        const hash = await bcrypt.hash(password, 10);
        const [result] = await db.query('INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)', [email, hash, selectedRole]);
        const token = signToken({ id: result.insertId, email, role: selectedRole });
        setAuthCookie(res, token);
        return res.json({ success: true, user: { id: result.insertId, email, role: selectedRole } });
    } catch (e) {
        console.error('Register error', e);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

router.post('/login', async (req, res) => {
    await ensureUsersTable();
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ success: false, message: 'Email and password required' });
    try {
        const [rows] = await db.query('SELECT id, email, password_hash, role FROM users WHERE email = ?', [email]);
        if (!rows.length) return res.status(401).json({ success: false, message: 'Invalid credentials' });
        const user = rows[0];
        const ok = await bcrypt.compare(password, user.password_hash);
        if (!ok) return res.status(401).json({ success: false, message: 'Invalid credentials' });
        const token = signToken({ id: user.id, email: user.email, role: user.role });
        setAuthCookie(res, token);
        return res.json({ success: true, user: { id: user.id, email: user.email, role: user.role } });
    } catch (e) {
        console.error('Login error', e);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

router.get('/me', authMiddleware, async (req, res) => {
    return res.json({ success: true, user: req.user });
});

router.post('/logout', (req, res) => {
    clearAuthCookie(res);
    return res.json({ success: true });
});

module.exports = router;


