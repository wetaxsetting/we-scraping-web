"use client";

import { useCallback } from "react";

import {
    isSpecialViewSettingField,
    type ViewSettingItem,
} from "@/components/shared/view-setting";
import {
    exportExcel,
    type ExcelAlignment,
    type ExcelColumnFormat,
    type ExcelExportSort,
} from "@/lib/excel";

/**
 * Per-screen export config keyed by View Setting {@code FIELD_ID}.
 *
 * Pages declare one of these maps next to their {@code COLUMN_REGISTRY}
 * (the on-screen renderers). The hook walks the user's current
 * {@code vs.items}, drops special CHECKBOX/ETC rows + {@code USE_YN='N'}
 * rows + FIELD_IDs not registered here, then sorts by {@code DISP_ORD}
 * and converts each entry to the wire {@link ExcelExportColumn} shape
 * the backend speaks. The result honours unsaved popover reorders
 * (CLAUDE.md decision 4) — the visibility intersection happens
 * server-side using the persisted View Setting (defence-in-depth).
 */
export type ExcelExportColumnConfig = {
    /** i18n key for the column header. The hook calls {@code t(headerKey)}
     *  before shipping — backend trusts the resolved string. */
    headerKey: string;
    /** Defaults to {@code "text"}. */
    format?: ExcelColumnFormat;
    /** Currency code attached to {@code AMOUNT} headers — appended in
     *  parentheses by the backend writer when present. */
    ccyCd?: string;
    /** Defaults: {@code AMOUNT} / {@code NUMBER} → right; everything
     *  else → left. */
    align?: ExcelAlignment;
    /** Explicit column width in '0'-character units (POI semantics —
     *  e.g. {@code 22} ≈ 22 visible '0' digits). When omitted, the
     *  backend writer auto-measures from header + content. Pages
     *  SHOULD set this so the downloaded file is immediately readable
     *  without manual resize. Reasonable starting points:
     *
     *  - text (short / single-token): 16–20
     *  - text (composite e.g. bank + account no): 32–40
     *  - amount (VND-scale): 22 (fits {@code 999,999,999,999.99})
     *  - datetime ({@code yyyy-MM-dd HH:mm:ss}): 22
     *  - relative date ({@code "1 week ago"}): 18 */
    widthChars?: number;
};

export type UseExcelExportInput = {
    /** Per-resource POST endpoint, e.g.
     *  {@code "/api/v1/banking/accounts/export"}. */
    endpoint: string;
    /** Stable semantic screenId from
     *  {@code lib/viewSettingScreens.ts.SCREEN_IDS}. */
    screenId: string;
    /** Defaults to {@code "default"}. */
    dymAreaId?: string;
    /** Filename without extension; controller appends {@code .xlsx}.
     *  Legacy convention: {@code <export_title>_<DDMMYYYY>} with the
     *  no-space scope marker. NEVER reused as the in-sheet title. */
    fileName: string;
    /** In-sheet title cell (row 0) — should match the on-screen page
     *  title verbatim so spreadsheet readers see the same label
     *  shown in the page header. When omitted, backend falls back to
     *  {@link fileName}. */
    title?: string;
    /** Current View Setting items — pass {@code vs.items} when
     *  populated, otherwise the page's {@code FALLBACK_COLUMNS}. */
    items: ViewSettingItem[];
    /** {@code FIELD_ID} → export-config registry. Only FIELD_IDs in
     *  this object can ever appear in the export. Unknown FIELD_IDs
     *  in {@code items} are silently dropped. */
    columnConfig: Record<string, ExcelExportColumnConfig>;
    /** i18n function for header label resolution. */
    t: (key: string, vars?: Record<string, string | number>) => string;
    /** Filter map — interpreted per-screen by the backend provider. */
    filters?: Record<string, unknown>;
    /** Current sort state from {@code useTableSort().sortParams}. */
    sort?: ExcelExportSort | null;
};

/**
 * Shared export trigger for every list page. Returns a stable function
 * suitable for passing as {@code onExport} to {@link
 * import("@/components/shared/PageActionButtons").default}.
 *
 * The returned function can throw {@link import("@/lib/api/banking").ApiCallError}
 * (network / business error) — callers SHOULD wrap in a try/catch
 * and surface the system dialog for non-401 errors. 401s are handled
 * automatically by the global session-expired interceptor in
 * {@code lib/axios.ts}.
 */
export function useExcelExport(): (input: UseExcelExportInput) => Promise<void> {
    return useCallback(async (input: UseExcelExportInput) => {
        const visible = input.items
            .filter((it) => it.use_yn === "Y")
            .filter((it) => !isSpecialViewSettingField(it.field_id))
            // Mirror legacy IDO.USER_SCR_OPTION_WECMS_R002.xml `WHERE USR.DISP_YN='Y'`:
            // admin-hidden columns must never reach the export pipeline. Today this
            // is redundant with use_yn (every disp_yn='N' seed row is also use_yn='N'),
            // but it closes the gap if a future column is seeded disp_yn='N' + use_yn='Y'.
            .filter((it) => it.disp_yn !== "N")
            .filter((it) => Boolean(input.columnConfig[it.field_id]))
            .slice()
            .sort((a, b) => a.disp_ord - b.disp_ord);

        const columns = visible.map((it) => {
            const cfg = input.columnConfig[it.field_id];
            return {
                fieldId: it.field_id,
                header: input.t(cfg.headerKey),
                format: cfg.format ?? "text",
                ccyCd: cfg.ccyCd,
                align: cfg.align,
                widthChars: cfg.widthChars,
            };
        });

        await exportExcel({
            endpoint: input.endpoint,
            screenId: input.screenId,
            dymAreaId: input.dymAreaId,
            fileName: input.fileName,
            title: input.title,
            columns,
            filters: input.filters,
            sort: input.sort,
        });
    }, []);
}
