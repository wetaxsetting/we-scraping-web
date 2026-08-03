"use client";

import { ChevronDown, FileText, RefreshCw, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { DeclarationTabHandle } from "./DeclarationTab";
import type { ApiVatDeclarationDetail } from "@/lib/types/api";

import { useDialog } from "@/components/shared/dialog";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  exportVatDeclarationPdf,
  exportVatDeclarationXml,
  fetchVatDeclarationDetail,
  lockVatDeclaration,
  syncVatDeclaration,
} from "@/lib/api/addon";
import { useApiData } from "@/lib/api/useApiData";
import { exportInvoiceListingExcel } from "./invoiceListingExcel";
import { exportPlReduce8Excel } from "./plReduce8Excel";
import BkbrTab from "./BkbrTab";
import BkmvTab from "./BkmvTab";
import DeclarationTab from "./DeclarationTab";
import PlReduce8Tab from "./PlReduce8Tab";

type Tab = "declaration" | "bkbr" | "bkmv" | "pl_cssx" | "pl_vt" | "pl_142";

/** Figma 153:59285 — format names only, no leading icons. */
const EXPORT_ITEMS = ["XML", "PDF", "Excel"] as const;

/**
 * Download-name fallback, mirroring the backend's own scheme:
 * `[MST13]-01_GTGT_TT80-[M06|Q2 + YYYY]`, with a `-L[RR]` supplement suffix on
 * XML. A 10-digit tax code is padded to 13 with trailing zeros per API #10.
 *
 * Only used when the response omits `Content-Disposition` — the server's name
 * always wins.
 */
function exportFileBase(detail?: ApiVatDeclarationDetail | null): string {
  const mst = (detail?.tp_tax_code ?? "").padEnd(13, "0");
  const value = detail?.period_value ?? 0;
  const period = detail
    ? `${detail.period_type}${detail.period_type === "M" ? String(value).padStart(2, "0") : value}${detail.decl_year}`
    : "";
  return `${mst}-01_GTGT_TT80-${period}`;
}

function ExportDropdown({
  sid,
  detail,
  activeTab,
  onExportDeclaration,
}: {
  sid: number | null;
  detail?: ApiVatDeclarationDetail | null;
  /** Excel exports whatever the tab currently on screen holds. */
  activeTab: Tab;
  /** Client-side XLSX of the Declaration form — no endpoint exists for it. */
  onExportDeclaration: () => void;
}) {
  const { t } = useTranslation();
  const dialog = useDialog();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  async function pick(format: (typeof EXPORT_ITEMS)[number]) {
    setOpen(false);

    if (format === "Excel") {
      // Every Excel export is written in the browser from the authority's own
      // template — no endpoint involved. The Declaration form is built inside
      // DeclarationTab (it owns the unsaved edits); the annex listings pull all
      // pages themselves.
      if (activeTab === "declaration") {
        onExportDeclaration();
        return;
      }
      if (sid == null || busy || !detail) return;

      setBusy(true);
      try {
        if (activeTab === "pl_142") {
          await exportPlReduce8Excel({
            sid,
            detail,
            agentNm: detail.agent_nm ?? "",
            agentTaxCode: detail.agent_tax_code ?? "",
          });
        } else if (activeTab === "bkbr" || activeTab === "bkmv") {
          await exportInvoiceListingExcel({
            kind: activeTab,
            sid,
            detail,
            agentNm: detail.agent_nm ?? "",
            agentTaxCode: detail.agent_tax_code ?? "",
          });
        } else {
          dialog.open({
            type: "warning",
            title: t("dialog.warning"),
            description: t("tax_filing.export.select_annex_tab"),
          });
        }
      } catch (err: unknown) {
        dialog.open({
          type: "error",
          title: t("dialog.error"),
          description:
            (err as { message?: string })?.message ?? t("common.error_unknown"),
          errorCode: "WBE9999",
        });
      } finally {
        setBusy(false);
      }
      return;
    }

    if (sid == null || busy) return;

    setBusy(true);
    try {
      const base = exportFileBase(detail);
      if (format === "XML") {
        // XML carries the supplement suffix -L[RR]; PDF does not.
        const lan = `L${String(detail?.suppl_no ?? 0).padStart(2, "0")}`;
        await exportVatDeclarationXml(sid, `${base}-${lan}.xml`);
      } else {
        await exportVatDeclarationPdf(sid, `${base}.pdf`);
      }
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      // Draft declarations cannot be printed — spell that out instead of
      // showing the raw server message.
      const description =
        e?.code === "WBE_VAT_DECL_NOT_LOCKED"
          ? t("tax_filing.export.not_locked")
          : (e?.message ?? t("common.error_unknown"));
      dialog.open({
        type: "error",
        title: t("dialog.error"),
        description,
        errorCode: e?.code ?? "WBE9999",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={busy}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-8 cursor-pointer items-center gap-1.5 rounded-md bg-white px-3 text-wb-13 font-medium text-wb-ink shadow-wb-btn hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-60"
      >
        <FileText className="size-4" />
        {t("tax_filing.form.export")}
        <ChevronDown
          className={cn("size-3.5 transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        // Panel: rounded-md (6px) + 4px padding + 2px item gap + the 3-stop
        // Figma shadow. Anchored above the button since it sits in the footer.
        <div
          role="menu"
          className="absolute bottom-full left-0 z-50 mb-1 flex min-w-[160px] flex-col gap-0.5 rounded-md bg-white p-1 shadow-[0px_1px_1px_rgba(0,0,0,0.1),0px_0px_2px_rgba(0,0,0,0.1),0px_6px_20px_rgba(0,0,0,0.1)]"
        >
          {EXPORT_ITEMS.map((label) => (
            <button
              key={label}
              type="button"
              role="menuitem"
              onClick={() => pick(label)}
              className="flex w-full cursor-pointer items-center overflow-hidden rounded p-2 text-left text-wb-13 font-medium leading-5 text-wb-ink text-ellipsis whitespace-nowrap hover:bg-wb-bg-sidebar"
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Mapping annex id → tab metadata. "declaration" tab is always shown first.
const ANNEX_TAB_MAP: Record<string, { id: Tab; labelKey: string }> = {
  bkbr: { id: "bkbr", labelKey: "tax_filing.form.tab_bkbr" },
  bkmv: { id: "bkmv", labelKey: "tax_filing.form.tab_bkmv" },
  pl_cssx: { id: "pl_cssx", labelKey: "tax_filing.form.tab_pl_cssx" },
  pl_vt: { id: "pl_vt", labelKey: "tax_filing.form.tab_pl_vt" },
  pl_142: { id: "pl_142", labelKey: "tax_filing.form.tab_pl_142" },
};

type Props = {
  open: boolean;
  onClose: () => void;
  checkedAnnexes: Set<string>;
  declId: number | null;
};

export default function VatDeclarationFormPage({
  open,
  onClose,
  checkedAnnexes,
  declId,
}: Props) {
  const { t } = useTranslation();
  const dialog = useDialog();
  const [tab, setTab] = useState<Tab>("declaration");
  const [saving, setSaving] = useState(false);
  const [locking, setLocking] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const declarationRef = useRef<DeclarationTabHandle>(null);
  // Bump when form opens so useApiData always refetches fresh data
  const [fetchKey, setFetchKey] = useState(0);
  const prevOpen = useRef(false);
  useEffect(() => {
    if (open && !prevOpen.current) {
      setTab("declaration");
      setFetchKey((k) => k + 1);
    }
    prevOpen.current = open;
  }, [open]);

  async function handleSaveDraft() {
    if (!declarationRef.current) return;
    setSaving(true);
    try {
      await declarationRef.current.saveDraft();
    } finally {
      setSaving(false);
    }
  }

  /** Re-derive the declaration from its source invoices (API #5). Draft only,
   *  and destructive to invoice-sourced figures, so it asks first. */
  function handleSync() {
    if (!declId || syncing) return;
    dialog.open({
      type: "confirmation",
      title: t("dialog.confirmation"),
      description: t("tax_filing.form.sync_confirm"),
      confirmText: t("dialog.continue"),
      cancelText: t("dialog.cancel"),
      onConfirm: async () => {
        setSyncing(true);
        try {
          // The response is the recalculated declaration — seed it straight
          // into the cache instead of following up with a GET.
          setDetail(await syncVatDeclaration(declId));
          dialog.open({
            type: "success",
            title: t("dialog.success"),
            description: t("tax_filing.form.sync_success"),
          });
        } catch (err: unknown) {
          const e = err as { code?: string; message?: string };
          dialog.open({
            type: "error",
            title: t("dialog.error"),
            description:
              e?.code === "WBE_VAT_DECL_LOCKED"
                ? t("tax_filing.form.sync_locked")
                : (e?.message ?? t("common.error_unknown")),
            errorCode: e?.code ?? "WBE9999",
          });
        } finally {
          setSyncing(false);
        }
      },
    });
  }

  async function handleLock() {
    if (!declId || !declarationRef.current) return;
    const dirty = declarationRef.current.isDirty();
    setLocking(true);
    try {
      if (dirty) {
        await declarationRef.current.saveDraft();
        // saveDraft shows its own error dialog on failure — bail if still dirty
        if (declarationRef.current.isDirty()) return;
      }
      await lockVatDeclaration(declId);
      dialog.open({
        type: "success",
        title: t("dialog.success"),
        description: t("tax_filing.lock_success"),
      });
      onClose();
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      // Backend blocks lock when the preceding period is still Draft /
      // not created — surface a localized message keyed on the code.
      const description =
        e?.code === "WBE_VAT_PREV_PERIOD_NOT_LOCKED"
          ? t("tax_filing.lock_prev_period_required")
          : (e?.message ?? t("common.error_unknown"));
      dialog.open({
        type: "error",
        title: t("dialog.error"),
        description,
        errorCode: e?.code ?? "WBE9999",
      });
    } finally {
      setLocking(false);
    }
  }

  const { data: detail, setData: setDetail } = useApiData(
    () => (declId != null ? fetchVatDeclarationDetail(declId) : Promise.resolve(null)),
    [declId, fetchKey],
  );

  if (!open) return null;

  // Which annexes to show comes from the declaration detail's `annex_*_yn`
  // flags ("Y" = tab present). `checkedAnnexes` is only the pre-load fallback
  // so the tab strip doesn't flicker between open and the detail landing.
  const annexFlags: Record<string, "Y" | "N" | undefined> = {
    bkbr: detail?.annex_bkbr_yn,
    bkmv: detail?.annex_bkmv_yn,
    pl_cssx: detail?.annex_alloc_yn,
    pl_vt: detail?.annex_alloc_tele_yn,
    pl_142: detail?.annex_reduce8_yn,
  };
  const showAnnex = (id: string) =>
    detail ? annexFlags[id] === "Y" : checkedAnnexes.has(id);

  // Annex tabs render the declaration's own period, not a hardcoded one.
  const periodLabel = detail?.period_label ?? "";

  // Always show "Declaration" first, then any enabled annexes in their fixed order.
  const ANNEX_ORDER = ["bkbr", "bkmv", "pl_cssx", "pl_vt", "pl_142"];
  const tabs: { id: Tab; label: string }[] = [
    { id: "declaration", label: t("tax_filing.form.tab_declaration") },
    ...ANNEX_ORDER.filter(showAnnex).map((id) => ({
      id: ANNEX_TAB_MAP[id].id,
      label: t(ANNEX_TAB_MAP[id].labelKey),
    })),
  ];

  // If the active tab was removed (user went back and unchecked it), reset to "declaration".
  const activeTab = tabs.some((t_) => t_.id === tab) ? tab : "declaration";
  // Sync only exists for Draft — the endpoint rejects locked declarations.
  const isDraft = (detail?.status ?? "DRAFT") === "DRAFT";

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-white">
      {/* Top bar */}
      <div className="flex shrink-0 items-center justify-between border-b border-wb-ntrl-4 bg-white px-6 py-3">
        <div className="flex items-center gap-3">
          <h1 className="text-wb-18 font-semibold tracking-wb-tight text-wb-dark">
            {t("tax_filing.form.page_title")}
          </h1>
          <span className="rounded bg-wb-ntrl-3 px-2 py-0.5 text-wb-13 font-medium text-wb-ntrl-8">
            {t("tax_filing.form.status_draft")}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex size-7 cursor-pointer items-center justify-center rounded-md text-wb-ntrl-6 hover:bg-black/5"
          >
            <X className="size-6" />
          </button>
        </div>
      </div>

      {/* Tab strip */}
      <div className="flex shrink-0 border-b border-wb-ntrl-4 bg-white px-6">
        {tabs.map((t_) => (
          <button
            key={t_.id}
            type="button"
            onClick={() => setTab(t_.id)}
            className={cn(
              "px-4 pb-2.5 pt-3 text-wb-14 font-medium transition-colors",
              activeTab === t_.id
                ? "border-b-2 border-brand text-brand"
                : "text-wb-ntrl-6 hover:text-wb-ink",
            )}
          >
            {t_.label}
          </button>
        ))}
      </div>

      {/* Tab content — fills remaining height */}
      <div className="flex min-h-0 flex-1 flex-col">
        {activeTab === "declaration" && <DeclarationTab
            ref={declarationRef}
            detail={detail}
            onSaved={onClose}
          />}
        {activeTab === "bkbr" && (
          <BkbrTab sid={declId} period={periodLabel} />
        )}
        {activeTab === "bkmv" && (
          <BkmvTab sid={declId} period={periodLabel} />
        )}
        {activeTab === "pl_142" && (
          <PlReduce8Tab sid={declId} period={periodLabel} />
        )}
        {(activeTab === "pl_cssx" || activeTab === "pl_vt") && (
          <div className="flex flex-1 items-center justify-center text-wb-13 font-medium text-wb-ntrl-6">
            {t("common.coming_soon")}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex shrink-0 items-center justify-between border-t border-wb-ntrl-4 bg-white px-6 py-3">
        <div className="flex items-center gap-4">
          <ExportDropdown
            sid={declId}
            detail={detail}
            activeTab={activeTab}
            onExportDeclaration={() => declarationRef.current?.exportExcel()}
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={saving || syncing}
            className="flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-[6px] bg-white px-3 text-wb-14-tight font-medium text-wb-ink shadow-wb-btn hover:bg-black/3 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving && (
              <svg className="size-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
            )}
            {t("tax_filing.form.action_save_draft")}
          </button>
          {isDraft && (
            <button
              type="button"
              onClick={handleSync}
              disabled={syncing || saving || locking}
              className="flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-[6px] bg-white px-3 text-wb-14-tight font-medium text-wb-ink shadow-wb-btn hover:bg-black/3 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw className={cn("size-3.5", syncing && "animate-spin")} />
              {t("tax_filing.form.sync")}
            </button>
          )}
          <button
            type="button"
            onClick={handleLock}
            disabled={locking || saving || syncing}
            className="flex h-8 cursor-pointer items-center justify-center rounded-[6px] bg-brand p-2 gap-1 text-wb-14-tight font-medium text-white shadow-wb-brand-btn hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
            >
              <path
                d="M12 7.16659C11.7267 7.16659 11.5 6.93992 11.5 6.66659V5.33325C11.5 3.23325 10.9067 1.83325 8 1.83325C5.09333 1.83325 4.5 3.23325 4.5 5.33325V6.66659C4.5 6.93992 4.27333 7.16659 4 7.16659C3.72667 7.16659 3.5 6.93992 3.5 6.66659V5.33325C3.5 3.39992 3.96667 0.833252 8 0.833252C12.0333 0.833252 12.5 3.39992 12.5 5.33325V6.66659C12.5 6.93992 12.2733 7.16659 12 7.16659Z"
                fill="white"
              />
              <path
                d="M11.333 15.1667H4.66634C1.72634 15.1667 0.833008 14.2734 0.833008 11.3334V10.0001C0.833008 7.06008 1.72634 6.16675 4.66634 6.16675H11.333C14.273 6.16675 15.1663 7.06008 15.1663 10.0001V11.3334C15.1663 14.2734 14.273 15.1667 11.333 15.1667ZM4.66634 7.16675C2.27967 7.16675 1.83301 7.62008 1.83301 10.0001V11.3334C1.83301 13.7134 2.27967 14.1667 4.66634 14.1667H11.333C13.7197 14.1667 14.1663 13.7134 14.1663 11.3334V10.0001C14.1663 7.62008 13.7197 7.16675 11.333 7.16675H4.66634Z"
                fill="white"
              />
              <path
                d="M5.33366 11.3333C5.24699 11.3333 5.16032 11.3133 5.08032 11.28C4.99366 11.2467 4.927 11.2 4.86033 11.14C4.74033 11.0133 4.66699 10.8467 4.66699 10.6667C4.66699 10.58 4.68698 10.4933 4.72032 10.4133C4.75365 10.3267 4.80033 10.26 4.86033 10.1933C4.927 10.1333 4.99366 10.0867 5.08032 10.0533C5.32032 9.94665 5.62032 10.0067 5.80699 10.1933C5.86699 10.26 5.91367 10.3333 5.947 10.4133C5.98033 10.4933 6.00033 10.58 6.00033 10.6667C6.00033 10.84 5.92699 11.0133 5.80699 11.14C5.68032 11.26 5.50699 11.3333 5.33366 11.3333Z"
                fill="white"
              />
              <path
                d="M7.99967 11.3334C7.82634 11.3334 7.65301 11.2601 7.52635 11.1401C7.40635 11.0134 7.33301 10.8468 7.33301 10.6668C7.33301 10.5801 7.34633 10.4934 7.38633 10.4134C7.41967 10.3334 7.46635 10.2601 7.52635 10.1934C7.67968 10.0401 7.91301 9.96676 8.12634 10.0134C8.17301 10.0201 8.21301 10.0334 8.25301 10.0534C8.29301 10.0668 8.33301 10.0868 8.37301 10.1134C8.40634 10.1334 8.43967 10.1668 8.473 10.1934C8.533 10.2601 8.57968 10.3334 8.61302 10.4134C8.64635 10.4934 8.66634 10.5801 8.66634 10.6668C8.66634 10.8468 8.593 11.0134 8.473 11.1401C8.43967 11.1668 8.40634 11.1934 8.37301 11.2201C8.33301 11.2468 8.29301 11.2668 8.25301 11.2801C8.21301 11.3001 8.17301 11.3134 8.12634 11.3201C8.08634 11.3268 8.03967 11.3334 7.99967 11.3334Z"
                fill="white"
              />
              <path
                d="M10.6667 11.3334C10.4867 11.3334 10.32 11.2601 10.1933 11.1401C10.1333 11.0734 10.0867 11.0001 10.0533 10.9201C10.02 10.8401 10 10.7534 10 10.6668C10 10.4934 10.0733 10.3201 10.1933 10.1934C10.2267 10.1668 10.26 10.1401 10.2933 10.1134C10.3333 10.0868 10.3733 10.0668 10.4133 10.0534C10.4533 10.0334 10.4933 10.0201 10.5333 10.0134C10.7533 9.96676 10.98 10.0401 11.14 10.1934C11.26 10.3201 11.3333 10.4868 11.3333 10.6668C11.3333 10.7534 11.3133 10.8401 11.28 10.9201C11.2467 11.0068 11.2 11.0734 11.14 11.1401C11.0133 11.2601 10.84 11.3334 10.6667 11.3334Z"
                fill="white"
              />
            </svg>
            {t("tax_filing.form.action_lock")}
          </button>
        </div>
      </div>
    </div>
  );
}
