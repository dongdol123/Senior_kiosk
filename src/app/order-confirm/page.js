"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function OrderConfirmPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [cartItems, setCartItems] = useState([]);
    const [total, setTotal] = useState(0);
    const [orderType, setOrderType] = useState("takeout");
    const [isListening, setIsListening] = useState(false);
    const [assistantMessage, setAssistantMessage] = useState("");
    const [errorMessage, setErrorMessage] = useState("");
    const [lastUser, setLastUser] = useState("");
    const recognitionRef = useRef(null);
    const mountedRef = useRef(true);
    const shouldListenRef = useRef(true);
    const sessionIdRef = useRef(`session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);

    // 메뉴 데이터 (메뉴 페이지와 동일)
    const MENU_ITEMS = [
        { id: "shrimp", name: "새우버거", price: 5000, keywords: ["새우", "shrimp"] },
        { id: "bulgogi", name: "불고기버거", price: 5000, keywords: ["불고기", "bulgogi"] },
        { id: "cheese", name: "치즈버거", price: 5000, keywords: ["치즈", "cheese"] },
        { id: "truffle", name: "트러플새우버거", price: 6000, keywords: ["트러플", "새우", "truffle", "shrimp"] },
    ];

    // URL에서 장바구니 데이터 로드
    useEffect(() => {
        try {
            const cartParam = searchParams.get("cart");
            const totalParam = searchParams.get("total");
            const orderTypeParam = searchParams.get("orderType");

            if (cartParam) {
                const items = JSON.parse(decodeURIComponent(cartParam));
                setCartItems(items);
            }
            if (totalParam) {
                setTotal(parseInt(totalParam));
            }
            if (orderTypeParam) {
                setOrderType(orderTypeParam);
            }
        } catch (e) {
            setErrorMessage("주문 정보를 불러올 수 없습니다.");
        }
    }, [searchParams]);

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

    // 음성 인식으로 메뉴 수정
    useEffect(() => {
        mountedRef.current = true;
        shouldListenRef.current = true;

        const SpeechRecognition =
            typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);
        if (!SpeechRecognition) {
            setErrorMessage("이 브라우저는 음성 인식을 지원하지 않습니다.");
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = "ko-KR";
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => setIsListening(true);
        recognition.onend = () => {
            setIsListening(false);
            if (mountedRef.current && shouldListenRef.current) {
                setTimeout(() => {
                    try { recognition.start(); } catch {}
                }, 500);
            }
        };
        recognition.onerror = (event) => {
            setErrorMessage(`음성 인식 오류: ${event.error}`);
            setIsListening(false);
        };

        recognition.onresult = async (event) => {
            const transcript = event.results[0][0].transcript || "";
            setLastUser(transcript);

            // 메뉴 추가/삭제 명령 처리
            const normalized = transcript.toLowerCase().replace(/\s/g, "");

            // 추가 명령: "새우버거 추가", "불고기 하나 더"
            if (/추가|더|하나|주문/.test(normalized)) {
                const matched = MENU_ITEMS.find(item =>
                    item.keywords.some(kw => normalized.includes(kw.toLowerCase()))
                );
                if (matched) {
                    setCartItems((prev) => {
                        const idx = prev.findIndex((p) => p.id === matched.id);
                        if (idx >= 0) {
                            const next = [...prev];
                            next[idx] = { ...next[idx], qty: next[idx].qty + 1 };
                            return next;
                        }
                        return [...prev, { ...matched, qty: 1 }];
                    });
                    const msg = `${matched.name}를 추가했어요.`;
                    setAssistantMessage(msg);
                    await speakKorean(msg);
                    return;
                }
            }

            // 삭제 명령: "새우버거 빼기", "불고기 취소"
            if (/빼|취소|삭제|제거/.test(normalized)) {
                const matched = MENU_ITEMS.find(item =>
                    item.keywords.some(kw => normalized.includes(kw.toLowerCase()))
                );
                if (matched) {
                    setCartItems((prev) => {
                        const idx = prev.findIndex((p) => p.id === matched.id);
                        if (idx === -1) return prev;
                        const target = prev[idx];
                        if (target.qty <= 1) {
                            return prev.filter((p) => p.id !== matched.id);
                        }
                        const next = [...prev];
                        next[idx] = { ...target, qty: target.qty - 1 };
                        return next;
                    });
                    const msg = `${matched.name}를 빼었어요.`;
                    setAssistantMessage(msg);
                    await speakKorean(msg);
                    return;
                }
            }

            // AI에게 질의
            try {
                const res = await fetch("/api/voice-order", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        messages: [{ role: "user", content: transcript }],
                        sessionId: sessionIdRef.current,
                    }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error || "API 오류");
                const reply = data?.reply || "죄송해요, 다시 말씀해 주시겠어요?";
                setAssistantMessage(reply);
                await speakKorean(reply);
            } catch (e) {
                setErrorMessage(e.message || "네트워크 오류가 발생했습니다.");
            }
        };

        recognitionRef.current = recognition;

        try {
            recognition.start();
        } catch (e) {
            setErrorMessage("마이크 사용 권한을 허용해 주세요.");
        }

        return () => {
            mountedRef.current = false;
            shouldListenRef.current = false;
            try {
                if (recognitionRef.current) {
                    recognitionRef.current.onresult = null;
                    recognitionRef.current.onend = null;
                    recognitionRef.current.onerror = null;
                    recognitionRef.current.onstart = null;
                    recognitionRef.current.stop();
                }
            } catch {}
            try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch {}
        };
    }, []);

    // 총액 계산
    useEffect(() => {
        const newTotal = cartItems.reduce((sum, it) => sum + it.price * it.qty, 0);
        setTotal(newTotal);
    }, [cartItems]);

    function addToCart(item) {
        setCartItems((prev) => {
            const idx = prev.findIndex((p) => p.id === item.id);
            if (idx >= 0) {
                const next = [...prev];
                next[idx] = { ...next[idx], qty: next[idx].qty + 1 };
                return next;
            }
            return [...prev, { ...item, qty: 1 }];
        });
    }

    function removeFromCart(itemId) {
        setCartItems((prev) => {
            const idx = prev.findIndex((p) => p.id === itemId);
            if (idx === -1) return prev;
            const target = prev[idx];
            if (target.qty <= 1) {
                return prev.filter((p) => p.id !== itemId);
            }
            const next = [...prev];
            next[idx] = { ...target, qty: target.qty - 1 };
            return next;
        });
    }

    return (
        <main
            style={{
                display: "flex",
                flexDirection: "column",
                minHeight: "100vh",
                backgroundColor: "#f9f9f9",
            }}
        >
            {/* 상단 헤더 */}
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "16px",
                    backgroundColor: "#fff",
                    borderBottom: "2px solid #e5e5e5",
                }}
            >
                <div
                    style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "8px",
                        backgroundColor: isListening ? "#e6f4ea" : "#eee",
                        color: isListening ? "#1e7a39" : "#777",
                        border: isListening ? "1px solid #bfe3ca" : "1px solid #ddd",
                        borderRadius: "999px",
                        padding: "8px 14px",
                        fontWeight: "bold",
                    }}
                >
                    <span style={{ width: 10, height: 10, background: isListening ? "#34c759" : "#bbb", borderRadius: "50%" }} />
                    {isListening ? "음성 주문중" : "대화로 수정 가능"}
                </div>

                <button
                    onClick={() => router.back()}
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

            {/* 주문 정보 */}
            <div
                style={{
                    flex: 1,
                    padding: "24px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "24px",
                    maxWidth: "800px",
                    width: "100%",
                    margin: "0 auto",
                }}
            >
                <div>
                    <h2 style={{ fontSize: "1.8rem", fontWeight: "bold", marginBottom: "8px" }}>
                        주문 확인
                    </h2>
                    <p style={{ color: "#777" }}>
                        {orderType === "takeout" ? "포장" : "매장"} 주문
                    </p>
                </div>

                {/* 장바구니 목록 */}
                <div
                    style={{
                        background: "#fff",
                        border: "1px solid #eee",
                        borderRadius: "16px",
                        padding: "20px",
                    }}
                >
                    <div style={{ fontWeight: "bold", marginBottom: "16px", fontSize: "1.2rem" }}>
                        주문 내역
                    </div>
                    {cartItems.length === 0 ? (
                        <div style={{ color: "#888", textAlign: "center", padding: "40px" }}>
                            주문 내역이 없습니다.
                        </div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                            {cartItems.map((item) => (
                                <div
                                    key={item.id}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        padding: "12px",
                                        background: "#f9f9f9",
                                        borderRadius: "8px",
                                    }}
                                >
                                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                        <div style={{ width: 60, height: 60, background: "#f3f3f3", border: "1px solid #eee", borderRadius: "8px" }} />
                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: "1.1rem" }}>{item.name}</div>
                                            <div style={{ color: "#777", marginTop: "4px" }}>
                                                {item.price.toLocaleString()}원 × {item.qty} = {(item.price * item.qty).toLocaleString()}원
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                        <button
                                            onClick={() => removeFromCart(item.id)}
                                            style={{
                                                padding: "6px 12px",
                                                borderRadius: "6px",
                                                border: "1px solid #ddd",
                                                background: "#fff",
                                                cursor: "pointer",
                                            }}
                                        >
                                            -
                                        </button>
                                        <button
                                            onClick={() => addToCart(item)}
                                            style={{
                                                padding: "6px 12px",
                                                borderRadius: "6px",
                                                border: "1px solid #ddd",
                                                background: "#fff",
                                                cursor: "pointer",
                                            }}
                                        >
                                            +
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* 총액 */}
                    <div
                        style={{
                            marginTop: "20px",
                            paddingTop: "20px",
                            borderTop: "2px solid #e5e5e5",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                        }}
                    >
                        <div style={{ fontSize: "1.3rem", fontWeight: "bold" }}>총 결제금액</div>
                        <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: "#1e7a39" }}>
                            {total.toLocaleString()}원
                        </div>
                    </div>
                </div>

                {/* 대화 UI */}
                {assistantMessage || lastUser ? (
                    <div
                        style={{
                            background: "#fff",
                            border: "1px solid #eee",
                            borderRadius: "12px",
                            padding: "16px",
                        }}
                    >
                        <div style={{ fontSize: 14, color: "#888", marginBottom: "8px" }}>대화</div>
                        {lastUser ? (
                            <div style={{ marginBottom: "8px" }}>
                                <strong>사용자</strong>: {lastUser}
                            </div>
                        ) : null}
                        {assistantMessage ? (
                            <div>
                                <strong>도우미</strong>: {assistantMessage}
                            </div>
                        ) : null}
                    </div>
                ) : null}
            </div>

            {/* 결제하기 버튼 */}
            <div
                style={{
                    padding: "24px",
                    backgroundColor: "#fff",
                    borderTop: "2px solid #e5e5e5",
                }}
            >
                <button
                    onClick={() => {
                        if (cartItems.length === 0) {
                            setErrorMessage("주문할 메뉴가 없습니다.");
                            return;
                        }
                        // 결제 처리 (추후 구현)
                        alert(`결제하기: ${total.toLocaleString()}원`);
                    }}
                    disabled={cartItems.length === 0}
                    style={{
                        width: "100%",
                        maxWidth: "800px",
                        margin: "0 auto",
                        display: "block",
                        padding: "24px",
                        fontSize: "2rem",
                        fontWeight: "bold",
                        borderRadius: "16px",
                        border: "none",
                        background: cartItems.length === 0 ? "#ccc" : "#1e7a39",
                        color: "#fff",
                        cursor: cartItems.length === 0 ? "not-allowed" : "pointer",
                        boxShadow: cartItems.length === 0 ? "none" : "0 8px 16px rgba(0,0,0,0.15)",
                    }}
                >
                    결제하기 ({total.toLocaleString()}원)
                </button>
            </div>

            {errorMessage ? (
                <div style={{ color: "#b00020", padding: "16px", textAlign: "center" }}>{errorMessage}</div>
            ) : null}
        </main>
    );
}

