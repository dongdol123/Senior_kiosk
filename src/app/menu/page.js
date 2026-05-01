"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { isTtsActive, speakKorean } from "../utils/speakKorean";
import { registerVoiceSession, stopVoiceSession } from "../utils/voiceSession";
import KioskAspectFrame from "../../components/KioskAspectFrame";
import { getOrderFlowEntry, entryQuery, qrRequiresOrderTypeRedirect } from "../utils/orderFlowEntry";

function normalizeMenuKey(name) {
    return (name || "").replace(/\s+/g, "").toLowerCase();
}

/** 키오스크 기본 메뉴(가격·이미지·카테고리). API와 병합 시 이름 기준으로 매칭됩니다. */
const STATIC_MENU = [
    {
        id: "bur-bacon",
        name: "베이컨 디럭스 버거",
        price: 4600,
        category: "burger",
        image: "/tomato_bur.png",
        keywords: ["베이컨", "디럭스", "bacon", "deluxe", "토마토"],
    },
    {
        id: "bur-mozza",
        name: "모짜렐라 치즈 불고기 버거",
        price: 4800,
        category: "burger",
        image: "/mozza_bulbur.png",
        keywords: ["모짜렐라", "모짜", "불고기", "치즈"],
    },
    {
        id: "bur-triple",
        name: "트리플 불고기 버거",
        price: 5500,
        category: "burger",
        image: "/triple_bur.png",
        keywords: ["트리플", "triple"],
    },
    {
        id: "bur-mush",
        name: "머쉬룸 버거",
        price: 6000,
        category: "burger",
        image: "/merss.png",
        keywords: ["머쉬룸", "머시룸", "mushroom"],
    },
    {
        id: "side-wing",
        name: "치킨윙 4개",
        price: 4000,
        category: "side",
        image: "/wing.png",
        keywords: ["치킨윙", "윙", "wing"],
    },
    {
        id: "side-hash",
        name: "해쉬브라운",
        price: 2500,
        category: "side",
        image: "/hash.png",
        keywords: ["해쉬", "해시", "hash", "브라운", "해쉬브라운"],
    },
    {
        id: "drink-latte",
        name: "카페라떼",
        price: 2500,
        category: "drink",
        image: "/latte.png",
        keywords: ["카페라떼", "라떼", "latte", "카페"],
    },
    {
        id: "drink-icedtea",
        name: "아이스티",
        price: 2500,
        category: "drink",
        image: "/icetea.png",
        keywords: ["아이스티", "티", "iced", "icetea", "ice tea"],
    },
];

function inferMenuCategory(item) {
    if (item?.category) return item.category;
    const n = normalizeMenuKey(item?.name);
    if (/버거|burger/.test(n)) return "burger";
    if (/카페라떼|라떼|아이스티|icetea|icedtea/.test(n)) return "drink";
    if (/치킨윙|해쉬브라운|해시브라운/.test(n)) return "side";
    return "";
}

function menuItemMatchesCategory(item, selectedCategory) {
    return inferMenuCategory(item) === selectedCategory;
}

function isTapToAddSide(item) {
    return inferMenuCategory(item) === "side";
}

function menuGridImageSrc(m) {
    if (m?.image) return m.image;
    const n = normalizeMenuKey(m?.name);
    if (/칠리/.test(n)) return "/C_srp.png";
    if (/트러플/.test(n)) return "/T_srp.png";
    if (/버거/.test(n)) return "/burger.png";
    if (/콜라|제로콜라/.test(n)) return "/coke_main.png";
    if (/사이다/.test(n)) return "/cider_main.png";
    if (/커피/.test(n)) return "/coffee_main.png";
    if (/감자튀김/.test(n)) return "/french_fries_main.png";
    if (/샐러드/.test(n)) return "/salad_main.png";
    if (/치킨텐더/.test(n)) return "/tender_main.png";
    return null;
}

function cartItemImageSrc(it) {
    if (it?.image) return it.image;
    const raw = (it?.name || "").replace(/\s+/g, "").toLowerCase();
    const n = raw.replace(/\(.*?\)/g, "");
    if (/베이컨|디럭스|토마토/.test(n) && /버거/.test(n)) return "/tomato_bur.png";
    if (/모짜렐라|모짜/.test(n) && /버거/.test(n)) return "/mozza_bulbur.png";
    if (/트리플/.test(n) && /버거/.test(n)) return "/triple_bur.png";
    if (/머쉬룸|머시룸/.test(n)) return "/merss.png";
    if (/치킨윙|윙/.test(n)) return "/wing.png";
    if (/해쉬|해시|hash/.test(n)) return "/hash.png";
    if (/카페라떼|라떼|latte/.test(n)) return "/latte.png";
    if (/아이스티|icetea/.test(n)) return "/icetea.png";
    if (/불고기/.test(n) && /버거/.test(n)) return "/burger.png";
    if (/콜라|제로콜라/.test(n)) return "/coke_main.png";
    if (/사이다/.test(n)) return "/cider_main.png";
    if (/커피/.test(n)) return "/coffee_main.png";
    if (/감자튀김/.test(n)) return "/french_fries_main.png";
    if (/샐러드/.test(n)) return "/salad_main.png";
    if (/치킨텐더|텐더/.test(n)) return "/tender_main.png";
    return null;
}

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
    const recognitionRef = useRef(null);
    const restartingRef = useRef(false);
    const mountedRef = useRef(true);
    const shouldListenRef = useRef(true);
    const sessionIdRef = useRef(`session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
    const hasPlayedInitialGreetingRef = useRef(false);
    const cartItemsRef = useRef([]);
    const routerRef = useRef(null);
    const searchParamsRef = useRef(null);
    const isSpeakingRef = useRef(false); // 음성 안내 재생 중인지 추적

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
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedCategory, setSelectedCategory] = useState("burger"); // "burger", "drink", "side"

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
                if (res.ok && data.menus && data.menus.length > 0) {
                    const uniqueByName = new Map();
                    data.menus.forEach((item) => {
                        if (!item?.name) return;
                        const key = normalizeMenuKey(item.name);
                        if (!uniqueByName.has(key)) uniqueByName.set(key, item);
                    });

                    const staticByName = new Map(STATIC_MENU.map((m) => [normalizeMenuKey(m.name), m]));

                    const canonical = Array.from(uniqueByName.values()).map((item) => {
                        const st = staticByName.get(normalizeMenuKey(item.name));
                        return {
                            ...item,
                            id: st?.id ?? item.id,
                            price: st?.price ?? item.price,
                            image: st?.image ?? item.image,
                            category: st?.category ?? inferMenuCategory(item),
                            keywords:
                                st?.keywords?.length ? st.keywords : item.keywords ?? [],
                        };
                    });

                    const existingNames = new Set(canonical.map((m) => normalizeMenuKey(m.name)));
                    STATIC_MENU.forEach((item) => {
                        if (!existingNames.has(normalizeMenuKey(item.name))) {
                            canonical.push({ ...item });
                        }
                    });

                    setMENU_ITEMS(canonical);
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
        } catch { }
        setTimeout(() => { 
            isSpeakingRef.current = false;
            // 음성 인식 재시작
            if (mountedRef.current && shouldListenRef.current && !ordered) {
                setTimeout(() => {
                    if (recognitionRef.current && mountedRef.current && shouldListenRef.current && !ordered) {
                        try {
                            recognitionRef.current.start();
                        } catch (e) {}
                        }
                }, 2000);
            }
        }, 1000);
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
        } catch { }
        setTimeout(() => { 
            isSpeakingRef.current = false;
            // 음성 인식 재시작
            if (mountedRef.current && shouldListenRef.current && !ordered) {
                setTimeout(() => {
                    if (recognitionRef.current && mountedRef.current && shouldListenRef.current && !ordered) {
                        try {
                            recognitionRef.current.start();
                        } catch (e) {}
                    }
                }, 2000);
            }
        }, 1000);
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
        } catch { }
        setTimeout(() => { 
            isSpeakingRef.current = false;
            // 음성 인식 재시작
            if (mountedRef.current && shouldListenRef.current && !ordered) {
                setTimeout(() => {
                    if (recognitionRef.current && mountedRef.current && shouldListenRef.current && !ordered) {
                        try {
                            recognitionRef.current.start();
                        } catch (e) {}
                    }
                }, 2000);
            }
        }, 1000);
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
        try { await speakKorean("장바구니를 모두 비웠어요."); } catch { }
        setTimeout(() => { 
            isSpeakingRef.current = false;
            // 음성 인식 재시작
            if (mountedRef.current && shouldListenRef.current && !ordered) {
                setTimeout(() => {
                    if (recognitionRef.current && mountedRef.current && shouldListenRef.current && !ordered) {
                        try {
                            recognitionRef.current.start();
                        } catch (e) {}
                    }
                }, 2000);
            }
        }, 1000);
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
            setTimeout(() => { 
                isSpeakingRef.current = false;
                // 음성 인식 재시작
                if (mountedRef.current && shouldListenRef.current && !ordered) {
                    setTimeout(() => {
                        if (recognitionRef.current && mountedRef.current && shouldListenRef.current && !ordered) {
                            try {
                                recognitionRef.current.start();
                            } catch (e) {}
                        }
                    }, 2000);
                }
            }, 1000);
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

    function handleMenuCardClick(menu) {
        const name = menu.name;
        const cartData = encodeURIComponent(JSON.stringify(cartItems));
        const orderType = searchParams.get("orderType") || "takeout";

        if (isTapToAddSide(menu)) {
            addToCart(menu);
            return;
        }

        navigateTo(`/menu-option?menuId=${menu.id}&menuName=${encodeURIComponent(name)}&price=${menu.price}&cart=${cartData}&orderType=${orderType}&${entryQuery(entry)}`);
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

        recognition.onstart = () => {
            setIsListening(true);
        };
        recognition.onend = () => {
            setIsListening(false);
            // 자동 재시작(메뉴1 주문 완료 전까지 지속 듣기)
            // 음성 안내 재생 중이어도 일정 시간 후 재시작 시도
            if (mountedRef.current && shouldListenRef.current && !ordered && !restartingRef.current) {
                restartingRef.current = true;
                const delay = isSpeakingRef.current ? 2000 : 250; // 음성 안내 중이면 더 긴 딜레이
                setTimeout(() => {
                    if (!mountedRef.current || !shouldListenRef.current || ordered) {
                        restartingRef.current = false;
                        return;
                    }
                    // isSpeakingRef가 여전히 true면 더 기다림
                    if (isSpeakingRef.current) {
                        restartingRef.current = false;
                        // 다시 시도
                        setTimeout(() => {
                            if (mountedRef.current && shouldListenRef.current && !ordered && !restartingRef.current) {
                                restartingRef.current = true;
                                try { 
                                    recognition.start(); 
                                    restartingRef.current = false;
                                } catch (e) {
                                    restartingRef.current = false;
                                    // 재시작 실패 시 다시 시도
                                    setTimeout(() => {
                                        if (mountedRef.current && shouldListenRef.current && !ordered && !restartingRef.current) {
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
                            if (mountedRef.current && shouldListenRef.current && !ordered && !restartingRef.current) {
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
            // "aborted"와 "no-speech"는 정상적인 동작이므로 무시
            if (event.error !== "aborted" && event.error !== "no-speech") {
                setErrorMessage(`음성 인식 오류: ${event.error}`);
            }
            setIsListening(false);
            
            // 에러 발생 시에도 재시작 시도 (키오스크 시스템이므로 지속적으로 작동해야 함)
            if (mountedRef.current && shouldListenRef.current && !ordered && !restartingRef.current) {
                restartingRef.current = true;
                setTimeout(() => {
                    if (!mountedRef.current || !shouldListenRef.current || ordered) {
                        restartingRef.current = false;
                        return;
                    }
                    // isSpeakingRef가 true면 더 기다림
                    if (isSpeakingRef.current) {
                        restartingRef.current = false;
                        setTimeout(() => {
                            if (mountedRef.current && shouldListenRef.current && !ordered && !restartingRef.current) {
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
                            if (mountedRef.current && shouldListenRef.current && !ordered && !restartingRef.current) {
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
            setLastUser(transcript);

            const normalized = transcript.replaceAll(" ", "").toLowerCase();
            console.log("🎤 음성 인식 결과:", transcript, "normalized:", normalized);
            
            // 메뉴 이름 직접 말하기 - 가장 먼저 체크 (부가 설명 없이 바로 담기)
            let matchedMenu = null;
            
            // 1. 정확한 메뉴 이름 매칭 (예: "불고기버거", "치킨버거")
            matchedMenu = MENU_ITEMS.find((item) => {
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

            // 2. 키워드로 매칭 (예: "불고기" -> "불고기버거")
            if (!matchedMenu) {
                matchedMenu = MENU_ITEMS.find((item) => {
                    if (item.keywords && item.keywords.some((kw) => {
                        const kwNormalized = kw.replaceAll(" ", "").toLowerCase();
                        // 키워드가 정확히 일치하거나 포함되어 있는지 확인
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

                // 버거(새우버거 포함)나 음료는 옵션 선택 페이지로 이동
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
                speakKorean(msg).catch(err => console.error("음성 안내 오류:", err));
                setTimeout(() => { isSpeakingRef.current = false; }, 2000);
                
                // 약간의 딜레이 후 페이지 이동
                setTimeout(() => {
                    navigateTo(`/menu-option?menuId=${matchedMenu.id}&menuName=${encodeURIComponent(matchedMenu.name)}&price=${matchedMenu.price}&cart=${cartData}&orderType=${orderType}&${entryQuery(entry)}`);
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
                    setTimeout(() => { isSpeakingRef.current = false; }, 1000);
                    return;
                }
                const cartTotal = currentCartItems.reduce((sum, it) => sum + it.price * it.qty, 0);
                const cartData = encodeURIComponent(JSON.stringify(currentCartItems));
                const orderType = searchParams.get("orderType") || "takeout";
                stopVoiceSession(recognitionRef.current, shouldListenRef, isSpeakingRef);
                router.push(`/payment?cart=${cartData}&total=${cartTotal}&orderType=${orderType}&${entryQuery(entry)}`);
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
            const shrimpRecommendPattern = /새우.*(추천|메뉴|들어간|보여|알려|뭐|어떤|있)/;
            if (shrimpRecommendPattern.test(normalized)) {
                const cartData = encodeURIComponent(JSON.stringify(cartItems));
                navigateTo(`/shrimp-recommend?cart=${cartData}&orderType=${searchParams.get("orderType") || "takeout"}&${entryQuery(entry)}`);
                try { recognition.stop(); } catch { }
                return;
            }

            // 키워드 기반 추천 감지 (예: "불고기 뭐있지" 등)
            const recommendationPattern = /(불고기|치즈|트러플).*(뭐|어떤|있|추천|보여|알려)/;
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
                    setTimeout(() => { 
                        isSpeakingRef.current = false;
                        // 음성 인식 재시작
                        if (mountedRef.current && shouldListenRef.current && !ordered) {
                            setTimeout(() => {
                                if (mountedRef.current && shouldListenRef.current && !ordered) {
                                    try {
                                        recognition.start();
                                    } catch (e) {}
                                }
                            }, 2000);
                        }
                    }, 1000);
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
                setTimeout(() => { isSpeakingRef.current = false; }, 2000);
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
                setTimeout(() => { 
                    isSpeakingRef.current = false;
                    // 음성 인식 재시작
                    if (mountedRef.current && shouldListenRef.current && !ordered) {
                        setTimeout(() => {
                            if (mountedRef.current && shouldListenRef.current && !ordered) {
                                try {
                                    recognition.start();
                                } catch (e) {}
                            }
                        }, 2000);
                    }
                }, 1000);
                
                // 음성 안내 후 음성 인식 재시작 (더 긴 딜레이로 확실히 재시작)
                if (mountedRef.current && shouldListenRef.current && !ordered) {
                    setTimeout(() => {
                        if (mountedRef.current && shouldListenRef.current && !ordered) {
                            try { 
                                console.log("🔄 음성 인식 재시작 시도");
                                recognition.start(); 
                            } catch (e) {
                                console.log("음성 인식 재시작 오류:", e);
                                // 재시작 실패 시 다시 시도
                                setTimeout(() => {
                                    if (mountedRef.current && shouldListenRef.current && !ordered) {
                                        try { 
                                            recognition.start(); 
                                        } catch (e2) {
                                            console.log("음성 인식 재시작 재시도 오류:", e2);
                                        }
                                    }
                                }, 1000);
                            }
                        }
                    }, 1500);
                }
            } catch (e) {
                setAssistantMessage("");
                setErrorMessage(e.message || "네트워크 오류가 발생했습니다.");
                // 에러 발생 시에도 음성 인식 재시작
                if (mountedRef.current && shouldListenRef.current && !ordered) {
                    setTimeout(() => {
                        if (mountedRef.current && shouldListenRef.current && !ordered) {
                            try { 
                                recognition.start(); 
                            } catch (e) {
                                console.log("음성 인식 재시작 오류:", e);
                            }
                        }
                    }, 500);
                }
            }
        };

        recognitionRef.current = recognition;
        registerVoiceSession(recognition);

        if (voiceOrderMode) {
            const startVoiceFlow = async () => {
                if (!mountedRef.current || !shouldListenRef.current) return;
                if (!hasPlayedInitialGreetingRef.current) {
                    hasPlayedInitialGreetingRef.current = true;
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
                }

                if (!mountedRef.current || !shouldListenRef.current || ordered) return;
                try {
                    recognition.start();
                } catch (e) {
                    setErrorMessage("마이크 사용 권한을 허용해 주세요.");
                }
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
                    padding: "10px 24px",
                    backgroundColor: "#fff",
                    zIndex: 50,
                }}
            >
                {/* 왼쪽: 처음으로 버튼 */}
                <button
                    onClick={() => {
                        shouldListenRef.current = false;
                        try { recognitionRef.current && recognitionRef.current.stop(); } catch { }
                        try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch { }
                        router.push(entry === "qr" ? "/qr-order" : "/");
                    }}
                    style={{
                        backgroundColor: "#000000",
                        color: "#ffffff",
                        border: "none",
                        padding: "10px 20px",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "16px",
                        fontWeight: "600",
                    }}
                >
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
                            width: "72px",
                            height: "72px",
                            objectFit: "contain",
                            display: "block",
                        }}
                    />
                </div>

                {/* 오른쪽: 음성 주문중 배지 */}
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
                    {voiceOrderMode ? "음성 주문중" : "간편 모드"}
                </div>
            </div>

            {/* Progress Bar */}
            <div
                style={{
                    flexShrink: 0,
                    backgroundColor: "#f5f5f5",
                    padding: "12px 24px",
                    borderBottom: "1px solid #e5e5e5",
                }}
            >
                <div style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "30px",
                    position: "relative",
                }}>
                    {/* 가로선 */}
                    <div style={{
                        position: "absolute",
                        top: "50%",
                        left: "15%",
                        right: "15%",
                        height: "2px",
                        backgroundColor: "#999",
                        zIndex: 0,
                    }} />
                    
                    {/* 1 메뉴 선택 */}
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", zIndex: 1 }}>
                        <div style={{
                            width: "32px",
                            height: "32px",
                            borderRadius: "50%",
                            backgroundColor: "#000000",
                            color: "#ffffff",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "16px",
                            fontWeight: "700",
                        }}>
                            1
                        </div>
                        <div style={{ fontSize: "12px", fontWeight: "600", color: "#000" }}>메뉴 선택</div>
                    </div>

                    {/* 2 포인트 적립 */}
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", zIndex: 1 }}>
                        <div style={{
                            width: "32px",
                            height: "32px",
                            borderRadius: "50%",
                            backgroundColor: "#ffffff",
                            color: "#000000",
                            border: "2px solid #999",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "16px",
                            fontWeight: "700",
                        }}>
                            2
                        </div>
                        <div style={{ fontSize: "12px", fontWeight: "600", color: "#666" }}>포인트 적립</div>
                    </div>

                    {/* 3 결제하기 */}
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", zIndex: 1 }}>
                        <div style={{
                            width: "32px",
                            height: "32px",
                            borderRadius: "50%",
                            backgroundColor: "#ffffff",
                            color: "#000000",
                            border: "2px solid #999",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "16px",
                            fontWeight: "700",
                        }}>
                            3
                        </div>
                        <div style={{ fontSize: "12px", fontWeight: "600", color: "#666" }}>결제하기</div>
                    </div>

                    {/* 4 완료 */}
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", zIndex: 1 }}>
                        <div style={{
                            width: "32px",
                            height: "32px",
                            borderRadius: "50%",
                            backgroundColor: "#ffffff",
                            color: "#000000",
                            border: "2px solid #999",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "16px",
                            fontWeight: "700",
                        }}>
                            4
                        </div>
                        <div style={{ fontSize: "12px", fontWeight: "600", color: "#666" }}>완료</div>
                    </div>
                </div>
            </div>

            {/* 카테고리 탭 - 상단 가로 배치 */}
            <div
                style={{
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "stretch",
                    gap: "0",
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
                        padding: "14px 16px",
                        borderRadius: "0",
                        border: "none",
                        borderBottom: selectedCategory === "burger" ? "3px solid #666" : "none",
                        backgroundColor: selectedCategory === "burger" ? "#e5e5e5" : "#f5f5f5",
                        color: selectedCategory === "burger" ? "#000" : "#666",
                        fontSize: "20px",
                        fontWeight: selectedCategory === "burger" ? 700 : 500,
                        cursor: "pointer",
                        transition: "all 0.2s",
                        boxShadow: selectedCategory === "burger" ? "0 2px 4px rgba(0,0,0,0.1)" : "none",
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
                        padding: "14px 16px",
                        borderRadius: "0",
                        border: "none",
                        borderBottom: selectedCategory === "drink" ? "3px solid #666" : "none",
                        backgroundColor: selectedCategory === "drink" ? "#e5e5e5" : "#f5f5f5",
                        color: selectedCategory === "drink" ? "#000" : "#666",
                        fontSize: "20px",
                        fontWeight: selectedCategory === "drink" ? 700 : 500,
                        cursor: "pointer",
                        transition: "all 0.2s",
                        boxShadow: selectedCategory === "drink" ? "0 2px 4px rgba(0,0,0,0.1)" : "none",
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
                        padding: "14px 16px",
                        borderRadius: "0",
                        border: "none",
                        borderBottom: selectedCategory === "side" ? "3px solid #666" : "none",
                        backgroundColor: selectedCategory === "side" ? "#e5e5e5" : "#f5f5f5",
                        color: selectedCategory === "side" ? "#000" : "#666",
                        fontSize: "20px",
                        fontWeight: selectedCategory === "side" ? 700 : 500,
                        cursor: "pointer",
                        transition: "all 0.2s",
                        boxShadow: selectedCategory === "side" ? "0 2px 4px rgba(0,0,0,0.1)" : "none",
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
                        padding: "24px 32px",
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
                                            border: "2px solid #f0f0f0",
                                            borderRadius: 24,
                                            boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
                                            padding: 0,
                                            minHeight: 0,
                                            overflow: "hidden",
                                            width: "100%",
                                            height: "100%",
                                            aspectRatio: "1 / 1", // 정사각형 카드
                                            cursor: "pointer",
                                            transition: "all 0.2s",
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.15)";
                                            e.currentTarget.style.transform = "translateY(-4px)";
                                            e.currentTarget.style.borderColor = "#FF6B35";
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.1)";
                                            e.currentTarget.style.transform = "translateY(0)";
                                            e.currentTarget.style.borderColor = "#f0f0f0";
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
                                                const src = menuGridImageSrc(m);
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
                                            padding: "8px 12px",
                                            background: "#fff",
                                            borderRadius: "0 0 24px 24px",
                                        }}>
                                            <div style={{ fontWeight: 800, fontSize: 24, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#333", lineHeight: "1.1" }}>{m.name}</div>
                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                                <div style={{ color: "#1e7a39", fontSize: 22, fontWeight: 800 }}>{m.price.toLocaleString()}원</div>
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
                                            background: "#f6f7f9",
                                            border: "1px dashed #d0d7e2",
                                            borderRadius: 12,
                                            padding: 10,
                                            minHeight: 0,
                                            alignItems: "center",
                                            justifyContent: "center",
                                            color: "#8aa0c5",
                                            fontWeight: 700,
                                            fontSize: 12,
                                        }}
                                    >
                                        메뉴 준비중
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
                                padding: "12px 32px 16px 32px",
                                marginTop: "8px",
                                position: "relative",
                            }}
                        >
                            {/* 왼쪽: 이전 버튼 */}
                            <button
                                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                                disabled={currentPage === 1}
                                style={{
                                    padding: "10px 20px",
                                    borderRadius: "4px",
                                    border: "none",
                                    background: currentPage === 1 ? "#ccc" : "#1e7a39",
                                    color: "#ffffff",
                                    cursor: currentPage === 1 ? "not-allowed" : "pointer",
                                    fontSize: "16px",
                                    fontWeight: "600",
                                    transition: "all 0.2s",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "8px",
                                }}
                                onMouseEnter={(e) => {
                                    if (currentPage !== 1) {
                                        e.currentTarget.style.background = "#1a6b2e";
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (currentPage !== 1) {
                                        e.currentTarget.style.background = "#1e7a39";
                                    }
                                }}
                            >
                                <span style={{ fontSize: "14px" }}>◀</span>
                                이전
                            </button>

                            {/* 가운데: 페이지 번호 */}
                            <div style={{ 
                                fontSize: "16px", 
                                fontWeight: "600", 
                                color: "#333",
                                position: "absolute",
                                left: "50%",
                                transform: "translateX(-50%)",
                            }}>
                                {currentPage}/{totalPages}
                            </div>

                            {/* 오른쪽: 다음 버튼 */}
                            <button
                                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                                disabled={currentPage === totalPages}
                                style={{
                                    padding: "10px 20px",
                                    borderRadius: "4px",
                                    border: "none",
                                    background: currentPage === totalPages ? "#ccc" : "#1e7a39",
                                    color: "#ffffff",
                                    cursor: currentPage === totalPages ? "not-allowed" : "pointer",
                                    fontSize: "16px",
                                    fontWeight: "600",
                                    transition: "all 0.2s",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "8px",
                                }}
                                onMouseEnter={(e) => {
                                    if (currentPage !== totalPages) {
                                        e.currentTarget.style.background = "#1a6b2e";
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (currentPage !== totalPages) {
                                        e.currentTarget.style.background = "#1e7a39";
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
                    borderTop: "2px solid #e5e5e5",
                    overflow: "hidden",
                }}
            >
                {/* Order Summary Bar - 고정 검정색 바 */}
                <div
                    style={{
                        flexShrink: 0,
                        background: "#000000",
                        padding: "12px 24px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                    }}
                >
                    <div style={{ fontSize: "16px", fontWeight: "600", color: "#ffffff" }}>
                        총 수량 | {cartItems.reduce((sum, it) => sum + it.qty, 0)}개
                    </div>
                    <div style={{ fontSize: "16px", fontWeight: "600", color: "#ffffff" }}>
                        총 금액 | {cartTotal.toLocaleString()}원
                    </div>
                </div>

                {/* Cart and Action Buttons Area */}
                <div
                    style={{
                        flex: 1,
                        background: "#333333",
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
                        <div style={{ color: "#999", fontSize: "14px" }}>담긴 상품이 없습니다.</div>
                    ) : (
                        cartItems.map((it) => (
                            <div
                                key={it.id}
                                style={{
                                    minWidth: "160px",
                                    background: "#ffffff",
                                    borderRadius: "6px",
                                    padding: "8px",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "8px",
                                    flexShrink: 0,
                                }}
                            >
                                {/* 메뉴 이미지 */}
                                <div style={{
                                    width: "50px",
                                    height: "50px",
                                    background: "#f5f5f5",
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
                                    <div style={{ fontWeight: "700", fontSize: "12px", marginBottom: "4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                        {it.name}
                                    </div>
                                    {/* 수량 조절 */}
                                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                        <button 
                                            onClick={() => removeFromCart(it.id)} 
                                            style={{ 
                                                width: "20px", 
                                                height: "20px", 
                                                borderRadius: "3px", 
                                                border: "none", 
                                                background: "#1e7a39", 
                                                color: "#ffffff", 
                                                cursor: "pointer",
                                                fontSize: "14px",
                                                fontWeight: "700",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                            }}
                                        >
                                            -
                                        </button>
                                        <span style={{ fontSize: "12px", fontWeight: "600", minWidth: "16px", textAlign: "center" }}>
                                            {it.qty}
                                        </span>
                                        <button 
                                            onClick={() => addToCart(it)} 
                                            style={{ 
                                                width: "20px", 
                                                height: "20px", 
                                                borderRadius: "3px", 
                                                border: "none", 
                                                background: "#1e7a39", 
                                                color: "#ffffff", 
                                                cursor: "pointer",
                                                fontSize: "14px",
                                                fontWeight: "700",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                            }}
                                        >
                                            +
                                        </button>
                                        <button 
                                            onClick={() => deleteFromCart(it.id)} 
                                            style={{ 
                                                marginLeft: "4px",
                                                width: "20px", 
                                                height: "20px", 
                                                borderRadius: "3px", 
                                                border: "none", 
                                                background: "transparent", 
                                                color: "#000000", 
                                                cursor: "pointer",
                                                fontSize: "16px",
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

                {/* 오른쪽: 취소 및 주문하기 버튼 */}
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", flexShrink: 0 }}>
                    <button
                        onClick={clearCart}
                        disabled={cartItems.length === 0}
                        style={{
                            width: "100px",
                            height: "60px",
                            borderRadius: "8px",
                            border: "none",
                            background: cartItems.length === 0 ? "#555" : "#000000",
                            color: "#ffffff",
                            cursor: cartItems.length === 0 ? "not-allowed" : "pointer",
                            fontSize: "16px",
                            fontWeight: "700",
                            transition: "all 0.2s",
                        }}
                        onMouseEnter={(e) => {
                            if (cartItems.length > 0) {
                                e.currentTarget.style.background = "#333";
                            }
                        }}
                        onMouseLeave={(e) => {
                            if (cartItems.length > 0) {
                                e.currentTarget.style.background = "#000000";
                            }
                        }}
                    >
                        취소
                    </button>
                    <button
                        onClick={handleOrder}
                        disabled={cartItems.length === 0}
                        style={{
                            width: "100px",
                            height: "60px",
                            borderRadius: "8px",
                            border: "none",
                            background: cartItems.length === 0 ? "#555" : "#ff0000",
                            color: "#ffffff",
                            cursor: cartItems.length === 0 ? "not-allowed" : "pointer",
                            fontSize: "16px",
                            fontWeight: "700",
                            transition: "all 0.2s",
                        }}
                        onMouseEnter={(e) => {
                            if (cartItems.length > 0) {
                                e.currentTarget.style.background = "#cc0000";
                            }
                        }}
                        onMouseLeave={(e) => {
                            if (cartItems.length > 0) {
                                e.currentTarget.style.background = "#ff0000";
                            }
                        }}
                    >
                        주문하기
                    </button>
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
                                        <div style={{ color: "#777", marginBottom: 12 }}>{menu.price.toLocaleString()}원</div>
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


