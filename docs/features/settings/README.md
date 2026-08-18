# Settings — Frontend Feature Docs

**Status: CURRENT (index)** — navigation only. Each linked screen doc carries its own status; see [../../README.md § Status vocabulary](../../README.md#status-vocabulary).

Per-item Next.js design docs for the **Settings** menu. Every Settings item renders as a panel inside [`<SettingsModal>`](../../../components/settings/SettingsModal.tsx) via [`<SettingsNav>`](../../../components/settings/SettingsNav.tsx) — **no standalone route**. Each panel lives at `components/settings/{feature}/{Feature}Panel.tsx`.

> Consolidation note (2026-06-01, cleaned up 2026-06-02): each item below is now a **single canonical doc**. The detailed Next.js design docs (formerly under `features/` and `screen-flows/settings/`) were merged here. The older thin "canonical Settings-menu entry" stubs (once kept under `archive/`) were removed as duplicates — their content lives in these docs and the API-side cross-links are in the table below.

## Settings item → doc → API-side doc

| Settings item | Frontend doc | Panel component | API-side doc (`wecms-api`) |
|---|---|---|---|
| Purpose | [purpose/](purpose/README.md) (folder — primary home; concise spec preserved at [purpose.md](purpose.md)) | `purpose/PurposePanel` | `purpose/` _(wecms-api backend repo — not included in this clone)_ |
| VAS Account | [vas-account/](vas-account/README.md) (folder — primary home; single-file spec preserved at [vas-account.md](vas-account.md)) | `vas-account/VasAccountPanel` | `vas-account/` _(wecms-api backend repo — not included in this clone)_ |
| Contacts | [contacts/](contacts/README.md) (folder — primary home; design note preserved at [contacts.md](contacts.md)) | `contacts/ContactsPanel` | [wecms-api/…/contacts/](../../../../wecms-api/docs/features/settings/contacts/README.md) |
| Approval Line | [approval-line/](approval-line/README.md) (folder — primary home; concise spec preserved at [approval-line.md](approval-line.md)) | `approval-line/ApprovalLinePanel` | [wecms-api/…/approval-line/](../../../../wecms-api/docs/features/settings/approval-line/README.md) |
| Chart of Accounts | [chart-of-accounts/](chart-of-accounts/README.md) (folder — primary home; design spec preserved at [chart-of-accounts.md](chart-of-accounts.md)) | `chart-of-accounts/ChartOfAccountsPanel` | [wecms-api/…/chart-of-accounts/](../../../../wecms-api/docs/features/settings/chart-of-accounts/README.md) |
| Login Credentials | [login-credentials.md](login-credentials.md) | `login-credentials/*` (+ shared popups) | `login-credentials.md` _(wecms-api backend repo — not included in this clone)_ |
| Bank Account | [bank-account.md](bank-account.md) | `bank-account/BankAccountPanel` | `bank-account.md` _(wecms-api backend repo — not included in this clone)_ |
| Preferences | [preferences.md](preferences.md) | `preferences/PreferencesPanel` | `preferences.md` _(wecms-api backend repo — not included in this clone)_ |
| Users | [user-management/](user-management/README.md) ✅ (supersedes flat [users.md](users.md)) | `users/UsersPanel` | `user-management/` _(wecms-api backend repo — not included in this clone)_ |
| Transaction History (ERP) | [transaction-history.md](transaction-history.md) | `transaction-history/TransactionHistoryPanel` | `transaction-history.md` _(wecms-api backend repo — not included in this clone)_ |
| Firm Banking Settings | [firm-banking-settings.md](firm-banking-settings.md) | `firm-banking-settings/FirmBankingSettingsPanel` | `firm-banking-settings.md` _(wecms-api backend repo — not included in this clone)_ |
| Firm Banking History | [firm-banking-history/](firm-banking-history/README.md) (folder — primary home; concise entry preserved at [firm-banking-history.md](firm-banking-history.md)) | `firm-banking-history/FirmBankingHistoryPanel` | `firm-banking-history.md` _(wecms-api backend repo — not included in this clone)_ |

> Transaction History here is the **ERP** interface log (legacy `comm_0219_001`), distinct from Banking → Transaction History (`comm_0220_001`).

## Legacy display-rule parity

Module-wide legacy display-rule audit + the accepted Tier-1 fixes (and the
deferred datetime / P1–P11 / D3–D6 items) live in
[../../audits/settings-display-rule-parity-audit.md](../../audits/settings-display-rule-parity-audit.md).
The Banking-module companion is
[../../audits/banking-display-rule-parity-audit.md](../../audits/banking-display-rule-parity-audit.md).
*(Both moved to [../../audits/](../../audits/README.md) on 2026-08-17.)*

## Shared shell + rules

All panels follow the Settings shell + panel-composition contract and the Settings UI consistency rules in wecms-web/CLAUDE.md §3a / §3b. Excel-upload flows route through the shared [`<ExcelUploadDialog>`](../../../components/shared/excel-upload/ExcelUploadDialog.tsx).

## Related backend docs

Settings feature/API docs: `settings` _(wecms-api backend repo — not included in this clone)_ · cross-feature: `settings` _(wecms-api backend repo — not included in this clone)_.
