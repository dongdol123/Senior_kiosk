"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { isTtsActive, speakKorean } from "../utils/speakKorean";
import { registerVoiceSession, stopVoiceSession } from "../utils/voiceSession";
import KioskAspectFrame from "../../components/KioskAspectFrame";
import { getOrderFlowEntry, entryQuery } from "../utils/orderFlowEntry";

function ShrimpRecommendPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const entry = getOrderFlowEntry(searchParams);
    const [cartItems, setCartItems] = useState([]);
    const [shrimpMenus, setShrimpMenus] = useState([]);
    const [isListening, setIsListening] = useState(false);
    const [assistantMessage, setAssistantMessage] = useState("");
    const [voiceLogs, setVoiceLogs] = useState([]);
    const recognitionRef = useRef(null);
    const mountedRef = useRef(true);
    const shouldListenRef = useRef(true);

    function navigateTo(path) {
        stopVoiceSession(recognitionRef.current, shouldListenRef);
        router.push(path);
    }

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

    useEffect(() => {
        const message = "원하시는 메뉴를 골라주세요";
        setAssistantMessage(message);
        speakKorean(message).catch(() => {});
    }, []);

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
            if (isTtsActive()) {
                return;
            }
            const transcript = event.results[0][0].transcript || "";
            const normalized = transcript.toLowerCase().replace(/\s/g, "");
            
            // 음성 인식 로그 추가
            const logEntry = {
                time: new Date().toLocaleTimeString('ko-KR'),
                transcript: transcript,
                normalized: normalized
            };
            setVoiceLogs((prev) => {
                const newLogs = [logEntry, ...prev].slice(0, 10);
                return newLogs;
            });

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
        registerVoiceSession(recognition);

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

    function handleBack() {
        const cartData = encodeURIComponent(JSON.stringify(cartItems));
        const orderType = searchParams.get("orderType") || "takeout";
        navigateTo(`/menu?${entryQuery(entry)}&orderType=${orderType}&cart=${cartData}`);
    }

    async function handleSelectMenu(menu) {
        // 세트/단품 선택 페이지로 이동
        const cartData = encodeURIComponent(JSON.stringify(cartItems));
        const orderType = searchParams.get("orderType") || "takeout";
        navigateTo(`/menu-option?menuId=${menu.id}&menuName=${encodeURIComponent(menu.name)}&price=${menu.price}&cart=${cartData}&orderType=${orderType}&${entryQuery(entry)}`);
    }

    const shell = (
        <main
            style={{
                display: "flex",
                flexDirection: "column",
                minHeight: entry === "qr" ? "100%" : "100vh",
                flex: entry === "qr" ? 1 : undefined,
                backgroundColor: "#f9f9f9",
            }}
        >
            {/* 음성 인식 로그창 - 항상 표시 */}
            <div
                    style={{
                        position: "fixed",
                        top: "10px",
                        right: "10px",
                        width: "300px",
                        maxHeight: "400px",
                        backgroundColor: "#fff",
                        border: "2px solid #1e7a39",
                        borderRadius: "12px",
                        padding: "12px",
                        zIndex: 1000,
                        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                        overflowY: "auto",
                    }}
                >
                    <div style={{ fontWeight: "bold", marginBottom: "8px", color: "#1e7a39", fontSize: "0.9rem" }}>
                        🎤 음성 인식 로그
                    </div>
                    {voiceLogs.length === 0 ? (
                        <div style={{ color: "#999", fontSize: "0.85rem", textAlign: "center", padding: "20px" }}>
                            음성 인식 대기 중...
                        </div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                            {voiceLogs.map((log, index) => (
                            <div
                                key={index}
                                style={{
                                    padding: "8px",
                                    backgroundColor: "#f5f5f5",
                                    borderRadius: "6px",
                                    fontSize: "0.85rem",
                                }}
                            >
                                <div style={{ color: "#666", fontSize: "0.75rem", marginBottom: "4px" }}>
                                    {log.time}
                                </div>
                                <div style={{ fontWeight: "600", marginBottom: "2px" }}>
                                    {log.transcript}
                                </div>
                                <div style={{ color: "#888", fontSize: "0.75rem" }}>
                                    (정규화: {log.normalized})
                                </div>
                            </div>
                            ))}
                        </div>
                    )}
            </div>
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
                <button
                    onClick={handleBack}
                    style={{
                        backgroundColor: "#ffffff",
                        border: "1px solid #ddd",
                        padding: "8px 14px",
                        borderRadius: "8px",
                        cursor: "pointer",
                        fontSize: "1rem",
                        fontWeight: "500",
                    }}
                >
                    뒤로 가기
                </button>
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
                                    overflow: "hidden",
                                }}
                            >
                                {menu.name.includes("칠리") ? (
                                    <img
                                        src="/C_srp.png"
                                        alt={menu.name}
                                        style={{
                                            width: "100%",
                                            height: "100%",
                                            objectFit: "contain",
                                            display: "block",
                                        }}
                                    />
                                ) : menu.name.includes("트러플") ? (
                                    <img
                                        src="/T_srp.png"
                                        alt={menu.name}
                                        style={{
                                            width: "100%",
                                            height: "100%",
                                            objectFit: "contain",
                                            display: "block",
                                        }}
                                    />
                                ) : (
                                    "이미지"
                                )}
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
    return entry === "qr" ? <KioskAspectFrame>{shell}</KioskAspectFrame> : shell;
}

export default function ShrimpRecommendPage() {
    return (
        <Suspense fallback={<main style={{ minHeight: "100vh", backgroundColor: "#f9f9f9" }} />}>
            <ShrimpRecommendPageContent />
        </Suspense>
    );
}










