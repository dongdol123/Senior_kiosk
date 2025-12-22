"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useRef } from "react";

export default function DrinkSelectPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [menuName, setMenuName] = useState("");
    const [menuPrice, setMenuPrice] = useState(0);
    const [menuId, setMenuId] = useState("");
    const [selectedDrink, setSelectedDrink] = useState("");
    const [selectedSize, setSelectedSize] = useState("");
    const [cartItems, setCartItems] = useState([]);
    const [isListening, setIsListening] = useState(false);
    const [assistantMessage, setAssistantMessage] = useState("");
    const recognitionRef = useRef(null);
    const mountedRef = useRef(true);

    const drinks = ["콜라", "제로콜라", "사이다", "커피"];
    const sizes = [
        { name: "미디움", price: 2000 },
        { name: "라지", price: 2500 }, // +500원
    ];

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

            // 음료 선택
            if (!selectedDrink) {
                if (/콜라/.test(normalized)) {
                    setSelectedDrink("콜라");
                    const msg = "콜라를 선택하셨어요. 사이즈를 선택해주세요.";
                    setAssistantMessage(msg);
                    await speakKorean(msg);
                    return;
                }
                if (/제로|제로콜라/.test(normalized)) {
                    setSelectedDrink("제로콜라");
                    const msg = "제로콜라를 선택하셨어요. 사이즈를 선택해주세요.";
                    setAssistantMessage(msg);
                    await speakKorean(msg);
                    return;
                }
                if (/사이다/.test(normalized)) {
                    setSelectedDrink("사이다");
                    const msg = "사이다를 선택하셨어요. 사이즈를 선택해주세요.";
                    setAssistantMessage(msg);
                    await speakKorean(msg);
                    return;
                }
                if (/커피|coffee/.test(normalized)) {
                    setSelectedDrink("커피");
                    const msg = "커피를 선택하셨어요. 사이즈를 선택해주세요.";
                    setAssistantMessage(msg);
                    await speakKorean(msg);
                    return;
                }
            }

            // 사이즈 선택
            if (selectedDrink && !selectedSize) {
                if (/미디움|미디엄|중간/.test(normalized)) {
                    setSelectedSize("미디움");
                    const msg = "미디움 사이즈를 선택하셨어요.";
                    setAssistantMessage(msg);
                    await speakKorean(msg);
                    setTimeout(() => handleNext(), 1500);
                    return;
                }
                if (/라지|큰거|큰사이즈/.test(normalized)) {
                    setSelectedSize("라지");
                    const msg = "라지 사이즈를 선택하셨어요.";
                    setAssistantMessage(msg);
                    await speakKorean(msg);
                    setTimeout(() => handleNext(), 1500);
                    return;
                }
            }

            const msg = selectedDrink ? "미디움 또는 라지 사이즈를 말씀해주세요." : "콜라, 제로콜라, 사이다, 커피 중 하나를 말씀해주세요.";
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
    }, [selectedDrink, selectedSize]);

    function handleNext() {
        if (!selectedDrink || !selectedSize) {
            alert("음료와 사이즈를 선택해주세요.");
            return;
        }

        const selectedSizeObj = sizes.find(s => s.name === selectedSize);
        const cartData = encodeURIComponent(JSON.stringify(cartItems));
        const orderType = searchParams.get("orderType") || "takeout";
        
        router.push(
            `/side-select?menuId=${menuId}&menuName=${encodeURIComponent(menuName)}&price=${menuPrice}` +
            `&drink=${encodeURIComponent(selectedDrink)}&drinkSize=${encodeURIComponent(selectedSize)}&drinkPrice=${selectedSizeObj.price}` +
            `&cart=${cartData}&orderType=${orderType}`
        );
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
                    <h2 style={{ fontSize: "1.5rem", fontWeight: "bold" }}>음료 선택</h2>
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
                        router.push(`/menu-option?menuId=${menuId}&menuName=${encodeURIComponent(menuName)}&price=${menuPrice}&cart=${cartData}&orderType=${orderType}`);
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
                    <h3 style={{ fontSize: "1.3rem", fontWeight: "bold", marginBottom: "20px" }}>
                        음료를 선택하세요
                    </h3>
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(4, 1fr)",
                            gap: "12px",
                        }}
                    >
                        {drinks.map((drink) => (
                            <button
                                key={drink}
                                onClick={() => setSelectedDrink(drink)}
                                style={{
                                    height: "90px",
                                    fontSize: "1.1rem",
                                    fontWeight: "bold",
                                    backgroundColor: selectedDrink === drink ? "#1e7a39" : "#fff",
                                    color: selectedDrink === drink ? "#fff" : "#333",
                                    border: selectedDrink === drink ? "3px solid #1e7a39" : "2px solid #ddd",
                                    borderRadius: "12px",
                                    cursor: "pointer",
                                    boxShadow: selectedDrink === drink ? "0 4px 12px rgba(0,0,0,0.2)" : "0 2px 6px rgba(0,0,0,0.1)",
                                }}
                            >
                                {drink}
                                <div style={{ fontSize: "0.9rem", marginTop: 6, opacity: 0.85 }}>
                                    M {sizes[0].price.toLocaleString()}원
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* 사이즈 선택 카드 */}
                {selectedDrink && (
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
                                color: "#8aa0c5",
                                fontWeight: 700,
                                boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
                            }}
                        >
                            음료 이미지 추가 영역
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
                            {sizes.map((size) => (
                                <button
                                    key={size.name}
                                    onClick={() => {
                                        setSelectedSize(size.name);
                                        setTimeout(() => handleNext(), 150); // 터치 즉시 진행
                                    }}
                                    style={{
                                        height: "70px",
                                        fontSize: "1.1rem",
                                        fontWeight: "bold",
                                        backgroundColor: selectedSize === size.name ? "#4a90e2" : "#f7f9fc",
                                        color: selectedSize === size.name ? "#fff" : "#333",
                                        border: selectedSize === size.name ? "2px solid #4a90e2" : "1px solid #d7dfef",
                                        borderRadius: "10px",
                                        cursor: "pointer",
                                        boxShadow: selectedSize === size.name ? "0 4px 12px rgba(0,0,0,0.12)" : "none",
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
            </div>
        </main>
    );
}

