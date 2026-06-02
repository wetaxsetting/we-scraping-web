# Banking > Smart Organizer (VND) — Frontend Page Design

**Module:** Banking → Current & Savings (VND) · **Menu:** Smart Organizer (VND)
**Route (proposed):** `/banking/smart-organizer` · **Slug:** `banking-smart-organizer-vnd`
**Status:** ⚠️ **DISCOVERY — no refactor page exists.** Derived from JEX `fnsh_0200_001` only; not a contract.

- API side: `../../../../wecms-api/docs/features/banking/smart-organizer-vnd.md` (Needs Confirmation)
- FCY twin: smart-organizer-fcy.md (Needs Confirmation)

## Overview
Auto-categorizing transaction view: a sortable transaction table with a system-assigned usage/purpose
(`DISP_USAG_NM`) and remark (`RMRK`), plus an **Organizer Settings** popup that configures the
categorization rules (from JEX `fnsh_0200_001`).

## Page Location *(proposed)*
Not yet built. Proposed `app/(dashboard)/banking/smart-organizer/page.tsx` (mirror Transaction History layout).

## UI Components *(from JEX, proposed)*
- Sortable transaction table (`SmartOrg`), empty-state banner with an Organizer Settings CTA, **Organizer Settings popup** (`#btn_PopSmart` in JEX).

## User Actions *(from JEX)*
- View categorized transactions; sort; open Organizer Settings to edit auto-categorization rules.

## Table Columns *(from JEX, confirm)*
Date · description · remark (`RMRK`) · display usage/purpose (`DISP_USAG_NM`) · amount. *(Confirm full set against `fnsh_0200_001`.)*

## Dialogs / Popups
- Organizer Settings popup (rule configuration).

## API Integration *(none yet)*
- Proposed `GET /api/v1/banking/smart-organizer`; settings CRUD — see API doc.

## Validation *(Needs Confirmation)*

## Notes
**Action required:** confirm refactor scope (in scope vs deferred/static-UI) before building. JEX: `fnsh_0200_001.ts`.
