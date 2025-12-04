const express = require('express');
const router = express.Router();

module.exports = (pool) => {
    // POST /api/voice-order - Process voice order with OpenAI
    router.post('/', async (req, res) => {
        const { messages, sessionId } = req.body;

        if (!Array.isArray(messages) || messages.length === 0) {
            return res.status(400).json({ error: 'messages must be a non-empty array' });
        }

        if (!process.env.OPENAI_API_KEY) {
            return res.status(500).json({ error: 'Missing OPENAI_API_KEY on server' });
        }

        try {
            // Get menu data from DB for NLP context
            let menuContext = '';
            let conn = await pool.getConnection();
            try {
                const [menuRows] = await conn.query('SELECT name, price, keywords FROM menu ORDER BY id');
                if (menuRows.length > 0) {
                    menuContext = '\n\n현재 제공되는 메뉴:\n' + menuRows.map(m =>
                        `- ${m.name} (${m.price}원) - 키워드: ${m.keywords}`
                    ).join('\n');
                }
            } catch (menuErr) {
                console.error('Menu fetch error (non-fatal):', menuErr.message);
            } finally {
                conn.release();
            }

            const systemPrompt = `당신은 시니어를 위한 키오스크 음성 주문 도우미입니다.\n- 간단하고 천천히, 한 번에 하나씩 질문하세요.\n- 가능한 선택지를 2~3개로 제한해서 말해주세요.\n- 메뉴, 수량, 사이즈, 따뜻함/차가움, 포장 여부 등을 차례대로 확인하세요.\n- 최종 확인 후 간단히 요약해 주세요.${menuContext}`;

            // Call OpenAI
            const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
                },
                body: JSON.stringify({
                    model: 'gpt-4o-mini',
                    messages: [
                        { role: 'system', content: systemPrompt },
                        ...messages,
                    ],
                    temperature: 0.3,
                }),
            });

            if (!openaiRes.ok) {
                const errText = await openaiRes.text();
                return res.status(502).json({ error: 'OpenAI request failed', detail: errText });
            }

            const data = await openaiRes.json();
            const reply = data?.choices?.[0]?.message?.content?.trim() || '';

            // Save conversation to DB
            conn = await pool.getConnection();
            try {
                const lastUserMsg = messages[messages.length - 1]?.content || '';
                await conn.query(
                    `INSERT INTO conversations (session_id, user_message, assistant_message, created_at) 
           VALUES (?, ?, ?, NOW())`,
                    [sessionId || 'default', lastUserMsg, reply]
                );
            } catch (dbErr) {
                console.error('DB save error (non-fatal):', dbErr.message);
            } finally {
                conn.release();
            }

            res.json({ reply });
        } catch (error) {
            console.error('Voice order error:', error);
            res.status(500).json({ error: 'Server error', detail: error.message });
        }
    });

    return router;
};

