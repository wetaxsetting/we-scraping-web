import type { ApprovalLineRow } from "./types";

/**
 * Static mock rows for the Approval Line panel — values mirror Figma
 * 9196:11717 so the static UI matches the design hand-off pixel for pixel
 * until the settings API lands.
 */
export const mockApprovalLineRows: ApprovalLineRow[] = [
    {
        id: "al-1",
        name: "Expenese Monthly",
        approverName: "Bamboo Grove",
        approverCount: 2,
        createDate: "2025-02-27",
    },
    {
        id: "al-2",
        name: "Golden Sands",
        approverName: "Golden Sands",
        createDate: "2025-02-27",
    },
    {
        id: "al-3",
        name: "Lotus Lake",
        approverName: "Lotus Lake",
        approverCount: 1,
        createDate: "2025-02-27",
    },
    {
        id: "al-4",
        name: "Dragon's Rest",
        approverName: "Dragon's Rest",
        approverCount: 2,
        createDate: "2025-02-27",
    },
    {
        id: "al-5",
        name: "Emerald Valley",
        approverName: "Emerald Valley",
        approverCount: 2,
        createDate: "2025-02-27",
    },
    {
        id: "al-6",
        name: "Mango Orchard",
        approverName: "Mango Orchard",
        createDate: "2025-02-27",
    },
    {
        id: "al-7",
        name: "Jade Mountain",
        approverName: "Jade Mountain",
        approverCount: 2,
        createDate: "2025-02-27",
    },
];
