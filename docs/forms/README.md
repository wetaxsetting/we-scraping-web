# wecms-web — Forms Catalog (Tất cả Form trong phần Web)

> **Mục đích.** Tài liệu này liệt kê **tất cả các form / màn hình nhập liệu / bộ lọc gọi API** trong frontend `wecms-web`, song song với các docs xử lý dữ liệu phía `wecms-api`. Với mỗi form: **chức năng → gọi API nào (method + endpoint) → data đi như thế nào (request → wire → mapper → state/UI)** → xử lý lỗi.
>
> **Phạm vi "form".** Không chỉ form CRUD cổ điển — bao gồm cả: dialog tạo/sửa, bộ lọc (filter/search) submit lên API, upload Excel (download template → preview → upload), các action inline (confirm/match/edit cell), report search form, và popover View Setting.
>
> Nguồn: source-verified từ `components/**`, `lib/api/**`, `lib/auth/**`, `lib/nxisas/**`, `lib/types/api.ts`. Khi tài liệu này khác với code, **code là chân lý** — cập nhật lại file này.

---

## 0. Cách đọc — kiến trúc data flow chung (đọc 1 lần)

Mọi form đi qua **một pipeline chung**. Hiểu phần này thì các mục sau chỉ cần đọc phần khác biệt.

### 0.1. Ba lớp dữ liệu (CTO directive 2026-05-08)

| Lớp | Quy ước đặt tên | Ở đâu |
|---|---|---|
| **Wire JSON** (request + response) | `snake_case` thường | mọi HTTP call tới `wecms-api` |
| **Frontend wire types** | `snake_case` (khớp wire) | `lib/types/api.ts` (các type `Api*`) |
| **Frontend in-memory types** | `camelCase` ngữ nghĩa đầy đủ | mọi nơi ngoài `lib/types/api.ts` (component, hook, state, storage) |

Dịch giữa lớp wire ↔ in-memory xảy ra **đúng một lần ở biên**:
- `lib/api/mappers.ts` — dịch row wire (`snake_case`) → row frontend (`camelCase`).
- `lib/auth/client.ts` (`toStoredUser`) — dịch user wire → `StoredUser`.

> Component / hook / state **không bao giờ** đọc trực tiếp `response.data.user_id`. Nếu thấy như vậy nghĩa là thiếu mapper.

### 0.2. Transport — `lib/axios.ts`

```
Component  →  lib/api/<domain>.<fn>()  →  api (axios instance)  →  wecms-api
                                              │
                                  request interceptor: gắn  Authorization: Bearer <wecms_token>
                                              │
                                  response interceptor: HTTP 401 (trừ /auth/login, /auth/logout)
                                              → requestReAuth()  → bật <SessionExpiredDialog>
                                              → re-auth thành công → retry request gốc 1 lần
```

- `baseURL` = `process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080"`.
- JWT đọc từ `localStorage["wecms_token"]` trên mỗi request.

### 0.3. Response envelope (mọi endpoint)

```ts
interface ApiResponse<T> {
  status: { error: boolean; code: string; message: string };
  data?:  T;
  timestamp?: string;   // chỉ có khi lỗi
  path?:      string;   // chỉ có khi lỗi
  trace_id?:  string;   // chỉ có khi lỗi — id JEX-style, grep được trong log server
}
```

- **Success ≠ HTTP 200.** Luôn kiểm tra `status.error === false`; backend trả 200 cho cả business error.
- Hàm helper `unwrap<T>()` trong các `lib/api/*.ts` bóc envelope, ném `ApiCallError { code, message, traceId }` khi `status.error === true`.
- `WBI0000` = success. Các mã `WBExxxx` = lỗi (bảng ở §7).

### 0.4. Fetch & cache phía client

- `lib/api/useApiData.ts` (`useApiData`) — fetch khi mount + refetch khi deps đổi; latch `stableData`; có thể fallback về mock seed khi rỗng/lỗi (một số trang banking/report).
- Bộ lọc đổi → reset trang về 1 (`usePagination.resetPage()`) → deps đổi → tự refetch.
- Sort: `hooks/useTableSort.ts` — chu kỳ `default → ASC → DESC → default`, gửi `sortField` (FIELD_ID) + `sortDirection`; **sort luôn ở DB-side**, không sort trên client.

### 0.5. Hiển thị lỗi / xác nhận — `useDialog()`

| Loại | Dùng cho |
|---|---|
| `error` (đỏ) | API/network fail · validation Zod/file · lỗi hệ thống |
| `warning` (cam) | cảnh báo không nghiêm trọng · "chưa hỗ trợ" |
| `confirmation` (xanh) | xác nhận trước hành động phá huỷ (delete/submit/reset) |
| `success` (xanh dương) | hành động hoàn tất |

`trace_id` từ server hiển thị nguyên văn trong dialog lỗi để người dùng đọc cho support.

### 0.6. localStorage keys

| Key | Chủ sở hữu | Xoá khi logout? |
|---|---|---|
| `wecms_token` | `tokenStorage` | ✅ |
| `wecms_user` | `userStorage` (giữ `StoredUser` camelCase) | ✅ |
| `wecms_locale` | `LocaleProvider` | ❌ (giữ qua logout) |
| `wecms_saved_user_id` | `savedIdStorage` | ❌ |

### 0.7. Chú thích trạng thái (Status legend)

| Nhãn | Nghĩa |
|---|---|
| ✅ **Wired** | Form gọi API thật (`lib/api`/`lib/auth`), không dùng mock |
| 🟡 **Partial** | Một phần wired; phần còn lại no-op / chờ backend / fallback mock |
| ⚪ **Static-UI** | Chỉ UI; Save là no-op hoặc dữ liệu từ `mockData.ts` |
| 🔵 **Read-only** | Không nhập liệu; chỉ filter/search rồi đọc danh sách |

---

## 1. Bảng tổng hợp tất cả form

| # | Form / màn hình | Route / nơi mở | Component chính | Status | API chính |
|---|---|---|---|---|---|
| **AUTH & LAYOUT** |
| 1 | Login | `/login` | `auth/LoginForm.tsx` | ✅ | `POST /api/v1/auth/login` |
| 2 | Company Chooser (multi-company) | `/login` (nhánh) | `auth/CompanyChooser.tsx` | ✅ | `POST /api/v1/auth/login` (+`biz_key`) |
| 3 | Change Password | ProfileMenu | `layout/ChangePasswordDialog.tsx` | ✅ | `POST /api/v1/auth/change-password` |
| 4 | Session Expired (re-auth) | toàn cục 401 | `auth/SessionExpiredDialog.tsx` | ✅ | `POST /api/v1/auth/login` |
| 5 | Logout confirm | ProfileMenu | `layout/ProfileMenu.tsx` | ✅ | `POST /api/v1/auth/logout` (best-effort) |
| 6 | Language switch confirm | ProfileMenu | `layout/ProfileMenu.tsx` | client-only | — |
| **BANKING** |
| 7 | Account Inquiry filter | `/banking/account-inquiry` | `shared/AccountInquiryPage.tsx` | ✅ | `GET /api/v1/banking/accounts` |
| 8 | Transaction Sync (OTP/QNA/Captcha) | dialog ở Account Inquiry | `banking/account-inquiry/TransactionSyncDialog.tsx` | ✅ | `POST .../transactions-sync` (+otp/qna/captcha) |
| 9 | Sync History filter | dialog ở Account Inquiry | `banking/account-inquiry/SyncHistoryDialog.tsx` | ✅ | `GET /api/v1/banking/sync-history` |
| 10 | Transaction History filter + inline edit | `/banking/transaction-history/[id]` | `banking/transaction-history/*` | ✅ | `GET …/{acctSeqNo}/transactions` + PATCH/PUT/DELETE classify |
| 11 | Smart Organizer match | dialog ở Transaction History | `banking/transaction-history/SmartOrganizerDialog.tsx` | ✅ | `GET …/match-candidates` · `POST/DELETE …/match` |
| 12 | Own Account Transfer | `/banking/transfer-own-accounts` | `banking/own-account-transfer/*` | 🟡 | own-account-transfer endpoints + NXiSAS scrape |
| 13 | Transfer History filter | `/banking/transfer-history` | `banking/internal-transfer/TransferHistory*` | ✅ | `GET …/internal-transfer/transfer-history` |
| 14 | Daily Cash search | `/banking/reports/daily-cash` | `banking/reports/daily-cash/*` | ✅ | `GET …/reports/daily-cash-report` |
| 15 | Daily Financial (CMC) search | `/banking/reports/daily-financial` | `banking/reports/daily-financial/*` | ✅ | `GET …/reports/daily-financial` (+`/transactions`) |
| 16 | Daily Financial (HS) search | `/banking/reports/daily-financial-hs` | `banking/reports/daily-financial-hs/*` | 🟡 | `GET …/reports/daily-financial-hs` |
| 17 | Cash Flow search | `/banking/reports/cash-flow` | `banking/reports/cash-flow/*` | ✅ | `GET …/reports/cash-flow-report` |
| **PAYMENT** |
| 18 | Excel Upload — Internal Transfer | `/payment/internal-transfer` | `payment/internal-transfer/InternalTransferUploadDialog.tsx` | ✅ | parse + create (multipart) |
| 19 | Excel Upload — Vendor / Expense / Payroll | scheduled-payment các module | `payment/*/`*UploadDialog | ✅ | parse + create (multipart) |
| 20 | Excel Upload — Overseas | `/payment/overseas-payment` | `payment/overseas-payment/OverseasExcelUploadModal.tsx` | ✅ | excel-preview + excel-upload |
| 21 | Request Approval (đa-module) | detail Scheduled | `payment/shared/RequestApprovalDialog.tsx` | 🟡 | `…/{id}/request-approval` + approval-lines |
| 22 | Reporting Account edit (inline) | detail Scheduled | `payment/shared/PaymentDetailPage.tsx` | 🟡 | `PATCH …/reporting-account` |
| 23 | Scheduled / Result list filter | các trang list | `payment/shared/Payment*BatchListPage.tsx` | 🟡 | `GET …/scheduled` · `GET …/results` |
| 24 | Approval Box filter | `/payment/approval-box` | `payment/approval-box/*` | 🟡 | `GET /api/v1/payment/approval-box` |
| 25 | Card Transactions filter | `/payment/corporate-card/card-transactions` | `payment/corporate-card/*` | 🟡 | `GET /api/v1/payment/card-transactions` |
| 26 | Exchange Rate Inquiry | `/payment/overseas-payment/exchange-rate-inquiry` | `payment/overseas-payment/ExchangeRateInquiryPage.tsx` | 🟡 | exchange-rates (TBD) |
| **ADD-ON SERVICE** |
| 27 | Sales / Expenses e-Invoices filter | `/addon/sales-einvoices`, `/addon/expenses-einvoices` | `addon/sales-einvoices/EInvoicesClient.tsx` | ✅ | `GET /api/v1/addon/einvoices` + export |
| 28 | Update e-Invoice (scrape) | dialog ở e-Invoices | `addon/sales-einvoices/UpdateEInvoiceModal.tsx` | 🟡 | NXiSAS scrape + `POST …/scrape-results` |
| 29 | Operation Status filter | `/addon/operation-status` | `addon/operation-status/OperationStatusClient.tsx` | ✅ | `GET /api/v1/addon/operation-status` + `/update` |
| 30 | Inquire Operation Status (GDT) | dialog ở Operation Status | `addon/operation-status/InquireOperationStatusDialog.tsx` | ✅ | `POST …/inquire` + `POST …/operation-status` |
| **SETTINGS** (mở từ top-nav Settings → `SettingsModal`) |
| 31 | Users — Add / Edit / Delete | Settings ▸ User | `settings/users/*` | ✅ | `POST/PUT/DELETE /api/v1/settings/users` + check-id + image |
| 32 | Bank Account — Edit | Settings ▸ Bank Account | `settings/bank-account/EditBankAccountDialog.tsx` | ✅ | `PATCH /api/v1/settings/bank-account/{bankCd}/{acctNo}` |
| 33 | Contacts — Add/Edit/Delete + Excel | Settings ▸ Contacts | `settings/contacts/*` | ✅ | CRUD + bulk-import `/api/v1/settings/contacts` |
| 34 | Approval Line — create/edit + approvers | Settings ▸ Approval Line | `settings/approval-line/*` | ✅ | CRUD `/api/v1/settings/approval-line` + `GET /api/v1/users` |
| 35 | Chart of Accounts — CRUD + Excel | Settings ▸ Chart of Accounts | `settings/chart-of-accounts/*` | ✅ | CRUD + bulk `/api/v1/settings/chart-of-accounts` |
| 36 | Purpose — CRUD + reorder + Excel | Settings ▸ Purpose | `settings/purpose/*` | ✅ | CRUD `/api/v1/settings/purpose-settings` |
| 37 | VAS Account — CRUD + lookup + Excel | Settings ▸ VAS Account | `settings/vas-account/*` | ✅ | CRUD `/api/v1/settings/vas-account` |
| 38 | Login Credentials — bank/GDT CRUD + reveal | Settings ▸ Login Credentials | `settings/login-credentials/*` + `shared/popups/*` | ✅ | `/api/v1/login-credentials` (+`/reveal`, `/audit-logs`) |
| 39 | Preferences — read/edit + logo | Settings ▸ Preferences | `settings/preferences/PreferencesPanel.tsx` | ✅ | `GET/PUT /api/v1/settings/preferences` + `/logo` |
| 40 | Firm Banking Settings — CRUD | Settings ▸ Firm Banking Settings | `settings/firm-banking-settings/*` | ✅ | CRUD `/api/v1/settings/firm-banking-settings` |
| 41 | Firm Banking History — filter | Settings ▸ Firm Banking History | `settings/firm-banking-history/*` | 🔵 | `GET /api/v1/settings/firm-banking-history` |
| 42 | ERP Transaction History — filter | Settings ▸ Transaction History | `settings/erp-transaction-history/*` | 🔵 | `GET /api/v1/settings/erp-transaction-history` |
| 43 | View Setting popover (dùng chung) | mọi list page có icon List | `shared/view-setting/ViewSettingPopover.tsx` | ✅ | `GET/PUT/DELETE /api/v1/screen-options/{screenId}/{area}` |

> Chi tiết từng nhóm ở các mục bên dưới: [§2 Auth & Layout](#2-auth--layout--chi-tiết) · [§3 Banking](#3-banking--chi-tiết) · [§4 Payment](#4-payment--chi-tiết) · [§5 Add-on Service](#5-add-on-service--chi-tiết) · [§6 Settings](#6-settings--chi-tiết).

---

## 2. AUTH & LAYOUT — chi tiết

### 2.1. Login Form — ✅ Wired
- **Route / file:** `/login` · `app/(auth)/login/page.tsx` + `loginSchema.ts` · `components/auth/LoginForm.tsx`
- **Chức năng:** đăng nhập, tuỳ chọn "Save ID"; rehydrate `userId` đã lưu khi mount.
- **Fields** (Zod `loginSchema.ts`): `userId` (bắt buộc, max 50 → wire `user_id`), `password` (bắt buộc, max 100 → wire `user_pw`), `saveId` (checkbox, chỉ client).
- **Actions:** Submit (validate Zod → `login()`); checkbox Save ID.
- **API:** `lib/auth/client.login(userId, password, bizKey?)`
  - `POST /api/v1/auth/login` — request `{ user_id, user_pw, biz_key? }`
  - response `data: { access_token, token_type, expires_in, user_id, user_nm, biz_key, lang_cd, cmpn_nm, auth_gr_cd?, prdt_type?, companies_available? }`
- **Data flow:**
  1. Submit → RHF validate Zod; invalid → dialog `error` + focus field, **không** gọi API.
  2. Valid → `login()` → axios POST → `unwrap` envelope.
  3. Nếu `companies_available` & chưa có token → `{ kind: "chooser" }` → render `<CompanyChooser>`.
  4. Có token → `toStoredUser(rec)` dịch `user_id→userId`, `user_nm→userName`, `biz_key→bizKey`, `lang_cd→langCode`, `cmpn_nm→companyName`, `auth_gr_cd→role`, `prdt_type→productType`.
  5. `completeLogin()` → `tokenStorage.set` (localStorage + cookie) + `userStorage.set` + (`saveId` ? `savedIdStorage.set` : `.clear`) → `router.push(HOME_ROUTE = /banking/account-inquiry)`.
- **Lỗi:** Zod → dialog `error`; backend `WBE1009` (sai mật khẩu), `WBE1010` (chưa kích hoạt), `WBE1011` (khoá), `WBE1128` (đã xoá) → dialog `error` + `trace_id`; network → `WBE_NETWORK`; parse fail → `WBE_CLIENT_PARSE`. Sau lỗi: xoá password + focus lại.

### 2.2. Company Chooser — ✅ Wired (nhánh hiếm, multi-company)
- **File:** `components/auth/CompanyChooser.tsx` (LoginForm render khi `chooser`).
- **Chức năng:** user có ≥2 link công ty chọn công ty → gọi lại login với `biz_key`.
- **Data flow:** chọn radio → `finalizeChooser(bizKey)` → `login(userId, password, bizKey)` (credential giữ **trong memory**, mất khi refresh) → authenticated → `completeLogin`. Back → quay lại form credential.

### 2.3. Change Password — ✅ Wired
- **File:** `components/layout/ChangePasswordDialog.tsx` (mở từ `ProfileMenu`).
- **Fields** (Zod): `currentPassword`, `newPassword`, `confirmPassword` (đều bắt buộc, max 100) + `.refine()` new === confirm.
- **API:** `lib/auth/client.changePassword(...)` → `POST /api/v1/auth/change-password` — request `{ current_password, new_password, confirm_password }`.
- **Data flow:** Save → Zod (lệch new/confirm → dialog) → API → success dialog → đóng + `reset()`. Lỗi: `WBE2091` (mật khẩu hiện tại sai), `WBE_CHANGE_PASSWORD_REUSED`, `WBE_VALIDATION` → dialog `error` (form giữ nguyên).

### 2.4. Session Expired (re-auth) — ✅ Wired
- **File:** `components/auth/SessionExpiredDialog.tsx` · trigger `lib/auth/sessionExpired.ts` + interceptor `lib/axios.ts`.
- **Chức năng:** bất kỳ call nào trả 401 → bật lock screen; nhập lại password → re-auth → retry request gốc.
- **Data flow:** 401 (trừ login/logout) → `requestReAuth()` trả Promise → dialog hiện (company name + email). Submit → `login(userId, password, bizKey hiện tại)` → success: cập nhật token+user, `resolveReAuth("re_authenticated")` → interceptor retry request gốc 1 lần. Cancel: clear token+user, `resolveReAuth("cancelled")` → `window.location.assign("/login")`. Có `?preview=session-expired` để demo không cần backend.

### 2.5. Logout confirm — ✅ Wired (best-effort)
- **File:** `components/layout/ProfileMenu.tsx` (`useDialog confirmation`).
- **Data flow:** Yes → `logout()` → `POST /api/v1/auth/logout` (nuốt lỗi) → `tokenStorage.clear()` + `userStorage.clear()` (KHÔNG xoá `wecms_locale`, `wecms_saved_user_id`) → `router.replace("/login")`.

### 2.6. Language switch — client-only
- **File:** `ProfileMenu.tsx`. Chọn ngôn ngữ → dialog `confirmation` → `setLocale()` cập nhật `<html lang>` + `localStorage["wecms_locale"]`. Không gọi API.

---

## 3. BANKING — chi tiết

> Tất cả qua `lib/api/banking.ts` (+ `bankCredentials.ts`, `smartOrganizer.ts`, `currencyTotal.ts`), mapper `lib/api/mappers.ts`.

### 3.1. Account Inquiry — filter + View Setting + sort + export — ✅ Wired
- **Route / file:** `/banking/account-inquiry` · `components/shared/AccountInquiryPage.tsx` + `AccountInquiryClient.tsx`.
- **Fields/filter:** currency scope (`VND`/`FCY`/`ALL`), bank filter popover, keyword (server-side match `ACCT_NO`/`ACCT_NICK_NM`/`ACCT_NM`); cột hiển thị/thứ tự (View Setting); sort (6 FIELD_ID, `VAS_ACCOUNT` để `SORT_YN='N'`).
- **Actions:** filter onChange → refetch; List (mở View Setting popover §6); Print (`lib/print.ts`); Export Excel (`hooks/useExcelExport`); per-row Balance popover → Sync; Sync History link.
- **API:**
  | Hàm | Method · endpoint | Ghi chú |
  |---|---|---|
  | `fetchAccounts(currency, sort?)` | `GET /api/v1/banking/accounts` | params `currency, bankCd?, keyword?, sortField?, sortDirection?, page?, size?` → `ApiAccountListResponse` |
  | `fetchAccountsByBank(outBankCd)` | `GET /api/v1/banking/accounts/by-bank` | autocomplete bank |
  | export | `POST /api/v1/banking/accounts/export` | View Setting + filter + sort + column config → XLSX blob |
- **Data flow:** mount `useApiData` + `FALLBACK_COLUMNS` seed → filter/sort đổi (deps) → `fetchAccounts` → `mapAccountRow` (snake→camel) → table. Sort: `useTableSort().toggleSort(fieldId)` spread `sortParams`. Lỗi → `ApiCallError` → dialog `error`.

### 3.2. Transaction Sync (OTP / QNA / Captcha) — ✅ Wired
- **File:** `components/banking/account-inquiry/TransactionSyncDialog.tsx`.
- **Chức năng:** chọn tài khoản → chạy engine scraping ngân hàng → cập nhật giao dịch + Last Update; có thể yêu cầu OTP/QNA/Captcha nhiều bước.
- **API:**
  | Hàm | Method · endpoint |
  |---|---|
  | `syncTransactions({account_seq_nos})` | `POST /api/v1/banking/accounts/transactions-sync` |
  | `submitSyncOtp(sessionId, value)` | `POST …/transactions-sync/{sessionId}/otp` |
  | `submitSyncQna(sessionId, body)` | `POST …/transactions-sync/{sessionId}/qna` |
  | `submitSyncCaptcha(sessionId, value)` | `POST …/transactions-sync/{sessionId}/captcha` |
- **Data flow:** `syncTransactions` → response `status`: `COMPLETED` (đóng, refetch accounts) | `OTP_REQUIRED`/`QNA_REQUIRED`/`CAPTCHA_REQUIRED` (hiện form phụ → submit tương ứng → lặp lại status) | `ERROR` (dialog).

### 3.3. Sync History filter — ✅ Wired
- **File:** `SyncHistoryDialog.tsx`. `fetchSyncHistory({fromDt, toDt, currency?, bankCd?, result?})` → `GET /api/v1/banking/sync-history`.

### 3.4. Transaction History — filter + phân loại inline — ✅ Wired
- **Route / file:** `/banking/transaction-history/[accountId]` (+ FCY) · `components/banking/transaction-history/*` (`TransactionHistoryClient/Page/Table`, `ContactSelect`, `VasAccountSelect`, status tabs, type filter).
- **Filter:** date range (`from`/`to` yyyyMMdd), loại GD (`DEPOSIT`/`WITHDRAW`/`ALL`), tab xác nhận (All/Confirmed/Unconfirmed, có count), keyword.
- **Inline edit per cell:** Reporting Account, Purpose, VAS Account, Contact, checkbox Confirm.
- **API (xác nhận từ `lib/api/banking.ts`):**
  | Hàm | Method · endpoint |
  |---|---|
  | `fetchTransactions(acctSeqNo, params)` | `GET /api/v1/banking/accounts/{acctSeqNo}/transactions` |
  | `fetchTransactionsSummary(...)` | `GET …/{acctSeqNo}/transactions/summary` |
  | `fetchTransactionDetail(...)` | `GET …/{acctSeqNo}/transactions/{trnsSeqNo}` |
  | `confirmTransaction(...)` | `PUT …/{trnsSeqNo}/confirm` |
  | `undoConfirmTransaction(...)` | `DELETE …/{trnsSeqNo}/confirm` |
  | `updateTransactionReportingAccount` / clear | `PATCH` / `DELETE …/{trnsSeqNo}/reporting-account` |
  | `updateTransactionPurpose` / clear | `PATCH` / `DELETE …/{trnsSeqNo}/purpose` |
  | `updateTransactionVasAccount` / clear | `PATCH` / `DELETE …/{trnsSeqNo}/vas-account` |
  | `updateTransactionContact` / clear | `PATCH` / `DELETE …/{trnsSeqNo}/contact` |
  - Dropdown nguồn: `GET /api/v1/settings/chart-of-accounts`, `/purpose-settings`, `/vas-account`, `/contacts`.
- **Data flow:** filter/tab/keyword đổi → reset page 1 → `fetchTransactions`. Sửa cell → `update*()` → response trả row mới thay tại chỗ (không refetch toàn bộ). Confirm → cập nhật `CNFM_YN` + refresh count tab.

### 3.5. Smart Organizer match — ✅ Wired
- **File:** `SmartOrganizerDialog.tsx`. `fetchMatchCandidates` (`GET …/{trnsSeqNo}/match-candidates`), `createMatch` (`POST …/match`), `undoMatch` (`DELETE …/match`).

### 3.6. Own Account Transfer — 🟡 Partial
- **Route / file:** `/banking/transfer-own-accounts` · `components/banking/own-account-transfer/*`.
- **Chức năng:** danh sách tài khoản nguồn + refresh số dư qua engine NXiSAS; chuyển khoản cùng chủ.
- **API tiêu biểu:** `GET /api/v1/banking/transfers/own-accounts`, own-account-transfer source/target accounts, `POST …/scraping-result`, NXiSAS decrypt, engine-connection-check. OTP/QNA giống §3.2.

### 3.7. Transfer History filter — ✅ Wired
- **File:** `components/banking/internal-transfer/TransferHistory*`. `fetchTransferHistory({fromDt, toDt, trnsStts?, pageNo?, pagePerCnt?, sort?})` → `GET /api/v1/banking/internal-transfer/transfer-history` (trả totals đa tiền tệ).

### 3.8. Reports — search form (Daily Cash / Daily Financial CMC+HS / Cash Flow)
- **Daily Cash** ✅ — `fetchDailyCashReport({asOfDate, currency?})` → `GET …/reports/daily-cash-report`. Empty state → bấm **Search** mới render.
- **Daily Financial (CMC)** ✅ — `fetchDailyFinancial(...)` → `GET …/reports/daily-financial`; drill-down `GET …/reports/daily-financial/transactions`.
- **Daily Financial (HS)** 🟡 — `fetchDailyFinancialHs(...)` → `GET …/reports/daily-financial-hs` (backend stub; render eager).
- **Cash Flow** ✅ — `fetchCashFlow({year, baseCurrency, usdRate?, krwRate?, bankFilters?})` → `GET …/reports/cash-flow-report`.
- Report KHÔNG có pagination; chỉ filter + Search button.

---

## 4. PAYMENT — chi tiết

> Phần lớn list/detail dùng mock theo project rules; **luồng Excel upload/create đã wire thật**. API qua `lib/api/internalTransfer.ts`, `payment.ts`, `vendorPayment.ts`, `expensePayment.ts`, `payrollPayment.ts`, `approval-box.ts`, `cardTransactions.ts`.

### 4.1. Excel Upload — Internal Transfer (mẫu chuẩn) — ✅ Wired
- **File:** `components/payment/internal-transfer/InternalTransferUploadDialog.tsx` → `payment/shared/PaymentExcelUploadDialog` → `shared/excel-upload/ExcelUploadDialog.tsx` (stackLevel=2).
- **Chức năng:** chọn tài khoản rút → tải template (theo locale) → Browse/Re-Select file → preview validate per-cell → Upload tạo draft.
- **Fields:** picker Withdrawal Bank/Account (bắt buộc); 8–9 cột (Bank Code, Deposit No., Bank, Transfer Amount, Currency, Remarks, Reporting Account, Description, Document No.); error highlight per-cell + tooltip.
- **API (`lib/api/internalTransfer.ts`):**
  | Hàm | Method · endpoint | Request → Response |
  |---|---|---|
  | `fetchWithdrawalAccounts(ccyCd?)` | `GET …/internal-transfer/withdrawal-accounts` | → `ApiWithdrawalAccountRow[]` |
  | `parseInternalTransferExcel(file, bankCd)` | `POST …/internal-transfer/uploads/parse` (multipart `file_data`+`bank_cd`) | → `ApiParseExcelResponse` (`tot_cnt`/`suc_cnt`/`err_cnt`/`lines[]` với `err_fld`/`err_fld_caus`) |
  | `createScheduledTransfer(file, request)` | `POST …/internal-transfer` (multipart `request` JSON blob + `file_data`) | `ApiCreateScheduledTransferRequest` → `ApiCreateScheduledTransferResponse` (`scdul_pymn_no`) |
- **Data flow:** mở dialog → `fetchWithdrawalAccounts` auto-chọn tài khoản đầu → Browse → `parseInternalTransferExcel(file, bank_cd)` → map `ApiParsedTransferLine` → `ExcelUploadRow` (highlight lỗi) → preview 3-table shell → Upload → `createScheduledTransfer` → `scdul_pymn_no` → `onSaved` → điều hướng detail. `errorCount > 0` chặn nút Upload.

### 4.2. Excel Upload — Vendor / Expense / Payroll — ✅ Wired
- **File:** `payment/{vendor-payment|expense-payment|payroll}/*UploadDialog.tsx` (cùng shell, cùng nhịp parse/create). Endpoint đổi tiền tố module: `…/vendor-payment/uploads/parse` + `POST …/vendor-payment` + `…/vendor-payment/withdrawal-accounts` (tương tự expense, payroll).

### 4.3. Excel Upload — Overseas — ✅ Wired
- **File:** `payment/overseas-payment/OverseasExcelUploadModal.tsx`. Khác về API:
  - `POST /api/v1/payment/overseas-payment/excel-preview` (multipart file) → `ApiOverseasPaymentExcelPreview` (`rows`, `total_count`, `completed_count`, `error_count`).
  - `POST /api/v1/payment/overseas-payment/excel-upload` (multipart file + data JSON) → `ApiOverseasPaymentExcelUploadResult` (`ovrs_pymn_no`).
  - Cột riêng (currency, amount, fee_payer, beneficiary_code, memo, reporting_account…).

### 4.4. Request Approval (đa-module) — 🟡 Partial (IT+Vendor+Expense+Payroll+Overseas wired; Card đang chờ)
- **File:** `components/payment/shared/RequestApprovalDialog.tsx` (`kind`: internal-transfer | vendor | expense | payroll | overseas | card).
- **Fields:** General Info (Payment Type read-only, Document No., Payroll Type [Salary/Bonus], Scheduled Date, Total Amount, Withdrawal account, Approval Line dropdown, Approver chips), Approval Content (textarea), Transaction Details (bảng), Attachments (multi-file).
- **API:** load `fetchApprovalLines()` → `GET /api/v1/approval-lines`; `GET …/{module}/withdrawal-accounts`; submit `POST /api/v1/payment/{module}/{id}/request-approval` (Internal Transfer là multipart kèm attachments; payroll thêm `appr_fund_tp` 0/1) → `{ appr_seq_no }`. Card: `POST …/card-transactions/request-approval` gộp nhiều thẻ + `PUT …/card-transactions/{id}/reporting-account` + tree COA.
- **Lỗi:** validate title/account/approval line → dialog `error`; `useBlockedChars(bankCd, pymnType)` tooltip ký tự cấm.

### 4.5. Reporting Account edit (inline) — 🟡 Partial
- **File:** `payment/shared/PaymentDetailPage.tsx`. Click cell → tree COA picker → `PATCH /api/v1/payment/{module}/{id}/lines/{lineId}/reporting-account` `{chart_acct_cd, chart_acct_seq_no}`.

### 4.6. Filter rows (Scheduled / Result / Approval Box / Card) — 🟡 (filter gọi API; row có thể mock)
- **Scheduled list** (`PaymentScheduledBatchListPage`): period preset + date range + status dropdown + search → `GET /api/v1/payment/{module}/scheduled` (`from_date,to_date,appr_type?,srch_wd?,sort_*,page,size`).
- **Result list** (`PaymentResultBatchListPage`): period + date range + checkbox Completed/In-Progress + search → `GET /api/v1/payment/{module}/results` (`trnf_yn`).
- **Approval Box** (`approval-box/FilterBar.tsx`): date range + search → `GET /api/v1/payment/approval-box`.
- **Card Transactions** (`corporate-card/*`): date range + search → `GET /api/v1/payment/card-transactions`.

### 4.7. Exchange Rate Inquiry — 🟡 Partial
- **File:** `payment/overseas-payment/ExchangeRateInquiryPage.tsx`. Bảng ma trận tỉ giá (hàng = currency, cột = loại tỉ giá ngân hàng); contract API đang hoàn thiện.

---

## 5. ADD-ON SERVICE — chi tiết

> API qua `lib/api/addon.ts`, status string qua `lib/api/einvoiceStatus.ts`; scraping qua `lib/nxisas/*`.

### 5.1. Sales / Expenses e-Invoices — filter + export — ✅ Wired
- **Route / file:** `/addon/sales-einvoices`, `/addon/expenses-einvoices` · `addon/sales-einvoices/EInvoicesClient.tsx` (+ `EInvoicesPage`, `InvoiceStatusFilter`); Expenses chỉ khác `type="EXPENSE"` + `translationPrefix`.
- **Fields:** Date Range (preset/manual, wire `YYYYMMDD`), Invoice Status (All/Original/Replacement/Adjustment/Cancelled — **lọc client-side** qua `matchInvoiceStatus()` regex, do backend chưa hỗ trợ param `invoiceStatus` — gap IR-4), Keyword (debounce 300ms, server match 5 cột).
- **Actions:** list (auto), Update (mở modal §5.2), Export list, Export details, Print, sort, pagination.
- **API:**
  | Hàm | Method · endpoint |
  |---|---|
  | `fetchEInvoices({type, from, to, keyword?, status?, page?, size?, sortField?, sortDirection?})` | `GET /api/v1/addon/einvoices` |
  | export list | `POST /api/v1/addon/einvoices/export` |
  | export details | `POST /api/v1/addon/einvoices/export-details` |
- **Data flow:** filter/sort/page đổi → `useApiData` refetch → `mapEInvoiceRow` → camelCase rows. Status: backend trả `einv_invoicestatus` (chuỗi locale GDT) → `matchInvoiceStatus(raw)` suy ra trạng thái logic → lọc trên visible rows. Export gói filter+sort+column hiện tại, backend chạy lại không phân trang.

### 5.2. Update e-Invoice (scrape NXiSAS) — 🟡 Partial
- **File:** `addon/sales-einvoices/UpdateEInvoiceModal.tsx` + `useEInvoiceScrape.ts` + `lib/nxisas/einvoiceScrape.ts`.
- **Fields:** Date Range (bắt buộc, tối đa 1 tháng), checkbox Auto / Auto-close (static). Nút Settings/History inert (chờ Phase 2).
- **Luồng engine + API:** Real-Time Online Inquire → check engine ready → lấy GDT credential (`fetchLoginCredentials`) → re-auth password popup → `revealLoginCredential("gdt", seq, {user_password})` → **Phase 1 INVOICE_LIST**: `runScraping(buildInvoiceListInputs(...))` → `extractScrapedInvoices` → `POST /api/v1/addon/einvoices/scrape-results` → **Phase 2 INVOICE_DETAIL**: `runScraping(buildInvoiceDetailInputs(...))` → `extractScrapedDetails` → `POST /api/v1/addon/einvoices/scrape-detail-results` → `onScraped` → list refetch. Login fail → dừng sau Phase 1.

### 5.3. Operation Status — filter + Update — ✅ Wired
- **Route / file:** `/addon/operation-status` · `OperationStatusClient.tsx` + `OperationStatusPage`.
- **Fields:** Keyword (debounce 300ms, match `COMPANYNAME`/`TAXCODE`), Company Status dropdown.
- **API:** `fetchOperationStatus({q?, companyStatus?, page?, size?, sortField?, sortDirection?})` → `GET /api/v1/addon/operation-status`; `updateOperationStatus(taxCodes?)` → `POST /api/v1/addon/operation-status/update` → `{total_attempted, updated, failed}`.

### 5.4. Inquire Operation Status (GDT) — ✅ Wired
- **File:** `addon/operation-status/InquireOperationStatusDialog.tsx`.
- **Fields:** Tax Code (format `^\d{10}(-\d{3})?$`); Company Name / Address / Status / Last Update (read-only sau khi inquire).
- **API:** `inquireOperationStatus(taxCode)` → `POST /api/v1/addon/operation-status/inquire` (qua bridge GDT/OSMC); `createOperationStatus(body)` → `POST /api/v1/addon/operation-status`.
- **Data flow:** Get Business Info → validate regex → inquire → điền field → Save kích hoạt → `createOperationStatus` → `onSaved` → list refetch. Lỗi `WBE_OPERATION_STATUS_DUPLICATE` → dialog (giữ dialog mở).

---

## 6. SETTINGS — chi tiết

> Mở từ top-nav **Settings** → `SettingsModal` (shell) + `SettingsNav`. **Gần như tất cả panel đã wire API thật** (đã kiểm chứng import + gọi `lib/api`). Popup lồng nhau theo `stackLevel` (1=shell, 2/3/4=child).

### 6.1. Users — ✅ Wired (`lib/api/userManagement.ts`, BASE `/api/v1/settings/users`)
- **File:** `settings/users/UsersPanel.tsx`, `AddUserInfoForm.tsx`, `EditUserInfoForm.tsx`, `UserAvatarUpload`.
- **Fields:** Full Name, Position, Department, Phone (code+number), Email, Login ID (+Check ID), Password + Confirm, Set as Admin, Avatar. Edit: Login ID disabled, Password optional (rỗng = giữ hash cũ).
- **API:** `checkLoginId(loginId)` `GET …/check-id`; `createUserMgmt` `POST …`; `updateUserMgmt(userId)` `PUT …/{userId}`; `deleteUserMgmt` `DELETE …/{userId}`; `uploadUserImage`/`deleteUserImage`/`fetchUserImageBlob` `…/{userId}/image`; menu entitlement `fetchMenuEntitlement`/`saveMenuEntitlement` (`GET/PUT …/{userId}/menu-entitlement`).
- **Lỗi:** lệch password → dialog `error` (`settings.users.error.confirm_mismatch`); Check ID hiện success/error.

### 6.2. Bank Account — ✅ Wired (`lib/api/bankAccount.ts`)
- **File:** `settings/bank-account/BankAccountPanel.tsx`, `EditBankAccountDialog.tsx`.
- **Fields:** Bank/Account/Currency (read-only), Account Type (dropdown, map sang `ACCT_TYPE_CD` theo currency), Nickname (≤20), Description (≤30), Maturity Date, VAS Account picker.
- **API:** `fetchBankAccounts` `GET /api/v1/settings/bank-account`; `updateBankAccount(bankCd, acctNo, body)` `PATCH …/{bankCd}/{acctNo}`; permissions `GET/PUT …` (`type=` kind). Save → `onSaved` → list refetch.

### 6.3. Contacts — ✅ Wired (`lib/api/contacts.ts`, BASE `/api/v1/settings/contacts`)
- **File:** `settings/contacts/ContactsPanel.tsx`, `AddNewContactDialog.tsx`, `ExcelUploadDialog`.
- **Fields:** Contact Code, Name, Type (Local/Overseas), Phone, Fax, Tax ID, bank/account, Address; Overseas thêm Swift/Correspondent; Attachments.
- **API:** `fetchContacts`/`fetchContact`, `createContact` `POST`, `updateContact` `PUT /{trcoKey}`, `deleteContact` `DELETE /{trcoKey}`, `bulkDeleteContacts` `POST /bulk-delete`, `bulkImportContacts`/`preflightContactsImport`/`resolveContactsImportRecipients`, `fetchContactBanks` `/banks`, file: `listContactFiles`/`uploadContactFile`/`deleteContactFile`, `exportContacts`.
- **Lỗi:** đang dùng (in-use) → `WBE1190`.

### 6.4. Approval Line — ✅ Wired (`lib/api/approvalLine.ts`, BASE `/api/v1/settings/approval-line`)
- **File:** `settings/approval-line/ApprovalLinePanel.tsx`, `ApprovalLineDialog.tsx`, `AddApproverPopover.tsx`.
- **Fields:** Approval Line Name, danh sách approver (tối đa 5, có thứ tự).
- **API:** `fetchApprovalLines`/`fetchApprovalLine`, `createApprovalLine` `POST`, `updateApprovalLine` `PUT /{apprLineNo}` (diff-sync), `deleteApprovalLine` `DELETE /{apprLineNo}`; tìm user: `fetchTenantUsers(q)` (`lib/api/users.ts`) → `GET /api/v1/users?q=`.

### 6.5. Chart of Accounts — ✅ Wired (`lib/api/chartOfAccounts.ts`, BASE `/api/v1/settings/chart-of-accounts`; có `mockData.ts` fallback)
- **File:** `settings/chart-of-accounts/*`, `ExcelUploadDialog.tsx`.
- **Fields:** Account Code, Name (EN), Parent (tree picker), Account Type, Description. Restricted roots `ACC-01/02/03` không sửa/xoá.
- **API:** `fetchChartOfAccounts`/`fetchChartOfAccountsTree` (`/tree`)/`fetchChartOfAccount`, `createChartOfAccount` `POST`, `updateChartOfAccount` `PUT /{seqNo}`, `deleteChartOfAccount` `DELETE /{seqNo}`, bulk: `bulkCreateChartOfAccounts`/`bulkDeleteChartOfAccounts`/`bulkDeactivateChartOfAccounts` (Excel import).
- **Lỗi:** `WBE_CHART_OF_ACCOUNTS_*` (duplicate code, parent not found, restricted, cycle, depth, self-parent).

### 6.6. Purpose — ✅ Wired (`lib/api/purposeSettings.ts`, BASE `/api/v1/settings/purpose-settings`; có `mockData.ts`)
- **File:** `settings/purpose/PurposePanel.tsx`, `PurposeFormRow.tsx`, `ParentPurposePicker`.
- **Fields:** Purpose Code, Name, Parent (tree), thứ tự (reorder).
- **API:** `fetchPurposeSettings`/`fetchPurposeSetting`, `createPurposeSetting` `POST`, `updatePurposeSetting` `PUT /{useUsagCd}`, `deletePurposeSetting` `DELETE /{useUsagCd}`, `reorderPurposeSettings` `PUT …/order`, Excel: `downloadPurposeTemplate`/`previewPurposeExcel`/`importPurposeExcel`.

### 6.7. VAS Account — ✅ Wired (`lib/api/vasAccount.ts`, BASE `/api/v1/settings/vas-account`)
- **File:** `settings/vas-account/*`, `AddVasAccountDialog`, `ExcelUploadDialog`.
- **API:** `fetchVasAccounts`/`fetchVasAccount`, `fetchVasAccountLookup` `/lookup`, `createVasAccount` `POST`, `updateVasAccount` `PUT /{seqNo}`, `deleteVasAccount` `DELETE /{seqNo}`, Excel: `downloadVasAccountTemplate`/`previewVasAccountExcel`/`importVasAccountExcel`.

### 6.8. Login Credentials — ✅ Wired (`lib/api/loginCredentials.ts`, BASE `/api/v1/login-credentials` — **không** phải `/settings/...`)
- **File:** `settings/login-credentials/LoginCredentialsPanel.tsx` + `shared/popups/` (`RegisteredLoginCredentialsDialog`, `LoginIdPasswordDialog`, `EditLoginIdPasswordDialog`, `SelectBankDialog`, `SelectBankAccountsDialog`, `PasswordConfirmationDialog`, `GdtCredentialsDialog`).
- **API:** `fetchLoginCredentials` `GET …`; bank: `createBankLoginCredential` `POST`, `updateBankLoginCredential` `PUT`, `verifyBankPasswordUpdate` `POST`; GDT: `createGdtLoginCredential`/`updateGdtLoginCredential`; `deleteLoginCredential` `DELETE`; `revealLoginCredential(credType, seqNo, {user_password})` `POST …/reveal`; `fetchLoginCredentialAuditLogs` `GET …/audit-logs`; picker: `fetchLoginCredentialBanks`/`fetchLoginCredentialBankFormInfo`.
- **Data flow:** Reveal → `PasswordConfirmationDialog` → `revealLoginCredential` → hiện plain text. Add → SelectBank → LoginIdPassword → create.

### 6.9. Preferences — ✅ Wired (`lib/api/preferences.ts`, BASE `/api/v1/settings/preferences`)
- **File:** `settings/preferences/PreferencesPanel.tsx` (read/edit toggle).
- **API:** `fetchPreferences` `GET`, `updatePreferences` `PUT`, logo: `uploadPreferencesLogo` `POST …/logo` (multipart), `deletePreferencesLogo` `DELETE …/logo`, `fetchPreferencesLogoBlob` `GET …/logo`.

### 6.10. Firm Banking Settings — ✅ Wired (`lib/api/firmBankingSettings.ts`, BASE `/api/v1/settings/firm-banking-settings`)
- **File:** `settings/firm-banking-settings/*` (automation toggles, linked accounts, `NewFirmBankingDialog`, `FirmBankingDetailsDialog`).
- **API:** `fetchFirmBankingSettings` `GET`, `fetchFirmBankingSetting` `GET /{outBankCd}/{wdrlActNo}`, `fetchFirmBankingSettingAudit` `…/audit`, `createFirmBankingSetting` `POST`, `updateFirmBankingSetting` `PUT /{outBankCd}/{wdrlActNo}`, `deleteFirmBankingSetting` `DELETE …`.

### 6.11. Firm Banking History — 🔵 Read-only (`lib/api/firmBankingHistory.ts`)
- **File:** `settings/firm-banking-history/*` (filters + detail popover). `fetchFirmBankingHistory(filters)` → `GET /api/v1/settings/firm-banking-history` + export. Service type render qua i18n key (`svc_type_key`).

### 6.12. ERP Transaction History — 🔵 Read-only (`lib/api/erpTransactionHistory.ts`)
- **File:** `settings/erp-transaction-history/*` (tabs + filters). `fetchErpTransactionHistory(...)` → `GET /api/v1/settings/erp-transaction-history`; download `getErpTransactionHistoryDownloadUrl(seqNo)`.

### 6.13. View Setting popover (dùng chung mọi list page) — ✅ Wired (`lib/api/screenOption.ts`)
- **File:** `components/shared/view-setting/ViewSettingPopover.tsx` + `useViewSetting(screenId, dymAreaId)`.
- **Chức năng:** bật/tắt + sắp xếp cột của bảng; lưu theo `WEB_SVC_ID` (registry `lib/viewSettingScreens.ts`). Cột đặc biệt `CHECKBOX`/`ETC` không sửa/ẩn.
- **API:** `fetchScreenOptions` `GET /api/v1/screen-options/{screenId}/{dymAreaId}`; `fetchScreenAreas` `GET …/{screenId}/areas`; `saveScreenOptions` `PUT …/{screenId}/{dymAreaId}`; `resetScreenOptions` `DELETE …/{screenId}/{dymAreaId}`.
- **Data flow:** mở (anchor theo icon List) → render cột từ `vs.items` → reorder/toggle (local) → Save → `PUT` → bảng refetch; Restore Defaults → `DELETE`; Cancel/ESC/outside → bỏ thay đổi.

---

## 7. Phụ lục

### 7.1. Mã lỗi thường gặp (frontend hiển thị qua `useDialog error` + `trace_id`)

| Code | Ý nghĩa |
|---|---|
| `WBI0000` | Success |
| `WBE1009` | Sai ID/mật khẩu (hoặc user không thuộc tenant) |
| `WBE1010` / `WBE1011` / `WBE1128` | Chưa kích hoạt / Khoá / Đã xoá |
| `WBE2091` | Mật khẩu hiện tại sai (change password) |
| `WBE_CHANGE_PASSWORD_REUSED` | Mật khẩu mới trùng lịch sử |
| `WBE1190` | Contact đang được dùng (không xoá được) |
| `WBE_CHART_OF_ACCOUNTS_*` | Lỗi nghiệp vụ Chart of Accounts (duplicate/parent/restricted/cycle/depth/self-parent) |
| `WBE_OPERATION_STATUS_DUPLICATE` | Trùng `(BIZ_KEY, TAXCODE)` khi lưu Operation Status |
| `WBE_VALIDATION` | Lỗi bean-validation |
| `WBE_NETWORK` / `WBE_CLIENT_PARSE` | Lỗi mạng / parse response (chỉ phía client) |
| `WBE9999` | Lỗi server không xác định |

### 7.2. Endpoint index (theo domain)

- **Auth:** `/api/v1/auth/{login,logout,me,change-password}`
- **Banking:** `/api/v1/banking/{accounts, accounts/by-bank, accounts/{id}/transactions[/summary|/{trns}/...], sync-history, accounts/transactions-sync[/{sid}/{otp|qna|captcha}], transfers/own-accounts, internal-transfer/transfer-history, reports/{daily-cash-report|daily-financial[/transactions]|daily-financial-hs|cash-flow-report}}`
- **Payment:** `/api/v1/payment/{internal-transfer|vendor-payment|expense-payment|payroll|overseas-payment}/{withdrawal-accounts, uploads/parse, "", scheduled, results, {id}/request-approval, {id}/lines/{lineId}/reporting-account}`, `overseas-payment/{excel-preview,excel-upload}`, `approval-box`, `card-transactions[/request-approval]`, `/api/v1/approval-lines`
- **Add-on:** `/api/v1/addon/{einvoices[/export|/export-details|/scrape-results|/scrape-detail-results], operation-status[/inquire|/update]}`
- **Settings:** `/api/v1/settings/{users, bank-account, contacts, approval-line, chart-of-accounts, purpose-settings, vas-account, preferences, firm-banking-settings, firm-banking-history, erp-transaction-history}`, `/api/v1/login-credentials`, `/api/v1/users`, `/api/v1/screen-options/{screenId}/{dymAreaId}`

### 7.3. Lưu ý / khoảng trống đã biết

- **e-Invoice status filter** lọc client-side (`lib/api/einvoiceStatus.ts` regex) vì backend chưa hỗ trợ param (gap IR-4).
- **Payment list/detail**: nhiều trang dùng mock theo project rules; chỉ Excel upload/create (Internal Transfer rõ nhất) đã wire.
- **Daily Financial (HS)**: backend stub, frontend có mock seed.
- **Operation Status**: action Update đã wire; một số luồng inquire-save còn phụ thuộc bridge GDT.
- Tài liệu xử lý dữ liệu phía backend: xem `wecms-api/docs/features/**` và `wecms-api/docs/references/api-spec/**`.

---

*Source-verified từ codebase ngày tạo. Khi code đổi, cập nhật lại file này.*
