# audit-log — Component Index (Frontend)

**Part of:** Common → audit-log
**Last verified:** 2026-06-23

Single component. File: `components/shared/popups/AuditLogsDialog.tsx` (default export `AuditLogsDialog`).

## `AuditLogRow` (exported, `:19-33`)

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | React key. |
| `date` | `string` | Date line 1 — **already formatted** by the host (e.g. `09-12-2024`). |
| `time` | `string` | Time line 2 — already formatted (e.g. `15:13:24`). |
| `user` | `string` | Actor display name. |
| `activity` | `string` | Activity label — **already translated** by the host. |
| `details` | `string` | Activity-details label — already translated. |

The host pre-translates `activity`/`details`; the dialog renders them as plain text (no `t()` on row data).

## `AuditLogsDialogProps` (exported, `:35-51`)

| Prop | Type | Required | Notes |
|---|---|---|---|
| `title` | `string` | Yes | Dialog title — already translated. |
| `description` | `string` | No | Subtitle below the title — already translated; hidden when omitted. |
| `rows` | `AuditLogRow[]` | Yes | History rows; empty → `common.no_data` placeholder. |
| `onClose` | `() => void` | Yes | Called by Close / X / ESC. |
| `columnLabels` | `Partial<{ datetime; user; activity; details }>` | No | Per-caller header overrides; default keys in `DEFAULT_COL_KEYS` (`:53-58`). |

## Internal subcomponents

| Name | Role | Source |
|---|---|---|
| `HeaderCell` | Sticky `<th>` styling | `:174-180` |
| `AuditLogTableRow` | One `<tr>` — Date/Time stack + User + Activity + Details | `:182-213` |

## Consumers (verified)

| Consumer | File | Import |
|---|---|---|
| Login Credentials panel | `components/settings/login-credentials/LoginCredentialsPanel.tsx` | `import AuditLogsDialog, { type AuditLogRow } …` (`:6-8`) |
| Bank Account panel | `components/settings/bank-account/BankAccountPanel.tsx` | (references `AuditLogsDialog`) |

## Reuse note

`AuditLogsDialog` replaced two byte-identical panel-local copies (`bank-account/AuditLogsDialog`,
`login-credentials/AuditLogsDialog`) — it owns the chrome; hosts pass title/description/pre-translated rows
(component Javadoc `:60-79`). Do not fork it per feature; extend props if a new caller needs a variation.
