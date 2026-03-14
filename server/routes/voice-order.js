const express = require('express');
const router = express.Router();

module.exports = (pool) => {
  router.post('/', async (req, res) => {
    const { messages, sessionId } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "messages must be a non-empty array" });
    }

    try {
      const lastUserMessage = messages[messages.length - 1]?.content || "";

      // 1️⃣ OpenAI에게 "키워드만" 추출 요청
      const keywordRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: "사용자의 말에서 음식 관련 핵심 키워드만 쉼표로 나열해서 반환하세요. 예: 새우, 매운거",
            },
            { role: "user", content: lastUserMessage },
          ],
          temperature: 0.2,
        }),
      });

      const keywordData = await keywordRes.json();
      const keywords = keywordData?.choices?.[0]?.message?.content
        ?.replace(/\s+/g, "")
        ?.split(",")
        ?.filter(Boolean);

      console.log("🧩 Extracted keywords:", keywords);

      // 2️⃣ DB 메뉴 검색
      let matchedMenus = [];
      let conn = await pool.getConnection();
      try {
        for (const kw of keywords) {
          const [rows] = await conn.query(
            `SELECT * FROM menu WHERE keywords LIKE ?`,
            [`%${kw}%`]
          );
          rows.forEach((r) => matchedMenus.push(r));
        }
      } catch (e) {
        console.error("DB keyword search error:", e.message);
      } finally {
        conn.release();
      }

      // 중복 제거
      matchedMenus = [...new Map(matchedMenus.map(m => [m.id, m])).values()];

      // 🍤 메뉴 추천이 가능하면
      if (matchedMenus.length > 0) {
        const menuList = matchedMenus.map((m) => `${m.name}(${m.price}원)`).join(", ");
        const assistantMsg = `추천드릴 수 있는 메뉴는 ${menuList} 입니다. 선택하시겠어요?`;

        saveConversation(pool, sessionId, lastUserMessage, assistantMsg);
        return res.json({ reply: assistantMsg });
      }

      // 3️⃣ 검색 실패 시 → OpenAI가 응답 처리
      const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages,
          temperature: 0.3,
        }),
      });

      const gptData = await openaiRes.json();
      const reply = gptData?.choices?.[0]?.message?.content || "다시 말씀해 주세요.";

      saveConversation(pool, sessionId, lastUserMessage, reply);
      res.json({ reply });

    } catch (error) {
      console.error("❌ Voice Order Error:", error);
      res.status(500).json({ error: "Server Error", detail: error.message });
    }
  });

  // 👇 DB 저장 로직 함수로 분리
  function saveConversation(pool, sessionId, userMsg, assistantMsg) {
    pool.query(
      `INSERT INTO conversations (session_id, user_message, assistant_message, created_at)
       VALUES (?, ?, ?, NOW())`,
      [sessionId || "default", userMsg, assistantMsg]
    ).catch(e => console.error("DB Save Error:", e.message));
  }

  return router;
};
