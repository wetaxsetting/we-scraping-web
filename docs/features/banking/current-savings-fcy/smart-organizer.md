# Banking > Smart Organizer (FCY) — Frontend Page Design

**Module:** Banking → Current & Savings (FCY) · **Menu:** Smart Organizer (FCY)
**Route (proposed):** `/banking/smart-organizer-fcy` · **Slug:** `banking-smart-organizer-fcy`
**Status:** ⚠️ **DISCOVERY — no refactor page exists.** Derived from JEX `fnsh_0200_002` only; not a contract.

- API side: `../../../../wecms-api/docs/features/banking/smart-organizer-fcy.md` (Needs Confirmation)
- VND twin: smart-organizer-vnd.md (Needs Confirmation)

## Overview
FCY variant of Smart Organizer — auto-categorizing transaction view (usage `DISP_USAG_NM` + remark,
Organizer Settings popup) applied to foreign-currency accounts.

## Page Location *(proposed)*
Not yet built. Proposed `app/(dashboard)/banking/smart-organizer-fcy/page.tsx` (mirror VND twin + Account Inquiry FCY currency presentation).

## UI Components *(from JEX, proposed)*
Sortable transaction table, empty-state banner, Organizer Settings popup — same as VND with FCY formatting.

## User Actions *(from JEX)*
View categorized FCY transactions; sort; configure Organizer Settings.

## Table Columns *(confirm)*
Date · description · remark · display usage · amount (FCY). *(Confirm against `fnsh_0200_002`.)*

## Dialogs / Popups
Organizer Settings popup.

## API Integration *(none yet)*
Proposed `GET /api/v1/banking/smart-organizer?currency=FCY`.

## Validation *(Needs Confirmation)*

## Notes
**Action required:** same discovery as VND — confirm scope before building.
