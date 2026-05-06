const express = require('express');
const router = express.Router();

module.exports = () => {
    // POST /api/tts - Text to Speech
    router.post('/', async (req, res) => {
        const { text } = req.body;

        if (!text) {
            return res.status(400).json({ error: 'text parameter is required' });
        }

        const apiKey = process.env.GOOGLE_TTS_API_KEY;
        if (!apiKey) {
            return res.status(503).json({
                error: 'TTS service not configured',
                message: 'Please set GOOGLE_TTS_API_KEY in .env'
            });
        }

        try {
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

