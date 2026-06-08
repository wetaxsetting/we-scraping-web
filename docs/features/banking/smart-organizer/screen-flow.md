# Smart Organizer — Screen Flow (Frontend)

User journeys and interaction flows for the Smart Organizer page and its Organizer Settings dialog.
Source of truth: JEX `fnsh_0200_001`/`fnsh_0200_002`
([docs/jex/features/smart-organizer/business-flow.md](../../../../../docs/jex/features/smart-organizer/business-flow.md)).

---

## 1. Entry

```
Transaction History (VND or FCY) grid
      │  user clicks the "Smart Organizer" toolbar button
      ▼  (SmartOrganizerButton → Link href=/banking/smart-organizer?account={bankCd}_{acctNo})
Smart Organizer page  (account context carried in the query string)
```

- The launch button lives in the Transaction History toolbar (`SmartOrganizerButton.tsx`); it encodes
  the currently-selected account as `account={bankCd}_{acctNo}`.
- On mount `SmartOrganizerPage` parses `?account=` from `window.location` (client-only — keeps the
  route prerender-safe). If absent/malformed it shows the empty state and **does not fetch** (R11 — no
  tenant-wide listing).

## 2. Eligibility review flow

```
parse ?account → { bankCd, acctNo }
      ▼
default date range = Jan 1 … Dec 31 of current year
      ▼
GET /eligible (bank_cd, acct_no, from_dt, to_dt, q, sort_field, sort_dir, page, size)
      ▼
render two-section grid (Bank Transaction Data | Confirmation)
      ▼
user adjusts filters (date range / keyword / column sort) → refetch
      ▼
user reviews proposed classification per row
```

- Fetch is keyed on `account, startDate, endDate, search, sortField, sortDirection, refreshKey`; a
  request counter ignores stale responses; `useStickyLoading` prevents an empty-flash on fast responses.
- Each row arrives pre-filled with the matched rule's proposal (reporting account, purpose, VAS,
  contact) rendered as resolved **display names** (R07), and amounts formatted by `ccy_cd` (R06).

## 3. Selection + confirm flow

```
user ticks per-row checkboxes (or select-all on the page)
      ▼  selection footer appears: [Cancel]  [Save (n)]
user clicks Save
      ▼
POST /confirm { bank_cd, acct_no, rows:[{acct_seq_no, use_usag_cd?, vas_acct_seq_no?, trco_key?, chart_acct_cd?, chart_acct_seq_no?}] }
      ▼
success dialog "confirmed n" → clear selection → bump refreshKey → list refetches (confirmed rows drop out)
      │
      └─ error → dialog with error code + message (e.g. already-confirmed, not-found)
```

- Save is disabled unless ≥1 row is selected and `account` is present.
- `useStickyLoading` gates the saving state. The whole batch is transactional server-side.

## 4. Organizer Settings (rule CRUD) flow

```
page → click "Organizer Settings" (toolbar or empty-state CTA)
      ▼
OrganizerSettingsDialog opens (portal) — VIEW mode
      ▼  GET /rules → read-only rule grid + search filter
click Edit → EDIT mode (draft array; rows flagged isNew / isDeleted)
      ├─ Add row, edit fields (Remark, Match Type C/E, Receive/Pay, Reporting Account, Purpose, VAS, Contact)
      ├─ Delete row (flag isDeleted)
      └─ Drag-reorder (recomputes disp_ord) — *save wiring deferred*
click Save
      ├─ validate: every live row has a non-blank Remark
      ├─ DELETE rows flagged isDeleted (with rmrkSeqNo)
      ├─ POST new rows (isNew)
      ├─ PUT changed existing rows
      └─ onChanged() → page refetches eligibility (new rules may match more rows)
click Cancel → discard draft, back to VIEW mode
```

- Direction (Receive/Pay) is an explicit toggle — this is what lets PAY rules be created (R03).
- The four classification pickers (Reporting Account, Purpose, VAS Account, Contact) are the **same
  shared components** used in Transaction History detail.

## 5. Empty / error states

| State | UI |
|---|---|
| No `account` in URL | Empty state (wand icon) + "Go to Organizer Settings" CTA; no fetch |
| Account set, no matched rows | Empty state + CTA to add rules |
| Fetch error | Inline error (sticky-loading resolved) |
| Confirm error | Dialog with backend error code + message |

---

See [ui-specification.md](ui-specification.md) for layout detail and
[api-consumption.md](api-consumption.md) for the wire contracts.
