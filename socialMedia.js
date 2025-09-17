const express = require('express');
let db = null;
try {
    // Initialize DB pool only if required env vars are present
    if (process.env.DB_HOST && process.env.DB_USER && process.env.DB_NAME) {
        db = require('../config/db');
    }
} catch (e) {
    db = null;
}
const router = express.Router();

// Get posts filtered by location and platform
router.post('/feed', (req, res) => {
    // If DB is not configured, return empty list to avoid 500s in demo mode
    if (!db) {
        return res.json([]);
    }
    const { platform, keywords, location } = req.body;
    let sql = 'SELECT * FROM social_posts WHERE 1=1';
    const params = [];

    if (platform && platform !== 'all') {
        sql += ' AND platform = ?';
        params.push(platform.charAt(0).toUpperCase() + platform.slice(1));
    }
    if (keywords && keywords.length) {
        sql += ' AND (';
        sql += keywords.map(() => 'caption LIKE ?').join(' OR ');
        params.push(...keywords.map(k => `%${k}%`));
        sql += ')';
    }
    // For demo: location filtering is not implemented (no lat/lng in table)
    sql += ' ORDER BY created_at DESC LIMIT 50';

    db.query(sql, params, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

module.exports = router;