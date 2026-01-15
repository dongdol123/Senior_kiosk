"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function ShrimpRecommendPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [cartItems, setCartItems] = useState([]);
    const [shrimpMenus, setShrimpMenus] = useState([]);
    const [isListening, setIsListening] = useState(false);
    const [assistantMessage, setAssistantMessage] = useState("");
    const recognitionRef = useRef(null);
    const mountedRef = useRef(true);
    const shouldListenRef = useRef(true);

    // 새우 관련 메뉴만 필터링 (칠리새우버거, 트러플새우버거)
    useEffect(() => {
        async function loadShrimpMenus() {
            try {
                const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/menu/search?keyword=새우`);
                const data = await res.json();
                if (res.ok && data.menus) {
                    // 칠리새우버거와 트러플새우버거만 필터링
                    const filtered = data.menus.filter(m =>
                        m.name.includes("칠리") || m.name.includes("트러플")
                    );
                    setShrimpMenus(filtered);
                }
            } catch (e) {
                console.error('Failed to load shrimp menus:', e);
            }
        }
        loadShrimpMenus();

        // URL에서 장바구니 데이터 로드
        try {
            const cartParam = searchParams.get("cart");
            if (cartParam) {
                setCartItems(JSON.parse(decodeURIComponent(cartParam)));
            }
        } catch (e) {
            console.error('Failed to load cart:', e);
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

    // 음성 인식으로 메뉴 선택
    useEffect(() => {
        mountedRef.current = true;
        shouldListenRef.current = true;

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
            if (mountedRef.current && shouldListenRef.current) {
                setTimeout(() => {
                    try { recognition.start(); } catch { }
                }, 500);
            }
        };
        recognition.onerror = () => {
            setIsListening(false);
        };

        recognition.onresult = async (event) => {
            const transcript = event.results[0][0].transcript || "";
            const normalized = transcript.toLowerCase().replace(/\s/g, "");

            // 칠리 선택
            if (/칠리|매운|매콤|chili/.test(normalized)) {
                const menu = shrimpMenus.find(m => m.name.includes("칠리"));
                if (menu) {
                    handleSelectMenu(menu);
                    return;
                }
            }

            // 트러플 선택
            if (/트러플|트룰플|트룰피|truffle|고급/.test(normalized)) {
                const menu = shrimpMenus.find(m => m.name.includes("트러플"));
                if (menu) {
                    handleSelectMenu(menu);
                    return;
                }
            }

            // 첫번째, 두번째 선택
            if (/첫|일|1|one/.test(normalized)) {
                if (shrimpMenus[0]) {
                    handleSelectMenu(shrimpMenus[0]);
                    return;
                }
            }
            if (/두|둘|2|two/.test(normalized)) {
                if (shrimpMenus[1]) {
                    handleSelectMenu(shrimpMenus[1]);
                    return;
                }
            }
        };

        recognitionRef.current = recognition;

        try {
            recognition.start();
        } catch (e) {
            // 권한 오류는 무시
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
            } catch { }
            try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch { }
        };
    }, [shrimpMenus]);

    async function handleSelectMenu(menu) {
        // 장바구니에 추가
        const newCartItems = [...cartItems];
        const idx = newCartItems.findIndex((p) => p.id === menu.id);
        if (idx >= 0) {
            newCartItems[idx] = { ...newCartItems[idx], qty: newCartItems[idx].qty + 1 };
        } else {
            newCartItems.push({ ...menu, qty: 1 });
        }

        const msg = `${menu.name}를 장바구니에 담았어요.`;
        setAssistantMessage(msg);
        await speakKorean(msg);

        // 장바구니 데이터를 메뉴 페이지로 전달하고 이동
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
                    {isListening ? "음성 인식 중" : "터치 또는 음성으로 선택"}
                </div>
            </div>

            {/* 메뉴 표시 */}
            <div
                style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "40px 20px",
                    gap: "40px",
                }}
            >
                <h2 style={{ fontSize: "2rem", fontWeight: "bold", marginBottom: "20px" }}>
                    새우 메뉴 추천
                </h2>

                <div
                    style={{
                        display: "flex",
                        gap: "40px",
                        width: "100%",
                        maxWidth: "1000px",
                        justifyContent: "center",
                    }}
                >
                    {shrimpMenus.map((menu, index) => (
                        <div
                            key={menu.id}
                            onClick={() => handleSelectMenu(menu)}
                            style={{
                                flex: 1,
                                maxWidth: "400px",
                                background: "#fff",
                                border: "3px solid #1e7a39",
                                borderRadius: "20px",
                                padding: "24px",
                                cursor: "pointer",
                                boxShadow: "0 8px 16px rgba(0,0,0,0.15)",
                                transition: "transform 0.2s, box-shadow 0.2s",
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = "scale(1.02)";
                                e.currentTarget.style.boxShadow = "0 12px 24px rgba(0,0,0,0.2)";
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = "scale(1)";
                                e.currentTarget.style.boxShadow = "0 8px 16px rgba(0,0,0,0.15)";
                            }}
                        >
                            {/* 이미지 영역 */}
                            <div
                                style={{
                                    width: "100%",
                                    height: "300px",
                                    background: "#f3f3f3",
                                    border: "2px dashed #ddd",
                                    borderRadius: "12px",
                                    marginBottom: "20px",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    color: "#999",
                                }}
                            >
                                이미지
                            </div>

                            {/* 메뉴 정보 */}
                            <div style={{ textAlign: "center" }}>
                                <div style={{ fontSize: "2rem", fontWeight: "bold", marginBottom: "12px" }}>
                                    {menu.name}
                                </div>
                                <div style={{ fontSize: "1.8rem", color: "#1e7a39", fontWeight: "bold" }}>
                                    {menu.price.toLocaleString()}원
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {assistantMessage ? (
                    <div
                        style={{
                            background: "#fff",
                            border: "1px solid #eee",
                            borderRadius: "12px",
                            padding: "16px",
                            maxWidth: "600px",
                            textAlign: "center",
                        }}
                    >
                        <strong>도우미</strong>: {assistantMessage}
                    </div>
                ) : null}
            </div>
        </main>
    );
}









