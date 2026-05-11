"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { entryQuery, getOrderFlowEntry } from "../utils/orderFlowEntry";

// `/menu?...&showShrimpPopup=1`로 이동합니다. 새우 추천·메뉴 정보 안내 팝업은 menu/page.js 에 구현되어 있습니다.

function ShrimpRecommendRedirect() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const entry = getOrderFlowEntry(searchParams);

    useEffect(() => {
        const cartParam = searchParams.get("cart");
        const orderType = searchParams.get("orderType") || "takeout";
        const cartQuery = cartParam ? `&cart=${cartParam}` : "";
        router.replace(`/menu?${entryQuery(entry)}&orderType=${orderType}${cartQuery}&showShrimpPopup=1`);
    }, [entry, router, searchParams]);

    return null;
}

export default function ShrimpRecommendPage() {
    return (
        <Suspense fallback={null}>
            <ShrimpRecommendRedirect />
        </Suspense>
    );
}
