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
 * node, then tiles the image across A4 **jsPDF** pages at 0.5in margins — a
 * long invoice flows across 2-3 pages like the legacy print. Because text is
 * rendered by the browser's own font stack (Times New Roman for the invoice),
 * Vietnamese diacritics render correctly with no embedded font.
 *
 * <p><b>Row-aware pagination.</b> A raster capture has no notion of table rows,
 * so slicing it at a fixed page height cut a table row in half at the page
 * boundary (the reported "Tổng tiền thanh toán bằng số" split). Instead we read
 * the DOM's real row / section boundaries ({@link collectBreakOffsets}) and cut
 * each page at the last boundary that still fits — so a page break always lands
 * BETWEEN rows, never through one, exactly like the HTML print path's
 * `break-inside: avoid`.
 *
 * <p>Does nothing on the server / when the element is missing. Rethrows on
 * capture failure so the caller can surface an error dialog.
 */
export async function downloadElementAsPdf(
    el: HTMLElement | null | undefined,
    fileName: string,
): Promise<void> {
    if (typeof window === "undefined" || !el) return;

    // Read the safe break points BEFORE capture (positions are stable; the node
    // is a fixed off-screen clone that never reflows).
    const rootRect = el.getBoundingClientRect();
    const elWidth = rootRect.width || 794;
    const elHeight = rootRect.height;
    const breaks = collectBreakOffsets(el, rootRect.top);

    const scale = 2; // crisper text/borders
    const canvas = await html2canvas(el, {
        scale,
        backgroundColor: "#ffffff",
        useCORS: true,
        logging: false,
    });

    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageW = pdf.internal.pageSize.getWidth(); // 210mm
    const pageH = pdf.internal.pageSize.getHeight(); // 297mm
    const margin = 12.7; // 0.5in on every side (matches the print path)
    const imgW = pageW - margin * 2; // fill the printable width
    const usableH = pageH - margin * 2;

    // Element-px ↔ mm scale, and how many element px fit in one printable page.
    const mmPerElPx = imgW / elWidth;
    const pageCapEl = usableH / mmPerElPx;

    // MEASURED canvas-px per element-px. html2canvas does not always produce a
    // canvas exactly `scale`× the DOM height (device-pixel rounding), so using
    // the assumed `scale` here shifts every slice by a few px — enough to land a
    // cut mid-row. Deriving the ratio from the actual canvas keeps each slice
    // aligned to the true row/section boundary.
    const pxPerElPx = elHeight > 0 ? canvas.height / elHeight : scale;

    // Greedily cut each page at the furthest row/section boundary that fits.
    // The sheet's bottom edge (`elHeight`) carries the outer border, so include
    // it as a valid cut — the last page then keeps the bottom frame, and the
    // small trailing padding+border attaches to the last content page rather
    // than spilling onto a blank extra page (elHeight − footer-bottom is only a
    // few px, so it fits under the same page's limit).
    const slices = paginateByBreaks(elHeight, pageCapEl, [...breaks, elHeight]);

    for (let i = 0; i < slices.length; i += 1) {
        const [start, end] = slices[i];
        const sliceElH = end - start;
        if (sliceElH <= 0) continue;

        const srcY = Math.round(start * pxPerElPx);
        const srcH = Math.min(
            Math.round(sliceElH * pxPerElPx),
            canvas.height - srcY,
        );
        if (srcH <= 0) continue;
        const tmp = document.createElement("canvas");
        tmp.width = canvas.width;
        tmp.height = srcH;
        const ctx = tmp.getContext("2d");
        if (!ctx) continue;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, tmp.width, tmp.height);
        ctx.drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH);

        if (i > 0) pdf.addPage();
        // Height in mm derived from the ACTUAL sliced pixels so the aspect ratio
        // is exact (imgW / canvas.width == mm per canvas px).
        const sliceMmH = (srcH * imgW) / canvas.width;
        pdf.addImage(tmp.toDataURL("image/jpeg", 0.92), "JPEG", margin, margin, imgW, sliceMmH);
    }

    const name = fileName.toLowerCase().endsWith(".pdf") ? fileName : `${fileName}.pdf`;
    pdf.save(name);
}

/**
 * Collect the vertical offsets (px, relative to the element's top) at which it
 * is safe to break a page — the bottom edge of every table row and of every
 * top-level invoice section. A page cut at one of these never splits a row.
 */
function collectBreakOffsets(el: HTMLElement, topOffset: number): number[] {
    const set = new Set<number>();
    const add = (node: Element) => {
        set.add(node.getBoundingClientRect().bottom - topOffset);
    };
    // Between table rows (item table, fee/tax tables, totals table).
    el.querySelectorAll("tr").forEach(add);
    // Between the top-level sections (QR/meta, title, seller, buyer, tables,
    // signatures, footer) — the children of the invoice's content stack.
    const stack = el.firstElementChild?.lastElementChild;
    if (stack) Array.from(stack.children).forEach(add);
    return [...set].filter((v) => v > 0).sort((a, b) => a - b);
}

/**
 * Greedy page tiling: from each page top, advance to the LAST break offset that
 * still fits within one printable page height (`pageCapEl`, in element px). Falls
 * back to a hard cut only when a single block is taller than a page.
 */
function paginateByBreaks(
    totalH: number,
    pageCapEl: number,
    breaks: number[],
): Array<[number, number]> {
    const slices: Array<[number, number]> = [];
    const EPS = 1;
    let start = 0;
    while (start < totalH - EPS) {
        const limit = start + pageCapEl;
        let bottom = -1;
        for (const c of breaks) {
            if (c > start + EPS && c <= limit + 0.5) bottom = c;
        }
        if (bottom <= start) bottom = Math.min(limit, totalH); // block > 1 page
        bottom = Math.min(bottom, totalH);
        slices.push([start, bottom]);
        start = bottom;
        if (slices.length > 30) break; // runaway guard
    }
    return slices.length > 0 ? slices : [[0, totalH]];
}
