"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useRef } from "react";

export default function MenuOptionPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [menuName, setMenuName] = useState("");
    const [menuPrice, setMenuPrice] = useState(0);
    const [menuId, setMenuId] = useState("");
    const [cartItems, setCartItems] = useState([]);
    const [isListening, setIsListening] = useState(false);
    const [assistantMessage, setAssistantMessage] = useState("");
    const recognitionRef = useRef(null);
    const mountedRef = useRef(true);

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

    useEffect(() => {
        setMenuName(decodeURIComponent(searchParams.get("menuName") || ""));
        setMenuPrice(parseInt(searchParams.get("price") || "0"));
        setMenuId(searchParams.get("menuId") || "");
        
        const cartParam = searchParams.get("cart");
        if (cartParam) {
            try {
                setCartItems(JSON.parse(decodeURIComponent(cartParam)));
            } catch (e) {
                console.error("Failed to load cart:", e);
            }
        }
    }, [searchParams]);

    // 음성 인식
    useEffect(() => {
        mountedRef.current = true;

        const SpeechRecognition =
            typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);
        if (!SpeechRecognition) {
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = "ko-KR";
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => setIsListening(true);
        recognition.onend = () => {
            setIsListening(false);
            if (mountedRef.current) {
                setTimeout(() => {
                    try { recognition.start(); } catch {}
                }, 500);
            }
        };
        recognition.onerror = () => {
            setIsListening(false);
        };

        recognition.onresult = async (event) => {
            const transcript = event.results[0][0].transcript || "";
            const normalized = transcript.toLowerCase().replace(/\s/g, "");

            // 단품 선택
            if (/단품|단품으로|단품주문/.test(normalized)) {
                setAssistantMessage("단품을 선택하셨어요.");
                await speakKorean("단품을 선택하셨어요.");
                setTimeout(() => handleSingle(), 1000);
                return;
            }

            // 세트 선택
            if (/세트|세트로|세트주문/.test(normalized)) {
                setAssistantMessage("세트를 선택하셨어요. 음료를 선택해주세요.");
                await speakKorean("세트를 선택하셨어요. 음료를 선택해주세요.");
                setTimeout(() => handleSet(), 1000);
                return;
            }

            // 기본 세트 선택
            if (/기본|기본세트|기본적용/.test(normalized)) {
                setAssistantMessage("기본 세트를 선택하셨어요.");
                await speakKorean("기본 세트를 선택하셨어요.");
                setTimeout(() => handleDefaultSet(), 1000);
                return;
            }

            // AI 도움말
            const msg = "단품, 세트, 기본 세트 중 하나를 말씀해주세요.";
            setAssistantMessage(msg);
            await speakKorean(msg);
        };

        recognitionRef.current = recognition;

        try {
            recognition.start();
        } catch (e) {
            // 권한 오류는 무시
        }

        return () => {
            mountedRef.current = false;
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

    function handleSingle() {
        // 단품 장바구니에 추가
        const newCartItems = [...cartItems];
        const idx = newCartItems.findIndex((p) => p.id === menuId);
        if (idx >= 0) {
            newCartItems[idx] = { ...newCartItems[idx], qty: newCartItems[idx].qty + 1 };
        } else {
            newCartItems.push({ id: menuId, name: menuName, price: menuPrice, qty: 1, type: "single" });
        }

        const cartData = encodeURIComponent(JSON.stringify(newCartItems));
        const orderType = searchParams.get("orderType") || "takeout";
        router.push(`/menu?entry=voice&orderType=${orderType}&cart=${cartData}`);
    }

    function handleSet() {
        // 세트 선택 시 음료 선택 페이지로
        const cartData = encodeURIComponent(JSON.stringify(cartItems));
        const orderType = searchParams.get("orderType") || "takeout";
        router.push(`/drink-select?menuId=${menuId}&menuName=${encodeURIComponent(menuName)}&price=${menuPrice}&cart=${cartData}&orderType=${orderType}`);
    }

    function handleDefaultSet() {
        // 기본 세트: 콜라(미디움) + 감자튀김(미디움)
        const newCartItems = [...cartItems];
        const setPrice = menuPrice + 2000 + 3000; // 메뉴 + 콜라(미디움) + 감자튀김(미디움)
        
        const idx = newCartItems.findIndex((p) => p.id === `${menuId}_set_default`);
        if (idx >= 0) {
            newCartItems[idx] = { ...newCartItems[idx], qty: newCartItems[idx].qty + 1 };
        } else {
            newCartItems.push({
                id: `${menuId}_set_default`,
                name: `${menuName} 세트 (기본)`,
                price: setPrice,
                qty: 1,
                type: "set",
                items: [
                    { name: menuName, price: menuPrice },
                    { name: "콜라", size: "미디움", price: 2000 },
                    { name: "감자튀김", size: "미디움", price: 3000 },
                ],
            });
        }

        const cartData = encodeURIComponent(JSON.stringify(newCartItems));
        const orderType = searchParams.get("orderType") || "takeout";
        router.push(`/menu?entry=voice&orderType=${orderType}&cart=${cartData}`);
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
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <h2 style={{ fontSize: "1.5rem", fontWeight: "bold" }}>{menuName}</h2>
                    <div
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "8px",
                            backgroundColor: isListening ? "#e6f4ea" : "#eee",
                            color: isListening ? "#1e7a39" : "#777",
                            border: isListening ? "1px solid #bfe3ca" : "1px solid #ddd",
                            borderRadius: "999px",
                            padding: "6px 12px",
                            fontWeight: "bold",
                            fontSize: "0.9rem",
                        }}
                    >
                        <span style={{ width: 8, height: 8, background: isListening ? "#34c759" : "#bbb", borderRadius: "50%" }} />
                        {isListening ? "음성 인식 중" : "대화로 선택 가능"}
                    </div>
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

            {/* 음성 안내 메시지 */}
            {assistantMessage && (
                <div
                    style={{
                        padding: "12px 16px",
                        backgroundColor: "#fff",
                        borderBottom: "1px solid #e5e5e5",
                        textAlign: "center",
                        color: "#1e7a39",
                        fontWeight: "600",
                    }}
                >
                    {assistantMessage}
                </div>
            )}

            {/* 메인 컨텐츠 */}
            <div
                style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "40px 20px",
                    gap: "30px",
                }}
            >
                {/* 단품/세트 선택 버튼 */}
                <div
                    style={{
                        display: "flex",
                        gap: "24px",
                        width: "100%",
                        maxWidth: "600px",
                    }}
                >
                    <button
                        onClick={handleSingle}
                        style={{
                            flex: 1,
                            height: "120px",
                            fontSize: "2rem",
                            fontWeight: "bold",
                            backgroundColor: "#1e7a39",
                            color: "#fff",
                            border: "none",
                            borderRadius: "16px",
                            cursor: "pointer",
                            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                        }}
                    >
                        단품
                        <div style={{ fontSize: "1.2rem", marginTop: "8px", opacity: 0.9 }}>
                            {menuPrice.toLocaleString()}원
                        </div>
                    </button>

                    <button
                        onClick={handleSet}
                        style={{
                            flex: 1,
                            height: "120px",
                            fontSize: "2rem",
                            fontWeight: "bold",
                            backgroundColor: "#ff6b35",
                            color: "#fff",
                            border: "none",
                            borderRadius: "16px",
                            cursor: "pointer",
                            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                        }}
                    >
                        세트
                        <div style={{ fontSize: "1rem", marginTop: "8px", opacity: 0.9 }}>
                            음료+사이드 선택
                        </div>
                    </button>
                </div>

                {/* 기본 세트 적용 버튼 */}
                <button
                    onClick={handleDefaultSet}
                    style={{
                        width: "100%",
                        maxWidth: "600px",
                        height: "80px",
                        fontSize: "1.5rem",
                        fontWeight: "bold",
                        backgroundColor: "#4a90e2",
                        color: "#fff",
                        border: "none",
                        borderRadius: "16px",
                        cursor: "pointer",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                    }}
                >
                    기본 세트 적용 (콜라 / 감자튀김)
                    <div style={{ fontSize: "1rem", marginTop: "4px", opacity: 0.9 }}>
                        {(menuPrice + 2000 + 3000).toLocaleString()}원
                    </div>
                </button>
            </div>
        </main>
    );
}

