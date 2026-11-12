# WeInvoice — Test Scenarios (P1 static UI)

**Status: CURRENT** · Specification, not evidence — results of an actual run live in
[docs/testing/results/](../../testing/results/README.md).

Environment: `npm run dev` → `http://localhost:3000` with the backend running at
`NEXT_PUBLIC_API_BASE_URL`; log in with a backend account. Invoice data is the
deterministic mock seed (resets on reload). Working MST at start: `0109876543`.

| # | Area | Scenario | Expected |
|---|---|---|---|
| 1 | Auth | Open `/invoices/purchase` without logging in | Redirect to `/login?next=/invoices/purchase`; after login, land on that page |
| 2 | Auth | Log in with a wrong password | Inline backend message + code, e.g. "… (WBE1009)"; no redirect |
| 2b | Auth | Backend stopped | "Không kết nối được máy chủ…" |
| 2c | Auth | Account linked to 2+ companies | Company list; picking one finishes login |
| 2d | Auth | Token revoked / expired, then reload a page | Back to `/login?next=…` |
| 3 | Auth | Logout from the avatar menu | Back to `/login`; protected routes redirect again; language choice kept |
| 4 | Shell | Switch language VI → EN → KO in the header | All labels change; choice survives reload |
| 5 | Shell | Switch working MST in the header | Toast; dashboard / lists / checks re-scope to the new MST (§3.1) |
| 6 | Shell | Ctrl+K | Command palette opens; typing a screen name navigates |
| 6b | Shell › Notifications | Bell with unread items; 0 unread; > 99 unread | Red badge with the number; no badge at 0; "99+" above 99. Bell hidden below 640 px |
| 6c | Shell › Notifications | Open the bell; switch chips MST đang làm việc · Tất cả MST · Cần xử lý | Panel "Thông báo" ~400 px with scroll; default chip = working MST; api mode sends `filter=mst&company_mst=<MST>` / `filter=all` / `filter=action`; empty → "Chưa có thông báo"; failure → "Không tải được thông báo" + Thử lại |
| 6d | Shell › Notifications | Click a "N hóa đơn bán ra mới" item of another MST; a GDT password error; a mailbox error | Item marked read, badge decreases; working MST switches (toast) and `/invoices/sales` opens; `/sources/gdt`; `/sources/mailbox` |
| 6e | Shell › Notifications | "Đánh dấu đã đọc tất cả" on each chip; "Xem tất cả thông báo" | All shown items read (working-MST chip: only that MST); next 20 items appended; footer gone when all loaded |
| 6f | Shell › Notifications | Leave the tab in the background > 60 s, come back | No badge requests while hidden; one request on return, then every 60 s |
| 7 | Dashboard | Open `/dashboard` | KPI cards and charts for the working MST; incomplete-period banner for 10/2026 (§3.6) |
| 7b | Dashboard | `NEXT_PUBLIC_WEINVOICE_DATA_SOURCE=api`, open `/dashboard` | Request `GET /api/v1/weinvoice/dashboard?company_mst=<MST>&year=2026`; while the endpoint is missing: error card "Không tải được dữ liệu tổng quan" + code + Thử lại |
| 8 | Invoices | Open purchase list, default period | Rows shown, KPIs, pagination (10/20/50/100) |
| 9 | Invoices | Filter: XML missing, PDF missing, status, kind (MTT / no code), tag, provider, partner exclude, keyword | Rows narrow accordingly; selection + page reset |
| 10 | Invoices | Provider pill ↗ on a MISA invoice with a lookup code | Opens the MISA lookup page with the code (direct); other providers open their generic lookup page |
| 11 | Invoices | BKAV invoice (no lookup code) | Pill shows `!`; entering a code or a full lookup link saves it (§3.4) |
| 12 | Invoices | Row click → detail modal | Tabs: summary / items / file record with origin + time (§3.5) |
| 13 | Invoices | Delete a GDT / provider file in the file record | Not allowed; uploaded / email files can be deleted |
| 14 | Invoices | Attach a non-PDF file as PDF | Rejected; a PDF that cannot be matched asks "Vẫn đính kèm" (§3.5) |
| 15 | Invoices | Excel with GDT invoices missing XML | Prompt "Lấy XML còn thiếu" first; Excel itself reports "not available in this build" |
| 16 | Invoices | Download ZIP (each of the 5 packaging modes) | ZIP downloads with the chosen structure |
| 17 | Sources | Add a GDT connection with an invalid MST / short password / 6th MST | Matching error; quota 5 enforced |
| 18 | Sources | Upload an XML whose key already has XML / has no XML / is new / belongs to another MST / is malformed | Trùng — bỏ qua / Ghép XML / Tạo mới / Không thuộc MST (+ add MST, needs password) / Lỗi (§3.2) |
| 18b | Sources › Mailbox | `/sources/mailbox`: click each of the 4 tiles (Gmail · Outlook / Microsoft 365 · Company mail (IMAP) · Forwarding) | Each tile shows its own panel; header shows the working MST and the read-only pill; works at 375 px (tiles wrap) |
| 18c | Sources › Mailbox | Gmail: normal Gmail password; IMAP: blank server / port 0 | "16 chữ cái" message; "Nhập máy chủ IMAP hợp lệ" / "Cổng là số từ 1 đến 65535"; nothing sent |
| 18d | Sources › Mailbox | api mode: Check and connect with a wrong password | Server message in the form; nothing saved; password field cleared |
| 18e | Sources › Mailbox | api mode: Sign in with Microsoft → consent → back | Browser leaves for Microsoft; returns to `?ms=ok` (toast) or `?ms=error&reason=…` (dialog); query removed; list reloaded. Server without Microsoft config → info dialog |
| 18f | Sources › Mailbox | Connected list: Scan now / Edit (blank password) / Disconnect / expired Microsoft row | Toast with invoices found; edit keeps the stored password; confirm then row removed; expired row offers "Đăng nhập lại" |
| 18g | Sources › Mailbox | Forwarding tile on a server without a mail domain | "Máy chủ chưa cấu hình tên miền nhận email…" |
| 19 | Sync | Run a sync for a connected MST | Steps login → captcha → list → XML → done; history row added; incomplete banner cleared |
| 20 | Sync | Run a sync for the expired MST `0401234567` | Fails with login error in history |
| 21 | Checks | Invoice check for 10/2026 | Partner findings with reasons + VAT at risk; 3 review sections (§3.7) |
| 22 | Checks | Supplier risk | Status / name-address match / abnormal VAT rate findings; simulation banner visible |
| 23 | Tools | Taxpayer lookup with 101 MSTs | Rejected (max 100); valid run shows Safe / Review / Not checked summary |
| 24 | Tools | XML viewer: drop an XML | Parsed view; "import" uses the same de-dup outcomes as Upload |
| 25 | Tax | Filed returns: connect with a wrong captcha | Captcha error; password never shown again (§3.8, §3.10) |
| 26 | Tax | Auto journal TT200 vs TT133 | 2 lines per invoice; 642 vs 6422; cancelled / replaced skipped; user rule overrides default (§3.9) |
| 27 | Settings | Create / rename / delete a tag | Invoice tags follow; deleting detaches from invoices |
| 28 | Settings | Sub-account: invite with a permission template, lock / unlock | Status Đã mời / Hoạt động / Khoá (§3.10) |
| 29 | Roadmap | Open `/tax/vat-return`, `/reports/listing`, `/tools/pdf-merge`, `/settings/plan` | Intro page only, phase badge in sidebar |
| 30 | Responsive | 375 / 768 / 1024 / 1440 | Sidebar becomes a drawer < lg; tables scroll horizontally; no page-level horizontal scroll |
