"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, useEffect, useRef, useMemo, useCallback } from "react";
import { isTtsActive, speakKorean } from "../utils/speakKorean";
import { registerVoiceSession, stopVoiceSession } from "../utils/voiceSession";
import KioskAspectFrame from "../../components/KioskAspectFrame";
import { getOrderFlowEntry, entryQuery } from "../utils/orderFlowEntry";

function getMenuImageSrc(menuId) {
    switch ((menuId || "").toLowerCase()) {
        case "bur-bacon":
            return "/tomato_bur.png";
        case "bur-mozza":
            return "/mozza_bulbur.png";
        case "bur-triple":
            return "/triple_bur.png";
        case "bur-mush":
            return "/merss.png";
        default:
            return "/burger.png";
    }
}

function MenuOptionPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const entry = getOrderFlowEntry(searchParams);
    const [menuName, setMenuName] = useState("");
    const [menuPrice, setMenuPrice] = useState(0);
    const [menuId, setMenuId] = useState("");
    const [cartItems, setCartItems] = useState([]);
    const [isListening, setIsListening] = useState(false);
    const [assistantMessage, setAssistantMessage] = useState("");
    const [isBackButtonActive, setIsBackButtonActive] = useState(false);
    const [activeOptionButton, setActiveOptionButton] = useState("");
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
    const lastHandledVoiceRef = useRef({ text: "", at: 0 });

    function navigateTo(path) {
        stopVoiceSession(recognitionRef.current, shouldListenRef, isSpeakingRef);
        router.push(path);
    }

    const handleBack = () => {
        setIsBackButtonActive(true);
        setTimeout(() => {
            const cartData = encodeURIComponent(JSON.stringify(cartItems));
            const orderType = searchParams.get("orderType") || "takeout";
            navigateTo(`/menu?${entryQuery(entry)}&orderType=${orderType}&cart=${cartData}`);
        }, 120);
    };

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
        const drinkKeywords = [
            "카페라떼",
            "라떼",
            "아이스티",
            "콜라",
            "제로콜라",
            "사이다",
            "커피",
            "latte",
            "icetea",
            "coke",
            "zero",
            "soda",
            "coffee",
        ];

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

    // 페이지 진입 직후 음성 안내 → 안내 종료 후 1초 뒤 음성 인식 시작 (인식은 이 타이밍까지 시작하지 않음)
    useEffect(() => {
        let cancelled = false;

        if (typeof window !== "undefined") {
            try {
                if (window.speechSynthesis) {
                    window.speechSynthesis.cancel();
                }
            } catch (e) {
                console.log("SpeechSynthesis 정리 중 오류:", e);
            }
        }

        if (recognitionRef.current) {
            try {
                recognitionRef.current.stop();
            } catch (e) { }
        }
        shouldListenRef.current = false;
        isSpeakingRef.current = true;

        const runIntro = async () => {
            const currentMenuName = decodeURIComponent(searchParams.get("menuName") || menuName || "");
            const currentMenuNameNormalized = currentMenuName.replace(/\s+/g, "").toLowerCase();
            const isCurrentBurger = currentMenuNameNormalized.includes("버거") || currentMenuNameNormalized.includes("burger");
            const isCurrentDrink = !isCurrentBurger &&
                (["카페라떼", "라떼", "아이스티", "콜라", "제로콜라", "사이다", "커피", "latte", "icetea", "coke", "zero", "soda", "coffee"].some(k =>
                    currentMenuNameNormalized === k.toLowerCase() || currentMenuNameNormalized.includes(k.toLowerCase())
                ));

            const msg = isCurrentDrink
                ? "중간 사이즈 또는 큰 사이즈 중 어떤 걸 선택하시겠어요?"
                : "단품, 기본 세트, 세트 직접 선택 중 선택해 주세요.";
            if (!cancelled) {
                setAssistantMessage(msg);
            }
            await speakKorean(msg).catch((err) => console.error("음성 안내 오류:", err));
            if (cancelled || !mountedRef.current) return;

            // 안내가 끝난 뒤 1초 대기 후에만 음성 인식 시작
            setTimeout(() => {
                if (cancelled || !mountedRef.current) return;
                isSpeakingRef.current = false;
                shouldListenRef.current = true;
                if (recognitionRef.current && shouldListenRef.current) {
                    try {
                        recognitionRef.current.start();
                    } catch (e) {
                        console.log("음성 인식 시작 오류:", e);
                    }
                }
            }, 1000);
        };

        runIntro();

        return () => {
            cancelled = true;
        };
    }, [searchParams, menuName]);

    // 음성 인식 (진입 안내가 끝날 때까지 시작하지 않음 — shouldListenRef는 intro effect에서 true로 전환)
    useEffect(() => {
        mountedRef.current = true;
        shouldListenRef.current = false;

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
            if (isTtsActive()) {
                return;
            }
            // 음성 안내 재생 중이면 음성 인식 결과를 무시
            if (isSpeakingRef.current) {
                console.log("🔇 음성 안내 재생 중이므로 음성 인식 결과 무시:", event.results[0][0].transcript);
                return;
            }

            const transcript = event.results[0][0].transcript || "";
            const normalized = transcript.toLowerCase().replace(/\s/g, "");
            const now = Date.now();
            if (lastHandledVoiceRef.current.text === normalized && now - lastHandledVoiceRef.current.at < 1500) {
                return;
            }
            lastHandledVoiceRef.current = { text: normalized, at: now };

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
                (["카페라떼", "라떼", "아이스티", "콜라", "제로콜라", "사이다", "커피", "latte", "icetea", "coke", "zero", "soda", "coffee"].some(k =>
                    currentMenuNameNormalized === k.toLowerCase() || currentMenuNameNormalized.includes(k.toLowerCase())
                ));

            // 음료인 경우 사이즈 음성 선택
            if (isCurrentDrink) {
                if (/미디움|미디엄|중간|중간사이즈|중자|미디움으로|중간으로|엠사이즈/.test(normalized)) {
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
                if (/라지|큰거|큰사이즈|큰|라지로|대자|엘사이즈/.test(normalized)) {
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
                } catch (e) { }
                isSpeakingRef.current = true;
                await speakKorean(msg);
                setTimeout(() => {
                    isSpeakingRef.current = false;
                    if (mountedRef.current && shouldListenRef.current) {
                        setTimeout(() => {
                            if (recognitionRef.current && mountedRef.current && shouldListenRef.current) {
                                try {
                                    recognitionRef.current.start();
                                } catch (e) { }
                            }
                        }, 2000);
                    }
                }, 1000);
                return;
            }

            // 버거인 경우 단품/세트 선택
            if (isCurrentBurger) {
                console.log("🔍 음성인식 결과 (버거):", normalized, "isCurrentBurger:", isCurrentBurger);

                const hasDefaultSetWord = /기본\s*세트|기본세트/.test(normalized);
                const hasQuestion =
                    /뭐야|뭐에요|뭔데|뭔지|무엇|뭐니|뭐죠|뭐임|뭔가요|설명|알려줘|알려|뭐인지|어떤거야|어떤건지|뭔말|무슨말/.test(
                        normalized
                    );
                const asksWhatIsDefaultSet = hasDefaultSetWord && hasQuestion;

                // "기본 세트가 뭐야?" (질문) — 선택과 구분: 질문일 때만 안내
                if (asksWhatIsDefaultSet) {
                    try {
                        recognition.stop();
                    } catch (e) { }
                    const explain = "가장 인기 있는 세트 조합입니다.";
                    setAssistantMessage(explain);
                    isSpeakingRef.current = true;
                    await speakKorean(explain).catch((err) => console.error("음성 안내 오류:", err));
                    if (!mountedRef.current) return;
                    isSpeakingRef.current = false;
                    if (mountedRef.current && shouldListenRef.current) {
                        setTimeout(() => {
                            if (recognitionRef.current && mountedRef.current && shouldListenRef.current) {
                                try {
                                    recognitionRef.current.start();
                                } catch (e) { }
                            }
                        }, 1000);
                    }
                    return;
                }

                // 단품 선택 - 먼저 체크const [voiceLogs, setVoiceLogs] = useState([]);
                if (/단품|단품으로|단품주문|버거만|버거만줘|단품할게|단품으로할게/.test(normalized)) {
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

                // 기본 세트 선택 ("기본세트가 뭐야?" 같은 질문은 위에서 처리)
                if (/기본세트|기본적용|기본으로|기본세트로|기본세트주문|기본으로할게|기본세트할게|기본으로줘/.test(normalized) || (/기본/.test(normalized) && /세트/.test(normalized) && !hasQuestion)) {
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

                // "세트 직접 선택" 선택
                if (/세트직접선택|세트직접|직접선택|세트로|세트주문|세트할게|세트로줘|세트로할게|세트/.test(normalized)) {
                    try {
                        recognition.stop();
                    } catch (e) { }
                    handleSet();
                    return;
                }

                // 도움말 (버거인 경우)
                const msg = "단품, 기본 세트, 세트 직접 선택 중 선택해 주세요.";
                setAssistantMessage(msg);
                try {
                    recognition.stop();
                } catch (e) { }
                isSpeakingRef.current = true;
                await speakKorean(msg);
                setTimeout(() => {
                    isSpeakingRef.current = false;
                    if (mountedRef.current && shouldListenRef.current) {
                        setTimeout(() => {
                            if (recognitionRef.current && mountedRef.current && shouldListenRef.current) {
                                try {
                                    recognitionRef.current.start();
                                } catch (e) { }
                            }
                        }, 2000);
                    }
                }, 1000);
            }
        };

        recognitionRef.current = recognition;
        registerVoiceSession(recognition);

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
            currentCartItems.push({ id, name: `${currentMenuName}(${sizeDisplayName})`, price, qty: 1, type: "drink", size });
        }

        const cartData = encodeURIComponent(JSON.stringify(currentCartItems));
        const orderType = searchParams.get("orderType") || "takeout";
        console.log("handleDrinkSize - cartData:", cartData, "size:", size);
        // 바로 메뉴 페이지로 이동
        navigateTo(`/menu?${entryQuery(entry)}&orderType=${orderType}&cart=${cartData}`);
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
        const entSingle = getOrderFlowEntry(currentSearchParams);
        stopVoiceSession(recognitionRef.current, shouldListenRef, isSpeakingRef);
        currentRouter.push(`/menu?${entryQuery(entSingle)}&orderType=${orderType}&cart=${cartData}`);
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
        navigateTo(`/drink-select?menuId=${menuId}&menuName=${encodeURIComponent(menuName)}&price=${menuPrice}&cart=${cartData}&orderType=${orderType}&${entryQuery(entry)}`);
    }

    // 기본세트 추가 함수 (새로 작성)
    const handleSingleClick = () => {
        setActiveOptionButton("single");
        setTimeout(() => {
            handleSingle();
        }, 120);
    };

    const handleDefaultSetClick = () => {
        setActiveOptionButton("default");
        setTimeout(() => {
            handleDefaultSet();
        }, 120);
    };

    const handleSetClick = () => {
        setActiveOptionButton("set");
        setTimeout(() => {
            handleSet();
        }, 120);
    };

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

        // 기본세트: 메인 + 감자튀김 M + 콜라 M
        const drinkP = 2500;
        const sideP = 2500;
        const setPrice = currentMenuPrice + drinkP + sideP;

        // 장바구니에 기본세트 추가
        const setId = `${currentMenuId}_set_default`;
        const idx = currentCartItems.findIndex((p) => p.id === setId);
        if (idx >= 0) {
            currentCartItems[idx] = { ...currentCartItems[idx], qty: currentCartItems[idx].qty + 1 };
        } else {
            currentCartItems.push({
                id: setId,
                name: `${currentMenuName} 기본 세트`,
                price: setPrice,
                qty: 1,
                type: "set",
                items: [
                    { name: currentMenuName, price: currentMenuPrice },
                    { name: "감자튀김", size: "미디움", price: sideP },
                    { name: "콜라", size: "미디움", price: drinkP },
                ],
            });
        }

        const cartData = encodeURIComponent(JSON.stringify(currentCartItems));
        console.log("기본 세트 추가 완료:", { currentMenuId, currentMenuName, currentCartItems });
        const entSet = getOrderFlowEntry(currentSearchParams);
        stopVoiceSession(recognitionRef.current, shouldListenRef, isSpeakingRef);
        currentRouter.push(`/menu?${entryQuery(entSet)}&orderType=${orderType}&cart=${cartData}`);
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

    const shell = (
        <main
            style={{
                display: "flex",
                flexDirection: "column",
                minHeight: entry === "qr" ? "100%" : "100vh",
                flex: entry === "qr" ? 1 : undefined,
                backgroundColor: "#ffffff",
            }}
        >
            {/* 음성 인식 로그창 */}
            {false && voiceLogs.length > 0 && (
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
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "16px 24px",
                    backgroundColor: "#fff",
                    zIndex: 50,
                }}
            >
                <div style={{ display: "none" }}>
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
                    onClick={handleBack}
                    style={{
                        backgroundColor: isBackButtonActive ? "#fec315" : "#002e55",
                        color: "#ffffff",
                        border: "none",
                        padding: "10px 14px",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "18px",
                        fontWeight: "600",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "8px",
                    }}
                >
                    <img
                        src="/back.png"
                        alt=""
                        aria-hidden="true"
                        style={{ width: "22px", height: "22px", objectFit: "contain" }}
                    />
                    뒤로가기
                </button>
                <div
                    style={{
                        position: "absolute",
                        left: "50%",
                        transform: "translateX(-50%)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    <img
                        src="/logo.png"
                        alt="logo"
                        style={{
                            width: "64px",
                            height: "64px",
                            objectFit: "contain",
                            display: "block",
                            marginTop: "4px",
                        }}
                    />
                </div>
                <div style={{ width: "120px" }}></div>
            </div>

            {/* 음성 안내 메시지 (화면 표시용 텍스트) */}
            {/*
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
            */}

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
                    transform: "translateY(-24px)",
                }}
            >
                {!isDrink ? (
                    <>
                        {/* 중앙 메뉴 이미지 */}
                        <div
                            style={{
                                width: "100%",
                                maxWidth: "460px",
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: "16px",
                                transform: "translateY(-20px)", /* 이미지 + 메뉴명 + 가격 전체 묶음 위로 */
                            }}
                        >
                            <div
                                style={{
                                    width: "100%",
                                    height: "320px",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    overflow: "hidden",
                                }}
                            >
                                <img
                                    src={getMenuImageSrc(menuId)}
                                    alt={menuName}
                                    style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
                                />
                            </div>
                            <div
                                style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    textAlign: "center",
                                    gap: "14px",
                                }}
                            >
                                <div
                                    style={{
                                        fontSize: "2.5rem",
                                        fontWeight: "800",
                                        color: "#111",
                                        lineHeight: "1.2",
                                    }}
                                >
                                    {menuName}
                                </div>
                                <div
                                    style={{
                                        fontSize: "2rem",
                                        fontWeight: "700",
                                        color: "#002e55",
                                        lineHeight: "1.2",
                                    }}
                                >
                                    {menuPrice.toLocaleString()}원
                                </div>
                            </div>
                        </div>

                        {/* 단품/기본 세트/세트 직접 선택 버튼 - 동일 크기 한 줄 정렬 */}
                        <div
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "stretch",
                                gap: "16px",
                                width: "100%",
                                maxWidth: "720px",
                            }}
                        >
                            <button
                                ref={singleButtonRef}
                                onClick={handleSingleClick}
                                style={{
                                    width: "100%",
                                    height: "130px",
                                    fontSize: "2rem",
                                    fontWeight: "bold",
                                    backgroundColor: activeOptionButton === "single" ? "#c8d8ea" : "#f5f8fc",
                                    color: "#000",
                                    border: activeOptionButton === "single" ? "2px solid #002e55" : "2px solid #d9e3ef",
                                    borderRadius: "16px",
                                    cursor: "pointer",
                                    textAlign: "left",
                                    paddingLeft: "134px",
                                    backgroundImage: "url('/option_single.png')",
                                    backgroundRepeat: "no-repeat",
                                    backgroundPosition: "24px center",
                                    backgroundSize: "84px auto",
                                    boxShadow:
                                        activeOptionButton === "single"
                                            ? "0 4px 10px rgba(0,0,0,0.12)"
                                            : "0 2px 6px rgba(0,0,0,0.06)",
                                }}
                            >
                                단품
                                <div style={{ fontSize: "1.4rem", marginTop: "3px", opacity: 0.9, color: "#002e55" }}>
                                    {menuPrice.toLocaleString()}원
                                </div>
                            </button>

                            <button
                                ref={defaultSetButtonRef}
                                onClick={handleDefaultSetClick}
                                style={{
                                    width: "100%",
                                    height: "130px",
                                    fontSize: "2rem",
                                    fontWeight: "bold",
                                    backgroundColor: activeOptionButton === "default" ? "#c8d8ea" : "#f5f8fc",
                                    color: "#000",
                                    border: activeOptionButton === "default" ? "2px solid #002e55" : "2px solid #d9e3ef",
                                    borderRadius: "16px",
                                    cursor: "pointer",
                                    textAlign: "left",
                                    paddingLeft: "134px",
                                    backgroundImage: "url('/option_default.png')",
                                    backgroundRepeat: "no-repeat",
                                    backgroundPosition: "24px center",
                                    backgroundSize: "84px auto",
                                    boxShadow:
                                        activeOptionButton === "default"
                                            ? "0 4px 10px rgba(0,0,0,0.12)"
                                            : "0 2px 6px rgba(0,0,0,0.06)",
                                    paddingRight: "10px",
                                }}
                            >
                                기본 세트 (감자튀김 중간 + 콜라 중간)
                                <div style={{ fontSize: "1.4rem", marginTop: "3px", opacity: 0.9, color: "#002e55" }}>
                                    {(menuPrice + 2500 + 2500).toLocaleString()}원
                                </div>
                            </button>

                            <button
                                ref={setButtonRef}
                                onClick={handleSetClick}
                                style={{
                                    width: "100%",
                                    height: "130px",
                                    fontSize: "2rem",
                                    fontWeight: "bold",
                                    backgroundColor: activeOptionButton === "set" ? "#c8d8ea" : "#f5f8fc",
                                    color: "#000",
                                    border: activeOptionButton === "set" ? "2px solid #002e55" : "2px solid #d9e3ef",
                                    borderRadius: "16px",
                                    cursor: "pointer",
                                    textAlign: "left",
                                    paddingLeft: "134px",
                                    backgroundImage: "url('/option_set.png')",
                                    backgroundRepeat: "no-repeat",
                                    backgroundPosition: "24px center",
                                    backgroundSize: "84px auto",
                                    boxShadow:
                                        activeOptionButton === "set"
                                            ? "0 4px 10px rgba(0,0,0,0.12)"
                                            : "0 2px 6px rgba(0,0,0,0.06)",
                                }}
                            >
                                세트 직접 선택
                                <div style={{ fontSize: "1.4rem", marginTop: "3px", opacity: 0.9, color: "#002e55" }}>
                                    음료 또는 사이드 선택
                                </div>
                            </button>
                        </div>
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
                                const isLatte = ["카페라떼", "라떼", "latte"].some((k) => n.includes(k));
                                const isIcedTea = ["아이스티", "icetea", "icedtea"].some((k) => n.includes(k));
                                return isLatte ? (
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
                                ) : isIcedTea ? (
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
                                ) : isCola ? (
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
    return entry === "qr" ? <KioskAspectFrame>{shell}</KioskAspectFrame> : shell;
}

export default function MenuOptionPage() {
    return (
        <Suspense fallback={<main style={{ minHeight: "100vh", backgroundColor: "#ffffff" }} />}>
            <MenuOptionPageContent />
        </Suspense>
    );
}

