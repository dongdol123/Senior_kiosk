/** 키오스크 메뉴 카탈로그: 메인 메뉴 페이지와 세트(음료·사이드) 선택에서 동일한 목록·분류를 씁니다. */

export function normalizeMenuKey(name) {
    return (name || "").replace(/\s+/g, "").toLowerCase();
}

export const STATIC_MENU = [
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
    {
        id: "drink-cola",
        name: "콜라",
        price: 2500,
        category: "drink",
        image: "/coke_main.png",
        keywords: ["콜라", "코크", "coke", "콜라주", "탄산"],
    },
    {
        id: "drink-zerocola",
        name: "제로콜라",
        price: 2500,
        category: "drink",
        image: "/coke_main.png",
        keywords: ["제로콜라", "제로", "zero", "제로코크", "다이어트콜라"],
    },
    {
        id: "drink-cider",
        name: "사이다",
        price: 2500,
        category: "drink",
        image: "/cider_main.png",
        keywords: ["사이다", "cider", "사이다주", "soda", "스프라이트"],
    },
    {
        id: "drink-coffee",
        name: "커피",
        price: 2500,
        category: "drink",
        image: "/coffee_main.png",
        keywords: ["커피", "coffee", "아메리카노", "아메", "핫커피"],
    },
    {
        id: "side-fries",
        name: "감자튀김",
        price: 2500,
        category: "side",
        image: "/french_fries_main.png",
        keywords: ["감자튀김", "감튀", "프렌치프라이", "french", "fries", "후라이드", "포테이토"],
    },
    {
        id: "side-salad",
        name: "샐러드",
        price: 3000,
        category: "side",
        image: "/salad_main.png",
        keywords: ["샐러드", "salad", "그린샐러드", "야채샐러드"],
    },
];

export function inferMenuCategory(item) {
    if (item?.category) return item.category;
    const n = normalizeMenuKey(item?.name);
    if (/버거|burger/.test(n)) return "burger";
    if (/카페라떼|라떼|아이스티|icetea|icedtea|콜라|제로콜라|사이다|커피/.test(n)) return "drink";
    if (/치킨윙|윙|wing|해쉬브라운|해시브라운|hash|샐러드|salad|감자튀김|감튀/.test(n)) return "side";
    return "";
}

/**
 * GET /api/menu 의 JSON 본문으로 메인 화면과 동일한 병합 목록을 만듭니다.
 * menus 가 비어 있으면 null (호출 측에서 기존 상태 유지).
 */
export function mergeMenusFromApiResponse(data) {
    if (!data?.menus?.length) return null;

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
            keywords: st?.keywords?.length ? st.keywords : item.keywords ?? [],
        };
    });

    const existingNames = new Set(canonical.map((m) => normalizeMenuKey(m.name)));
    STATIC_MENU.forEach((item) => {
        if (!existingNames.has(normalizeMenuKey(item.name))) {
            canonical.push({ ...item });
        }
    });

    return canonical;
}

export function menuThumbImageSrc(m) {
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
    if (/카페라떼|라떼|latte/.test(n)) return "/latte.png";
    if (/아이스티|icetea/.test(n)) return "/icetea.png";
    if (/치킨윙|윙/.test(n)) return "/wing.png";
    if (/해쉬|해시|hash|브라운/.test(n)) return "/hash.png";
    return null;
}

export function voiceNormalizedMatchesItem(normalizedTranscript, item) {
    const t = normalizedTranscript || "";
    const nk = normalizeMenuKey(item.name);
    if (nk && t.includes(nk)) return true;
    for (const kw of item.keywords || []) {
        const k = normalizeMenuKey(kw);
        if (k && t.includes(k)) return true;
    }
    return false;
}

/** API 없음·실패·빈 menus 일 때 세트 픽커·메뉴 화면용 최소 전체 목록 */
export function staticMenuCatalogCopy() {
    return STATIC_MENU.map((m) => ({ ...m }));
}
