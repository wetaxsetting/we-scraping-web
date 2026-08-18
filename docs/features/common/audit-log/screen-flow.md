# Audit Log — Screen Flow (Frontend)

**Part of:** Common → audit-log
**Last verified:** 2026-06-23

`AuditLogsDialog` is a generic, host-driven read modal. It owns no data fetching and no business state.

## Flow (verified — `LoginCredentialsPanel.tsx`, `AuditLogsDialog.tsx`)

```
Host row action (e.g. "Audit Logs")
   → host sets which row to inspect + opens the dialog
   → host fetches that row's audit history from its per-feature endpoint
   → host maps the wire rows to AuditLogRow[] (pre-translated)
   → <AuditLogsDialog title description rows onClose /> renders
   → user reads the history table
   → Close / X / ESC → onClose() → host clears its open state
```

Verified host wiring (Login Credentials, `LoginCredentialsPanel.tsx`):
- `auditLogsFor` / `auditLogsOpen` state hold the inspected row + open flag (`:219-220`).
- `useApiData` fetches via `fetchLoginCredentialAuditLogs(apiType, apiSeqNo)` keyed on the selected row
  (`:816-831`).
- Wire rows are mapped to `AuditLogRow[]` (`:839`).
- The dialog is mounted only while open: `{auditLogsOpen && <AuditLogsDialog … />}` (`:1071-1078`).

## What the dialog renders

- **Header** — `title` + optional `description` (both already translated by the host).
- **Body** — a 4-column table: Date/Time · User · Activity · Activity Details. Sticky `<thead>`; empty
  `rows` → centered `common.no_data` placeholder (`AuditLogsDialog.tsx:152-156`).
- **Footer** — a single right-aligned outlined Close button (`:160-168`).

## Close behaviour

Close / X / ESC dismiss only this dialog (it sits at `stackLevel={2}` above the L1 Settings shell). The
host's `onClose` clears its own open state. Closing does not affect the parent Settings modal.

## Data direction

WEB never writes audit rows. The dialog is read-only and stateless beyond its props; all history data and
all translation happen in the host before the rows reach the dialog.
