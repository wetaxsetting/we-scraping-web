import type { VasAccountRow } from "./types";

/**
 * Static VAS Account rows — Figma 9194:8615. Three top-level parents
 * (111 / 112 / 113) followed by their children. Names mirror the live
 * WeCMS legacy values (Vietnamese), preserved verbatim from the Figma
 * frame so the static UI reads identically to the design.
 *
 * Replace with the real `/api/v1/settings/vas-accounts` response once the
 * endpoint lands — the row shape is the contract.
 */
export const mockVasAccountRows: VasAccountRow[] = [
    {
        id: "vas-111",
        kind: "parent",
        vasCode: "111",
        accountName: "Tiền mặt",
        status: "active",
    },
    {
        id: "vas-1111",
        kind: "child",
        vasCode: "1111",
        accountName: "Tiền Việt Nam",
        parentCode: "111",
        status: "active",
    },
    {
        id: "vas-1112",
        kind: "child",
        vasCode: "1112",
        accountName: "Ngoại tệ",
        parentCode: "111",
        status: "active",
    },
    {
        id: "vas-112",
        kind: "parent",
        vasCode: "112",
        accountName: "Tiền gửi Ngân hàng",
        status: "active",
    },
    {
        id: "vas-1121",
        kind: "child",
        vasCode: "1121",
        accountName: "Tiền Việt Nam",
        parentCode: "112",
        status: "active",
    },
    {
        id: "vas-1122",
        kind: "child",
        vasCode: "1122",
        accountName: "shin....001 VND",
        parentCode: "112",
        status: "active",
    },
    {
        id: "vas-113",
        kind: "parent",
        vasCode: "113",
        accountName: "Tiền đang chuyển",
        status: "active",
    },
    {
        id: "vas-1131",
        kind: "child",
        vasCode: "1131",
        accountName: "Tiền Việt Nam",
        parentCode: "113",
        status: "active",
    },
    {
        id: "vas-1132",
        kind: "child",
        vasCode: "1132",
        accountName: "Chi phí vật liệu, bao bì",
        parentCode: "113",
        status: "active",
    },
    {
        id: "vas-1133",
        kind: "child",
        vasCode: "1133",
        accountName: "Chi phí dụng cụ, đồ dùng",
        parentCode: "113",
        status: "active",
    },
];
