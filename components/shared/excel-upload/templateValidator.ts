"use client";

import * as XLSX from "xlsx";

import { readXlsxQuiet } from "@/lib/xlsxReader";

/**
 * Excel template validator — shared across every Settings Upload
 * popup. Reads the first sheet of an `.xlsx` / `.xls` file, locates
 * the header row, and verifies that it matches the per-feature
 * `TemplateSpec` before the dialog ships the file to its parser /
 * preview backend. This prevents a user from picking the wrong
 * template (e.g. Contacts template inside the Purpose dialog) — the
 * file would otherwise parse with garbage values or trigger an
 * opaque server-side error.
 *
 * Two-layer check per spec:
 *   1. Every entry in {@link TemplateSpec.requiredColumns} must match
 *      at least one header in the file (any locale variant counts).
 *   2. No header from {@link TemplateSpec.forbiddenHeaders} may
 *      appear — those are tell-tale columns from OTHER templates.
 *
 * Both layers are case-insensitive and tolerant of leading / trailing
 * whitespace plus run-on inner whitespace (some downloadable
 * templates ship with a leading space before the first column —
 * e.g. " Contact Code").
 */

/**
 * Acceptable header labels for one logical column. Any one match
 * (case-insensitive after whitespace normalisation) counts as "the
 * file contains this column". Multiple entries cover locale variants
 * (EN / KO / VI / KH) so a user who downloaded the KO template can
 * upload it without a false rejection.
 */
export type TemplateColumnAnchor = string[];

export type TemplateSpec = {
    /** Human-friendly template name — used in dev logging only. */
    templateName: string;
    /** Every logical column listed here must appear in the file's
     *  header row. */
    requiredColumns: TemplateColumnAnchor[];
    /** Tell-tale headers from OTHER templates. If any of them appear
     *  the file is rejected even when the required columns also
     *  match — catches "I downloaded Contacts but pasted my own
     *  Purpose data on top, then tried to upload it on the Purpose
     *  dialog". */
    forbiddenHeaders?: string[];
    /** How many leading rows to scan looking for the header row.
     *  Defaults to 6 — every shipped Settings template puts the
     *  header inside the first 5 rows (title row(s) + blank row +
     *  header row). */
    maxScanRows?: number;
};

export type TemplateValidationResult =
    | { valid: true }
    | {
          valid: false;
          reason:
              | "parse_error"     // unreadable / corrupt workbook
              | "no_sheet"        // workbook has no sheets
              | "no_headers"      // no header row found in scan window
              | "wrong_template"; // headers don't match the spec
      };

function normalise(value: unknown): string {
    return String(value ?? "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
}

/**
 * Validate that {@code file}'s first sheet carries the header row
 * expected by {@code spec}. Returns synchronously after one file
 * read; safe to call before invoking the dialog's existing
 * parse/preview pipeline.
 *
 * Never throws — wraps every failure mode in a typed result so the
 * caller can render a single user-facing error dialog regardless of
 * whether the file was corrupt, unreadable, or simply the wrong
 * template.
 */
export async function validateExcelTemplate(
    file: File,
    spec: TemplateSpec,
): Promise<TemplateValidationResult> {
    let rows: unknown[][];
    try {
        const buffer = await file.arrayBuffer();
        const wb = readXlsxQuiet(buffer, { type: "array" });
        const sheetName = wb.SheetNames[0];
        if (!sheetName) return { valid: false, reason: "no_sheet" };
        const ws = wb.Sheets[sheetName];
        rows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
            header: 1,
            defval: "",
            raw: false,
        }) as unknown[][];
    } catch {
        return { valid: false, reason: "parse_error" };
    }

    const scanLimit = Math.min(spec.maxScanRows ?? 6, rows.length);
    const required = spec.requiredColumns.map((anchors) =>
        anchors.map(normalise),
    );
    const forbidden = (spec.forbiddenHeaders ?? []).map(normalise);

    // Pick the row that matches the most required columns. Stops
    // early on a full match. Falling back to "best partial" instead
    // of "first non-empty" makes the validator robust when a template
    // has a non-standard title row count.
    let bestRowIdx = -1;
    let bestMatchCount = -1;
    for (let i = 0; i < scanLimit; i++) {
        const cells = (rows[i] ?? []).map(normalise).filter((c) => c.length > 0);
        if (cells.length === 0) continue;
        const matched = required.reduce(
            (acc, anchors) =>
                acc + (anchors.some((a) => cells.includes(a)) ? 1 : 0),
            0,
        );
        if (matched > bestMatchCount) {
            bestMatchCount = matched;
            bestRowIdx = i;
        }
        if (matched === required.length) break;
    }

    if (bestRowIdx < 0) return { valid: false, reason: "no_headers" };

    const headerCells = (rows[bestRowIdx] ?? []).map(normalise);

    const allRequiredPresent = required.every((anchors) =>
        anchors.some((a) => headerCells.includes(a)),
    );
    const anyForbiddenPresent = forbidden.some((f) => headerCells.includes(f));

    if (!allRequiredPresent || anyForbiddenPresent) {
        return { valid: false, reason: "wrong_template" };
    }

    return { valid: true };
}

/* ────────────────────────────────────────────────────────────────────
 * Per-feature template specs. Anchor labels come from the actual
 * `.xlsx` templates shipped under `public/templates/` (verified at
 * implementation time) plus the matching `settings.*.upload.col.*`
 * locale strings so future EN/KO/VI templates that don't yet exist
 * also pass the same check.
 *
 * Adding a new Settings Upload popup → add a spec here, then pass it
 * to `validateExcelTemplate(file, spec)` in the dialog's file-change
 * handler. The dialog never needs to know the validator internals.
 * ────────────────────────────────────────────────────────────────── */

export const PURPOSE_TEMPLATE_SPEC: TemplateSpec = {
    templateName: "Purpose",
    requiredColumns: [
        ["Purpose Code", "목적 코드", "Mã mục đích"],
        ["Purpose Name", "목적명", "Tên mục đích"],
        ["Parent Purpose", "상위 목적", "Mục đích gốc"],
    ],
    forbiddenHeaders: [
        // Chart of Accounts markers
        "Account Code", "계정 코드", "Mã tài khoản",
        "Parent Account", "상위 계정", "Tài khoản chính",
        // Contacts markers
        "Contact Code", "거래처 코드", "Mã đối tác",
        "Deposit Bank", "은행코드", "Ngân hàng",
        "Beneficiary Name", "쉬취인 이름", "Tên người thụ hưởng",
        "Bank Identifier Code (BIC)", "은행 식별 코드 (BIC)", "Mã định danh ngân hàng (BIC)",
        // VAS Account markers
        "Account Type", "계정구분", "Loại tài khoản",
    ],
};

export const CHART_OF_ACCOUNTS_TEMPLATE_SPEC: TemplateSpec = {
    templateName: "Chart of Accounts",
    requiredColumns: [
        ["Account Code", "계정 코드", "Mã tài khoản"],
        ["Account Name (English)", "계정명 (영어)", "Tên tài khoản (Tiếng Anh)"],
        ["Parent Account", "상위 계정", "Tài khoản chính"],
    ],
    forbiddenHeaders: [
        // Purpose markers
        "Purpose Code", "목적 코드", "Mã mục đích",
        "Parent Purpose", "상위 목적", "Mục đích gốc",
        // Contacts markers
        "Contact Code", "거래처 코드", "Mã đối tác",
        "Deposit Bank", "은행코드", "Ngân hàng",
        "Beneficiary Name", "쉬취인 이름", "Tên người thụ hưởng",
        "Bank Identifier Code (BIC)", "은행 식별 코드 (BIC)", "Mã định danh ngân hàng (BIC)",
        // VAS Account-specific markers (Account Code overlaps so use
        // unique columns only)
        "Account Type", "계정구분", "Loại tài khoản",
        "Status", "상태", "Trạng thái",
    ],
};

export const CONTACTS_LOCAL_TEMPLATE_SPEC: TemplateSpec = {
    templateName: "Local Contacts",
    requiredColumns: [
        ["Contact Code", "거래처 코드", "Mã đối tác"],
        ["Deposit Bank", "은행코드", "Ngân hàng"],
        ["Deposit Account No.", "예적금계좌", "Tài khoản ngân hàng"],
    ],
    forbiddenHeaders: [
        // Purpose markers
        "Purpose Code", "목적 코드", "Mã mục đích",
        "Parent Purpose", "상위 목적", "Mục đích gốc",
        // Chart of Accounts markers
        "Account Code", "계정 코드", "Mã tài khoản",
        "Parent Account", "상위 계정", "Tài khoản chính",
        // Overseas Contacts markers
        "Beneficiary Name", "쉬취인 이름", "Tên người thụ hưởng",
        "Bank Identifier Code (BIC)", "은행 식별 코드 (BIC)", "Mã định danh ngân hàng (BIC)",
        // VAS Account markers
        "Account Type", "계정구분", "Loại tài khoản",
    ],
};

export const CONTACTS_OVERSEAS_TEMPLATE_SPEC: TemplateSpec = {
    templateName: "Overseas Contacts",
    requiredColumns: [
        ["Contact Code", "거래처 코드", "Mã đối tác"],
        ["Beneficiary Name", "쉬취인 이름", "Tên người thụ hưởng"],
        ["Bank Identifier Code (BIC)", "은행 식별 코드 (BIC)", "Mã định danh ngân hàng (BIC)"],
    ],
    forbiddenHeaders: [
        // Purpose markers
        "Purpose Code", "목적 코드", "Mã mục đích",
        "Parent Purpose", "상위 목적", "Mục đích gốc",
        // Chart of Accounts markers
        "Account Code", "계정 코드", "Mã tài khoản",
        "Parent Account", "상위 계정", "Tài khoản chính",
        // Local Contacts markers
        "Deposit Bank", "은행코드", "Ngân hàng",
        "Deposit Account No.", "예적금계좌", "Tài khoản ngân hàng",
        // VAS Account markers
        "Account Type", "계정구분", "Loại tài khoản",
    ],
};

export const VAS_ACCOUNT_TEMPLATE_SPEC: TemplateSpec = {
    templateName: "VAS Account",
    requiredColumns: [
        ["Account Type", "계정구분", "Loại tài khoản"],
        ["Status", "상태", "Trạng thái"],
    ],
    forbiddenHeaders: [
        // Purpose markers
        "Purpose Code", "목적 코드", "Mã mục đích",
        "Parent Purpose", "상위 목적", "Mục đích gốc",
        // Chart of Accounts unique markers (Account Code overlaps,
        // so use Parent Account / per-locale name columns instead)
        "Parent Account", "상위 계정", "Tài khoản chính",
        "Account Name (Vietnamese)", "계정명 (베트남어)", "Tên tài khoản (Tiếng Việt)",
        "Account Name (Korean)", "계정명 (한국어)", "Tên tài khoản (Tiếng Hàn)",
        // Contacts markers
        "Contact Code", "거래처 코드", "Mã đối tác",
        "Deposit Bank", "은행코드", "Ngân hàng",
        "Beneficiary Name", "쉬취인 이름", "Tên người thụ hưởng",
        "Bank Identifier Code (BIC)", "은행 식별 코드 (BIC)", "Mã định danh ngân hàng (BIC)",
    ],
};
