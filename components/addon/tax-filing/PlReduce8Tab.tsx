"use client";

import Pagination from "@/components/shared/Pagination";
import { useTranslation } from "@/lib/i18n";
import { useDialog } from "@/components/shared/dialog";
import { useApiData } from "@/lib/api/useApiData";
import { fetchAnnexInvoices } from "@/lib/api/addon";
import LoadingOverlay from "@/components/shared/LoadingOverlay";
import { useServerPagination } from "@/hooks/useServerPagination";
import type { AnnexInvoiceRow, AnnexTaxGroup } from "./types";

function fmtNum(n: number): string {
  return n.toLocaleString("de-DE", { maximumFractionDigits: 0 });
}

/**
 * Figma 153:58853 column (5) = (4) × 80% — the reduced rate is derived from the
 * standard rate the wire ships in `vat_rate` (e.g. "10%" → "8%").
 */
function reducedRate(standard: string): string {
  const n = Number.parseFloat(standard.replace("%", "").trim());
  if (!Number.isFinite(n)) return "";
  const r = n * 0.8;
  return `${Number.isInteger(r) ? r : r.toFixed(1)}%`;
}

/** Fold a section's `tax_groups` into one Total row (whole filtered set). */
function sumTaxGroups(groups: AnnexTaxGroup[] | undefined) {
  return (groups ?? []).reduce(
    (acc, g) => ({
      splyAmt: acc.splyAmt + g.totalSplyAmt,
      vatAmt: acc.vatAmt + g.totalVatAmt,
      reducedAmt: acc.reducedAmt + g.totalReducedAmt,
    }),
    { splyAmt: 0, vatAmt: 0, reducedAmt: 0 },
  );
}

const BR = "border-r border-wb-gray-03";
const BB = "border-b border-wb-gray-03";
const HEAD_CELL =
  "whitespace-normal border-b border-r border-wb-gray-04 bg-wb-ntrl-3 px-2.5 py-2 align-middle text-wb-13 font-semibold text-wb-dark";
const CELL = "px-2.5 align-middle text-wb-13 font-medium text-wb-ink";
const TOTAL_CELL =
  "whitespace-nowrap border-y border-r border-wb-gray-03 bg-brand-soft px-2.5 align-middle text-wb-13 font-bold text-brand";

/** Right-aligned "Currency unit: Vietnam Dong" caption under each section. */
function CurrencyNote({ label }: { label: string }) {
  return (
    <div className="px-2 py-1 text-right text-wb-13 font-medium italic text-wb-gray-05">
      {label}
    </div>
  );
}

export default function PlReduce8Tab({
  sid,
  period,
}: {
  sid: number | null;
  /** Declaration period label (e.g. "06/2026") — sourced from the detail API. */
  period: string;
}) {
  const { t } = useTranslation();
  const dialog = useDialog();

  // Two independent server-paginated sections: I = purchases (io_dv "I"),
  // II = sales (io_dv "O"). Page is 1-based in the UI, sent 0-based to the API.
  const pg1 = useServerPagination();
  const pg2 = useServerPagination();

  const sec1 = useApiData(
    () =>
      sid != null
        ? fetchAnnexInvoices(sid, {
            annex_type: "REDUCE8",
            io_dv: "I",
            page: pg1.pageIndex,
            size: pg1.pageSize,
          })
        : Promise.resolve(null),
    [sid, pg1.page, pg1.pageSize],
  );
  const sec2 = useApiData(
    () =>
      sid != null
        ? fetchAnnexInvoices(sid, {
            annex_type: "REDUCE8",
            io_dv: "O",
            page: pg2.pageIndex,
            size: pg2.pageSize,
          })
        : Promise.resolve(null),
    [sid, pg2.page, pg2.pageSize],
  );

  const rows1: AnnexInvoiceRow[] = sec1.data?.rows ?? [];
  const rows2: AnnexInvoiceRow[] = sec2.data?.rows ?? [];

  // Each table's Total row aggregates that section's `tax_groups` (PL142 is
  // normally 8%-only, but summing keeps the row right if the backend ever
  // splits the section across several rate groups).
  const sec1Groups = sumTaxGroups(sec1.data?.taxGroups);
  const sec2Groups = sumTaxGroups(sec2.data?.taxGroups);
  const sec1Revenue = sec1Groups.splyAmt;
  const sec1Vat = sec1Groups.vatAmt;
  const sec2Revenue = sec2Groups.splyAmt;
  const sec2Reduced = sec2Groups.reducedAmt;

  // Section III — (III) = (II) − (I): the sold side's `total_vat_amt` less the
  // purchased side's, both from `tax_groups`. The result is signed — output VAT
  // above input VAT gives a positive figure, below it a negative one.
  //
  // `grand_total` is deliberately unused here: the backend ships one per request
  // (i.e. one per io_dv) and its role on this screen isn't settled yet.
  const vatDifference = sec2Groups.vatAmt - sec1Groups.vatAmt;
  const negative = vatDifference < 0;

  const notImplemented = () =>
    dialog.open({
      type: "warning",
      title: t("dialog.warning"),
      description: t("common.coming_soon"),
    });

  const invoicesListButton = (
    <button
      type="button"
      onClick={notImplemented}
      className="flex h-8 shrink-0 cursor-pointer items-center justify-center whitespace-nowrap rounded-md bg-white px-3 text-wb-14-tight font-medium text-wb-ink shadow-wb-btn hover:bg-black/[0.03]"
    >
      {t("tax_filing.pl_reduce8.reduced_invoices_list")}
    </button>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* ── Horizontal scroller — the whole tab body keeps a 1366px floor,
           so every section pans together instead of scrolling apart. ──── */}
      <div className="custom-scrollbar-x min-h-0 flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex h-full min-w-[1366px] flex-col">
          <div className="custom-scrollbar-y min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto flex min-h-full w-full max-w-480 flex-col px-6 pb-8">
              {/* Title */}
              <div className="pb-4 pt-6 text-center">
                <h2 className="text-wb-16 font-bold uppercase tracking-wide text-wb-dark">
                  {t("tax_filing.pl_reduce8.title")}
                </h2>
                <p className="mt-0.5 text-wb-13 font-medium italic text-wb-ntrl-6">
                  {t("tax_filing.pl_reduce8.tax_period", { period })}
                </p>
              </div>

              {/* ── Section I — purchases ───────────────────────────────────────── */}
              <div className="relative border border-wb-gray-03">
                {sec1.loading && <LoadingOverlay />}

                {/* Section header + action */}
                <div className="flex items-start justify-between gap-4 px-4 py-4">
                  <div className="min-w-0">
                    <p className="text-wb-14 font-semibold text-wb-dark">
                      {t("tax_filing.pl_reduce8.sec1_title")}
                    </p>
                    <p className="ml-3 mt-0.5 text-wb-13 font-medium italic text-wb-ntrl-6">
                      {t("tax_filing.pl_reduce8.sec1_subtitle")}
                    </p>
                  </div>
                  {invoicesListButton}
                </div>

                <div>
                  <table className="w-full table-fixed border-collapse">
                    {/* Figma 153:58901 — 48 / 560 / 304 / 304 = 1216 */}
                    <colgroup>
                      <col className="w-12" />
                      <col className="w-[560px]" />
                      <col className="w-[304px]" />
                      <col className="w-[304px]" />
                    </colgroup>

                    <thead>
                      <tr className="h-12">
                        <th className={`${HEAD_CELL} text-center`}>
                          {t("tax_filing.pl_reduce8.col_no")}
                        </th>
                        <th className={`${HEAD_CELL} text-center`}>
                          {t("tax_filing.pl_reduce8.col_goods_services_name")}
                        </th>
                        <th className={`${HEAD_CELL} text-center`}>
                          {t("tax_filing.pl_reduce8.col_revenue")}
                        </th>
                        <th className={`${HEAD_CELL} border-r-0 text-center`}>
                          {t("tax_filing.pl_reduce8.col_vat_8")}
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {!sec1.loading && rows1.length === 0 ? (
                        <tr>
                          <td
                            colSpan={4}
                            className="h-40 whitespace-nowrap px-3 text-center text-wb-13 font-medium text-wb-ntrl-6"
                          >
                            {t("tax_filing.no_data")}
                          </td>
                        </tr>
                      ) : (
                        rows1.map((row, i) => (
                          <tr
                            key={row.id ?? `s1-${i}`}
                            className={`h-12 ${BB} hover:bg-black/[0.02]`}
                          >
                            <td
                              className={`${BR} ${CELL} whitespace-nowrap text-center`}
                            >
                              {pg1.pageIndex * pg1.pageSize + i + 1}
                            </td>
                            <td className={`${BR} truncate ${CELL}`}>
                              {row.prodNm}
                            </td>
                            <td
                              className={`${BR} ${CELL} whitespace-nowrap text-right`}
                            >
                              {fmtNum(row.splyAmt)}
                            </td>
                            <td
                              className={`${CELL} whitespace-nowrap text-right`}
                            >
                              {fmtNum(row.vatAmt)}
                            </td>
                          </tr>
                        ))
                      )}

                      {/* Total */}
                      <tr className="h-12">
                        <td
                          colSpan={2}
                          className={`${TOTAL_CELL} text-center font-semibold text-wb-dark`}
                        >
                          {t("tax_filing.pl_reduce8.sec1_total")}
                        </td>
                        <td className={`${TOTAL_CELL} text-right`}>
                          {fmtNum(sec1Revenue)}
                        </td>
                        <td className={`${TOTAL_CELL} border-r-0 text-right`}>
                          {fmtNum(sec1Vat)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <CurrencyNote
                  label={t("tax_filing.pl_reduce8.currency_note")}
                />
              </div>

              <Pagination
                page={pg1.page}
                pageCount={Math.max(1, sec1.data?.totalPages ?? 1)}
                pageSize={pg1.pageSize}
                totalLabel={`${rows1.length} of ${sec1.data?.totalCount ?? 0}`}
                onPageChange={pg1.setPage}
                onPageSizeChange={pg1.setPageSize}
                className="mb-6 mt-3"
              />

              {/* ── Section II — sales ──────────────────────────────────────────── */}
              <div className="relative border border-wb-gray-03">
                {sec2.loading && <LoadingOverlay />}

                <div className="flex items-start justify-between gap-4 px-4 py-4">
                  <p className="min-w-0 text-wb-14 font-semibold text-wb-dark">
                    {t("tax_filing.pl_reduce8.sec2_title")}
                  </p>
                  {invoicesListButton}
                </div>

                <div>
                  <table className="w-full table-fixed border-collapse">
                    {/* Figma 153:59046 — 48 / 488 / 230 / 110 / 110 / 230 = 1216 */}
                    <colgroup>
                      <col className="w-12" />
                      <col className="w-[488px]" />
                      <col className="w-[230px]" />
                      <col className="w-[110px]" />
                      <col className="w-[110px]" />
                      <col className="w-[230px]" />
                    </colgroup>

                    <thead>
                      {/* Row 1 — merged "VAT rate / Tax calculation ratio" spans (4)+(5) */}
                      <tr className="h-[33px]">
                        <th rowSpan={2} className={`${HEAD_CELL} text-center`}>
                          {t("tax_filing.pl_reduce8.col_no")}
                        </th>
                        <th rowSpan={2} className={`${HEAD_CELL} text-center`}>
                          {t("tax_filing.pl_reduce8.col_goods_services_name")}
                        </th>
                        <th rowSpan={2} className={`${HEAD_CELL} text-center`}>
                          {t("tax_filing.pl_reduce8.col_revenue_excl")}
                        </th>
                        <th colSpan={2} className={`${HEAD_CELL} text-center`}>
                          {t("tax_filing.pl_reduce8.col_vat_header")}
                        </th>
                        <th
                          rowSpan={2}
                          className={`${HEAD_CELL} border-r-0 text-center`}
                        >
                          {t("tax_filing.pl_reduce8.col_vat_amount")}
                        </th>
                      </tr>
                      {/* Row 2 — VAT sub-headers */}
                      <tr className="h-[33px]">
                        <th className={`${HEAD_CELL} text-center`}>
                          {t("tax_filing.pl_reduce8.col_vat_rate")}
                        </th>
                        <th className={`${HEAD_CELL} text-center`}>
                          {t("tax_filing.pl_reduce8.col_vat_reduced")}
                        </th>
                      </tr>
                      {/* Formula / column-number row — Figma 153:59119 */}
                      <tr className={`h-8 ${BB}`}>
                        {[
                          "(1)",
                          "(2)",
                          "(3)",
                          "(4)",
                          "(5) = (4) x 80%",
                          "(6) = (3) x [(4) - (5)]",
                        ].map((label, i) => (
                          <th
                            key={label}
                            className={`${i < 5 ? BR : ""} whitespace-nowrap px-2.5 text-center text-wb-12 font-normal text-wb-ntrl-4`}
                          >
                            {label}
                          </th>
                        ))}
                      </tr>
                    </thead>

                    <tbody>
                      {!sec2.loading && rows2.length === 0 ? (
                        <tr>
                          <td
                            colSpan={6}
                            className="h-40 whitespace-nowrap px-3 text-center text-wb-13 font-medium text-wb-ntrl-6"
                          >
                            {t("tax_filing.no_data")}
                          </td>
                        </tr>
                      ) : (
                        rows2.map((row, i) => (
                          <tr
                            key={row.id ?? `s2-${i}`}
                            className={`h-12 ${BB} hover:bg-black/[0.02]`}
                          >
                            <td
                              className={`${BR} ${CELL} whitespace-nowrap text-center`}
                            >
                              {pg2.pageIndex * pg2.pageSize + i + 1}
                            </td>
                            <td className={`${BR} truncate ${CELL}`}>
                              {row.prodNm}
                            </td>
                            <td
                              className={`${BR} ${CELL} whitespace-nowrap text-right`}
                            >
                              {fmtNum(row.splyAmt)}
                            </td>
                            <td
                              className={`${BR} ${CELL} whitespace-nowrap text-center`}
                            >
                              {row.vatRate}
                            </td>
                            <td
                              className={`${BR} ${CELL} whitespace-nowrap text-center`}
                            >
                              {reducedRate(row.vatRate)}
                            </td>
                            <td
                              className={`${CELL} whitespace-nowrap text-right`}
                            >
                              {fmtNum(row.reducedAmt)}
                            </td>
                          </tr>
                        ))
                      )}

                      {/* Total */}
                      <tr className="h-12">
                        <td
                          colSpan={2}
                          className={`${TOTAL_CELL} text-center font-semibold text-wb-dark`}
                        >
                          {t("tax_filing.pl_reduce8.sec2_total")}
                        </td>
                        <td className={`${TOTAL_CELL} text-right`}>
                          {fmtNum(sec2Revenue)}
                        </td>
                        <td className={`${TOTAL_CELL} text-center`}>–</td>
                        <td className={`${TOTAL_CELL} text-center`}>–</td>
                        <td className={`${TOTAL_CELL} border-r-0 text-right`}>
                          {fmtNum(sec2Reduced)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <CurrencyNote
                  label={t("tax_filing.pl_reduce8.currency_note")}
                />
              </div>

              <Pagination
                page={pg2.page}
                pageCount={Math.max(1, sec2.data?.totalPages ?? 1)}
                pageSize={pg2.pageSize}
                totalLabel={`${rows2.length} of ${sec2.data?.totalCount ?? 0}`}
                onPageChange={pg2.setPage}
                onPageSizeChange={pg2.setPageSize}
                className="mb-6 mt-3"
              />

              {/* ── Section III — VAT difference ────────────────────────────────── */}
              <div className="border border-wb-gray-03">
                <div className="px-4 py-4">
                  <p className="text-wb-14 font-semibold text-wb-dark">
                    {t("tax_filing.pl_reduce8.sec3_title")}
                  </p>
                </div>

                <div>
                  <table className="w-full table-fixed border-collapse">
                    {/* Figma 153:59254 — 900 label + remaining value cell */}
                    <colgroup>
                      <col className="w-[900px]" />
                      <col />
                    </colgroup>
                    <tbody>
                      <tr className="h-12">
                        <td className="whitespace-nowrap border-y border-r border-wb-gray-03 bg-white px-4 align-middle text-wb-14 font-semibold text-wb-ink">
                          {t("tax_filing.pl_reduce8.sec3_label")}{" "}
                          <span className="font-normal text-wb-ntrl-4">
                            {t("tax_filing.pl_reduce8.sec3_formula")}
                          </span>
                        </td>
                        <td
                          className={`whitespace-nowrap border-y px-4 text-right align-middle text-wb-14 font-bold ${
                            negative
                              ? "border-wb-red-02 bg-wb-red-01 text-wb-red-07"
                              : "border-wb-gray-03 bg-brand-soft text-brand"
                          }`}
                        >
                          {fmtNum(vatDifference)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <CurrencyNote
                  label={t("tax_filing.pl_reduce8.currency_note")}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
