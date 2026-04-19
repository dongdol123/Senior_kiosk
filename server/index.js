const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const path = require('path');
// .env.local 우선, 없으면 .env 사용
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const app = express();
const PORT = process.env.EXPRESS_PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// MySQL connection pool
// Mac 등: Node에서 localhost 가 소켓으로 가면 실패할 때 → DB_HOST=127.0.0.1 또는 DB_SOCKET_PATH 사용
function buildMysqlPoolConfig() {
    const base = {
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD ?? '',
        database: process.env.DB_NAME || 'senior_kiosk',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
    };
    if (process.env.DB_SOCKET_PATH) {
        return { ...base, socketPath: process.env.DB_SOCKET_PATH };
    }
    return {
        ...base,
        host: process.env.DB_HOST || '127.0.0.1',
        port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
    };
}

const pool = mysql.createPool(buildMysqlPoolConfig());

// Test DB connection
pool.getConnection()
    .then((conn) => {
        console.log('✅ MySQL connected');
        conn.release();
    })
    .catch((err) => {
        console.error('❌ MySQL connection error:', err.message);
        console.error(
            '   → 로컬(Mac): MySQL 실행 여부 확인, DB/유저 생성(`server/db/schema.sql`) 확인, .env 의 DB_USER/DB_PASSWORD 확인.'
        );
        console.error(
            '   → 여전히 실패 시 .env 에 DB_HOST=127.0.0.1 또는 Homebrew면 DB_SOCKET_PATH=/tmp/mysql.sock 등을 지정해 보세요.'
        );
    });

// Routes
app.use('/api/voice-order', require('./routes/voice-order')(pool));
app.use('/api/cart', require('./routes/cart')(pool));
app.use('/api/menu', require('./routes/menu')(pool));
app.use('/api/tts', require('./routes/tts')());

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
    console.log(`🚀 Express server running on http://localhost:${PORT}`);
});

module.exports = app;

