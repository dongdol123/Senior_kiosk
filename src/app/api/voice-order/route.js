export async function POST(request) {
    try {
        const { messages } = await request.json();

        if (!process.env.OPENAI_API_KEY) {
            return new Response(
                JSON.stringify({ error: 'Missing OPENAI_API_KEY on server' }),
                { status: 500, headers: { 'Content-Type': 'application/json' } }
            );
        }

        if (!Array.isArray(messages) || messages.length === 0) {
            return new Response(
                JSON.stringify({ error: 'messages must be a non-empty array' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const systemPrompt = `당신은 시니어를 위한 키오스크 음성 주문 도우미입니다.\n- 간단하고 천천히, 한 번에 하나씩 질문하세요.\n- 가능한 선택지를 2~3개로 제한해서 말해주세요.\n- 메뉴, 수량, 사이즈, 따뜻함/차가움, 포장 여부 등을 차례대로 확인하세요.\n- 최종 확인 후 간단히 요약해 주세요.`;

        const body = {
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: systemPrompt },
                ...messages,
            ],
            temperature: 0.3,
        };

        const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            },
            body: JSON.stringify(body),
        });

        if (!res.ok) {
            const errText = await res.text();
            return new Response(
                JSON.stringify({ error: 'OpenAI request failed', detail: errText }),
                { status: 502, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const data = await res.json();
        const reply = data?.choices?.[0]?.message?.content?.trim() || '';

        return new Response(JSON.stringify({ reply }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(
            JSON.stringify({ error: 'Server error', detail: String(error?.message || error) }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
}


