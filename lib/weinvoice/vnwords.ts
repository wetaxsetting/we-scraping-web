/** Đọc số tiền bằng chữ (tiếng Việt) — "Một triệu hai trăm nghìn đồng". */
const D = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];

function readTriple(n: number, full: boolean): string {
    const h = Math.floor(n / 100);
    const t = Math.floor((n % 100) / 10);
    const u = n % 10;
    const out: string[] = [];
    if (full || h > 0) out.push(`${D[h]} trăm`);
    if (t > 1) {
        out.push(`${D[t]} mươi`);
        if (u === 1) out.push("mốt");
        else if (u === 5) out.push("lăm");
        else if (u === 4) out.push("tư");
        else if (u > 0) out.push(D[u]);
    } else if (t === 1) {
        out.push("mười");
        if (u === 5) out.push("lăm");
        else if (u > 0) out.push(D[u]);
    } else if (u > 0) {
        if (full || h > 0) out.push("lẻ");
        out.push(D[u]);
    }
    return out.join(" ");
}

export function vnMoneyWords(amount: number, unit = "đồng"): string {
    let n = Math.round(Math.abs(amount));
    if (n === 0) return `Không ${unit}`;
    const units = ["", " nghìn", " triệu", " tỷ", " nghìn tỷ", " triệu tỷ"];
    const groups: number[] = [];
    while (n > 0) {
        groups.push(n % 1000);
        n = Math.floor(n / 1000);
    }
    const parts: string[] = [];
    for (let i = groups.length - 1; i >= 0; i--) {
        if (groups[i] === 0) continue;
        parts.push(readTriple(groups[i], i < groups.length - 1) + units[i]);
    }
    const s = parts.join(" ").replace(/\s+/g, " ").trim();
    return s.charAt(0).toUpperCase() + s.slice(1) + ` ${unit}`;
}
