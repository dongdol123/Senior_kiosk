"use client";

const STEPS = ["메뉴 선택", "결제하기", "완료"];

export default function KioskProgressBars({ activeIndex = 1 }) {
  return (
    <div
      style={{
        flexShrink: 0,
        backgroundColor: "#ffffff",
        padding: "10px 24px 14px",
        borderBottom: "1px solid #e5e5e5",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: "18px",
          alignItems: "end",
          maxWidth: "900px",
          margin: "0 auto",
        }}
      >
        {STEPS.map((label, index) => {
          const filled = index < activeIndex;

          return (
            <div
              key={label}
              style={{ display: "flex", flexDirection: "column", gap: "4px" }}
            >
              <div
                style={{
                  fontSize: "18px",
                  fontWeight: "700",
                  color: "#000000",
                  textAlign: "center",
                }}
              >
                {label}
              </div>
              <div
                style={{
                  height: "16px",
                  backgroundColor: "#d9e3ef",
                  borderRadius: "999px",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: filled ? "100%" : "0%",
                    height: "100%",
                    backgroundColor: "#002e55",
                    borderRadius: "999px",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
