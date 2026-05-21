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
 * - {@code not_installed} — install CTA (download + run-check)
 * - {@code unsupported_os} — Windows-only explainer
 * - {@code timeout} / {@code load_error} — retry CTA
 */
export default function EngineStatusBanner({
    status,
    vendor,
    version,
    onRetry,
    className,
}: EngineStatusBannerProps) {
    const { t } = useTranslation();

    if (status === "ready") return null;

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

    if (status === "unsupported_os") {
        return (
            <div
                className={cn(
                    pillBase,
                    "border-wb-status-rejected-bg bg-wb-status-rejected-bg/30 text-wb-ink",
                    className,
                )}
            >
                <span className="font-semibold text-wb-status-rejected-text">
                    {t("own_account_transfer.engine.unsupported_os_title")}
                </span>
                <span className="text-wb-muted">
                    {t("own_account_transfer.engine.unsupported_os_body")}
                </span>
            </div>
        );
    }

    if (status === "timeout" || status === "load_error") {
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

    // not_installed
    return (
        <div
            className={cn(
                pillBase,
                "border-wb-table-border bg-wb-bg-sidebar text-wb-ink",
                className,
            )}
        >
            <span className="font-semibold">
                {t("own_account_transfer.engine.not_installed_title")}
            </span>
            <span className="text-wb-muted">
                {t("own_account_transfer.engine.not_installed_body")}
            </span>
            {vendor || version ? (
                <span className="text-wb-helper text-wb-muted">
                    {[vendor, version].filter(Boolean).join(" / ")}
                </span>
            ) : null}
            <div className="mt-2 flex flex-wrap gap-2">
                <a
                    href="/nxisas/file/NXiSAS.exe"
                    className="inline-flex h-8 items-center rounded-md border border-wb-table-border bg-brand px-4 text-wb-13 font-medium text-white hover:opacity-90"
                >
                    {t("own_account_transfer.engine.install_cta")}
                </a>
                <a
                    href="/nxisas/InstallCheck.html"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-8 items-center rounded-md border border-wb-table-border bg-white px-4 text-wb-13 font-medium text-wb-ink hover:bg-wb-bg-sidebar"
                >
                    {t("own_account_transfer.engine.check_cta")}
                </a>
                {onRetry ? (
                    <Button
                        type="button"
                        variant="outline"
                        className="h-8 px-4 text-wb-13"
                        onClick={onRetry}
                    >
                        {t("common.try_again")}
                    </Button>
                ) : null}
            </div>
        </div>
    );
}
