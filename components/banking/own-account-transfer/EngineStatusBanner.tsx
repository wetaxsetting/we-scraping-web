"use client";

import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import type { NxisasEngineStatus } from "./hooks/use-nxisas-engine";

type EngineStatusBannerProps = {
    status:    NxisasEngineStatus;
    vendor?:   string | null;
    version?:  string | null;
    onRetry?:  () => void;
    className?: string;
};

/**
 * Compact in-page banner that surfaces the local NXiSAS engine state.
 * Hidden when the engine is ready — the source-account table's per-row
 * Transfer button is enabled and the banner would just add noise.
 *
 * - {@code loading} / {@code probing} — neutral "checking" pill
 * - {@code timeout} / {@code load_error} — retry CTA
 *
 * <p>The {@code not_installed} and {@code unsupported_os} statuses are
 * intentionally owned by the dedicated modal dialogs
 * ({@link EngineNotInstalledDialog} / {@link EngineUnsupportedOsDialog}
 * — Figma 271:7388 + 272:7700) so they get a full-attention surface
 * with the bottom-aligned CTA instead of a thin inline pill. The
 * `vendor` / `version` props remain on this banner's signature even
 * though the current variants don't render them — so a future banner
 * variant (e.g. a debug-mode badge) can pick them up without
 * re-threading the prop through the call site.
 */
export default function EngineStatusBanner({
    status,
    onRetry,
    className,
}: EngineStatusBannerProps) {
    const { t } = useTranslation();

    if (status === "ready") return null;
    // The "not installed" case is rendered by the dedicated
    // `<EngineNotInstalledDialog>` (Figma 271:7388) so it owns the
    // download CTA exclusively. The "unsupported OS" case is rendered
    // by `<EngineUnsupportedOsDialog>` (Figma 272:7700) as a system-
    // requirements modal. Both suppress the inline banner to avoid a
    // double surface for the same condition.
    if (status === "not_installed") return null;
    if (status === "unsupported_os") return null;

    const pillBase =
        "flex flex-col gap-2 rounded-md border px-4 py-3 text-wb-13";

    if (status === "loading" || status === "probing") {
        return (
            <div
                className={cn(
                    pillBase,
                    "border-wb-table-border bg-wb-bg-sidebar text-wb-muted",
                    className,
                )}
            >
                <span className="font-medium">
                    {t("own_account_transfer.engine.checking")}
                </span>
            </div>
        );
    }

    // Remaining cases: `timeout` / `load_error` — surfaced as a red
    // pill with a retry CTA. (`ready`, `not_installed`, and
    // `unsupported_os` returned early above.)
    return (
        <div
            className={cn(
                pillBase,
                "border-wb-status-rejected-bg bg-wb-status-rejected-bg/30 text-wb-ink",
                className,
            )}
        >
            <span className="font-semibold text-wb-status-rejected-text">
                {t("own_account_transfer.engine.timeout_title")}
            </span>
            <span className="text-wb-muted">
                {t("own_account_transfer.engine.timeout_body")}
            </span>
            {onRetry ? (
                <div className="mt-1">
                    <Button
                        type="button"
                        variant="outline"
                        className="h-8 px-4 text-wb-13"
                        onClick={onRetry}
                    >
                        {t("common.try_again")}
                    </Button>
                </div>
            ) : null}
        </div>
    );
}
