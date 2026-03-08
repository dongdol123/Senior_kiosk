"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { speakKorean } from "../utils/speakKorean";

export default function MenuOptionPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [menuName, setMenuName] = useState("");
    const [menuPrice, setMenuPrice] = useState(0);
    const [menuId, setMenuId] = useState("");
    const [cartItems, setCartItems] = useState([]);
    const [isListening, setIsListening] = useState(false);
    const [assistantMessage, setAssistantMessage] = useState("");
    const [voiceLogs, setVoiceLogs] = useState([]);
    const recognitionRef = useRef(null);
    const mountedRef = useRef(true);
    const drinkSizeButtonRefs = useRef({});
    const singleButtonRef = useRef(null);
    const setButtonRef = useRef(null);
    const defaultSetButtonRef = useRef(null);
    const routerRef = useRef(router);
    const searchParamsRef = useRef(searchParams);
    const isSpeakingRef = useRef(false); // 음성 안내 재생 중인지 추적
    const shouldListenRef = useRef(true); // 자동 재시작 제어
    const restartingRef = useRef(false); // 재시작 중인지 추적

    // 최신 router와 searchParams 참조 유지
    useEffect(() => {
        routerRef.current = router;
        searchParamsRef.current = searchParams;
    }, [router, searchParams]);

    // 음료인지 확인하는 함수 (menuName이 변경될 때마다 재계산)
    const isDrink = useMemo(() => {
        const n = (menuName || "").replace(/\s+/g, "").toLowerCase();

        // 버거가 포함되어 있으면 무조건 음료가 아님
        if (n.includes("버거") || n.includes("burger")) {
            return false;
        }

        // 음료 키워드 확인 (정확하게 매칭)
        const drinkKeywords = ["콜라", "제로콜라", "사이다", "커피", "coke", "zero", "soda", "coffee"];

        // 음료 키워드와 정확히 일치하는지 확인
        const isDrinkMenu = drinkKeywords.some((k) => {
            const keywordLower = k.toLowerCase();
            // 정확히 일치하거나, 메뉴 이름이 키워드를 포함하는 경우
            return n === keywordLower || n.includes(keywordLower);
        });

        return isDrinkMenu;
    }, [menuName]);

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

    // 페이지 진입 시 즉시 음성 안내
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

        // 약간의 딜레이 후 음성 안내
        const timer = setTimeout(async () => {
            const currentMenuName = decodeURIComponent(searchParams.get("menuName") || menuName || "");
            const currentMenuNameNormalized = currentMenuName.replace(/\s+/g, "").toLowerCase();
            const isCurrentBurger = currentMenuNameNormalized.includes("버거") || currentMenuNameNormalized.includes("burger");
            const isCurrentDrink = !isCurrentBurger &&
                (["콜라", "제로콜라", "사이다", "커피", "coke", "zero", "soda", "coffee"].some(k =>
                    currentMenuNameNormalized === k.toLowerCase() || currentMenuNameNormalized.includes(k.toLowerCase())
                ));

            isSpeakingRef.current = true;
            if (isCurrentDrink) {
                const msg = "중간 사이즈 또는 큰 사이즈 중 어떤 걸 선택하시겠어요?";
                setAssistantMessage(msg);
                await speakKorean(msg).catch(err => console.error("음성 안내 오류:", err));
            } else {
                const msg = "단품, 세트, 기본 세트 중 하나를 말씀해주세요.";
                setAssistantMessage(msg);
                await speakKorean(msg).catch(err => console.error("음성 안내 오류:", err));
            }
            
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
        }, 300);

        return () => clearTimeout(timer);
    }, [searchParams, menuName]);

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

        recognition.onstart = async () => {
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
                const newLogs = [logEntry, ...prev].slice(0, 10); // 최근 10개만 유지
                return newLogs;
            });

            // 현재 menuName으로 다시 확인 (클로저 문제 방지)
            const currentMenuName = searchParams.get("menuName") || menuName || "";
            const currentMenuNameNormalized = currentMenuName.replace(/\s+/g, "").toLowerCase();

            // 버거인지 음료인지 확인
            const isCurrentBurger = currentMenuNameNormalized.includes("버거") || currentMenuNameNormalized.includes("burger");
            const isCurrentDrink = !isCurrentBurger &&
                (["콜라", "제로콜라", "사이다", "커피", "coke", "zero", "soda", "coffee"].some(k =>
                    currentMenuNameNormalized === k.toLowerCase() || currentMenuNameNormalized.includes(k.toLowerCase())
                ));

            // 음료인 경우 사이즈 음성 선택
            if (isCurrentDrink) {
                if (/미디움|미디엄|중간|중간사이즈/.test(normalized)) {
                    try {
                        recognition.stop();
                    } catch (e) { }
                    setAssistantMessage("중간 사이즈로 담을게요.");
                    isSpeakingRef.current = true;
                    speakKorean("중간 사이즈로 담을게요.").catch(err => console.error("음성 안내 오류:", err));
                    setTimeout(() => { isSpeakingRef.current = false; }, 2000);

                    // 즉시 함수 호출 (터치 버튼과 동일)
                    console.log("🚀 handleDrinkSize(미디움) 호출 시작");
                    setTimeout(() => {
                        handleDrinkSize("미디움");
                    }, 100);
                    return;
                }
                if (/라지|큰거|큰사이즈|큰/.test(normalized)) {
                    try {
                        recognition.stop();
                    } catch (e) { }
                    setAssistantMessage("큰 사이즈로 담을게요. 500원 추가됩니다.");
                    isSpeakingRef.current = true;
                    speakKorean("큰 사이즈로 담을게요. 500원 추가됩니다.").catch(err => console.error("음성 안내 오류:", err));
                    setTimeout(() => { isSpeakingRef.current = false; }, 2000);

                    // 즉시 함수 호출 (터치 버튼과 동일)
                    console.log("🚀 handleDrinkSize(라지) 호출 시작");
                    setTimeout(() => {
                        handleDrinkSize("라지");
                    }, 100);
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

            // 버거인 경우 단품/세트 선택
            if (isCurrentBurger) {
                console.log("🔍 음성인식 결과 (버거):", normalized, "isCurrentBurger:", isCurrentBurger);

                // 단품 선택 - 먼저 체크
                if (/단품|단품으로|단품주문/.test(normalized)) {
                    console.log("✅ 단품 인식됨! normalized:", normalized);
                    try {
                        recognition.stop();
                    } catch (e) { }
                    setAssistantMessage("단품을 선택하셨어요.");
                    isSpeakingRef.current = true;
                    speakKorean("단품을 선택하셨어요.").catch(err => console.error("음성 안내 오류:", err));
                    setTimeout(() => { isSpeakingRef.current = false; }, 2000);

                    // 즉시 함수 호출 (터치 버튼과 동일)
                    console.log("🚀 handleSingle() 호출 시작");
                    setTimeout(() => {
                        handleSingle();
                    }, 100);
                    return;
                }

                // 기본 세트 선택
                if (/기본|기본세트|기본적용/.test(normalized)) {
                    console.log("✅ 기본세트 인식됨! normalized:", normalized);
                    try {
                        recognition.stop();
                    } catch (e) { }
                    setAssistantMessage("기본 세트를 선택하셨어요.");
                    isSpeakingRef.current = true;
                    speakKorean("기본 세트를 선택하셨어요.").catch(err => console.error("음성 안내 오류:", err));
                    setTimeout(() => { isSpeakingRef.current = false; }, 2000);

                    // 즉시 함수 호출 (터치 버튼과 동일)
                    console.log("🚀 handleDefaultSet() 호출 시작");
                    setTimeout(() => {
                        handleDefaultSet();
                    }, 100);
                    return;
                }

                // 세트 선택
                if (/세트|세트로|세트주문/.test(normalized)) {
                    try {
                        recognition.stop();
                    } catch (e) { }
                    handleSet();
                    return;
                }

                // AI 도움말 (버거인 경우)
                const msg = "단품, 세트, 기본 세트 중 하나를 말씀해주세요.";
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
            } else if (isCurrentDrink) {
                // 음료인 경우 사이즈 선택 안내만
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
    }, [isDrink, menuName]);

    function handleDrinkSize(size) {
        // searchParams에서 직접 읽기
        const currentMenuId = searchParams.get("menuId") || menuId;
        const currentMenuName = decodeURIComponent(searchParams.get("menuName") || menuName || "");
        const currentMenuPrice = parseInt(searchParams.get("price") || menuPrice || "0");
        const price = currentMenuPrice + (size === "라지" ? 500 : 0);

        // searchParams에서 cart 직접 읽기
        let currentCartItems = [];
        const cartParam = searchParams.get("cart");
        if (cartParam) {
            try {
                currentCartItems = JSON.parse(decodeURIComponent(cartParam));
            } catch (e) {
                console.error("Failed to parse cart:", e);
                currentCartItems = [...cartItems]; // fallback
            }
        } else {
            currentCartItems = [...cartItems];
        }

        const id = `${currentMenuId}_${size}`;
        const idx = currentCartItems.findIndex((p) => p.id === id);
        if (idx >= 0) {
            currentCartItems[idx] = { ...currentCartItems[idx], qty: currentCartItems[idx].qty + 1 };
        } else {
            // 사이즈에 맞게 이름 표시 (미디움 -> 중간, 라지 -> 큰)
            const sizeDisplayName = size === "미디움" ? "중간" : "큰";
            currentCartItems.push({ id, name: `${currentMenuName} (${sizeDisplayName})`, price, qty: 1, type: "drink", size });
        }

        const cartData = encodeURIComponent(JSON.stringify(currentCartItems));
        const orderType = searchParams.get("orderType") || "takeout";
        console.log("handleDrinkSize - cartData:", cartData, "size:", size);
        // 바로 메뉴 페이지로 이동
        router.push(`/menu?entry=voice&orderType=${orderType}&cart=${cartData}`);
    }

    // 단품 추가 함수 (새로 작성)
    const addSingleToCart = useCallback(() => {
        const currentSearchParams = searchParamsRef.current;
        const currentRouter = routerRef.current;

        const currentMenuId = currentSearchParams.get("menuId");
        const currentMenuName = decodeURIComponent(currentSearchParams.get("menuName") || "");
        const currentMenuPrice = parseInt(currentSearchParams.get("price") || "0");
        const orderType = currentSearchParams.get("orderType") || "takeout";

        if (!currentMenuId) {
            console.error("단품 추가 실패: menuId가 없습니다.");
            return;
        }

        // searchParams에서 cart 읽기
        let currentCartItems = [];
        const cartParam = currentSearchParams.get("cart");
        if (cartParam) {
            try {
                currentCartItems = JSON.parse(decodeURIComponent(cartParam));
            } catch (e) {
                console.error("Failed to parse cart:", e);
                currentCartItems = [];
            }
        }

        // 장바구니에 단품 추가
        const idx = currentCartItems.findIndex((p) => p.id === currentMenuId);
        if (idx >= 0) {
            currentCartItems[idx] = { ...currentCartItems[idx], qty: currentCartItems[idx].qty + 1 };
        } else {
            currentCartItems.push({
                id: currentMenuId,
                name: currentMenuName,
                price: currentMenuPrice,
                qty: 1,
                type: "single"
            });
        }

        const cartData = encodeURIComponent(JSON.stringify(currentCartItems));
        console.log("단품 추가 완료:", { currentMenuId, currentMenuName, currentCartItems });
        currentRouter.push(`/menu?entry=voice&orderType=${orderType}&cart=${cartData}`);
    }, []);

    function handleSingle() {
        console.log("📞 handleSingle() 호출됨");
        console.log("📋 현재 searchParams:", {
            menuId: searchParams.get("menuId"),
            menuName: searchParams.get("menuName"),
            price: searchParams.get("price"),
            cart: searchParams.get("cart")
        });
        addSingleToCart();
    }

    function handleSet() {
        // 세트 선택 시 음료 선택 페이지로
        const cartData = encodeURIComponent(JSON.stringify(cartItems));
        const orderType = searchParams.get("orderType") || "takeout";
        router.push(`/drink-select?menuId=${menuId}&menuName=${encodeURIComponent(menuName)}&price=${menuPrice}&cart=${cartData}&orderType=${orderType}`);
    }

    // 기본세트 추가 함수 (새로 작성)
    const addDefaultSetToCart = useCallback(() => {
        const currentSearchParams = searchParamsRef.current;
        const currentRouter = routerRef.current;

        const currentMenuId = currentSearchParams.get("menuId");
        const currentMenuName = decodeURIComponent(currentSearchParams.get("menuName") || "");
        const currentMenuPrice = parseInt(currentSearchParams.get("price") || "0");
        const orderType = currentSearchParams.get("orderType") || "takeout";

        if (!currentMenuId) {
            console.error("기본세트 추가 실패: menuId가 없습니다.");
            return;
        }

        // searchParams에서 cart 읽기
        let currentCartItems = [];
        const cartParam = currentSearchParams.get("cart");
        if (cartParam) {
            try {
                currentCartItems = JSON.parse(decodeURIComponent(cartParam));
            } catch (e) {
                console.error("Failed to parse cart:", e);
                currentCartItems = [];
            }
        }

        // 기본세트 가격 계산 (메뉴 + 콜라 M + 감자튀김 M)
        const setPrice = currentMenuPrice + 2000 + 3000;

        // 장바구니에 기본세트 추가
        const setId = `${currentMenuId}_set_default`;
        const idx = currentCartItems.findIndex((p) => p.id === setId);
        if (idx >= 0) {
            currentCartItems[idx] = { ...currentCartItems[idx], qty: currentCartItems[idx].qty + 1 };
        } else {
            currentCartItems.push({
                id: setId,
                name: `${currentMenuName} 세트`,
                price: setPrice,
                qty: 1,
                type: "set",
                items: [
                    { name: currentMenuName, price: currentMenuPrice },
                    { name: "콜라", size: "미디움", price: 2000 },
                    { name: "감자튀김", size: "미디움", price: 3000 },
                ],
            });
        }

        const cartData = encodeURIComponent(JSON.stringify(currentCartItems));
        console.log("기본세트 추가 완료:", { currentMenuId, currentMenuName, currentCartItems });
        currentRouter.push(`/menu?entry=voice&orderType=${orderType}&cart=${cartData}`);
    }, []);

    function handleDefaultSet() {
        console.log("📞 handleDefaultSet() 호출됨");
        console.log("📋 현재 searchParams:", {
            menuId: searchParams.get("menuId"),
            menuName: searchParams.get("menuName"),
            price: searchParams.get("price"),
            cart: searchParams.get("cart")
        });
        addDefaultSetToCart();
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
            {/* 음성 인식 로그창 */}
            {voiceLogs.length > 0 && (
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
                </div>
            )}

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
                    onClick={() => {
                        const cartData = encodeURIComponent(JSON.stringify(cartItems));
                        const orderType = searchParams.get("orderType") || "takeout";
                        router.push(`/menu?entry=voice&orderType=${orderType}&cart=${cartData}`);
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
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "40px 20px",
                    gap: "30px",
                }}
            >
                {!isDrink ? (
                    <>
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
                                ref={singleButtonRef}
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
                                ref={setButtonRef}
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
                            ref={defaultSetButtonRef}
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
                            기본 세트 적용 (콜라 M / 감자튀김 M)
                            <div style={{ fontSize: "1rem", marginTop: "4px", opacity: 0.9 }}>
                                {(menuPrice + 2000 + 3000).toLocaleString()}원
                            </div>
                        </button>
                    </>
                ) : (
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "1.2fr 1fr",
                            gap: "16px",
                            width: "100%",
                            maxWidth: "720px",
                        }}
                    >
                        <div
                            style={{
                                background: "#fff",
                                border: "1px solid #e5e5e5",
                                borderRadius: 14,
                                padding: 16,
                                minHeight: 200,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
                                overflow: "hidden",
                            }}
                        >
                            {(() => {
                                const n = (menuName || "").replace(/\s+/g, "").toLowerCase();
                                const isCola = ["콜라", "제로콜라", "coke", "zero"].some((k) => n.includes(k));
                                const isCider = ["사이다", "soda"].some((k) => n.includes(k));
                                const isCoffee = ["커피", "coffee"].some((k) => n.includes(k));
                                return isCola ? (
                                    <img
                                        src="/coke_size.png"
                                        alt="사이즈 선택"
                                        style={{
                                            width: "100%",
                                            height: "100%",
                                            objectFit: "contain",
                                            display: "block",
                                        }}
                                    />
                                ) : isCider ? (
                                    <img
                                        src="/cider_size.png"
                                        alt="사이즈 선택"
                                        style={{
                                            width: "100%",
                                            height: "100%",
                                            objectFit: "contain",
                                            display: "block",
                                        }}
                                    />
                                ) : isCoffee ? (
                                    <img
                                        src="/coffee_size.png"
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
                                );
                            })()}
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
                                {menuName} 사이즈를 선택하세요
                            </div>
                            {["미디움", "라지"].map((size) => (
                                <button
                                    key={size}
                                    ref={(el) => {
                                        if (el) drinkSizeButtonRefs.current[size] = el;
                                    }}
                                    onClick={() => handleDrinkSize(size)}
                                    style={{
                                        height: "70px",
                                        fontSize: "1.1rem",
                                        fontWeight: "bold",
                                        backgroundColor: "#f7f9fc",
                                        color: "#333",
                                        border: "1px solid #d7dfef",
                                        borderRadius: "10px",
                                        cursor: "pointer",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        padding: "0 14px",
                                    }}
                                >
                                    <div>
                                        <div style={{ fontSize: "1rem", fontWeight: 700, lineHeight: 1.2 }}>
                                            {size === "미디움" ? "중간 사이즈로 주문하기" : "큰 사이즈로 주문하기 (+500원)"}
                                        </div>
                                        <div style={{ fontSize: "0.85rem", opacity: 0.9 }}>
                                            {size === "라지" ? `+500원 (총 ${(menuPrice + 500).toLocaleString()}원)` : `${menuPrice.toLocaleString()}원`}
                                        </div>
                                    </div>
                                    <span style={{ fontWeight: 800, fontSize: "1rem" }}>
                                        {size === "라지" ? "+500원" : "M"}
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

