import { toApiError } from "@/lib/api/weinvoice/http";
import type { useTranslation } from "@/lib/i18n";

/** Toast text for a failed WeInvoice API call: backend message + "(Mã lỗi : CODE)". */
export function apiErrorText(err: unknown, t: ReturnType<typeof useTranslation>["t"]): string {
    const e = toApiError(err);
    return `${e.message} ${t("dialog.error_code", { code: e.code })}`;
}
