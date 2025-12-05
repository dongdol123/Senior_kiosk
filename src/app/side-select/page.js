"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useRef } from "react";

export default function SideSelectPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [menuName, setMenuName] = useState("");
    const [menuPrice, setMenuPrice] = useState(0);
    const [menuId, setMenuId] = useState("");
    const [drink, setDrink] = useState("");
    const [drinkSize, setDrinkSize] = useState("");
    const [drinkPrice, setDrinkPrice] = useState(0);
    const [selectedSide, setSelectedSide] = useState("");
    const [selectedSideSize, setSelectedSideSize] = useState("");
    const [cartItems, setCartItems] = useState([]);
    const [isListening, setIsListening] = useState(false);
    const [assistantMessage, setAssistantMessage] = useState("");
    const recognitionRef = useRef(null);
    const mountedRef = useRef(true);

    const sides = ["감자튀김", "치킨텐더", "샐러드"];
    const sideSizes = [
        { name: "미디움", price: 3000 },
        { name: "라지", price: 4000 },
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
        setDrink(decodeURIComponent(searchParams.get("drink") || ""));
        setDrinkSize(decodeURIComponent(searchParams.get("drinkSize") || ""));
        setDrinkPrice(parseInt(searchParams.get("drinkPrice") || "0"));
        
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

            // 사이드 선택
            if (!selectedSide) {
                if (/감자|감자튀김|프라이/.test(normalized)) {
                    setSelectedSide("감자튀김");
                    const msg = "감자튀김을 선택하셨어요. 사이즈를 선택해주세요.";
                    setAssistantMessage(msg);
                    await speakKorean(msg);
                    return;
                }
                if (/치킨|치킨텐더|텐더/.test(normalized)) {
                    setSelectedSide("치킨텐더");
                    const msg = "치킨텐더를 선택하셨어요. 사이즈를 선택해주세요.";
                    setAssistantMessage(msg);
                    await speakKorean(msg);
                    return;
                }
                if (/샐러드/.test(normalized)) {
                    setSelectedSide("샐러드");
                    const msg = "샐러드를 선택하셨어요. 사이즈를 선택해주세요.";
                    setAssistantMessage(msg);
                    await speakKorean(msg);
                    return;
                }
            }

            // 사이즈 선택
            if (selectedSide && !selectedSideSize) {
                if (/미디움|미디엄|중간/.test(normalized)) {
                    setSelectedSideSize("미디움");
                    const msg = "미디움 사이즈를 선택하셨어요.";
                    setAssistantMessage(msg);
                    await speakKorean(msg);
                    setTimeout(() => handleComplete(), 1500);
                    return;
                }
                if (/라지|큰거|큰사이즈/.test(normalized)) {
                    setSelectedSideSize("라지");
                    const msg = "라지 사이즈를 선택하셨어요.";
                    setAssistantMessage(msg);
                    await speakKorean(msg);
                    setTimeout(() => handleComplete(), 1500);
                    return;
                }
            }

            const msg = selectedSide ? "미디움 또는 라지 사이즈를 말씀해주세요." : "감자튀김, 치킨텐더, 샐러드 중 하나를 말씀해주세요.";
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
    }, [selectedSide, selectedSideSize]);

    function handleComplete() {
        if (!selectedSide || !selectedSideSize) {
            alert("사이드를 선택해주세요.");
            return;
        }

        const selectedSideSizeObj = sideSizes.find(s => s.name === selectedSideSize);
        const totalPrice = menuPrice + drinkPrice + selectedSideSizeObj.price;

        // 장바구니에 세트 추가
        const newCartItems = [...cartItems];
        const idx = newCartItems.findIndex((p) => p.id === `${menuId}_set_${Date.now()}`);
        
        newCartItems.push({
            id: `${menuId}_set_${Date.now()}`,
            name: `${menuName} 세트`,
            price: totalPrice,
            qty: 1,
            type: "set",
            items: [
                { name: menuName, price: menuPrice },
                { name: drink, size: drinkSize, price: drinkPrice },
                { name: selectedSide, size: selectedSideSize, price: selectedSideSizeObj.price },
            ],
        });

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
                    <h2 style={{ fontSize: "1.5rem", fontWeight: "bold" }}>사이드 선택</h2>
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

            {/* 선택된 정보 표시 */}
            <div
                style={{
                    padding: "16px",
                    backgroundColor: "#fff",
                    borderBottom: "1px solid #e5e5e5",
                }}
            >
                <div style={{ fontSize: "0.9rem", color: "#666" }}>
                    {menuName} + {drink} ({drinkSize}) + 사이드 선택 중
                </div>
            </div>

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
                {/* 사이드 선택 */}
                <div>
                    <h3 style={{ fontSize: "1.3rem", fontWeight: "bold", marginBottom: "20px" }}>
                        사이드를 선택하세요
                    </h3>
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(3, 1fr)",
                            gap: "16px",
                        }}
                    >
                        {sides.map((side) => (
                            <button
                                key={side}
                                onClick={() => setSelectedSide(side)}
                                style={{
                                    height: "100px",
                                    fontSize: "1.3rem",
                                    fontWeight: "bold",
                                    backgroundColor: selectedSide === side ? "#1e7a39" : "#fff",
                                    color: selectedSide === side ? "#fff" : "#333",
                                    border: selectedSide === side ? "3px solid #1e7a39" : "2px solid #ddd",
                                    borderRadius: "12px",
                                    cursor: "pointer",
                                    boxShadow: selectedSide === side ? "0 4px 12px rgba(0,0,0,0.2)" : "0 2px 6px rgba(0,0,0,0.1)",
                                }}
                            >
                                {side}
                            </button>
                        ))}
                    </div>
                </div>

                {/* 사이즈 선택 */}
                {selectedSide && (
                    <div>
                        <h3 style={{ fontSize: "1.3rem", fontWeight: "bold", marginBottom: "20px" }}>
                            사이즈를 선택하세요
                        </h3>
                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(2, 1fr)",
                                gap: "16px",
                            }}
                        >
                            {sideSizes.map((size) => (
                                <button
                                    key={size.name}
                                    onClick={() => setSelectedSideSize(size.name)}
                                    style={{
                                        height: "100px",
                                        fontSize: "1.3rem",
                                        fontWeight: "bold",
                                        backgroundColor: selectedSideSize === size.name ? "#4a90e2" : "#fff",
                                        color: selectedSideSize === size.name ? "#fff" : "#333",
                                        border: selectedSideSize === size.name ? "3px solid #4a90e2" : "2px solid #ddd",
                                        borderRadius: "12px",
                                        cursor: "pointer",
                                        boxShadow: selectedSideSize === size.name ? "0 4px 12px rgba(0,0,0,0.2)" : "0 2px 6px rgba(0,0,0,0.1)",
                                    }}
                                >
                                    {size.name}
                                    <div style={{ fontSize: "1rem", marginTop: "4px", opacity: 0.9 }}>
                                        {size.price.toLocaleString()}원
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* 총액 표시 */}
                {selectedSide && selectedSideSize && (
                    <div
                        style={{
                            padding: "20px",
                            backgroundColor: "#fff",
                            borderRadius: "12px",
                            border: "2px solid #1e7a39",
                        }}
                    >
                        <div style={{ fontSize: "1.1rem", marginBottom: "8px" }}>주문 내역</div>
                        <div style={{ fontSize: "0.9rem", color: "#666", marginBottom: "4px" }}>
                            {menuName}: {menuPrice.toLocaleString()}원
                        </div>
                        <div style={{ fontSize: "0.9rem", color: "#666", marginBottom: "4px" }}>
                            {drink} ({drinkSize}): {drinkPrice.toLocaleString()}원
                        </div>
                        <div style={{ fontSize: "0.9rem", color: "#666", marginBottom: "12px" }}>
                            {selectedSide} ({selectedSideSize}): {sideSizes.find(s => s.name === selectedSideSize).price.toLocaleString()}원
                        </div>
                        <div
                            style={{
                                fontSize: "1.5rem",
                                fontWeight: "bold",
                                color: "#1e7a39",
                                borderTop: "2px solid #e5e5e5",
                                paddingTop: "12px",
                            }}
                        >
                            총액: {(menuPrice + drinkPrice + sideSizes.find(s => s.name === selectedSideSize).price).toLocaleString()}원
                        </div>
                    </div>
                )}

                {/* 완료 버튼 */}
                {selectedSide && selectedSideSize && (
                    <button
                        onClick={handleComplete}
                        style={{
                            width: "100%",
                            height: "80px",
                            fontSize: "1.8rem",
                            fontWeight: "bold",
                            backgroundColor: "#1e7a39",
                            color: "#fff",
                            border: "none",
                            borderRadius: "16px",
                            cursor: "pointer",
                            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                            marginTop: "auto",
                        }}
                    >
                        장바구니에 담기
                    </button>
                )}
            </div>
        </main>
    );
}

