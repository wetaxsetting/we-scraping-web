"use client";

import { useCallback, useRef, useState } from "react";
import * as XLSX from "xlsx";

import type { ExcelUploadRow } from "@/components/shared/excel-upload/ExcelUploadDialog";
import { useTranslation } from "@/lib/i18n";
import { readXlsxQuiet } from "@/lib/xlsxReader";

const CODE_PATTERN = /^[A-Za-z0-9_-]+$/;
// Legacy `comm_0223_002_r001_act.jsp:293` caps the cell at 10 chars
// via `DatImpWizHelper.checkValidStringInMax(..., true, 10)`. Mirror
// that exactly — backend Bean Validation enforces the same max.
const CODE_MAX_LEN = 10;
/** Business rule (PO directive 2026-05-25): only level 2 + level 3
 *  are user-creatable; level 1 is reserved for the three seeded
 *  RESTRICTED_CODES (ACC-01 / ACC-02 / ACC-03). Matches backend
 *  `ChartOfAccountsConstants.MAX_HIERARCHY_DEPTH`. */
const MAX_DEPTH = 3;

export type ChartUploadState = {
    fileName: string | null;
    rows: ExcelUploadRow[];
    completedCount: number;
    errorCount: number;
    /** true when at least one row was parsed and none have errors */
    isReady: boolean;
};

export type UseChartOfAccountsExcelUploadReturn = ChartUploadState & {
    inputRef: React.RefObject<HTMLInputElement | null>;
    onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    /** Parse + validate a File directly. Callers that need to run an
     *  out-of-band check (e.g. template-shape validation) before
     *  parsing can intercept the input's change event themselves and
     *  call {@code loadFile(file)} on success. */
    loadFile: (file: File) => void;
    triggerFilePick: () => void;
    reset: () => void;
};

const EMPTY: ChartUploadState = {
    fileName: null,
    rows: [],
    completedCount: 0,
    errorCount: 0,
    isReady: false,
};

/**
 * Excel-upload hook for Settings > Chart of Accounts.
 *
 * Parses the selected .xlsx / .xls file with SheetJS (already in
 * `package.json` as `"xlsx": "^0.18.5"`), validates every data row,
 * and returns a `rows: ExcelUploadRow[]` array ready for the shared
 * `<ExcelUploadDialog>` preview table.
 *
 * Column mapping — the hook reads the first sheet's header row and
 * matches columns by their translated header text (case-insensitive).
 * Positional fallback (A=code, B=name_en, C=name_vi, D=name_ko,
 * E=parent) kicks in when no headers match, so a plain data-only
 * sheet still parses correctly.
 *
 * Validation rules (mirrors `ChartOfAccountsInlineRow` + backend +
 * legacy `comm_0223_002_r001_act.jsp`):
 *   - code      required, ≤ 10 chars, /^[A-Za-z0-9_-]+$/
 *   - name_en   required
 *   - name_vi   optional
 *   - name_ko   optional
 *   - parent    **required** — PO directive 2026-05-25: level 1 (NULL
 *               parent) is reserved for the three seeded
 *               RESTRICTED_CODES (ACC-01 / ACC-02 / ACC-03); user-driven
 *               writes must land at level 2 or level 3 (parent must be
 *               ACC-01/02/03 for level 2, or a level-2 code for level 3).
 *   - depth ≤ 3 — in-memory walk through parent-codes referenced in the
 *               file. Parents NOT in the file are treated as external
 *               roots (level 1) so a row pointing to ACC-01 is depth 2;
 *               a row pointing to an in-file row that points to ACC-01
 *               is depth 3; anything deeper is flagged. Backend
 *               re-runs the same check against the live tenant slice
 *               so an Excel row pointing to a deep DB-only ancestor
 *               still fails at upload.
 *   - duplicate code within the file → both rows flagged
 */
export function useChartOfAccountsExcelUpload(): UseChartOfAccountsExcelUploadReturn {
    const { t } = useTranslation();
    const inputRef = useRef<HTMLInputElement>(null);
    const [state, setState] = useState<ChartUploadState>(EMPTY);

    const parseAndValidate = useCallback(
        (file: File) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const buffer = e.target?.result;
                    if (!buffer) return;

                    const wb = readXlsxQuiet(buffer as ArrayBuffer, { type: "array" });
                    const ws = wb.Sheets[wb.SheetNames[0]];
                    if (!ws) {
                        setState({ ...EMPTY, fileName: file.name });
                        return;
                    }

                    // `defval: ""` keeps empty cells present so positional
                    // fallback indices stay stable; `raw: false` coerces
                    // numbers/dates to strings so no extra formatting step.
                    const raw = XLSX.utils.sheet_to_json<string[]>(ws, {
                        header: 1,
                        defval: "",
                        raw: false,
                    });

                    // The official templates have 2 title rows before the
                    // actual header (row 0: "LIST OF CHART OF ACCOUNTS",
                    // row 1: empty, row 2: column headers). Scan the first
                    // 5 rows for the one that contains a known code-column
                    // keyword so the hook works regardless of how many
                    // title rows precede the headers.
                    const CODE_KEYWORDS = [
                        "account code", "code", "계정 코드", "mã tài khoản",
                    ];
                    let headerRowIdx = 0;
                    for (let i = 0; i < Math.min(5, raw.length); i++) {
                        const cells = (raw[i] ?? []).map((c) =>
                            String(c ?? "").trim().toLowerCase(),
                        );
                        if (CODE_KEYWORDS.some((kw) => cells.includes(kw))) {
                            headerRowIdx = i;
                            break;
                        }
                    }

                    const dataRows = raw.slice(headerRowIdx + 1).filter((row) =>
                        row.some((cell) => String(cell ?? "").trim() !== ""),
                    );

                    if (dataRows.length === 0) {
                        setState({ ...EMPTY, fileName: file.name });
                        return;
                    }

                    // Header-based column resolution — fall back to positional
                    // index (0-4) when no header matches.
                    const headers = (raw[headerRowIdx] ?? []).map((h) =>
                        String(h ?? "").trim().toLowerCase(),
                    );
                    const col = (...candidates: string[]) => {
                        for (const c of candidates) {
                            const i = headers.indexOf(c.toLowerCase());
                            if (i !== -1) return i;
                        }
                        return -1;
                    };
                    const codeIdx = col(
                        "account code",
                        "code",
                        "계정 코드",
                        "mã tài khoản",
                    );
                    const nameEnIdx = col(
                        "account name (english)",
                        "name_en",
                        "name (english)",
                        "계정명 (영어)",
                        "tên tài khoản (tiếng anh)",
                    );
                    const nameViIdx = col(
                        "account name (vietnamese)",
                        "name_vi",
                        "name (vietnamese)",
                        "계정명 (베트남어)",
                        "tên tài khoản (tiếng việt)",
                    );
                    const nameKoIdx = col(
                        "account name (korean)",
                        "name_ko",
                        "name (korean)",
                        "계정명 (한국어)",
                        "tên tài khoản (tiếng hàn)",
                    );
                    const parentIdx = col(
                        "parent account",
                        "parent",
                        "상위 계정",
                        "tài khoản cha",
                        "tài khoản chính",
                    );

                    const cell = (row: string[], idx: number, fallback: number) => {
                        const i = idx !== -1 ? idx : fallback;
                        const v = String(row[i] ?? "").trim();
                        return v === "" ? null : v;
                    };

                    // First pass — collect codes for duplicate detection
                    // AND build the in-memory parent map so the depth
                    // walk in the second pass is O(N * depth) instead of
                    // O(N²). Both maps are keyed lower-case so the
                    // upload tolerates inconsistent casing on the same
                    // logical code.
                    const codeCounts = new Map<string, number>();
                    const parentByCode = new Map<string, string | null>();
                    dataRows.forEach((row) => {
                        const code = cell(row, codeIdx, 0);
                        const parent = cell(row, parentIdx, 4);
                        if (code) {
                            const key = code.toLowerCase();
                            codeCounts.set(key, (codeCounts.get(key) ?? 0) + 1);
                            parentByCode.set(
                                key,
                                parent ? parent.toLowerCase() : null,
                            );
                        }
                    });
                    const dupKeys = new Set(
                        [...codeCounts.entries()]
                            .filter(([, n]) => n > 1)
                            .map(([k]) => k),
                    );

                    /** Depth of a row given its parent chain inside this
                     *  file. Parents not in the file are treated as
                     *  external roots (level 1), so a row whose parent
                     *  is missing from the file is depth 2 — exactly the
                     *  legacy `tempParentMap` assumption at
                     *  `comm_0223_002_r001_act.jsp:410-413`. The walk
                     *  is cap-bounded so a cycle in the file can't loop
                     *  forever; a cycle returns `Infinity` so the row
                     *  fails the depth gate.
                     */
                    const depthFromParent = (
                        parentLower: string | null,
                    ): number => {
                        if (!parentLower) return 1; // we are an external root (caller should have flagged "no parent")
                        const visited = new Set<string>();
                        let cursor: string | null | undefined = parentLower;
                        let depth = 1; // the parent itself counts as level 1+
                        while (cursor) {
                            if (visited.has(cursor)) return Infinity;
                            visited.add(cursor);
                            depth++;
                            const nextParent = parentByCode.get(cursor);
                            // Not in the file → external row (legacy:
                            // assume root). Walk stops here.
                            if (nextParent === undefined) break;
                            cursor = nextParent;
                            // Hard cap so a corrupt file with N rows can't
                            // walk N levels — depth + 2 is plenty.
                            if (depth > MAX_DEPTH + 2) return Infinity;
                        }
                        return depth;
                    };

                    // Second pass — build upload rows with per-cell errors.
                    let completed = 0;
                    let errors = 0;

                    const uploadRows: ExcelUploadRow[] = dataRows.map((row, i) => {
                        const code = cell(row, codeIdx, 0);
                        const nameEn = cell(row, nameEnIdx, 1);
                        const nameVi = cell(row, nameViIdx, 2);
                        const nameKo = cell(row, nameKoIdx, 3);
                        const parent = cell(row, parentIdx, 4);

                        let codeErr = false;
                        let codeMsg: string | undefined;
                        let nameEnErr = false;
                        let nameEnMsg: string | undefined;
                        let parentErr = false;
                        let parentMsg: string | undefined;

                        if (!code) {
                            codeErr = true;
                            codeMsg = t(
                                "settings.chart_of_accounts.upload.error.code_required",
                            );
                        } else if (code.length > CODE_MAX_LEN) {
                            codeErr = true;
                            codeMsg = t(
                                "settings.chart_of_accounts.upload.error.code_too_long",
                                { max: CODE_MAX_LEN },
                            );
                        } else if (!CODE_PATTERN.test(code)) {
                            codeErr = true;
                            codeMsg = t(
                                "settings.chart_of_accounts.upload.error.code_invalid",
                            );
                        } else if (dupKeys.has(code.toLowerCase())) {
                            codeErr = true;
                            codeMsg = t(
                                "settings.chart_of_accounts.upload.error.code_duplicate",
                            );
                        }

                        if (!nameEn) {
                            nameEnErr = true;
                            nameEnMsg = t(
                                "settings.chart_of_accounts.upload.error.name_en_required",
                            );
                        }

                        // Parent required + depth check. PO directive
                        // 2026-05-25: level 1 (NULL parent) is reserved
                        // for the seeded RESTRICTED_CODES; user-driven
                        // writes must land at level 2 or 3.
                        if (!parent) {
                            parentErr = true;
                            parentMsg = t(
                                "settings.chart_of_accounts.upload.error.parent_required",
                            );
                        } else {
                            // Depth: this row is one level below its
                            // parent. If parent is "ACC-01" and ACC-01
                            // is treated as an external level-1 root,
                            // depthFromParent("acc-01") = 1, our row is 2.
                            // If parent is an in-file level-2 row, depth
                            // is 3. Anything deeper is flagged.
                            const myDepth = depthFromParent(parent.toLowerCase()) + 1;
                            if (myDepth > MAX_DEPTH) {
                                parentErr = true;
                                parentMsg = t(
                                    "settings.chart_of_accounts.upload.error.depth_exceeded",
                                    { max: MAX_DEPTH },
                                );
                            }
                        }

                        if (codeErr || nameEnErr || parentErr) errors++;
                        else completed++;

                        return {
                            id: `row-${i}`,
                            cells: {
                                code: {
                                    value: code,
                                    error: codeErr,
                                    errorMessage: codeMsg,
                                },
                                name_en: {
                                    value: nameEn,
                                    error: nameEnErr,
                                    errorMessage: nameEnMsg,
                                },
                                name_vi: { value: nameVi },
                                name_ko: { value: nameKo },
                                parent: {
                                    value: parent,
                                    error: parentErr,
                                    errorMessage: parentMsg,
                                },
                            },
                        };
                    });

                    setState({
                        fileName: file.name,
                        rows: uploadRows,
                        completedCount: completed,
                        errorCount: errors,
                        isReady: uploadRows.length > 0 && errors === 0,
                    });
                } catch {
                    setState({ ...EMPTY, fileName: file.name });
                }
            };
            reader.readAsArrayBuffer(file);
        },
        [t],
    );

    const onFileChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            if (file) parseAndValidate(file);
            // Reset so the same file can be re-selected after fixing it.
            e.target.value = "";
        },
        [parseAndValidate],
    );

    const triggerFilePick = useCallback(() => {
        inputRef.current?.click();
    }, []);

    const reset = useCallback(() => {
        setState(EMPTY);
    }, []);

    return { ...state, inputRef, onFileChange, loadFile: parseAndValidate, triggerFilePick, reset };
}
