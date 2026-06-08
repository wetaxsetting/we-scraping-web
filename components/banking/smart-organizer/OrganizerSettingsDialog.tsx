"use client";

import { GripVertical, Pencil, Plus, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import FilterSelect from "@/components/shared/FilterSelect";
import SearchInput from "@/components/shared/SearchInput";
import { useDialog } from "@/components/shared/dialog";
import { useTranslation } from "@/lib/i18n";
import { ApiCallError } from "@/lib/api/banking";
import {
    createOrganizerRule,
    deleteOrganizerRule,
    fetchOrganizerRules,
    updateOrganizerRule,
    type ApiOrganizerRuleRow,
    type ApiOrganizerRuleSaveRequest,
} from "@/lib/api/smartOrganizer";
import { fetchChartOfAccounts } from "@/lib/api/chartOfAccounts";
import { fetchPurposeSettings } from "@/lib/api/purposeSettings";
import { fetchVasAccounts } from "@/lib/api/vasAccount";
import { fetchContacts } from "@/lib/api/contacts";
import { useApiData } from "@/lib/api/useApiData";

// Reuse the four shared inline pickers from Transaction History — same
// presentation contract, same option types, same RECENT behaviour. Per
// CLAUDE.md "Common Reusability Rule" we share before we fork: the
// dropdowns here MUST be identical to Transaction History's row pickers.
import ContactSelect from "@/components/banking/transaction-history/ContactSelect";
import PurposeSelect from "@/components/shared/PurposeSelect";
import ReportingAccountSelect from "@/components/shared/ReportingAccountSelect";
import VasAccountSelect from "@/components/banking/transaction-history/VasAccountSelect";
import { buildContactOptions } from "@/components/banking/transaction-history/contactOptions";
import { buildPurposeOptions } from "@/components/banking/transaction-history/purposeOptions";
import { buildReportingAccountOptions } from "@/components/banking/transaction-history/chartOfAccountsOptions";
import { buildVasAccountOptions } from "@/components/banking/transaction-history/vasAccountOptions";
import type {
    ContactOption,
    PurposeOption,
    ReportingAccountOption,
    VasAccountOption,
} from "@/components/banking/transaction-history/types";

type Props = {
    onClose: () => void;
    /** Fires after any create / update / delete / reorder so the
     *  parent page can re-fetch its eligibility list. */
    onChanged: () => void;
};

/**
 * Editable row state — what the table renders per-row in edit mode.
 * The `rmrkSeqNo` is null for newly-added unsaved rows (the server
 * allocates one on save via the V161 `wb_get_next_val` branch).
 */
type EditRow = {
    rmrkSeqNo: number | null;
    rmrk: string;
    matchType: "C" | "E";
    rcvPayDv: "RCV" | "PAY";
    chartAcctCd: string;
    useUsagCd: string;
    vasAcctSeqNo: string;
    trcoKey: string;
    /** `true` when the row was just added in the current edit session
     *  and exists only client-side. Save will POST these as new rules. */
    isNew: boolean;
    /** `true` when the user removed the row in edit mode. Save will
     *  DELETE these. Carried separately so reorder math keeps working
     *  with the live position list. */
    isDeleted: boolean;
};

/**
 * Organizer Settings popup — refactor port of legacy `fnsh_0200_002`.
 * Visual match for the screenshot:
 *
 *   ┌───────────────────────────────────────────────────────┬─[⧉][×]┐
 *   │ Organizer Settings                                              │
 *   ├─────────────────────────────────────────────────────────────────┤
 *   │ ※ Automatically set Reporting Account, …  [🔍 Search]  [✎ Edit]│
 *   │ ┌──┬───┬─────────────┬────────┬──────────────┬──────────────┐  │
 *   │ │  │No.│ Remarks     │ Type   │ Reporting…   │ Purpose       │  │
 *   │ │⠿ │ 1 │ Shinhan     │Contains│ ACC-01 …  ▾ │ 131100 AR …  │  │
 *   │ │⠿ │ 2 │ 2335        │Contains│ 1007002 …  ▾│ 555 Other …  │  │
 *   │ └──┴───┴─────────────┴────────┴──────────────┴──────────────┘  │
 *   │ ┌─────────────────── + Add ──────────────────────────────────┐ │
 *   └─────────────────────────────────────────────────────────────────┘
 */
export default function OrganizerSettingsDialog({ onClose, onChanged }: Props) {
    const { t } = useTranslation();
    const dialog = useDialog();
    const [serverRules, setServerRules] = useState<ApiOrganizerRuleRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [editing, setEditing] = useState(false);
    const [search, setSearch] = useState("");
    /** Working copy of the rules in edit mode — supports add / delete /
     *  field edits before the user commits via Save. */
    const [draft, setDraft] = useState<EditRow[]>([]);
    const [submitting, setSubmitting] = useState(false);

    const refresh = async () => {
        setLoading(true);
        try {
            const res = await fetchOrganizerRules();
            setServerRules(res.rows ?? []);
        } catch (err) {
            // Degrade silently when the endpoint isn't reachable
            // (backend may still be wiring up). The list stays empty.
            if (!(err instanceof ApiCallError)) throw err;
            setServerRules([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refresh();
    }, []);

    // ---- Picker option lists ------------------------------------------
    // Identical loading pattern to Transaction History — every page that
    // uses the four shared pickers loads its option lists once on mount
    // via useApiData. The popover renders empty rows on error so users
    // can still see the chrome while the backend warms up.
    const chartState = useApiData(
        () => fetchChartOfAccounts({ sortField: "CHART_ACCT_CD", sortDir: "ASC" }),
        [],
    );
    const reportingAccountOptions: ReportingAccountOption[] = useMemo(() => {
        const rows = chartState.data?.items ?? [];
        return buildReportingAccountOptions(rows);
    }, [chartState.data]);

    const purposeState = useApiData(() => fetchPurposeSettings(), []);
    const purposeOptions: PurposeOption[] = useMemo(() => {
        const rows = purposeState.data?.list ?? [];
        return buildPurposeOptions(rows);
    }, [purposeState.data]);

    const vasState = useApiData(() => fetchVasAccounts({ statuses: ["A"] }), []);
    const vasAccountOptions: VasAccountOption[] = useMemo(() => {
        const rows = vasState.data?.list ?? [];
        return buildVasAccountOptions(rows);
    }, [vasState.data]);

    const contactState = useApiData(
        () => fetchContacts({ sortField: "HAND_TRCO_KEY", sortDirection: "ASC" }),
        [],
    );
    const contactOptions: ContactOption[] = useMemo(() => {
        const rows = contactState.data?.rows ?? [];
        return buildContactOptions(rows);
    }, [contactState.data]);

    // Resolve a saved code → option for the cell to render the assigned
    // display value. Picker selection still commits via the option's PK
    // (chartAcctSeqNo / useUsagCd / vasAcctCd / trcoKey).
    const findReportingByCode = (code: string): ReportingAccountOption | null =>
        reportingAccountOptions.find((o) => o.code === code) ?? null;
    const findPurposeByUsagCd = (cd: string): PurposeOption | null =>
        purposeOptions.find((o) => o.useUsagCd === cd) ?? null;
    const findVasByCd = (cd: string): VasAccountOption | null =>
        vasAccountOptions.find((o) => o.vasAcctCd === cd) ?? null;
    const findContactByKey = (key: string): ContactOption | null =>
        contactOptions.find((o) => o.trcoKey === key) ?? null;

    // View-mode cell labels — resolve a saved code to its "code + name"
    // display string using the SAME option lists the edit-mode pickers
    // consume, so each cell reads identically before and after Edit.
    // This mirrors legacy `RMRK_ORG_INFM_R002` (fnsh_0200_002_r001), whose
    // DISP_* columns return `CODE || ' ' || NAME` for all four fields:
    //   • Reporting Account → wb_get_chart_acct_nm(...)        → "1007009 - Collection 4"
    //   • Purpose           → HAND_USE_USAG_CD || ' ' || USAG_NM
    //   • VAS Account       → VAS_ACCT_CD     || ' ' || VAS_ACCT_NM
    //   • Contact Name      → HAND_TRCO_KEY   || ' ' || TRCO_CMNM
    // Each formatter mirrors its picker's trigger format (dash for
    // reporting/VAS/contact, space for purpose per `<PurposeSelect>`) so
    // the separator doesn't shift when the user toggles Edit. Falls back
    // to the raw code while the option lists are still loading so the
    // cell never blanks out.
    const reportingLabel = (code: string | null): string => {
        if (!code) return "—";
        const opt = findReportingByCode(code);
        return opt ? `${opt.code} - ${opt.name}` : code;
    };
    const purposeLabel = (cd: string | null): string => {
        if (!cd) return "—";
        const opt = findPurposeByUsagCd(cd);
        return opt ? `${opt.code} ${opt.name}` : cd;
    };
    const vasLabel = (seqNo: number | null): string => {
        if (seqNo == null) return "—";
        const opt = findVasByCd(String(seqNo));
        return opt ? `${opt.vasAcctCd} - ${opt.name}` : String(seqNo);
    };
    const contactLabel = (key: string | null): string => {
        if (!key) return "—";
        const opt = findContactByKey(key);
        return opt ? `${opt.handTrcoKey} - ${opt.name}` : key;
    };

    /** Render rows — comes from server in view mode, from draft in edit mode.
     *  Filter by search text in view mode. */
    const visibleRows = useMemo(() => {
        if (editing) {
            return draft.filter((r) => !r.isDeleted);
        }
        const term = search.trim().toLowerCase();
        if (!term) return serverRules;
        return serverRules.filter((r) =>
            (r.rmrk ?? "").toLowerCase().includes(term),
        );
    }, [editing, draft, serverRules, search]);

    const enterEditMode = () => {
        setDraft(
            serverRules.map((r) => ({
                rmrkSeqNo: r.rmrk_seq_no,
                rmrk: r.rmrk,
                matchType: r.match_type,
                rcvPayDv: r.rcv_pay_dv ?? "RCV",
                chartAcctCd: r.chart_acct_cd ?? "",
                useUsagCd: r.use_usag_cd ?? "",
                vasAcctSeqNo: r.vas_acct_seq_no?.toString() ?? "",
                trcoKey: r.trco_key ?? "",
                isNew: false,
                isDeleted: false,
            })),
        );
        setEditing(true);
    };

    const cancelEdit = () => {
        setEditing(false);
        setDraft([]);
    };

    const showError = (err: unknown) => {
        const code = err instanceof ApiCallError ? err.code : "UNKNOWN";
        const message = err instanceof ApiCallError ? err.message : String(err);
        dialog.open({
            type: "error",
            title: t("dialog.error"),
            description: message,
            errorCode: code,
        });
    };

    const updateDraftRow = (idx: number, patch: Partial<EditRow>) => {
        setDraft((d) => d.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
    };

    const addRow = () => {
        if (!editing) {
            // First add — flip to edit mode and seed draft if empty.
            if (draft.length === 0) {
                setDraft(
                    serverRules.map((r) => ({
                        rmrkSeqNo: r.rmrk_seq_no,
                        rmrk: r.rmrk,
                        matchType: r.match_type,
                        rcvPayDv: r.rcv_pay_dv ?? "RCV",
                        chartAcctCd: r.chart_acct_cd ?? "",
                        useUsagCd: r.use_usag_cd ?? "",
                        vasAcctSeqNo: r.vas_acct_seq_no?.toString() ?? "",
                        trcoKey: r.trco_key ?? "",
                        isNew: false,
                        isDeleted: false,
                    })),
                );
            }
            setEditing(true);
        }
        setDraft((d) => [
            ...d,
            {
                rmrkSeqNo: null,
                rmrk: "",
                matchType: "C",
                rcvPayDv: "RCV",
                chartAcctCd: "",
                useUsagCd: "",
                vasAcctSeqNo: "",
                trcoKey: "",
                isNew: true,
                isDeleted: false,
            },
        ]);
    };

    const deleteRow = (idx: number) => {
        setDraft((d) =>
            d.map((r, i) => (i === idx ? { ...r, isDeleted: true } : r)),
        );
    };

    const handleSave = async () => {
        // Validate
        const liveRows = draft.filter((r) => !r.isDeleted);
        for (const r of liveRows) {
            if (!r.rmrk.trim()) {
                dialog.open({
                    type: "warning",
                    title: t("dialog.warning"),
                    description: t("organizer_settings.remark_required"),
                });
                return;
            }
        }
        setSubmitting(true);
        try {
            // 1) Deletes
            for (const r of draft) {
                if (r.isDeleted && r.rmrkSeqNo != null) {
                    await deleteOrganizerRule(r.rmrkSeqNo);
                }
            }
            // 2) Creates + updates with the live disp_ord per position
            let dispOrd = 1;
            for (const r of liveRows) {
                const vasParsed = r.vasAcctSeqNo.trim()
                    ? Number(r.vasAcctSeqNo.trim())
                    : undefined;
                const body: ApiOrganizerRuleSaveRequest = {
                    rmrk: r.rmrk.trim(),
                    match_type: r.matchType,
                    rcv_pay_dv: r.rcvPayDv,
                    disp_ord: dispOrd++,
                    chart_acct_cd: r.chartAcctCd.trim() || undefined,
                    use_usag_cd: r.useUsagCd.trim() || undefined,
                    vas_acct_seq_no: Number.isFinite(vasParsed) ? vasParsed : undefined,
                    trco_key: r.trcoKey.trim() || undefined,
                };
                if (r.rmrkSeqNo == null) {
                    await createOrganizerRule(body);
                } else {
                    await updateOrganizerRule(r.rmrkSeqNo, body);
                }
            }
            await refresh();
            onChanged();
            setEditing(false);
            setDraft([]);
        } catch (err) {
            showError(err);
        } finally {
            setSubmitting(false);
        }
    };

    // ESC + body scroll lock
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        document.addEventListener("keydown", onKey);
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.removeEventListener("keydown", onKey);
            document.body.style.overflow = prev;
        };
    }, [onClose]);

    if (typeof document === "undefined") return null;

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
            <div className="flex max-h-[calc(100vh-96px)] w-[1140px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
                {/* Header */}
                <div className="flex shrink-0 items-center justify-between border-b border-wb-table-border px-6 py-4">
                    <h2 className="text-wb-18 font-semibold tracking-wb-tight text-wb-dark">
                        {t("organizer_settings.title")}
                    </h2>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            aria-label={t("dialog.close")}
                            className="flex size-7 cursor-pointer items-center justify-center rounded-md hover:bg-black/5"
                        >
                            <X className="size-4 text-wb-ink" />
                        </button>
                    </div>
                </div>

                {/* Subheader: description + search + edit button (edit button
                    stays disabled in edit mode; Save/Cancel land in footer) */}
                <div className="flex shrink-0 items-start justify-between gap-4 px-6 py-4">
                    <p className="max-w-[640px] flex-1 text-wb-13 font-normal text-wb-muted">
                        ※ {t("organizer_settings.description")}
                    </p>
                    <div className="flex items-center gap-2">
                        <SearchInput
                            value={search}
                            onChange={setSearch}
                            placeholder={t("common.search")}
                        />
                        <button
                            type="button"
                            onClick={enterEditMode}
                            disabled={editing || serverRules.length === 0}
                            className="flex h-8 cursor-pointer items-center gap-1.5 rounded-md bg-white px-3 text-wb-14-tight font-medium text-wb-ink shadow-wb-btn hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <Pencil className="size-4" strokeWidth={1.8} />
                            <span>{t("organizer_settings.edit")}</span>
                        </button>
                    </div>
                </div>

                {/* Table */}
                {/* min-h-[480px] gives the popup body a consistent tall
                   surface even when the rule list is empty or short —
                   matches the legacy fnsh_0200_002 layerPopup-contsBox
                   height (560 px shell minus 80 px header padding). */}
                <div className="custom-scrollbar mx-6 min-h-[480px] flex-1 overflow-auto rounded-md border border-wb-table-border bg-white">
                    {/* `table-fixed` + `min-w-[1905px]` forces the
                       <th> width tokens to be honoured even when the
                       popup shell (1140 px) is narrower than the table.
                       The wrapper above is the horizontal-scroll surface. */}
                    <table className="min-w-[1905px] table-fixed border-collapse">
                        <thead className="sticky top-0 z-10 bg-wb-bg-sidebar">
                            {/* Column widths — verbatim from legacy
                               fnsh_0200_002_view.jsp:269-279 <colgroup>.
                               Total min-width = 1700 px (1750 minus the
                               action column not present in view mode).
                               The popup container is 1100 px so the table
                               scrolls horizontally inside its custom-scrollbar
                               wrapper — same behaviour as the legacy 1140 px
                               shell. */}
                            {/* Column widths — applied per request 2026-05-17:
                               Remarks 600 px, Type 140 px, Reporting Account /
                               Purpose 210 px each, VAS Account 260 px, Contact
                               Name 320 px (each bumped +10 px from the legacy
                               <colgroup>). Drag handle + No. stay at 40 / 45
                               per legacy fnsh_0200_002_view.jsp:270-279. */}
                            <tr className="h-[var(--h-wb-table-head)] border-b border-wb-table-border">
                                <th className="w-[40px] px-2.5 py-2" />
                                <th className="w-[45px] px-2.5 py-2 text-left text-wb-13 font-semibold text-wb-dark">
                                    {t("organizer_settings.col.no")}
                                </th>
                                <th className="w-[570px] px-2.5 py-2 text-left text-wb-13 font-semibold text-wb-dark">
                                    {t("organizer_settings.col.remark")}
                                </th>
                                <th className="w-[140px] px-2.5 py-2 text-left text-wb-13 font-semibold text-wb-dark">
                                    {t("organizer_settings.col.match_type")}
                                </th>
                                <th className="w-[210px] px-2.5 py-2 text-left text-wb-13 font-semibold text-wb-dark">
                                    {t("organizer_settings.col.reporting_account")}
                                </th>
                                <th className="w-[210px] px-2.5 py-2 text-left text-wb-13 font-semibold text-wb-dark">
                                    {t("organizer_settings.col.purpose")}
                                </th>
                                <th className="w-[260px] px-2.5 py-2 text-left text-wb-13 font-semibold text-wb-dark">
                                    {t("organizer_settings.col.vas_account")}
                                </th>
                                <th className="w-[320px] px-2.5 py-2 text-left text-wb-13 font-semibold text-wb-dark">
                                    {t("organizer_settings.col.contact_name")}
                                </th>
                                {/* Actions column rendered ONLY in edit mode
                                   (↑ ↓ 🗑 group). Matches legacy fnsh_0200_002 —
                                   view mode shows no per-row actions; delete is
                                   only available after the user clicks Edit. */}
                                {editing && (
                                    <th className="w-[110px] px-2.5 py-2 text-center text-wb-13 font-semibold text-wb-dark">
                                        {t("organizer_settings.col.actions")}
                                    </th>
                                )}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={editing ? 9 : 8} className="px-2.5 py-6 text-center text-wb-13 text-wb-muted">
                                    {t("common.loading")}
                                </td></tr>
                            ) : visibleRows.length === 0 ? (
                                <tr>
                                    <td colSpan={editing ? 9 : 8} className="px-2.5 py-16 text-center align-middle">
                                        <div className="flex flex-col items-center justify-center gap-1 text-wb-13 text-wb-muted">
                                            <p>{t("organizer_settings.empty_line_1")}</p>
                                            <p>{t("organizer_settings.empty_line_2")}</p>
                                            <button
                                                type="button"
                                                onClick={addRow}
                                                className="mt-2 cursor-pointer text-wb-13 font-medium text-brand hover:underline"
                                            >
                                                + {t("organizer_settings.empty_cta")}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ) : editing ? (
                                (visibleRows as EditRow[]).map((row, visibleIdx) => {
                                    const fullIdx = draft.indexOf(row);
                                    return (
                                        <tr key={fullIdx} className="border-b border-wb-table-border last:border-b-0">
                                            <td className="px-2.5 py-2 align-middle text-center">
                                                <span className="cursor-grab text-wb-muted" title={t("organizer_settings.drag_handle")}>
                                                    <GripVertical className="inline size-4" />
                                                </span>
                                            </td>
                                            <td className="px-2.5 py-2 align-middle text-wb-13 font-medium text-wb-ink">
                                                {visibleIdx + 1}
                                            </td>
                                            <td className="px-2.5 py-2 align-middle">
                                                <input
                                                    type="text"
                                                    value={row.rmrk}
                                                    onChange={(e) => updateDraftRow(fullIdx, { rmrk: e.target.value })}
                                                    placeholder={t("organizer_settings.remark_placeholder")}
                                                    maxLength={500}
                                                    className="h-8 w-full rounded-md border border-wb-ntrl-4 bg-white px-2 text-wb-13 font-medium text-wb-ink outline-none placeholder:text-wb-ntrl-6 focus:border-brand"
                                                />
                                            </td>
                                            <td className="px-2.5 py-2 align-middle">
                                                {/* R03 — match type + direction. Legacy derived
                                                   RCV/PAY from the Purpose's USAG_GRP_CD, but that
                                                   column is unpopulated in the refactor, so the
                                                   direction is chosen explicitly here — this is what
                                                   restores PAY-rule creation (see remediation R03). */}
                                                <div className="flex flex-col gap-1.5">
                                                    <FilterSelect<"C" | "E">
                                                        value={row.matchType}
                                                        onChange={(next) => updateDraftRow(fullIdx, { matchType: next })}
                                                        options={[
                                                            { value: "C", label: t("organizer_settings.match.contains") },
                                                            { value: "E", label: t("organizer_settings.match.exact") },
                                                        ]}
                                                        ariaLabel={t("organizer_settings.col.match_type")}
                                                        triggerClassName="w-full"
                                                        popoverClassName="w-full"
                                                        hideSelectedCheck
                                                    />
                                                    <FilterSelect<"RCV" | "PAY">
                                                        value={row.rcvPayDv}
                                                        onChange={(next) => updateDraftRow(fullIdx, { rcvPayDv: next })}
                                                        options={[
                                                            { value: "RCV", label: t("organizer_settings.direction.receive") },
                                                            { value: "PAY", label: t("organizer_settings.direction.pay") },
                                                        ]}
                                                        ariaLabel={t("organizer_settings.col.direction")}
                                                        triggerClassName="w-full"
                                                        popoverClassName="w-full"
                                                        hideSelectedCheck
                                                    />
                                                </div>
                                            </td>
                                            {/* The four inline pickers below are shared with
                                               Transaction History. Each commits its PK back to
                                               the draft row through `updateDraftRow`. */}
                                            <td className="px-2.5 py-2 align-middle">
                                                <ReportingAccountSelect
                                                    value={findReportingByCode(row.chartAcctCd)}
                                                    options={reportingAccountOptions}
                                                    onChange={(opt) => updateDraftRow(fullIdx, { chartAcctCd: opt.code })}
                                                    alwaysEditable
                                                    matchTriggerWidth
                                                />
                                            </td>
                                            <td className="px-2.5 py-2 align-middle">
                                                <PurposeSelect
                                                    value={findPurposeByUsagCd(row.useUsagCd)}
                                                    options={purposeOptions}
                                                    recentUseUsagCds={[]}
                                                    onChange={(opt) => updateDraftRow(fullIdx, { useUsagCd: opt.useUsagCd })}
                                                    onClear={() => updateDraftRow(fullIdx, { useUsagCd: "" })}
                                                    alwaysEditable
                                                    matchTriggerWidth
                                                />
                                            </td>
                                            <td className="px-2.5 py-2 align-middle">
                                                <VasAccountSelect
                                                    value={findVasByCd(row.vasAcctSeqNo)}
                                                    options={vasAccountOptions}
                                                    recentVasAcctCds={[]}
                                                    onChange={(opt) => updateDraftRow(fullIdx, { vasAcctSeqNo: opt.vasAcctCd })}
                                                    onClear={() => updateDraftRow(fullIdx, { vasAcctSeqNo: "" })}
                                                    alwaysEditable
                                                    matchTriggerWidth
                                                />
                                            </td>
                                            <td className="px-2.5 py-2 align-middle">
                                                <ContactSelect
                                                    value={findContactByKey(row.trcoKey)}
                                                    options={contactOptions}
                                                    recentTrcoKeys={[]}
                                                    onChange={(opt) => updateDraftRow(fullIdx, { trcoKey: opt.trcoKey })}
                                                    onClear={() => updateDraftRow(fullIdx, { trcoKey: "" })}
                                                    alwaysEditable
                                                    matchTriggerWidth
                                                />
                                            </td>
                                            <td className="px-2.5 py-2 align-middle text-center">
                                                <button
                                                    type="button"
                                                    onClick={() => deleteRow(fullIdx)}
                                                    className="inline-flex h-8 cursor-pointer items-center justify-center rounded-md border border-wb-ntrl-4 bg-white px-3 text-wb-13 font-medium text-wb-red-07 shadow-wb-btn hover:bg-black/[0.03]"
                                                >
                                                    {t("organizer_settings.delete")}
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                (visibleRows as ApiOrganizerRuleRow[]).map((row, idx) => (
                                    <tr key={row.rmrk_seq_no} className="border-b border-wb-table-border last:border-b-0">
                                        <td className="px-2.5 py-2 align-middle text-center">
                                            <span className="text-wb-muted">
                                                <GripVertical className="inline size-4" />
                                            </span>
                                        </td>
                                        <td className="px-2.5 py-2 align-middle text-wb-13 font-medium text-wb-ink">
                                            {idx + 1}
                                        </td>
                                        <td className="px-2.5 py-2 align-middle text-wb-13 font-medium text-wb-ink">
                                            {row.rmrk}
                                        </td>
                                        <td className="px-2.5 py-2 align-middle text-wb-13 font-medium text-wb-ink">
                                            {row.match_type === "E"
                                                ? t("organizer_settings.match.exact")
                                                : t("organizer_settings.match.contains")}
                                        </td>
                                        <td className="px-2.5 py-2 align-middle text-wb-13 font-medium text-wb-ink">
                                            {reportingLabel(row.chart_acct_cd)}
                                        </td>
                                        <td className="px-2.5 py-2 align-middle text-wb-13 font-medium text-wb-ink">
                                            {purposeLabel(row.use_usag_cd)}
                                        </td>
                                        <td className="px-2.5 py-2 align-middle text-wb-13 font-medium text-wb-ink">
                                            {vasLabel(row.vas_acct_seq_no)}
                                        </td>
                                        <td className="px-2.5 py-2 align-middle text-wb-13 font-medium text-wb-ink">
                                            {contactLabel(row.trco_key)}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Footer:
                     - view-mode → full-width "+ Add" button
                     - edit-mode → Cancel + Save buttons right-aligned */}
                <div className="shrink-0 border-t border-wb-table-border px-6 py-3">
                    {editing ? (
                        <div className="flex items-center justify-end gap-2">
                            <button
                                type="button"
                                onClick={cancelEdit}
                                disabled={submitting}
                                className="flex h-8 cursor-pointer items-center justify-center rounded-md bg-white px-3 text-wb-14-tight font-medium text-wb-ink shadow-wb-btn hover:bg-black/[0.03] disabled:opacity-50"
                            >
                                {t("dialog.cancel")}
                            </button>
                            <button
                                type="button"
                                onClick={handleSave}
                                disabled={submitting}
                                className="flex h-8 cursor-pointer items-center justify-center rounded-md bg-brand px-3 text-wb-14-tight font-medium text-white shadow-wb-brand-btn hover:bg-brand-hover disabled:opacity-50"
                            >
                                {t("organizer_settings.save_rule")}
                            </button>
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={addRow}
                            className="flex h-10 w-full cursor-pointer items-center justify-center gap-1.5 rounded-md border border-wb-ntrl-4 bg-white text-wb-14-tight font-medium text-wb-ink hover:bg-black/[0.02]"
                        >
                            <Plus className="size-4" strokeWidth={1.8} />
                            <span>{t("organizer_settings.add_rule")}</span>
                        </button>
                    )}
                </div>
            </div>
        </div>,
        document.body,
    );
}
