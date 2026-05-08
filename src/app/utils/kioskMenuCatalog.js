/** 키오스크 메뉴 카탈로그: 메인 메뉴 페이지와 세트(음료·사이드) 선택에서 동일한 목록·분류를 씁니다. */

export function normalizeMenuKey(name) {
    return (name || "").replace(/\s+/g, "").toLowerCase();
}

export const STATIC_MENU = [
    {
        id: "bur-bulgogi",
        name: "불고기버거",
        price: 5000,
        category: "burger",
        image: "/bulgogi.png",
        keywords: ["불고기", "불고기버거", "불버거", "bulgogi"],
    },
    {
        id: "bur-mozza",
        name: "치즈 불고기버거",
        price: 4800,
        category: "burger",
        image: "/cheese.png",
        keywords: ["치즈", "치즈불고기버거", "불고기", "cheese", "bulgogi"],
    },
    {
        id: "bur-chicken",
        name: "치킨버거",
        price: 4800,
        category: "burger",
        image: "/chicken.png",
        keywords: ["치킨", "치킨버거", "치버거", "chicken"],
    },
    {
        id: "bur-shrimp",
        name: "새우버거",
        price: 6000,
        category: "burger",
        image: "/shrimp.png",
        keywords: ["새우", "새우버거", "shrimp"],
    },
    {
        id: "bur-triple",
        name: "더블 불고기버거",
        price: 5500,
        category: "burger",
        image: "/double_bulgogi.png",
        keywords: ["더블", "더블불고기버거", "불고기", "double", "bulgogi"],
    },
    {
        id: "bur-bacon",
        name: "베이컨 불고기버거",
        price: 4600,
        category: "burger",
        image: "/bacon_bulgogi.png",
        keywords: ["베이컨", "불고기", "베이컨불고기버거", "bacon", "bulgogi", "토마토"],
    },
    {
        id: "bur-chili-shrimp",
        name: "칠리 새우버거",
        price: 6200,
        category: "burger",
        image: "/chilli_shrimp.png",
        keywords: ["칠리", "칠리새우", "새우", "shrimp", "chili"],
    },
    {
        id: "bur-truffle-shrimp",
        name: "크림 새우버거",
        price: 6500,
        category: "burger",
        image: "/cream_shrimp.png",
        keywords: ["크림", "크림새우", "새우", "shrimp", "cream"],
    },
    {
        id: "bur-mush",
        name: "버섯 불고기버거",
        price: 6000,
        category: "burger",
        image: "/mushroom_bulgogi.png",
        keywords: ["버섯", "버섯불고기버거", "불고기", "머쉬룸", "머시룸", "mushroom"],
    },
    {
        id: "bur-garlic",
        name: "마늘 불고기버거",
        price: 5300,
        category: "burger",
        image: "/garlic_bulgogi.png",
        keywords: ["마늘", "마늘불고기버거", "불고기", "garlic", "bulgogi"],
    },
    {
        id: "side-fries",
        name: "감자튀김",
        price: 2500,
        category: "side",
        image: "/fries.png",
        keywords: ["감자튀김", "감튀", "프렌치프라이", "french", "fries", "프라이드", "포테이토"],
    },
    {
        id: "side-hash",
        name: "해시브라운",
        price: 2500,
        category: "side",
        image: "/hashbrown.png",
        keywords: ["해시", "해쉬", "hash", "브라운", "해시브라운"],
    },
    {
        id: "side-wing",
        name: "치킨윙",
        price: 4000,
        category: "side",
        image: "/wing.png",
        keywords: ["치킨윙", "윙", "wing"],
    },
    {
        id: "drink-cola",
        name: "콜라",
        price: 2500,
        category: "drink",
        image: "/coke.png",
        keywords: ["콜라", "코크", "coke", "콜라주스", "탄산"],
    },
    {
        id: "drink-zerocola",
        name: "제로콜라",
        price: 2500,
        category: "drink",
        image: "/zero_coke.png",
        keywords: ["제로콜라", "제로", "zero", "제로코크", "다이어트콜라"],
    },
    {
        id: "drink-cider",
        name: "사이다",
        price: 2500,
        category: "drink",
        image: "/cider.png",
        keywords: ["사이다", "cider", "사이다주", "soda", "스프라이트"],
    },
    {
        id: "drink-zero-cider",
        name: "제로사이다",
        price: 2500,
        category: "drink",
        image: "/zero_cider.png",
        keywords: ["제로사이다", "제로", "zero", "cider", "soda"],
    },
    {
        id: "drink-coffee",
        name: "아메리카노",
        price: 2500,
        category: "drink",
        image: "/americano.png",
        keywords: ["아메리카노", "아메", "coffee", "americano", "커피"],
    },
    {
        id: "drink-latte",
        name: "카페라떼",
        price: 2500,
        category: "drink",
        image: "/caffelatte.png",
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
        id: "side-salad",
        name: "코울슬로",
        price: 3000,
        category: "side",
        image: "/coleslaw.png",
        keywords: ["코울슬로", "coleslaw", "샐러드", "salad"],
    },
];

export function inferMenuCategory(item) {
    if (item?.category) return item.category;
    const n = normalizeMenuKey(item?.name);
    if (/버거|burger/.test(n)) return "burger";
    if (/카페라떼|라떼|아이스티|icetea|icedtea|콜라|제로콜라|사이다|제로사이다|커피|아메리카노|americano/.test(n)) return "drink";
    if (/치킨윙|윙|wing|해쉬브라운|해시브라운|hash|코울슬로|coleslaw|샐러드|salad|감자튀김|감튀/.test(n)) return "side";
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

    const staticOrder = new Map(STATIC_MENU.map((item, index) => [normalizeMenuKey(item.name), index]));
    canonical.sort((a, b) => {
        const aOrder = staticOrder.get(normalizeMenuKey(a?.name)) ?? Number.MAX_SAFE_INTEGER;
        const bOrder = staticOrder.get(normalizeMenuKey(b?.name)) ?? Number.MAX_SAFE_INTEGER;
        return aOrder - bOrder;
    });

    return canonical;
}

export function menuThumbImageSrc(m) {
    if (m?.image) return m.image;
    const n = normalizeMenuKey(m?.name);
    if (/칠리/.test(n)) return "/chilli_shrimp.png";
    if (/크림|cream/.test(n)) return "/cream_shrimp.png";
    if (/새우|shrimp/.test(n)) return "/shrimp.png";
    if (/치킨/.test(n) && /버거/.test(n)) return "/chicken.png";
    if (/불고기/.test(n) && /버거/.test(n)) return "/bulgogi.png";
    if (/버거/.test(n)) return "/burger.png";
    if (/제로콜라/.test(n)) return "/zero_coke.png";
    if (/콜라/.test(n)) return "/coke.png";
    if (/제로사이다/.test(n)) return "/zero_cider.png";
    if (/사이다/.test(n)) return "/cider.png";
    if (/커피|아메리카노|americano/.test(n)) return "/americano.png";
    if (/감자튀김/.test(n)) return "/fries.png";
    if (/코울슬로|coleslaw|샐러드/.test(n)) return "/coleslaw.png";
    if (/치킨텐더/.test(n)) return "/tender_main.png";
    if (/카페라떼|라떼|latte/.test(n)) return "/caffelatte.png";
    if (/아이스티|icetea/.test(n)) return "/icetea.png";
    if (/치킨윙|윙/.test(n)) return "/wing.png";
    if (/해쉬|해시|hash|브라운/.test(n)) return "/hashbrown.png";
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
