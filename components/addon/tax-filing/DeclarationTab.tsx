"use client";

import { ChevronDown } from "lucide-react";
import { forwardRef, useEffect, useImperativeHandle, useState } from "react";

import { useDialog } from "@/components/shared/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { saveDraftVatDeclaration } from "@/lib/api/addon";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { INDICATOR_SCHEMA } from "./indicatorSchema";
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

function num(v: string | null | undefined): number {
  const n = Number(v ?? 0);
  return isNaN(n) ? 0 : n;
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
  "ct33", // auto = 10% of ct32
  "ct34",
  "ct35",
  "ct36",
  "ct40a",
  "ct40",
  "ct41",
  "ct43",
]);

// ── Signatory / agent / address meta fields ───────────────────────────────────

type MetaVals = {
  signatoryNm: string;
  signingDt: string; // user-facing DD/MM/YYYY
  agentNm: string;
  agentCertNo: string;
  agentTaxId: string;
  province: string;
  district: string;
  ward: string;
};

function initMeta(): MetaVals {
  return {
    signatoryNm: "",
    signingDt: "",
    agentNm: "",
    agentCertNo: "",
    agentTaxId: "",
    province: "",
    district: "",
    ward: "",
  };
}

// Convert user-facing DD/MM/YYYY → wire YYYYMMDD; return null on bad input
function toWireDate(ddmmyyyy: string): string | null {
  const m = ddmmyyyy.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[3]}${m[2]}${m[1]}`;
}

export type DeclarationTabHandle = {
  saveDraft: () => Promise<void>;
  isDirty: () => boolean;
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
    const [meta, setMeta] = useState<MetaVals>(initMeta);
    // Bumping this key remounts inputs so defaultValue reflects new API data
    const [inputKey, setInputKey] = useState(0);
    const [saving, setSaving] = useState(false);
    const [dirty, setDirty] = useState(false);

    useEffect(() => {
      if (detail?.indicators) {
        setVals(initVals(detail.indicators));
        setInputKey((k) => k + 1);
        setDirty(false);
      }
    }, [detail?.indicators]);

    useImperativeHandle(ref, () => ({
      saveDraft: handleSaveDraft,
      isDirty: () => dirty,
    }));

    const update = (key: keyof EditableVals, n: number) => {
      setVals((prev) => ({ ...prev, [key]: n }));
      setDirty(true);
    };

    const updateMeta = (key: keyof MetaVals, value: string) => {
      setMeta((prev) => ({ ...prev, [key]: value }));
      setDirty(true);
    };

    async function handleSaveDraft() {
      if (!detail?.sid) return;

      // Validate: all editable ct fields must be >= 0
      const negField = Object.entries(vals).find(([, n]) => n < 0);
      if (negField) {
        dialog.open({
          type: "error",
          title: t("dialog.error"),
          description: t("tax_filing.form.error_negative"),
          errorCode: "WBE_VALIDATION",
        });
        return;
      }

      // Validate agent tax ID: 10 or 13 digits when non-empty
      const agentTaxId = meta.agentTaxId.trim() || null;
      if (agentTaxId && !/^\d{10}$|^\d{13}$/.test(agentTaxId)) {
        dialog.open({
          type: "error",
          title: t("dialog.error"),
          description: t("tax_filing.form.error_agent_tax_id"),
          errorCode: "WBE_VALIDATION",
        });
        return;
      }

      const str = (n: number) => String(Math.round(n));
      setSaving(true);
      try {
        await saveDraftVatDeclaration(detail.sid, {
          ct21: str(vals.ct21),
          ct23: str(vals.ct23),
          ct24: str(vals.ct24),
          ct26: str(vals.ct26),
          ct29: str(vals.ct29),
          ct30: str(vals.ct30),
          ct32: str(vals.ct32),
          ct32a: str(vals.ct32a),
          ct33a: "0",
          ct37: str(vals.ct37),
          ct38: str(vals.ct38),
          ct39a: str(vals.ct39a),
          ct40b: str(vals.ct40b),
          ct42: str(vals.ct42),
          signatory_nm: meta.signatoryNm.trim(),
          signing_dt: "",
          agent_nm: meta.agentNm.trim() || null,
          agent_cert_no: meta.agentCertNo.trim() || null,
          agent_tax_id: agentTaxId,
          province: meta.province.trim() || null,
          district: meta.district.trim() || null,
          ward: meta.ward.trim() || null,
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

    // Structural totals (computed in dependency order, recomputed on every render)
    const ct33 = Math.round(vals.ct32 * 0.1); // VAT on [32] = 10% of ct32
    const ct27 = vals.ct29 + vals.ct30 + vals.ct32 + vals.ct32a; // II.2 value total
    const ct28 = vals.ct31 + ct33; // II.2 VAT total
    const ct34 = vals.ct26 + ct27; // II.3 value = II.1 + II.2
    const ct35 = ct28; // II.3 VAT = II.2 VAT (II.1 is non-taxable)
    const ct36 = ct35 - vals.ct25; // III = deductible input VAT − output VAT
    // Shared intermediate: remaining VAT balance
    const base = ct36 - vals.ct22 + vals.ct37 - vals.ct38 - vals.ct39a;
    const ct40a = base >= 0 ? base : 0; // VI.1 = VAT payable (if balance ≥ 0)
    const ct40 = ct40a + vals.ct40b; // VI.3 = VI.1 + VI.2
    const ct41 = base < 0 ? -base : 0; // VI.4 = VAT credit/refund (if balance < 0)
    const ct43 = ct41 - vals.ct42; // VI.4.2 = VI.4 − VI.4.1

    const allVals: Record<string, number> = {
      ...vals,
      ct27,
      ct28,
      ct33,
      ct34,
      ct35,
      ct36,
      ct40a,
      ct40,
      ct41,
      ct43,
    };
    const getVal = (key?: string) => (key ? (allVals[key] ?? 0) : 0);

    return (
      <div className="custom-scrollbar-y flex-1 overflow-y-auto pb-6">
        <div className="mx-auto w-full max-w-[1920px] px-6">
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
                  <span className="mr-1 font-semibold text-brand">[02]</span>
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
                  <span className="mr-1 font-semibold text-brand">[03]</span>
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
                placeholder="Please Enter Tax Agent Name"
                className="flex-1"
                value={meta.agentNm}
                onChange={(v) => updateMeta("agentNm", v)}
              />
              <InputField
                code="[07]"
                label={t("tax_filing.form.field_07")}
                placeholder="Please Enter Tax Agent Tax Code"
                className="flex-1"
                value={meta.agentTaxId}
                onChange={(v) => updateMeta("agentTaxId", v)}
              />
              <InputField
                code="[08]"
                label={t("tax_filing.form.field_09_contract")}
                placeholder="Please Enter Tax Agent Contract Number"
                className="flex-1"
                value={meta.agentCertNo}
                onChange={(v) => updateMeta("agentCertNo", v)}
              />
              <InputField
                code=""
                label={t("tax_filing.form.field_10_contract")}
                placeholder="DD/MM/YYYY"
                className="flex-1"
              />
            </div>

            {/* [09] dependent unit + [10] dep. tax code */}
            <div className="flex gap-6">
              <InputField
                code="[09]"
                label={t("tax_filing.form.field_09_dep")}
                placeholder="Please Enter Name Of Dependent Unit In Another Province"
                className="flex-1"
              />
              <InputField
                code="[10]"
                label={t("tax_filing.form.field_10_dep")}
                placeholder="Please Enter Tax Code Of Dependent Unit"
                className="flex-1"
              />
            </div>

            {/* [11] address + [11C] province + [11B] district + [11A] ward */}
            <div className="flex gap-6">
              <InputField
                code="[11]"
                label={t("tax_filing.form.field_11")}
                placeholder="Dependent Unit Address"
                className="flex-1"
              />
              <InputField
                code="[11C]"
                label={t("tax_filing.form.field_12")}
                placeholder="Dependent Unit Province/ City"
                className="flex-1"
                value={meta.province}
                onChange={(v) => updateMeta("province", v)}
              />
              <InputField
                code="[11B]"
                label={t("tax_filing.form.field_13")}
                placeholder="Dependent Unit District"
                className="flex-1"
                value={meta.district}
                onChange={(v) => updateMeta("district", v)}
              />
              <InputField
                code="[11A]"
                label={t("tax_filing.form.field_09_ward")}
                placeholder="Dependent Unit Ward/ Commune"
                className="flex-1"
                value={meta.ward}
                onChange={(v) => updateMeta("ward", v)}
              />
            </div>
          </div>

          {/* ── Tax Indicators Table ────────────────────────────────────────── */}
          <div>
            <div className="overflow-x-auto border border-[#e5e7eb]">
              <table className="w-full min-w-[1232px] table-fixed border-collapse">
                <colgroup>
                  <col className="w-[55px]" />
                  <col />
                  <col className="w-[240px]" />
                  <col className="w-[240px]" />
                </colgroup>
                <thead>
                  <tr className="h-12 bg-wb-ntrl-3">
                    <th className="border-b border-r border-[#e5e7eb] px-3 text-center text-wb-21 font-semibold text-wb-dark">
                      {t("tax_filing.form.tax_indicators_no")}
                    </th>
                    <th className="border-b border-r border-[#e5e7eb] px-3 text-left text-wb-21 font-semibold text-wb-dark">
                      {t("tax_filing.form.tax_indicators_label")}
                    </th>
                    <th className="border-b border-r border-[#e5e7eb] px-3 text-center text-wb-21 font-semibold text-wb-dark">
                      {t("tax_filing.form.tax_indicators_value")}
                    </th>
                    <th className="border-b border-[#e5e7eb] px-3 text-center text-wb-21 font-semibold text-wb-dark">
                      {t("tax_filing.form.tax_indicators_vat")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {INDICATOR_SCHEMA.map((row, i) => {
                    const isC = i === 2;
                    const isBoldHeader =
                      !!row.isSectionHeader && row.no !== "A" && row.no !== "B";
                    const leftVal = getVal(row.ctLeft);
                    const rightVal = getVal(row.ctRight);
                    const leftComputed = row.ctLeft
                      ? COMPUTED.has(row.ctLeft)
                      : false;
                    const rightComputed = row.ctRight
                      ? COMPUTED.has(row.ctRight)
                      : false;

                    return (
                      <tr
                        key={i}
                        className={cn(
                          "border-b border-[#e5e7eb] last:border-b-0",
                          isC && "bg-wb-ntrl-3",
                          row.isSubHeader && "bg-[#F5F5F5]",
                          row.isLast && "bg-[#F0F7FF]",
                        )}
                      >
                        {/* No. */}
                        <td
                          className={cn(
                            "border-r border-[#e5e7eb] py-3 pl-2 pr-1 text-center text-wb-21 align-top",
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
                            "border-r border-[#e5e7eb] px-3 py-3 text-wb-21 leading-5",
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
                          className="border-r border-[#e5e7eb]"
                          onChange={
                            row.ctLeft && !leftComputed
                              ? (n) =>
                                  update(row.ctLeft as keyof EditableVals, n)
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
                                  update(row.ctRight as keyof EditableVals, n)
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
}: {
  initialValue: number;
  onChange: (n: number) => void;
  isBold?: boolean;
  isNegative?: boolean;
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
          <Checkbox className="shrink-0" />
        ) : isComputed ? (
          // Auto-calculated total — never editable, never shows "—"
          <span
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
