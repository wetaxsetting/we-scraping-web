/* ============================================================================
 *  Memo drawer — static sample data.
 *
 *  STATIC UI ONLY. Hardcoded seed rows so the drawer renders a realistic
 *  list without any API / fetch. Matches the Figma reference content
 *  (Minh Chau + An Hoang) plus three extra rows to exercise scrolling.
 * ========================================================================== */

import type { MemoColor, Memo } from "./types";

/** Category color tags shown in the header (Figma order: green → purple).
 *  Each maps to the canonical PNG asset already committed under
 *  public/assets/memo/ (reused verbatim from the live JEX memo drawer). */
export const MEMO_COLORS: { value: MemoColor; label: string; asset: string }[] = [
    { value: "green",  label: "Green",  asset: "/assets/memo/fileG.png" },
    { value: "blue",   label: "Blue",   asset: "/assets/memo/fileB.png" },
    { value: "yellow", label: "Yellow", asset: "/assets/memo/fileY.png" },
    { value: "gray",   label: "Gray",   asset: "/assets/memo/fileW.png" },
    { value: "pink",   label: "Pink",   asset: "/assets/memo/fileR.png" },
    { value: "purple", label: "Purple", asset: "/assets/memo/fileP.png" },
];

/** Author stamped on memos added from the composer (current user, static). */
export const CURRENT_USER = "Hoang Anh";

export const MOCK_MEMOS: Memo[] = [
    {
        id:       "m-1",
        author:   "Minh Chau",
        message:
            "Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s,",
        datetime: "13-01-2025 13:33",
    },
    {
        id:       "m-2",
        author:   "An Hoang",
        message:  "the industry's standard dummy text ever since the 1500s,",
        datetime: "13-01-2025 13:33",
    },
    {
        id:       "m-3",
        author:   "Taylor Morgan",
        message:
            "It is a long established fact that a reader will be distracted by the readable content of a page when looking at its layout.",
        datetime: "05-10-2024 12:12",
    },
    {
        id:       "m-4",
        author:   "Bao Nguyen",
        message:  "Please confirm the reporting account before the next approval round.",
        datetime: "02-10-2024 09:41",
    },
    {
        id:       "m-5",
        author:   "Linh Tran",
        message:
            "Contrary to popular belief, Lorem Ipsum is not simply random text. It has roots in a piece of classical Latin literature from 45 BC.",
        datetime: "28-09-2024 16:20",
    },
];
