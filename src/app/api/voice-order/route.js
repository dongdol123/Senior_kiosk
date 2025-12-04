// Proxy to Express server
const EXPRESS_API_URL = process.env.EXPRESS_API_URL || 'http://localhost:3001';

export async function POST(request) {
    try {
        const body = await request.json();
        const { messages, sessionId } = body;

        // Forward to Express server
        const res = await fetch(`${EXPRESS_API_URL}/api/voice-order`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ messages, sessionId }),
        });

        const data = await res.json();

        if (!res.ok) {
            return new Response(
                JSON.stringify(data),
                { status: res.status, headers: { 'Content-Type': 'application/json' } }
            );
        }

        return new Response(JSON.stringify(data), {
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




