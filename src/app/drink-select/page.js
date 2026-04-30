"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, useEffect, useRef } from "react";
import { isTtsActive, speakKorean } from "../utils/speakKorean";
import { registerVoiceSession, stopVoiceSession } from "../utils/voiceSession";
import KioskAspectFrame from "../../components/KioskAspectFrame";
import { getOrderFlowEntry, entryQuery } from "../utils/orderFlowEntry";

function drinkUnitPrice(size) {
    return size === "라지" ? 3000 : 2500;
}

function sideBasePrice(sideName) {
    return sideName === "치킨윙 4개" ? 4000 : 2500;
}

function sideUnitPrice(sideName, size) {
    const base = sideBasePrice(sideName);
    return size === "라지" ? base + 500 : base;
}

const NONE_OPTION = "None";

function DrinkSelectPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const entry = getOrderFlowEntry(searchParams);
    const [menuName, setMenuName] = useState("");
    const [menuPrice, setMenuPrice] = useState(0);
    const [menuId, setMenuId] = useState("");
    const [selectedDrink, setSelectedDrink] = useState("");
    const [selectedDrinkSize, setSelectedDrinkSize] = useState("");
    const [selectedSide, setSelectedSide] = useState("");
    const [selectedSideSize, setSelectedSideSize] = useState("");
    const [cartItems, setCartItems] = useState([]);
    const [isListening, setIsListening] = useState(false);
    const [assistantMessage, setAssistantMessage] = useState("");
    const [voiceLogs, setVoiceLogs] = useState([]);
    const recognitionRef = useRef(null);
    const mountedRef = useRef(true);
    const isSpeakingRef = useRef(false);
    const shouldListenRef = useRef(true);
    const restartingRef = useRef(false);
    const sidePromptPlayedRef = useRef(false);

    function navigateTo(path) {
        stopVoiceSession(recognitionRef.current, shouldListenRef, isSpeakingRef);
        router.push(path);
    }

    const drinks = ["카페라떼", "아이스티"];
    const drinkSizes = [
        { name: "미디움", price: 2500 },
        { name: "라지", price: 3000 },
    ];
    const sides = ["치킨윙 4개", "해쉬브라운"];
    const sideSizeOptions = [{ name: "미디움" }, { name: "라지" }];

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

    useEffect(() => {
        sidePromptPlayedRef.current = false;
    }, [searchParams]);

    useEffect(() => {
        if (!selectedDrinkSize || selectedSide || sidePromptPlayedRef.current) return;
        sidePromptPlayedRef.current = true;
        const msg = "사이드를 골라주세요.";
        setAssistantMessage(msg);
        speakKorean(msg).catch(err => console.error("음성 안내 오류:", err));
    }, [selectedDrinkSize, selectedSide]);

    useEffect(() => {
        if (selectedDrink && selectedDrinkSize && selectedSide && selectedSideSize) {
            const drinkP = selectedDrink === NONE_OPTION ? 0 : drinkUnitPrice(selectedDrinkSize);
            const sideP = selectedSide === NONE_OPTION ? 0 : sideUnitPrice(selectedSide, selectedSideSize);
            const timer = setTimeout(() => {
                const totalPrice = menuPrice + drinkP + sideP;
                const setItems = [
                    { name: menuName, price: menuPrice },
                    ...(selectedDrink === NONE_OPTION
                        ? []
                        : [{ name: selectedDrink, size: selectedDrinkSize, price: drinkP }]),
                    ...(selectedSide === NONE_OPTION
                        ? []
                        : [{ name: selectedSide, size: selectedSideSize, price: sideP }]),
                ];
                const newCartItems = [...cartItems];
                newCartItems.push({
                    id: `${menuId}_set_${Date.now()}`,
                    name: menuName ? `${menuName} 세트` : "세트",
                    price: totalPrice,
                    qty: 1,
                    type: "set",
                    items: setItems,
                });
                const cartData = encodeURIComponent(JSON.stringify(newCartItems));
                const orderType = searchParams.get("orderType") || "takeout";
                navigateTo(`/menu?${entryQuery(entry)}&orderType=${orderType}&cart=${cartData}`);
            }, 800);
            return () => clearTimeout(timer);
        }
    }, [selectedDrink, selectedDrinkSize, selectedSide, selectedSideSize, menuId, menuName, menuPrice, cartItems, searchParams, router]);

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

        recognition.onstart = () => {
            setIsListening(true);
        };
        recognition.onend = () => {
            setIsListening(false);
            if (mountedRef.current && shouldListenRef.current && !restartingRef.current) {
                restartingRef.current = true;
                const delay = isSpeakingRef.current ? 2000 : 500;
                setTimeout(() => {
                    if (!mountedRef.current || !shouldListenRef.current) {
                        restartingRef.current = false;
                        return;
                    }
                    if (isSpeakingRef.current) {
                        restartingRef.current = false;
                        setTimeout(() => {
                            if (mountedRef.current && shouldListenRef.current && !restartingRef.current) {
                                restartingRef.current = true;
                                try {
                                    recognition.start();
                                    restartingRef.current = false;
                                } catch (e) {
                                    restartingRef.current = false;
                                    setTimeout(() => {
                                        if (mountedRef.current && shouldListenRef.current && !restartingRef.current) {
                                            try {
                                                recognition.start();
                                            } catch (e2) {
                                                console.log("음성 인식 재시작 재시도 실패:", e2);
                                            }
                                        }
                                    }, 1000);
                                }
                            }
                        }, 2000);
                        return;
                    }
                    try {
                        recognition.start();
                        restartingRef.current = false;
                    } catch (e) {
                        restartingRef.current = false;
                        setTimeout(() => {
                            if (mountedRef.current && shouldListenRef.current && !restartingRef.current) {
                                try {
                                    recognition.start();
                                } catch (e2) {
                                    console.log("음성 인식 재시작 재시도 실패:", e2);
                                }
                            }
                        }, 1000);
                    }
                }, delay);
            }
        };
        recognition.onerror = (event) => {
            setIsListening(false);
            if (mountedRef.current && shouldListenRef.current && !restartingRef.current) {
                restartingRef.current = true;
                setTimeout(() => {
                    if (!mountedRef.current || !shouldListenRef.current) {
                        restartingRef.current = false;
                        return;
                    }
                    if (isSpeakingRef.current) {
                        restartingRef.current = false;
                        setTimeout(() => {
                            if (mountedRef.current && shouldListenRef.current && !restartingRef.current) {
                                try {
                                    recognition.start();
                                } catch (e) {
                                    console.log("음성 인식 재시작 오류:", e);
                                }
                            }
                        }, 2000);
                        return;
                    }
                    try {
                        recognition.start();
                        restartingRef.current = false;
                    } catch (e) {
                        console.log("음성 인식 재시작 오류:", e);
                        restartingRef.current = false;
                        setTimeout(() => {
                            if (mountedRef.current && shouldListenRef.current && !restartingRef.current) {
                                try {
                                    recognition.start();
                                } catch (e2) {
                                    console.log("음성 인식 재시작 재시도 실패:", e2);
                                }
                            }
                        }, 2000);
                    }
                }, 500);
            }
        };

        recognition.onresult = async (event) => {
            if (isTtsActive()) {
                return;
            }
            if (isSpeakingRef.current) {
                console.log("🔇 음성 안내 재생 중이므로 음성 인식 결과 무시:", event.results[0][0].transcript);
                return;
            }

            const transcript = event.results[0][0].transcript || "";
            const normalized = transcript.toLowerCase().replace(/\s/g, "");

            const logEntry = {
                time: new Date().toLocaleTimeString('ko-KR'),
                transcript: transcript,
                normalized: normalized
            };
            setVoiceLogs((prev) => {
                const newLogs = [logEntry, ...prev].slice(0, 10);
                return newLogs;
            });

            let reply = "";

            if (/아이스티|icetea|ice\s*tea/.test(normalized)) {
                setSelectedDrink("아이스티");
                setSelectedDrinkSize("");
                reply = "아이스티를 선택했어요. 음료 사이즈를 선택해주세요.";
            } else if (/카페라떼|라떼|latte/.test(normalized)) {
                setSelectedDrink("카페라떼");
                setSelectedDrinkSize("");
                reply = "카페라떼를 선택했어요. 음료 사이즈를 선택해주세요.";
            }

            if (/치킨윙|치킨윙네개|윙네개|윙/.test(normalized)) {
                setSelectedSide("치킨윙 4개");
                setSelectedSideSize("");
                reply = "치킨윙을 선택했어요. 사이드 사이즈를 선택해주세요.";
            } else if (/해쉬|해시|hash|브라운/.test(normalized)) {
                setSelectedSide("해쉬브라운");
                setSelectedSideSize("");
                reply = "해쉬브라운을 선택했어요. 사이드 사이즈를 선택해주세요.";
            }

            if (!reply) {
                if (/미디움|미디엄|중간/.test(normalized)) {
                    if (selectedSide && !selectedSideSize) {
                        setSelectedSideSize("미디움");
                        reply = `${selectedSide} 미디움으로 선택했어요.`;
                    } else if (selectedDrink && !selectedDrinkSize) {
                        setSelectedDrinkSize("미디움");
                        reply = `${selectedDrink} 미디움으로 선택했어요.`;
                    }
                } else if (/라지|큰거|큰사이즈|큰/.test(normalized)) {
                    if (selectedSide && !selectedSideSize) {
                        setSelectedSideSize("라지");
                        reply = `${selectedSide} 라지로 선택했어요.`;
                    } else if (selectedDrink && !selectedDrinkSize) {
                        setSelectedDrinkSize("라지");
                        reply = `${selectedDrink} 라지로 선택했어요.`;
                    }
                }
            }

            if (!reply) {
                reply = "카페라떼 또는 아이스티, 치킨윙 또는 해쉬브라운을 고른 뒤 사이즈를 말씀해 주세요.";
            }

            setAssistantMessage(reply);
            try { recognition.stop(); } catch (e) { }
            isSpeakingRef.current = true;
            await speakKorean(reply);
            setTimeout(() => {
                isSpeakingRef.current = false;
                if (mountedRef.current && shouldListenRef.current) {
                    setTimeout(() => {
                        if (recognitionRef.current && mountedRef.current && shouldListenRef.current) {
                            try { recognitionRef.current.start(); } catch (e) { }
                        }
                    }, 2000);
                }
            }, 1000);
        };

        recognitionRef.current = recognition;
        registerVoiceSession(recognition);

        try {
            recognition.start();
        } catch (e) {
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
            } catch { }
            try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch { }
        };
    }, [selectedDrink, selectedDrinkSize, selectedSide, selectedSideSize]);

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
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <h2 style={{ fontSize: "1.5rem", fontWeight: "bold" }}>음료/사이드 선택</h2>
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
                    onClick={() => {
                        const cartData = encodeURIComponent(JSON.stringify(cartItems));
                        const orderType = searchParams.get("orderType") || "takeout";
                        navigateTo(`/menu-option?menuId=${menuId}&menuName=${encodeURIComponent(menuName)}&price=${menuPrice}&cart=${cartData}&orderType=${orderType}&${entryQuery(entry)}`);
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
                    padding: "30px 20px",
                    gap: "30px",
                    maxWidth: "800px",
                    width: "100%",
                    margin: "0 auto",
                }}
            >
                {/* 음료 선택 */}
                <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
                        <h3 style={{ fontSize: "1.3rem", fontWeight: "bold", margin: 0 }}>
                            음료를 선택하세요
                        </h3>
                        {selectedDrink && selectedDrinkSize && selectedDrink !== NONE_OPTION && selectedDrinkSize !== NONE_OPTION && (
                            <div style={{ fontSize: "1rem", fontWeight: "700", color: "#1e7a39" }}>
                                {selectedDrink} : {drinkSizes.find((s) => s.name === selectedDrinkSize)?.price.toLocaleString() || "0"}원
                            </div>
                        )}
                    </div>
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                            gap: "12px",
                            maxWidth: "720px",
                            margin: "0 auto",
                        }}
                    >
                        <button
                            key={NONE_OPTION}
                            onClick={() => {
                                setSelectedDrink(NONE_OPTION);
                                setSelectedDrinkSize(NONE_OPTION);
                            }}
                            style={{
                                minHeight: "170px",
                                fontSize: "1.1rem",
                                fontWeight: "bold",
                                backgroundColor: selectedDrink === NONE_OPTION ? "#1e7a39" : "#fff",
                                color: selectedDrink === NONE_OPTION ? "#fff" : "#333",
                                border: selectedDrink === NONE_OPTION ? "3px solid #1e7a39" : "2px solid #ddd",
                                borderRadius: "12px",
                                cursor: "pointer",
                                boxShadow: selectedDrink === NONE_OPTION ? "0 4px 12px rgba(0,0,0,0.2)" : "0 2px 6px rgba(0,0,0,0.1)",
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 8,
                                padding: "16px 12px",
                            }}
                        >
                            <div style={{ fontSize: "1.4rem", fontWeight: "800" }}>선택 안 함</div>
                        </button>
                        {drinks.map((drink) => (
                            <button
                                key={drink}
                                onClick={() => {
                                    setSelectedDrink(drink);
                                    setSelectedDrinkSize("");
                                }}
                                style={{
                                    minHeight: "170px",
                                    fontSize: "1.1rem",
                                    fontWeight: "bold",
                                    backgroundColor: selectedDrink === drink ? "#1e7a39" : "#fff",
                                    color: selectedDrink === drink ? "#fff" : "#333",
                                    border: selectedDrink === drink ? "3px solid #1e7a39" : "2px solid #ddd",
                                    borderRadius: "12px",
                                    cursor: "pointer",
                                    boxShadow: selectedDrink === drink ? "0 4px 12px rgba(0,0,0,0.2)" : "0 2px 6px rgba(0,0,0,0.1)",
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: 8,
                                    padding: "16px 12px",
                                }}
                            >
                                <img
                                    src={drink === "카페라떼" ? "/latte.png" : "/icetea.png"}
                                    alt=""
                                    style={{ width: 72, height: 72, objectFit: "contain" }}
                                />
                                {drink}
                                <div style={{ fontSize: "0.9rem", marginTop: 2, opacity: 0.85 }}>
                                    M {drinkSizes[0].price.toLocaleString()}원
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* 음료 사이즈 선택 */}
                {selectedDrink && !selectedDrinkSize && (
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "1.2fr 1fr",
                            gap: "16px",
                            alignItems: "stretch",
                        }}
                    >
                        <div
                            style={{
                                background: "#fff",
                                border: "1px solid #e5e5e5",
                                borderRadius: 14,
                                padding: 16,
                                minHeight: 220,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
                                overflow: "hidden",
                            }}
                        >
                            {selectedDrink === "카페라떼" ? (
                                <img
                                    src="/latte.png"
                                    alt="사이즈 선택"
                                    style={{
                                        width: "100%",
                                        height: "100%",
                                        objectFit: "contain",
                                        display: "block",
                                    }}
                                />
                            ) : selectedDrink === "아이스티" ? (
                                <img
                                    src="/icetea.png"
                                    alt="사이즈 선택"
                                    style={{
                                        width: "100%",
                                        height: "100%",
                                        objectFit: "contain",
                                        display: "block",
                                    }}
                                />
                            ) : (
                                <div style={{ color: "#8aa0c5", fontWeight: 700 }}>
                                    음료 이미지 추가 영역
                                </div>
                            )}
                        </div>
                        <div
                            style={{
                                background: "#fff",
                                border: "1px solid #e5e5e5",
                                borderRadius: 14,
                                padding: 16,
                                display: "flex",
                                flexDirection: "column",
                                gap: 12,
                                boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
                            }}
                        >
                            <div style={{ fontSize: "1.2rem", fontWeight: "bold" }}>
                                {selectedDrink} 사이즈를 선택하세요
                            </div>
                            {drinkSizes.map((size) => (
                                <button
                                    key={size.name}
                                    onClick={() => {
                                        setSelectedDrinkSize(size.name);
                                    }}
                                    style={{
                                        height: "70px",
                                        fontSize: "1.1rem",
                                        fontWeight: "bold",
                                        backgroundColor: selectedDrinkSize === size.name ? "#4a90e2" : "#f7f9fc",
                                        color: selectedDrinkSize === size.name ? "#fff" : "#333",
                                        border: selectedDrinkSize === size.name ? "2px solid #4a90e2" : "1px solid #d7dfef",
                                        borderRadius: "10px",
                                        cursor: "pointer",
                                        boxShadow: selectedDrinkSize === size.name ? "0 4px 12px rgba(0,0,0,0.12)" : "none",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        padding: "0 14px",
                                    }}
                                >
                                    <div>
                                        {size.name === "미디움" ? "중간 사이즈로 주문하기" : "큰 사이즈로 주문하기 (+500원)"}
                                        <div style={{ fontSize: "0.9rem", opacity: 0.9 }}>
                                            {size.name === "라지" ? `+500원 (총 ${size.price.toLocaleString()}원)` : `${size.price.toLocaleString()}원`}
                                        </div>
                                    </div>
                                    <span style={{ fontWeight: 800, fontSize: "1rem" }}>
                                        {size.name === "라지" ? "+500원" : "M"}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* 사이드 선택 */}
                <div>
                    <h3 style={{ fontSize: "1.3rem", fontWeight: "bold", marginBottom: "20px" }}>
                        사이드를 선택하세요
                    </h3>
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                            gap: "12px",
                            maxWidth: "720px",
                            margin: "0 auto",
                        }}
                    >
                        <button
                            key={NONE_OPTION}
                            onClick={() => {
                                setSelectedSide(NONE_OPTION);
                                setSelectedSideSize(NONE_OPTION);
                            }}
                            style={{
                                minHeight: "170px",
                                fontSize: "1.1rem",
                                fontWeight: "bold",
                                backgroundColor: selectedSide === NONE_OPTION ? "#1e7a39" : "#fff",
                                color: selectedSide === NONE_OPTION ? "#fff" : "#333",
                                border: selectedSide === NONE_OPTION ? "3px solid #1e7a39" : "2px solid #ddd",
                                borderRadius: "12px",
                                cursor: "pointer",
                                boxShadow: selectedSide === NONE_OPTION ? "0 4px 12px rgba(0,0,0,0.2)" : "0 2px 6px rgba(0,0,0,0.1)",
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 8,
                                padding: "16px 12px",
                            }}
                        >
                            <div style={{ fontSize: "1.4rem", fontWeight: "800" }}>선택 안 함</div>
                        </button>
                        {sides.map((side) => (
                            <button
                                key={side}
                                onClick={() => {
                                    setSelectedSide(side);
                                    setSelectedSideSize("");
                                }}
                                style={{
                                    minHeight: "170px",
                                    fontSize: "1.1rem",
                                    fontWeight: "bold",
                                    backgroundColor: selectedSide === side ? "#1e7a39" : "#fff",
                                    color: selectedSide === side ? "#fff" : "#333",
                                    border: selectedSide === side ? "3px solid #1e7a39" : "2px solid #ddd",
                                    borderRadius: "12px",
                                    cursor: "pointer",
                                    boxShadow: selectedSide === side ? "0 4px 12px rgba(0,0,0,0.2)" : "0 2px 6px rgba(0,0,0,0.1)",
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: 8,
                                    padding: "16px 12px",
                                }}
                            >
                                <img
                                    src={side === "치킨윙 4개" ? "/wing.png" : "/hash.png"}
                                    alt=""
                                    style={{ width: 72, height: 72, objectFit: "contain" }}
                                />
                                {side}
                                <div style={{ fontSize: "0.9rem", marginTop: 2, opacity: 0.85 }}>
                                    M {sideBasePrice(side).toLocaleString()}원
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* 사이드 사이즈 선택 */}
                {selectedSide && !selectedSideSize && (
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "1.2fr 1fr",
                            gap: "16px",
                            alignItems: "stretch",
                        }}
                    >
                        <div
                            style={{
                                background: "#fff",
                                border: "1px solid #e5e5e5",
                                borderRadius: 14,
                                padding: 16,
                                minHeight: 220,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
                                overflow: "hidden",
                            }}
                        >
                            <img
                                src={selectedSide === "치킨윙 4개" ? "/wing.png" : "/hash.png"}
                                alt={selectedSide}
                                style={{
                                    width: "100%",
                                    height: "100%",
                                    objectFit: "contain",
                                    display: "block",
                                }}
                            />
                        </div>
                        <div
                            style={{
                                background: "#fff",
                                border: "1px solid #e5e5e5",
                                borderRadius: 14,
                                padding: 16,
                                display: "flex",
                                flexDirection: "column",
                                gap: 12,
                                boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
                            }}
                        >
                            <div style={{ fontSize: "1.2rem", fontWeight: "bold" }}>
                                {selectedSide} 사이즈를 선택하세요
                            </div>
                            {sideSizeOptions.map((size) => {
                                const p = sideUnitPrice(selectedSide, size.name);
                                return (
                                    <button
                                        key={size.name}
                                        onClick={() => setSelectedSideSize(size.name)}
                                        style={{
                                            height: "70px",
                                            fontSize: "1.1rem",
                                            fontWeight: "bold",
                                            backgroundColor: selectedSideSize === size.name ? "#4a90e2" : "#f7f9fc",
                                            color: selectedSideSize === size.name ? "#fff" : "#333",
                                            border: selectedSideSize === size.name ? "2px solid #4a90e2" : "1px solid #d7dfef",
                                            borderRadius: "10px",
                                            cursor: "pointer",
                                            boxShadow: selectedSideSize === size.name ? "0 4px 12px rgba(0,0,0,0.12)" : "none",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "space-between",
                                            padding: "0 14px",
                                        }}
                                    >
                                        <div>
                                            <div style={{ fontSize: "1rem", fontWeight: 700, lineHeight: 1.2 }}>
                                                {size.name === "미디움" ? "중간 사이즈로 주문하기" : "큰 사이즈로 주문하기 (+500원)"}
                                            </div>
                                            <div style={{ fontSize: "0.85rem", opacity: 0.9 }}>
                                                {size.name === "라지" ? `+500원 (총 ${p.toLocaleString()}원)` : `${p.toLocaleString()}원`}
                                            </div>
                                        </div>
                                        <span style={{ fontWeight: 800, fontSize: "1rem" }}>
                                            {size.name === "라지" ? "+500원" : "M"}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </main>
    );
    return entry === "qr" ? <KioskAspectFrame>{shell}</KioskAspectFrame> : shell;
}

export default function DrinkSelectPage() {
    return (
        <Suspense fallback={<main style={{ minHeight: "100vh", backgroundColor: "#f9f9f9" }} />}>
            <DrinkSelectPageContent />
        </Suspense>
    );
}

