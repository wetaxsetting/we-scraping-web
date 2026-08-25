"use client";

import { ChevronDown } from "lucide-react";
import { forwardRef, useEffect, useImperativeHandle, useState } from "react";

import DateField from "@/components/shared/DateField";
import { useDialog } from "@/components/shared/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { saveDraftVatDeclaration } from "@/lib/api/addon";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { exportDeclarationExcel } from "./declarationExcel";
import { exportDeclarationPdf } from "./declarationPdf";
import { isValidAgentTaxCode } from "./agentTaxCode";
import { INDICATOR_SCHEMA } from "./indicatorSchema";
import { computeVatIndicators, propagateVatInput } from "@/lib/vat/vatFormula";
import type {
  ApiVatDeclarationDetail,
  ApiVatDeclarationIndicators,
} from "@/lib/types/api";

// Vietnamese number format: 172.800.000
function fmtNum(n: number): string {
  return n.toLocaleString("de-DE", { maximumFractionDigits: 0 });
}

// ── Editable fields (directly entered by user, never computed) ────────────────

type EditableVals = {
  ct21: number;
  ct22: number;
  ct23: number;
  ct23a: number;
  ct24: number;
  ct24a: number;
  ct25: number;
  ct26: number;
  ct29: number;
  ct30: number;
  ct31: number;
  ct32: number;
  ct32a: number;
  ct33: number;
  ct37: number;
  ct38: number;
  // V — refund application amount
  ct39a: number;
  // VI.2 — other adjustments
  ct40b: number;
  // VI.4.1 and sub-rows
  ct42: number;
  ct42a: number;
  ct42b: number;
};

/**
 * Wire indicator → form value.
 *
 * Money on form 01/GTGT is whole VND — `FunctionalSpec` §"Data-type notes" has
 * these columns as `BIGINT`. The API can still hand back a fractional
 * `BigDecimal` (e.g. `ct23: "11775938.71"` straight out of create/sync), and a
 * fractional cell is not filable: HTKK rejects it, and Save Draft would trip
 * the integer guard below on a value the user never typed.
 *
 * So truncate at the boundary. `trunc`, not `round`, so a tax figure is never
 * nudged upward into over-declaring. The underlying data still needs fixing on
 * the API side — see BE-6 in docs/testing/features/vat-declaration.md.
 */
function num(v: string | null | undefined): number {
  const n = Number(v ?? 0);
  return isNaN(n) ? 0 : Math.trunc(n);
}

function initVals(ind?: ApiVatDeclarationIndicators): EditableVals {
  return {
    ct21: num(ind?.ct21),
    ct22: num(ind?.ct22),
    ct23: num(ind?.ct23),
    ct23a: num(ind?.ct23a),
    ct24: num(ind?.ct24),
    ct24a: num(ind?.ct24a),
    ct25: num(ind?.ct25),
    ct26: num(ind?.ct26),
    ct29: num(ind?.ct29),
    ct30: num(ind?.ct30),
    ct31: num(ind?.ct31),
    ct32: num(ind?.ct32),
    ct32a: num(ind?.ct32a),
    ct33: num(ind?.ct33),
    ct37: num(ind?.ct37),
    ct38: num(ind?.ct38),
    ct39a: num(ind?.ct39a),
    ct40b: num(ind?.ct40b),
    ct42: num(ind?.ct42),
    ct42a: num(ind?.ct42a),
    ct42b: num(ind?.ct42b),
  };
}

// Fields computed from editable fields — non-editable, always recalculated
const COMPUTED = new Set([
  "ct27",
  "ct28",
  "ct34",
  "ct35",
  "ct36",
  "ct40a",
  "ct40",
  "ct41",
  "ct43",
]);

// [22] — VAT credit carried forward from the preceding period.
//
// The server assigns it on create (it equals [43] of the immediately preceding
// period), but it is an INPUT to the formula engine, not an output: the engine
// reads it (hieuSo = ct36 - ct22 + …) and never produces it. So it stays out of
// COMPUTED — that set means "output of computeVatIndicators", and blurring the
// two would mislead the next person who edits either.
//
// It was made read-only on 2026-08-20 and re-opened for input on request. Worth
// knowing when reading a filed figure: each period's [43] feeds the next
// period's [22], so a value typed here flows into every following period, and
// nothing warns at any step. Check VAT-UI-024 covers this path.

/** Does the declaration carry any of the OPTIONAL [06]–[11A] fields? */
function hasExtraInfo(m: MetaVals): boolean {
  return [
    m.agentNm, m.agentTaxCode, m.agentCtrNo, m.agentCtrDt,
    m.duNm, m.duTaxCode, m.duAddr, m.duProv, m.duDist, m.duWard,
  ].some((v) => v.trim() !== "");
}

/** Cell is read-only when it is a formula output. */
const isReadOnlyCell = (ct?: string) => !!ct && COMPUTED.has(ct);

// ── Tax-agent + dependent-unit meta fields (API #4 body, beyond the 22 cells) ─

type MetaVals = {
  // Tax agent — form fields [06] [07] [08] + contract date
  agentNm: string;
  agentTaxCode: string;
  agentCtrNo: string;
  agentCtrDt: string; // ISO YYYY-MM-DD — <DateField> emits this directly
  // Dependent unit in another province — form fields [09] … [11A]
  duNm: string;
  duTaxCode: string;
  duAddr: string;
  duProv: string;
  duDist: string;
  duWard: string;
};

/** Seed the agent / dependent-unit block from the detail response. */
function initMeta(detail?: ApiVatDeclarationDetail | null): MetaVals {
  return {
    agentNm: detail?.agent_nm ?? "",
    agentTaxCode: detail?.agent_tax_code ?? "",
    agentCtrNo: detail?.agent_ctr_no ?? "",
    agentCtrDt: detail?.agent_ctr_dt ?? "",
    duNm: detail?.du_nm ?? "",
    duTaxCode: detail?.du_tax_code ?? "",
    duAddr: detail?.du_addr ?? "",
    duProv: detail?.du_prov ?? "",
    duDist: detail?.du_dist ?? "",
    duWard: detail?.du_ward ?? "",
  };
}

/**
 * Blank input → the empty string, not `null`.
 *
 * The API ignores a `null` field on save: sending `agent_tax_code: null` answers
 * `WBI0000` while the stored value stays put, so clearing a tax-agent or
 * dependent-unit field silently did nothing. An empty string does clear it
 * (verified against the live API on 2026-08-04). Backend should honour `null`
 * too — see BE-9 in docs/testing/features/vat-declaration.md.
 */
function orNull(v: string): string {
  return v.trim();
}

export type DeclarationTabHandle = {
  saveDraft: () => Promise<void>;
  isDirty: () => boolean;
  /** Download the form as XLSX. Exports what is on screen, unsaved edits
   *  included, so it is built here where that state lives. */
  exportExcel: () => Promise<void>;
  /** Print the form as PDF. Same figures as the XLSX — unsaved edits included. */
  exportPdf: () => Promise<void>;
};

type Props = {
  detail?: ApiVatDeclarationDetail | null;
  onSaved?: () => void;
};

const DeclarationTab = forwardRef<DeclarationTabHandle, Props>(
  function DeclarationTab({ detail, onSaved }, ref) {
    const { t } = useTranslation();
    const dialog = useDialog();
    const [vals, setVals] = useState<EditableVals>(() =>
      initVals(detail?.indicators),
    );
    const [meta, setMeta] = useState<MetaVals>(() => initMeta(detail));
    // [04]–[11A] — taxpayer identity, tax agent and dependent unit. Collapsed
    // to keep the indicator table in view.
    //
    // The auto-open check looks at [06]–[11A] only: [04] / [05] are read-only
    // echoes of the taxpayer on file and are always populated, so counting them
    // would leave the section permanently open and the toggle pointless. Never
    // collapsed over data the user cannot see otherwise — a declaration that
    // arrives with any optional field filled opens the section, and so does a
    // validation error inside it.
    const [showExtra, setShowExtra] = useState(() => hasExtraInfo(initMeta(detail)));
    // Bumping this key remounts inputs so defaultValue reflects new API data
    const [inputKey, setInputKey] = useState(0);
    const [saving, setSaving] = useState(false);
    const [dirty, setDirty] = useState(false);

    // Re-seed the whole form whenever a fresh detail lands (open / save / reopen)
    // so both the indicator cells and the agent / dependent-unit block reflect
    // what the server holds instead of resetting to blanks.
    useEffect(() => {
      if (detail) {
        const nextMeta = initMeta(detail);
        setVals(initVals(detail.indicators));
        setMeta(nextMeta);
        if (hasExtraInfo(nextMeta)) setShowExtra(true);
        setInputKey((k) => k + 1);
        setDirty(false);
      }
    }, [detail]);

    const update = (key: keyof EditableVals, n: number) => {
      setVals((prev) => ({
        ...prev,
        [key]: n,
        ...propagateVatInput(key, n),
      }));
      setDirty(true);
    };

    const updateMeta = (key: keyof MetaVals, value: string) => {
      setMeta((prev) => ({ ...prev, [key]: value }));
      setDirty(true);
    };

    async function handleSaveDraft() {
      if (!detail?.sid) return;

      // BusinessRules §3: every indicator is a non-negative whole number of VND.
      // [21] is a flag, not an amount, so it sits outside the check. The two
      // failures get their own message naming the cell — "must be >= 0" sent
      // users hunting for a negative when the real problem was a decimal.
      const offender = Object.entries(vals).find(
        ([key, n]) => key !== "ct21" && (n < 0 || !Number.isInteger(n)),
      );
      if (offender) {
        const [key, n] = offender;
        const code = `[${key.replace("ct", "")}]`;
        dialog.open({
          type: "error",
          title: t("dialog.error"),
          description:
            n < 0
              ? t("tax_filing.form.error_negative_cell", { code })
              : t("tax_filing.form.error_not_integer_cell", { code }),
          errorCode: "WBE_VALIDATION",
        });
        return;
      }

      // BusinessRules §3 — 10 or 13 digits when supplied; blank means no agent.
      if (!isValidAgentTaxCode(meta.agentTaxCode)) {
        // [07] lives in the collapsible section — showing the error while the
        // field is hidden gives the user nothing to act on.
        setShowExtra(true);
        dialog.open({
          type: "error",
          title: t("dialog.error"),
          description: t("tax_filing.form.error_agent_tax_code"),
          errorCode: "WBE_VALIDATION",
        });
        return;
      }

      const str = (n: number) => String(Math.round(n));
      setSaving(true);
      try {
        // Exactly the 22 input cells of API #4. Pure formula cells ([27] [28]
        // [34] [35] [36] [40a] [40] [41] [43]) are recomputed server-side and
        // must not be sent. [25] / [31] / [33] are source cells — we send them
        // so the stored figure matches what the form shows.
        await saveDraftVatDeclaration(detail.sid, {
          ct21: vals.ct21 ? "1" : "0", // flag, not an amount
          ct22: str(vals.ct22),
          ct23: str(vals.ct23),
          ct24: str(vals.ct24),
          ct23a: str(vals.ct23a),
          ct24a: str(vals.ct24a),
          ct25: str(vals.ct25),
          ct26: str(vals.ct26),
          ct29: str(vals.ct29),
          ct30: str(vals.ct30),
          ct31: str(vals.ct31),
          ct32: str(vals.ct32),
          ct32a: str(vals.ct32a),
          ct33: str(vals.ct33), // seeded as floor([32] × 10%), then manual
          ct37: str(vals.ct37),
          ct38: str(vals.ct38),
          ct39a: str(vals.ct39a),
          ct40b: str(vals.ct40b),
          ct42: str(vals.ct42),
          ct42a: str(vals.ct42a),
          ct42b: str(vals.ct42b),
          // Tax agent
          agent_nm: orNull(meta.agentNm),
          agent_tax_code: orNull(meta.agentTaxCode),
          agent_ctr_no: orNull(meta.agentCtrNo),
          agent_ctr_dt: orNull(meta.agentCtrDt),
          // Dependent unit in another province
          du_nm: orNull(meta.duNm),
          du_tax_code: orNull(meta.duTaxCode),
          du_addr: orNull(meta.duAddr),
          du_prov: orNull(meta.duProv),
          du_dist: orNull(meta.duDist),
          du_ward: orNull(meta.duWard),
        });
        setDirty(false);
        dialog.open({
          type: "success",
          title: t("dialog.success"),
          description: t("tax_filing.form.save_draft_success"),
          onConfirm: onSaved,
        });
      } catch (err: unknown) {
        const e = err as { code?: string; message?: string };
        dialog.open({
          type: "error",
          title: t("dialog.error"),
          description: e?.message ?? t("common.error_unexpected"),
          errorCode: e?.code ?? "WBE9999",
        });
      } finally {
        setSaving(false);
      }
    }

    // Every computed cell comes from the shared engine so the form, the save
    // payload and the Excel export can never disagree.
    const { ct27, ct28, ct34, ct35, ct36, ct40a, ct40, ct41, ct43 } =
      computeVatIndicators(vals);

    const allVals: Record<string, number> = {
      ...vals,
      ct27,
      ct28,
      ct34,
      ct35,
      ct36,
      ct40a,
      ct40,
      ct41,
      ct43,
    };
    const getVal = (key?: string) => (key ? (allVals[key] ?? 0) : 0);

    // Declared after `allVals` so it exports the same figures the table renders.
    async function handleExportExcel() {
      if (!detail) return;
      try {
        await exportDeclarationExcel({ detail, values: allVals, meta });
      } catch (err: unknown) {
        // Template fetch / ZIP failure — surface it rather than failing silently.
        dialog.open({
          type: "error",
          title: t("dialog.error"),
          description: (err as Error)?.message ?? t("common.error_unknown"),
          errorCode: "WBE9999",
        });
      }
    }

    /** Same inputs *and* the same patched sheet as the XLSX export, so the two
     *  downloads cannot disagree — see declarationPdf.ts. */
    async function handleExportPdf() {
      if (!detail) return;
      try {
        await exportDeclarationPdf({ detail, values: allVals, meta });
      } catch (err: unknown) {
        dialog.open({
          type: "error",
          title: t("dialog.error"),
          description: (err as Error)?.message ?? t("common.error_unknown"),
          errorCode: "WBE9999",
        });
      }
    }

    // Declared after the handlers it exposes: referencing a hoisted function
    // before its declaration is what the immutability lint flags, and the fix is
    // ordering, not a comment explaining why it happens to work.
    useImperativeHandle(ref, () => ({
      saveDraft: handleSaveDraft,
      isDirty: () => dirty,
      exportExcel: handleExportExcel,
      exportPdf: handleExportPdf,
    }));

    return (
      // Horizontal scroller — the whole tab body keeps a 1366px floor, so the
      // title and the indicators table pan together instead of reflowing.
      <div className="custom-scrollbar-x min-h-0 flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex h-full min-w-[1366px] flex-col">
          <div className="custom-scrollbar-y min-h-0 flex-1 overflow-y-auto pb-6">
            <div className="mx-auto w-full max-w-480 px-6">
              {/* ── Title ──────────────────────────────────────────────────────── */}
              <div className="pb-5 pt-6 text-center">
                <h2 className="text-wb-24 font-bold uppercase tracking-wide text-wb-dark">
                  {t("tax_filing.form.title")}
                </h2>
                <p className="mt-1 text-wb-14 italic text-wb-ntrl-6">
                  {t("tax_filing.form.subtitle")}
                </p>
              </div>

              {/* ── Form fields ────────────────────────────────────────────────── */}
              <div className="space-y-9 pb-5">
                {/* [01a] industry + [01b] period */}
                <div className="flex gap-4">
                  <FormField
                    code="[01a]"
                    label={t("tax_filing.form.field_01a")}
                    required
                    className="flex-1"
                  >
                    <div className="relative flex h-12 items-center rounded-md bg-wb-bg-sidebar px-3 pr-8 shadow-wb-outline">
                      <span className="flex-1 text-wb-21 font-medium text-wb-ntrl-6">
                        {detail?.activity_name ?? "—"}
                      </span>
                      <ChevronDown className="absolute right-2.5 size-4 shrink-0 text-wb-ntrl-6" />
                    </div>
                  </FormField>
                  <FormField
                    code="[01b]"
                    label={t("tax_filing.form.field_01b")}
                    required
                    className="flex-1"
                  >
                    <div className="flex h-12 items-center rounded-md bg-wb-bg-sidebar px-3 shadow-wb-outline">
                      <span className="flex-1 text-wb-21 font-medium text-wb-ntrl-6">
                        {detail?.period_label ?? "—"}
                      </span>
                    </div>
                  </FormField>
                </div>

                {/* [02] first-time + [03] supplementary no */}
                <div className="flex gap-6">
                  <div className="flex flex-1 items-center gap-5">
                    <span className="shrink-0 text-wb-21 font-medium text-wb-ntrl-8">
                      <span className="mr-1 font-semibold text-brand">
                        [02]
                      </span>
                      {t("tax_filing.form.field_02")}
                    </span>
                    <div className="flex items-center gap-4">
                      {(["Yes", "No"] as const).map((opt) => (
                        <label
                          key={opt}
                          className="flex cursor-pointer items-center gap-1.5"
                        >
                          <input
                            type="radio"
                            name="firstTime"
                            defaultChecked={opt === "Yes"}
                            className="accent-brand"
                            disabled
                          />
                          <span className="text-wb-21 font-medium text-wb-ink">
                            {opt}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-1 items-center gap-3.5">
                    <span className="shrink-0 whitespace-nowrap text-wb-21 font-medium text-wb-ntrl-8">
                      <span className="mr-1 font-semibold text-brand">
                        [03]
                      </span>
                      {t("tax_filing.form.field_03")}
                    </span>
                    <input
                      disabled
                      defaultValue={detail?.suppl_no ?? 0}
                      type="text"
                      className="h-12 w-full rounded-md bg-wb-bg-sidebar px-3 text-wb-21 font-medium text-wb-ntrl-6 shadow-wb-outline outline-none"
                    />
                  </div>
                </div>

                {/* ── Additional Information — [04]–[11A] ──────────────────────
                    Collapses the taxpayer identity rows plus the optional
                    tax-agent and dependent-unit rows, so the indicator table
                    stays in view. The table is outside this block and never
                    collapses. */}
                <button
                  type="button"
                  data-testid="vat-additional-info-toggle"
                  aria-expanded={showExtra}
                  aria-controls="vat-additional-info"
                  onClick={() => setShowExtra((v) => !v)}
                  className={cn(
                    "inline-flex cursor-pointer items-center gap-1 text-wb-14",
                    "font-medium text-brand hover:text-brand-hover",
                  )}
                >
                  {t("tax_filing.form.additional_information")}
                  <ChevronDown
                    aria-hidden
                    className={cn(
                      "size-4 shrink-0 transition-transform",
                      showExtra && "rotate-180",
                    )}
                  />
                </button>

                {showExtra && (
                  <div id="vat-additional-info" className="space-y-9">
                    {/* [04] taxpayer name + [05] tax code */}
                    <div className="flex gap-6">
                      <FormField
                        code="[04]"
                        label={t("tax_filing.form.field_04")}
                        className="flex-1"
                      >
                        <div className="relative flex h-12 items-center rounded-md bg-wb-bg-sidebar px-3 pr-8 shadow-wb-outline">
                          <span className="flex-1 text-wb-21 font-medium text-wb-ntrl-6">
                            {detail?.tp_name ?? "—"}
                          </span>
                          <ChevronDown className="absolute right-2.5 size-4 shrink-0 text-wb-ntrl-6" />
                        </div>
                      </FormField>
                      <FormField
                        code="[05]"
                        label={t("tax_filing.form.field_05")}
                        className="flex-1"
                      >
                        <div className="relative flex h-12 items-center rounded-md bg-wb-bg-sidebar px-3 pr-8 shadow-wb-outline">
                          <span className="flex-1 text-wb-21 font-medium text-wb-ntrl-6">
                            {detail?.tp_tax_code ?? "—"}
                          </span>
                          <ChevronDown className="absolute right-2.5 size-4 shrink-0 text-wb-ntrl-6" />
                        </div>
                      </FormField>
                    </div>

                    {/* [06] agent name + [07] agent code + [08] contract no + date */}
                    <div className="flex gap-6">
                      <InputField
                        code="[06]"
                        label={t("tax_filing.form.field_06")}
                        placeholder={t("tax_filing.form.ph_agent_nm")}
                        className="flex-1"
                        value={meta.agentNm}
                        onChange={(v) => updateMeta("agentNm", v)}
                      />
                      <InputField
                        code="[07]"
                        label={t("tax_filing.form.field_07")}
                        placeholder={t("tax_filing.form.ph_agent_tax_code")}
                        className="flex-1"
                        value={meta.agentTaxCode}
                        onChange={(v) => updateMeta("agentTaxCode", v)}
                      />
                      <InputField
                        code="[08]"
                        label={t("tax_filing.form.field_09_contract")}
                        placeholder={t("tax_filing.form.ph_agent_ctr_no")}
                        className="flex-1"
                        value={meta.agentCtrNo}
                        onChange={(v) => updateMeta("agentCtrNo", v)}
                      />
                      {/* Contract date — shared single-date picker (§6b). It emits
                          ISO YYYY-MM-DD, which is exactly agent_ctr_dt's wire
                          format, so no conversion happens on save. */}
                      <FormField
                        code=""
                        label={t("tax_filing.form.field_10_contract")}
                        className="flex-1"
                      >
                        <DateField
                          value={meta.agentCtrDt}
                          onChange={(iso) => updateMeta("agentCtrDt", iso)}
                          placeholder="DD/MM/YYYY"
                          iconInside
                          portalled
                          className="h-12"
                        />
                      </FormField>
                    </div>

                    {/* [09] dependent unit + [10] dep. tax code */}
                    <div className="flex gap-6">
                      <InputField
                        code="[09]"
                        label={t("tax_filing.form.field_09_dep")}
                        placeholder={t("tax_filing.form.ph_du_nm")}
                        className="flex-1"
                        value={meta.duNm}
                        onChange={(v) => updateMeta("duNm", v)}
                      />
                      <InputField
                        code="[10]"
                        label={t("tax_filing.form.field_10_dep")}
                        placeholder={t("tax_filing.form.ph_du_tax_code")}
                        className="flex-1"
                        value={meta.duTaxCode}
                        onChange={(v) => updateMeta("duTaxCode", v)}
                      />
                    </div>

                    {/* [11] address + [11C] province + [11B] district + [11A] ward */}
                    <div className="flex gap-6">
                      <InputField
                        code="[11]"
                        label={t("tax_filing.form.field_11")}
                        placeholder={t("tax_filing.form.ph_du_addr")}
                        className="flex-1"
                        value={meta.duAddr}
                        onChange={(v) => updateMeta("duAddr", v)}
                      />
                      <InputField
                        code="[11C]"
                        label={t("tax_filing.form.field_12")}
                        placeholder={t("tax_filing.form.ph_du_prov")}
                        className="flex-1"
                        value={meta.duProv}
                        onChange={(v) => updateMeta("duProv", v)}
                      />
                      <InputField
                        code="[11B]"
                        label={t("tax_filing.form.field_13")}
                        placeholder={t("tax_filing.form.ph_du_dist")}
                        className="flex-1"
                        value={meta.duDist}
                        onChange={(v) => updateMeta("duDist", v)}
                      />
                      <InputField
                        code="[11A]"
                        label={t("tax_filing.form.field_09_ward")}
                        placeholder={t("tax_filing.form.ph_du_ward")}
                        className="flex-1"
                        value={meta.duWard}
                        onChange={(v) => updateMeta("duWard", v)}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* ── Tax Indicators Table ────────────────────────────────────────── */}
              <div>
                <div className="border border-wb-gray-03">
                  <table className="w-full table-fixed border-collapse">
                    <colgroup>
                      <col className="w-[55px]" />
                      <col />
                      <col className="w-[240px]" />
                      <col className="w-[240px]" />
                    </colgroup>
                    <thead>
                      <tr className="h-12 bg-wb-ntrl-3">
                        <th className="border-b border-r border-wb-gray-03 px-3 text-center text-wb-21 font-semibold text-wb-dark">
                          {t("tax_filing.form.tax_indicators_no")}
                        </th>
                        <th className="border-b border-r border-wb-gray-03 px-3 text-left text-wb-21 font-semibold text-wb-dark">
                          {t("tax_filing.form.tax_indicators_label")}
                        </th>
                        <th className="border-b border-r border-wb-gray-03 px-3 text-center text-wb-21 font-semibold text-wb-dark">
                          {t("tax_filing.form.tax_indicators_value")}
                        </th>
                        <th className="border-b border-wb-gray-03 px-3 text-center text-wb-21 font-semibold text-wb-dark">
                          {t("tax_filing.form.tax_indicators_vat")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {INDICATOR_SCHEMA.map((row, i) => {
                        const isC = i === 2;
                        const isBoldHeader =
                          !!row.isSectionHeader &&
                          row.no !== "A" &&
                          row.no !== "B";
                        const leftVal = getVal(row.ctLeft);
                        const rightVal = getVal(row.ctRight);
                        const leftComputed = isReadOnlyCell(row.ctLeft);
                        const rightComputed = isReadOnlyCell(row.ctRight);

                        return (
                          <tr
                            key={i}
                            className={cn(
                              "border-b border-wb-gray-03 last:border-b-0",
                              isC && "bg-wb-ntrl-3",
                              row.isSubHeader && "bg-wb-bg-sidebar",
                              row.isLast && "bg-brand-soft",
                            )}
                          >
                            {/* No. */}
                            <td
                              className={cn(
                                "border-r border-wb-gray-03 py-3 pl-2 pr-1 text-center text-wb-21 align-top",
                                isBoldHeader
                                  ? "font-semibold text-wb-dark"
                                  : "font-medium text-wb-ink",
                              )}
                            >
                              {row.no}
                            </td>

                            {/* Label */}
                            <td
                              className={cn(
                                "border-r border-wb-gray-03 px-3 py-3 text-wb-21 leading-5",
                                isBoldHeader
                                  ? "font-semibold text-wb-dark"
                                  : row.bold
                                    ? "font-semibold text-wb-ink"
                                    : "font-medium text-wb-ink",
                                row.italic && "italic text-wb-ntrl-6",
                                row.indent === 1 && "pl-6",
                                row.indent === 2 && "pl-10",
                                row.indent === 3 && "pl-14",
                              )}
                            >
                              {t(row.labelKey)}
                            </td>

                            {/* G&S value column */}
                            <ValueTd
                              inputKey={inputKey}
                              fieldId={row.ctLeft?.replace("ct", "")}
                              value={leftVal}
                              isComputed={leftComputed}
                              isTotal={row.isTotal}
                              bold={row.bold}
                              isEmptyLeft={row.isEmptyLeft}
                              className="border-r border-wb-gray-03"
                              onChange={
                                row.ctLeft && !leftComputed
                                  ? (n) =>
                                      update(
                                        row.ctLeft as keyof EditableVals,
                                        n,
                                      )
                                  : undefined
                              }
                            />

                            {/* VAT column */}
                            <ValueTd
                              inputKey={inputKey}
                              fieldId={row.ctRight?.replace("ct", "")}
                              value={rightVal}
                              isComputed={rightComputed}
                              isTotal={row.isTotal}
                              bold={row.bold}
                              isEmptyRight={row.isEmptyRight}
                              isCheckbox={row.hasCheckbox}
                              onChange={
                                row.ctRight && !rightComputed
                                  ? (n) =>
                                      update(
                                        row.ctRight as keyof EditableVals,
                                        n,
                                      )
                                  : undefined
                              }
                            />
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex justify-end py-2">
                <p className="font-italic text-wb-14 font-medium text-wb-ntrl-5">
                  Currency unit: Vietnam Dong (VND)
                </p>
              </div>

              {/* ── Signatory section ─────────────────────────────────────────────── */}
            </div>
          </div>
        </div>
      </div>
    );
  },
);

export default DeclarationTab;

// ─── Currency input — formats to 1.000.000 on every keystroke ────────────────

function CurrencyInput({
  initialValue,
  onChange,
  isBold,
  isNegative,
  testId,
}: {
  initialValue: number;
  onChange: (n: number) => void;
  isBold?: boolean;
  isNegative?: boolean;
  testId?: string;
}) {
  const [display, setDisplay] = useState(() => fmtNum(initialValue));

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    // Strip everything except digits and leading minus
    const raw = e.target.value.replace(/\./g, "").replace(/[^0-9\-]/g, "");
    if (raw === "" || raw === "-") {
      setDisplay(raw);
      onChange(0);
      return;
    }
    const n = parseInt(raw, 10);
    if (!isNaN(n)) {
      setDisplay(fmtNum(n));
      onChange(n);
    }
  }

  return (
    <input
      type="text"
      data-testid={testId}
      data-computed="false"
      inputMode="numeric"
      value={display}
      onChange={handleChange}
      className={cn(
        "h-7 max-w-36 flex-1 rounded bg-white px-2 text-right text-wb-21 outline-none",
        "shadow-wb-outline focus:shadow-[0px_0px_0px_1.5px_var(--color-brand)]",
        isBold ? "font-semibold text-wb-dark" : "font-medium text-wb-ink",
        isNegative && "text-destructive",
      )}
    />
  );
}

// ─── Value cell ───────────────────────────────────────────────────────────────

function ValueTd({
  inputKey,
  fieldId,
  value,
  isComputed,
  isTotal,
  bold,
  isCheckbox,
  isEmptyLeft,
  isEmptyRight,
  className,
  onChange,
}: {
  inputKey: number;
  fieldId?: string;
  value: number;
  isComputed?: boolean;
  isTotal?: boolean;
  bold?: boolean;
  isCheckbox?: boolean;
  isEmptyLeft?: boolean;
  isEmptyRight?: boolean;
  className?: string;
  onChange?: (n: number) => void;
}) {
  const isEmpty = isEmptyLeft || isEmptyRight;
  const hasField = !!fieldId;
  const isBold = bold || isTotal;

  if (isEmpty) {
    return (
      <td
        className={cn(
          "py-3 text-center align-middle text-wb-21 font-medium text-wb-ntrl-5",
          className,
        )}
      />
    );
  }

  if (!hasField && !isCheckbox) {
    return (
      <td
        className={cn(
          "py-3 text-center align-middle text-wb-21 font-medium text-wb-ntrl-5",
          className,
        )}
      >
        —
      </td>
    );
  }

  return (
    <td className={cn("align-middle", className)}>
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        {hasField && (
          <span className="shrink-0 whitespace-nowrap text-wb-14 font-bold text-wb-ntrl-5">
            [{fieldId}]
          </span>
        )}

        {isCheckbox ? (
          // [21] is a flag, not an amount — the wire takes "0" / "1".
          <Checkbox
            data-testid={fieldId ? `vat-cell-${fieldId}` : undefined}
            className="shrink-0"
            checked={value === 1}
            onCheckedChange={(checked) => onChange?.(checked ? 1 : 0)}
          />
        ) : isComputed ? (
          // Auto-calculated total — never editable, never shows "—"
          <span
            // Khoa doc cho phep kiem trinh duyet: doc so HIEN THI o day roi doi
            // chieu voi chinh gia tri API tra ve. Do la lop loi ma bo kiem goi
            // API khong the thay, vi no chua bao gio nhin man hinh.
            data-testid={fieldId ? `vat-cell-${fieldId}` : undefined}
            data-computed="true"
            className={cn(
              "h-7 max-w-36 flex-1 rounded px-2 text-right text-wb-21 font-semibold text-wb-dark outline-none",
            )}
          >
            {fmtNum(value)}
          </span>
        ) : (
          // Editable — remounts via key when API data arrives; formats on every keystroke
          <CurrencyInput
            key={inputKey}
            testId={fieldId ? `vat-cell-${fieldId}` : undefined}
            initialValue={value}
            onChange={onChange ?? (() => {})}
            isBold={isBold}
            isNegative={value < 0}
          />
        )}
      </div>
    </td>
  );
}

// ─── Form helpers ─────────────────────────────────────────────────────────────

function FormField({
  code,
  label,
  required,
  className,
  children,
}: {
  code: string;
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <span className="text-wb-21 font-medium text-wb-ntrl-8">
        <span className="mr-1 font-semibold text-brand">{code}</span>
        {label}
        {required && <span className="ml-0.5 text-wb-red-07">*</span>}
      </span>
      {children}
    </div>
  );
}

function InputField({
  code,
  label,
  placeholder,
  value,
  onChange,
  readOnly,
  required,
  className,
}: {
  code: string;
  label: string;
  placeholder?: string;
  value?: string;
  onChange?: (v: string) => void;
  readOnly?: boolean;
  required?: boolean;
  className?: string;
}) {
  return (
    <FormField
      code={code}
      label={label}
      required={required}
      className={className}
    >
      <input
        type="text"
        value={onChange ? (value ?? "") : undefined}
        defaultValue={onChange ? undefined : value}
        placeholder={placeholder}
        readOnly={readOnly}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        className={cn(
          "h-12 w-full rounded-md px-3 text-wb-21 font-medium text-wb-ink placeholder:text-wb-ntrl-5 shadow-[0px_0px_0px_1px_#d4d4d4] outline-none",
          readOnly
            ? "bg-wb-bg-sidebar"
            : "bg-white focus:shadow-[0px_0px_0px_1.5px_var(--color-brand)]",
        )}
      />
    </FormField>
  );
}
