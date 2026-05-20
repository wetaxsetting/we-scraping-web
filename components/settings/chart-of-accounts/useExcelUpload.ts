"use client";

import { useCallback, useRef, useState } from "react";
import * as XLSX from "xlsx";

import type { ExcelUploadRow } from "@/components/shared/excel-upload/ExcelUploadDialog";
import { useTranslation } from "@/lib/i18n";

const CODE_PATTERN = /^[A-Za-z0-9_-]+$/;
const CODE_MAX_LEN = 20;

export type ChartUploadState = {
    fileName: string | null;
    rows: ExcelUploadRow[];
    completedCount: number;
    errorCount: number;
    /** true when at least one row was parsed and none have errors */
    isReady: boolean;
};

export type UseChartOfAccountsExcelUploadReturn = ChartUploadState & {
    inputRef: React.RefObject<HTMLInputElement>;
    onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
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
 * Validation rules (mirrors `ChartOfAccountsInlineRow` + backend):
 *   - code      required, ≤ 10 chars, /^[A-Za-z0-9_-]+$/
 *   - name_en   required
 *   - name_vi   optional
 *   - name_ko   optional
 *   - parent    optional (backend validates existence at write time)
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

                    const wb = XLSX.read(buffer, { type: "array" });
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

                    // First pass — collect codes for duplicate detection.
                    const codeCounts = new Map<string, number>();
                    dataRows.forEach((row) => {
                        const code = cell(row, codeIdx, 0);
                        if (code) {
                            const key = code.toLowerCase();
                            codeCounts.set(key, (codeCounts.get(key) ?? 0) + 1);
                        }
                    });
                    const dupKeys = new Set(
                        [...codeCounts.entries()]
                            .filter(([, n]) => n > 1)
                            .map(([k]) => k),
                    );

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

                        if (codeErr || nameEnErr) errors++;
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
                                parent: { value: parent },
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

    return { ...state, inputRef, onFileChange, triggerFilePick, reset };
}
