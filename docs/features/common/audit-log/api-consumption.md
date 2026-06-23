# audit-log — API Consumption (Frontend)

**Part of:** Common → audit-log
**Last verified:** 2026-06-23

## There is no generic audit read endpoint

`AuditLogsDialog` fetches **nothing**. It is a pure presentational modal — the host supplies
`rows: AuditLogRow[]` already fetched and already translated. Audit history reads come from
**per-feature endpoints** in each consuming feature's own domain (there is no Common `/audit-logs`
surface).

## How a host feeds the dialog (verified — Login Credentials)

`components/settings/login-credentials/LoginCredentialsPanel.tsx`:

1. Fetch via the feature's own API wrapper — `fetchLoginCredentialAuditLogs(apiType, apiSeqNo)` inside
   `useApiData(...)` (`:816-831`). The wire endpoint is the Login Credentials `/audit-logs` (under
   `/api/v1/login-credentials`).
2. Map the wire rows to `AuditLogRow[]` in `lib/api/mappers.ts` — `mapLoginCredentialAuditRowsToDialog(...)`
   returns `AuditLogRow[]` (verified `mappers.ts:2061, 2128-2136`), pre-formatting date/time and resolving
   activity/detail strings.
3. Pass the mapped rows: `<AuditLogsDialog rows={auditLogRows} … />` (`:1071-1078`).

Bank Account follows the same shape from `components/settings/bank-account/BankAccountPanel.tsx` with its
own feature read path.

## Wire → dialog mapping rule

- The dialog's `activity` / `details` are **already-translated strings**. The mapper resolves them before
  they reach the dialog — the dialog never calls `t()` on row data (only on its own chrome: column labels,
  Close, no-data).
- `date` / `time` are pre-formatted as two separate strings so the dialog renders the Figma two-line stack
  regardless of source locale formatting (`AuditLogsDialog.tsx:19-33`).

## What WEB never does

- No write/append of audit rows (that is entirely the backend `AuditLogService`).
- No direct call to a Common audit endpoint — there is none.
- No reading of the raw `WSVC_ID` slug value in the UI; the FE only renders the pre-localized audit strings.

## Backend contract reference

See the API twin: [../../../../../wecms-api/docs/features/common/audit-log/interface-specification.md](../../../../../wecms-api/docs/features/common/audit-log/interface-specification.md)
for the per-feature read finders that back these endpoints.
