# e-Sign Boards MVP — Product Documentation
**Webcash Vietnam · "Boards" module (e-Sign)**

Source file: `eSign_Boards_MVP.html` — a single HTML/CSS/JS file, runs entirely in the browser, no server or installation required.

---

## 1. Introduction

e-Sign Boards is a module for managing **internal approval & digital signing workflows** for accounting/finance documents, integrated into the Webcash platform alongside the Sales, Expenses, Banking, Payroll, and Reports modules.

Core idea: each document type (vendor payment, receipt/payment voucher, quotation...) is attached to a **Workflow Template** — a predefined blueprint of the input form, the number of approval levels, who approves at each level, whether digital signing is required, and any automatic steps (task assignment, email notification) before/after approval. Users simply pick a template, fill in the form, and submit; the system automatically pushes the document through each approval level until completion, recording the full history in an **Audit Log** that cannot be edited or deleted.

**This is an MVP demo**: all data (users, documents, templates, logs...) is seeded in JavaScript and only lives for the current browser session — reloading the page or clicking "Reset demo data" resets everything to its initial state. See section 7 for exactly what is simulated (i.e. not backed by a real backend).

---

## 2. Core concepts

| Concept | Explanation |
|---|---|
| **Source (Lane)** | Documents come from one of 3 sources: **WeCMS**, **Misa AMIS**, **Others** (labeled "General" when creating a request). Each source has its own set of templates. |
| **Workflow Template** | The flow design for one document type: input Form → one or more Approval/Sign levels → (optional) automatic Task/Email → End. Status: **Draft** (being designed), **Active** (usable to create new documents), **Inactive** (disabled). |
| **Request** | A specific document created from a template. Status: **Draft** (not submitted) → **Approved/Signed** (running through the levels, or fully completed) → can become **Rejected** (rejected at any level, or revoked by an Admin). |
| **Approval level (Step)** | Each level has one or more approvers plus a completion rule if there are multiple approvers: **Unanimous** (everyone must approve), **Any** (only 1 needed), **Majority**. The method is either **Internal approval** or **Digital sign** (USB Token/HSM — mocked). |
| **Task / Email (automatic)** | A block that runs automatically once the flow reaches it, with no human action needed (e.g. sending a notification email to accounting after approval completes). |
| **Delegation** | A user can delegate the requests waiting for their approval to someone else over a date range (while away). The delegate sees these requests under "Delegated to me"; the log clearly records who acted on whose behalf. |
| **Undo** | Reverts a completed approval/rejection step back to pending. **Admin only.** |
| **Revoke** | Invalidates a document that has **already been fully signed** (moves it straight to Rejected). **Admin only**, and only if the template allows it. |
| **Audit Log** | An append-only log: every create/submit/approve/sign/reject/undo/revoke action is recorded and can never be edited or deleted. |
| **Entitlements** | The per-user access-permission matrix for each menu section (Boards, Banking, Payment, Add-on, Settings...), managed under Settings > Users. Only Admins can edit it. |

---

## 3. Overall screen layout

- **Top bar**: logo, module tabs (Sales/Expenses/Banking/Payroll/Reports/**Boards** — currently active), language switcher (VI/EN, globe icon), Refresh, Notifications (bell, with a count badge), Avatar (opens Settings).
- **Left sidebar**: 3 menu groups — **Approval Box** (My Request / To Approve / Done), **Workflow Template** (WeCMS / Other / MISA), **Audit Log**.
- **Main area**: page title + Add button, with content below depending on the selected screen (KPI cards, table, filters, pagination).
- There are 3 separate full-screen overlay pages: **Request Detail**, **Workflow Builder**, **Settings** — these open over the entire interface and close via the X button or the Esc key (an "Esc" hint chip is shown in the top-right corner).

---

## 4. Screen-by-screen guide

### 4.1 Approval Box

The sidebar has 2 main sections, each split into sub-filters:

- **My Request**: documents created by the current user that are still in progress (draft or not yet completed). Once completed or rejected, they automatically move to the Done tab.
- **To Approve**: documents waiting for the current user to approve/sign, split into 2 sub-filters:
  - *Assigned to me*: the current user is the designated approver.
  - *Delegated to me*: the current user is approving on behalf of someone else (via delegation).
- **Done**: history of completed documents, split into 2 sub-filters:
  - *My Requests*: documents the current user created that are completed/rejected.
  - *I Approved*: documents the current user has acted on (approve/sign/reject) at any level.

Above the table are **KPI cards** (ALL, Draft, Approved/Signed, Rejected...) — click one to quickly filter by status. The toolbar has a **Source** filter and a **search box** (by code, title, creator). The table supports **sorting** by column (click the column header) and **pagination** (10/25/50/100 rows). Hovering a row shows a floating "eye" icon on the right to quickly open the **Request Detail**.

### 4.2 Request Detail (full-screen popup)

Two-column layout:

- **Left column (main)**: general information (workflow, document type, amount, creator, created date, retention, number of approval levels, who is currently awaited), the submitted form data, digital signature info (if signed — mocked: signer, signed time, VNPT-CA provider, serial, SHA-256 hash, TSA timestamp), and the **approval flow** as a timeline (each level clearly shows the approver, method, status, timestamp, and note).
- **Right column**: the **Comments** feed — combining the Audit Log entries related to this document with free-form user comments, sorted by most recent, with an input box at the bottom to add a new comment.

Action buttons (shown/hidden depending on role and status):

- **Approve / Sign & Approve / Reject**: shown only if the current level is awaiting the current user (or someone they are acting on behalf of).
- **Submit for approval**: for a Draft document, by its creator.
- **✎ Edit**: for a Draft or Rejected document, by its creator — reopens the Create/Edit popup with the existing data.
- **↩ Undo outcome**: always shown if there is a processed step and the template allows Undo, but only an **Admin** can click it — other users see it disabled with an explanatory tooltip.
- **⊘ Revoke**: shown only when the document has been **fully signed** and the template allows Revoke; also Admin-only, other users see it disabled.
- If the creator happens to be the approver at the current level (a segregation-of-duties violation), the system shows a warning and hides the Approve/Sign/Reject buttons.

### 4.3 Create / Edit Request (popup)

Opened via the **Add** button in the top-right (while in Approval Box). The popup is nearly full-screen and does not close on backdrop click (must use the Close button or Esc). It contains:

1. Choose the **Source** (Others / Misa tab).
2. Choose an Active **Workflow Template** in that source.
3. Enter the **Title** and the **form fields** defined by the template (text, money, date, select list, long text, or file attachment — a native-style "Choose file" button, mocked, no real upload).
4. Preview the list of **Approvers** per level (as round chips) — approvers were already fixed when the template was designed in the Workflow Builder, so they aren't re-selected here.
5. **Save draft** or **Submit for approval** (required fields are validated before submission).

### 4.4 Workflow Template (list)

A table listing all templates for the source currently selected in the sidebar (WeCMS/Other/MISA), with KPI cards by status (Draft/Active/Inactive), search, and column sorting.

- The last column, **Active** (pinned right on horizontal scroll), is a quick toggle switch between Active ⇄ Inactive (shown only for non-Draft templates).
- Selecting multiple rows (checkbox, first column pinned left) shows a **bulk actions bar**, following a strict rule: selecting **only Draft** rows → shows only the **Delete** button; selecting **only Active/Inactive** rows → shows only **Activate/Deactivate**; a **mixed** selection of both groups → shows no actions at all, with an explanatory note asking to narrow the selection.
- The **Add** button at the top opens a popup to name the template and pick its source/document type, then opens directly into the **Workflow Builder** to design the flow in detail.

### 4.5 Workflow Builder (flow design — full screen)

Made up of 3 areas:

- **Left column (palette)**: blocks that can be dragged onto the canvas — **Form** (the start block, always exactly one), **Approval** (internal approval), **Sign** (USB Token/HSM digital signature). **Task** and **Email** blocks are not dragged manually; they're added automatically during configuration (labeled "Added automatically").
- **Center canvas**: drag-and-drop blocks, drag connector lines from the port dots on a block's edge, click a line label to switch between Approve/Reject/Sign, drag a line label onto an Approval/Sign block to create a separate **Undo/Revoke branch** (this label automatically "flashes" for 3 seconds when a new Approval/Sign block is added, as a discoverability hint). Supports zoom, snap-to-grid, and Delete to remove the selected block.
- **Right column (settings for the selected block)**:
  - **Form** block: a field designer — for each field, choose the Type first (text/money/date/select list/long text/file), then the field Label, then check Required; the delete-field button is a small circular X icon; the "+ Add field" button is a full-width dashed-border ghost button.
  - **Approval/Sign** block: a slider to choose the **number of approval levels** (1–5; choosing more than 1 automatically splits it into sequential levels), select the **approver(s)** per level, the **completion rule** when a level has multiple approvers, and the SLA (minutes).

Top toolbar: a live count of the total approval levels, **Undo** (undoes a design action) → **Form Preview** → **Save draft** → **Submit** (saves for real, moves the template to Active).

Note: only templates that are currently **Active** are locked from editing (view-only); **Draft** and **Inactive** templates can still be opened and edited in the Builder normally.

### 4.6 Audit Log

A system-wide append-only log table: time, actor, action, object (document code), detail. There are no edit/delete actions on this screen — true to its "append-only" nature.

### 4.7 Settings (full-screen overlay)

Opened via the avatar in the top-right of the top bar. It has its own sidebar with: Purpose, VAS Account, Contacts, Login Credentials, Bank Account, Preference (all simulated placeholders), **Users**, **Delegation**, Transaction History, Firm Banking..., and a **"Reset demo data"** button at the bottom.

- **Users (User Management)**: user list on the left (searchable by name/email); selecting a user shows a panel on the right with 2 tabs:
  - *Info*: full name, position, role (User/Admin), and a **"Log in as this user (demo)"** button to switch which role is currently acting throughout the app.
  - *Entitlements*: a detailed permission tree by module (Boards, Banking, Payment, Add-on Service, Settings...) — only an **Admin** can toggle these; other users see it locked with a note.
- **Delegation**: each user sets up their own approval delegation to someone else over a date range (From – To), can view its status (Active/Upcoming/Expired), and can revoke it at any time.

### 4.8 Notifications panel

Opened via the bell icon in the top bar (with a red dot showing the unread count). Slides in from the right, split into 2 groups: **Waiting for you** (requests awaiting your approval/signature) and **Recent updates** (log entries related to requests you're following). Clicking a notification opens the corresponding Request Detail directly.

---

## 5. Main business flow (User Flow)

1. **Design the flow**: an Admin/manager goes to Workflow Template → Add → names it and picks its source/document type → opens the Workflow Builder → drags in Approval/Sign blocks, configures the number of levels + approvers + rule, designs the Form (input fields) → Save draft or Submit (Active).
2. **Create a document**: a user goes to Approval Box → Add → picks a source + an Active template → fills in the form → Save draft (not yet in the flow) or Submit for approval (starts running through the levels).
3. **Automation at the start/end of the flow**: if the template has Task/Email blocks at the start or end, the system runs them automatically as soon as the flow reaches them (no human action needed), then stops at the nearest Approval/Sign level awaiting an approver.
4. **Approve level by level**: the designated approver sees the document under "To Approve" → opens the Detail → Approve/Sign/Reject. If a level has multiple approvers, the system automatically checks whether the level is complete per the rule (Unanimous/Any/Majority); if not yet met, the document stays waiting for the remaining approvers.
5. **Delegation while away**: if an approver has set up a Delegation to someone else (Settings > Delegation), the delegate sees the document under "Delegated to me" and acts on it; the Audit Log clearly records "(acted on behalf of <name>)".
6. **Completion**: once the final level is approved/signed, the document moves fully to Done with status Approved/Signed.
7. **Fixing mistakes (Admin)**: if a completed approval/rejection step needs to go back to pending, an Admin clicks **Undo**; if a fully signed document needs to be invalidated entirely, an Admin clicks **Revoke** (moves it to Rejected).
8. **Tracking & discussion**: every action is recorded in the Audit Log; involved users can discuss via **Comments** directly in the Request Detail screen — both are shown together on one combined timeline.

---

## 6. Available demo accounts

| ID | Name | Position | Role | Rank |
|---|---|---|---|---|
| u1 | An Nguyễn | Accounting staff | User | 1 |
| u2 | Bình Trần | Department head | User | 2 *(default login when the app opens)* |
| u3 | Chi Lê | Chief accountant | **Admin** | 3 |
| u4 | Dũng Phạm | Director / Legal rep | User | 4 |

Switch roles to test different permissions (especially Undo/Revoke/Entitlements — Admin only): Settings (top-right avatar) → Users → select a user → "Log in as this user (demo)".

---

## 7. Important notes before using / demoing (MVP limitations)

- This is a prototype that runs **entirely on the client side**, with no real server/database — all data (documents, templates, logs, delegations...) exists only in the current browser session's memory. Reloading the page or clicking "Reset demo data" reloads the exact original seed data; any edits from the previous session are lost.
- The following actions are **simulated only** (a toast notification appears, with no real effect): uploading attachments to a server, digital signing via USB Token/HSM, sending real emails, exporting to Excel, printing, and the "Purpose/VAS Account/Contacts/Login Credentials/Bank Account/Preference/ERP/Firm Banking" items in Settings.
- "Logging in" is only a simulated role switch for the demo; there is no real authentication mechanism.
- The trial plan is capped at 5 users — the "Add a user" button only shows a simulated notification and doesn't actually create a new user.
- **Known logic issue, not yet fixed**: when a level has multiple approvers and an Admin clicks **Undo**, the approvals of **all** approvers at that level are cleared back to "not yet approved" at once, instead of only clearing the most recent approver's vote. Keep this in mind when demoing flows with multi-approver levels.

---

## 8. Quick demo script (5 minutes)

1. Open the app (default login is **Bình Trần** — User). Go to **Workflow Template > WeCMS**, review the available templates (t1, t6, t9...).
2. Go to **Approval Box > My Request**, click **Add**, choose the **Misa** source, pick an Active template, fill in a sample form, click **Submit for approval** — observe the toast reporting the new document code.
3. Switch to the **To Approve** tab, open the detail of the document just created (if the level-1 approver in the demo template matches the currently logged-in user) → click **Approve** → watch the flow move to the next level and the Comments feed update.
4. Go to **Settings > Users**, switch to **Chi Lê (Admin)** to see the difference: the Undo/Revoke buttons in Request Detail change from disabled to clickable; open the Entitlements tab to view/edit permissions.
5. Back in **Workflow Template**, try selecting one Draft row and one Active row at the same time — observe the bulk actions bar reporting a "mixed selection" and hiding all buttons, illustrating the exact business rule.
6. Open the **Workflow Builder** for a Draft/Inactive template to see the drag-and-drop blocks, the approval-level slider configuration, and the Form field designer.
