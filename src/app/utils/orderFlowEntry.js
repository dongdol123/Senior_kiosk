/**
 * Kiosk uses entry=voice; QR mobile order flow uses entry=qr.
 * @param {{ get: (key: string) => string | null }} searchParams
 * @returns {"voice" | "qr"}
 */
export function getOrderFlowEntry(searchParams) {
    const raw = searchParams?.get?.("entry");
    if (raw && raw.toLowerCase() === "qr") return "qr";
    return "voice";
}

/** Query fragment: `entry=voice` | `entry=qr` */
export function entryQuery(entry) {
    return entry === "qr" ? "entry=qr" : "entry=voice";
}

/** QR flow must pick dine-in / takeout on /qr-order first */
export function qrRequiresOrderTypeRedirect(searchParams) {
    return getOrderFlowEntry(searchParams) === "qr" && !searchParams?.get?.("orderType");
}
