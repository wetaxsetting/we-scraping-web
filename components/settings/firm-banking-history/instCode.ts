/**
 * Firm Banking History "Deposit Bank/Inst. Code" display resolver.
 *
 * <p>Legacy `comm_0221_001.js` overrides the grid's Deposit-Bank cell for
 * the NXISAS legs: the raw wire value (`DEP_BANK_CD` = `NXISAS_MODULE`,
 * e.g. `GLOBAL/VNM/PUBLIC_GDT`) is replaced with a value decoded from
 * `REQ_DATA`:
 *   - `G` (Vietnam GDT Inquiry) → the e-Invoice No.
 *     `numericSymbol + invoiceSymbol + '-' + invoiceNo` (`:258-260`).
 *   - `B` (Vietnam Business Inquiry) → `REQ_DATA.search` (`:264`).
 * All other legs render the raw institution code.
 *
 * <p>Used by BOTH the list table cell and the detail popover so the two
 * render the same value (two-call rule).
 */
import type { FirmBankingServiceType } from "./types";

/**
 * Parse a NXISAS leg's `req_data` JSON string. Returns `null` for
 * malformed / missing payloads — callers fall back to the raw string.
 */
export function parseReqData(
    reqData: string | null | undefined,
): Record<string, unknown> | null {
    if (!reqData) return null;
    try {
        const parsed = JSON.parse(reqData);
        if (parsed && typeof parsed === "object") {
            return parsed as Record<string, unknown>;
        }
    } catch {
        // Malformed wire payload — surface the raw value upstream.
    }
    return null;
}

/**
 * Compose the e-Invoice No. from a parsed `req_data` payload —
 * `numericSymbol + invoiceSymbol + '-' + invoiceNo` (legacy
 * `comm_0221_001.js:259`). Returns `""` when nothing is composable.
 */
export function composeEInvoiceNo(
    parsed: Record<string, unknown> | null,
): string {
    if (!parsed) return "";
    const numeric = String(parsed.numericSymbol ?? "");
    const symbol = String(parsed.invoiceSymbol ?? "");
    const invNo = String(parsed.invoiceNo ?? "");
    const head = [numeric, symbol].filter(Boolean).join("");
    if (!head && !invNo) return "";
    return invNo ? `${head}-${invNo}` : head;
}

/**
 * Resolve the "Deposit Bank/Inst. Code" cell value for a Firm Banking
 * History row. GDT rows show the e-Invoice No.; Business rows show the
 * searched Tax ID; every other leg shows the raw institution code.
 * Falls back to `instCode` when `reqData` can't be decoded.
 */
export function resolveFirmBankingInstCode(
    serviceType: FirmBankingServiceType,
    instCode: string,
    reqData: string | null | undefined,
): string {
    if (serviceType === "vietnam_gdt_inquiry") {
        const composed = composeEInvoiceNo(parseReqData(reqData));
        return composed || instCode;
    }
    if (serviceType === "vietnam_business_inquiry") {
        const parsed = parseReqData(reqData);
        const search = parsed ? String(parsed.search ?? "") : "";
        return search || instCode;
    }
    return instCode;
}
