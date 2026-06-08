# Banking > Smart Organizer (FCY) — Frontend Page Design

> **⚠️ Superseded — preserved for history.** There is **no separate FCY page** — Smart Organizer is one
> page serving both VND and FCY (currency follows the selected account). The "FCY route not yet built"
> status below is obsolete. The primary frontend documentation home is the folder
> **[../smart-organizer/](../smart-organizer/README.md)**. Content kept for traceability only.

**Module:** Banking → Current & Savings (FCY) · **Menu:** Smart Organizer (FCY)
**Route (proposed):** `/banking/smart-organizer-fcy` · **Slug:** `banking-smart-organizer-fcy`
**Status:** **Backend implemented** (shares the Smart Organizer controllers/services + V172–V174 with the VND twin); the **FCY-specific frontend route is not yet built** — only the shared VND route `app/(dashboard)/banking/smart-organizer/` exists today. JEX-derived detail below is the functional spec for the FCY variant.

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
