import type { PurposeNode } from "./types";

/**
 * Static mock tree for the Purpose panel. Values mirror Figma 9438:19204
 * — BD01 carries four children (Interest / Dividend / Capital Gain /
 * Sales); BD02-BD04 are level-1 leaves. Replaces the legacy flat list
 * once the settings API lands.
 */
export const mockPurposeTree: PurposeNode[] = [
    {
        id: "bd01",
        code: "BD01",
        name: "Financial Investment Income",
        description: "-",
        enabled: true,
        children: [
            {
                id: "bd01-01",
                code: "BD01-01",
                name: "Interest Income",
                description: "-",
                enabled: true,
            },
            {
                id: "bd01-02",
                code: "BD01-02",
                name: "Dividend Income",
                description: "-",
                enabled: true,
            },
            {
                id: "bd01-03",
                code: "BD01-03",
                name: "Capital Gain",
                description: "-",
                enabled: true,
            },
            {
                id: "bd01-04",
                code: "BD01-04",
                name: "Sales",
                description: "-",
                enabled: true,
            },
        ],
    },
    {
        id: "bd02",
        code: "BD02",
        name: "Withdrawal",
        description: "-",
        enabled: true,
    },
    {
        id: "bd03",
        code: "BD03",
        name: "Advance Payment Refund",
        description: "-",
        enabled: true,
    },
    {
        id: "bd04",
        code: "BD04",
        name: "VAT Refund",
        description: "-",
        enabled: true,
    },
];
