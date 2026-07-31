import { fetchAllAnnexInvoices } from "@/lib/api/addon";
import {
    downloadXlsx,
    fillXlsxTemplate,
    type CellPatch,
    type RowExpansion,
} from "@/lib/xlsxTemplate";
import type { ApiVatDeclarationDetail } from "@/lib/types/api";
import type { AnnexInvoiceRow } from "./types";

/**
 * Client-side XLSX for the BKBR / BKMV tabs — forms 01-1/GTGT and 01-2/GTGT
 * ("Bảng kê hoá đơn, chứng từ hàng hoá, dịch vụ bán ra / mua vào").
 *
 * Fills the authority's own workbook, so the whole frame — title block,
 * `[01]`–`[05]`, column headers, the seven rate-group labels, each group's
 * "Tổng" row, the signature block and the footnotes — keeps the template's
 * styling. Only the wording that differs between the two directions is
 * overwritten (see {@link DIRECTION_TEXT}).
 *
 * Each rate group is resized **in place** rather than through one flat block, so
 * label rows and "Tổng" rows keep their own styles instead of inheriting the
 * data-row style. Groups are processed bottom-up (7 → 1) because resizing one
 * group shifts every row beneath it; going upwards means the row numbers of the
 * groups still to process never move.
 *
 * The tabs are paginated, so rows come from {@link fetchAllAnnexInvoices} (walks
 * every page) rather than the page currently on screen.
 */

const TEMPLATE_URL = "/templates/vat-invoice-listing-01-1-gtgt.xlsx";

/** Which listing is being produced. */
export type InvoiceListingKind = "bkbr" | "bkmv";

/**
 * One rate group as the pristine template ships it.
 *
 * `sampleRows` is how many specimen data rows the template carries — it varies
 * per group and two groups carry none, which is why those need a donor row to
 * clone styling from.
 */
type GroupSpec = {
    /** Row holding the group's "1. …" label. */
    labelRow: number;
    /** First data row of the group (equals the "Tổng" row when `sampleRows` is 0). */
    firstDataRow: number;
    sampleRows: number;
    /** Row holding the group's "Tổng". */
    totalRow: number;
    /** Tested against the wire's `vat_rate`; the last group is the catch-all. */
    matches: (rate: string) => boolean;
};

/** Template geometry — see the 01-1/GTGT sheet, rows 16…40. */
const GROUPS: readonly GroupSpec[] = [
    { labelRow: 16, firstDataRow: 17, sampleRows: 1, totalRow: 18, matches: (r) => r === "KKKNT" },
    { labelRow: 19, firstDataRow: 20, sampleRows: 2, totalRow: 22, matches: (r) => r === "KCT" },
    { labelRow: 23, firstDataRow: 24, sampleRows: 0, totalRow: 24, matches: (r) => r === "0%" },
    { labelRow: 25, firstDataRow: 26, sampleRows: 3, totalRow: 29, matches: (r) => r === "5%" },
    { labelRow: 30, firstDataRow: 31, sampleRows: 3, totalRow: 34, matches: (r) => r === "8%" },
    { labelRow: 35, firstDataRow: 36, sampleRows: 2, totalRow: 38, matches: (r) => r === "10%" },
    { labelRow: 39, firstDataRow: 40, sampleRows: 0, totalRow: 40, matches: () => true },
];

/** Style source for the two groups that ship no specimen row of their own. */
const DONOR_DATA_ROW = 17;

/** Grand-total rows in the pristine template. */
const TOTAL_REVENUE_ROW = 42;
const TOTAL_VAT_ROW = 43;

/** Data columns of a listing line, in sheet order. */
const COLUMNS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K"] as const;

/** Wording that flips between the sold-side and purchased-side listings. */
const DIRECTION_TEXT: Record<
    InvoiceListingKind,
    {
        ioDv: "I" | "O";
        annexType: "BKBR" | "BKMV";
        formNo: string;
        title: string;
        blockLabel: string;
        counterpartyName: string;
        counterpartyTaxCode: string;
        valueHeader: string;
        totalRevenue: string;
        totalVat: string;
        filePrefix: string;
    }
> = {
    bkbr: {
        ioDv: "O",
        annexType: "BKBR",
        formNo: "Form No.: 01-1/GTGT",
        title: "BẢNG KÊ HOÁ ĐƠN, CHỨNG TỪ HÀNG HOÁ, DỊCH VỤ BÁN RA",
        blockLabel: "Hoá đơn, chứng từ bán ra",
        counterpartyName: "Tên người mua",
        counterpartyTaxCode: "Mã số thuế người mua",
        valueHeader: "Giá trị HHDV bán ra chưa có thuế",
        totalRevenue: "Tổng doanh thu hàng hoá, dịch vụ bán ra chịu thuế GTGT (*):",
        totalVat: "Tổng số thuế GTGT của hàng hóa, dịch vụ bán ra (**):",
        filePrefix: "BangKeBanRa",
    },
    bkmv: {
        ioDv: "I",
        annexType: "BKMV",
        formNo: "Form No.: 01-2/GTGT",
        title: "BẢNG KÊ HOÁ ĐƠN, CHỨNG TỪ HÀNG HOÁ, DỊCH VỤ MUA VÀO",
        blockLabel: "Hoá đơn, chứng từ mua vào",
        counterpartyName: "Tên người bán",
        counterpartyTaxCode: "Mã số thuế người bán",
        valueHeader: "Giá trị HHDV mua vào chưa có thuế",
        totalRevenue: "Tổng giá trị hàng hoá, dịch vụ mua vào chịu thuế GTGT (*):",
        totalVat: "Tổng số thuế GTGT của hàng hóa, dịch vụ mua vào (**):",
        filePrefix: "BangKeMuaVao",
    },
};

/** `[01]` on the form spells the range out in words. */
function periodRangeVn(detail: ApiVatDeclarationDetail): string {
    const spell = (iso: string) => {
        const [y, m, d] = iso.split("-");
        return `ngày ${Number(d)} tháng ${Number(m)} năm ${y}`;
    };
    return `[01] Kỳ tính thuế: từ ${spell(detail.from_dt)} đến ${spell(detail.to_dt)}`;
}

export function invoiceListingFileName(
    kind: InvoiceListingKind,
    detail: ApiVatDeclarationDetail,
): string {
    const p = detail.period_type === "Q" ? "Q" : "M";
    return `${DIRECTION_TEXT[kind].filePrefix}_${p}${detail.period_value}${detail.decl_year}.xlsx`;
}

export type InvoiceListingExcelInput = {
    kind: InvoiceListingKind;
    sid: number;
    detail: ApiVatDeclarationDetail;
    agentNm: string;
    agentTaxCode: string;
};

export async function exportInvoiceListingExcel({
    kind,
    sid,
    detail,
    agentNm,
    agentTaxCode,
}: InvoiceListingExcelInput): Promise<void> {
    const text = DIRECTION_TEXT[kind];
    const { rows } = await fetchAllAnnexInvoices(sid, {
        annex_type: text.annexType,
        io_dv: text.ioDv,
    });

    // Bucket by rate group, preserving the order rows arrive in.
    const buckets: AnnexInvoiceRow[][] = GROUPS.map(() => []);
    for (const row of rows) {
        const i = GROUPS.findIndex((g) => g.matches(row.vatRate));
        buckets[i === -1 ? GROUPS.length - 1 : i].push(row);
    }

    // Bottom-up: resizing a group moves everything below it, so the groups still
    // queued must sit *above* the one being resized.
    const resizes: RowExpansion[] = [];
    for (let i = GROUPS.length - 1; i >= 0; i--) {
        const g = GROUPS[i];
        resizes.push({
            templateRow: g.firstDataRow,
            count: buckets[i].length,
            sampleCount: g.sampleRows,
            donorRow: DONOR_DATA_ROW,
        });
    }

    // Where each group lands once every group above it has been resized.
    let cursor = GROUPS[0].labelRow;
    const placed = GROUPS.map((_, i) => {
        const labelRow = cursor;
        const firstDataRow = cursor + 1;
        const totalRow = firstDataRow + buckets[i].length;
        cursor = totalRow + 1;
        return { labelRow, firstDataRow, totalRow };
    });
    // Net row delta ahead of the grand totals.
    const shift =
        placed[placed.length - 1].totalRow - GROUPS[GROUPS.length - 1].totalRow;

    const patches: Record<string, CellPatch> = {
        J1: text.formNo,
        A5: text.title,
        A7: periodRangeVn(detail),
        D8: detail.tp_name,
        D9: detail.tp_tax_code,
        D10: `[04] Tên đại lý thuế (nếu có): ${agentNm}`,
        D11: agentTaxCode,
        B13: text.blockLabel,
        F14: text.counterpartyName,
        G14: text.counterpartyTaxCode,
        I14: text.valueHeader,
    };

    let grandValue = 0;
    let grandVat = 0;

    GROUPS.forEach((_g, gi) => {
        const at = placed[gi];
        const invoices = buckets[gi];

        let groupValue = 0;
        let groupVat = 0;

        invoices.forEach((row, i) => {
            const r = at.firstDataRow + i;
            // Cloned rows inherit the specimen's values, so clear the line first.
            for (const col of COLUMNS) patches[`${col}${r}`] = "";
            patches[`A${r}`] = i + 1;
            patches[`B${r}`] = 1; // Ký hiệu mẫu hóa đơn — fixed, as in the template
            patches[`C${r}`] = row.invSymbol;
            patches[`D${r}`] = row.invNo;
            patches[`E${r}`] = row.invDt;
            patches[`F${r}`] = row.trcoNm;
            patches[`G${r}`] = row.trcoTaxCode;
            patches[`I${r}`] = row.splyAmt;
            patches[`J${r}`] = row.vatAmt;
            groupValue += row.splyAmt;
            groupVat += row.vatAmt;
        });

        patches[`I${at.totalRow}`] = groupValue;
        patches[`J${at.totalRow}`] = groupVat;

        // Footnote (*) counts groups 2–4 only; (**) is every group's VAT.
        if (gi >= 1 && gi <= 3) grandValue += groupValue;
        grandVat += groupVat;
    });

    patches[`A${TOTAL_REVENUE_ROW + shift}`] = text.totalRevenue;
    patches[`I${TOTAL_REVENUE_ROW + shift}`] = grandValue;
    patches[`A${TOTAL_VAT_ROW + shift}`] = text.totalVat;
    patches[`I${TOTAL_VAT_ROW + shift}`] = grandVat;

    const bytes = await fillXlsxTemplate(
        TEMPLATE_URL,
        patches,
        "xl/worksheets/sheet1.xml",
        resizes,
    );
    downloadXlsx(bytes, invoiceListingFileName(kind, detail));
}
