const express = require('express');
const router = express.Router();

module.exports = (pool) => {
  // POST /api/cart - Save cart state
  router.post('/', async (req, res) => {
    const { sessionId, items, total } = req.body;

    if (!sessionId || !Array.isArray(items)) {
      return res.status(400).json({ error: 'sessionId and items array required' });
    }

    try {
      const conn = await pool.getConnection();
      try {
        await conn.query(
          `INSERT INTO carts (session_id, items_json, total, created_at) 
           VALUES (?, ?, ?, NOW())
           ON DUPLICATE KEY UPDATE items_json = ?, total = ?, updated_at = NOW()`,
          [sessionId, JSON.stringify(items), total, JSON.stringify(items), total]
        );
        res.json({ success: true });
      } finally {
        conn.release();
      }
    } catch (error) {
      console.error('Cart save error:', error);
      res.status(500).json({ error: 'Failed to save cart', detail: error.message });
    }
  });

  // GET /api/cart/:sessionId - Get cart state
  router.get('/:sessionId', async (req, res) => {
    const { sessionId } = req.params;

    try {
      const conn = await pool.getConnection();
      try {
        const [rows] = await conn.query(
          `SELECT items_json, total FROM carts WHERE session_id = ? ORDER BY updated_at DESC LIMIT 1`,
          [sessionId]
        );
        if (rows.length === 0) {
          return res.json({ items: [], total: 0 });
        }
        res.json({
          items: JSON.parse(rows[0].items_json || '[]'),
          total: rows[0].total || 0,
        });
      } finally {
        conn.release();
      }
    } catch (error) {
      console.error('Cart fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch cart', detail: error.message });
    }
  });

  return router;
};





