"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import KioskAspectFrame from "../../components/KioskAspectFrame";
import { speakKorean } from "../utils/speakKorean";

export default function QrOrderEntryPage() {
    const router = useRouter();
    const spokeRef = useRef(false);

    useEffect(() => {
        if (spokeRef.current) return;
        spokeRef.current = true;
        const msg = "매장에서 드실지, 포장하실지 선택해 주세요.";
        speakKorean(msg).catch(() => {});
    }, []);

    function handleOrderType(type) {
        router.push(`/menu?entry=qr&orderType=${type}`);
    }

    return (
        <KioskAspectFrame>
            <main
                style={{
                    flex: 1,
                    minHeight: 0,
                    display: "flex",
                    flexDirection: "column",
                    height: "100%",
                    backgroundColor: "#ffffff",
                    overflow: "hidden",
                }}
            >
                <div
                    style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "flex-end",
                        justifyContent: "space-between",
                        padding: "5px 24px",
                        backgroundColor: "#ffffff",
                        position: "relative",
                        flexShrink: 0,
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "8px",
                            flex: 1,
                            paddingBottom: "16px",
                        }}
                    >
                        <div
                            style={{
                                fontSize: "1.35rem",
                                fontWeight: "600",
                                color: "#000000",
                                lineHeight: "1.4",
                            }}
                        >
                            안녕하세요!
                        </div>
                        <div
                            style={{
                                fontSize: "1.35rem",
                                fontWeight: "600",
                                lineHeight: "1.4",
                            }}
                        >
                            <span style={{ color: "#1e7a39" }}>연두</span>
                            <span style={{ color: "#000000" }}>햄버거입니다.</span>
                        </div>
                    </div>
                    <div
                        style={{
                            width: "120px",
                            height: "120px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                        }}
                    >
                        <img
                            src="/c1.png"
                            alt="연두햄버거 캐릭터"
                            style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "contain",
                                display: "block",
                            }}
                        />
                    </div>
                </div>

                <div
                    style={{
                        width: "100%",
                        height: "1px",
                        backgroundColor: "#cccccc",
                        flexShrink: 0,
                    }}
                />

                <div
                    style={{
                        width: "100%",
                        textAlign: "center",
                        padding: "28px 16px",
                        backgroundColor: "#ffffff",
                        flexShrink: 0,
                    }}
                >
                    <div
                        style={{
                            fontSize: "1.5rem",
                            fontWeight: "700",
                            color: "#000000",
                            lineHeight: "1.4",
                        }}
                    >
                        원하시는 항목을 선택해주세요
                    </div>
                </div>

                <div
                    style={{
                        flex: 1,
                        minHeight: 0,
                        display: "flex",
                        flexDirection: "column",
                        gap: "16px",
                        padding: "16px 20px 24px",
                        justifyContent: "center",
                        alignItems: "stretch",
                        backgroundColor: "#ffffff",
                    }}
                >
                    <button
                        type="button"
                        onClick={() => handleOrderType("dinein")}
                        style={{
                            flex: 1,
                            minHeight: "120px",
                            maxHeight: "220px",
                            backgroundColor: "#1e7a39",
                            color: "#ffffff",
                            border: "none",
                            borderRadius: "16px",
                            cursor: "pointer",
                            fontSize: "1.65rem",
                            fontWeight: "700",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                        }}
                    >
                        여기서 먹기
                    </button>
                    <button
                        type="button"
                        onClick={() => handleOrderType("takeout")}
                        style={{
                            flex: 1,
                            minHeight: "120px",
                            maxHeight: "220px",
                            backgroundColor: "#1e7a39",
                            color: "#ffffff",
                            border: "none",
                            borderRadius: "16px",
                            cursor: "pointer",
                            fontSize: "1.65rem",
                            fontWeight: "700",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                        }}
                    >
                        포장하기
                    </button>
                </div>
            </main>
        </KioskAspectFrame>
    );
}
