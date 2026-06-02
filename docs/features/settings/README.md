# Settings — Frontend Feature Docs

Per-item Next.js design docs for the **Settings** menu. Every Settings item renders as a panel inside [`<SettingsModal>`](../../../components/settings/SettingsModal.tsx) via [`<SettingsNav>`](../../../components/settings/SettingsNav.tsx) — **no standalone route**. Each panel lives at `components/settings/{feature}/{Feature}Panel.tsx`.

> Consolidation note (2026-06-01): each item below is now a **single canonical doc**. The detailed Next.js design docs (formerly under `features/` and `screen-flows/settings/`) were merged here; the older thin "canonical Settings-menu entry" stubs were superseded and preserved under [`../../archive/`](../../archive/).

## Settings item → doc → API-side doc

| Settings item | Frontend doc | Panel component | API-side doc (`wecms-api`) |
|---|---|---|---|
| Purpose | [purpose.md](purpose.md) | `purpose/PurposePanel` | [`../../../../wecms-api/docs/settings/purpose.md`](../../../../wecms-api/docs/features/settings/purpose.md) |
| VAS Account | [vas-account.md](vas-account.md) | `vas-account/VasAccountPanel` | [`../../../../wecms-api/docs/settings/vas-account.md`](../../../../wecms-api/docs/features/settings/vas-account.md) |
| Contacts | [contacts.md](contacts.md) | `contacts/ContactsPanel` | [`../../../../wecms-api/docs/settings/contacts.md`](../../../../wecms-api/docs/features/settings/contacts.md) |
| Approval Line | [approval-line.md](approval-line.md) | `approval-line/ApprovalLinePanel` | [`../../../../wecms-api/docs/settings/approval-line.md`](../../../../wecms-api/docs/features/settings/approval-line.md) |
| Chart of Accounts | [chart-of-accounts.md](chart-of-accounts.md) | `chart-of-accounts/ChartOfAccountsPanel` | [`../../../../wecms-api/docs/settings/chart-of-accounts.md`](../../../../wecms-api/docs/features/settings/chart-of-accounts.md) |
| Login Credentials | [login-credentials.md](login-credentials.md) | `login-credentials/*` (+ shared popups) | [`../../../../wecms-api/docs/settings/login-credentials.md`](../../../../wecms-api/docs/features/settings/login-credentials.md) |
| Bank Account | [bank-account.md](bank-account.md) | `bank-account/BankAccountPanel` | [`../../../../wecms-api/docs/settings/bank-account.md`](../../../../wecms-api/docs/features/settings/bank-account.md) |
| Preferences | [preferences.md](preferences.md) | `preferences/PreferencesPanel` | [`../../../../wecms-api/docs/settings/preferences.md`](../../../../wecms-api/docs/features/settings/preferences.md) |
| Users | [users.md](users.md) | `users/UsersPanel` | [`../../../../wecms-api/docs/settings/users.md`](../../../../wecms-api/docs/features/settings/users.md) |
| Transaction History (ERP) | [transaction-history.md](transaction-history.md) | `transaction-history/TransactionHistoryPanel` | [`../../../../wecms-api/docs/settings/transaction-history.md`](../../../../wecms-api/docs/features/settings/transaction-history.md) |
| Firm Banking Settings | [firm-banking-settings.md](firm-banking-settings.md) | `firm-banking-settings/FirmBankingSettingsPanel` | [`../../../../wecms-api/docs/settings/firm-banking-settings.md`](../../../../wecms-api/docs/features/settings/firm-banking-settings.md) |
| Firm Banking History | [firm-banking-history.md](firm-banking-history.md) | `firm-banking-history/FirmBankingHistoryPanel` | [`../../../../wecms-api/docs/settings/firm-banking-history.md`](../../../../wecms-api/docs/features/settings/firm-banking-history.md) |

> Transaction History here is the **ERP** interface log (legacy `comm_0219_001`), distinct from Banking → Transaction History (`comm_0220_001`).

## Shared shell + rules

All panels follow the Settings shell + panel-composition contract and the Settings UI consistency rules in wecms-web/CLAUDE.md §3a / §3b. Excel-upload flows route through the shared [`<ExcelUploadDialog>`](../../../components/shared/excel-upload/ExcelUploadDialog.tsx).

## Related backend docs

Settings feature/API docs: [`../../../../wecms-api/docs/settings/`](../../../../wecms-api/docs/features/settings/) · cross-feature: [`../../../../wecms-api/docs/features/settings/`](../../../../wecms-api/docs/features/settings/).
