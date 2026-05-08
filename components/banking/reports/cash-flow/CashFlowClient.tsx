"use client";

import { useMemo } from "react";

import CashFlowPage from "./CashFlowPage";
import { fetchCashFlow } from "@/lib/api/banking";
import { mapCashFlowReport } from "@/lib/api/mappers";
import { useApiData } from "@/lib/api/useApiData";

/**
 * Client wrapper that pulls live data from
 * `GET /api/v1/banking/reports/cash-flow`. The Sprint 1 backend ships a
 * deterministic seeded payload (the BCS batch port lands in Sprint 2/3).
 * The wrapper still wires the call so the contract is exercised end to end;
 * if the response is empty or shape-mismatched, the static mock seed
 * renders instead and nothing breaks.
 */
export default function CashFlowClient() {
    const { data } = useApiData(() => fetchCashFlow(), []);
    const report = useMemo(() => (data ? mapCashFlowReport(data) : undefined), [data]);
    return <CashFlowPage report={report} />;
}
