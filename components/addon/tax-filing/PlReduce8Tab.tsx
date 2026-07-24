"use client";

import Pagination, { usePagination } from "@/components/shared/Pagination";
import { useTranslation } from "@/lib/i18n";
import { PL_CSSX_PURCHASE_ROWS, PL_CSSX_SALE_ROWS } from "./mockData";

function fmtNum(n: number): string {
  return n.toLocaleString("de-DE", { maximumFractionDigits: 0 });
}

const BR = "border-r border-[#e5e7eb]";
const BB = "border-b border-[#e5e7eb]";

export default function PlReduce8Tab() {
  const { t } = useTranslation();

  const sec1 = usePagination({ items: PL_CSSX_PURCHASE_ROWS });
  const sec2 = usePagination({ items: PL_CSSX_SALE_ROWS });

  // Section I totals
  const sec1TotalRevenue = PL_CSSX_PURCHASE_ROWS.reduce(
    (s, r) => s + r.revenue,
    0,
  );
  const sec1TotalVat = PL_CSSX_PURCHASE_ROWS.reduce((s, r) => s + r.vat, 0);

  // Section II totals
  const sec2TotalRevenue = PL_CSSX_SALE_ROWS.reduce((s, r) => s + r.revenue, 0);
  const sec2TotalVat = PL_CSSX_SALE_ROWS.reduce((s, r) => s + r.vatAmount, 0);

  // Section III — VAT difference = output − input
  const vatDifference = sec2TotalVat - sec1TotalVat;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="custom-scrollbar-y min-h-0 flex-1 overflow-y-auto px-[400px]">
        <div className="flex min-h-full flex-col px-6 pb-8">
          {/* Title */}
          <div className="pb-4 pt-6 text-center">
            <h2 className="text-wb-16 font-bold uppercase tracking-wide text-wb-dark">
              {t("tax_filing.pl_reduce8.title")}
            </h2>
            <p className="mt-0.5 text-wb-13 font-medium text-wb-ntrl-6">
              {t("tax_filing.pl_reduce8.tax_period", { period: "January 2026" })}
            </p>
          </div>

          {/* ── Section I ───────────────────────────────────────────────────── */}
          <div className="mb-1 overflow-x-auto border border-[#e5e7eb]">
            {/* Section I header */}
            <div className="border-b border-[#e5e7eb] px-4 py-3">
              <p className="text-wb-14 font-semibold text-ntrl-9">
                {t("tax_filing.pl_reduce8.sec1_title")}
              </p>
              <p className="mt-0.5 ml-3 text-wb-13 font-medium text-wb-ntrl-6 italic">
                {t("tax_filing.pl_reduce8.sec1_subtitle")}
              </p>
            </div>

            {/* Section I table */}
            <table className="w-full min-w-[1216px] table-fixed border-collapse">
              {/*
               * Columns (total 1216px):
               * No.(48) | Description(560) | Revenue excl. tax(304) | VAT 8%(304)
               */}
              <colgroup>
                <col className="w-12" />
                <col className="w-[560px]" />
                <col className="w-[304px]" />
                <col className="w-[304px]" />
              </colgroup>

              <thead>
                <tr className="h-12 bg-wb-bg-sidebar">
                  <th
                    className={`${BB} ${BR} px-2.5 text-center text-wb-13 font-semibold text-wb-dark`}
                  >
                    {t("tax_filing.pl_reduce8.col_no")}
                  </th>
                  <th
                    className={`${BB} ${BR} px-2.5 text-left text-wb-13 font-semibold text-wb-dark`}
                  >
                    {t("tax_filing.pl_reduce8.col_goods_services_name")}
                  </th>
                  <th
                    className={`${BB} ${BR} px-2.5 text-right text-wb-13 font-semibold text-wb-dark`}
                  >
                    {t("tax_filing.pl_reduce8.col_revenue")}
                  </th>
                  <th
                    className={`${BB} px-2.5 text-right text-wb-13 font-semibold text-wb-dark`}
                  >
                    {t("tax_filing.pl_reduce8.col_vat_8")}
                  </th>
                </tr>
              </thead>

              <tbody>
                {sec1.paged.map((row) => (
                  <tr
                    key={row.no}
                    className={`h-12 ${BB} hover:bg-black/[0.02]`}
                  >
                    <td
                      className={`${BR} px-2.5 text-center text-wb-13 font-medium text-wb-ink`}
                    >
                      {row.no}
                    </td>
                    <td
                      className={`${BR} px-2.5 text-wb-13 font-medium text-wb-ink`}
                    >
                      {row.description}
                    </td>
                    <td
                      className={`${BR} px-2.5 text-right text-wb-13 font-medium text-wb-ink`}
                    >
                      {fmtNum(row.revenue)}
                    </td>
                    <td className="px-2.5 text-right text-wb-13 font-medium text-wb-ink">
                      {fmtNum(row.vat)}
                    </td>
                  </tr>
                ))}

                {/* Section I total row */}
                <tr className="h-12 bg-wb-bg-sidebar">
                  <td
                    colSpan={2}
                    className={`${BB} ${BR} px-3 text-center text-wb-13 font-semibold text-wb-dark`}
                  >
                    {t("tax_filing.pl_reduce8.sec1_total")}
                  </td>
                  <td
                    className={`${BB} ${BR} px-2.5 text-right text-wb-13 font-semibold text-wb-dark`}
                  >
                    {fmtNum(sec1TotalRevenue)}
                  </td>
                  <td
                    className={`${BB} px-2.5 text-right text-wb-13 font-semibold text-wb-dark`}
                  >
                    {fmtNum(sec1TotalVat)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Section I pagination */}
          <Pagination
            page={sec1.page}
            pageCount={sec1.pageCount}
            pageSize={sec1.pageSize}
            totalLabel={`${sec1.counts.shown} of ${sec1.counts.total}`}
            onPageChange={sec1.setPage}
            onPageSizeChange={sec1.setPageSize}
            className="mb-6"
          />

          {/* ── Section II ──────────────────────────────────────────────────── */}
          <div className="mb-1 overflow-x-auto border border-[#e5e7eb]">
            {/* Section II header */}
            <div className="border-b border-[#e5e7eb] bg-[#EAF3FF] px-4 py-3">
              <p className="text-wb-13 font-semibold text-[#0060B9]">
                {t("tax_filing.pl_reduce8.sec2_title")}
              </p>
            </div>

            {/* Section II table — 6 columns with split VAT header */}
            <table className="w-full min-w-[1216px] table-fixed border-collapse">
              {/*
               * Columns (total 1216px):
               * No.(48) | Description(488) | Revenue(230) | VAT Rate(110) | VAT Amount(110) | Notes(230)
               */}
              <colgroup>
                <col className="w-12" />
                <col className="w-[488px]" />
                <col className="w-[230px]" />
                <col className="w-[110px]" />
                <col className="w-[110px]" />
                <col className="w-[230px]" />
              </colgroup>

              <thead>
                {/* Row 1 — main header */}
                <tr className="h-10 bg-wb-bg-sidebar">
                  <th
                    rowSpan={2}
                    className={`${BB} ${BR} px-2.5 text-center text-wb-13 font-semibold text-wb-dark`}
                  >
                    {t("tax_filing.pl_reduce8.col_no")}
                  </th>
                  <th
                    rowSpan={2}
                    className={`${BB} ${BR} px-2.5 text-left text-wb-13 font-semibold text-wb-dark`}
                  >
                    {t("tax_filing.pl_reduce8.col_goods_services_name")}
                  </th>
                  <th
                    rowSpan={2}
                    className={`${BB} ${BR} px-2.5 text-right text-wb-13 font-semibold text-wb-dark`}
                  >
                    {t("tax_filing.pl_reduce8.col_revenue_excl")}
                  </th>
                  {/* Merged VAT header */}
                  <th
                    colSpan={2}
                    className={`border-b border-[#e5e7eb] ${BR} px-2.5 text-center text-wb-13 font-semibold text-wb-dark`}
                  >
                    {t("tax_filing.pl_reduce8.col_vat_header")}
                  </th>
                  <th
                    rowSpan={2}
                    className={`${BB} px-2.5 text-left text-wb-13 font-semibold text-wb-dark`}
                  >
                    {t("tax_filing.pl_reduce8.col_notes")}
                  </th>
                </tr>
                {/* Row 2 — VAT sub-headers */}
                <tr className="h-8 bg-wb-bg-sidebar">
                  <th
                    className={`${BB} ${BR} px-2.5 text-center text-wb-13 font-semibold text-wb-dark`}
                  >
                    {t("tax_filing.pl_reduce8.col_vat_rate")}
                  </th>
                  <th
                    className={`${BB} ${BR} px-2.5 text-right text-wb-13 font-semibold text-wb-dark`}
                  >
                    {t("tax_filing.pl_reduce8.col_vat_amount")}
                  </th>
                </tr>
              </thead>

              <tbody>
                {sec2.paged.map((row) => (
                  <tr
                    key={row.no}
                    className={`h-12 ${BB} hover:bg-black/[0.02]`}
                  >
                    <td
                      className={`${BR} px-2.5 text-center text-wb-13 font-medium text-wb-ink`}
                    >
                      {row.no}
                    </td>
                    <td
                      className={`${BR} px-2.5 text-wb-13 font-medium text-wb-ink`}
                    >
                      {row.description}
                    </td>
                    <td
                      className={`${BR} px-2.5 text-right text-wb-13 font-medium text-wb-ink`}
                    >
                      {fmtNum(row.revenue)}
                    </td>
                    <td
                      className={`${BR} px-2.5 text-center text-wb-13 font-medium text-wb-ink`}
                    >
                      {row.vatRate}
                    </td>
                    <td
                      className={`${BR} px-2.5 text-right text-wb-13 font-medium text-wb-ink`}
                    >
                      {fmtNum(row.vatAmount)}
                    </td>
                    <td className="px-2.5 text-wb-13 font-medium text-wb-ink">
                      {row.notes}
                    </td>
                  </tr>
                ))}

                {/* Section II total row */}
                <tr className="h-12 bg-wb-bg-sidebar">
                  <td
                    colSpan={2}
                    className={`${BB} ${BR} px-3 text-center text-wb-13 font-semibold text-wb-dark`}
                  >
                    {t("tax_filing.pl_reduce8.sec2_total")}
                  </td>
                  <td
                    className={`${BB} ${BR} px-2.5 text-right text-wb-13 font-semibold text-wb-dark`}
                  >
                    {fmtNum(sec2TotalRevenue)}
                  </td>
                  <td className={`${BB} ${BR} px-2.5 text-center`} />
                  <td
                    className={`${BB} ${BR} px-2.5 text-right text-wb-13 font-semibold text-wb-dark`}
                  >
                    {fmtNum(sec2TotalVat)}
                  </td>
                  <td className={`${BB} px-2.5`} />
                </tr>
              </tbody>
            </table>
          </div>

          {/* Section II pagination */}
          <Pagination
            page={sec2.page}
            pageCount={sec2.pageCount}
            pageSize={sec2.pageSize}
            totalLabel={`${sec2.counts.shown} of ${sec2.counts.total}`}
            onPageChange={sec2.setPage}
            onPageSizeChange={sec2.setPageSize}
            className="mb-6"
          />

          {/* ── Section III ─────────────────────────────────────────────────── */}
          <div className="overflow-x-auto border border-[#e5e7eb]">
            {/* Section III header */}
            <div className="border-b border-[#e5e7eb] bg-[#EAF3FF] px-4 py-2.5">
              <p className="text-wb-13 font-semibold text-[#0060B9]">
                {t("tax_filing.pl_reduce8.sec3_title")}
              </p>
            </div>

            {/* Section III — single summary row */}
            <table className="w-full min-w-[1216px] table-fixed border-collapse">
              <colgroup>
                <col className="w-[900px]" />
                <col className="w-[316px]" />
              </colgroup>
              <tbody>
                <tr className="h-12 bg-[#EAF3FF]">
                  <td
                    className={`${BR} px-4 text-wb-13 font-semibold text-[#0060B9]`}
                  >
                    {t("tax_filing.pl_reduce8.sec3_label")}
                  </td>
                  <td className="px-3 text-right text-wb-13 font-bold text-[#0060B9]">
                    {fmtNum(vatDifference)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Currency note */}
          <p className="mt-2 text-right text-wb-13 font-medium italic text-wb-ntrl-5">
            {t("tax_filing.pl_reduce8.currency_note")}
          </p>
        </div>
      </div>
    </div>
  );
}
