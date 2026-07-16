import { jsPDF } from "jspdf";
import html2canvas from "html2canvas-pro";

/**
 * Render a live DOM element to a downloadable A4 PDF — a raster capture of the
 * element exactly as rendered on screen. Used by the "View e-Invoice Details"
 * modal so the PDF is byte-for-byte the same `<InvoiceDocument>` the modal (and
 * the Print output) shows — no separate PDF layout.
 *
 * <p>Uses **html2canvas-pro** (the maintained fork that understands modern CSS
 * colour functions such as `oklch`, which Tailwind 4 emits) to snapshot the
 * node, then places the image into a multi-page A4 **jsPDF** document. Because
 * text is rendered by the browser's own font stack (Times New Roman for the
 * invoice), Vietnamese diacritics render correctly with no embedded font.
 *
 * <p>Does nothing on the server / when the element is missing. Rethrows on
 * capture failure so the caller can surface an error dialog.
 */
export async function downloadElementAsPdf(
    el: HTMLElement | null | undefined,
    fileName: string,
): Promise<void> {
    if (typeof window === "undefined" || !el) return;

    const canvas = await html2canvas(el, {
        scale: 2, // crisper text/borders
        backgroundColor: "#ffffff",
        useCORS: true,
        logging: false,
    });

    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageW = pdf.internal.pageSize.getWidth(); // 210mm
    const pageH = pdf.internal.pageSize.getHeight(); // 297mm
    const margin = 8;
    const imgW = pageW - margin * 2;
    const imgH = (canvas.height * imgW) / canvas.width;
    const usableH = pageH - margin * 2;
    const img = canvas.toDataURL("image/jpeg", 0.92);

    // Place the full-height image once per page, shifted up by one usable page
    // height each time, so a tall invoice paginates cleanly across A4 pages.
    let page = 0;
    let heightLeft = imgH;
    while (heightLeft > 0) {
        if (page > 0) pdf.addPage();
        pdf.addImage(img, "JPEG", margin, margin - page * usableH, imgW, imgH);
        heightLeft -= usableH;
        page += 1;
    }

    const name = fileName.toLowerCase().endsWith(".pdf") ? fileName : `${fileName}.pdf`;
    pdf.save(name);
}
