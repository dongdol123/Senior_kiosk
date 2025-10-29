"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function MenuPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const entry = (searchParams.get("entry") || "voice").toLowerCase();

    const [errorMessage, setErrorMessage] = useState("");
    const [isListening, setIsListening] = useState(false);
    const [assistantMessage, setAssistantMessage] = useState("");
    const [ordered, setOrdered] = useState(false);
    const [conversation, setConversation] = useState([]);
    const [lastUser, setLastUser] = useState("");
    const recognitionRef = useRef(null);
    const restartingRef = useRef(false);
    const mountedRef = useRef(true);
    const shouldListenRef = useRef(true);

    // cart state
    const MENU_ITEMS = [
        { id: "a", name: "메뉴 A", price: 5000 },
        { id: "b", name: "메뉴 B", price: 5000 },
        { id: "c", name: "메뉴 C", price: 5000 },
        { id: "d", name: "메뉴 D", price: 5000 },
    ];
    const [cartItems, setCartItems] = useState([]); // [{id, name, price, qty}]

    async function addToCart(item) {
        setCartItems((prev) => {
            const idx = prev.findIndex((p) => p.id === item.id);
            if (idx >= 0) {
                const next = [...prev];
                next[idx] = { ...next[idx], qty: next[idx].qty + 1 };
                return next;
            }
            return [...prev, { ...item, qty: 1 }];
        });
        try { await speakKorean(`${item.name} 담았어요.`); } catch { }
    }

    async function removeFromCart(itemId) {
        let removedCompletely = false;
        let removedItemName = "";
        setCartItems((prev) => {
            const idx = prev.findIndex((p) => p.id === itemId);
            if (idx === -1) return prev;
            const target = prev[idx];
            removedItemName = target.name;
            if (target.qty <= 1) {
                removedCompletely = true;
                return prev.filter((p) => p.id !== itemId);
            }
            const next = [...prev];
            next[idx] = { ...target, qty: target.qty - 1 };
            return next;
        });
        try {
            if (removedCompletely) {
                await speakKorean(`${removedItemName}를 장바구니에서 비웠어요.`);
            } else {
                await speakKorean(`${removedItemName} 한 개 뺐어요.`);
            }
        } catch { }
    }

    async function clearCart() {
        setCartItems([]);
        try { await speakKorean("장바구니를 모두 비웠어요."); } catch { }
    }

    const cartTotal = cartItems.reduce((sum, it) => sum + it.price * it.qty, 0);

    async function speakKorean(text) {
        try {
            const synth = window.speechSynthesis;
            if (!synth) return;
            const utter = new SpeechSynthesisUtterance(text);
            utter.lang = "ko-KR";
            utter.rate = 0.95;
            synth.cancel();
            await new Promise((resolve) => {
                utter.onend = resolve;
                setTimeout(resolve, 5000);
                synth.speak(utter);
            });
        } catch (e) {
            // no-op
        }
    }

    // 여기부턴 그냥 주문하기

    useEffect(() => {
        mountedRef.current = true;
        shouldListenRef.current = true;

        const SpeechRecognition =
            typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);
        if (!SpeechRecognition) {
            setErrorMessage("이 브라우저는 음성 인식을 지원하지 않습니다. 크롬을 권장합니다.");
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = "ko-KR";
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => setIsListening(true);
        recognition.onend = () => {
            setIsListening(false);
            // 자동 재시작(메뉴1 주문 완료 전까지 지속 듣기)
            if (mountedRef.current && shouldListenRef.current && !ordered && !restartingRef.current) {
                restartingRef.current = true;
                setTimeout(() => {
                    if (!mountedRef.current || !shouldListenRef.current) {
                        restartingRef.current = false;
                        return;
                    }
                    try { recognition.start(); } catch { }
                    restartingRef.current = false;
                }, 250);
            }
        };
        recognition.onerror = (event) => {
            setErrorMessage(`음성 인식 오류: ${event.error}`);
            setIsListening(false);
        };

        recognition.onresult = async (event) => {
            const transcript = event.results[0][0].transcript || "";
            setLastUser(transcript);

            const normalized = transcript.replaceAll(" ", "").toLowerCase();
            const isMenu1 = /메뉴?1|일?번|첫(번째)?|메뉴일|원번/.test(normalized);

            if (isMenu1) {
                setOrdered(true);
                const msg = "메뉴 1 주문을 완료했어요. 결제하시겠어요?";
                setAssistantMessage(msg);
                setConversation((prev) => [...prev, { role: "user", content: transcript }, { role: "assistant", content: msg }]);
                await speakKorean(msg);
                try { recognition.stop(); } catch { }
                return;
            }

            const newConversation = [...conversation, { role: "user", content: transcript }];
            setConversation(newConversation);
            try {
                const res = await fetch("/api/voice-order", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ messages: newConversation }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error || "API 오류");
                const reply = data?.reply || "죄송해요, 다시 말씀해 주시겠어요?";
                setAssistantMessage(reply);
                setConversation((prev) => [...prev, { role: "assistant", content: reply }]);
                await speakKorean(reply);
            } catch (e) {
                setAssistantMessage("");
                setErrorMessage(e.message || "네트워크 오류가 발생했습니다.");
            }
        };

        recognitionRef.current = recognition;

        if (entry === "voice") {
            try {
                recognition.start();
            } catch (e) {
                setErrorMessage("마이크 사용 권한을 허용해 주세요.");
            }
        } else {

            shouldListenRef.current = false;
        }

        const handleVisibility = () => {
            if (document.hidden) {
                shouldListenRef.current = false;
                try { recognition.stop(); } catch { }
                try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch { }
            }
        };
        const handlePageHide = () => {
            shouldListenRef.current = false;
            try { recognition.stop(); } catch { }
            try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch { }
        };
        document.addEventListener("visibilitychange", handleVisibility);
        window.addEventListener("pagehide", handlePageHide);

        return () => {
            mountedRef.current = false;
            shouldListenRef.current = false;
            try { recognition.onresult = null; } catch { }
            try { recognition.onend = null; } catch { }
            try { recognition.onerror = null; } catch { }
            try { recognition.onstart = null; } catch { }
            try { recognition.stop(); } catch { }
            try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch { }
            document.removeEventListener("visibilitychange", handleVisibility);
            window.removeEventListener("pagehide", handlePageHide);
        };
    }, [ordered, entry]);

    return (
        <main
            style={{
                display: "flex",
                flexDirection: "column",
                minHeight: "100vh",
                backgroundColor: "#f9f9f9",
            }}
        >
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "16px",
                }}
            >
                <div
                    style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "8px",
                        backgroundColor: entry === "voice" ? "#e6f4ea" : "#eee",
                        color: entry === "voice" ? "#1e7a39" : "#777",
                        border: entry === "voice" ? "1px solid #bfe3ca" : "1px solid #ddd",
                        borderRadius: "999px",
                        padding: "8px 14px",
                        fontWeight: "bold",
                        opacity: entry === "voice" ? (isListening ? 1 : 0.85) : 1,
                    }}
                >
                    <span style={{ width: 10, height: 10, borderRadius: "50%", opacity: 1, background: entry === "voice" ? "#34c759" : "#bbb" }} />
                    {entry === "voice" ? "음성 주문중" : "간편 모드"}
                </div>

                <button
                    onClick={() => {
                        shouldListenRef.current = false;
                        try { recognitionRef.current && recognitionRef.current.stop(); } catch { }
                        try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch { }
                        if (typeof window !== "undefined" && window.history.length > 1) {
                            router.back();
                        } else {
                            router.push("/");
                        }
                    }}
                    style={{
                        backgroundColor: "#ffffff",
                        border: "1px solid #ddd",
                        padding: "8px 14px",
                        borderRadius: "8px",
                        cursor: "pointer",
                    }}
                >
                    뒤로 가기
                </button>
            </div>

            {/* Cart panel */}
            <div
                style={{
                    height: "25vh",
                    minHeight: 180,
                    padding: "12px 16px",
                }}
            >
                <div
                    style={{
                        height: "100%",
                        background: "#ffffff",
                        border: "1px solid #eee",
                        borderRadius: 12,
                        padding: 12,
                        display: "flex",
                        flexDirection: "column",
                        overflow: "hidden",
                    }}
                >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <div style={{ fontWeight: "bold" }}>장바구니</div>
                        <div style={{ fontSize: 14, color: "#555" }}>총액: {cartTotal.toLocaleString()}원</div>
                    </div>

                    <div style={{ flex: 1, overflowY: "auto", borderTop: "1px dashed #e5e5e5", paddingTop: 8 }}>
                        {cartItems.length === 0 ? (
                            <div style={{ color: "#888" }}>담긴 상품이 없습니다.</div>
                        ) : (
                            cartItems.map((it) => (
                                <div key={it.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                        <div style={{ width: 36, height: 36, background: "#f3f3f3", border: "1px solid #eee", borderRadius: 6 }} />
                                        <div>
                                            <div style={{ fontWeight: 600 }}>{it.name}</div>
                                            <div style={{ fontSize: 12, color: "#777" }}>{it.price.toLocaleString()}원 × {it.qty}</div>
                                        </div>
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                        <button onClick={() => removeFromCart(it.id)} style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #ddd", background: "#fff", cursor: "pointer" }}>-</button>
                                        <button onClick={() => addToCart(it)} style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #ddd", background: "#fff", cursor: "pointer" }}>+</button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
                        <button onClick={clearCart} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #ddd", background: "#fff", cursor: "pointer" }}>비우기</button>
                        <button style={{ padding: "8px 12px", borderRadius: 8, border: "none", background: "#1e7a39", color: "#fff", cursor: "pointer" }}>결제하기</button>
                    </div>
                </div>
            </div>

            <div
                style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    gap: "16px",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#777",
                }}
            >
                {/* 메뉴 4개 (A-D) */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(160px, 200px))", gap: "16px" }}>
                    {MENU_ITEMS.map((m) => (
                        <div key={m.id} style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 8,
                            background: "#ffffff",
                            border: "1px solid #e5e5e5",
                            borderRadius: 12,
                            boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
                            padding: 12,
                        }}>
                            {/* 이미지 자리 */}
                            <div style={{ height: 100, background: "#f3f3f3", border: "1px dashed #ddd", borderRadius: 8 }} />
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div>
                                    <div style={{ fontWeight: 700 }}>{m.name}</div>
                                    <div style={{ color: "#777", marginTop: 4 }}>{m.price.toLocaleString()}원</div>
                                </div>
                                <button
                                    onClick={() => addToCart(m)}
                                    style={{ background: "#1e7a39", color: "#fff", border: "none", borderRadius: 8, padding: "8px 10px", cursor: "pointer" }}
                                >담기</button>
                            </div>
                        </div>
                    ))}
                </div>

                {/* 간단 채팅 UI */}
                <div style={{
                    width: 340,
                    maxWidth: "90vw",
                    background: "#fff",
                    border: "1px solid #eee",
                    borderRadius: 12,
                    padding: 12,
                    marginTop: 12,
                }}>
                    <div style={{ fontSize: 14, color: "#888", marginBottom: 6 }}>대화</div>
                    {lastUser ? (
                        <div style={{ marginBottom: 8 }}>
                            <strong>사용자</strong>: {lastUser}
                        </div>
                    ) : null}
                    {assistantMessage ? (
                        <div>
                            <strong>티노</strong>: {assistantMessage}
                        </div>
                    ) : (
                        <div style={{ color: "#666" }}>
                            {isListening ? "음성 인식 중입니다. 메뉴를 말씀해 주세요." : "마이크를 준비하고 있어요..."}
                        </div>
                    )}
                </div>
            </div>

            {errorMessage ? (
                <div style={{ color: "#b00020", padding: "0 16px 16px" }}>{errorMessage}</div>
            ) : null}
        </main>
    );
}


