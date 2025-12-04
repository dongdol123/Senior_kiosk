const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const app = express();
const PORT = process.env.EXPRESS_PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// MySQL connection pool
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'senior_kiosk',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
});

// Test DB connection
pool.getConnection()
    .then((conn) => {
        console.log('✅ MySQL connected');
        conn.release();
    })
    .catch((err) => {
        console.error('❌ MySQL connection error:', err.message);
    });

// Routes
app.use('/api/voice-order', require('./routes/voice-order')(pool));
app.use('/api/cart', require('./routes/cart')(pool));
app.use('/api/menu', require('./routes/menu')(pool));

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
    console.log(`🚀 Express server running on http://localhost:${PORT}`);
});

module.exports = app;

