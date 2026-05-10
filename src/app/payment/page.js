"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getOrderFlowEntry, entryQuery } from "../utils/orderFlowEntry";

// 결제 페이지는 /points 한 곳으로 통합되었습니다.
// 어떤 경로로 /payment 에 진입하더라도 같은 파라미터로 /points 로 즉시 이동시킵니다.
function PaymentRedirect() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const entry = getOrderFlowEntry(searchParams);

    useEffect(() => {
        const cart = searchParams.get("cart") || "";
        const total = searchParams.get("total") || "";
        const orderType = searchParams.get("orderType") || "takeout";
        const phone = searchParams.get("phone") || "";
        const params = new URLSearchParams();
        if (cart) params.set("cart", cart);
        if (total) params.set("total", total);
        if (orderType) params.set("orderType", orderType);
        if (phone) params.set("phone", phone);
        const ent = entryQuery(entry);
        const qs = params.toString() + (ent ? `&${ent}` : "");
        router.replace(`/points?${qs}`);
    }, []);

    return <main style={{ minHeight: "100vh", backgroundColor: "#ffffff" }} />;
}

export default function PaymentPage() {
    return (
        <Suspense fallback={<main style={{ minHeight: "100vh", backgroundColor: "#ffffff" }} />}>
            <PaymentRedirect />
        </Suspense>
    );
}
