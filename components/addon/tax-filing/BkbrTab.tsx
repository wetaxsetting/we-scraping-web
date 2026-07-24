"use client";

import { useTranslation } from "@/lib/i18n";
import Pagination, { usePagination } from "@/components/shared/Pagination";
import { BKBR_GROUPS } from "./mockData";
import { Fragment } from "react/jsx-runtime";

function fmtNum(n: number): string {
  return n.toLocaleString("de-DE", { maximumFractionDigits: 0 });
}

const BORDER_R = "border-r border-[#e5e7eb]";
const BORDER_B = "border-b border-[#e5e7eb]";

export default function BkbrTab() {
  const { t } = useTranslation();

  // Flatten all invoice rows for pagination
  const allRows = BKBR_GROUPS.flatMap((g) =>
    g.rows.map((r) => ({ ...r, groupId: g.id })),
  );
  const { page, pageSize, pageCount, paged, setPage, setPageSize, counts } =
    usePagination({ items: allRows });

  // Build set of visible row keys for this page
  const visibleKeys = new Set(paged.map((r) => `${r.groupId}-${r.no}`));

  // Grand totals from mockData (business-correct values, not sum of individual vat fields)
  const grandRevenue = BKBR_GROUPS.reduce((s, g) => s + g.totalRevenue, 0);
  const grandVat = BKBR_GROUPS.reduce((s, g) => s + g.totalVat, 0);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* ── Scrollable content ────────────────────────────────────────────── */}
      <div className="custom-scrollbar-y min-h-0 flex-1 overflow-y-auto px-[400px]">
        <div className="flex min-h-full flex-col px-6 pb-6">
          {/* Title */}
          <div className="pb-4 pt-6 text-center">
            <h2 className="text-wb-16 font-bold uppercase tracking-wide text-wb-dark">
              {t("tax_filing.bkbr.title")}
            </h2>
            <p className="mt-0.5 text-wb-13 font-medium text-wb-ntrl-6">
              {t("tax_filing.bkbr.tax_period", { period: "Month 1 / 2026" })}
            </p>
          </div>

          {/* ── Table ─────────────────────────────────────────────────────── */}
          <div className="overflow-x-auto border border-[#e5e7eb]">
            <table className="w-full min-w-308 table-fixed border-collapse">
              {/*
               * Columns (total 1232px):
               * No.(48) | Symbol/Code combined(120) | Date(120) | Customer(416)
               * | Tax Code(140) | Revenue(170) | Tax Rate(83) | VAT(135)
               */}
              <colgroup>
                <col className="w-12" />
                <col className="w-30" />
                <col className="w-30" />
                <col className="w-104" />
                <col className="w-35" />
                <col className="w-42.5" />
                <col className="w-20.75" />
                <col className="w-33.75" />
              </colgroup>

              <thead>
                <tr className="h-12 bg-wb-bg-sidebar">
                  <th
                    className={`${BORDER_B} ${BORDER_R} px-2.5 text-center text-wb-13 font-semibold text-wb-dark`}
                  >
                    {t("tax_filing.bkbr.col_no")}
                  </th>
                  {/* Combined Symbol Code + Sub-code column */}
                  <th
                    className={`${BORDER_B} ${BORDER_R} px-2.5 text-center text-wb-13 font-semibold text-wb-dark`}
                  >
                    {t("tax_filing.bkbr.col_symbol")}
                  </th>
                  <th
                    className={`${BORDER_B} ${BORDER_R} px-2.5 text-center text-wb-13 font-semibold text-wb-dark`}
                  >
                    {t("tax_filing.bkbr.col_date")}
                  </th>
                  <th
                    className={`${BORDER_B} ${BORDER_R} px-2.5 text-left text-wb-13 font-semibold text-wb-dark`}
                  >
                    {t("tax_filing.bkbr.col_customer")}
                  </th>
                  <th
                    className={`${BORDER_B} ${BORDER_R} px-2.5 text-center text-wb-13 font-semibold text-wb-dark`}
                  >
                    {t("tax_filing.bkbr.col_tax_code")}
                  </th>
                  <th
                    className={`${BORDER_B} ${BORDER_R} px-2.5 text-right text-wb-13 font-semibold text-wb-dark`}
                  >
                    {t("tax_filing.bkbr.col_revenue")}
                  </th>
                  <th
                    className={`${BORDER_B} ${BORDER_R} px-2.5 text-center text-wb-13 font-semibold text-wb-dark`}
                  >
                    {t("tax_filing.bkbr.col_tax_rate")}
                  </th>
                  <th
                    className={`${BORDER_B} px-2.5 text-right text-wb-13 font-semibold text-wb-dark`}
                  >
                    {t("tax_filing.bkbr.col_vat")}
                  </th>
                </tr>
              </thead>

              <tbody>
                {BKBR_GROUPS.map((group) => {
                  const visibleRows = group.rows.filter((r) =>
                    visibleKeys.has(`${group.id}-${r.no}`),
                  );
                  if (visibleRows.length === 0) return null;

                  return (
                    <Fragment key={`gh-${group.id}`}>
                      {/* Group header */}
                      <tr key={`gh-${group.id}`} className="h-12 bg-[#EAF3FF]">
                        <td
                          colSpan={8}
                          className={`${BORDER_B} px-3 text-wb-13 font-semibold text-[#0060B9]`}
                        >
                          {group.label}
                        </td>
                      </tr>

                      {/* Data rows */}
                      {visibleRows.map((row, ri) => (
                        <tr
                          key={`${group.id}-${ri}`}
                          className={`h-12 ${BORDER_B} hover:bg-black/[0.02]`}
                        >
                          <td
                            className={`${BORDER_R} px-2.5 text-center text-wb-13 font-medium text-wb-ink`}
                          >
                            {row.no}
                          </td>
                          {/* Symbol/Code — code on top, sub-code below in muted gray */}
                          <td className={`${BORDER_R} px-2.5 py-1 text-center`}>
                            <div className="flex flex-col gap-0.5">
                              <span className="text-wb-13 font-medium text-wb-ink">
                                {row.symbolCode}
                              </span>
                              <span className="text-wb-13 font-medium text-wb-ntrl-6">
                                {row.symbolSubCode}
                              </span>
                            </div>
                          </td>
                          <td
                            className={`${BORDER_R} px-2.5 text-center text-wb-13 font-medium text-wb-ink`}
                          >
                            {row.date}
                          </td>
                          <td
                            className={`${BORDER_R} px-2.5 text-wb-13 font-medium text-wb-ink`}
                          >
                            {row.customer}
                          </td>
                          <td
                            className={`${BORDER_R} px-2.5 text-center text-wb-13 font-medium text-wb-ink`}
                          >
                            {row.taxCode}
                          </td>
                          <td
                            className={`${BORDER_R} px-2.5 text-right text-wb-13 font-medium text-wb-ink`}
                          >
                            {fmtNum(row.revenue)}
                          </td>
                          <td
                            className={`${BORDER_R} px-2.5 text-center text-wb-13 font-medium text-wb-ink`}
                          >
                            {row.taxRate}
                          </td>
                          <td className="px-2.5 text-right text-wb-13 font-medium text-wb-ink">
                            {fmtNum(row.vat)}
                          </td>
                        </tr>
                      ))}

                      {/* Group subtotal — uses mockData totals (business-correct) */}
                      <tr
                        key={`gt-${group.id}`}
                        className="h-12 bg-wb-bg-sidebar"
                      >
                        <td
                          colSpan={5}
                          className={`${BORDER_B} ${BORDER_R} px-3 text-center text-wb-13 font-semibold text-wb-dark`}
                        >
                          {t("tax_filing.bkbr.total_group", {
                            group: group.taxRate,
                          })}
                        </td>
                        <td
                          className={`${BORDER_B} ${BORDER_R} px-2.5 text-right text-wb-13 font-semibold text-wb-dark`}
                        >
                          {fmtNum(group.totalRevenue)}
                        </td>
                        <td
                          className={`${BORDER_B} ${BORDER_R} px-2.5 text-center text-wb-13 font-semibold text-wb-dark`}
                        >
                          —
                        </td>
                        <td
                          className={`${BORDER_B} px-2.5 text-right text-wb-13 font-semibold text-wb-dark`}
                        >
                          {fmtNum(group.totalVat)}
                        </td>
                      </tr>
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-auto" />
        </div>
      </div>

      {/* ── Pagination ────────────────────────────────────────────────────── */}
      <Pagination
        page={page}
        pageCount={pageCount}
        pageSize={pageSize}
        totalLabel={`${counts.shown} of ${counts.total}`}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        className="shrink-0 px-106"
      />

      {/* ── Total Output (Sales) — pinned below pagination ─────────────── */}
      <div className="shrink-0 px-106">
        <div className="overflow-x-auto border-t border-[#e5e7eb] bg-[#EAF3FF]">
          <table className="w-full min-w-308 table-fixed border-collapse">
            <colgroup>
              <col className="w-12" />
              <col className="w-30" />
              <col className="w-30" />
              <col className="w-104" />
              <col className="w-35" />
              <col className="w-42.5" />
              <col className="w-20.75" />
              <col className="w-33.75" />
            </colgroup>
            <tbody>
              <tr className="h-12">
                <td
                  colSpan={5}
                  className={`${BORDER_R} px-3 text-right text-wb-13 font-bold text-[#0060B9]`}
                >
                  {t("tax_filing.bkbr.total_output")}
                </td>
                <td
                  className={`${BORDER_R} px-2.5 text-right text-wb-13 font-bold text-[#0060B9]`}
                >
                  {fmtNum(grandRevenue)}
                </td>
                <td
                  className={`${BORDER_R} px-2.5 text-center text-wb-13 font-bold text-[#0060B9]`}
                >
                  —
                </td>
                <td className="px-2.5 text-right text-wb-13 font-bold text-[#0060B9]">
                  {fmtNum(grandVat)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
