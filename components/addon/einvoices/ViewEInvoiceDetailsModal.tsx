"use client";

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { FileText, Printer, X } from "lucide-react";

import {
    Dialog,
    DialogContent,
    DialogTitle,
} from "@/components/ui/dialog";
import { useTranslation } from "@/lib/i18n";
import { useDialog } from "@/components/shared/dialog";
import { printElement } from "@/lib/print";
import { downloadElementAsPdf } from "@/lib/pdf";
import { useEInvoiceDetail } from "@/hooks/useEInvoiceDetail";

import { type MockInvoice } from "./mockInvoice";
import { qrDataUri, toDisplayInvoice } from "./detailDisplay";

/**
 * Shared "View e-Invoice Details" preview modal — reused by BOTH the Sales
 * (Figma 305-8355) and Expense (Figma 305-7885) e-Invoice list pages. The two
 * variants differ only by the modal title; everything else is identical, which
 * is exactly why this component lives in the shared `components/addon/einvoices`
 * folder rather than a per-variant feature folder.
 *
 * <p><b>API-wired.</b> On open it fetches the selected invoice via
 * {@link useEInvoiceDetail} (`GET /api/v1/addon/einvoices/{docId}?type=…`,
 * legacy `einv_0002_001_r001`) and maps the response into the
 * {@link MockInvoice} presentation shape via {@link toDisplayInvoice} — the
 * markup below is unchanged; only its data source moved from the mock to the
 * live API. Print renders a standalone A4 invoice document
 * ({@link buildEInvoicePrintHtml} → {@link printHtmlDocument}); PDF streams the
 * server-rendered file (`…/{docId}/pdf`).
 *
 * <p><b>Typography exception.</b> The invoice document below is a legal-form
 * reproduction, not an app screen: it deliberately renders in Times New Roman
 * on a fixed 21 cm (≈ 794 px) A4 sheet at the government-mandated sizes the
 * live JEX popup uses (`assets_v2/add.css .layerCont.e-invoice-details`: 30px
 * title, 16px prose + table, brown `rgba(145,87,21,0.69)` separators, mm-based
 * section spacing). These arbitrary px sizes are a documented one-off
 * "brand/document asset" exception to the WeCMS typography token rules — they
 * apply ONLY inside the invoice sheet block. The modal chrome (header, close
 * control, action buttons, footer) uses the standard `text-wb-*` / `wb-*`
 * tokens.
 */
export interface ViewEInvoiceDetailsModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    invoiceType: "sales" | "expense";
    /**
     * The clicked list row's {@code DOC_ID} (= `EInvoiceRow.id`). The modal
     * fetches this invoice's full document on open. Null / undefined → the
     * modal shows nothing (guarded by `open`).
     */
    docId?: string | null;
}

export default function ViewEInvoiceDetailsModal({
    open,
    onOpenChange,
    invoiceType,
    docId,
}: ViewEInvoiceDetailsModalProps) {
    const { t } = useTranslation();
    const dialog = useDialog();

    // `invoiceType` selects the backend doc-type slice (Sales `'I'` /
    // Expense `'B'`) and is what makes the seller/buyer resolution correct.
    const apiType = invoiceType === "sales" ? "SALES" : "EXPENSE";

    const { data: detail, loading, error } = useEInvoiceDetail(docId, apiType, open);
    const data = useMemo(
        () => (detail ? toDisplayInvoice(detail) : null),
        [detail],
    );

    const [downloading, setDownloading] = useState(false);

    // Off-screen full-size render of the invoice, used as the SINGLE source for
    // both Print and PDF — the exact same <InvoiceDocument> DOM the modal shows,
    // so all three surfaces are identical (no separate print/PDF layout).
    const captureRef = useRef<HTMLDivElement>(null);

    const handlePrint = useCallback(() => {
        // Print the modal's own invoice DOM (with the app's CSS) in a hidden
        // iframe — no app chrome, byte-for-byte the on-screen invoice.
        printElement(captureRef.current);
    }, []);

    const handlePdf = useCallback(async () => {
        if (!captureRef.current || downloading) return;
        setDownloading(true);
        try {
            // Raster-capture the SAME invoice DOM to an A4 PDF (browser fonts →
            // correct Vietnamese, no embedded TTF needed).
            await downloadElementAsPdf(captureRef.current, `${docId ?? "e-invoice"}.pdf`);
        } catch (err) {
            dialog.open({
                type: "error",
                title: t("dialog.error"),
                description: String(err),
                errorCode: "WBE9999",
            });
        } finally {
            setDownloading(false);
        }
    }, [docId, downloading, dialog, t]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                hideClose
                aria-describedby={undefined}
                data-invoice-type={invoiceType}
                className="h-[var(--w-wb-settings-card-h)] w-[1130px] max-h-[calc(100vh-32px)] max-w-[calc(100vw-32px)] gap-0 rounded-2xl p-0"
            >
                {/* ── Sticky header — title + close ─────────────────────── */}
                {/* Matches the feature-dialog header contract (§3a/§3b): title is
                   the modal-popup 18px semibold token, padded to px-6 so it aligns
                   with the close icon on the right. */}
                <div className="flex shrink-0 items-center justify-between bg-white px-6 py-4">
                    <DialogTitle asChild>
                        <span className="text-wb-18 font-semibold tracking-wb-tight text-wb-dark">
                            {t("einvoice_view_detail.title")}
                        </span>
                    </DialogTitle>
                    <button
                        type="button"
                        onClick={() => onOpenChange(false)}
                        aria-label={t("einvoice_view_detail.close")}
                        className="flex size-6 cursor-pointer items-center justify-center rounded-sm text-wb-ink hover:bg-black/5"
                    >
                        <X className="size-[18px]" strokeWidth={2} />
                    </button>
                </div>

                {/* ── Scrollable invoice preview ────────────────────────── */}
                {/* The invoice is authored at the fixed A4 sheet width and shown
                   centered in the modal like the legacy JEX popup. Fit mode
                   (default) renders the sheet at natural size (capped to the
                   modal width). The Print / PDF actions live INSIDE this scroll region (legacy
                   `.title-function` sits inside `.layerCont.scroll`), so they
                   scroll away with the invoice instead of staying pinned. */}
                <div className="custom-scrollbar min-h-0 flex-1 overflow-auto px-6 pb-6">
                    <div className="flex items-center justify-end gap-3 pb-4 pt-4">
                        <ActionButton
                            icon={<Printer className="size-4" aria-hidden />}
                            label={t("einvoice_view_detail.print")}
                            onClick={handlePrint}
                            disabled={!data}
                        />
                        <ActionButton
                            icon={<FileText className="size-4 text-[#e5322d]" aria-hidden />}
                            label={t("einvoice_view_detail.pdf")}
                            onClick={handlePdf}
                            disabled={!data || downloading}
                        />
                    </div>
                    {loading ? (
                        <StateMessage text={t("einvoice_view_detail.loading")} />
                    ) : error ? (
                        <StateMessage
                            text={error.message || t("einvoice_view_detail.error")}
                        />
                    ) : data ? (
                        <ScaledInvoice data={data} />
                    ) : (
                        <StateMessage text={t("einvoice_view_detail.empty")} />
                    )}
                </div>

                {/* Off-screen full-size render — the SINGLE source for Print +
                   PDF. Same <InvoiceDocument> as on screen, at natural width
                   (no fit-to-modal scale), so Print/PDF are identical to the
                   modal. aria-hidden + off-canvas so it never affects layout. */}
                {data && (
                    <div
                        ref={captureRef}
                        aria-hidden
                        style={{
                            position: "fixed",
                            left: "-100000px",
                            top: 0,
                            width: SHEET_WIDTH,
                            background: "#ffffff",
                            pointerEvents: "none",
                        }}
                    >
                        <InvoiceDocument data={data} />
                    </div>
                )}

                {/* ── Sticky footer — Close ─────────────────────────────── */}
                <div className="flex shrink-0 justify-end bg-white px-6 py-3">
                    <button
                        type="button"
                        onClick={() => onOpenChange(false)}
                        className="flex h-8 cursor-pointer items-center rounded-md bg-white px-3 text-wb-14-tight font-medium text-wb-ink shadow-wb-btn hover:bg-black/[0.03]"
                    >
                        {t("einvoice_view_detail.close")}
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

/* ------------------------------------------------------------------ */
/*  Modal chrome                                                       */
/* ------------------------------------------------------------------ */

function ActionButton({
    icon,
    label,
    onClick,
    disabled = false,
}: {
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
    disabled?: boolean;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className="flex h-8 min-w-8 items-center justify-center gap-1 rounded-md bg-white px-2 text-wb-14-tight font-medium text-wb-dark shadow-wb-btn hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-50 enabled:cursor-pointer"
        >
            {icon}
            {label}
        </button>
    );
}

/** Centered loading / error / empty message inside the scroll region — keeps
 *  the same vertical footprint the invoice occupies so the modal doesn't jump. */
function StateMessage({ text }: { text: string }) {
    return (
        <div className="flex min-h-[300px] items-center justify-center text-wb-13 font-normal text-wb-muted">
            {text}
        </div>
    );
}

/* ------------------------------------------------------------------ */
/*  Fluid scaler — fits the fixed-width invoice to the modal width     */
/* ------------------------------------------------------------------ */

/**
 * The invoice document is authored once at {@link SHEET_WIDTH}px — the true A4
 * portrait sheet width (21 cm ≈ 794 px), matching the legacy JEX `.book`
 * (`width: 21cm`). All its px font-sizes / paddings / column widths are tuned
 * for that width, so the sheet reproduces the government VAT form at legacy
 * scale.
 *
 * This wrapper measures the available modal width and applies a single uniform
 * `transform: scale()` so the WHOLE sheet — text, tables, borders, spacing and
 * the watermark — shrinks together to fit: the sheet renders at natural size,
 * capped to the modal width (`min(1, avail / SHEET_WIDTH)`), centered with side
 * margins. This is the legacy look: a fixed A4 sheet floating in the popup, not
 * stretched edge-to-edge.
 *
 * A fixed-size spacer box reserves the *scaled* width/height (so the sheet
 * centers and vertical scrolling stays correct — CSS transforms don't affect
 * layout box size). The inline `width` / `transform` / `height` are computed
 * values Tailwind cannot express — the sanctioned dynamic-style exception.
 */
const SHEET_WIDTH = 794;

function ScaledInvoice({ data }: { data: MockInvoice }) {
    const outerRef = useRef<HTMLDivElement>(null);
    const innerRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(1);
    const [height, setHeight] = useState<number | undefined>(undefined);

    useLayoutEffect(() => {
        const outer = outerRef.current;
        const inner = innerRef.current;
        if (!outer || !inner) return;

        const update = () => {
            const avail = outer.clientWidth;
            if (!avail) return;
            // Natural size, but never wider than the modal.
            const next = Math.min(1, avail / SHEET_WIDTH);
            setScale(next);
            setHeight(inner.offsetHeight * next);
        };

        update();
        const ro = new ResizeObserver(update);
        ro.observe(outer);
        ro.observe(inner);
        return () => ro.disconnect();
    }, []);

    return (
        <div ref={outerRef} className="flex w-full justify-center">
            {/* Reserved box = scaled footprint, so the sheet centers and the
               scroll height is correct. */}
            <div style={{ width: SHEET_WIDTH * scale, height }}>
                <div
                    ref={innerRef}
                    style={{
                        width: SHEET_WIDTH,
                        transform: `scale(${scale})`,
                        transformOrigin: "top left",
                    }}
                >
                    <InvoiceDocument data={data} />
                </div>
            </div>
        </div>
    );
}

/* ------------------------------------------------------------------ */
/*  Invoice document (static legal-form reproduction)                 */
/*  Typography exception documented at the top of this file.          */
/* ------------------------------------------------------------------ */

function InvoiceDocument({ data }: { data: MockInvoice }) {
    const { meta, seller, buyer, currency, items, fees, taxRows, summary, signature } = data;
    // Legacy einv_testresul === "2" GDT test-invoice variant (Expense only) —
    // hides seller bank account + buyer full-name/address/bank/payment + currency
    // block, shows buyer phone + citizen id instead (einv_0002_001.ts:142-173).
    const testVariant = data.testVariant;
    // Render the real GDT QR payload (verbatim EINV_QRCODE) to a raster (GIF) QR.
    // Raster — NOT SVG — so it survives the Print DOM clone AND rasterizes in the
    // PDF html2canvas capture (inline SVG breaks under html2canvas). Null when the
    // payload is blank (e.g. a not-yet-detail-scraped invoice).
    const qrUri = qrDataUri(data.qrPayload);
    // Legacy `.book`: fixed 21 cm (≈ 794 px) A4 sheet, padding 2cm/0.75cm, a
    // faint centered watermark, subtle shadow, Times New Roman throughout.
    return (
        <div className="relative overflow-hidden rounded-[5px] border border-[#c8c8c8] bg-white px-7 py-[40px] font-['Times_New_Roman',serif] text-black shadow-[0_0_5px_rgba(0,0,0,0.2)]">
            {/* Đông Sơn bronze-drum watermark (full-circle motif) — centered,
               non-repeating, behind all content (every child sits above it via
               `z-10`). Up-scaled to `scale-150` so the drum reads large across
               the sheet (matching legacy `viewinvoice-bg.jpg`'s
               `background-size: 150%`). */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src="/assets/addon/einvoice-watermark.jpg"
                alt=""
                aria-hidden
                className="pointer-events-none absolute inset-0 z-0 h-full w-full scale-150 select-none object-contain opacity-90"
            />

            {/* Legacy per-section mm spacing, not a uniform gap. */}
            <div className="relative z-10 leading-[1.2]">
                {/* Header — QR (left) + form meta (right) */}
                <div className="flex items-center justify-between">
                    {qrUri ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={qrUri}
                            alt="QR code"
                            className="size-[88px] shrink-0"
                        />
                    ) : (
                        <div className="size-[88px] shrink-0" aria-hidden />
                    )}
                    <div className="space-y-[5px] whitespace-nowrap text-right text-[16px] font-bold">
                        <p>{meta.formNo}</p>
                        <p>Ký hiệu: {meta.serialSymbol}</p>
                        <p>Số: {meta.number}</p>
                    </div>
                </div>

                {/* Title */}
                <p className="mt-[19px] text-center text-[30px] font-semibold">
                    HOÁ ĐƠN GIÁ TRỊ GIA TĂNG
                </p>
                <p className="mt-[11px] text-center text-[16px]">{meta.issueDateLine}</p>
                <p className="mt-[11px] mb-[11px] text-center text-[16px]">
                    MCCQT: {meta.mccqt}
                </p>

                {/* Seller info */}
                <div className="mt-[8px] space-y-[8px] border-t border-[rgba(145,87,21,0.69)] pt-[8px] text-[16px] leading-[1.4]">
                    <p>Tên người bán: {seller.name}</p>
                    <p>Mã số thuế: {seller.taxCode}</p>
                    <p>Địa chỉ: {seller.address}</p>
                    <p>Điện thoại: {seller.phone}</p>
                    {!testVariant && <p>Số tài khoản: {seller.bankAccount}</p>}
                </div>

                {/* Buyer info + currency */}
                <div className="mt-[8px] space-y-[8px] border-t border-[rgba(145,87,21,0.69)] pt-[8px] text-[16px] leading-[1.4]">
                    <p>Tên người mua: {buyer.companyName}</p>
                    {!testVariant && <p>Họ tên người mua: {buyer.buyerName}</p>}
                    <p>Mã số thuế: {buyer.taxCode}</p>
                    {!testVariant && <p>Địa chỉ: {buyer.address}</p>}
                    {!testVariant && <p>Số tài khoản: {buyer.bankAccount}</p>}
                    {!testVariant && (
                        <p>Hình thức thanh toán: {buyer.paymentMethod}</p>
                    )}
                    {testVariant && <p>Điện thoại: {buyer.phone}</p>}
                    {testVariant && <p>Căn cước công dân: {buyer.citizenId}</p>}
                    {!testVariant && (
                        <div className="flex gap-[15px]">
                            <div className="w-1/2 space-y-[8px]">
                                <p>Đơn vị tiền tệ: {currency.code}</p>
                                <p>Số bảng kê: {currency.listNo}</p>
                            </div>
                            <div className="w-1/2 space-y-[8px]">
                                <p>Tỷ giá: {currency.exchangeRate}</p>
                                <p>Ngày bảng kê: {currency.listDate}</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Item table (legacy col widths 6/13/23/8/7/12/8/8/15) */}
                <table className="mt-[8px] w-full table-fixed border-collapse border-2 border-black text-[16px]">
                    <colgroup>
                        <col className="w-[6%]" />
                        <col className="w-[13%]" />
                        <col className="w-[23%]" />
                        <col className="w-[8%]" />
                        <col className="w-[7%]" />
                        <col className="w-[12%]" />
                        <col className="w-[8%]" />
                        <col className="w-[8%]" />
                        <col className="w-[15%]" />
                    </colgroup>
                    <thead>
                        <tr>
                            <ItemTh>STT</ItemTh>
                            <ItemTh>Tính chất</ItemTh>
                            <ItemTh>Tên hàng hóa, dịch vụ</ItemTh>
                            <ItemTh>Đơn vị tính</ItemTh>
                            <ItemTh>Số lượng</ItemTh>
                            <ItemTh>Đơn giá</ItemTh>
                            <ItemTh>Chiết khấu</ItemTh>
                            <ItemTh>Thuế suất</ItemTh>
                            <ItemTh>Thành tiền chưa có thuế GTGT</ItemTh>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((it) => (
                            <tr key={it.no}>
                                <ItemTd align="center">{it.no}</ItemTd>
                                <ItemTd>{it.nature}</ItemTd>
                                <ItemTd>{it.name}</ItemTd>
                                <ItemTd align="center">{it.unit}</ItemTd>
                                <ItemTd align="center">{it.quantity}</ItemTd>
                                <ItemTd align="right">{it.unitPrice}</ItemTd>
                                <ItemTd align="center">{it.discount}</ItemTd>
                                <ItemTd align="center">{it.taxRate}</ItemTd>
                                <ItemTd align="right">{it.amountBeforeTax}</ItemTd>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* Summary section — two columns (legacy einv_0002_002 parity):
                   LEFT (47%) = fee table (when present) + tax-rate breakdown;
                   RIGHT (53%) = totals key/value block. */}
                <div className="mt-[8px] flex gap-[15px] text-[16px]">
                    {/* Left column — fee table (optional) then tax breakdown */}
                    <div className="flex w-[47%] flex-col gap-[8px] self-start">
                        {fees.length > 0 && (
                            <table className="w-full table-fixed border-collapse border-2 border-black">
                                <colgroup>
                                    <col className="w-[20%]" />
                                    <col />
                                    <col className="w-[28%]" />
                                </colgroup>
                                <thead>
                                    <tr>
                                        <SumTh>STT</SumTh>
                                        <SumTh>Tên loại phí</SumTh>
                                        <SumTh>Tiền phí</SumTh>
                                    </tr>
                                </thead>
                                <tbody>
                                    {fees.map((f) => (
                                        <tr key={f.no}>
                                            <SumTd align="center">{f.no}</SumTd>
                                            <SumTd>{f.name}</SumTd>
                                            <SumTd align="center">{f.amount}</SumTd>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                        <table className="w-full table-fixed border-collapse border-2 border-black">
                            <colgroup>
                                <col className="w-[20%]" />
                                <col />
                                <col className="w-[28%]" />
                            </colgroup>
                            <thead>
                                <tr>
                                    <SumTh>Thuế suất</SumTh>
                                    <SumTh>Tổng tiền chưa thuế</SumTh>
                                    <SumTh>Tổng tiền thuế</SumTh>
                                </tr>
                            </thead>
                            <tbody>
                                {taxRows.map((tr, i) => (
                                    <tr key={`${tr.taxRate}-${i}`}>
                                        <SumTd align="center">{tr.taxRate}</SumTd>
                                        <SumTd align="center">{tr.amountBeforeTax}</SumTd>
                                        <SumTd align="center">{tr.taxAmount}</SumTd>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Right key/value table (legacy label 40% / value 60%) */}
                    <table className="w-[53%] table-fixed border-collapse border-2 border-black self-start">
                        <colgroup>
                            <col className="w-[40%]" />
                            <col />
                        </colgroup>
                        <tbody>
                            <SummaryRow
                                label="Tổng tiền chưa thuế (Tổng cộng thành tiền chưa có thuế)"
                                value={summary.totalBeforeTax}
                            />
                            <SummaryRow
                                label="Tổng tiền thuế (Tổng cộng tiền thuế)"
                                value={summary.totalTaxAmount}
                            />
                            <SummaryRow label="Tổng tiền phí" value={summary.totalFee} />
                            <SummaryRow
                                label="Tổng tiền chiết khấu thương mại"
                                value={summary.totalCommercialDiscount}
                            />
                            <SummaryRow
                                label="Tổng tiền thanh toán bằng số"
                                value={summary.totalPaymentNumeric}
                            />
                            <SummaryRow
                                label="Tổng tiền thanh toán bằng chữ"
                                value={summary.totalPaymentWords}
                            />
                        </tbody>
                    </table>
                </div>

                {/* Signatures — two columns (buyer left, seller right) with a
                   full-width brown separator + large top padding (legacy
                   `.contents`, border-top + padding-top 20mm). */}
                <div className="mt-[11px] flex border-t border-[rgba(145,87,21,0.69)] pt-[48px] text-center">
                    <div className="w-1/2">
                        <h4 className="text-[18px] font-bold">NGƯỜI MUA HÀNG</h4>
                        <p className="py-[11px] text-[14px] italic">
                            (Chữ ký số (nếu có))
                        </p>
                    </div>
                    <div className="w-1/2">
                        <h4 className="text-[18px] font-bold">NGƯỜI BÁN HÀNG</h4>
                        <p className="py-[11px] text-[14px] italic">
                            (Chữ ký điện tử, chữ ký số)
                        </p>
                        {/* Digital-signature status box (legacy `.sign`) */}
                        {signature.valid && (
                            <div className="mt-[11px] text-center">
                                <div className="relative inline-block border-2 border-[#20b708] p-[11px] text-left text-[17px] font-semibold leading-[1.4] text-[#20b708]">
                                    <p>Signature Valid</p>
                                    <p>Ký bởi: {signature.signedBy}</p>
                                    <p>Ký ngày: {signature.signedAt}</p>
                                    <span
                                        aria-hidden
                                        className="absolute bottom-[13px] right-[23px] text-[32px] leading-none text-[#20b708]"
                                    >
                                        ✓
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer note */}
                <p className="mt-[24px] text-center text-[14px] italic">
                    (Cần kiểm tra, đối chiếu khi lập, nhận hóa đơn)
                </p>
            </div>
        </div>
    );
}

/* Legacy table cells: 16px Times New Roman, padding 7px/5px, 1px black
   internal borders, top-aligned body cells. */
function ItemTh({ children }: { children: React.ReactNode }) {
    return (
        <th className="border border-black px-[5px] py-[7px] text-center align-middle font-bold leading-[1.2]">
            {children}
        </th>
    );
}

function ItemTd({
    children,
    align = "left",
}: {
    children: React.ReactNode;
    align?: "left" | "center" | "right";
}) {
    return (
        <td
            className={
                "border border-black px-[5px] py-[7px] align-top font-normal leading-[1.2] " +
                (align === "right"
                    ? "text-right"
                    : align === "center"
                      ? "text-center"
                      : "text-left")
            }
        >
            {children}
        </td>
    );
}

function SumTh({ children }: { children: React.ReactNode }) {
    return (
        <th className="border border-black px-[5px] py-[7px] text-center align-middle font-bold leading-[1.2]">
            {children}
        </th>
    );
}

function SumTd({
    children,
    align = "left",
}: {
    children: React.ReactNode;
    align?: "left" | "center" | "right";
}) {
    return (
        <td
            className={
                "border border-black px-[5px] py-[7px] align-top font-normal leading-[1.2] break-words " +
                (align === "center" ? "text-center" : "text-left")
            }
        >
            {children}
        </td>
    );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
    return (
        <tr>
            <td className="border border-black px-[5px] py-[7px] text-center align-top leading-[1.2]">
                {label}
            </td>
            <td className="border border-black px-[5px] py-[7px] text-center align-top leading-[1.2] break-words">
                {value}
            </td>
        </tr>
    );
}
