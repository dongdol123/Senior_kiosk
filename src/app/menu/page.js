"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { isTtsActive, speakKorean } from "../utils/speakKorean";
import { registerVoiceSession, stopVoiceSession } from "../utils/voiceSession";
import KioskAspectFrame from "../../components/KioskAspectFrame";
import KioskProgressBars from "../../components/KioskProgressBars";
import { getOrderFlowEntry, entryQuery, qrRequiresOrderTypeRedirect } from "../utils/orderFlowEntry";
import {
    STATIC_MENU,
    inferMenuCategory,
    mergeMenusFromApiResponse,
    menuThumbImageSrc,
    normalizeMenuKey,
} from "../utils/kioskMenuCatalog";

function menuItemMatchesCategory(item, selectedCategory) {
    return inferMenuCategory(item) === selectedCategory;
}

function isTapToAddSide(item) {
    return inferMenuCategory(item) === "side";
}

function isDrinkMenu(item) {
    return inferMenuCategory(item) === "drink";
}

function cartItemImageSrc(it) {
    if (it?.image) return it.image;
    const baseName =
        it?.type === "set" && Array.isArray(it?.items) && it.items.length > 0
            ? it.items[0]?.name || it?.name || ""
            : it?.name || "";
    const raw = baseName.replace(/\s+/g, "").toLowerCase();
    const n = raw.replace(/\(.*?\)/g, "");
    if (/에그|egg/.test(n)) return "/egg.png";
    if (/마늘/.test(n) && /불고기/.test(n) && /버거/.test(n)) return "/garlic_bulgogi.png";
    if (/칠리/.test(n) && /새우|shrimp/.test(n)) return "/chilli_shrimp.png";
    if (/크림|cream/.test(n) && /새우|shrimp/.test(n)) return "/cream_shrimp.png";
    if (/새우|shrimp/.test(n)) return "/egg.png";
    if (/베이컨|토마토/.test(n) && /버거/.test(n)) return "/bacon_bulgogi.png";
    if (/치즈/.test(n) && /불고기/.test(n) && /버거/.test(n)) return "/cheese.png";
    if (/더블/.test(n) && /버거/.test(n)) return "/double_bulgogi.png";
    if (/머쉬룸|머시룸/.test(n)) return "/mushroom_bulgogi.png";
    if (/치킨/.test(n) && /버거/.test(n)) return "/chicken.png";
    if (/치킨윙|윙/.test(n)) return "/wing.png";
    if (/해쉬|해시|hash/.test(n)) return "/hashbrown.png";
    if (/카페라떼|라떼|latte/.test(n)) return "/caffelatte.png";
    if (/아이스티|icetea/.test(n)) return "/icetea.png";
    if (/불고기/.test(n) && /버거/.test(n)) return "/bulgogi.png";
    if (/제로콜라/.test(n)) return "/zero_coke.png";
    if (/콜라/.test(n)) return "/coke.png";
    if (/제로사이다/.test(n)) return "/zero_cider.png";
    if (/사이다/.test(n)) return "/cider.png";
    if (/커피|아메리카노|americano/.test(n)) return "/americano.png";
    if (/감자튀김/.test(n)) return "/fries.png";
    if (/코울슬로|coleslaw|샐러드/.test(n)) return "/coleslaw.png";
    if (/치킨텐더|텐더/.test(n)) return "/tender_main.png";
    return null;
}

/** 새우 추천 팝업 전용: 화면에는 이름·요약·영양·알레르기 표시, 음성은 메뉴 요약(intro)만 */
const SHRIMP_MENU_DETAIL_BY_ID = {
    "bur-chili-shrimp": {
        image: "/chilli_shrimp.png",
        title: "칠리 새우버거",
        intro: "통새우 패티에 매콤한 스위트 칠리소스를 더한 버거입니다.",
        nutritionLines: [
            "칼로리: 약 538kcal",
            "단백질: 23g",
            "나트륨: 980mg",
            "당류: 14g",
        ],
        allergyLine: "알레르기 정보: 새우, 밀, 계란, 우유, 대두 포함",
        get voiceScript() {
            return this.intro;
        },
    },
    "bur-truffle-shrimp": {
        image: "/cream_shrimp.png",
        title: "크림 새우버거",
        intro: "새우 패티에 부드러운 갈릭 크림소스를 더한 새우버거입니다.",
        nutritionLines: [
            "칼로리: 약 612kcal",
            "단백질: 21g",
            "나트륨: 1,040mg",
            "당류: 11g",
        ],
        allergyLine: "알레르기 정보: 새우, 우유, 밀, 계란, 대두 포함",
        get voiceScript() {
            return this.intro;
        },
    },
};

function MenuPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const entry = getOrderFlowEntry(searchParams);
    const voiceOrderMode = entry === "voice" || entry === "qr";

    const [errorMessage, setErrorMessage] = useState("");
    const [isListening, setIsListening] = useState(false);
    const [assistantMessage, setAssistantMessage] = useState("");
    const [ordered, setOrdered] = useState(false);
    const [conversation, setConversation] = useState([]);
    const [lastUser, setLastUser] = useState("");
    const [isHomeButtonActive, setIsHomeButtonActive] = useState(false);
    const [isClearCartButtonActive, setIsClearCartButtonActive] = useState(false);
    const [isOrderButtonActive, setIsOrderButtonActive] = useState(false);
    const recognitionRef = useRef(null);
    const mountedRef = useRef(true);
    const shouldListenRef = useRef(true);
    const sessionIdRef = useRef(`session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
    const hasPlayedInitialGreetingRef = useRef(false);
    const cartItemsRef = useRef([]);
    const routerRef = useRef(null);
    const searchParamsRef = useRef(null);
    const isSpeakingRef = useRef(false); // 음성 안내 재생 중인지 추적
    const orderedRef = useRef(false);
    /** 음성 useEffect 안에서 갱신됨 — TTS 직후 인식 재시작에 사용 */
    const resumeSpeechRecognitionRef = useRef(() => {});

    useEffect(() => {
        orderedRef.current = ordered;
    }, [ordered]);

    useEffect(() => {
        if (qrRequiresOrderTypeRedirect(searchParams)) {
            router.replace("/qr-order");
        }
    }, [searchParams, router]);

    // cart state
    const [MENU_ITEMS, setMENU_ITEMS] = useState(STATIC_MENU);
    const [cartItems, setCartItems] = useState([]); // [{id, name, price, qty}]
    const [recommendedMenus, setRecommendedMenus] = useState([]);
    const [showRecommendation, setShowRecommendation] = useState(false);
    const [showShrimpRecommendation, setShowShrimpRecommendation] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedCategory, setSelectedCategory] = useState("burger"); // "burger", "drink", "side"
    const [activeMenuCardId, setActiveMenuCardId] = useState(null);
    const [selectedDrinkMenu, setSelectedDrinkMenu] = useState(null);
    const [activeDrinkSizeButton, setActiveDrinkSizeButton] = useState("");
    const [selectedSideMenu, setSelectedSideMenu] = useState(null);
    const [activeSideSizeButton, setActiveSideSizeButton] = useState("");
    const [activeCartAdjustButton, setActiveCartAdjustButton] = useState("");
    const [activeCartDeleteButton, setActiveCartDeleteButton] = useState("");
    const [isShrimpPopupCloseButtonActive, setIsShrimpPopupCloseButtonActive] = useState(false);
    const [shrimpMenuInfoId, setShrimpMenuInfoId] = useState(null);
    const [isShrimpInfoConfirmActive, setIsShrimpInfoConfirmActive] = useState(false);
    const [isShrimpInfoDeclineActive, setIsShrimpInfoDeclineActive] = useState(false);

    const showShrimpRecommendationRef = useRef(false);
    const shrimpMenuInfoIdRef = useRef(null);
    const menuItemsRef = useRef(MENU_ITEMS);
    const currentPageRef = useRef(1);
    const selectedCategoryRef = useRef("burger");

    useEffect(() => {
        showShrimpRecommendationRef.current = showShrimpRecommendation;
    }, [showShrimpRecommendation]);

    useEffect(() => {
        shrimpMenuInfoIdRef.current = shrimpMenuInfoId;
    }, [shrimpMenuInfoId]);

    useEffect(() => {
        menuItemsRef.current = MENU_ITEMS;
    }, [MENU_ITEMS]);

    useEffect(() => {
        currentPageRef.current = currentPage;
    }, [currentPage]);

    useEffect(() => {
        selectedCategoryRef.current = selectedCategory;
    }, [selectedCategory]);

    useEffect(() => {
        if (!showShrimpRecommendation) {
            setShrimpMenuInfoId(null);
        }
    }, [showShrimpRecommendation]);

    useEffect(() => {
        if (!shrimpMenuInfoId) return;
        const detail = SHRIMP_MENU_DETAIL_BY_ID[shrimpMenuInfoId];
        if (!detail?.voiceScript) return;
        let cancelled = false;
        (async () => {
            isSpeakingRef.current = true;
            try {
                await speakKorean(detail.voiceScript);
            } catch (e) {
                console.error("새우 메뉴 안내 음성 오류:", e);
            } finally {
                if (!cancelled) {
                    setTimeout(() => {
                        isSpeakingRef.current = false;
                        resumeSpeechRecognitionRef.current();
                    }, 50);
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [shrimpMenuInfoId]);

    useEffect(() => {
        const menuCategory = searchParams.get("menuCategory");
        const menuPageParam = parseInt(searchParams.get("menuPage") || "", 10);
        const shouldShowShrimpPopup = searchParams.get("showShrimpPopup") === "1";

        if (menuCategory === "burger" || menuCategory === "drink" || menuCategory === "side") {
            setSelectedCategory(menuCategory);
        }

        if (Number.isInteger(menuPageParam) && menuPageParam >= 1) {
            setCurrentPage(menuPageParam);
        }

        if (shouldShowShrimpPopup) {
            setShowShrimpRecommendation(true);
        }
    }, [searchParams]);

    function navigateTo(path) {
        stopVoiceSession(recognitionRef.current, shouldListenRef, isSpeakingRef);
        router.push(path);
    }

    // DB에서 메뉴 로드
    useEffect(() => {
        async function loadMenus() {
            try {
                const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/menu`);
                const data = await res.json();
                if (res.ok) {
                    const canonical = mergeMenusFromApiResponse(data);
                    if (canonical) setMENU_ITEMS(canonical);
                }
            } catch (e) {
                console.error('Failed to load menus:', e);
            }
        }
        loadMenus();

        // URL에서 장바구니 데이터 로드 (새우 추천 페이지에서 돌아올 때)
        const cartParam = searchParams.get("cart");
        if (cartParam) {
            try {
                const items = JSON.parse(decodeURIComponent(cartParam));
                setCartItems(items);
            } catch (e) {
                console.error('Failed to load cart from URL:', e);
            }
        }
    }, [searchParams]);

    // 키워드 기반 메뉴 추천
    function findRecommendedMenus(keyword) {
        const normalized = keyword.toLowerCase().replace(/\s/g, "");
        const matches = MENU_ITEMS.filter((item) =>
            item.keywords.some((kw) => normalized.includes(kw.toLowerCase()))
        );
        // 최대 2개 추천
        return matches.slice(0, 2);
    }

    function findShrimpMenus() {
        const shrimpPopupMenuIds = ["bur-chili-shrimp", "bur-truffle-shrimp"];
        const matchedMenus = MENU_ITEMS.filter((item) => {
            return shrimpPopupMenuIds.includes(item?.id);
        });

        if (matchedMenus.length > 0) {
            return matchedMenus;
        }

        return STATIC_MENU.filter((item) => shrimpPopupMenuIds.includes(item?.id));
    }

    function findMenuByTranscript(normalized) {
        let matchedMenu = MENU_ITEMS.find((item) => {
            const menuNameNormalized = item.name.replaceAll(" ", "").toLowerCase();
            if (normalized === menuNameNormalized || normalized.includes(menuNameNormalized)) {
                return true;
            }
            if (menuNameNormalized.includes(normalized) && normalized.length >= 2) {
                return true;
            }
            return false;
        });

        if (!matchedMenu) {
            matchedMenu = MENU_ITEMS.find((item) => {
                if (item.keywords && item.keywords.some((kw) => {
                    const kwNormalized = kw.replaceAll(" ", "").toLowerCase();
                    return normalized === kwNormalized || normalized.includes(kwNormalized);
                })) {
                    return true;
                }
                return false;
            });
        }

        if (!matchedMenu && normalized === "버거") {
            matchedMenu = MENU_ITEMS.find((item) => item.name.includes("버거"));
        }

        return matchedMenu;
    }

    async function addToCart(item) {
        setCartItems((prev) => {
            const idx = prev.findIndex((p) => p.id === item.id);
            if (idx >= 0) {
                const next = [...prev];
                next[idx] = { ...next[idx], qty: next[idx].qty + 1 };
                return next;
            }
            return [...prev, { ...item, qty: 1 }];
        });
        // 음성 인식 중지
        if (recognitionRef.current) {
            try {
                recognitionRef.current.stop();
            } catch (e) {}
        }
        isSpeakingRef.current = true;
        try {
            await speakKorean(`${item.name} 담았어요.`);
        } catch {
            /* ignore */
        }
        isSpeakingRef.current = false;
        resumeSpeechRecognitionRef.current();
    }

    async function removeFromCart(itemId) {
        let removedCompletely = false;
        let removedItemName = "";
        setCartItems((prev) => {
            const idx = prev.findIndex((p) => p.id === itemId);
            if (idx === -1) return prev;
            const target = prev[idx];
            removedItemName = target.name;
            if (target.qty <= 1) {
                removedCompletely = true;
                return prev.filter((p) => p.id !== itemId);
            }
            const next = [...prev];
            next[idx] = { ...target, qty: target.qty - 1 };
            return next;
        });
        // 음성 인식 중지
        if (recognitionRef.current) {
            try {
                recognitionRef.current.stop();
            } catch (e) {}
        }
        isSpeakingRef.current = true;
        try {
            if (removedCompletely) {
                await speakKorean(`${removedItemName}를 장바구니에서 비웠어요.`);
            } else {
                await speakKorean(`${removedItemName} 한 개 뺐어요.`);
            }
        } catch {
            /* ignore */
        }
        isSpeakingRef.current = false;
        resumeSpeechRecognitionRef.current();
    }

    async function deleteFromCart(itemId) {
        let deletedItemName = "";
        setCartItems((prev) => {
            const idx = prev.findIndex((p) => p.id === itemId);
            if (idx === -1) return prev;
            deletedItemName = prev[idx].name;
            return prev.filter((p) => p.id !== itemId);
        });
        // 음성 인식 중지
        if (recognitionRef.current) {
            try {
                recognitionRef.current.stop();
            } catch (e) {}
        }
        isSpeakingRef.current = true;
        try {
            await speakKorean(`${deletedItemName}를 장바구니에서 삭제했어요.`);
        } catch {
            /* ignore */
        }
        isSpeakingRef.current = false;
        resumeSpeechRecognitionRef.current();
    }

    async function clearCart() {
        setCartItems([]);
        // 음성 인식 중지
        if (recognitionRef.current) {
            try {
                recognitionRef.current.stop();
            } catch (e) {}
        }
        isSpeakingRef.current = true;
        try {
            await speakKorean("장바구니를 모두 비웠어요.");
        } catch {
            /* ignore */
        }
        isSpeakingRef.current = false;
        resumeSpeechRecognitionRef.current();
    }

    async function handleOrder() {
        // 최신 cartItems 값 사용
        const currentCartItems = cartItemsRef.current;
        if (currentCartItems.length === 0) {
            const msg = "장바구니가 비었어요.";
            setAssistantMessage(msg);
            // 음성 인식 중지
            if (recognitionRef.current) {
                try {
                    recognitionRef.current.stop();
                } catch (e) {}
            }
            isSpeakingRef.current = true;
            await speakKorean(msg);
            isSpeakingRef.current = false;
            resumeSpeechRecognitionRef.current();
            return;
        }
        const cartTotal = currentCartItems.reduce((sum, it) => sum + it.price * it.qty, 0);
        const cartData = encodeURIComponent(JSON.stringify(currentCartItems));
        const orderType = searchParamsRef.current?.get("orderType") || "takeout";
        if (routerRef.current) {
            const ent = getOrderFlowEntry(searchParamsRef.current);
            stopVoiceSession(recognitionRef.current, shouldListenRef, isSpeakingRef);
            routerRef.current.push(`/points?cart=${cartData}&total=${cartTotal}&orderType=${orderType}&${entryQuery(ent)}`);
        }
    }

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

    function handleMenuCardClick(menu) {
        setActiveMenuCardId(menu.id);
        setTimeout(() => {
            proceedMenuCardClick(menu);
        }, 120);
    }

    function proceedMenuCardClick(menu) {
        const name = menu.name;
        const cartData = encodeURIComponent(JSON.stringify(cartItems));
        const orderType = searchParams.get("orderType") || "takeout";
        const menuState = `menuPage=${currentPage}&menuCategory=${selectedCategory}`;

        if (isTapToAddSide(menu)) {
            setSelectedSideMenu(menu);
            return;
        }

        if (isDrinkMenu(menu)) {
            setSelectedDrinkMenu(menu);
            return;
        }

        navigateTo(`/menu-option?menuId=${menu.id}&menuName=${encodeURIComponent(name)}&price=${menu.price}&cart=${cartData}&orderType=${orderType}&${menuState}&${entryQuery(entry)}`);
    }

    function handleShrimpRecommendationSelect(menu) {
        setShowShrimpRecommendation(false);
        setActiveMenuCardId(null);
        proceedMenuCardClick(menu);
    }

    function handleCartAdjustClick(type, item) {
        const buttonKey = `${type}-${item.id}`;
        setActiveCartAdjustButton(buttonKey);
        setTimeout(() => {
            if (type === "minus") {
                removeFromCart(item.id);
            } else {
                addToCart(item);
            }
            setTimeout(() => {
                setActiveCartAdjustButton((current) => (current === buttonKey ? "" : current));
            }, 120);
        }, 120);
    }

    function handleCartDeleteClick(itemId) {
        setActiveCartDeleteButton(itemId);
        setTimeout(() => {
            deleteFromCart(itemId);
            setTimeout(() => {
                setActiveCartDeleteButton((current) => (current === itemId ? "" : current));
            }, 120);
        }, 120);
    }

    function addDrinkWithSize(menu, size) {
        const sizeDisplayName = size === "미디움" ? "중간" : "큰";
        const price = menu.price + (size === "라지" ? 500 : 0);
        const item = {
            ...menu,
            id: `${menu.id}_${size}`,
            name: `${menu.name}(${menu?.id === "side-wing" ? (size === "미디움" ? "6개" : "8개") : sizeDisplayName})`,
            price,
            type: "drink",
            size,
        };
        setCartItems((prev) => {
            const existingIndex = prev.findIndex((cartItem) => cartItem.id === item.id);
            if (existingIndex >= 0) {
                const next = [...prev];
                next[existingIndex] = {
                    ...next[existingIndex],
                    qty: (next[existingIndex].qty || 1) + 1,
                };
                return next;
            }
            return [...prev, { ...item, qty: 1 }];
        });
        setSelectedDrinkMenu(null);
        setActiveDrinkSizeButton("");
        setActiveMenuCardId(null);
    }

    function addSideWithSize(menu, size) {
        const sizeDisplayName = size === "미디움" ? "중간" : "큰";
        const price = menu.price + (size === "라지" ? 500 : 0);
        const item = {
            ...menu,
            id: `${menu.id}_${size}`,
            name: `${menu.name}(${menu?.id === "side-wing" ? (size === "미디움" ? "6개" : "8개") : sizeDisplayName})`,
            price,
            type: "side",
            size,
        };
        setCartItems((prev) => {
            const existingIndex = prev.findIndex((cartItem) => cartItem.id === item.id);
            if (existingIndex >= 0) {
                const next = [...prev];
                next[existingIndex] = {
                    ...next[existingIndex],
                    qty: (next[existingIndex].qty || 1) + 1,
                };
                return next;
            }
            return [...prev, { ...item, qty: 1 }];
        });
        setSelectedSideMenu(null);
        setActiveSideSizeButton("");
        setActiveMenuCardId(null);
    }

    const cartTotal = cartItems.reduce((sum, it) => sum + it.price * it.qty, 0);

    // cartItems와 router를 ref로 업데이트
    useEffect(() => {
        cartItemsRef.current = cartItems;
    }, [cartItems]);

    useEffect(() => {
        routerRef.current = router;
        searchParamsRef.current = searchParams;
    }, [router, searchParams]);

    // 여기부턴 그냥 주문하기

    useEffect(() => {
        mountedRef.current = true;
        shouldListenRef.current = true;
        hasPlayedInitialGreetingRef.current = false; // 컴포넌트가 마운트될 때마다 리셋
        
        // 음성 인식이 이미 실행 중이면 중지하고 재시작하여 인사말이 나오도록 함
        if (recognitionRef.current) {
            try {
                recognitionRef.current.stop();
            } catch (e) {
                console.log("기존 음성 인식 중지 시도:", e);
            }
        }

        // 이전 음성인식 정리
        if (typeof window !== "undefined") {
            try {
                if (window.speechSynthesis) {
                    window.speechSynthesis.cancel();
                }
            } catch (e) {
                console.log("SpeechSynthesis 정리 중 오류:", e);
            }
        }

        const SpeechRecognition =
            typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);
        if (!SpeechRecognition) {
            // QR·간편 모드 등: 터치만으로 주문 가능해야 하므로 음성 미지원이어도 계속 진행
            if (entry === "voice") {
                setErrorMessage("이 브라우저는 음성 인식을 지원하지 않습니다. 크롬을 권장합니다.");
            }
            shouldListenRef.current = false;
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = "ko-KR";
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        /** TTS·안내 플래그가 풀린 뒤 곧바로(짧은 간격으로 재시도) 마이크 인식 재개 */
        function scheduleResumeSpeechRecognition() {
            const tryOnce = (attempt) => {
                if (attempt > 120) return;
                if (!mountedRef.current || !shouldListenRef.current || orderedRef.current) return;
                if (isSpeakingRef.current || isTtsActive()) {
                    setTimeout(() => tryOnce(attempt + 1), 40);
                    return;
                }
                try {
                    recognition.start();
                } catch {
                    setTimeout(() => tryOnce(attempt + 1), 35);
                }
            };
            setTimeout(() => tryOnce(0), 10);
        }
        resumeSpeechRecognitionRef.current = scheduleResumeSpeechRecognition;

        recognition.onstart = () => {
            setIsListening(true);
        };
        recognition.onend = () => {
            setIsListening(false);
            if (!mountedRef.current || !shouldListenRef.current || orderedRef.current) return;
            scheduleResumeSpeechRecognition();
        };
        recognition.onerror = (event) => {
            // "aborted"와 "no-speech"는 정상적인 동작이므로 무시
            if (event.error !== "aborted" && event.error !== "no-speech") {
                setErrorMessage(`음성 인식 오류: ${event.error}`);
            }
            setIsListening(false);
            if (!mountedRef.current || !shouldListenRef.current || orderedRef.current) return;
            scheduleResumeSpeechRecognition();
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
            setLastUser(transcript);

            const normalized = transcript.replaceAll(" ", "").toLowerCase();
            console.log("🎤 음성 인식 결과:", transcript, "normalized:", normalized);

            const asksShrimpMenuExplain =
                /뭐야|뭐예요|뭔데|알려줘|알려|설명|어떤거|어떤메뉴|정보|뭐지|뭐죠|뭐임|궁금|뭔가요|뭐에요|어때/.test(normalized);
            const wantsChiliShrimpInfo =
                asksShrimpMenuExplain &&
                (/칠리|chili/.test(normalized) && /새우|shrimp|버거/.test(normalized));
            const wantsCreamShrimpInfo =
                asksShrimpMenuExplain &&
                (/크림|cream|트러플|truffle/.test(normalized) && /새우|shrimp|버거/.test(normalized));

            // 새우 추천 팝업: 메뉴 안내 / 안내 화면에서 선택
            if (showShrimpRecommendationRef.current) {
                if (shrimpMenuInfoIdRef.current) {
                    if (
                        normalized === "선택" ||
                        /이걸로할게|이걸로할래|이걸로주문|그걸로할게|그걸로할래|세트로|세트선택|세트로할게|선택할게|선택할래|이거선택|메뉴선택|좋아요|좋아|응그래|그래요|그래|맞아|맞아요|확인/.test(
                            normalized
                        )
                    ) {
                        try {
                            recognition.stop();
                        } catch {
                            /* ignore */
                        }
                        const id = shrimpMenuInfoIdRef.current;
                        const m = menuItemsRef.current.find((item) => item.id === id);
                        if (m && SHRIMP_MENU_DETAIL_BY_ID[id]) {
                            setShrimpMenuInfoId(null);
                            setShowShrimpRecommendation(false);
                            setActiveMenuCardId(m.id);
                            const cartData = encodeURIComponent(JSON.stringify(cartItemsRef.current));
                            const sp = searchParamsRef.current;
                            const orderType = sp?.get("orderType") || "takeout";
                            const menuState = `menuPage=${currentPageRef.current}&menuCategory=${selectedCategoryRef.current}`;
                            stopVoiceSession(recognitionRef.current, shouldListenRef, isSpeakingRef);
                            const path = `/menu-option?menuId=${m.id}&menuName=${encodeURIComponent(m.name)}&price=${m.price}&cart=${cartData}&orderType=${orderType}&${menuState}&${entryQuery(getOrderFlowEntry(sp))}`;
                            routerRef.current.push(path);
                        }
                        return;
                    }
                    if (
                        normalized === "뒤로가기" ||
                        /별로야|별로|별로에요|싫어|아니야|아니에요|아니|다시|취소|뒤로|돌아/.test(normalized)
                    ) {
                        try {
                            recognition.stop();
                        } catch {
                            /* ignore */
                        }
                        setShrimpMenuInfoId(null);
                        return;
                    }
                    return;
                } else if (wantsChiliShrimpInfo || wantsCreamShrimpInfo) {
                    try {
                        recognition.stop();
                    } catch {
                        /* ignore */
                    }
                    const id = wantsChiliShrimpInfo ? "bur-chili-shrimp" : "bur-truffle-shrimp";
                    if (!SHRIMP_MENU_DETAIL_BY_ID[id]) return;
                    setShowShrimpRecommendation(true);
                    setShrimpMenuInfoId(id);
                    const det = SHRIMP_MENU_DETAIL_BY_ID[id];
                    setAssistantMessage(`${det.title} 안내입니다. 화면을 확인해 주세요.`);
                    return;
                }
            } else if (wantsChiliShrimpInfo || wantsCreamShrimpInfo) {
                try {
                    recognition.stop();
                } catch {
                    /* ignore */
                }
                const id = wantsChiliShrimpInfo ? "bur-chili-shrimp" : "bur-truffle-shrimp";
                if (!SHRIMP_MENU_DETAIL_BY_ID[id]) return;
                setShowShrimpRecommendation(true);
                setShrimpMenuInfoId(id);
                const det = SHRIMP_MENU_DETAIL_BY_ID[id];
                setAssistantMessage(`${det.title} 안내입니다. 화면을 확인해 주세요.`);
                return;
            }

            // 새우 추천 요청 - 메뉴 매칭보다 먼저 (그러지 않으면 "새우" 키워드 때문에 에그버거로 잡힘)
            const shrimpRecommendPattern = /새우.*(추천|메뉴|들어간|보여|알려|뭐|어떤|있)|(들어간|메뉴|추천|보여|알려).*새우/;
            if (shrimpRecommendPattern.test(normalized)) {
                try { recognition.stop(); } catch { }
                const shrimpMenus = findShrimpMenus();
                if (shrimpMenus.length > 0) {
                    setShowShrimpRecommendation(true);
                    const msg = "새우 메뉴를 추천해드릴게요. 원하시는 메뉴를 선택해주세요.";
                    setAssistantMessage(msg);
                    isSpeakingRef.current = true;
                    void speakKorean(msg)
                        .catch(() => {})
                        .finally(() => {
                            isSpeakingRef.current = false;
                            resumeSpeechRecognitionRef.current();
                        });
                }
                return;
            }

            // 메뉴 이름 직접 말하기 - 가장 먼저 체크 (부가 설명 없이 바로 담기)
            let matchedMenu = null;

            // 0. 변종 우선 매칭 (변종 키워드를 일반(불고기버거/에그버거)보다 먼저 잡기)
            //    - 불고기 계열: 치즈/더블/베이컨/버섯·머쉬룸·머시룸·mushroom/마늘·garlic
            //    - 새우 계열: 칠리/크림·cream
            const findById = (id) => MENU_ITEMS.find((m) => m.id === id);
            const isBulgogiContext = /불고기|bulgogi/.test(normalized);
            const isShrimpContext = /새우|shrimp|에그|egg/.test(normalized);
            if (isBulgogiContext) {
                if (/치즈|cheese/.test(normalized)) matchedMenu = findById("bur-mozza");
                else if (/더블|double/.test(normalized)) matchedMenu = findById("bur-triple");
                else if (/베이컨|bacon/.test(normalized)) matchedMenu = findById("bur-bacon");
                else if (/버섯|머쉬룸|머시룸|mushroom/.test(normalized)) matchedMenu = findById("bur-mush");
                else if (/마늘|galic|garlic/.test(normalized)) matchedMenu = findById("bur-garlic");
                else if (/^(불고기|불고기버거|불버거|bulgogi)$/.test(normalized) || /불고기버거/.test(normalized)) {
                    matchedMenu = findById("bur-bulgogi");
                }
            } else if (isShrimpContext) {
                if (/칠리|chili/.test(normalized)) matchedMenu = findById("bur-chili-shrimp");
                else if (/크림|cream/.test(normalized)) matchedMenu = findById("bur-truffle-shrimp");
                else if (/^(새우|새우버거|shrimp|에그|에그버거|egg)$/.test(normalized) || /새우버거|에그버거/.test(normalized)) {
                    matchedMenu = findById("bur-shrimp");
                }
            }
            // 치즈 단독 발화 시(불고기 컨텍스트 없이) 치즈 불고기버거로 매칭
            if (!matchedMenu && /^(치즈|치즈버거|치즈불고기|치즈불고기버거|cheese)$/.test(normalized)) {
                matchedMenu = findById("bur-mozza");
            }

            // 1. 정확한 메뉴 이름 매칭 (긴 이름부터 우선해서 변종이 먼저 잡히도록)
            if (!matchedMenu) {
                const sortedByName = [...MENU_ITEMS].sort((a, b) => {
                    const an = (a.name || "").replace(/\s+/g, "").length;
                    const bn = (b.name || "").replace(/\s+/g, "").length;
                    return bn - an;
                });
                matchedMenu = sortedByName.find((item) => {
                    const menuNameNormalized = item.name.replaceAll(" ", "").toLowerCase();
                    // 정확히 일치하거나 메뉴 이름이 사용자 입력에 포함되어 있는지 확인
                    if (normalized === menuNameNormalized || normalized.includes(menuNameNormalized)) {
                        return true;
                    }
                    // 사용자 입력이 메뉴 이름에 포함되어 있는지 확인 (예: "불고기" -> "불고기버거")
                    if (menuNameNormalized.includes(normalized) && normalized.length >= 2) {
                        return true;
                    }
                    return false;
                });
            }

            // 2. 키워드로 매칭 (예: "불고기" -> "불고기버거")
            //    단, 이미 변종 키워드(치즈/더블/베이컨/버섯/마늘/칠리/크림)가 발화된 경우엔
            //    기본 "불고기버거"/"에그버거"로 빠지지 않도록 가드
            if (!matchedMenu) {
                const hasBulgogiVariantWord = /치즈|cheese|더블|double|베이컨|bacon|버섯|머쉬룸|머시룸|mushroom|마늘|garlic|galic/.test(normalized);
                const hasShrimpVariantWord = /칠리|chili|크림|cream/.test(normalized);
                matchedMenu = MENU_ITEMS.find((item) => {
                    // 변종 단어가 같이 들어왔는데 후보가 기본 불고기버거/에그버거면 스킵
                    if (item.id === "bur-bulgogi" && hasBulgogiVariantWord) return false;
                    if (item.id === "bur-shrimp" && hasShrimpVariantWord) return false;
                    if (item.keywords && item.keywords.some((kw) => {
                        const kwNormalized = kw.replaceAll(" ", "").toLowerCase();
                        return normalized === kwNormalized || normalized.includes(kwNormalized);
                    })) {
                        return true;
                    }
                    return false;
                });
            }

            // 3. "버거"만 말했을 때 첫 번째 버거 메뉴 선택
            if (!matchedMenu && normalized === "버거") {
                matchedMenu = MENU_ITEMS.find((item) => item.name.includes("버거"));
            }

            if (matchedMenu) {
                console.log("✅ 메뉴 매칭됨:", matchedMenu.name, "사용자 입력:", transcript);
                
                // 음성 인식 중지 (페이지 이동 전)
                try { 
                    recognition.stop(); 
                } catch (e) {
                    console.log("음성 인식 중지 오류:", e);
                }
                
                setActiveMenuCardId(matchedMenu.id);
                setTimeout(() => {
                    proceedMenuCardClick(matchedMenu);
                }, 120);
                return;

                if (isTapToAddSide(matchedMenu)) {
                    addToCart(matchedMenu);
                    // 장바구니에 담은 후 음성 인식 재시작
                    setTimeout(() => {
                        if (mountedRef.current && shouldListenRef.current && !ordered) {
                            try { 
                                recognition.start(); 
                            } catch (e) {
                                console.log("음성 인식 재시작 오류:", e);
                            }
                        }
                    }, 500);
                    return;
                }

                // 버거(에그버거 포함)나 음료는 옵션 선택 페이지로 이동
                const cartData = encodeURIComponent(JSON.stringify(cartItems));
                const orderType = searchParams.get("orderType") || "takeout";
                console.log("🚀 menu-option으로 이동:", matchedMenu.name, "menuId:", matchedMenu.id);
                
                // 음성 안내
                // 음성 인식 중지
                try {
                    recognition.stop();
                } catch (e) {}
                const msg = `${matchedMenu.name} 옵션을 선택해주세요.`;
                setAssistantMessage(msg);
                isSpeakingRef.current = true;
                void speakKorean(msg)
                    .catch((err) => console.error("음성 안내 오류:", err))
                    .finally(() => {
                        isSpeakingRef.current = false;
                        resumeSpeechRecognitionRef.current();
                    });
                
                // 약간의 딜레이 후 페이지 이동
                setTimeout(() => {
                    navigateTo(`/menu-option?menuId=${matchedMenu.id}&menuName=${encodeURIComponent(matchedMenu.name)}&price=${matchedMenu.price}&cart=${cartData}&orderType=${orderType}&menuPage=${currentPage}&menuCategory=${selectedCategory}&${entryQuery(entry)}`);
                }, 800);
                return;
            }

            const directPaymentPattern = /이대로\s*주문\s*해\s*줘|이대로\s*결제\s*해\s*줘|지금\s*결제\s*해\s*줘|바로\s*결제|결제\s*페이지\s*로|그대로\s*결제|지금\s*바로\s*결제|주문\s*마치고\s*결제/;
            if (directPaymentPattern.test(normalized)) {
                const currentCartItems = cartItemsRef.current;
                if (currentCartItems.length === 0) {
                    const msg = "장바구니가 비었어요.";
                    setAssistantMessage(msg);
                    isSpeakingRef.current = true;
                    await speakKorean(msg);
                    isSpeakingRef.current = false;
                    resumeSpeechRecognitionRef.current();
                    return;
                }
                const cartTotal = currentCartItems.reduce((sum, it) => sum + it.price * it.qty, 0);
                const cartData = encodeURIComponent(JSON.stringify(currentCartItems));
                const orderType = searchParams.get("orderType") || "takeout";
                stopVoiceSession(recognitionRef.current, shouldListenRef, isSpeakingRef);
                router.push(`/points?cart=${cartData}&total=${cartTotal}&orderType=${orderType}&${entryQuery(entry)}`);
                return;
            }

            // 주문하기 명령 감지
            const orderPattern = /주문|결제|주문해|주문해줘|주문할래|주문하겠어|주문진행|주문할게|이걸로주문|이걸로할게|결제해|결제해줘|결제할래|결제하겠어|결제할게|결제진행|이대로주문|이대로주문할게|이대로주문할래|이대로결제|그대로주문|그대로결제/;
            if (orderPattern.test(normalized)) {
                console.log("✅ 주문 명령 인식됨:", transcript, "normalized:", normalized);
                // 음성 인식 먼저 중지
                try { 
                    recognition.stop(); 
                } catch (e) {
                    console.error("음성 인식 중지 오류:", e);
                }
                shouldListenRef.current = false; // 재시작 방지
                
                // 주문 처리
                await handleOrder();
                return;
            }

            // 새우 추천 요청 감지 - "새우 추천", "새우 메뉴 추천", "새우 들어간 메뉴 추천해줘" 같은 맥락만
            const shrimpRecommendPatternLegacy = /새우.*(추천|메뉴|들어간|보여|알려|뭐|어떤|있)/;
            if (shrimpRecommendPatternLegacy.test(normalized)) {
                try { recognition.stop(); } catch { }
                const shrimpMenus = findShrimpMenus();
                if (shrimpMenus.length > 0) {
                    setShowShrimpRecommendation(true);
                    const msg = "새우 메뉴를 추천해드릴게요. 원하시는 메뉴를 선택해주세요.";
                    setAssistantMessage(msg);
                    isSpeakingRef.current = true;
                    void speakKorean(msg)
                        .catch(() => {})
                        .finally(() => {
                            isSpeakingRef.current = false;
                            resumeSpeechRecognitionRef.current();
                        });
                }
                return;
            }

            // 키워드 기반 추천 감지 (예: "불고기 뭐있지" 등)
            const recommendationPattern = /(불고기|치즈|크림).*(뭐|어떤|있|추천|보여|알려)/;
            if (recommendationPattern.test(transcript)) {
                const recommended = findRecommendedMenus(transcript);
                if (recommended.length > 0) {
                    setRecommendedMenus(recommended);
                    setShowRecommendation(true);
                    // 음성 인식 중지
                    try {
                        recognition.stop();
                    } catch (e) {}
                    const msg = `${recommended.map(m => m.name).join(", ")}를 추천해드릴게요.`;
                    setAssistantMessage(msg);
                    isSpeakingRef.current = true;
                    await speakKorean(msg);
                    isSpeakingRef.current = false;
                    resumeSpeechRecognitionRef.current();
                    return;
                }
            }

            const isMenu1 = /메뉴?1|일?번|첫(번째)?|메뉴일|원번/.test(normalized);

            if (isMenu1) {
                setOrdered(true);
                const msg = "메뉴 1 주문을 완료했어요. 결제하시겠어요?";
                setAssistantMessage(msg);
                setConversation((prev) => [...prev, { role: "user", content: transcript }, { role: "assistant", content: msg }]);
                isSpeakingRef.current = true;
                await speakKorean(msg);
                isSpeakingRef.current = false;
                try { recognition.stop(); } catch { }
                return;
            }

            const newConversation = [...conversation, { role: "user", content: transcript }];
            setConversation(newConversation);
            try {
                // 음성 인식 중지 (API 호출 중에는 음성 인식 중지)
                try { 
                    recognition.stop(); 
                } catch (e) {
                    console.log("음성 인식 중지 오류:", e);
                }
                
                const res = await fetch("/api/voice-order", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ messages: newConversation, sessionId: sessionIdRef.current }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error || "API 오류");
                const reply = data?.reply || "죄송해요, 다시 말씀해 주시겠어요?";
                setAssistantMessage(reply);
                setConversation((prev) => [...prev, { role: "assistant", content: reply }]);
                isSpeakingRef.current = true;
                await speakKorean(reply);
                isSpeakingRef.current = false;
                resumeSpeechRecognitionRef.current();
            } catch (e) {
                setAssistantMessage("");
                setErrorMessage(e.message || "네트워크 오류가 발생했습니다.");
                isSpeakingRef.current = false;
                resumeSpeechRecognitionRef.current();
            }
        };

        recognitionRef.current = recognition;
        registerVoiceSession(recognition);

        if (voiceOrderMode) {
            const startVoiceFlow = async () => {
                if (!mountedRef.current || !shouldListenRef.current) return;
                // 한 주문 흐름(포장/매장 선택 ~ 결제완료)에서 1회만 안내되도록 sessionStorage 사용
                let alreadyPlayed = false;
                try {
                    if (typeof window !== "undefined") {
                        alreadyPlayed = window.sessionStorage.getItem("menuGreetingPlayed") === "1";
                    }
                } catch { }
                if (!hasPlayedInitialGreetingRef.current && !alreadyPlayed) {
                    hasPlayedInitialGreetingRef.current = true;
                    try {
                        if (typeof window !== "undefined") {
                            window.sessionStorage.setItem("menuGreetingPlayed", "1");
                        }
                    } catch { }
                    const greeting = "무엇을 주문하시겠어요?";
                    setAssistantMessage(greeting);
                    isSpeakingRef.current = true;
                    try {
                        await speakKorean(greeting);
                    } catch (err) {
                        console.error("초기 음성 안내 오류:", err);
                    } finally {
                        isSpeakingRef.current = false;
                    }
                } else {
                    hasPlayedInitialGreetingRef.current = true;
                }

                if (!mountedRef.current || !shouldListenRef.current || orderedRef.current) return;
                scheduleResumeSpeechRecognition();
            };
            startVoiceFlow();
        } else {
            shouldListenRef.current = false;
        }

        const handleVisibility = () => {
            if (document.hidden) {
                shouldListenRef.current = false;
                try { recognition.stop(); } catch { }
                try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch { }
            }
        };
        const handlePageHide = () => {
            shouldListenRef.current = false;
            try { recognition.stop(); } catch { }
            try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch { }
        };
        document.addEventListener("visibilitychange", handleVisibility);
        window.addEventListener("pagehide", handlePageHide);

        return () => {
            resumeSpeechRecognitionRef.current = () => {};
            mountedRef.current = false;
            shouldListenRef.current = false;
            try { recognition.onresult = null; } catch { }
            try { recognition.onend = null; } catch { }
            try { recognition.onerror = null; } catch { }
            try { recognition.onstart = null; } catch { }
            try { recognition.stop(); } catch { }
            try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch { }
            document.removeEventListener("visibilitychange", handleVisibility);
            window.removeEventListener("pagehide", handlePageHide);
        };
    }, [ordered, entry, searchParams, voiceOrderMode]);

    const shell = (
        <main
            style={{
                display: "flex",
                flexDirection: "column",
                height: entry === "qr" ? "100%" : "100vh",
                flex: entry === "qr" ? 1 : undefined,
                minHeight: entry === "qr" ? 0 : undefined,
                overflow: "hidden",
                backgroundColor: "#f9f9f9",
            }}
        >
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
                {/* 왼쪽: 처음으로 버튼 */}
                <button
                    onClick={() => {
                        setIsHomeButtonActive(true);
                        shouldListenRef.current = false;
                        setTimeout(() => {
                            try { recognitionRef.current && recognitionRef.current.stop(); } catch { }
                            try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch { }
                            router.push(entry === "qr" ? "/qr-order" : "/");
                        }, 120);
                    }}
                    style={{
                        backgroundColor: isHomeButtonActive ? "#fec315" : "#002e55",
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
                        src="/home.png"
                        alt=""
                        aria-hidden="true"
                        style={{ width: "22px", height: "22px", objectFit: "contain" }}
                    />
                    처음으로
                </button>

                {/* 중앙: 연두햄버거 제목 */}
                <div style={{ 
                    position: "absolute",
                    left: "50%",
                    transform: "translateX(-50%)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                }}>
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

                {/* 오른쪽: 음성 주문 중 배지 */}
                <div
                    style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "8px",
                        backgroundColor: voiceOrderMode ? "#e6f4ea" : "#eee",
                        color: voiceOrderMode ? "#1e7a39" : "#777",
                        border: voiceOrderMode ? "1px solid #bfe3ca" : "1px solid #ddd",
                        borderRadius: "999px",
                        padding: "8px 14px",
                        fontWeight: "bold",
                        opacity: voiceOrderMode ? (isListening ? 1 : 0.85) : 1,
                    }}
                >
                    <span style={{ width: 10, height: 10, borderRadius: "50%", opacity: 1, background: voiceOrderMode ? "#34c759" : "#bbb" }} />
                    {voiceOrderMode ? "음성 주문 중" : "간편 모드"}
                </div>
            </div>

            <KioskProgressBars activeIndex={1} />

            {/* 카테고리 탭 - 상단 가로 배치 */}
            <div
                style={{
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "stretch",
                    gap: "12px",
                    padding: "10px 16px 14px 16px",
                    backgroundColor: "#fff",
                    borderBottom: "none",
                }}
            >
                <button
                    onClick={() => {
                        setSelectedCategory("burger");
                        setCurrentPage(1);
                    }}
                    style={{
                        flex: 1,
                        padding: "14px 18px",
                        borderRadius: "16px",
                        border: selectedCategory === "burger" ? "2px solid #002e55" : "2px solid #d9e3ef",
                        backgroundColor: selectedCategory === "burger" ? "#c8d8ea" : "#f5f8fc",
                        color: "#000",
                        fontSize: "26px",
                        fontWeight: selectedCategory === "burger" ? 700 : 500,
                        cursor: "pointer",
                        transition: "all 0.2s",
                        boxShadow: selectedCategory === "burger" ? "0 4px 10px rgba(0,0,0,0.12)" : "0 2px 6px rgba(0,0,0,0.06)",
                    }}
                >
                    버거
                </button>
                <button
                    onClick={() => {
                        setSelectedCategory("drink");
                        setCurrentPage(1);
                    }}
                    style={{
                        flex: 1,
                        padding: "14px 18px",
                        borderRadius: "16px",
                        border: selectedCategory === "drink" ? "2px solid #002e55" : "2px solid #d9e3ef",
                        backgroundColor: selectedCategory === "drink" ? "#c8d8ea" : "#f5f8fc",
                        color: "#000",
                        fontSize: "26px",
                        fontWeight: selectedCategory === "drink" ? 700 : 500,
                        cursor: "pointer",
                        transition: "all 0.2s",
                        boxShadow: selectedCategory === "drink" ? "0 4px 10px rgba(0,0,0,0.12)" : "0 2px 6px rgba(0,0,0,0.06)",
                    }}
                >
                    음료
                </button>
                <button
                    onClick={() => {
                        setSelectedCategory("side");
                        setCurrentPage(1);
                    }}
                    style={{
                        flex: 1,
                        padding: "14px 18px",
                        borderRadius: "16px",
                        border: selectedCategory === "side" ? "2px solid #002e55" : "2px solid #d9e3ef",
                        backgroundColor: selectedCategory === "side" ? "#c8d8ea" : "#f5f8fc",
                        color: "#000",
                        fontSize: "26px",
                        fontWeight: selectedCategory === "side" ? 700 : 500,
                        cursor: "pointer",
                        transition: "all 0.2s",
                        boxShadow: selectedCategory === "side" ? "0 4px 10px rgba(0,0,0,0.12)" : "0 2px 6px rgba(0,0,0,0.06)",
                    }}
                >
                    사이드
                </button>
            </div>

            {/* 메뉴 그리드 영역 - flex: 1로 남은 공간 차지 */}
            <div
                style={{
                    flex: 1,
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                    width: "100%",
                    padding: "0",
                    backgroundColor: "#fff",
                    minHeight: 0,
                }}
            >
                {/* 메뉴 그리드 영역 */}
                <div
                    style={{
                        flex: 1,
                        overflow: "hidden",
                        display: "flex",
                        flexDirection: "column",
                        width: "100%",
                        padding: "14px 32px 4px 32px",
                        minHeight: 0,
                    }}
                >
                    {/* 메뉴 2 x 2 - 최대 크기로 배치, 정사각형 유지 */}
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                            gridTemplateRows: "repeat(2, minmax(0, 1fr))",
                            gap: "24px",
                            alignItems: "stretch",
                            width: "100%",
                            flex: 1,
                            minHeight: "350px",
                        }}
                    >
                        {(() => {
                            // 카테고리별 메뉴 필터링
                            const filteredItems = MENU_ITEMS.filter((item) =>
                                menuItemMatchesCategory(item, selectedCategory)
                            );

                            const itemsPerPage = 4;
                            const startIdx = (currentPage - 1) * itemsPerPage;
                            const endIdx = startIdx + itemsPerPage;
                            const currentItems = filteredItems.slice(startIdx, endIdx);
                            const placeholdersNeeded = Math.max(0, itemsPerPage - currentItems.length);

                        return (
                            <>
                                {currentItems.map((m) => (
                                    <div
                                        key={m.id}
                                        onClick={() => handleMenuCardClick(m)}
                                        style={{
                                            display: "flex",
                                            flexDirection: "column",
                                            gap: 0,
                                            background: "#ffffff",
                                            border: activeMenuCardId === m.id ? "2px solid #002e55" : "2px solid #d9e3ef",
                                            borderRadius: 24,
                                            boxShadow:
                                                activeMenuCardId === m.id
                                                    ? "0 4px 10px rgba(0,0,0,0.12)"
                                                     : "0 2px 6px rgba(0,0,0,0.06)",
                                            padding: 0,
                                            minHeight: 0,
                                            overflow: "hidden",
                                            width: "100%",
                                            height: "100%",
                                            aspectRatio: "1 / 1", // 정사각형 카드
                                            cursor: "pointer",
                                            transition: "all 0.2s",
                                        }}
                                    >
                                        {/* 이미지 영역 - 최대 크기 */}
                                        <div
                                            style={{
                                                flex: 1,
                                                minHeight: 0,
                                                background: "transparent",
                                                borderRadius: "24px 24px 0 0",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                overflow: "hidden",
                                                padding: "0",
                                            }}
                                        >
                                            {(() => {
                                                const src = menuThumbImageSrc(m);
                                                return src ? (
                                                    <img
                                                        src={src}
                                                        alt={m.name}
                                                        style={{
                                                            width: "100%",
                                                            height: "100%",
                                                            objectFit: "contain",
                                                            display: "block",
                                                        }}
                                                    />
                                                ) : (
                                                    <div style={{ color: "#8aa0c5", fontWeight: 700 }}>
                                                        메뉴 이미지
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                        {/* 하단 정보 영역 - 이름, 가격, 버튼 (최소화) */}
                                        <div style={{ 
                                            display: "flex", 
                                            flexDirection: "column", 
                                            gap: 2, 
                                            flexShrink: 0,
                                            padding: "14px 20px 18px 20px",
                                            background: "#fff",
                                            borderRadius: "0 0 24px 24px",
                                        }}>
                                            <div style={{ fontWeight: 800, fontSize: 32, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#000", lineHeight: "1.1" }}>{m.name}</div>
                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                                <div style={{ color: "#002e55", fontSize: 28, fontWeight: 800 }}>{m.price.toLocaleString()}원</div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {Array.from({ length: placeholdersNeeded }).map((_, idx) => (
                                    <div
                                        key={`placeholder-${idx}`}
                                        style={{
                                            display: "flex",
                                            flexDirection: "column",
                                            gap: 6,
                                            background: "#ffffff",
                                            border: "none",
                                            borderRadius: 12,
                                            padding: 10,
                                            minHeight: 0,
                                            alignItems: "center",
                                            justifyContent: "center",
                                            color: "transparent",
                                            fontWeight: 700,
                                            fontSize: 12,
                                        }}
                                    >
                                        &nbsp;
                                    </div>
                                ))}
                            </>
                        );
                    })()}
                </div>

                    {/* 페이지네이션 - 아래로 이동 */}
                    {(() => {
                        // 카테고리별 메뉴 필터링
                        const filteredItems = MENU_ITEMS.filter((item) =>
                            menuItemMatchesCategory(item, selectedCategory)
                        );
                        const itemsPerPage = 4;
                        const totalPages = Math.ceil(Math.max(filteredItems.length, 4) / itemsPerPage);
                    return (
                        <div
                            style={{
                                flexShrink: 0,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                padding: "12px 0px 16px 0px",
                                marginTop: "8px",
                                position: "relative",
                            }}
                        >
                            {/* 왼쪽: 이전 버튼 */}
                            <button
                                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                                disabled={currentPage === 1}
                                style={{
                                    padding: "8px 18px",
                                    borderRadius: "4px",
                                    border: "none",
                                    background: currentPage === 1 ? "#c8d8ea" : "#002e55",
                                    color: "#ffffff",
                                    cursor: currentPage === 1 ? "not-allowed" : "pointer",
                                    fontSize: "18px",
                                    fontWeight: "600",
                                    transition: "all 0.2s",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "8px",
                                }}
                                onMouseEnter={(e) => {
                                    if (currentPage !== 1) {
                                        e.currentTarget.style.background = "#002e55";
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (currentPage !== 1) {
                                        e.currentTarget.style.background = "#002e55";
                                    }
                                }}
                            >
                                <span style={{ fontSize: "14px" }}>◀</span>
                                이전
                            </button>

                            {/* 가운데: 페이지 번호 */}
                            <div style={{ 
                                fontSize: "20px", 
                                fontWeight: "600", 
                                color: "#333",
                                position: "absolute",
                                left: "50%",
                                transform: "translateX(-50%)",
                            }}>
                                {currentPage} / {totalPages}
                            </div>

                            {/* 오른쪽: 다음 버튼 */}
                            <button
                                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                                disabled={currentPage === totalPages}
                                style={{
                                    padding: "8px 18px",
                                    borderRadius: "4px",
                                    border: "none",
                                    background: currentPage === totalPages ? "#c8d8ea" : "#002e55",
                                    color: "#ffffff",
                                    cursor: currentPage === totalPages ? "not-allowed" : "pointer",
                                    fontSize: "18px",
                                    fontWeight: "600",
                                    transition: "all 0.2s",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "8px",
                                }}
                                onMouseEnter={(e) => {
                                    if (currentPage !== totalPages) {
                                        e.currentTarget.style.background = "#002e55";
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (currentPage !== totalPages) {
                                        e.currentTarget.style.background = "#002e55";
                                    }
                                }}
                            >
                                다음
                                <span style={{ fontSize: "14px" }}>▶</span>
                            </button>
                        </div>
                    );
                })()}
                </div>
            </div>

            {/* 하단 장바구니 영역 - 고정 높이 */}
            <div
                style={{
                    flexShrink: 0,
                    height: "180px",
                    display: "flex",
                    flexDirection: "column",
                    backgroundColor: "#fff",
                    borderTop: "2px solid #d9e3ef",
                    overflow: "hidden",
                }}
            >
                {/* Order Summary Bar - 고정 검정색 바 */}
                {/* Cart and Action Buttons Area */}
                <div
                    style={{
                        flex: 1,
                        background: "#f5f8fc",
                        padding: "12px 24px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "20px",
                        overflow: "hidden",
                        minHeight: 0,
                    }}
                >
                {/* 왼쪽: 장바구니 아이템 */}
                <div style={{ 
                    flex: 1, 
                    display: "flex", 
                    gap: "12px", 
                    overflowX: "auto",
                    overflowY: "hidden",
                    paddingRight: "20px",
                    minWidth: 0,
                }}>
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
                                {/* 메뉴 이미지 */}
                                <div style={{
                                    width: "80px",
                                    height: "80px",
                                    background: "#ffffff",
                                    borderRadius: "4px",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    flexShrink: 0,
                                }}>
                                    {(() => {
                                        const src = cartItemImageSrc(it);
                                        return src ? (
                                            <img src={src} alt={it.name} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                                        ) : (
                                            <div style={{ fontSize: "10px", color: "#999" }}>이미지</div>
                                        );
                                    })()}
                                </div>
                                
                                {/* 메뉴 정보 */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: "700", fontSize: "20px", marginBottom: "4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                        {it.name}
                                    </div>
                                    <div style={{ fontWeight: "700", fontSize: "20px", marginBottom: "6px", color: "#002e55" }}>
                                        {it.price.toLocaleString()}원
                                    </div>
                                    {/* 수량 조절 */}
                                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                        <button 
                                            onClick={() => handleCartAdjustClick("minus", it)} 
                                            style={{ 
                                                width: "24px", 
                                                height: "24px", 
                                                borderRadius: "3px", 
                                                border: "none", 
                                                background: activeCartAdjustButton === `minus-${it.id}` ? "#fec315" : "#002e55", 
                                                color: "#ffffff", 
                                                cursor: "pointer",
                                                fontSize: "20px",
                                                fontWeight: "700",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                transition: "background-color 0.12s ease",
                                            }}
                                        >
                                            −
                                        </button>
                                        <span style={{ fontSize: "20px", fontWeight: "700", minWidth: "24px", textAlign: "center" }}>
                                            {it.qty}
                                        </span>
                                        <button 
                                            onClick={() => handleCartAdjustClick("plus", it)} 
                                            style={{ 
                                                width: "24px", 
                                                height: "24px", 
                                                borderRadius: "3px", 
                                                border: "none", 
                                                background: activeCartAdjustButton === `plus-${it.id}` ? "#fec315" : "#002e55", 
                                                color: "#ffffff", 
                                                cursor: "pointer",
                                                fontSize: "20px",
                                                fontWeight: "700",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                transition: "background-color 0.12s ease",
                                            }}
                                        >
                                            +
                                        </button>
                                        <button 
                                            onClick={() => handleCartDeleteClick(it.id)} 
                                            style={{ 
                                                marginLeft: "4px",
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
                                                transition: "background-color 0.12s ease",
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

                {/* 오른쪽: 전체 취소 및 결제하기 버튼 */}
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
                                transition: "all 0.2s",
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
                                transition: "all 0.2s",
                            }}
                        >
                            결제하기
                        </button>
                    </div>
                </div>
                </div>
            </div>

            {/* 추천 메뉴 모달 */}
            {showRecommendation && recommendedMenus.length > 0 && (
                <div
                    style={{
                        position: "fixed",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: "rgba(0,0,0,0.5)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 1000,
                    }}
                    onClick={() => setShowRecommendation(false)}
                >
                    <div
                        style={{
                            background: "#fff",
                            borderRadius: 16,
                            padding: 24,
                            maxWidth: 500,
                            width: "90%",
                            boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                            <h2 style={{ fontSize: "1.5rem", fontWeight: "bold" }}>추천 메뉴</h2>
                            <button
                                onClick={() => setShowRecommendation(false)}
                                style={{
                                    background: "transparent",
                                    border: "none",
                                    fontSize: "1.5rem",
                                    cursor: "pointer",
                                    color: "#666",
                                }}
                            >
                                ×
                            </button>
                        </div>

                        <div style={{ display: "grid", gap: 16 }}>
                            {recommendedMenus.map((menu) => (
                                <div
                                    key={menu.id}
                                    style={{
                                        display: "flex",
                                        gap: 12,
                                        padding: 16,
                                        border: "2px solid #1e7a39",
                                        borderRadius: 12,
                                        background: "#f0f9f4",
                                    }}
                                >
                                    <div style={{ width: 80, height: 80, background: "#f3f3f3", border: "1px dashed #ddd", borderRadius: 8 }} />
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 700, fontSize: "1.1rem", marginBottom: 4 }}>{menu.name}</div>
                                        <div style={{ color: "#002e55", marginBottom: 12 }}>{menu.price.toLocaleString()}원</div>
                                        <button
                                            onClick={() => {
                                                addToCart(menu);
                                                setShowRecommendation(false);
                                            }}
                                            style={{
                                                background: "#1e7a39",
                                                color: "#fff",
                                                border: "none",
                                                borderRadius: 8,
                                                padding: "8px 16px",
                                                cursor: "pointer",
                                                fontWeight: 600,
                                            }}
                                        >
                                            담기
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {showShrimpRecommendation && findShrimpMenus().length > 0 && (
                <div
                    style={{
                        position: "fixed",
                        inset: 0,
                        background: "rgba(0,0,0,0.52)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 1100,
                        padding: 24,
                    }}
                    onClick={() => {
                        if (shrimpMenuInfoId) {
                            setShrimpMenuInfoId(null);
                        } else {
                            setShowShrimpRecommendation(false);
                        }
                    }}
                >
                    <div
                        style={{
                            width: "min(960px, 100%)",
                            background: "#f5f8fc",
                            borderRadius: 24,
                            padding: "28px",
                            border: "2px solid #d9e3ef",
                            boxShadow: "0 24px 60px rgba(0, 46, 85, 0.22)",
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: 16,
                                marginBottom: 24,
                            }}
                        >
                            <div style={{ textAlign: "center" }}>
                                <h2 style={{ fontSize: "2.5rem", fontWeight: 800, color: "#000000", margin: 0 }}>
                                    새우 메뉴 추천
                                </h2>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setIsShrimpPopupCloseButtonActive(true);
                                    setTimeout(() => {
                                        setShowShrimpRecommendation(false);
                                        setShrimpMenuInfoId(null);
                                        setIsShrimpPopupCloseButtonActive(false);
                                    }, 120);
                                }}
                                style={{
                                    padding: "12px 18px",
                                    backgroundColor: isShrimpPopupCloseButtonActive ? "#fec315" : "#002e55",
                                    color: "#fff",
                                    border: "none",
                                    borderRadius: "10px",
                                    cursor: "pointer",
                                    fontSize: "1.5rem",
                                    fontWeight: "700",
                                }}
                            >
                                닫기
                            </button>
                        </div>

                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                                gap: 18,
                            }}
                        >
                            {findShrimpMenus().map((menu) => (
                                <div
                                    key={menu.id}
                                    style={{
                                        border: activeMenuCardId === menu.id ? "2px solid #002e55" : "2px solid #d9e3ef",
                                        borderRadius: 22,
                                        background: "#ffffff",
                                        padding: 18,
                                        textAlign: "center",
                                        boxShadow:
                                            activeMenuCardId === menu.id
                                                ? "0 4px 10px rgba(0,0,0,0.12)"
                                                : "0 2px 6px rgba(0,0,0,0.06)",
                                        transition: "all 0.2s",
                                        display: "flex",
                                        flexDirection: "column",
                                    }}
                                >
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setActiveMenuCardId(menu.id);
                                            setTimeout(() => {
                                                handleShrimpRecommendationSelect(menu);
                                            }, 120);
                                        }}
                                        style={{
                                            border: "none",
                                            background: "transparent",
                                            padding: 0,
                                            cursor: "pointer",
                                            textAlign: "center",
                                            width: "100%",
                                        }}
                                    >
                                        <div
                                            style={{
                                                height: 250,
                                                borderRadius: 18,
                                                background: "#ffffff",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                marginBottom: 16,
                                                overflow: "hidden",
                                            }}
                                        >
                                            <img
                                                src={menuThumbImageSrc(menu) || "/egg.png"}
                                                alt={menu.name}
                                                style={{
                                                    width: "100%",
                                                    height: "100%",
                                                    objectFit: "contain",
                                                    display: "block",
                                                }}
                                            />
                                        </div>
                                        <div style={{ fontSize: "2.2rem", fontWeight: 800, color: "#000000", marginBottom: 10 }}>
                                            {menu.name}
                                        </div>
                                        <div style={{ fontSize: "1.9rem", color: "#002e55", fontWeight: 800, marginBottom: 10 }}>
                                            {menu.price.toLocaleString()}원
                                        </div>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShrimpMenuInfoId(menu.id)}
                                        style={{
                                            marginTop: "auto",
                                            padding: "10px 14px",
                                            borderRadius: 10,
                                            border: "2px solid #002e55",
                                            background: "#fff",
                                            color: "#002e55",
                                            fontSize: "1.25rem",
                                            fontWeight: 700,
                                            cursor: "pointer",
                                        }}
                                    >
                                        메뉴 안내
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {showShrimpRecommendation && shrimpMenuInfoId && SHRIMP_MENU_DETAIL_BY_ID[shrimpMenuInfoId] && (
                <div
                    style={{
                        position: "fixed",
                        inset: 0,
                        background: "rgba(0,0,0,0.55)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 1150,
                        padding: 24,
                    }}
                    onClick={() => setShrimpMenuInfoId(null)}
                >
                    <div
                        style={{
                            width: "min(960px, 100%)",
                            background: "#f5f8fc",
                            borderRadius: 24,
                            padding: "28px",
                            border: "2px solid #d9e3ef",
                            boxShadow: "0 24px 60px rgba(0, 46, 85, 0.22)",
                            maxHeight: "min(90vh, 900px)",
                            overflow: "auto",
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: 16,
                                marginBottom: 20,
                            }}
                        >
                            <h2 style={{ fontSize: "2.2rem", fontWeight: 800, color: "#000000", margin: 0 }}>
                                메뉴 정보 안내
                            </h2>
                            <button
                                type="button"
                                onClick={() => setShrimpMenuInfoId(null)}
                                style={{
                                    padding: "12px 18px",
                                    backgroundColor: "#002e55",
                                    color: "#fff",
                                    border: "none",
                                    borderRadius: "10px",
                                    cursor: "pointer",
                                    fontSize: "1.35rem",
                                    fontWeight: "700",
                                }}
                            >
                                닫기
                            </button>
                        </div>
                        <div
                            style={{
                                display: "flex",
                                flexDirection: "row",
                                flexWrap: "wrap",
                                gap: 24,
                                alignItems: "stretch",
                            }}
                        >
                            <div
                                style={{
                                    flex: "1 1 280px",
                                    minHeight: 260,
                                    borderRadius: 18,
                                    background: "#ffffff",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    padding: 16,
                                    border: "1px solid #d9e3ef",
                                }}
                            >
                                <img
                                    src={SHRIMP_MENU_DETAIL_BY_ID[shrimpMenuInfoId].image}
                                    alt={SHRIMP_MENU_DETAIL_BY_ID[shrimpMenuInfoId].title}
                                    style={{
                                        width: "100%",
                                        maxWidth: 420,
                                        height: "auto",
                                        maxHeight: 320,
                                        objectFit: "contain",
                                        display: "block",
                                    }}
                                />
                            </div>
                            <div style={{ flex: "1.2 1 320px", minWidth: 0 }}>
                                <div style={{ fontSize: "2rem", fontWeight: 800, color: "#000", marginBottom: 12 }}>
                                    {SHRIMP_MENU_DETAIL_BY_ID[shrimpMenuInfoId].title}
                                </div>
                                <p style={{ fontSize: "1.45rem", lineHeight: 1.55, color: "#1a1a1a", margin: "0 0 16px" }}>
                                    {SHRIMP_MENU_DETAIL_BY_ID[shrimpMenuInfoId].intro}
                                </p>
                                <ul
                                    style={{
                                        margin: "0 0 16px",
                                        paddingLeft: 22,
                                        fontSize: "1.25rem",
                                        lineHeight: 1.65,
                                        color: "#002e55",
                                    }}
                                >
                                    {SHRIMP_MENU_DETAIL_BY_ID[shrimpMenuInfoId].nutritionLines.map((line) => (
                                        <li key={line}>{line}</li>
                                    ))}
                                </ul>
                                <p style={{ fontSize: "1.25rem", lineHeight: 1.55, color: "#333", margin: 0 }}>
                                    {SHRIMP_MENU_DETAIL_BY_ID[shrimpMenuInfoId].allergyLine}
                                </p>
                            </div>
                        </div>
                        <div
                            style={{
                                display: "flex",
                                flexWrap: "wrap",
                                gap: 14,
                                marginTop: 28,
                                justifyContent: "center",
                            }}
                        >
                            <button
                                type="button"
                                onClick={() => {
                                    setIsShrimpInfoDeclineActive(true);
                                    setTimeout(() => {
                                        setShrimpMenuInfoId(null);
                                        setIsShrimpInfoDeclineActive(false);
                                    }, 120);
                                }}
                                style={{
                                    padding: "14px 28px",
                                    borderRadius: 12,
                                    border: "2px solid #002e55",
                                    background: isShrimpInfoDeclineActive ? "#fec315" : "#fff",
                                    color: "#002e55",
                                    fontSize: "1.5rem",
                                    fontWeight: 800,
                                    cursor: "pointer",
                                    minWidth: 160,
                                }}
                            >
                                뒤로가기
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    const menu = MENU_ITEMS.find((m) => m.id === shrimpMenuInfoId);
                                    if (!menu) return;
                                    setIsShrimpInfoConfirmActive(true);
                                    setTimeout(() => {
                                        handleShrimpRecommendationSelect(menu);
                                        setIsShrimpInfoConfirmActive(false);
                                    }, 120);
                                }}
                                style={{
                                    padding: "14px 28px",
                                    borderRadius: 12,
                                    border: "none",
                                    background: isShrimpInfoConfirmActive ? "#fec315" : "#002e55",
                                    color: "#fff",
                                    fontSize: "1.5rem",
                                    fontWeight: 800,
                                    cursor: "pointer",
                                    minWidth: 160,
                                }}
                            >
                                선택
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {selectedDrinkMenu && (
                <div
                    style={{
                        position: "fixed",
                        inset: 0,
                        background: "rgba(0,0,0,0.35)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 1200,
                    }}
                    onClick={() => {
                        setSelectedDrinkMenu(null);
                        setActiveDrinkSizeButton("");
                        setActiveMenuCardId(null);
                    }}
                >
                    <div
                        style={{
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
                        }}
                        onClick={(e) => e.stopPropagation()}
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
                                const src = menuThumbImageSrc(selectedDrinkMenu);
                                return src ? (
                                    <img
                                        src={src}
                                        alt={selectedDrinkMenu.name}
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
                            <div style={{ fontSize: "3rem", fontWeight: "800", color: "#111", textAlign: "center" }}>
                                {selectedDrinkMenu.name}
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
                            <div style={{ fontSize: "2.4rem", fontWeight: "bold", textAlign: "left" }}>
                                사이즈를 선택하세요
                            </div>
                            {[
                                { name: "미디움", price: selectedDrinkMenu.price, label: "중간 사이즈" },
                                { name: "라지", price: selectedDrinkMenu.price + 500, label: "큰 사이즈" },
                            ].map((size) => (
                                <button
                                    key={size.name}
                                    onClick={() => {
                                        setActiveDrinkSizeButton(size.name);
                                        setTimeout(() => {
                                            addDrinkWithSize(selectedDrinkMenu, size.name);
                                        }, 120);
                                    }}
                                    style={{
                                        height: "75px",
                                        fontSize: "1.7rem",
                                        fontWeight: "bold",
                                        backgroundColor: activeDrinkSizeButton === size.name ? "#c8d8ea" : "#f5f8fc",
                                        color: "#000",
                                        border: activeDrinkSizeButton === size.name ? "2px solid #002e55" : "2px solid #d9e3ef",
                                        borderRadius: "12px",
                                        cursor: "pointer",
                                        boxShadow:
                                            activeDrinkSizeButton === size.name
                                                ? "0 4px 10px rgba(0,0,0,0.12)"
                                                : "0 2px 6px rgba(0,0,0,0.06)",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        padding: "0 20px",
                                    }}
                                >
                                    <div style={{ fontWeight: 700, lineHeight: 1.2 }}>{size.label}</div>
                                    <span style={{ fontWeight: 800, fontSize: "1.5rem", color: "#002e55" }}>{size.price.toLocaleString()}원</span>
                                </button>
                            ))}
                            <button
                                type="button"
                                onClick={() => {
                                    setSelectedDrinkMenu(null);
                                    setActiveDrinkSizeButton("");
                                    setActiveMenuCardId(null);
                                }}
                                style={{
                                    width: "fit-content",
                                    alignSelf: "center",
                                    marginTop: "8px",
                                    padding: "14px 24px",
                                    backgroundColor: "#002e55",
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
                </div>
            )}

            {selectedSideMenu && (
                <div
                    style={{
                        position: "fixed",
                        inset: 0,
                        backgroundColor: "rgba(0, 0, 0, 0.35)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "16px",
                        zIndex: 1200,
                    }}
                    onClick={() => {
                        setSelectedSideMenu(null);
                        setActiveSideSizeButton("");
                        setActiveMenuCardId(null);
                    }}
                >
                    <div
                        style={{
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
                        }}
                        onClick={(e) => e.stopPropagation()}
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
                                const src = menuThumbImageSrc(selectedSideMenu);
                                return src ? (
                                    <img
                                        src={src}
                                        alt={selectedSideMenu.name}
                                        style={{
                                            width: "70%",
                                            height: "70%",
                                            objectFit: "contain",
                                            display: "block",
                                        }}
                                    />
                                ) : null;
                            })()}
                            <div style={{ fontSize: "3rem", fontWeight: "800", color: "#111", textAlign: "center" }}>
                                {selectedSideMenu.name}
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
                            <div style={{ fontSize: "2.4rem", fontWeight: "bold", textAlign: "left" }}>
                                사이즈를 선택하세요
                            </div>
                            {[
                                selectedSideMenu?.id === "side-wing"
                                    ? { name: "미디움", price: selectedSideMenu.price, label: "6개" }
                                    : { name: "미디움", price: selectedSideMenu.price, label: "중간 사이즈" },
                                selectedSideMenu?.id === "side-wing"
                                    ? { name: "라지", price: selectedSideMenu.price + 500, label: "8개" }
                                    : { name: "라지", price: selectedSideMenu.price + 500, label: "큰 사이즈" },
                            ].map((size) => (
                                <button
                                    key={size.name}
                                    onClick={() => {
                                        setActiveSideSizeButton(size.name);
                                        setTimeout(() => {
                                            addSideWithSize(selectedSideMenu, size.name);
                                        }, 120);
                                    }}
                                    style={{
                                        height: "75px",
                                        fontSize: "1.7rem",
                                        fontWeight: "bold",
                                        backgroundColor: activeSideSizeButton === size.name ? "#c8d8ea" : "#f5f8fc",
                                        color: "#000",
                                        border: activeSideSizeButton === size.name ? "2px solid #002e55" : "2px solid #d9e3ef",
                                        borderRadius: "12px",
                                        cursor: "pointer",
                                        boxShadow:
                                            activeSideSizeButton === size.name
                                                ? "0 4px 10px rgba(0,0,0,0.12)"
                                                : "0 2px 6px rgba(0,0,0,0.06)",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        padding: "0 20px",
                                    }}
                                >
                                    <div style={{ fontWeight: 700, lineHeight: 1.2 }}>{size.label}</div>
                                    <span style={{ fontWeight: 800, fontSize: "1.5rem", color: "#002e55" }}>{size.price.toLocaleString()}원</span>
                                </button>
                            ))}
                            <button
                                type="button"
                                onClick={() => {
                                    setSelectedSideMenu(null);
                                    setActiveSideSizeButton("");
                                    setActiveMenuCardId(null);
                                }}
                                style={{
                                    width: "fit-content",
                                    alignSelf: "center",
                                    marginTop: "8px",
                                    padding: "14px 24px",
                                    backgroundColor: "#002e55",
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
                </div>
            )}

        </main>
    );
    return entry === "qr" ? <KioskAspectFrame>{shell}</KioskAspectFrame> : shell;
}

export default function MenuPage() {
    return (
        <Suspense fallback={<main style={{ minHeight: "100vh", backgroundColor: "#f9f9f9" }} />}>
            <MenuPageContent />
        </Suspense>
    );
}


