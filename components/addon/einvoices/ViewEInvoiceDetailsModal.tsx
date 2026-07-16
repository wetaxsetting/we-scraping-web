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
 * at the government-mandated sizes (24px title, 12px prose, 8px table) that the
 * Figma frame specifies. These arbitrary sizes are a documented one-off
 * "brand/document asset" exception to the WeCMS typography token rules — they
 * apply ONLY inside the `.einvoice-document` block. The modal chrome (header,
 * action buttons, footer) uses the standard `text-wb-*` / `wb-*` tokens.
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

                {/* ── Action buttons — Print / PDF ──────────────────────── */}
                <div className="flex shrink-0 items-center justify-end gap-3 px-6 pb-4 pt-3">
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

                {/* ── Scrollable invoice preview ────────────────────────── */}
                {/* The invoice is authored at a fixed design width and then
                   uniformly scaled to the modal's current content width via
                   <ScaledInvoice>, so changing the modal width rescales
                   EVERYTHING (fonts, tables, spacing, watermark) to fit. */}
                <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-6 pb-6">
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
                            width: DESIGN_WIDTH,
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
 * The invoice document is authored once at {@link DESIGN_WIDTH}px (all its
 * px font-sizes / paddings / column widths are tuned for that width). This
 * wrapper measures the available content width and applies a single uniform
 * `transform: scale()` so the WHOLE document — text, tables, borders, spacing
 * and the watermark — grows or shrinks together to fit the modal's current
 * width. Change the modal's `w-[…]` and everything re-fits automatically; no
 * per-element size needs touching.
 *
 * A spacer `height` on the outer box reserves the *scaled* height so vertical
 * scrolling stays correct (CSS transforms don't affect layout height on their
 * own). The inline `width` / `transform` / `height` are computed values that
 * Tailwind cannot express — the sanctioned dynamic-style exception.
 */
const DESIGN_WIDTH = 1080;

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
            const next = avail / DESIGN_WIDTH;
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
        <div ref={outerRef} className="w-full" style={{ height }}>
            <div
                ref={innerRef}
                style={{
                    width: DESIGN_WIDTH,
                    transform: `scale(${scale})`,
                    transformOrigin: "top left",
                }}
            >
                <InvoiceDocument data={data} />
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
    return (
        <div className="relative overflow-hidden rounded-[12px] border border-[#d1d5db] bg-white p-8 font-['Times_New_Roman',serif] text-black">
            {/* Đông Sơn bronze-drum watermark (full-circle motif) — centered,
               non-repeating, contained, behind all content (every child sits
               above it via `z-10`). NOTE: the source image is already a
               pre-faded, very pale cream watermark, so it is rendered at
               near-full opacity — dimming it to 5–10% (which assumes a solid
               source) makes it invisible on the white document. `opacity-90`
               keeps it subtle while matching the legacy invoice preview. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src="/assets/addon/einvoice-watermark.jpg"
                alt=""
                aria-hidden
                className="pointer-events-none absolute inset-0 z-0 h-full w-full select-none object-contain opacity-90"
            />

            <div className="relative z-10 flex flex-col gap-8">
                {/* Header — QR + meta */}
                <div className="flex items-start justify-between">
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
                    <div className="text-right text-[15px] font-bold leading-[22px]">
                        <p>{meta.formNo}</p>
                        <p>Ký hiệu: {meta.serialSymbol}</p>
                        <p>Số: {meta.number}</p>
                    </div>
                </div>

                {/* Title */}
                <div className="flex flex-col items-center gap-1 border-b border-[#737373] pb-3 text-center">
                    <p className="text-[34px] font-bold leading-normal">
                        HOÁ ĐƠN GIÁ TRỊ GIA TĂNG
                    </p>
                    <p className="text-[16px] leading-[24px]">{meta.issueDateLine}</p>
                    <p className="text-[16px] leading-[24px]">MCCQT: {meta.mccqt}</p>
                </div>

                {/* Seller info */}
                <div className="border-b border-[#737373] pb-3 text-[16px] leading-[24px]">
                    <p>Tên người bán: {seller.name}</p>
                    <p>Mã số thuế: {seller.taxCode}</p>
                    <p>Địa chỉ: {seller.address}</p>
                    <p>Điện thoại: {seller.phone}</p>
                    {!testVariant && <p>Số tài khoản: {seller.bankAccount}</p>}
                </div>

                {/* Buyer info + currency */}
                <div className="flex flex-col gap-3 pb-3 text-[16px] leading-[24px]">
                    <div>
                        <p>Tên người mua: {buyer.companyName}</p>
                        {!testVariant && <p>Họ tên người mua: {buyer.buyerName}</p>}
                        <p>Mã số thuế: {buyer.taxCode}</p>
                        {!testVariant && <p>Địa chỉ: {buyer.address}</p>}
                        {!testVariant && <p>Số tài khoản: {buyer.bankAccount}</p>}
                        {!testVariant && (
                            <p>Hình thức thanh toán: {buyer.paymentMethod}</p>
                        )}
                        {testVariant && <p>Điện thoại: {buyer.phone}</p>}
                        {testVariant && (
                            <p>Căn cước công dân: {buyer.citizenId}</p>
                        )}
                    </div>
                    {!testVariant && (
                        <div className="flex">
                            <div className="flex-1">
                                <p>Đơn vị tiền tệ: {currency.code}</p>
                                <p>Số bảng kê: {currency.listNo}</p>
                            </div>
                            <div className="flex-1">
                                <p>Tỷ giá: {currency.exchangeRate}</p>
                                <p>Ngày bảng kê: {currency.listDate}</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Item table */}
                <table className="w-full table-fixed border-2 border-black border-collapse text-[14px]">
                    <colgroup>
                        <col className="w-[4%]" />
                        <col className="w-[11%]" />
                        <col className="w-[26%]" />
                        <col className="w-[8%]" />
                        <col className="w-[9%]" />
                        <col className="w-[12%]" />
                        <col className="w-[9%]" />
                        <col className="w-[8%]" />
                        <col className="w-[13%]" />
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
                   LEFT = fee table (when present) + tax-rate breakdown (all rows);
                   RIGHT = totals key/value block. */}
                <div className="flex gap-3 text-[14px]">
                    {/* Left column — fee table (optional) then tax breakdown */}
                    <div className="flex flex-1 flex-col gap-3 self-start">
                        {fees.length > 0 && (
                            <table className="border-2 border-black border-collapse">
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
                        <table className="border-2 border-black border-collapse">
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

                    {/* Right key/value table */}
                    <table className="flex-1 border-2 border-black border-collapse self-start">
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

                {/* Signatures — full-width separator on top (legacy), no
                   underline beneath the labels. */}
                <div className="flex flex-col items-end gap-6 border-t border-[#737373] pt-6">
                    <div className="flex w-full gap-16 text-center leading-[26px]">
                        <div className="flex flex-1 flex-col items-center gap-1 px-8 py-4">
                            <p className="text-[17px] font-bold">NGƯỜI MUA HÀNG</p>
                            <p className="text-[14px]">(Chữ ký số (nếu có))</p>
                        </div>
                        <div className="flex flex-1 flex-col items-center gap-1 px-8 py-4">
                            <p className="text-[17px] font-bold">NGƯỜI BÁN HÀNG</p>
                            <p className="text-[14px]">(Chữ ký điện tử, chữ ký số)</p>
                        </div>
                    </div>

                    {/* Digital-signature status box */}
                    {signature.valid && (
                        <div className="relative flex w-[380px] max-w-full flex-col gap-1 border border-[#16a34a] p-3 text-[15px] font-bold leading-[20px] text-[#16a34a]">
                            <p>Signature Valid</p>
                            <p>Ký bởi: {signature.signedBy}</p>
                            <p>Ký ngày: {signature.signedAt}</p>
                            <span
                                aria-hidden
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-[32px] leading-none text-[#16a34a]"
                            >
                                ✓
                            </span>
                        </div>
                    )}
                </div>

                {/* Footer note */}
                <p className="text-center text-[12px] leading-[24px]">
                    (Cần kiểm tra đối chiếu khi lập, giao, nhận hóa đơn)
                </p>
            </div>
        </div>
    );
}

function ItemTh({ children }: { children: React.ReactNode }) {
    return (
        <th className="border border-black p-[8px] text-center align-middle font-bold leading-[18px]">
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
                "border border-black p-[10px] align-middle font-normal leading-[20px] " +
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
        <th className="border border-black p-[12px] text-center align-middle font-bold leading-[18px]">
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
                "border border-black p-[12px] align-middle font-normal leading-[22px] " +
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
            <td className="border border-black p-[12px] align-middle leading-[18px]">
                {label}
            </td>
            <td className="w-[30%] border border-black p-[12px] text-center align-middle leading-[22px]">
                {value}
            </td>
        </tr>
    );
}
