const express = require('express');
const router = express.Router();
<<<<<<< HEAD
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
=======
>>>>>>> d64f533ad8cbd285ea51bb396ae0bfa95ebad4ae

module.exports = () => {
    // POST /api/tts - Text to Speech
    router.post('/', async (req, res) => {
        const { text } = req.body;

        if (!text) {
            return res.status(400).json({ error: 'text parameter is required' });
        }

<<<<<<< HEAD
        // OpenAI TTS가 설정되지 않은 경우 fallback
        if (!openai || !process.env.OPENAI_API_KEY) {
            return res.status(503).json({ 
                error: 'TTS service not configured',
                message: 'Please set OPENAI_API_KEY in .env'
=======
        const apiKey = process.env.GOOGLE_TTS_API_KEY;
        if (!apiKey) {
            return res.status(503).json({
                error: 'TTS service not configured',
                message: 'Please set GOOGLE_TTS_API_KEY in .env'
>>>>>>> d64f533ad8cbd285ea51bb396ae0bfa95ebad4ae
            });
        }

        try {
<<<<<<< HEAD
            const voice = process.env.OPENAI_TTS_VOICE || 'nova';
            const speed = Number(process.env.OPENAI_TTS_SPEED || 0.95);
            // OpenAI TTS API 호출
            const response = await openai.audio.speech.create({
                model: 'gpt-4o-mini-tts',
                voice,
                input: text,
                speed, // 0.25 ~ 4.0
            });

            // Buffer로 변환
            const buffer = Buffer.from(await response.arrayBuffer());
            
            // Base64로 인코딩하여 전송
            res.json({
                audio: buffer.toString('base64'),
=======
            const languageCode = process.env.GOOGLE_TTS_LANGUAGE_CODE || 'ko-KR';
            const voiceName = process.env.GOOGLE_TTS_VOICE_NAME || 'ko-KR-Neural2-A';
            const speakingRate = Number(process.env.GOOGLE_TTS_SPEAKING_RATE || 0.88);
            const pitch = Number(process.env.GOOGLE_TTS_PITCH || 0);
            const response = await fetch(
                `https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(apiKey)}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        input: { text },
                        voice: {
                            languageCode,
                            name: voiceName,
                        },
                        audioConfig: {
                            audioEncoding: 'MP3',
                            speakingRate,
                            pitch,
                        },
                    }),
                }
            );

            const data = await response.json();
            if (!response.ok) {
                return res.status(response.status).json({
                    error: 'Google TTS request failed',
                    detail: data?.error?.message || 'Unknown error',
                });
            }
            if (!data?.audioContent) {
                return res.status(502).json({
                    error: 'Google TTS returned empty audio',
                });
            }

            res.json({
                audio: data.audioContent,
>>>>>>> d64f533ad8cbd285ea51bb396ae0bfa95ebad4ae
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

