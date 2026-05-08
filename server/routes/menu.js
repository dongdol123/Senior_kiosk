const express = require('express');
const router = express.Router();

module.exports = (pool) => {
  // GET /api/menu - Get all menus
  router.get('/', async (req, res) => {
    try {
      const conn = await pool.getConnection();
      try {
        const [rows] = await conn.query(
          `SELECT id, name, price, keywords
           FROM menu
           ORDER BY FIELD(name,
             '불고기버거',
             '치즈 불고기버거',
             '치킨버거',
             '새우버거',
             '더블 불고기버거',
             '베이컨 불고기버거',
             '칠리 새우버거',
             '크림 새우버거',
             '버섯 불고기버거',
             '마늘 불고기버거'
           ), id`
        );
        
        // Parse keywords string to array
        const menus = rows.map(row => ({
          id: row.id.toString(),
          name: row.name,
          price: row.price,
          keywords: row.keywords ? row.keywords.split(',').map(k => k.trim()) : [],
        }));
        
        res.json({ menus });
      } finally {
        conn.release();
      }
    } catch (error) {
      console.error('Menu fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch menus', detail: error.message });
    }
  });

  // GET /api/menu/search?keyword=새우 - Search menus by keyword
  router.get('/search', async (req, res) => {
    const { keyword } = req.query;
    
    if (!keyword) {
      return res.status(400).json({ error: 'keyword parameter required' });
    }

    try {
      const conn = await pool.getConnection();
      try {
        const [rows] = await conn.query(
          `SELECT id, name, price, keywords FROM menu 
           WHERE keywords LIKE ? OR name LIKE ? 
           ORDER BY id`,
          [`%${keyword}%`, `%${keyword}%`]
        );
        // depth 수정 -> 4x4로 바꾸기
        const menus = rows.map(row => ({
          id: row.id.toString(),
          name: row.name,
          price: row.price,
          keywords: row.keywords ? row.keywords.split(',').map(k => k.trim()) : [],
        }));
        
        res.json({ menus });
      } finally {
        conn.release();
      }
    } catch (error) {
      console.error('Menu search error:', error);
      res.status(500).json({ error: 'Failed to search menus', detail: error.message });
    }
  });

  return router;
};














