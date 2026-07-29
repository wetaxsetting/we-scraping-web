"use client";

import { useTranslation } from "@/lib/i18n";
import Pagination from "@/components/shared/Pagination";
import { Fragment } from "react/jsx-runtime";
import { useApiData } from "@/lib/api/useApiData";
import { fetchAnnexInvoices } from "@/lib/api/addon";
import LoadingOverlay from "@/components/shared/LoadingOverlay";
import { useServerPagination } from "@/hooks/useServerPagination";
import { groupAnnexRows } from "./annexGrouping";

function fmtNum(n: number): string {
  return n.toLocaleString("de-DE", { maximumFractionDigits: 0 });
}

const BORDER_R = "border-r border-wb-gray-03";
const BORDER_B = "border-b border-wb-gray-03";
const BORDER_HEADER_R = "border-r border-wb-gray-04";
const BORDER_HEADER_B = "border-b border-wb-gray-04";

export default function BkbrTab({
  sid,
  period,
}: {
  sid: number | null;
  /** Declaration period label (e.g. "06/2026") — sourced from the detail API. */
  period: string;
}) {
  const { t } = useTranslation();

  const pg = useServerPagination();

  const { data, loading } = useApiData(
    () =>
      sid != null
        ? fetchAnnexInvoices(sid, {
            annex_type: "BKBR",
            io_dv: "O",
            page: pg.pageIndex,
            size: pg.pageSize,
          })
        : Promise.resolve(null),
    [sid, pg.page, pg.pageSize],
  );

  const rows = data?.rows ?? [];
  const { groups: displayGroups, groupTotals, grandTotal } = groupAnnexRows(data);

  const isEmpty = !loading && displayGroups.length === 0;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {loading && <LoadingOverlay />}

      {/* ── Horizontal scroller — the whole tab body keeps a 1366px floor,
           so title, table, pagination and totals pan together. ───────── */}
      <div className="custom-scrollbar-x min-h-0 flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex h-full min-w-[1366px] flex-col">
          {/* ── Vertically scrollable content ──────────────────────────── */}
          <div className="custom-scrollbar-y min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto flex min-h-full w-full max-w-480 flex-col px-6 pb-6">
              {/* Title */}
              <div className="pb-4 pt-6 text-center">
                <h2 className="text-wb-16 font-bold uppercase tracking-wide text-wb-dark">
                  {t("tax_filing.bkbr.title")}
                </h2>
                <p className="mt-0.5 text-wb-13 font-medium text-wb-ntrl-6">
                  {t("tax_filing.bkbr.tax_period", { period })}
                </p>
              </div>

              {/* ── Table ─────────────────────────────────────────────────────── */}
              <div className="border border-wb-gray-03">
                <table className="w-full table-fixed border-collapse">
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
                    <tr className="h-12 bg-wb-ntrl-3">
                      <th
                        className={`${BORDER_HEADER_B} ${BORDER_HEADER_R} whitespace-nowrap px-2.5 text-center text-wb-13 font-semibold text-wb-dark`}
                      >
                        {t("tax_filing.bkbr.col_no")}
                      </th>
                      {/* Combined Symbol Code + Sub-code column */}
                      <th
                        className={`${BORDER_HEADER_B} ${BORDER_HEADER_R} whitespace-nowrap px-2.5 text-center text-wb-13 font-semibold text-wb-dark`}
                      >
                        {t("tax_filing.bkbr.col_symbol")}
                      </th>
                      <th
                        className={`${BORDER_HEADER_B} ${BORDER_HEADER_R} whitespace-nowrap px-2.5 text-center text-wb-13 font-semibold text-wb-dark`}
                      >
                        {t("tax_filing.bkbr.col_date")}
                      </th>
                      <th
                        className={`${BORDER_HEADER_B} ${BORDER_HEADER_R} whitespace-nowrap px-2.5 text-left text-wb-13 font-semibold text-wb-dark`}
                      >
                        {t("tax_filing.bkbr.col_customer")}
                      </th>
                      <th
                        className={`${BORDER_HEADER_B} ${BORDER_HEADER_R} whitespace-nowrap px-2.5 text-center text-wb-13 font-semibold text-wb-dark`}
                      >
                        {t("tax_filing.bkbr.col_tax_code")}
                      </th>
                      <th
                        className={`${BORDER_HEADER_B} ${BORDER_HEADER_R} whitespace-nowrap px-2.5 text-right text-wb-13 font-semibold text-wb-dark`}
                      >
                        {t("tax_filing.bkbr.col_revenue")}
                      </th>
                      <th
                        className={`${BORDER_HEADER_B} ${BORDER_HEADER_R} whitespace-nowrap px-2.5 text-center text-wb-13 font-semibold text-wb-dark`}
                      >
                        {t("tax_filing.bkbr.col_tax_rate")}
                      </th>
                      <th
                        className={`${BORDER_HEADER_B} whitespace-nowrap px-2.5 text-right text-wb-13 font-semibold text-wb-dark`}
                      >
                        {t("tax_filing.bkbr.col_vat")}
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {isEmpty ? (
                      <tr>
                        <td
                          colSpan={8}
                          className="h-40 whitespace-nowrap px-3 text-center text-wb-13 font-medium text-wb-ntrl-6"
                        >
                          {t("tax_filing.no_data")}
                        </td>
                      </tr>
                    ) : (
                      displayGroups.map((group) => (
                        <Fragment key={`g-${group.order}`}>
                          {/* Group header — vat_rate_order group */}
                          <tr className="h-12 bg-wb-bg-sidebar">
                            <td
                              colSpan={8}
                              className={`${BORDER_B} whitespace-nowrap px-3 text-wb-13 font-semibold text-brand`}
                            >
                              {t("tax_filing.bkbr.group_header", {
                                order: group.order,
                                rate: group.vatRate,
                              })}
                            </td>
                          </tr>

                          {/* Data rows */}
                          {group.rows.map((row) => (
                            <tr
                              key={`${group.order}-${row.no}`}
                              className={`h-12 ${BORDER_B} hover:bg-black/[0.02]`}
                            >
                              <td
                                className={`${BORDER_R} whitespace-nowrap px-2.5 text-center text-wb-13 font-medium text-wb-ink`}
                              >
                                {row.no}
                              </td>
                              {/* Invoice symbol + no */}
                              <td
                                className={`${BORDER_R} px-2.5 py-1 text-center`}
                              >
                                <div className="flex flex-col gap-0.5">
                                  <span className="truncate text-wb-13 font-medium text-wb-ink">
                                    {row.invSymbol}
                                  </span>
                                  <span className="truncate text-wb-13 font-medium text-wb-ntrl-6">
                                    {row.invNo}
                                  </span>
                                </div>
                              </td>
                              <td
                                className={`${BORDER_R} whitespace-nowrap px-2.5 text-center text-wb-13 font-medium text-wb-ink`}
                              >
                                {row.invDt}
                              </td>
                              <td
                                className={`${BORDER_R} truncate px-2.5 text-wb-13 font-medium text-wb-ink`}
                              >
                                {row.trcoNm}
                              </td>
                              <td
                                className={`${BORDER_R} whitespace-nowrap px-2.5 text-center text-wb-13 font-medium text-wb-ink`}
                              >
                                {row.trcoTaxCode}
                              </td>
                              <td
                                className={`${BORDER_R} whitespace-nowrap px-2.5 text-right text-wb-13 font-medium text-wb-ink`}
                              >
                                {fmtNum(row.splyAmt)}
                              </td>
                              <td
                                className={`${BORDER_R} whitespace-nowrap px-2.5 text-center text-wb-13 font-medium text-wb-ink`}
                              >
                                {row.vatRate}
                              </td>
                              <td className="whitespace-nowrap px-2.5 text-right text-wb-13 font-medium text-wb-ink">
                                {fmtNum(row.vatAmt)}
                              </td>
                            </tr>
                          ))}

                          {/* Group subtotal — wire aggregate for the whole rate group */}
                          <tr className="h-12 bg-wb-bg-footer">
                            <td
                              colSpan={5}
                              className={`${BORDER_B} ${BORDER_R} whitespace-nowrap px-3 text-center text-wb-13 font-semibold text-wb-dark`}
                            >
                              {t("tax_filing.bkbr.total_group", {
                                group: group.vatRate,
                              })}
                            </td>
                            <td
                              className={`${BORDER_B} ${BORDER_R} whitespace-nowrap px-2.5 text-right text-wb-13 font-semibold text-wb-dark`}
                            >
                              {fmtNum(
                                groupTotals.get(group.vatRate)?.totalSplyAmt ??
                                  0,
                              )}
                            </td>
                            <td
                              className={`${BORDER_B} ${BORDER_R} whitespace-nowrap px-2.5 text-center text-wb-13 font-semibold text-wb-dark`}
                            >
                              —
                            </td>
                            <td
                              className={`${BORDER_B} whitespace-nowrap px-2.5 text-right text-wb-13 font-semibold text-wb-dark`}
                            >
                              {fmtNum(
                                groupTotals.get(group.vatRate)?.totalVatAmt ??
                                  0,
                              )}
                            </td>
                          </tr>
                        </Fragment>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-auto" />
            </div>
          </div>

          {/* ── Pagination (server-side) ──────────────────────────────────────── */}
          <Pagination
            page={pg.page}
            pageCount={Math.max(1, data?.totalPages ?? 1)}
            pageSize={pg.pageSize}
            totalLabel={`${rows.length} of ${data?.totalCount ?? 0}`}
            onPageChange={pg.setPage}
            onPageSizeChange={pg.setPageSize}
            className="mx-auto w-full max-w-480 shrink-0 px-6 pb-4"
          />

          {/* ── Total Output (Sales) — pinned below pagination ─────────────── */}
          <div className="mx-auto w-full max-w-480 shrink-0 px-6">
            <div className="border-t border-wb-gray-03 bg-brand-soft">
              <table className="w-full table-fixed border-collapse">
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
                      className={`${BORDER_R} whitespace-nowrap px-3 text-right text-wb-13 font-bold text-brand`}
                    >
                      {t("tax_filing.bkbr.total_output")}
                    </td>
                    <td
                      className={`${BORDER_R} whitespace-nowrap px-2.5 text-right text-wb-13 font-bold text-brand`}
                    >
                      {fmtNum(grandTotal?.totalSplyAmt ?? 0)}
                    </td>
                    <td
                      className={`${BORDER_R} whitespace-nowrap px-2.5 text-center text-wb-13 font-bold text-brand`}
                    >
                      —
                    </td>
                    <td className="whitespace-nowrap px-2.5 text-right text-wb-13 font-bold text-brand">
                      {fmtNum(grandTotal?.totalVatAmt ?? 0)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
