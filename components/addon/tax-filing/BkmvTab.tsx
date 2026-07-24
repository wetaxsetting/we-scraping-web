"use client";

import { useTranslation } from "@/lib/i18n";
import Pagination, { usePagination } from "@/components/shared/Pagination";
import { BKMV_GROUPS } from "./mockData";
import { Fragment } from "react/jsx-runtime";

function fmtNum(n: number): string {
  return n.toLocaleString("de-DE", { maximumFractionDigits: 0 });
}

const BORDER_R = "border-r border-[#e5e7eb]";
const BORDER_B = "border-b border-[#e5e7eb]";

export default function BkmvTab() {
  const { t } = useTranslation();

  // Flatten all invoice rows for pagination
  const allRows = BKMV_GROUPS.flatMap((g) =>
    g.rows.map((r) => ({ ...r, groupId: g.id })),
  );
  const { page, pageSize, pageCount, paged, setPage, setPageSize, counts } =
    usePagination({ items: allRows });

  // Build set of visible row keys for this page
  const visibleKeys = new Set(paged.map((r) => `${r.groupId}-${r.no}`));

  // Grand totals from mockData (business-correct values)
  const grandRevenue = BKMV_GROUPS.reduce((s, g) => s + g.totalRevenue, 0);
  const grandVat = BKMV_GROUPS.reduce((s, g) => s + g.totalVat, 0);
  const grandImportVat = BKMV_GROUPS.reduce((s, g) => s + g.totalImportVat, 0);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* ── Scrollable content ────────────────────────────────────────────── */}
      <div className="custom-scrollbar-y min-h-0 flex-1 overflow-y-auto px-[400px]">
        <div className="flex min-h-full flex-col px-6 pb-6">
          {/* Title */}
          <div className="pb-4 pt-6 text-center">
            <h2 className="text-wb-16 font-bold uppercase tracking-wide text-wb-dark">
              {t("tax_filing.bkmv.title")}
            </h2>
            <p className="mt-0.5 text-wb-13 font-medium text-wb-ntrl-6">
              {t("tax_filing.bkmv.tax_period", { period: "January 2026" })}
            </p>
          </div>

          {/* ── Table ─────────────────────────────────────────────────────── */}
          <div className="overflow-x-auto border border-[#e5e7eb]">
            <table className="w-full min-w-308 table-fixed border-collapse">
              {/*
               * Columns (total 1232px):
               * No.(48) | Symbol(95) | Date(120) | Supplier(323)
               * | Tax Code(120) | Revenue(170) | VAT(135) | Imported(86) | Import VAT(135)
               */}
              <colgroup>
                <col className="w-12" />
                <col className="w-23.75" />
                <col className="w-30" />
                <col className="w-80.75" />
                <col className="w-30" />
                <col className="w-42.5" />
                <col className="w-33.75" />
                <col className="w-21.5" />
                <col className="w-33.75" />
              </colgroup>

              <thead>
                <tr className="h-12 bg-wb-bg-sidebar">
                  <th
                    className={`${BORDER_B} ${BORDER_R} px-2.5 text-center text-wb-13 font-semibold text-wb-dark`}
                  >
                    {t("tax_filing.bkmv.col_no")}
                  </th>
                  {/* Combined Symbol Code + Sub-code column */}
                  <th
                    className={`${BORDER_B} ${BORDER_R} px-2.5 text-center text-wb-13 font-semibold text-wb-dark`}
                  >
                    {t("tax_filing.bkmv.col_symbol")}
                  </th>
                  <th
                    className={`${BORDER_B} ${BORDER_R} px-2.5 text-center text-wb-13 font-semibold text-wb-dark`}
                  >
                    {t("tax_filing.bkmv.col_date")}
                  </th>
                  <th
                    className={`${BORDER_B} ${BORDER_R} px-2.5 text-left text-wb-13 font-semibold text-wb-dark`}
                  >
                    {t("tax_filing.bkmv.col_supplier")}
                  </th>
                  <th
                    className={`${BORDER_B} ${BORDER_R} px-2.5 text-center text-wb-13 font-semibold text-wb-dark`}
                  >
                    {t("tax_filing.bkmv.col_tax_code")}
                  </th>
                  <th
                    className={`${BORDER_B} ${BORDER_R} px-2.5 text-right text-wb-13 font-semibold text-wb-dark`}
                  >
                    {t("tax_filing.bkmv.col_revenue")}
                  </th>
                  <th
                    className={`${BORDER_B} ${BORDER_R} px-2.5 text-right text-wb-13 font-semibold text-wb-dark`}
                  >
                    {t("tax_filing.bkmv.col_vat")}
                  </th>
                  <th
                    className={`${BORDER_B} ${BORDER_R} px-2.5 text-center text-wb-13 font-semibold text-wb-dark`}
                  >
                    {t("tax_filing.bkmv.col_imported")}
                  </th>
                  <th
                    className={`${BORDER_B} px-2.5 text-right text-wb-13 font-semibold text-wb-dark`}
                  >
                    {t("tax_filing.bkmv.col_import_vat")}
                  </th>
                </tr>
              </thead>

              <tbody>
                {BKMV_GROUPS.map((group, index) => {
                  const visibleRows = group.rows.filter((r) =>
                    visibleKeys.has(`${group.id}-${r.no}`),
                  );

                  return (
                    <Fragment key={`gh-${group.id}`}>
                      {/* Group header */}
                      <tr className="h-12 bg-ntrl-2">
                        <td
                          colSpan={9}
                          className={`${BORDER_B} px-3 text-wb-13 font-semibold text-[#0060B9]`}
                        >
                          {group.label}
                        </td>
                      </tr>

                      {visibleRows.length === 0 ? (
                        /* No invoices placeholder */
                        <tr className={`h-12 ${BORDER_B}`}>
                          <td
                            colSpan={9}
                            className="px-3 text-center text-wb-13 font-medium text-wb-ntrl-6 italic"
                          >
                            {t("tax_filing.bkmv.no_invoices")}
                          </td>
                        </tr>
                      ) : (
                        /* Data rows */
                        visibleRows.map((row, ri) => (
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
                            <td
                              className={`${BORDER_R} px-2.5 py-1 text-center`}
                            >
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
                              {row.supplier}
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
                              className={`${BORDER_R} px-2.5 text-right text-wb-13 font-medium text-wb-ink`}
                            >
                              {fmtNum(row.vat)}
                            </td>
                            <td
                              className={`${BORDER_R} px-2.5 text-center text-wb-13 font-medium text-wb-ink`}
                            >
                              {row.imported ? "✓" : ""}
                            </td>
                            <td className="px-2.5 text-right text-wb-13 font-medium text-wb-ink">
                              {fmtNum(row.importVat)}
                            </td>
                          </tr>
                        ))
                      )}

                      {/* Group subtotal — always shown, uses mockData totals */}
                      <tr
                        key={`gt-${group.id}`}
                        className="h-12 bg-wb-bg-sidebar"
                      >
                        <td
                          colSpan={5}
                          className={`${BORDER_B} ${BORDER_R} px-3 text-center text-wb-13 font-semibold text-wb-dark`}
                        >
                          {t("tax_filing.bkmv.total_group")} {index + 1}
                        </td>
                        <td
                          className={`${BORDER_B} ${BORDER_R} px-2.5 text-right text-wb-13 font-semibold text-wb-dark`}
                        >
                          {fmtNum(group.totalRevenue)}
                        </td>
                        <td
                          className={`${BORDER_B} ${BORDER_R} px-2.5 text-right text-wb-13 font-semibold text-wb-dark`}
                        >
                          {fmtNum(group.totalVat)}
                        </td>
                        <td
                          className={`${BORDER_B} ${BORDER_R} px-2.5 text-center text-wb-13 font-semibold text-wb-dark`}
                        >
                          —
                        </td>
                        <td
                          className={`${BORDER_B} px-2.5 text-right text-wb-13 font-semibold text-wb-dark`}
                        >
                          {fmtNum(group.totalImportVat)}
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
        className="shrink-0 px-106 pb-4"
      />

      {/* ── Total Input (Purchases) — pinned below pagination ─────────────── */}
      <div className="shrink-0 px-106">
        <div className="overflow-x-auto border-t border-[#e5e7eb] bg-[#EAF3FF]">
          <table className="w-full min-w-308 table-fixed border-collapse">
            <colgroup>
              <col className="w-12" />
              <col className="w-23.75" />
              <col className="w-30" />
              <col className="w-80.75" />
              <col className="w-30" />
              <col className="w-42.5" />
              <col className="w-33.75" />
              <col className="w-21.5" />
              <col className="w-33.75" />
            </colgroup>
            <tbody>
              <tr className="h-12">
                <td
                  colSpan={5}
                  className={`${BORDER_R} px-3 text-right text-wb-13 font-bold text-[#0060B9]`}
                >
                  {t("tax_filing.bkmv.total_input")}
                </td>
                <td
                  className={`${BORDER_R} px-2.5 text-right text-wb-13 font-bold text-[#0060B9]`}
                >
                  {fmtNum(grandRevenue)}
                </td>
                <td
                  className={`${BORDER_R} px-2.5 text-right text-wb-13 font-bold text-[#0060B9]`}
                >
                  {fmtNum(grandVat)}
                </td>
                <td
                  className={`${BORDER_R} px-2.5 text-center text-wb-13 font-bold text-[#0060B9]`}
                >
                  —
                </td>
                <td className="px-2.5 text-right text-wb-13 font-bold text-[#0060B9]">
                  {fmtNum(grandImportVat)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
