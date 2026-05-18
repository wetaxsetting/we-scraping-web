"use client";

import { useState } from "react";

import PaymentResultBatchListPage from "@/components/payment/shared/PaymentResultBatchListPage";
import type { PeriodKey } from "@/components/payment/shared/PaymentScheduledBatchListPage";
import {
    fetchOverseasResultList,
    type ApiOverseasResultRow,
} from "@/lib/api/payment";
import { useApiData } from "@/lib/api/useApiData";
import { useTranslation } from "@/lib/i18n";
import { formatRegDtmDisplay } from "@/lib/datetime";

import { type OverseasResultRow } from "./types";

function todayIso(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function offsetDaysIso(iso: string, days: number): string {
    const d = new Date(iso);
    d.setDate(d.getDate() + days);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function periodToFromDt(period: PeriodKey): string {
    const days = period === "7d" ? -7 : period === "30d" ? -30 : -90;
    return offsetDaysIso(todayIso(), days);
}

function formatApiDateTime(dtm: string) {
    if (!dtm || dtm.length < 14) return dtm;
    return formatRegDtmDisplay(dtm);
}

function mapApiRow(api: ApiOverseasResultRow): OverseasResultRow {
    return {
        id: api.ovrs_pymn_no,
        dateTime: formatApiDateTime(api.reg_dtm),
        fileName: api.file_nm || "-",
        txnCount: api.tot_trns_cnt,
        txnCurrency: api.ccy_cd,
        totalAmount: api.total_tran_amt.toString(),
        status: api.trnf_yn === "Y" ? "completed" : "in_progress",
        successCount: api.success_count || undefined,
        failedCount: api.failed_count || undefined,
        approvalRef: api.doc_no || "-",
        approvalTitle: api.titl || "-",
        fromBank: api.out_bank_nm || "-",
        fromAccount: api.wdrl_act_no || undefined,
        fromCurrency: api.ccy_cd,
        requestor: api.draft_user_nm || api.reg_id || "-",
    };
}

export default function OverseasPaymentResultPage() {
    const { t } = useTranslation();

    const [search, setSearch] = useState("");
    const [page, setPage] = useState(0);
    const [pageSize, setPageSize] = useState(10);
    const [period, setPeriod] = useState<PeriodKey>("30d");

    const fromDt = periodToFromDt(period);
    const toDt = todayIso();

    const { data } = useApiData(
        () =>
            fetchOverseasResultList({
                from_dt: fromDt.replace(/-/g, ""),
                to_dt: toDt.replace(/-/g, ""),
                keyword: search || undefined,
                page,
                size: pageSize,
            }),
        [fromDt, toDt, search, page, pageSize],
    );

    const displayRows = data?.rows ? data.rows.map(mapApiRow) : [];
    const displayTotals = data?.totals
        ? data.totals.map((tot) => ({ currency: tot.ccy_cd, amount: tot.total_tran_amt?.toString() ?? "0" }))
        : [];
    const totalCount = data?.total_count || 0;

    return (
        <PaymentResultBatchListPage<OverseasResultRow>
            title={t("payment.overseas.result_title")}
            rows={displayRows}
            rowDetailHref={(row) =>
                `/payment/overseas-payment/payment-result/${row.id}`
            }
            totals={displayTotals}
            search={search}
            onSearchChange={(v) => { setSearch(v); setPage(0); }}
            period={period}
            onPeriodChange={(p) => { setPeriod(p); setPage(0); }}
            pagination={{
                page,
                pageSize,
                totalCount,
                onPageChange: setPage,
                onPageSizeChange: (s) => { setPageSize(s); setPage(0); },
            }}
        />
    );
}
