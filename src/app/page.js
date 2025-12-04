"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState("");

  function handleOrderType(type) {
    // 포장 또는 매장 선택 시 바로 음성 주문 시작
    router.push(`/menu?entry=voice&orderType=${type}`);
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
      {/* 상단 문구 */}
      <div
        style={{
          padding: "24px",
          textAlign: "center",
          backgroundColor: "#fff",
          borderBottom: "2px solid #e5e5e5",
        }}
      >
        <h1 style={{ fontSize: "1.8rem", fontWeight: "bold", color: "#333" }}>
          대화하면서 주문이 가능한 음성인식 키오스크 입니다.
        </h1>
      </div>

      {/* 메인 컨텐츠 영역 */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "40px 20px",
          gap: "40px",
        }}
      >
        {/* 가운데 이미지 영역 */}
        <div
          style={{
            width: "100%",
            maxWidth: "600px",
            height: "300px",
            background: "#f3f3f3",
            border: "2px dashed #ddd",
            borderRadius: "16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#999",
            fontSize: "1.2rem",
          }}
        >
          이미지 영역
        </div>

        {/* 포장/매장 선택 버튼 */}
        <div
          style={{
            display: "flex",
            gap: "24px",
            width: "100%",
            maxWidth: "800px",
          }}
        >
          {/* 포장 버튼 */}
          <button
            onClick={() => handleOrderType("takeout")}
            style={{
              flex: 1,
              height: "200px",
              fontSize: "2.5rem",
              fontWeight: "bold",
              backgroundColor: "#1e7a39",
              color: "#fff",
              border: "none",
              borderRadius: "20px",
              cursor: "pointer",
              boxShadow: "0 8px 16px rgba(0,0,0,0.15)",
              transition: "transform 0.2s, box-shadow 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "scale(1.02)";
              e.currentTarget.style.boxShadow = "0 12px 24px rgba(0,0,0,0.2)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "scale(1)";
              e.currentTarget.style.boxShadow = "0 8px 16px rgba(0,0,0,0.15)";
            }}
          >
            포장
          </button>

          {/* 매장 버튼 */}
          <button
            onClick={() => handleOrderType("dinein")}
            style={{
              flex: 1,
              height: "200px",
              fontSize: "2.5rem",
              fontWeight: "bold",
              backgroundColor: "#ff6b35",
              color: "#fff",
              border: "none",
              borderRadius: "20px",
              cursor: "pointer",
              boxShadow: "0 8px 16px rgba(0,0,0,0.15)",
              transition: "transform 0.2s, box-shadow 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "scale(1.02)";
              e.currentTarget.style.boxShadow = "0 12px 24px rgba(0,0,0,0.2)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "scale(1)";
              e.currentTarget.style.boxShadow = "0 8px 16px rgba(0,0,0,0.15)";
            }}
          >
            매장
          </button>
        </div>
      </div>

      {errorMessage ? (
        <div style={{ color: "#b00020", padding: "16px", textAlign: "center" }}>{errorMessage}</div>
      ) : null}
    </main>
  );
}
