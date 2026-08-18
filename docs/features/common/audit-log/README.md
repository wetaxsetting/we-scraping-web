# Common → audit-log (Frontend)

**Status: CURRENT** — documents shipped frontend behaviour. Per-screen wiring detail is in the tables below. Vocabulary: [../../../README.md § Status vocabulary](../../../README.md#status-vocabulary).

**Part of:** Common → audit-log
**Last verified:** 2026-06-23

> **Module shape: API-write / WEB-read-only.** The frontend has **no write path** for audit logs —
> writing is entirely a backend concern (`AuditLogService.append`). The web side is a **single generic
> read dialog**, `AuditLogsDialog`, that hosts open to show a row's audit history. There is **no generic
> audit read endpoint** — rows come from per-feature endpoints, and the host passes **pre-translated**
> rows into the dialog.

## Documents index

| Doc | Purpose |
|---|---|
| [screen-flow.md](screen-flow.md) | How a host opens the dialog and what the user sees / does. |
| [ui-specification.md](ui-specification.md) | Modal chrome, table layout, tokens (verified against the component). |
| [component-index.md](component-index.md) | `AuditLogsDialog` props + `AuditLogRow` shape. |
| [api-consumption.md](api-consumption.md) | Reads come from per-feature endpoints; the dialog itself fetches nothing. |
| [test-scenarios.md](test-scenarios.md) | What to verify for the read dialog. |

## Related links

- API twin (write path) — [../../../../../wecms-api/docs/features/common/audit-log/README.md](../../../../../wecms-api/docs/features/common/audit-log/README.md)

## At a glance (verified)

| Aspect | Value |
|---|---|
| Component | `components/shared/popups/AuditLogsDialog.tsx` (default export) |
| Type | `AuditLogRow` (exported from the same file) |
| Stacking | `stackLevel={2}` — sits above the L1 Settings shell |
| Data | Host supplies `rows: AuditLogRow[]` already translated; dialog renders plain text |
| Consumers (verified) | Bank Account (`components/settings/bank-account/BankAccountPanel.tsx`), Login Credentials (`components/settings/login-credentials/LoginCredentialsPanel.tsx`) |
