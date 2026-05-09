"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, useEffect, useRef, useMemo, useCallback } from "react";
import { isTtsActive, speakKorean } from "../utils/speakKorean";
import { registerVoiceSession, stopVoiceSession } from "../utils/voiceSession";
import KioskAspectFrame from "../../components/KioskAspectFrame";
import { getOrderFlowEntry, entryQuery } from "../utils/orderFlowEntry";
import {
    inferMenuCategory,
    mergeMenusFromApiResponse,
    menuThumbImageSrc,
    staticMenuCatalogCopy,
} from "../utils/kioskMenuCatalog";

const NONE_OPTION = "None";
const DRINK_DISPLAY_ORDER = [
    "콜라",
    "제로콜라",
    "사이다",
    "제로사이다",
    "아메리카노",
    "카페라떼",
    "아이스티",
];
const SIDE_DISPLAY_ORDER = [
    "감자튀김",
    "해쉬브라운",
    "치킨윙",
    "코울슬로",
];
function buildDefaultCartItem(menuId, menuName, menuPrice) {
    return {
        id: menuId || "menu-item",
        name: menuName || "메뉴",
        price: menuPrice || 0,
        qty: 1,
        type: "single",
    };
}

function drinkMediumPrice(drinkName, catalog) {
    if (!drinkName || drinkName === NONE_OPTION) return 0;
    const row = catalog?.find((m) => m.name === drinkName);
    return row?.price != null ? row.price : 2500;
}

function sideBasePriceFromCatalog(sideName, catalog) {
    if (!sideName || sideName === NONE_OPTION) return 0;
    const row = catalog?.find((m) => m.name === sideName);
    if (row?.price != null) return row.price;
    if (sideName === "치킨윙") return 4000;
    return 2500;
}

function sideUnitPriceCatalog(sideName, size, catalog) {
    if (!sideName || sideName === NONE_OPTION || size === NONE_OPTION) return 0;
    const base = sideBasePriceFromCatalog(sideName, catalog);
    return size === "라지" ? base + 500 : base;
}

function cartItemImageSrc(item) {
    if (!item) return null;
    if (item.image) return item.image;
    return getMenuImageSrc(item.id, item.name);
}

function getMenuImageSrc(menuId, menuName) {
    const normalizedName = (menuName || "").replace(/\s+/g, "").toLowerCase();
    if (/칠리/.test(normalizedName) && /새우|shrimp/.test(normalizedName)) {
        return "/chilli_shrimp.png";
    }
    if (/크림|cream/.test(normalizedName) && /새우|shrimp/.test(normalizedName)) {
        return "/cream_shrimp.png";
    }
    if (/새우|shrimp/.test(normalizedName)) {
        return "/shrimp.png";
    }
    if (/치킨/.test(normalizedName) && /버거/.test(normalizedName)) {
        return "/chicken.png";
    }
    switch ((menuId || "").toLowerCase()) {
        case "bur-bulgogi":
            return "/bulgogi.png";
        case "bur-garlic":
            return "/garlic_bulgogi.png";
        case "bur-bacon":
            return "/bacon_bulgogi.png";
        case "bur-mozza":
            return "/cheese.png";
        case "bur-triple":
            return "/double_bulgogi.png";
        case "bur-mush":
            return "/mushroom_bulgogi.png";
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
    const [baseCartItems, setBaseCartItems] = useState([]);
    const [cartItems, setCartItems] = useState([]);
    const [isListening, setIsListening] = useState(false);
    const [assistantMessage, setAssistantMessage] = useState("");
    const [isBackButtonActive, setIsBackButtonActive] = useState(false);
    const [activeOptionButton, setActiveOptionButton] = useState("");
    const [isClearCartButtonActive, setIsClearCartButtonActive] = useState(false);
    const [isOrderButtonActive, setIsOrderButtonActive] = useState(false);
    const [activeCartAdjustButton, setActiveCartAdjustButton] = useState("");
    const [activeCartDeleteButton, setActiveCartDeleteButton] = useState("");
    const [catalogItems, setCatalogItems] = useState(() => staticMenuCatalogCopy());
    const [selectedAdditionalDrink, setSelectedAdditionalDrink] = useState("");
    const [selectedAdditionalDrinkSize, setSelectedAdditionalDrinkSize] = useState("");
    const [selectedDrinkChoice, setSelectedDrinkChoice] = useState(null);
    const [pendingAdditionalDrinkSize, setPendingAdditionalDrinkSize] = useState("");
    const [isDrinkAddCancelButtonActive, setIsDrinkAddCancelButtonActive] = useState(false);
    const [selectedAdditionalSide, setSelectedAdditionalSide] = useState("");
    const [selectedAdditionalSideSize, setSelectedAdditionalSideSize] = useState("");
    const [selectedSideChoice, setSelectedSideChoice] = useState(null);
    const [pendingAdditionalSideSize, setPendingAdditionalSideSize] = useState("");
    const [isSideAddCancelButtonActive, setIsSideAddCancelButtonActive] = useState(false);
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
    const introStartedRef = useRef(false); // 진입 안내 중복 재생 방지

    function navigateTo(path) {
        stopVoiceSession(recognitionRef.current, shouldListenRef, isSpeakingRef);
        router.push(path);
    }

    function menuStateQuery(params = searchParams) {
        const menuPage = params.get("menuPage") || "1";
        const menuCategory = params.get("menuCategory") || "burger";
        return `menuPage=${menuPage}&menuCategory=${menuCategory}`;
    }

    const handleBack = () => {
        setIsBackButtonActive(true);
        setTimeout(() => {
            const cartData = encodeURIComponent(JSON.stringify(cartItems));
            const orderType = searchParams.get("orderType") || "takeout";
            navigateTo(`/menu?${entryQuery(entry)}&orderType=${orderType}&cart=${cartData}&${menuStateQuery()}`);
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
            "제로사이다",
            "커피",
            "아메리카노",
            "latte",
            "icetea",
            "coke",
            "zero",
            "soda",
            "coffee",
            "americano",
        ];

        // 음료 키워드와 정확히 일치하는지 확인
        const isDrinkMenu = drinkKeywords.some((k) => {
            const keywordLower = k.toLowerCase();
            // 정확히 일치하거나, 메뉴 이름이 키워드를 포함하는 경우
            return n === keywordLower || n.includes(keywordLower);
        });

        return isDrinkMenu;
    }, [menuName]);

    const drinkItems = useMemo(() => {
        const drinkOrder = new Map(DRINK_DISPLAY_ORDER.map((name, index) => [name, index]));
        return catalogItems
            .filter((m) => inferMenuCategory(m) === "drink")
            .sort((a, b) => {
                const aOrder = drinkOrder.get(a.name) ?? Number.MAX_SAFE_INTEGER;
                const bOrder = drinkOrder.get(b.name) ?? Number.MAX_SAFE_INTEGER;
                if (aOrder !== bOrder) return aOrder - bOrder;
                return a.name.localeCompare(b.name, "ko");
            });
    }, [catalogItems]);

    const sideItems = useMemo(() => {
        const sideOrder = new Map(SIDE_DISPLAY_ORDER.map((name, index) => [name, index]));
        return catalogItems
            .filter((m) => inferMenuCategory(m) === "side")
            .sort((a, b) => {
                const aOrder = sideOrder.get(a.name) ?? Number.MAX_SAFE_INTEGER;
                const bOrder = sideOrder.get(b.name) ?? Number.MAX_SAFE_INTEGER;
                if (aOrder !== bOrder) return aOrder - bOrder;
                return a.name.localeCompare(b.name, "ko");
            });
    }, [catalogItems]);

    const additionalDrinkSizeButtons =
        selectedAdditionalDrink && selectedAdditionalDrink !== NONE_OPTION
            ? (() => {
                  const med = drinkMediumPrice(selectedAdditionalDrink, catalogItems);
                  return [
                      { name: "미디움", price: med },
                      { name: "라지", price: med + 500 },
                  ];
              })()
            : [];

    const sideSizeOptions = [{ name: "미디움" }, { name: "라지" }];
    const cartTotal = cartItems.reduce((sum, it) => sum + it.price * it.qty, 0);

    useEffect(() => {
        const currentMenuName = decodeURIComponent(searchParams.get("menuName") || "");
        const currentMenuPrice = parseInt(searchParams.get("price") || "0");
        const currentMenuId = searchParams.get("menuId") || "";

        setMenuName(currentMenuName);
        setMenuPrice(currentMenuPrice);
        setMenuId(currentMenuId);

        const cartParam = searchParams.get("cart");
        if (cartParam) {
            try {
                const parsedCart = JSON.parse(decodeURIComponent(cartParam));
                const safeBaseCart = Array.isArray(parsedCart) ? parsedCart : [];
                setBaseCartItems(safeBaseCart);
                setCartItems(
                    safeBaseCart.length > 0
                        ? safeBaseCart
                        : [buildDefaultCartItem(currentMenuId, currentMenuName, currentMenuPrice)]
                );
            } catch (e) {
                console.error("Failed to load cart:", e);
                setBaseCartItems([]);
                setCartItems([buildDefaultCartItem(currentMenuId, currentMenuName, currentMenuPrice)]);
            }
        } else {
            setBaseCartItems([]);
            setCartItems([buildDefaultCartItem(currentMenuId, currentMenuName, currentMenuPrice)]);
        }
        setSelectedDrinkChoice(null);
        setSelectedSideChoice(null);
    }, [searchParams]);

    useEffect(() => {
        let cancelled = false;

        async function loadCatalog() {
            const fallback = staticMenuCatalogCopy();
            const base = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001").replace(/\/$/, "");
            try {
                const res = await fetch(`${base}/api/menu`, { cache: "no-store" });
                const data = await res.json().catch(() => ({}));
                if (cancelled) return;
                if (res.ok) {
                    const merged = mergeMenusFromApiResponse(data);
                    if (merged?.length) {
                        setCatalogItems(merged);
                        return;
                    }
                }
            } catch (e) {
                console.error("menu-option menu load:", e);
            }

            if (!cancelled) {
                setCatalogItems(fallback);
            }
        }

        loadCatalog();

        return () => {
            cancelled = true;
        };
    }, []);

    // 페이지 진입 직후 음성 안내 → 안내 종료 후 1초 뒤 음성 인식 시작 (페이지 마운트당 1회만 실행)
    useEffect(() => {
        if (introStartedRef.current) return;
        introStartedRef.current = true;

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
            const sp = searchParamsRef.current;
            const currentMenuName = decodeURIComponent(sp.get("menuName") || "");
            const currentMenuNameNormalized = currentMenuName.replace(/\s+/g, "").toLowerCase();
            const isCurrentBurger = currentMenuNameNormalized.includes("버거") || currentMenuNameNormalized.includes("burger");
            const isCurrentDrink = !isCurrentBurger &&
                (["카페라떼", "라떼", "아이스티", "콜라", "제로콜라", "사이다", "제로사이다", "커피", "아메리카노", "latte", "icetea", "coke", "zero", "soda", "coffee", "americano"].some(k =>
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
    }, []);

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
                (["카페라떼", "라떼", "아이스티", "콜라", "제로콜라", "사이다", "제로사이다", "커피", "아메리카노", "latte", "icetea", "coke", "zero", "soda", "coffee", "americano"].some(k =>
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
        navigateTo(`/menu?${entryQuery(entry)}&orderType=${orderType}&cart=${cartData}&${menuStateQuery()}`);
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
        currentRouter.push(`/menu?${entryQuery(entSingle)}&orderType=${orderType}&cart=${cartData}&${menuStateQuery(currentSearchParams)}`);
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
        navigateTo(`/drink-select?menuId=${menuId}&menuName=${encodeURIComponent(menuName)}&price=${menuPrice}&cart=${cartData}&orderType=${orderType}&${menuStateQuery()}&${entryQuery(entry)}`);
    }

    // 기본세트 추가 함수 (새로 작성)
    function adjustCartItemQty(itemId, delta) {
        setCartItems((prev) => {
            const idx = prev.findIndex((item) => item.id === itemId);
            if (idx === -1) return prev;

            const next = [...prev];
            const current = next[idx];
            const nextQty = (current.qty || 1) + delta;

            if (nextQty <= 0) {
                return next.filter((item) => item.id !== itemId);
            }

            next[idx] = { ...current, qty: nextQty };
            return next;
        });
    }

    function deleteCartItem(itemId) {
        if (itemId.startsWith("extra-drink-")) {
            setSelectedDrinkChoice((prev) => (prev?.id === itemId ? null : prev));
        }
        if (itemId.startsWith("extra-side-")) {
            setSelectedSideChoice((prev) => (prev?.id === itemId ? null : prev));
        }
        setCartItems((prev) => prev.filter((item) => item.id !== itemId));
    }

    function clearCart() {
        setCartItems([]);
    }

    function handleOrder() {
        if (cartItems.length === 0) return;
        const parts = [menuName];
        if (selectedDrinkChoice) {
            parts.push(`${selectedDrinkChoice.name}(${selectedDrinkChoice.sizeLabel})`);
        }
        if (selectedSideChoice) {
            parts.push(`${selectedSideChoice.name}(${selectedSideChoice.sizeLabel})`);
        }

        const finalizedItem = {
            id: `${menuId || "menu-item"}_${Date.now()}`,
            name: parts.filter(Boolean).join(" + "),
            price: menuPrice + (selectedDrinkChoice?.price || 0) + (selectedSideChoice?.price || 0),
            qty: 1,
            type: selectedDrinkChoice || selectedSideChoice ? "set" : "single",
        };

        const cartData = encodeURIComponent(JSON.stringify([...baseCartItems, finalizedItem]));
        const orderType = searchParams.get("orderType") || "takeout";
        navigateTo(`/menu?${entryQuery(entry)}&orderType=${orderType}&cart=${cartData}&${menuStateQuery()}`);
    }

    function addAdditionalDrinkToCart(drinkName, sizeName) {
        const unitPrice = drinkMediumPrice(drinkName, catalogItems) + (sizeName === "라지" ? 500 : 0);
        const sizeLabel = sizeName === "라지" ? "큰" : "중간";
        const itemId = `extra-drink-${drinkName}-${sizeName}`;
        const itemName = `${drinkName}(${sizeLabel})`;
        const catalogRow = catalogItems.find((item) => item.name === drinkName);
        const itemImage = menuThumbImageSrc(catalogRow || { id: itemId, name: drinkName });
        setSelectedDrinkChoice({ id: itemId, name: drinkName, size: sizeName, sizeLabel, price: unitPrice });

        setCartItems((prev) => {
            const idx = prev.findIndex((item) => item.id === itemId);
            if (idx === -1) {
                return [
                    ...prev,
                    {
                        id: itemId,
                        name: itemName,
                        price: unitPrice,
                        qty: 1,
                        type: "drink",
                        size: sizeName,
                        image: itemImage,
                    },
                ];
            }

            const next = [...prev];
            next[idx] = { ...next[idx], qty: (next[idx].qty || 1) + 1, image: next[idx].image || itemImage };
            return next;
        });
    }

    function addAdditionalSideToCart(sideName, sizeName) {
        const unitPrice = sideUnitPriceCatalog(sideName, sizeName, catalogItems);
        const sizeLabel = sizeName === "라지" ? "큰" : "중간";
        const itemId = `extra-side-${sideName}-${sizeName}`;
        const itemName = `${sideName}(${sizeLabel})`;
        const catalogRow = catalogItems.find((item) => item.name === sideName);
        const itemImage = menuThumbImageSrc(catalogRow || { id: itemId, name: sideName });
        setSelectedSideChoice({ id: itemId, name: sideName, size: sizeName, sizeLabel, price: unitPrice });

        setCartItems((prev) => {
            const idx = prev.findIndex((item) => item.id === itemId);
            if (idx === -1) {
                return [
                    ...prev,
                    {
                        id: itemId,
                        name: itemName,
                        price: unitPrice,
                        qty: 1,
                        type: "side",
                        size: sizeName,
                        image: itemImage,
                    },
                ];
            }

            const next = [...prev];
            next[idx] = { ...next[idx], qty: (next[idx].qty || 1) + 1, image: next[idx].image || itemImage };
            return next;
        });
    }

    const handleCartAdjustClick = (action, item) => {
        const key = `${action}-${item.id}`;
        setActiveCartAdjustButton(key);
        setTimeout(() => {
            adjustCartItemQty(item.id, action === "plus" ? 1 : -1);
            setActiveCartAdjustButton("");
        }, 120);
    };

    const handleCartDeleteClick = (itemId) => {
        setActiveCartDeleteButton(itemId);
        setTimeout(() => {
            deleteCartItem(itemId);
            setActiveCartDeleteButton("");
        }, 120);
    };

    const handleClearCartClick = () => {
        if (cartItems.length === 0) return;
        setIsClearCartButtonActive(true);
        setTimeout(() => {
            clearCart();
            setIsClearCartButtonActive(false);
        }, 120);
    };

    const handleOrderClick = () => {
        if (cartItems.length === 0) return;
        setIsOrderButtonActive(true);
        setTimeout(() => {
            handleOrder();
        }, 120);
    };

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
        currentRouter.push(`/menu?${entryQuery(entSet)}&orderType=${orderType}&cart=${cartData}&${menuStateQuery(currentSearchParams)}`);
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
                overflow: "hidden",
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
                                    src={getMenuImageSrc(menuId, menuName)}
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
                            {false && <button
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
                            </button>}

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
                                    paddingLeft: "32px",
                                    boxShadow:
                                        activeOptionButton === "default"
                                            ? "0 4px 10px rgba(0,0,0,0.12)"
                                            : "0 2px 6px rgba(0,0,0,0.06)",
                                    paddingRight: "10px",
                                }}
                            >
                                기본 세트 (콜라 중간 + 감자튀김 중간)
                                <div style={{ fontSize: "1.4rem", marginTop: "3px", opacity: 0.9, color: "#002e55" }}>
                                    {(menuPrice + 2500 + 2500).toLocaleString()}원
                                </div>
                            </button>

                            {false && <button
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
                            </button>}
                            <div
                                style={{
                                    display: "grid",
                                    gridTemplateColumns: "1fr 1fr",
                                    gap: "16px",
                                    width: "100%",
                                }}
                            >
                                <button
                                    onClick={() => {
                                        setActiveOptionButton("drink-add");
                                        setSelectedAdditionalDrink("");
                                        setSelectedAdditionalDrinkSize("");
                                        setPendingAdditionalDrinkSize("");
                                    }}
                                    style={{
                                        width: "100%",
                                        height: "130px",
                                        fontSize: "2rem",
                                        fontWeight: "bold",
                                        backgroundColor: activeOptionButton === "drink-add" ? "#c8d8ea" : "#f5f8fc",
                                        color: "#000",
                                        border: activeOptionButton === "drink-add" ? "2px solid #002e55" : "2px solid #d9e3ef",
                                        borderRadius: "16px",
                                        cursor: "pointer",
                                        boxShadow:
                                            activeOptionButton === "drink-add"
                                                ? "0 4px 10px rgba(0,0,0,0.12)"
                                                : "0 2px 6px rgba(0,0,0,0.06)",
                                    }}
                                >
                                    음료 추가
                                </button>
                                <button
                                    onClick={() => {
                                        setActiveOptionButton("side-add");
                                        setSelectedAdditionalSide("");
                                        setSelectedAdditionalSideSize("");
                                        setPendingAdditionalSideSize("");
                                    }}
                                    style={{
                                        width: "100%",
                                        height: "130px",
                                        fontSize: "2rem",
                                        fontWeight: "bold",
                                        backgroundColor: activeOptionButton === "side-add" ? "#c8d8ea" : "#f5f8fc",
                                        color: "#000",
                                        border: activeOptionButton === "side-add" ? "2px solid #002e55" : "2px solid #d9e3ef",
                                        borderRadius: "16px",
                                        cursor: "pointer",
                                        boxShadow:
                                            activeOptionButton === "side-add"
                                                ? "0 4px 10px rgba(0,0,0,0.12)"
                                                : "0 2px 6px rgba(0,0,0,0.06)",
                                    }}
                                >
                                    사이드 추가
                                </button>
                            </div>

                        </div>

                        <div
                            style={{
                                width: "100%",
                                maxWidth: "720px",
                                height: "225px",
                                display: "flex",
                                flexDirection: "column",
                                backgroundColor: "#fff",
                                overflow: "hidden",
                                marginTop: "-10px",
                            }}
                        >
                        <div
                            style={{
                                background: "#fff9db",
                                border: "2px solid #fec315",
                                borderRadius: "16px",
                                display: "grid",
                                gridTemplateColumns: "2px minmax(0, 1fr) 2px",
                                gridTemplateRows: "2px minmax(0, 1fr) 2px auto 2px",
                                flex: 1,
                                overflow: "hidden",
                                minHeight: 0,
                            }}
                        >
                            <div aria-hidden="true" />
                            <div
                                style={{
                                    gridColumn: 2,
                                    gridRow: 2,
                                    minWidth: 0,
                                    minHeight: 0,
                                    overflowX: "auto",
                                    overflowY: "hidden",
                                    WebkitOverflowScrolling: "touch",
                                }}
                            >
                                <div
                                    style={{
                                        display: "inline-flex",
                                        gap: "12px",
                                        alignItems: "center",
                                        minHeight: "100%",
                                    }}
                                >
                                    {cartItems.length === 0 ? (
                                        <div style={{ color: "#c8d8ea", fontSize: "34px" }}>담긴 상품이 없습니다</div>
                                    ) : (
                                        cartItems.map((it) => (
                                            <div
                                                key={it.id}
                                                style={{
                                                    minWidth: "160px",
                                                    boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
                                                    background: "#ffffff",
                                                    border: "2px solid #d9e3ef",
                                                    borderRadius: "6px",
                                                    padding: "12px",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: "8px",
                                                    flexShrink: 0,
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        width: "80px",
                                                        height: "80px",
                                                        background: "#ffffff",
                                                        borderRadius: "4px",
                                                        display: "flex",
                                                        alignItems: "center",
                                                        justifyContent: "center",
                                                        flexShrink: 0,
                                                    }}
                                                >
                                                    {(() => {
                                                        const src = cartItemImageSrc(it);
                                                        return src ? (
                                                            <img src={src} alt={it.name} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                                                        ) : (
                                                            <div style={{ fontSize: "10px", color: "#999" }}>이미지</div>
                                                        );
                                                    })()}
                                                </div>

                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ fontWeight: "700", fontSize: "20px", marginBottom: "4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                        {it.name}
                                                    </div>
                                                    <div style={{ display: "flex", alignItems: "center", gap: "8px", justifyContent: "space-between" }}>
                                                        <div style={{ fontWeight: "700", fontSize: "20px", color: "#002e55" }}>
                                                            {it.price.toLocaleString()}원
                                                        </div>
                                                        <button
                                                            onClick={() => handleCartDeleteClick(it.id)}
                                                            style={{
                                                                width: "24px",
                                                                height: "24px",
                                                                borderRadius: "50%",
                                                                border: "none",
                                                                background: activeCartDeleteButton === it.id ? "#fec315" : "#ff3b30",
                                                                color: "#ffffff",
                                                                cursor: "pointer",
                                                                fontSize: "20px",
                                                                fontWeight: "700",
                                                                display: "flex",
                                                                alignItems: "center",
                                                                justifyContent: "center",
                                                            }}
                                                        >
                                                            ×
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                            <div aria-hidden="true" />
                            <div aria-hidden="true" />
                            <div
                                style={{
                                    gridColumn: 2,
                                    gridRow: 4,
                                    display: "flex",
                                    justifyContent: "flex-end",
                                }}
                            >
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "20px", minWidth: "262px" }}>
                                    <div style={{ fontSize: "24px", fontWeight: "700", color: "#000000", whiteSpace: "nowrap" }}>
                                        총 금액 | {cartTotal.toLocaleString()}원
                                    </div>
                                    <button
                                        onClick={handleOrderClick}
                                        disabled={cartItems.length === 0}
                                        style={{
                                            width: "130px",
                                            height: "60px",
                                            borderRadius: "8px",
                                            border: "none",
                                            background: cartItems.length === 0 ? "#c8d8ea" : isOrderButtonActive ? "#fec002" : "#ff3b30",
                                            color: "#ffffff",
                                            cursor: cartItems.length === 0 ? "not-allowed" : "pointer",
                                            fontSize: "24px",
                                            fontWeight: "700",
                                        }}
                                    >
                                        선택 완료
                                    </button>
                                </div>
                            </div>
                            <div aria-hidden="true" />
                        </div>
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
                                const isZeroCola = ["제로콜라", "zerocoke", "zero"].some((k) => n.includes(k));
                                const isCola = !isZeroCola && ["콜라", "coke"].some((k) => n.includes(k));
                                const isZeroCider = ["제로사이다", "zerocider"].some((k) => n.includes(k));
                                const isCider = !isZeroCider && ["사이다", "soda", "cider"].some((k) => n.includes(k));
                                const isCoffee = ["커피", "아메리카노", "coffee", "americano"].some((k) => n.includes(k));
                                const isLatte = ["카페라떼", "라떼", "latte"].some((k) => n.includes(k));
                                const isIcedTea = ["아이스티", "icetea", "icedtea"].some((k) => n.includes(k));
                                return isLatte ? (
                                    <img
                                        src="/caffelatte.png"
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
                                ) : isZeroCola ? (
                                    <img
                                        src="/zero_coke.png"
                                        alt="?ъ씠利??좏깮"
                                        style={{
                                            width: "100%",
                                            height: "100%",
                                            objectFit: "contain",
                                            display: "block",
                                        }}
                                    />
                                ) : isCola ? (
                                    <img
                                        src="/coke.png"
                                        alt="사이즈 선택"
                                        style={{
                                            width: "100%",
                                            height: "100%",
                                            objectFit: "contain",
                                            display: "block",
                                        }}
                                    />
                                ) : isZeroCider ? (
                                    <img
                                        src="/zero_cider.png"
                                        alt="?ъ씠利??좏깮"
                                        style={{
                                            width: "100%",
                                            height: "100%",
                                            objectFit: "contain",
                                            display: "block",
                                        }}
                                    />
                                ) : isCider ? (
                                    <img
                                        src="/cider.png"
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
                                        src="/americano.png"
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

                {activeOptionButton === "drink-add" &&
                    (!selectedAdditionalDrink || selectedAdditionalDrink === NONE_OPTION) && (
                        <div
                            style={{
                                position: "fixed",
                                inset: 0,
                                backgroundColor: "rgba(0,0,0,0.35)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                padding: "24px",
                                zIndex: 110,
                            }}
                        >
                            <div
                                style={{
                                    width: "min(920px, calc(100vw - 32px))",
                                    maxHeight: "min(760px, calc(100vh - 48px))",
                                    overflowY: "auto",
                                    background: "#ffffff",
                                    border: "1px solid #d9e3ef",
                                    borderRadius: "22px",
                                    padding: "28px",
                                    boxShadow: "0 18px 40px rgba(0,0,0,0.18)",
                                }}
                            >
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", marginBottom: "20px" }}>
                                    <h3 style={{ fontSize: "2rem", fontWeight: "bold", margin: 0 }}>
                                        음료를 선택하세요
                                    </h3>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setActiveOptionButton("");
                                            setSelectedAdditionalDrink("");
                                            setSelectedAdditionalDrinkSize("");
                                        }}
                                        style={{
                                            padding: "12px 18px",
                                            backgroundColor: "#002e55",
                                            color: "#fff",
                                            border: "none",
                                            borderRadius: "10px",
                                            fontSize: "1rem",
                                            fontWeight: "700",
                                            cursor: "pointer",
                                        }}
                                    >
                                        닫기
                                    </button>
                                </div>
                                <div
                                    style={{
                                        display: "grid",
                                        gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
                                        gap: "12px",
                                        maxWidth: "900px",
                                        margin: "0 auto",
                                    }}
                                >
                                    {drinkItems.map((d) => {
                                        const thumb = menuThumbImageSrc(d);
                                        return (
                                            <button
                                                key={d.id || d.name}
                                                onClick={() => {
                                                    setSelectedAdditionalDrink(d.name);
                                                    setSelectedAdditionalDrinkSize("");
                                                }}
                                                style={{
                                                    minHeight: "170px",
                                                    fontSize: "1.1rem",
                                                    fontWeight: "bold",
                                                    backgroundColor: selectedAdditionalDrink === d.name ? "#c8d8ea" : "#f5f8fc",
                                                    color: "#000",
                                                    border: selectedAdditionalDrink === d.name ? "2px solid #002e55" : "2px solid #d9e3ef",
                                                    borderRadius: "12px",
                                                    cursor: "pointer",
                                                    boxShadow:
                                                        selectedAdditionalDrink === d.name
                                                            ? "0 4px 10px rgba(0,0,0,0.12)"
                                                            : "0 2px 6px rgba(0,0,0,0.06)",
                                                    display: "flex",
                                                    flexDirection: "column",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    gap: 8,
                                                    padding: "16px 12px",
                                                }}
                                            >
                                                {thumb ? (
                                                    <img src={thumb} alt="" style={{ width: 72, height: 72, objectFit: "contain" }} />
                                                ) : (
                                                    <div style={{ width: 72, height: 72, color: "#8aa0c5", fontSize: 12 }}>음료</div>
                                                )}
                                                <div
                                                    style={{
                                                        fontSize: "1.5rem",
                                                        fontWeight: "800",
                                                        textAlign: "center",
                                                        marginTop: "6px",
                                                        marginBottom: "-2px",
                                                        lineHeight: 1,
                                                        width: "100%",
                                                        wordBreak: "keep-all",
                                                    }}
                                                >
                                                    {d.name}
                                                </div>
                                                <div style={{ fontSize: "1.2rem", marginTop: 0, opacity: 0.85, color: "#002e55" }}>
                                                    {drinkMediumPrice(d.name, catalogItems).toLocaleString()}원
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                {activeOptionButton === "side-add" &&
                    (!selectedAdditionalSide || selectedAdditionalSide === NONE_OPTION) && (
                        <div
                            style={{
                                position: "fixed",
                                inset: 0,
                                backgroundColor: "rgba(0,0,0,0.35)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                padding: "24px",
                                zIndex: 110,
                            }}
                        >
                            <div
                                style={{
                                    width: "min(920px, calc(100vw - 32px))",
                                    maxHeight: "min(760px, calc(100vh - 48px))",
                                    overflowY: "auto",
                                    background: "#ffffff",
                                    border: "1px solid #d9e3ef",
                                    borderRadius: "22px",
                                    padding: "28px",
                                    boxShadow: "0 18px 40px rgba(0,0,0,0.18)",
                                }}
                            >
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", marginBottom: "20px" }}>
                                    <h3 style={{ fontSize: "2rem", fontWeight: "bold", margin: 0 }}>
                                        사이드를 선택하세요
                                    </h3>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setActiveOptionButton("");
                                            setSelectedAdditionalSide("");
                                            setSelectedAdditionalSideSize("");
                                        }}
                                        style={{
                                            padding: "12px 18px",
                                            backgroundColor: "#002e55",
                                            color: "#fff",
                                            border: "none",
                                            borderRadius: "10px",
                                            fontSize: "1rem",
                                            fontWeight: "700",
                                            cursor: "pointer",
                                        }}
                                    >
                                        닫기
                                    </button>
                                </div>
                                <div
                                    style={{
                                        display: "grid",
                                        gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
                                        gap: "12px",
                                        maxWidth: "900px",
                                        margin: "0 auto",
                                    }}
                                >
                                    {sideItems.map((item) => {
                                        const thumb = menuThumbImageSrc(item);
                                        return (
                                            <button
                                                key={item.id || item.name}
                                                onClick={() => {
                                                    setSelectedAdditionalSide(item.name);
                                                    setSelectedAdditionalSideSize("");
                                                }}
                                                style={{
                                                    minHeight: "170px",
                                                    fontSize: "1.5rem",
                                                    fontWeight: "bold",
                                                    backgroundColor: selectedAdditionalSide === item.name ? "#c8d8ea" : "#f5f8fc",
                                                    color: "#000",
                                                    border: selectedAdditionalSide === item.name ? "2px solid #002e55" : "2px solid #d9e3ef",
                                                    borderRadius: "12px",
                                                    cursor: "pointer",
                                                    boxShadow:
                                                        selectedAdditionalSide === item.name
                                                            ? "0 4px 10px rgba(0,0,0,0.12)"
                                                            : "0 2px 6px rgba(0,0,0,0.06)",
                                                    display: "flex",
                                                    flexDirection: "column",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    gap: 8,
                                                    padding: "16px 12px",
                                                }}
                                            >
                                                {thumb ? (
                                                    <img src={thumb} alt="" style={{ width: 72, height: 72, objectFit: "contain" }} />
                                                ) : (
                                                    <div style={{ width: 72, height: 72, color: "#8aa0c5", fontSize: 12 }}>사이드</div>
                                                )}
                                                <div
                                                    style={{
                                                        fontSize: "1.5rem",
                                                        fontWeight: "800",
                                                        textAlign: "center",
                                                        marginTop: "6px",
                                                        marginBottom: "-2px",
                                                        lineHeight: 1,
                                                        width: "100%",
                                                        wordBreak: "keep-all",
                                                    }}
                                                >
                                                    {item.name}
                                                </div>
                                                <div style={{ fontSize: "1.2rem", marginTop: 2, opacity: 0.85, color: "#002e55" }}>
                                                    {sideBasePriceFromCatalog(item.name, catalogItems).toLocaleString()}원
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                {activeOptionButton === "drink-add" &&
                    selectedAdditionalDrink &&
                    selectedAdditionalDrink !== NONE_OPTION &&
                    !selectedAdditionalDrinkSize && (
                        <div
                            style={{
                                position: "fixed",
                                left: "50%",
                                top: "50%",
                                transform: "translate(-50%, -50%)",
                                width: "min(560px, calc(100vw - 32px))",
                                display: "grid",
                                gridTemplateColumns: "1fr",
                                gap: "16px",
                                alignItems: "stretch",
                                background: "#ffffff",
                                border: "1px solid #e5e5e5",
                                borderRadius: "18px",
                                padding: "35px",
                                boxShadow: "0 18px 40px rgba(0,0,0,0.18)",
                                zIndex: 120,
                            }}
                        >
                            <div
                                style={{
                                    background: "transparent",
                                    border: "none",
                                    borderRadius: 0,
                                    padding: 0,
                                    minHeight: 220,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    boxShadow: "none",
                                    overflow: "hidden",
                                    flexDirection: "column",
                                    gap: "12px",
                                }}
                            >
                                {(() => {
                                    const row = catalogItems.find((m) => m.name === selectedAdditionalDrink);
                                    const src = menuThumbImageSrc(row || { name: selectedAdditionalDrink });
                                    return src ? (
                                        <img
                                            src={src}
                                            alt="사이즈 선택"
                                            style={{
                                                width: "70%",
                                                height: "70%",
                                                objectFit: "contain",
                                                display: "block",
                                            }}
                                        />
                                    ) : (
                                        <div style={{ color: "#8aa0c5", fontWeight: 700 }}>음료 이미지</div>
                                    );
                                })()}
                                <div style={{ fontSize: "2.5rem", fontWeight: "800", color: "#111", textAlign: "center" }}>
                                    {selectedAdditionalDrink}
                                </div>
                            </div>
                            <div
                                style={{
                                    background: "transparent",
                                    border: "none",
                                    borderRadius: 0,
                                    padding: 0,
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 20,
                                    boxShadow: "none",
                                }}
                            >
                                <div style={{ fontSize: 0, fontWeight: "bold", textAlign: "left" }}>
                                    <span style={{ fontSize: "2rem" }}>사이즈를 선택하세요</span>
                                    {selectedAdditionalDrink} 사이즈를 선택하세요
                                </div>
                                {additionalDrinkSizeButtons.map((size) => (
                                    <button
                                        key={size.name}
                                        onClick={() => {
                                            setPendingAdditionalDrinkSize(size.name);
                                            setTimeout(() => {
                                                addAdditionalDrinkToCart(selectedAdditionalDrink, size.name);
                                                setPendingAdditionalDrinkSize("");
                                                setSelectedAdditionalDrink("");
                                                setSelectedAdditionalDrinkSize("");
                                                setActiveOptionButton("");
                                            }, 120);
                                        }}
                                        style={{
                                            height: "75px",
                                            fontSize: "1.5rem",
                                            fontWeight: "bold",
                                            backgroundColor: pendingAdditionalDrinkSize === size.name ? "#c8d8ea" : "#f5f8fc",
                                            color: "#000",
                                            border: pendingAdditionalDrinkSize === size.name ? "2px solid #002e55" : "2px solid #d9e3ef",
                                            borderRadius: "12px",
                                            cursor: "pointer",
                                            boxShadow:
                                                pendingAdditionalDrinkSize === size.name
                                                    ? "0 4px 10px rgba(0,0,0,0.12)"
                                                    : "0 2px 6px rgba(0,0,0,0.06)",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "space-between",
                                            padding: "0 20px",
                                        }}
                                    >
                                        <div>
                                            {size.name === "미디움" ? "중간 사이즈" : "큰 사이즈"}
                                        </div>
                                        <span style={{ fontWeight: 800, fontSize: 0 }}>
                                            <span style={{ fontSize: "1.3rem" }}>{size.price.toLocaleString()}원</span>
                                        </span>
                                    </button>
                                ))}
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsDrinkAddCancelButtonActive(true);
                                        setTimeout(() => {
                                            setSelectedAdditionalDrink("");
                                            setSelectedAdditionalDrinkSize("");
                                            setIsDrinkAddCancelButtonActive(false);
                                        }, 120);
                                    }}
                                    style={{
                                        width: "fit-content",
                                        alignSelf: "center",
                                        marginTop: "8px",
                                        padding: "14px 24px",
                                        backgroundColor: isDrinkAddCancelButtonActive ? "#fec315" : "#002e55",
                                        color: "#ffffff",
                                        borderRadius: "10px",
                                        fontSize: "1.5rem",
                                        fontWeight: "800",
                                        cursor: "pointer",
                                        boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
                                    }}
                                >
                                    취소하기
                                </button>
                            </div>
                        </div>
                    )}

                {activeOptionButton === "side-add" &&
                    selectedAdditionalSide &&
                    selectedAdditionalSide !== NONE_OPTION &&
                    !selectedAdditionalSideSize && (
                        <div
                            style={{
                                position: "fixed",
                                left: "50%",
                                top: "50%",
                                transform: "translate(-50%, -50%)",
                                width: "min(560px, calc(100vw - 32px))",
                                display: "grid",
                                gridTemplateColumns: "1fr",
                                gap: "16px",
                                alignItems: "stretch",
                                background: "#ffffff",
                                border: "1px solid #e5e5e5",
                                borderRadius: "18px",
                                padding: "35px",
                                boxShadow: "0 18px 40px rgba(0,0,0,0.18)",
                                zIndex: 120,
                            }}
                        >
                            <div
                                style={{
                                    background: "transparent",
                                    border: "none",
                                    borderRadius: 0,
                                    padding: 0,
                                    minHeight: 220,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    boxShadow: "none",
                                    overflow: "hidden",
                                    flexDirection: "column",
                                    gap: "12px",
                                }}
                            >
                                {(() => {
                                    const row = catalogItems.find((m) => m.name === selectedAdditionalSide);
                                    const src = menuThumbImageSrc(row || { name: selectedAdditionalSide });
                                    return src ? (
                                        <img
                                            src={src}
                                            alt="side-select"
                                            style={{
                                                width: "70%",
                                                height: "70%",
                                                objectFit: "contain",
                                                display: "block",
                                            }}
                                        />
                                    ) : (
                                        <div style={{ color: "#8aa0c5", fontWeight: 700 }}>side image</div>
                                    );
                                })()}
                                <div style={{ fontSize: "2.5rem", fontWeight: "800", color: "#111", textAlign: "center" }}>
                                    {selectedAdditionalSide}
                                </div>
                            </div>
                            <div
                                style={{
                                    background: "transparent",
                                    border: "none",
                                    borderRadius: 0,
                                    padding: 0,
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 20,
                                    boxShadow: "none",
                                }}
                            >
                                <div style={{ fontSize: "2rem", fontWeight: "bold", textAlign: "left" }}>
                                    사이즈를 선택하세요
                                </div>
                                {sideSizeOptions.map((size) => {
                                    const p = sideUnitPriceCatalog(selectedAdditionalSide, size.name, catalogItems);
                                    return (
                                        <button
                                            key={size.name}
                                            onClick={() => {
                                                setPendingAdditionalSideSize(size.name);
                                                setTimeout(() => {
                                                    addAdditionalSideToCart(selectedAdditionalSide, size.name);
                                                    setPendingAdditionalSideSize("");
                                                    setSelectedAdditionalSide("");
                                                    setSelectedAdditionalSideSize("");
                                                    setActiveOptionButton("");
                                                }, 120);
                                            }}
                                            style={{
                                                height: "75px",
                                                fontSize: "1.5rem",
                                                fontWeight: "bold",
                                                backgroundColor: pendingAdditionalSideSize === size.name ? "#c8d8ea" : "#f5f8fc",
                                                color: "#000",
                                                border: pendingAdditionalSideSize === size.name ? "2px solid #002e55" : "2px solid #d9e3ef",
                                                borderRadius: "12px",
                                                cursor: "pointer",
                                                boxShadow:
                                                    pendingAdditionalSideSize === size.name
                                                        ? "0 4px 10px rgba(0,0,0,0.12)"
                                                        : "0 2px 6px rgba(0,0,0,0.06)",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "space-between",
                                                padding: "0 20px",
                                            }}
                                        >
                                            <div>
                                                {size.name === "미디움" ? "중간 사이즈" : "라지 사이즈"}
                                            </div>
                                            <span style={{ fontWeight: 800, fontSize: 0 }}>
                                                <span style={{ fontSize: "1.3rem" }}>{p.toLocaleString()}원</span>
                                            </span>
                                        </button>
                                    );
                                })}
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsSideAddCancelButtonActive(true);
                                        setTimeout(() => {
                                            setSelectedAdditionalSide("");
                                            setSelectedAdditionalSideSize("");
                                            setIsSideAddCancelButtonActive(false);
                                        }, 120);
                                    }}
                                    style={{
                                        width: "fit-content",
                                        alignSelf: "center",
                                        marginTop: "8px",
                                        padding: "14px 24px",
                                        backgroundColor: isSideAddCancelButtonActive ? "#fec315" : "#002e55",
                                        color: "#ffffff",
                                        borderRadius: "10px",
                                        fontSize: "1.5rem",
                                        fontWeight: "800",
                                        cursor: "pointer",
                                        boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
                                    }}
                                >
                                    취소하기
                                </button>
                            </div>
                        </div>
                    )}
            </div>

            {false && <div
                style={{
                    flexShrink: 0,
                    height: "180px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    backgroundColor: "#fff",
                    overflow: "hidden",
                    transform: "translateY(-120px)",
                    marginBottom: "-120px",
                }}
            >
                <div
                    style={{
                        flex: 1,
                        width: "100%",
                        maxWidth: "720px",
                        background: "#f5f8fc",
                        borderTop: "2px solid #d9e3ef",
                        padding: "12px 24px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "20px",
                        overflow: "hidden",
                        minHeight: 0,
                    }}
                >
                    <div
                        style={{
                            flex: 1,
                            display: "flex",
                            gap: "12px",
                            overflowX: "auto",
                            overflowY: "hidden",
                            paddingRight: "20px",
                            minWidth: 0,
                        }}
                    >
                        {cartItems.length === 0 ? (
                            <div style={{ color: "#c8d8ea", fontSize: "34px" }}>담긴 상품이 없습니다</div>
                        ) : (
                            cartItems.map((it) => (
                                <div
                                    key={it.id}
                                    style={{
                                        minWidth: "160px",
                                        boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
                                        background: "#ffffff",
                                        border: "2px solid #d9e3ef",
                                        borderRadius: "6px",
                                        padding: "12px",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "8px",
                                        flexShrink: 0,
                                    }}
                                >
                                    <div
                                        style={{
                                            width: "80px",
                                            height: "80px",
                                            background: "#ffffff",
                                            borderRadius: "4px",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            flexShrink: 0,
                                        }}
                                    >
                                        {(() => {
                                            const src = cartItemImageSrc(it);
                                            return src ? (
                                                <img src={src} alt={it.name} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                                            ) : (
                                                <div style={{ fontSize: "10px", color: "#999" }}>이미지</div>
                                            );
                                        })()}
                                    </div>

                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: "700", fontSize: "20px", marginBottom: "4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                            {it.name}
                                        </div>
                                        <div style={{ display: "flex", alignItems: "center", gap: "8px", justifyContent: "space-between" }}>
                                            <div style={{ fontWeight: "700", fontSize: "20px", color: "#002e55" }}>
                                                {it.price.toLocaleString()}원
                                            </div>
                                            <button
                                                onClick={() => handleCartDeleteClick(it.id)}
                                                style={{
                                                    width: "24px",
                                                    height: "24px",
                                                    borderRadius: "50%",
                                                    border: "none",
                                                    background: activeCartDeleteButton === it.id ? "#fec315" : "#ff3b30",
                                                    color: "#ffffff",
                                                    cursor: "pointer",
                                                    fontSize: "20px",
                                                    fontWeight: "700",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                }}
                                            >
                                                ×
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "16px", flexShrink: 0, minWidth: "262px" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "20px" }}>
                            <div style={{ fontSize: "22px", fontWeight: "700", color: "#000000", whiteSpace: "nowrap" }}>
                                총 수량 | {cartItems.reduce((sum, it) => sum + it.qty, 0)}개
                            </div>
                            <button
                                onClick={handleClearCartClick}
                                disabled={cartItems.length === 0}
                                style={{
                                    width: "130px",
                                    height: "60px",
                                    borderRadius: "8px",
                                    border: "none",
                                    background: cartItems.length === 0 ? "#c8d8ea" : isClearCartButtonActive ? "#fec002" : "#002e55",
                                    color: "#ffffff",
                                    cursor: cartItems.length === 0 ? "not-allowed" : "pointer",
                                    fontSize: "24px",
                                    fontWeight: "700",
                                }}
                            >
                                전체 취소
                            </button>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "20px" }}>
                            <div style={{ fontSize: "22px", fontWeight: "700", color: "#000000", whiteSpace: "nowrap" }}>
                                총 금액 | {cartTotal.toLocaleString()}원
                            </div>
                            <button
                                onClick={handleOrderClick}
                                disabled={cartItems.length === 0}
                                style={{
                                    width: "130px",
                                    height: "60px",
                                    borderRadius: "8px",
                                    border: "none",
                                    background: cartItems.length === 0 ? "#c8d8ea" : isOrderButtonActive ? "#fec002" : "#ff3b30",
                                    color: "#ffffff",
                                    cursor: cartItems.length === 0 ? "not-allowed" : "pointer",
                                    fontSize: "24px",
                                    fontWeight: "700",
                                }}
                            >
                                결제하기
                            </button>
                        </div>
                    </div>
                </div>
            </div>}
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

