"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { speakKorean } from "../utils/speakKorean";

export default function MenuPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const entry = (searchParams.get("entry") || "voice").toLowerCase();

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
    const firstStartRef = useRef(true);

    // cart state
    const STATIC_MENU = [
        { id: "main-1", name: "불고기버거", price: 5000, keywords: ["불고기", "bulgogi"] },
        { id: "main-2", name: "치킨버거", price: 4800, keywords: ["치킨", "chicken"] },
        { id: "drink-1", name: "콜라", price: 2000, keywords: ["콜라", "coke"] },
        { id: "drink-2", name: "제로콜라", price: 2000, keywords: ["제로", "제로콜라", "coke zero", "zero"] },
        { id: "drink-3", name: "사이다", price: 2000, keywords: ["사이다", "soda"] },
        { id: "drink-4", name: "커피", price: 2000, keywords: ["커피", "coffee"] },
        { id: "side-1", name: "감자튀김", price: 3000, keywords: ["감자", "튀김", "감튀", "fries"] },
        { id: "side-2", name: "샐러드", price: 3000, keywords: ["샐러드", "salad"] },
        { id: "side-3", name: "치킨텐더", price: 3000, keywords: ["치킨", "텐더", "치킨텐더", "tender"] },
    ];
    const [MENU_ITEMS, setMENU_ITEMS] = useState(STATIC_MENU);
    const [cartItems, setCartItems] = useState([]); // [{id, name, price, qty}]
    const [recommendedMenus, setRecommendedMenus] = useState([]);
    const [showRecommendation, setShowRecommendation] = useState(false);
    const [showFriesModal, setShowFriesModal] = useState(false);
    const [selectedFries, setSelectedFries] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);

    // DB에서 메뉴 로드
    useEffect(() => {
        async function loadMenus() {
            try {
                const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/menu`);
                const data = await res.json();
                if (res.ok && data.menus && data.menus.length > 0) {
                    const normalizeName = (name) => (name || "").replace(/\s+/g, "").toLowerCase();

                    // API 데이터를 이름(공백 제거) 기준으로 중복 제거하고, 가격을 정정한 뒤 누락분을 STATIC_MENU로 보완
                    const uniqueByName = new Map();
                    data.menus.forEach((item) => {
                        if (!item?.name) return;
                        const key = normalizeName(item.name);
                        if (!uniqueByName.has(key)) uniqueByName.set(key, item);
                    });

                    const canonical = Array.from(uniqueByName.values()).map((item) => {
                        const corrected = { ...item };
                        const n = normalizeName(corrected.name);
                        if (n === "불고기버거") corrected.price = 5000;
                        if (n === "치킨버거") corrected.price = 4800;
                        if (n === "감자튀김") corrected.price = 3000;
                        if (n === "샐러드") corrected.price = 3000;
                        if (n === "치킨텐더") corrected.price = 3000;
                        if (["콜라", "제로콜라", "사이다", "커피"].includes(corrected.name)) corrected.price = 2000;
                        return corrected;
                    });

                    // 누락된 필수 메뉴를 STATIC_MENU 기준으로 채워 넣기 (공백 제거 기준)
                    const existingNames = new Set(canonical.map((m) => normalizeName(m.name)));
                    STATIC_MENU.forEach((item) => {
                        if (!existingNames.has(normalizeName(item.name))) canonical.push(item);
                    });

                    setMENU_ITEMS(canonical.slice(0, 16));
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
        try { await speakKorean(`${item.name} 담았어요.`); } catch { }
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
        try {
            if (removedCompletely) {
                await speakKorean(`${removedItemName}를 장바구니에서 비웠어요.`);
            } else {
                await speakKorean(`${removedItemName} 한 개 뺐어요.`);
            }
        } catch { }
    }

    async function clearCart() {
        setCartItems([]);
        try { await speakKorean("장바구니를 모두 비웠어요."); } catch { }
    }

    async function handleOrder() {
        if (cartItems.length === 0) {
            const msg = "장바구니가 비었어요.";
            setAssistantMessage(msg);
            await speakKorean(msg);
            return;
        }
        const cartData = encodeURIComponent(JSON.stringify(cartItems));
        router.push(`/order-confirm?cart=${cartData}&total=${cartTotal}&orderType=${searchParams.get("orderType") || "takeout"}`);
    }

    const cartTotal = cartItems.reduce((sum, it) => sum + it.price * it.qty, 0);

    // 여기부턴 그냥 주문하기

    useEffect(() => {
        mountedRef.current = true;
        shouldListenRef.current = true;
        firstStartRef.current = true; // 컴포넌트가 마운트될 때마다 리셋

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
            setErrorMessage("이 브라우저는 음성 인식을 지원하지 않습니다. 크롬을 권장합니다.");
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = "ko-KR";
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onstart = async () => {
            setIsListening(true);
            // 처음 시작할 때만 인사말
            if (firstStartRef.current) {
                firstStartRef.current = false;
                const greeting = "무엇을 주문하시겠어요?";
                setAssistantMessage(greeting);
                await speakKorean(greeting);
            }
        };
        recognition.onend = () => {
            setIsListening(false);
            // 자동 재시작(메뉴1 주문 완료 전까지 지속 듣기)
            if (mountedRef.current && shouldListenRef.current && !ordered && !restartingRef.current) {
                restartingRef.current = true;
                setTimeout(() => {
                    if (!mountedRef.current || !shouldListenRef.current) {
                        restartingRef.current = false;
                        return;
                    }
                    try { recognition.start(); } catch { }
                    restartingRef.current = false;
                }, 250);
            }
        };
        recognition.onerror = (event) => {
            // "aborted"는 정상적인 중단이므로 무시
            if (event.error !== "aborted") {
            setErrorMessage(`음성 인식 오류: ${event.error}`);
            }
            setIsListening(false);
        };

        recognition.onresult = async (event) => {
            const transcript = event.results[0][0].transcript || "";
            setLastUser(transcript);

            const normalized = transcript.replaceAll(" ", "").toLowerCase();

            // 메뉴 이름 직접 말하기 - 가장 먼저 체크 (부가 설명 없이 바로 담기)
            const matchedMenu = MENU_ITEMS.find((item) => {
                const menuNameNormalized = item.name.replaceAll(" ", "").toLowerCase();
                // 메뉴 이름이 포함되어 있는지 확인
                if (normalized.includes(menuNameNormalized) || menuNameNormalized.includes(normalized)) {
                    return true;
                }
                // 키워드로도 확인
                return item.keywords && item.keywords.some((kw) => {
                    const kwNormalized = kw.replaceAll(" ", "").toLowerCase();
                    return normalized.includes(kwNormalized);
                });
            });

            if (matchedMenu) {
                console.log("✅ 메뉴 매칭됨:", matchedMenu.name, "사용자 입력:", transcript);
                
                // 감자튀김은 사이즈 선택 모달 표시
                if (/감자튀김/.test(matchedMenu.name)) {
                    setSelectedFries(matchedMenu);
                    setShowFriesModal(true);
                    return;
                }

                // 샐러드, 치킨텐더는 바로 담기
                if (/샐러드|치킨텐더/.test(matchedMenu.name)) {
                    addToCart(matchedMenu);
                    return;
                }

                // 버거(새우버거 포함)나 음료는 옵션 선택 페이지로 이동
                const cartData = encodeURIComponent(JSON.stringify(cartItems));
                const orderType = searchParams.get("orderType") || "takeout";
                console.log("🚀 menu-option으로 이동:", matchedMenu.name);
                router.push(`/menu-option?menuId=${matchedMenu.id}&menuName=${encodeURIComponent(matchedMenu.name)}&price=${matchedMenu.price}&cart=${cartData}&orderType=${orderType}`);
                return;
            }

            // 주문하기 명령 감지
            const orderPattern = /주문|결제|주문해|주문해줘|주문할래|주문하겠어|결제해|결제해줘|결제할래|결제하겠어/;
            if (orderPattern.test(normalized)) {
                await handleOrder();
                try { recognition.stop(); } catch { }
                return;
            }

            // 새우 추천 요청 감지 - "새우 추천", "새우 메뉴 추천", "새우 들어간 메뉴 추천해줘" 같은 맥락만
            const shrimpRecommendPattern = /새우.*(추천|메뉴|들어간|보여|알려|뭐|어떤|있)/;
            if (shrimpRecommendPattern.test(normalized)) {
                const cartData = encodeURIComponent(JSON.stringify(cartItems));
                router.push(`/shrimp-recommend?cart=${cartData}&orderType=${searchParams.get("orderType") || "takeout"}`);
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
                    const msg = `${recommended.map(m => m.name).join(", ")}를 추천해드릴게요.`;
                    setAssistantMessage(msg);
                    await speakKorean(msg);
                    try { recognition.stop(); } catch { }
                    return;
                }
            }

            const isMenu1 = /메뉴?1|일?번|첫(번째)?|메뉴일|원번/.test(normalized);

            if (isMenu1) {
                setOrdered(true);
                const msg = "메뉴 1 주문을 완료했어요. 결제하시겠어요?";
                setAssistantMessage(msg);
                setConversation((prev) => [...prev, { role: "user", content: transcript }, { role: "assistant", content: msg }]);
                await speakKorean(msg);
                try { recognition.stop(); } catch { }
                return;
            }

            const newConversation = [...conversation, { role: "user", content: transcript }];
            setConversation(newConversation);
            try {
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
                await speakKorean(reply);
            } catch (e) {
                setAssistantMessage("");
                setErrorMessage(e.message || "네트워크 오류가 발생했습니다.");
            }
        };

        recognitionRef.current = recognition;

        if (entry === "voice") {
            try {
                recognition.start();
            } catch (e) {
                setErrorMessage("마이크 사용 권한을 허용해 주세요.");
            }
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
    }, [ordered, entry]);

    return (
        <main
            style={{
                display: "flex",
                flexDirection: "column",
                height: "100vh",
                overflow: "hidden",
                backgroundColor: "#f9f9f9",
            }}
        >
            {/* 상단 바 */}
            <div
                style={{
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 16px",
                    borderBottom: "1px solid #e5e5e5",
                    backgroundColor: "#fff",
                    zIndex: 50,
                }}
            >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                    style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "8px",
                        backgroundColor: entry === "voice" ? "#e6f4ea" : "#eee",
                        color: entry === "voice" ? "#1e7a39" : "#777",
                        border: entry === "voice" ? "1px solid #bfe3ca" : "1px solid #ddd",
                        borderRadius: "999px",
                        padding: "8px 14px",
                        fontWeight: "bold",
                        opacity: entry === "voice" ? (isListening ? 1 : 0.85) : 1,
                    }}
                >
                    <span style={{ width: 10, height: 10, borderRadius: "50%", opacity: 1, background: entry === "voice" ? "#34c759" : "#bbb" }} />
                    {entry === "voice" ? "음성 주문중" : "간편 모드"}
                    </div>
                    <div style={{ color: "#555", fontSize: 14 }}>
                        {isListening ? "음성 인식 중입니다." : "마이크를 준비하고 있어요..."}
                    </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    {errorMessage ? (
                        <div style={{ color: "#b00020", fontSize: 13, fontWeight: 700 }}>{errorMessage}</div>
                    ) : null}
                <button
                    onClick={() => {
                        shouldListenRef.current = false;
                        try { recognitionRef.current && recognitionRef.current.stop(); } catch { }
                        try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch { }
                            router.push("/");
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
            </div>

            {/* 메뉴 그리드 영역 - flex: 1로 남은 공간 차지 */}
            <div
                style={{
                    flex: 1,
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                    maxWidth: 1200,
                    margin: "0 auto",
                    width: "100%",
                    padding: "8px 24px",
                }}
            >
                {/* 메뉴 3 x 3 */}
                <div
                    style={{
                        flex: 1,
                        display: "grid",
                        gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                        gridTemplateRows: "repeat(3, 1fr)",
                        gap: "10px",
                        alignItems: "stretch",
                        minHeight: 0,
                    }}
                >
                    {(() => {
                        const itemsPerPage = 9;
                        const startIdx = (currentPage - 1) * itemsPerPage;
                        const endIdx = startIdx + itemsPerPage;
                        const currentItems = MENU_ITEMS.slice(startIdx, endIdx);
                        const placeholdersNeeded = Math.max(0, itemsPerPage - currentItems.length);

                        return (
                            <>
                                {currentItems.map((m) => (
                                    <div
                                        key={m.id}
                                        style={{
                                            display: "flex",
                                            flexDirection: "column",
                                            gap: 6,
                        background: "#ffffff",
                                            border: "1px solid #e5e5e5",
                        borderRadius: 12,
                                            boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                                            padding: 10,
                                            minHeight: 0,
                                            overflow: "hidden",
                                        }}
                                    >
                                        <div
                                            style={{
                                                flex: 1,
                                                minHeight: 0,
                                                background: (m.name && /버거/.test(m.name)) || (m.name && /콜라|제로콜라|사이다|커피|감자튀김|샐러드|치킨텐더/.test(m.name)) ? "transparent" : "linear-gradient(135deg, #f8fbff 0%, #eef3ff 100%)",
                                                border: (m.name && /버거/.test(m.name)) || (m.name && /콜라|제로콜라|사이다|커피|감자튀김|샐러드|치킨텐더/.test(m.name)) ? "none" : "1px dashed #d8dfee",
                                                borderRadius: 8,
                        display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                color: "#8aa0c5",
                                                fontWeight: 700,
                                                fontSize: 12,
                        overflow: "hidden",
                    }}
                >
                                            {m.name && /칠리/.test(m.name) ? (
                                                <img
                                                    src="/C_srp.png"
                                                    alt={m.name}
                                                    style={{
                                                        width: "100%",
                                                        height: "100%",
                                                        objectFit: "contain",
                                                        display: "block",
                                                    }}
                                                />
                                            ) : m.name && /트러플/.test(m.name) ? (
                                                <img
                                                    src="/T_srp.png"
                                                    alt={m.name}
                                                    style={{
                                                        width: "100%",
                                                        height: "100%",
                                                        objectFit: "contain",
                                                        display: "block",
                                                    }}
                                                />
                                            ) : m.name && /버거/.test(m.name) ? (
                                                <img
                                                    src="/burger.png"
                                                    alt={m.name}
                                                    style={{
                                                        width: "100%",
                                                        height: "100%",
                                                        objectFit: "contain",
                                                        display: "block",
                                                    }}
                                                />
                                            ) : m.name && /콜라|제로콜라/.test(m.name) ? (
                                                <img
                                                    src="/coke_main.png"
                                                    alt={m.name}
                                                    style={{
                                                        width: "100%",
                                                        height: "100%",
                                                        objectFit: "contain",
                                                        display: "block",
                                                    }}
                                                />
                                            ) : m.name && /사이다/.test(m.name) ? (
                                                <img
                                                    src="/cider_main.png"
                                                    alt={m.name}
                                                    style={{
                                                        width: "100%",
                                                        height: "100%",
                                                        objectFit: "contain",
                                                        display: "block",
                                                    }}
                                                />
                                            ) : m.name && /커피/.test(m.name) ? (
                                                <img
                                                    src="/coffee_main.png"
                                                    alt={m.name}
                                                    style={{
                                                        width: "100%",
                                                        height: "100%",
                                                        objectFit: "contain",
                                                        display: "block",
                                                    }}
                                                />
                                            ) : m.name && /감자튀김/.test(m.name) ? (
                                                <img
                                                    src="/french_fries_main.png"
                                                    alt={m.name}
                                                    style={{
                                                        width: "100%",
                                                        height: "100%",
                                                        objectFit: "contain",
                                                        display: "block",
                                                    }}
                                                />
                                            ) : m.name && /샐러드/.test(m.name) ? (
                                                <img
                                                    src="/salad_main.png"
                                                    alt={m.name}
                                                    style={{
                                                        width: "100%",
                                                        height: "100%",
                                                        objectFit: "contain",
                                                        display: "block",
                                                    }}
                                                />
                                            ) : m.name && /치킨텐더/.test(m.name) ? (
                                                <img
                                                    src="/tender_main.png"
                                                    alt={m.name}
                                                    style={{
                                                        width: "100%",
                                                        height: "100%",
                                                        objectFit: "contain",
                                                        display: "block",
                                                    }}
                                                />
                                            ) : (
                                                "메뉴 이미지"
                                            )}
                                        </div>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexShrink: 0 }}>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontWeight: 700, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.name}</div>
                                                <div style={{ color: "#555", marginTop: 4, fontSize: 13 }}>{m.price.toLocaleString()}원</div>
                                            </div>
                            <button
                                onClick={() => {
                                                    const name = m.name;
                                                    const cartData = encodeURIComponent(JSON.stringify(cartItems));
                                                    const orderType = searchParams.get("orderType") || "takeout";

                                                    // 감자튀김: 사이즈 선택 모달
                                                    if (/감자튀김/.test(name)) {
                                                        setSelectedFries(m);
                                                        setShowFriesModal(true);
                                                        return;
                                                    }

                                                    // 샐러드, 치킨텐더: 바로 담기
                                                    if (/샐러드|치킨텐더/.test(name)) {
                                                        addToCart(m);
                                        return;
                                    }

                                                    router.push(`/menu-option?menuId=${m.id}&menuName=${encodeURIComponent(name)}&price=${m.price}&cart=${cartData}&orderType=${orderType}`);
                                                }}
                                                style={{ background: "#1e7a39", color: "#fff", border: "none", borderRadius: 8, padding: "6px 10px", cursor: "pointer", fontWeight: 600, fontSize: 13, flexShrink: 0 }}
                                            >
                                                담기
                                            </button>
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

                {/* 페이지네이션 */}
                {(() => {
                    const itemsPerPage = 9;
                    const totalPages = Math.ceil(Math.max(MENU_ITEMS.length, 9) / itemsPerPage);
                    return (
                        <div
                            style={{
                                flexShrink: 0,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 16,
                                padding: "8px 0",
                                marginTop: 8,
                            }}
                        >
                            <button
                                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                                disabled={currentPage === 1}
                                style={{
                                    padding: "6px 12px",
                                    borderRadius: 8,
                                    border: "1px solid #ddd",
                                    background: currentPage === 1 ? "#f5f5f5" : "#fff",
                                    color: currentPage === 1 ? "#999" : "#333",
                                    cursor: currentPage === 1 ? "not-allowed" : "pointer",
                                    fontSize: 13,
                                    fontWeight: 600,
                                }}
                            >
                                이전
                            </button>
                            <div
                                style={{
                                    fontSize: 15,
                                    fontWeight: 700,
                                    color: "#333",
                                    minWidth: 50,
                                    textAlign: "center",
                                }}
                            >
                                {currentPage}/{totalPages}
                            </div>
                            <button
                                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                                disabled={currentPage === totalPages}
                                style={{
                                    padding: "6px 12px",
                                    borderRadius: 8,
                                    border: "1px solid #ddd",
                                    background: currentPage === totalPages ? "#f5f5f5" : "#fff",
                                    color: currentPage === totalPages ? "#999" : "#333",
                                    cursor: currentPage === totalPages ? "not-allowed" : "pointer",
                                    fontSize: 13,
                                    fontWeight: 600,
                                }}
                            >
                                다음
                            </button>
                        </div>
                    );
                })()}
            </div>

            {/* Bottom cart */}
            <div
                style={{
                    flexShrink: 0,
                    background: "#ffffff",
                    borderTop: "1px solid #e5e5e5",
                    boxShadow: "0 -4px 14px rgba(0,0,0,0.08)",
                    padding: "12px 20px",
                    zIndex: 900,
                }}
            >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
                    <div style={{ fontWeight: 800, fontSize: 18 }}>장바구니</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ fontSize: 15, color: "#333", fontWeight: 700 }}>총액 {cartTotal.toLocaleString()}원</div>
                        <button
                            onClick={handleOrder}
                            disabled={cartItems.length === 0}
                            style={{
                                padding: "10px 18px",
                                borderRadius: 12,
                                border: "none",
                                background: cartItems.length === 0 ? "#ccc" : "#1e7a39",
                                color: "#fff",
                                cursor: cartItems.length === 0 ? "not-allowed" : "pointer",
                                fontWeight: 700,
                                minWidth: 120,
                            }}
                        >
                            주문하기
                        </button>
                        <button
                            onClick={clearCart}
                            style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd", background: "#fff", cursor: "pointer", fontWeight: 600 }}
                        >
                            비우기
                        </button>
                    </div>
                </div>
                <div style={{ marginTop: 12, display: "flex", gap: 10, overflowX: "auto", paddingBottom: 6 }}>
                    {cartItems.length === 0 ? (
                        <div style={{ color: "#777" }}>담긴 상품이 없습니다.</div>
                    ) : (
                        cartItems.map((it) => (
                            <div
                                key={it.id}
                                style={{
                                    minWidth: 180,
                                    border: "1px solid #eee",
                                    borderRadius: 12,
                                    padding: "10px 12px",
                                    background: "#f9fafb",
                            display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    gap: 10,
                                }}
                            >
                                <div>
                                    <div style={{ fontWeight: 700 }}>{it.name}</div>
                                    <div style={{ color: "#666", fontSize: 13 }}>{it.price.toLocaleString()}원 × {it.qty}</div>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                    <button onClick={() => removeFromCart(it.id)} style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid #ddd", background: "#fff", cursor: "pointer" }}>-</button>
                                    <button onClick={() => addToCart(it)} style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid #ddd", background: "#fff", cursor: "pointer" }}>+</button>
                                </div>
                            </div>
                        ))
                    )}
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

            {/* 감자튀김 사이즈 선택 모달 */}
            {showFriesModal && selectedFries && (
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
                        zIndex: 1100,
                    }}
                    onClick={() => setShowFriesModal(false)}
                >
                    <div
                        style={{
                            background: "#fff",
                            borderRadius: 16,
                            padding: 20,
                            width: "90%",
                            maxWidth: 420,
                            boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                            <div style={{ fontSize: "1.3rem", fontWeight: 800 }}>감자튀김 사이즈 선택</div>
                            <button
                                onClick={() => setShowFriesModal(false)}
                                style={{ background: "transparent", border: "none", fontSize: "1.4rem", cursor: "pointer", color: "#666" }}
                            >
                                ×
                            </button>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                            <button
                                onClick={() => {
                                    addToCart({ ...selectedFries, id: `${selectedFries.id}_M`, name: "감자튀김 (미디움)", price: 3000 });
                                    setShowFriesModal(false);
                                }}
                                style={{
                                    height: 60,
                                    borderRadius: 12,
                                    border: "1px solid #1e7a39",
                                    background: "#f5fbf7",
                                    color: "#1e7a39",
                                    fontWeight: 800,
                                    cursor: "pointer",
                                }}
                            >
                                미디움으로 담기 (3,000원)
                            </button>
                            <button
                                onClick={() => {
                                    addToCart({ ...selectedFries, id: `${selectedFries.id}_L`, name: "감자튀김 (라지)", price: 4000 });
                                    setShowFriesModal(false);
                                }}
                                style={{
                                    height: 60,
                                    borderRadius: 12,
                                    border: "1px solid #ff6b35",
                                    background: "#fff7f3",
                                    color: "#ff6b35",
                                    fontWeight: 800,
                                    cursor: "pointer",
                                }}
                            >
                                라지로 담기 (4,000원)
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}


