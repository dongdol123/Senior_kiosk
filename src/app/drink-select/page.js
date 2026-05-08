"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, useEffect, useRef, useMemo } from "react";
import { isTtsActive, speakKorean } from "../utils/speakKorean";
import { registerVoiceSession, stopVoiceSession } from "../utils/voiceSession";
import KioskAspectFrame from "../../components/KioskAspectFrame";
import { getOrderFlowEntry, entryQuery } from "../utils/orderFlowEntry";
import {
    inferMenuCategory,
    mergeMenusFromApiResponse,
    menuThumbImageSrc,
    staticMenuCatalogCopy,
    voiceNormalizedMatchesItem,
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

function drinkMediumPrice(drinkName, catalog) {
    if (!drinkName || drinkName === NONE_OPTION) return 0;
    const row = catalog?.find((m) => m.name === drinkName);
    return row?.price != null ? row.price : 2500;
}

function drinkSizePrice(drinkName, size, catalog) {
    if (!drinkName || drinkName === NONE_OPTION || size === NONE_OPTION) return 0;
    const base = drinkMediumPrice(drinkName, catalog);
    return size === "라지" ? base + 500 : base;
}

function sideBasePriceFromCatalog(sideName, catalog) {
    if (!sideName || sideName === NONE_OPTION) return 0;
    const row = catalog?.find((m) => m.name === sideName);
    if (row?.price != null) return row.price;
    if (sideName === "치킨윙 4개") return 4000;
    return 2500;
}

function sideUnitPriceCatalog(sideName, size, catalog) {
    if (!sideName || sideName === NONE_OPTION || size === NONE_OPTION) return 0;
    const base = sideBasePriceFromCatalog(sideName, catalog);
    return size === "라지" ? base + 500 : base;
}

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
    const [isBackButtonActive, setIsBackButtonActive] = useState(false);
    const [isCancelButtonActive, setIsCancelButtonActive] = useState(false);
    const [isCompleteButtonActive, setIsCompleteButtonActive] = useState(false);
    const [pendingDrinkSize, setPendingDrinkSize] = useState("");
    const [pendingSideSize, setPendingSideSize] = useState("");
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

    function menuStateQuery(params = searchParams) {
        const menuPage = params.get("menuPage") || "1";
        const menuCategory = params.get("menuCategory") || "burger";
        return `menuPage=${menuPage}&menuCategory=${menuCategory}`;
    }

    const [catalogItems, setCatalogItems] = useState(() => staticMenuCatalogCopy());
    const catalogRef = useRef(catalogItems);

    const drinkItems = useMemo(
        () => {
            const drinkOrder = new Map(DRINK_DISPLAY_ORDER.map((name, index) => [name, index]));
            return catalogItems
                .filter((m) => inferMenuCategory(m) === "drink")
                .sort((a, b) => {
                    const aOrder = drinkOrder.get(a.name) ?? Number.MAX_SAFE_INTEGER;
                    const bOrder = drinkOrder.get(b.name) ?? Number.MAX_SAFE_INTEGER;
                    if (aOrder !== bOrder) return aOrder - bOrder;
                    return a.name.localeCompare(b.name, "ko");
                });
        },
        [catalogItems]
    );
    const sideItems = useMemo(
        () =>
            catalogItems
                .filter((m) => inferMenuCategory(m) === "side")
                .sort((a, b) => a.name.localeCompare(b.name, "ko")),
        [catalogItems]
    );

    useEffect(() => {
        catalogRef.current = catalogItems;
    }, [catalogItems]);

    useEffect(() => {
        let cancelled = false;
        async function load() {
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
                console.error("drink-select menu load:", e);
            }
            if (!cancelled) setCatalogItems(fallback);
        }
        load();
        return () => {
            cancelled = true;
        };
    }, []);

    const drinkSizeButtons =
        selectedDrink && selectedDrink !== NONE_OPTION
            ? (() => {
                  const med = drinkMediumPrice(selectedDrink, catalogItems);
                  return [
                      { name: "미디움", price: med },
                      { name: "라지", price: med + 500 },
                  ];
              })()
            : [];

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
        if (!selectedDrinkSize || selectedDrinkSize === NONE_OPTION || selectedSide || sidePromptPlayedRef.current) return;
        sidePromptPlayedRef.current = true;
        const msg = "사이드를 골라주세요.";
        setAssistantMessage(msg);
        speakKorean(msg).catch(err => console.error("음성 안내 오류:", err));
    }, [selectedDrinkSize, selectedSide]);

    useEffect(() => {
        if (selectedDrinkSize) {
            setAssistantMessage("");
        }
    }, [selectedDrinkSize]);

    useEffect(() => {
        if (false && selectedDrink && selectedDrinkSize && selectedSide && selectedSideSize) {
            const drinkP = drinkSizePrice(selectedDrink, selectedDrinkSize, catalogItems);
            const sideP = sideUnitPriceCatalog(selectedSide, selectedSideSize, catalogItems);
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
                // name 만들 변수
                const selectedParts = [
                    selectedDrink !== NONE_OPTION ? selectedDrink : null,
                    selectedSide !== NONE_OPTION ? selectedSide : null,
                ].filter(Boolean);

                const newCartItems = [...cartItems];
                const cartName = [menuName, ...selectedParts].join(" + ");
                newCartItems.push({
                    id: `${menuId}_set_${Date.now()}`,
                    name: cartName,
                    price: totalPrice,
                    qty: 1,
                    type: "set",
                    items: setItems,
                });
                const cartData = encodeURIComponent(JSON.stringify(newCartItems));
                const orderType = searchParams.get("orderType") || "takeout";
                navigateTo(`/menu?${entryQuery(entry)}&orderType=${orderType}&cart=${cartData}&${menuStateQuery()}`);
            }, 800);
            return () => clearTimeout(timer);
        }
    }, [
        selectedDrink,
        selectedDrinkSize,
        selectedSide,
        selectedSideSize,
        menuId,
        menuName,
        menuPrice,
        cartItems,
        catalogItems,
        searchParams,
        router,
    ]);

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
            const cat = catalogRef.current;
            const drinksCat = cat.filter((m) => inferMenuCategory(m) === "drink");
            const sidesCat = cat.filter((m) => inferMenuCategory(m) === "side");

            if (/선택안함|선택안해|음료없음|사이드없음|빼주세요|스킵/.test(normalized)) {
                if (!selectedDrinkSize && (!selectedDrink || selectedDrink === "")) {
                    setSelectedDrink(NONE_OPTION);
                    setSelectedDrinkSize(NONE_OPTION);
                    reply = "음료는 선택하지 않을게요. 사이드를 골라주세요.";
                } else if (selectedDrinkSize && (!selectedSide || selectedSide === "") && !selectedSideSize) {
                    setSelectedSide(NONE_OPTION);
                    setSelectedSideSize(NONE_OPTION);
                    reply = "사이드는 선택하지 않을게요.";
                }
            }

            if (!reply && (!selectedDrink || selectedDrink === "")) {
                for (const d of drinksCat) {
                    if (voiceNormalizedMatchesItem(normalized, d)) {
                        setSelectedDrink(d.name);
                        setSelectedDrinkSize("");
                        reply = `${d.name}를 선택했어요. 음료 사이즈를 선택해주세요.`;
                        break;
                    }
                }
            }

            if (
                !reply &&
                selectedDrink &&
                selectedDrink !== NONE_OPTION &&
                !selectedDrinkSize
            ) {
                if (/미디움|미디엄|중간/.test(normalized)) {
                    setSelectedDrinkSize("미디움");
                    reply = `${selectedDrink} 미디움으로 선택했어요.`;
                } else if (/라지|큰거|큰사이즈|큰/.test(normalized)) {
                    setSelectedDrinkSize("라지");
                    reply = `${selectedDrink} 라지로 선택했어요.`;
                }
            }

            if (
                !reply &&
                selectedDrinkSize &&
                (!selectedSide || selectedSide === "")
            ) {
                for (const s of sidesCat) {
                    if (voiceNormalizedMatchesItem(normalized, s)) {
                        setSelectedSide(s.name);
                        setSelectedSideSize("");
                        reply = `${s.name}를 선택했어요. 사이드 사이즈를 선택해주세요.`;
                        break;
                    }
                }
            }

            if (
                !reply &&
                selectedSide &&
                selectedSide !== NONE_OPTION &&
                !selectedSideSize
            ) {
                if (/미디움|미디엄|중간/.test(normalized)) {
                    setSelectedSideSize("미디움");
                    reply = `${selectedSide} 미디움으로 선택했어요.`;
                } else if (/라지|큰거|큰사이즈|큰/.test(normalized)) {
                    setSelectedSideSize("라지");
                    reply = `${selectedSide} 라지로 선택했어요.`;
                }
            }

            if (!reply) {
                const ex = drinksCat
                    .slice(0, 3)
                    .map((m) => m.name)
                    .join(", ");
                reply = `음료 이름과 사이즈, 이어서 사이드와 사이즈를 말씀해 주세요. 예: ${ex || "콜라"}`;
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

    /* 현재 합산 금액 변수 */
    function handleSelectionComplete() {
        const effectiveDrink = selectedDrink || NONE_OPTION;
        const effectiveDrinkSize = effectiveDrink === NONE_OPTION ? NONE_OPTION : selectedDrinkSize;
        const effectiveSide = selectedSide || NONE_OPTION;
        const effectiveSideSize = effectiveSide === NONE_OPTION ? NONE_OPTION : selectedSideSize;

        if ((effectiveDrink !== NONE_OPTION && !effectiveDrinkSize) || (effectiveSide !== NONE_OPTION && !effectiveSideSize)) {
            return false;
        }

        const drinkP = drinkSizePrice(effectiveDrink, effectiveDrinkSize, catalogItems);
        const sideP = sideUnitPriceCatalog(effectiveSide, effectiveSideSize, catalogItems);
        const totalPrice = menuPrice + drinkP + sideP;
        const setItems = [
            { name: menuName, price: menuPrice },
            ...(effectiveDrink === NONE_OPTION
                ? []
                : [{ name: effectiveDrink, size: effectiveDrinkSize, price: drinkP }]),
            ...(effectiveSide === NONE_OPTION
                ? []
                : [{ name: effectiveSide, size: effectiveSideSize, price: sideP }]),
        ];
        const sizeLabel = (size) => (size === "미디움" ? "중간" : size === "라지" ? "큰" : size);
        const selectedParts = [
            effectiveDrink !== NONE_OPTION ? `${effectiveDrink}(${sizeLabel(effectiveDrinkSize)})` : null,
            effectiveSide !== NONE_OPTION ? `${effectiveSide}(${sizeLabel(effectiveSideSize)})` : null,
        ].filter(Boolean);

        const newCartItems = [...cartItems];
        const cartName = [menuName, ...selectedParts].join(" + ").replace(/\s+\(/g, "(");
        newCartItems.push({
            id: `${menuId}_set_${Date.now()}`,
            name: cartName,
            price: totalPrice,
            qty: 1,
            type: "set",
            items: setItems,
        });
        const cartData = encodeURIComponent(JSON.stringify(newCartItems));
        const orderType = searchParams.get("orderType") || "takeout";
        navigateTo(`/menu?${entryQuery(entry)}&orderType=${orderType}&cart=${cartData}&${menuStateQuery()}`);
        return true;
    }

    const currentTotalPrice =
        menuPrice +
        drinkSizePrice(selectedDrink, selectedDrinkSize, catalogItems) +
        sideUnitPriceCatalog(selectedSide, selectedSideSize, catalogItems);
    
    const shell = (
        <main
            style={{
                display: "flex",
                flexDirection: "column",
                minHeight: entry === "qr" ? "100%" : "100vh",
                flex: entry === "qr" ? 1 : undefined,
                backgroundColor: "#ffffff",
                position: "relative",
            }}
        >
            {/* 음성 인식 로그창 - 항상 표시 */}
            <div
                    style={{
                        display: "none",
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
                        setIsBackButtonActive(true);
                        setTimeout(() => {
                            const cartData = encodeURIComponent(JSON.stringify(cartItems));
                            const orderType = searchParams.get("orderType") || "takeout";
                            navigateTo(`/menu-option?menuId=${menuId}&menuName=${encodeURIComponent(menuName)}&price=${menuPrice}&cart=${cartData}&orderType=${orderType}&${menuStateQuery()}&${entryQuery(entry)}`);
                        }, 120);
                    }}
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
                        flexDirection: "row-reverse",
                        gap: "8px",
                    }}
                >
                    뒤로가기
                    <img
                        src="/back.png"
                        alt=""
                        aria-hidden="true"
                        style={{ width: "22px", height: "22px", objectFit: "contain" }}
                    />
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
                        <h3 style={{ fontSize: "2rem", fontWeight: "bold", margin: 0 }}>
                            음료를 선택하세요
                        </h3>
                        {false && (
                            <div style={{ fontSize: "1rem", fontWeight: "700", color: "#1e7a39" }}>
                                {selectedDrink} :{" "}
                                {drinkSizeButtons.find((s) => s.name === selectedDrinkSize)?.price.toLocaleString() || "0"}원
                            </div>
                        )}
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
                                backgroundColor: selectedDrink === NONE_OPTION ? "#c8d8ea" : "#f5f8fc",
                                color: "#000",
                                border: selectedDrink === NONE_OPTION ? "2px solid #002e55" : "2px solid #d9e3ef",
                                borderRadius: "12px",
                                cursor: "pointer",
                                boxShadow: selectedDrink === NONE_OPTION ? "0 4px 10px rgba(0,0,0,0.12)" : "0 2px 6px rgba(0,0,0,0.06)",
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 8,
                                padding: "16px 12px",
                            }}
                        >
                            <div style={{ fontSize: "1.8rem", fontWeight: "800" }}>선택 안 함</div>
                        </button>
                        {drinkItems.map((d) => {
                            const thumb = menuThumbImageSrc(d);
                            return (
                                <button
                                    key={d.id || d.name}
                                    onClick={() => {
                                        setSelectedDrink(d.name);
                                        setSelectedDrinkSize("");
                                    }}
                                    style={{
                                        minHeight: "170px",
                                        fontSize: "1.1rem",
                                        fontWeight: "bold",
                                        backgroundColor: selectedDrink === d.name ? "#c8d8ea" : "#f5f8fc",
                                        color: "#000",
                                        border: selectedDrink === d.name ? "2px solid #002e55" : "2px solid #d9e3ef",
                                        borderRadius: "12px",
                                        cursor: "pointer",
                                        boxShadow:
                                            selectedDrink === d.name
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

                {/* 음료 사이즈 선택 */}
                {selectedDrink && selectedDrink !== NONE_OPTION && !selectedDrinkSize && (
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
                                const row = catalogItems.find((m) => m.name === selectedDrink);
                                const src = menuThumbImageSrc(row || { name: selectedDrink });
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
                                {selectedDrink}
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
                                {selectedDrink} 사이즈를 선택하세요
                            </div>
                            {drinkSizeButtons.map((size) => (
                                <button
                                    key={size.name}
                                    onClick={() => {
                                        setPendingDrinkSize(size.name);
                                        setTimeout(() => {
                                            setSelectedDrinkSize(size.name);
                                            setPendingDrinkSize("");
                                        }, 120);
                                    }}
                                    style={{
                                        height: "75px",
                                        fontSize: "1.5rem",
                                        fontWeight: "bold",
                                        backgroundColor: pendingDrinkSize === size.name ? "#c8d8ea" : "#f5f8fc",
                                        color: "#000",
                                        border: pendingDrinkSize === size.name ? "2px solid #002e55" : "2px solid #d9e3ef",
                                        borderRadius: "12px",
                                        cursor: "pointer",
                                        boxShadow:
                                            pendingDrinkSize === size.name
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
                                        <div style={{ display: "none", fontSize: "0.9rem", opacity: 0.9 }}>
                                            {size.name === "라지" ? `+500원 (총 ${size.price.toLocaleString()}원)` : `${size.price.toLocaleString()}원`}
                                        </div>
                                    </div>
                                    <span style={{ fontWeight: 800, fontSize: 0 }}>
                                        <span style={{ fontSize: "1.3rem" }}>{size.price.toLocaleString()}원</span>
                                        {size.name === "라지" ? "+500원" : "M"}
                                    </span>
                                </button>
                            ))}
                            <button
                                type="button"
                                onClick={() => {
                                    setIsCancelButtonActive(true);
                                    setTimeout(() => {
                                        setSelectedDrink("");
                                        setSelectedDrinkSize("");
                                        setIsCancelButtonActive(false);
                                    }, 120);
                                }}
                                style={{
                                    width: "fit-content",
                                    alignSelf: "center",
                                    marginTop: "8px",
                                    padding: "14px 24px",
                                    backgroundColor: isCancelButtonActive ? "#fec315" : "#002e55",
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

                {/* 사이드 선택 */}
                <div style={{ marginTop: "20px" }}>
                    <h3 style={{ fontSize: "2rem", fontWeight: "bold", marginBottom: "20px" }}>
                        사이드를 선택하세요
                    </h3>
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
                            gap: "12px",
                            maxWidth: "900px",
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
                                backgroundColor: selectedSide === NONE_OPTION ? "#c8d8ea" : "#f5f8fc",
                                color: "#000",
                                border: selectedSide === NONE_OPTION ? "2px solid #002e55" : "2px solid #d9e3ef",
                                borderRadius: "12px",
                                cursor: "pointer",
                                boxShadow: selectedSide === NONE_OPTION ? "0 4px 10px rgba(0,0,0,0.12)" : "0 2px 6px rgba(0,0,0,0.06)",
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 8,
                                padding: "16px 12px",
                            }}
                        >
                            <div style={{ fontSize: "1.8rem", fontWeight: "800" }}>선택 안 함</div>
                        </button>
                        {sideItems.map((item) => {
                            const thumb = menuThumbImageSrc(item);
                            return (
                                <button
                                    key={item.id || item.name}
                                    onClick={() => {
                                        setSelectedSide(item.name);
                                        setSelectedSideSize("");
                                    }}
                                    style={{
                                        minHeight: "170px",
                                        fontSize: "1.5rem",
                                        fontWeight: "bold",
                                        backgroundColor: selectedSide === item.name ? "#c8d8ea" : "#f5f8fc",
                                        color: "#000",
                                        border: selectedSide === item.name ? "2px solid #002e55" : "2px solid #d9e3ef",
                                        borderRadius: "12px",
                                        cursor: "pointer",
                                        boxShadow:
                                            selectedSide === item.name
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
                                    <div style={{ fontSize: "1.2rem", marginTop: 2, opacity: 0.85, color: "#002e55"}}>
                                        {sideBasePriceFromCatalog(item.name, catalogItems).toLocaleString()}원
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* 사이드 사이즈 선택 */}
                {selectedSide && selectedSide !== NONE_OPTION && !selectedSideSize && (
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
                                const row = catalogItems.find((m) => m.name === selectedSide);
                                const src = menuThumbImageSrc(row || { name: selectedSide });
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
                                {selectedSide}
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
                            {sideSizeOptions.map((size, index) => {
                                const p = sideUnitPriceCatalog(selectedSide, size.name, catalogItems);
                                return (
                                    <button
                                        key={size.name}
                                        onClick={() => {
                                            setPendingSideSize(size.name);
                                            setTimeout(() => {
                                                setSelectedSideSize(size.name);
                                                setPendingSideSize("");
                                            }, 120);
                                        }}
                                        style={{
                                            height: "75px",
                                            fontSize: "1.5rem",
                                            fontWeight: "bold",
                                            backgroundColor: pendingSideSize === size.name ? "#c8d8ea" : "#f5f8fc",
                                            color: "#000",
                                            border: pendingSideSize === size.name ? "2px solid #002e55" : "2px solid #d9e3ef",
                                            borderRadius: "12px",
                                            cursor: "pointer",
                                            boxShadow:
                                                pendingSideSize === size.name
                                                    ? "0 4px 10px rgba(0,0,0,0.12)"
                                                    : "0 2px 6px rgba(0,0,0,0.06)",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "space-between",
                                            padding: "0 20px",
                                        }}
                                    >
                                        <div>
                                            <div style={{ fontSize: 0, fontWeight: 700, lineHeight: 1.2 }}>
                                                <div style={{ fontSize: "1.5rem" }}>{index === 0 ? "중간 사이즈" : "큰 사이즈"}</div>
                                                <span style={{ fontSize: "1em" }}>{index === 0 ? "중간 사이즈로 주문하기" : "큰 사이즈로 주문하기"}</span>
                                                {size.name === "미디엄" ? "중간 사이즈로 주문하기" : "큰 사이즈로 주문하기"}
                                            </div>
                                            <div style={{ display: "none", fontSize: "0.85rem", opacity: 0.9 }}>
                                                {size.name === "라지" ? `+500원 (총 ${p.toLocaleString()}원)` : `${p.toLocaleString()}원`}
                                            </div>
                                        </div>
                                        <span style={{ fontWeight: 800, fontSize: "1.3rem" }}>{p.toLocaleString()}원</span>
                                    </button>
                                );
                            })}
                            <button
                                type="button"
                                onClick={() => {
                                    setIsCancelButtonActive(true);
                                    setTimeout(() => {
                                        setSelectedSide("");
                                        setSelectedSideSize("");
                                        setIsCancelButtonActive(false);
                                    }, 120);
                                }}
                                style={{
                                    width: "fit-content",
                                    alignSelf: "center",
                                    marginTop: "8px",
                                    padding: "14px 24px",
                                    backgroundColor: isCancelButtonActive ? "#fec315" : "#002e55",
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
                {false && selectedSide && selectedSide !== NONE_OPTION && !selectedSideSize && (
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
                            {(() => {
                                const row = catalogItems.find((m) => m.name === selectedSide);
                                const src = menuThumbImageSrc(row || { name: selectedSide });
                                return src ? (
                                    <img
                                        src={src}
                                        alt={selectedSide}
                                        style={{
                                            width: "100%",
                                            height: "100%",
                                            objectFit: "contain",
                                            display: "block",
                                        }}
                                    />
                                ) : (
                                    <div style={{ color: "#8aa0c5", fontWeight: 700 }}>사이드 이미지</div>
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
                                {selectedSide} 사이즈를 선택하세요
                            </div>
                            {sideSizeOptions.map((size) => {
                                const p = sideUnitPriceCatalog(selectedSide, size.name, catalogItems);
                                return (
                                    <button
                                        key={size.name}
                                        onClick={() => setSelectedSideSize(size.name)}
                                        style={{
                                            height: "70px",
                                            fontSize: "1.1rem",
                                            fontWeight: "bold",
                                            backgroundColor: selectedSideSize === size.name ? "#c8d8ea" : "#f5f8fc",
                                            color: "#000",
                                            border: selectedSideSize === size.name ? "2px solid #002e55" : "1px solid #d9e3ef",
                                            borderRadius: "10px",
                                            cursor: "pointer",
                                            boxShadow: selectedSideSize === size.name ? "0 4px 10px rgba(0,0,0,0.12)" : "none",
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
            <div
                style={{
                    position: "fixed",
                    right: "40px",
                    bottom: "130px",
                    backgroundColor: "transparent",
                    color: "#000000",
                    borderRadius: 0,
                    padding: "0",
                    fontSize: "1.8rem",
                    fontWeight: "800",
                    boxShadow: "none",
                    zIndex: 200,
                }}
            >
                현재 금액 | {currentTotalPrice.toLocaleString()}원
            </div>
            <button
                type="button"
                onClick={() => {
                    setIsCompleteButtonActive(true);
                    setTimeout(() => {
                        if (!handleSelectionComplete()) {
                            setIsCompleteButtonActive(false);
                        }
                    }, 120);
                }}
                style={{
                    position: "absolute",
                    right: "40px",
                    bottom: "40px",
                    backgroundColor: isCompleteButtonActive ? "#fec002" : "#ff3b30",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "10px",
                    padding: "14px 24px",
                    fontSize: "2rem",
                    fontWeight: "800",
                    cursor: "pointer",
                    boxShadow: "0 4px 10px rgba(0,0,0,0.12)",
                    zIndex: 9999,
                }}
            >
                선택 완료
            </button>
        </main>
    );
    return entry === "qr" ? <KioskAspectFrame>{shell}</KioskAspectFrame> : shell;
}

export default function DrinkSelectPage() {
    return (
        <Suspense fallback={<main style={{ minHeight: "100vh", backgroundColor: "#ffffff" }} />}>
            <DrinkSelectPageContent />
        </Suspense>
    );
}

