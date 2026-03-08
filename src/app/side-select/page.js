"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { speakKorean } from "../utils/speakKorean";

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
    const [voiceLogs, setVoiceLogs] = useState([]);
    const recognitionRef = useRef(null);
    const mountedRef = useRef(true);
    const isSpeakingRef = useRef(false); // 음성 안내 재생 중인지 추적
    const shouldListenRef = useRef(true); // 자동 재시작 제어
    const restartingRef = useRef(false); // 재시작 중인지 추적

    const sides = ["감자튀김", "치킨텐더", "샐러드"];
    const sideSizes = [
        { name: "미디움", price: 3000 },
        { name: "라지", price: 4000 },
    ];

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

    // 페이지 진입 시 1초 후 음성 안내
    useEffect(() => {
        // 이전 음성 안내 정리
        if (typeof window !== "undefined") {
            try {
                if (window.speechSynthesis) {
                    window.speechSynthesis.cancel();
                }
            } catch (e) {
                console.log("SpeechSynthesis 정리 중 오류:", e);
            }
        }

        // 음성 인식 중지
        if (recognitionRef.current) {
            try {
                recognitionRef.current.stop();
            } catch (e) {}
        }
        shouldListenRef.current = false; // 자동 재시작 방지

        // 1초 후 음성 안내
        const timer = setTimeout(async () => {
            isSpeakingRef.current = true;
            const msg = "사이드를 선택해주세요.";
            setAssistantMessage(msg);
            await speakKorean(msg).catch(err => console.error("음성 안내 오류:", err));
            
            // 음성 안내가 완료된 후 충분한 딜레이를 두고 플래그 해제 및 음성 인식 재시작
            setTimeout(() => {
                isSpeakingRef.current = false; // 플래그 해제
                shouldListenRef.current = true; // 자동 재시작 허용
                if (mountedRef.current) {
                    setTimeout(() => {
                        if (recognitionRef.current && mountedRef.current && shouldListenRef.current) {
                            try {
                                recognitionRef.current.start();
                            } catch (e) {
                                console.log("음성 인식 재시작 오류:", e);
                            }
                        }
                    }, 2000); // 추가 딜레이 (2초)
                }
            }, 1000); // 안내 완료 후 1초 대기
        }, 1000);

        return () => clearTimeout(timer);
    }, [searchParams]);

    // 사이드와 사이즈가 모두 선택되면 자동으로 주문 완료
    useEffect(() => {
        if (selectedSide && selectedSideSize) {
            const timer = setTimeout(() => {
                const selectedSideSizeObj = sideSizes.find(s => s.name === selectedSideSize);
                const totalPrice = menuPrice + drinkPrice + selectedSideSizeObj.price;
                const newCartItems = [...cartItems];
                // menuName이 있으면 사용하고, 없으면 items의 첫 번째 항목 이름 사용
                const items = [
                    { name: menuName, price: menuPrice },
                    { name: drink, size: drinkSize, price: drinkPrice },
                    { name: selectedSide, size: selectedSideSize, price: selectedSideSizeObj.price },
                ];
                const setName = menuName && menuName.trim() ? `${menuName} 세트` : (items[0]?.name ? `${items[0].name} 세트` : `세트`);
                newCartItems.push({
                    id: `${menuId}_set_${Date.now()}`,
                    name: setName,
                    price: totalPrice,
                    qty: 1,
                    type: "set",
                    items: items,
                });
                const cartData = encodeURIComponent(JSON.stringify(newCartItems));
                const orderType = searchParams.get("orderType") || "takeout";
                router.push(`/menu?entry=voice&orderType=${orderType}&cart=${cartData}`);
            }, 800);
            return () => clearTimeout(timer);
        }
    }, [selectedSide, selectedSideSize, menuName, menuPrice, drinkPrice, drink, drinkSize, menuId, cartItems, searchParams, router]);

    // 음성 인식
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
            // 자동 재시작 (키오스크 시스템이므로 지속적으로 작동해야 함)
            // 음성 안내 재생 중이어도 일정 시간 후 재시작 시도
            if (mountedRef.current && shouldListenRef.current && !restartingRef.current) {
                restartingRef.current = true;
                const delay = isSpeakingRef.current ? 2000 : 500; // 음성 안내 중이면 더 긴 딜레이
                setTimeout(() => {
                    if (!mountedRef.current || !shouldListenRef.current) {
                        restartingRef.current = false;
                        return;
                    }
                    // isSpeakingRef가 여전히 true면 더 기다림
                    if (isSpeakingRef.current) {
                        restartingRef.current = false;
                        // 다시 시도
                        setTimeout(() => {
                            if (mountedRef.current && shouldListenRef.current && !restartingRef.current) {
                                restartingRef.current = true;
                                try { 
                                    recognition.start(); 
                                    restartingRef.current = false;
                                } catch (e) {
                                    restartingRef.current = false;
                                    // 재시작 실패 시 다시 시도
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
                        // 재시작 실패 시 다시 시도
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
            // 에러 발생 시에도 재시작 시도 (키오스크 시스템이므로 지속적으로 작동해야 함)
            if (mountedRef.current && shouldListenRef.current && !restartingRef.current) {
                restartingRef.current = true;
                setTimeout(() => {
                    if (!mountedRef.current || !shouldListenRef.current) {
                        restartingRef.current = false;
                        return;
                    }
                    // isSpeakingRef가 true면 더 기다림
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
                        // 재시작 실패 시 다시 시도
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
            // 음성 안내 재생 중이면 음성 인식 결과를 무시
            if (isSpeakingRef.current) {
                console.log("🔇 음성 안내 재생 중이므로 음성 인식 결과 무시:", event.results[0][0].transcript);
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

            // 사이드 선택
            if (!selectedSide) {
                if (/감자|감자튀김|프라이/.test(normalized)) {
                    try {
                        recognition.stop();
                    } catch (e) {}
                    setSelectedSide("감자튀김");
                    const msg = "중간 사이즈 또는 큰 사이즈 중 어떤 걸 선택하시겠어요?";
                    setAssistantMessage(msg);
                    isSpeakingRef.current = true;
                    await speakKorean(msg);
                    setTimeout(() => { 
                        isSpeakingRef.current = false;
                        if (mountedRef.current && shouldListenRef.current) {
                            setTimeout(() => {
                                if (recognitionRef.current && mountedRef.current && shouldListenRef.current) {
                                    try {
                                        recognitionRef.current.start();
                                    } catch (e) {}
                                }
                            }, 2000);
                        }
                    }, 1000);
                    return;
                }
                if (/치킨|치킨텐더|텐더/.test(normalized)) {
                    setSelectedSide("치킨텐더");
                    // 치킨텐더는 사이즈 선택 없이 바로 장바구니에 담기
                    const newCartItems = [...cartItems];
                    const selectedSideSizeObj = sideSizes.find(s => s.name === "미디움");
                    const totalPrice = menuPrice + drinkPrice + selectedSideSizeObj.price;
                    newCartItems.push({
                        id: `${menuId}_set_${Date.now()}`,
                        name: menuName ? `${menuName} 세트` : `세트`,
                        price: totalPrice,
                        qty: 1,
                        type: "set",
                        items: [
                            { name: menuName, price: menuPrice },
                            { name: drink, size: drinkSize, price: drinkPrice },
                            { name: "치킨텐더", size: "미디움", price: selectedSideSizeObj.price },
                        ],
                    });
                    const cartData = encodeURIComponent(JSON.stringify(newCartItems));
                    const orderType = searchParams.get("orderType") || "takeout";
                    const msg = "치킨텐더를 장바구니에 담았어요.";
                    setAssistantMessage(msg);
                    try {
                        recognition.stop();
                    } catch (e) {}
                    isSpeakingRef.current = true;
                    await speakKorean(msg);
                    setTimeout(() => { isSpeakingRef.current = false; }, 2000);
                    setTimeout(() => {
                        router.push(`/menu?entry=voice&orderType=${orderType}&cart=${cartData}`);
                    }, 1000);
                    return;
                }
                if (/샐러드/.test(normalized)) {
                    setSelectedSide("샐러드");
                    // 샐러드는 사이즈 선택 없이 바로 장바구니에 담기
                    const newCartItems = [...cartItems];
                    const selectedSideSizeObj = sideSizes.find(s => s.name === "미디움");
                    const totalPrice = menuPrice + drinkPrice + selectedSideSizeObj.price;
                    newCartItems.push({
                        id: `${menuId}_set_${Date.now()}`,
                        name: menuName ? `${menuName} 세트` : `세트`,
                        price: totalPrice,
                        qty: 1,
                        type: "set",
                        items: [
                            { name: menuName, price: menuPrice },
                            { name: drink, size: drinkSize, price: drinkPrice },
                            { name: "샐러드", size: "미디움", price: selectedSideSizeObj.price },
                        ],
                    });
                    const cartData = encodeURIComponent(JSON.stringify(newCartItems));
                    const orderType = searchParams.get("orderType") || "takeout";
                    const msg = "샐러드를 장바구니에 담았어요.";
                    setAssistantMessage(msg);
                    try {
                        recognition.stop();
                    } catch (e) {}
                    isSpeakingRef.current = true;
                    await speakKorean(msg);
                    setTimeout(() => { isSpeakingRef.current = false; }, 2000);
                    setTimeout(() => {
                        router.push(`/menu?entry=voice&orderType=${orderType}&cart=${cartData}`);
                    }, 1000);
                    return;
                }
            }

            // 사이즈 선택 (감자튀김만)
            if (selectedSide === "감자튀김" && !selectedSideSize) {
                if (/미디움|미디엄|중간/.test(normalized)) {
                    setSelectedSideSize("미디움");
                    return;
                }
                if (/라지|큰거|큰사이즈|큰/.test(normalized)) {
                    setSelectedSideSize("라지");
                    return;
                }
                const msg = "중간 사이즈 또는 큰 사이즈 중 어떤 걸 선택하시겠어요?";
                setAssistantMessage(msg);
                try {
                    recognition.stop();
                } catch (e) {}
                isSpeakingRef.current = true;
                await speakKorean(msg);
                setTimeout(() => { 
                    isSpeakingRef.current = false;
                    if (mountedRef.current && shouldListenRef.current) {
                        setTimeout(() => {
                            if (recognitionRef.current && mountedRef.current && shouldListenRef.current) {
                                try {
                                    recognitionRef.current.start();
                                } catch (e) {}
                            }
                        }, 2000);
                    }
                }, 1000);
                return;
            }

            const msg = selectedSide === "감자튀김" && !selectedSideSize 
                ? "중간 사이즈 또는 큰 사이즈 중 어떤 걸 선택하시겠어요?" 
                : "감자튀김, 치킨텐더, 샐러드 중 하나를 말씀해주세요.";
            setAssistantMessage(msg);
            try {
                recognition.stop();
            } catch (e) {}
            isSpeakingRef.current = true;
            await speakKorean(msg);
            setTimeout(() => { 
                isSpeakingRef.current = false;
                if (mountedRef.current && shouldListenRef.current) {
                    setTimeout(() => {
                        if (recognitionRef.current && mountedRef.current && shouldListenRef.current) {
                            try {
                                recognitionRef.current.start();
                            } catch (e) {}
                        }
                    }, 2000);
                }
            }, 1000);
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
        
        // menuName이 있으면 사용하고, 없으면 items의 첫 번째 항목 이름 사용
        const items = [
            { name: menuName, price: menuPrice },
            { name: drink, size: drinkSize, price: drinkPrice },
            { name: selectedSide, size: selectedSideSize, price: selectedSideSizeObj.price },
        ];
        const setName = menuName && menuName.trim() ? `${menuName} 세트` : (items[0]?.name ? `${items[0].name} 세트` : `세트`);
        newCartItems.push({
            id: `${menuId}_set_${Date.now()}`,
            name: setName,
            price: totalPrice,
            qty: 1,
            type: "set",
            items: items,
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
                    onClick={() => {
                        const cartData = encodeURIComponent(JSON.stringify(cartItems));
                        const orderType = searchParams.get("orderType") || "takeout";
                        router.push(
                            `/drink-select?menuId=${menuId}&menuName=${encodeURIComponent(menuName)}&price=${menuPrice}` +
                            `&cart=${cartData}&orderType=${orderType}`
                        );
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

            </div>

            {/* 이전/다음 버튼 - 하단 고정 */}
            <div
                style={{
                    position: "fixed",
                    bottom: "20px",
                    left: "50%",
                    transform: "translateX(-50%)",
                    display: "flex",
                    gap: "20px",
                    zIndex: 100,
                }}
            >
                <button
                    onClick={() => {
                        const cartData = encodeURIComponent(JSON.stringify(cartItems));
                        const orderType = searchParams.get("orderType") || "takeout";
                        router.push(
                            `/drink-select?menuId=${menuId}&menuName=${encodeURIComponent(menuName)}&price=${menuPrice}` +
                            `&cart=${cartData}&orderType=${orderType}`
                        );
                    }}
                    style={{
                        padding: "16px 32px",
                        fontSize: "1.3rem",
                        fontWeight: "bold",
                        backgroundColor: "#fff",
                        color: "#333",
                        border: "2px solid #ddd",
                        borderRadius: "12px",
                        cursor: "pointer",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                    }}
                >
                    이전
                </button>
                {selectedSide && selectedSideSize && (
                    <button
                        onClick={handleComplete}
                        style={{
                            padding: "16px 32px",
                            fontSize: "1.3rem",
                            fontWeight: "bold",
                            backgroundColor: "#1e7a39",
                            color: "#fff",
                            border: "none",
                            borderRadius: "12px",
                            cursor: "pointer",
                            boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
                        }}
                    >
                        다음
                    </button>
                )}
            </div>
        </main>
    );
}

