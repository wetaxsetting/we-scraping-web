/**
 * Firm Banking History "Service Name" display resolver — legacy
 * `comm_0221_001.ts:639-647` `getServiceName` parity.
 *
 * <p>Legacy maps the raw `SVC_NM` through `SERVICE_NAME_MAP`; when the
 * mapped code starts with `"20"` (the firm-banking transaction codes
 * 201 / 202 / 203) the localized label is prefixed with the numeric
 * code — e.g. `201 : Inquiry Recipient`. Named service strings
 * (scraping / e-invoice) and unmapped codes (e.g. 204, which has no
 * i18n key) render without a prefix.
 *
 * <p>In the refactor the backend resolves the i18n key
 * (`serviceNameKey`); its presence is the "is a mapped code" signal
 * that gates the legacy numeric prefix. Used by both the list table
 * cell and the detail popover so the two render identically.
 */
export function resolveFirmBankingServiceName(
    serviceNameKey: string | null | undefined,
    serviceName: string,
    fallbackLabel: string,
    t: (key: string) => string,
): string {
    const label = serviceNameKey ? t(serviceNameKey) : fallbackLabel;
    return serviceNameKey && serviceName.startsWith("20")
        ? `${serviceName} : ${label}`
        : label;
}
