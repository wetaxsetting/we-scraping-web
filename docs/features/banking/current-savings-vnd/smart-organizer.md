# Banking > Smart Organizer (VND) — Frontend Page Design

> **⚠️ Superseded — preserved for history.** The primary, current frontend documentation home for
> Smart Organizer is the folder **[../smart-organizer/](../smart-organizer/README.md)**
> (README · screen-flow · ui-specification · component-index · api-consumption · test-scenarios;
> full-stack refactor complete). This single-file spec predates that folder and still carries
> `Needs Confirmation` markers; read the folder instead. Content kept for traceability only.

**Module:** Banking → Current & Savings (VND) · **Menu:** Smart Organizer (VND)
**Route (proposed):** `/banking/smart-organizer` · **Slug:** `banking-smart-organizer-vnd`
**Status:** ✅ **Route implemented.** The Next.js route `app/(dashboard)/banking/smart-organizer/page.tsx` exists, and the backend (`SmartOrganizerController` + `OrganizerRuleController` + migrations V172–V174) is live. JEX-derived detail below is the functional spec; reconcile remaining `Needs Confirmation` markers against the shipped page/components in the next stabilisation pass.

- API side: `../../../../wecms-api/docs/features/banking/smart-organizer-vnd.md` (Needs Confirmation)
- FCY twin: smart-organizer-fcy.md (Needs Confirmation)

## Overview
Auto-categorizing transaction view: a sortable transaction table with a system-assigned usage/purpose
(`DISP_USAG_NM`) and remark (`RMRK`), plus an **Organizer Settings** popup that configures the
categorization rules (from JEX `fnsh_0200_001`).

## Page Location
`app/(dashboard)/banking/smart-organizer/page.tsx` (mirrors the Transaction History layout). Implemented.

## UI Components *(from JEX, proposed)*
- Sortable transaction table (`SmartOrg`), empty-state banner with an Organizer Settings CTA, **Organizer Settings popup** (`#btn_PopSmart` in JEX).

## User Actions *(from JEX)*
- View categorized transactions; sort; open Organizer Settings to edit auto-categorization rules.

## Table Columns *(from JEX, confirm)*
Date · description · remark (`RMRK`) · display usage/purpose (`DISP_USAG_NM`) · amount. *(Confirm full set against `fnsh_0200_001`.)*

## Dialogs / Popups
- Organizer Settings popup (rule configuration).

## API Integration *(implemented)*
- `GET /api/v1/banking/smart-organizer`; organizer-rule (settings) CRUD via `OrganizerRuleController` — see the api-side feature doc. Confirm exact paths against the live controllers.

## Validation *(Needs Confirmation)*

## Notes
Page + backend are implemented. Remaining `Needs Confirmation` markers (table columns, validation) reconcile against the shipped page/components in the next stabilisation pass. JEX functional reference: `fnsh_0200_001.ts`.
