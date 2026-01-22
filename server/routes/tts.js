const express = require('express');
const router = express.Router();
const OpenAI = require('openai');

// OpenAI 클라이언트 초기화
let openai = null;
try {
    if (process.env.OPENAI_API_KEY) {
        openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });
    }
} catch (error) {
    console.warn('⚠️ OpenAI client initialization failed.');
    console.warn('Set OPENAI_API_KEY in .env');
}

module.exports = () => {
    // POST /api/tts - Text to Speech
    router.post('/', async (req, res) => {
        const { text } = req.body;

        if (!text) {
            return res.status(400).json({ error: 'text parameter is required' });
        }

        // OpenAI TTS가 설정되지 않은 경우 fallback
        if (!openai || !process.env.OPENAI_API_KEY) {
            return res.status(503).json({ 
                error: 'TTS service not configured',
                message: 'Please set OPENAI_API_KEY in .env'
            });
        }

        try {
            // OpenAI TTS API 호출
            const response = await openai.audio.speech.create({
                model: 'tts-1', // 또는 'tts-1-hd' (더 고품질, 비용 높음)
                voice: 'nova', // 'alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer' 중 선택
                input: text,
                speed: 0.95, // 0.25 ~ 4.0
            });

            // Buffer로 변환
            const buffer = Buffer.from(await response.arrayBuffer());
            
            // Base64로 인코딩하여 전송
            res.json({
                audio: buffer.toString('base64'),
                format: 'mp3',
            });
        } catch (error) {
            console.error('TTS Error:', error);
            res.status(500).json({ 
                error: 'Failed to synthesize speech',
                detail: error.message 
            });
        }
    });

    return router;
};

