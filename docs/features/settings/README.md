# Settings — Frontend Feature Docs

Per-item Next.js design docs for the **Settings** menu. Every Settings item renders as a panel inside [`<SettingsModal>`](../../../components/settings/SettingsModal.tsx) via [`<SettingsNav>`](../../../components/settings/SettingsNav.tsx) — **no standalone route**. Each panel lives at `components/settings/{feature}/{Feature}Panel.tsx`.

> Consolidation note (2026-06-01, cleaned up 2026-06-02): each item below is now a **single canonical doc**. The detailed Next.js design docs (formerly under `features/` and `screen-flows/settings/`) were merged here. The older thin "canonical Settings-menu entry" stubs (once kept under `archive/`) were removed as duplicates — their content lives in these docs and the API-side cross-links are in the table below.

## Settings item → doc → API-side doc

| Settings item | Frontend doc | Panel component | API-side doc (`wecms-api`) |
|---|---|---|---|
| Purpose | [purpose.md](purpose.md) | `purpose/PurposePanel` | `purpose.md` _(wecms-api backend repo — not included in this clone)_ |
| VAS Account | [vas-account.md](vas-account.md) | `vas-account/VasAccountPanel` | `vas-account.md` _(wecms-api backend repo — not included in this clone)_ |
| Contacts | [contacts.md](contacts.md) | `contacts/ContactsPanel` | `contacts.md` _(wecms-api backend repo — not included in this clone)_ |
| Approval Line | [approval-line.md](approval-line.md) | `approval-line/ApprovalLinePanel` | `approval-line.md` _(wecms-api backend repo — not included in this clone)_ |
| Chart of Accounts | [chart-of-accounts.md](chart-of-accounts.md) | `chart-of-accounts/ChartOfAccountsPanel` | `chart-of-accounts.md` _(wecms-api backend repo — not included in this clone)_ |
| Login Credentials | [login-credentials.md](login-credentials.md) | `login-credentials/*` (+ shared popups) | `login-credentials.md` _(wecms-api backend repo — not included in this clone)_ |
| Bank Account | [bank-account.md](bank-account.md) | `bank-account/BankAccountPanel` | `bank-account.md` _(wecms-api backend repo — not included in this clone)_ |
| Preferences | [preferences.md](preferences.md) | `preferences/PreferencesPanel` | `preferences.md` _(wecms-api backend repo — not included in this clone)_ |
| Users | [users.md](users.md) | `users/UsersPanel` | `users.md` _(wecms-api backend repo — not included in this clone)_ |
| Transaction History (ERP) | [transaction-history.md](transaction-history.md) | `transaction-history/TransactionHistoryPanel` | `transaction-history.md` _(wecms-api backend repo — not included in this clone)_ |
| Firm Banking Settings | [firm-banking-settings.md](firm-banking-settings.md) | `firm-banking-settings/FirmBankingSettingsPanel` | `firm-banking-settings.md` _(wecms-api backend repo — not included in this clone)_ |
| Firm Banking History | [firm-banking-history.md](firm-banking-history.md) | `firm-banking-history/FirmBankingHistoryPanel` | `firm-banking-history.md` _(wecms-api backend repo — not included in this clone)_ |

> Transaction History here is the **ERP** interface log (legacy `comm_0219_001`), distinct from Banking → Transaction History (`comm_0220_001`).

## Shared shell + rules

All panels follow the Settings shell + panel-composition contract and the Settings UI consistency rules in wecms-web/CLAUDE.md §3a / §3b. Excel-upload flows route through the shared [`<ExcelUploadDialog>`](../../../components/shared/excel-upload/ExcelUploadDialog.tsx).

## Related backend docs

Settings feature/API docs: `settings` _(wecms-api backend repo — not included in this clone)_ · cross-feature: `settings` _(wecms-api backend repo — not included in this clone)_.
