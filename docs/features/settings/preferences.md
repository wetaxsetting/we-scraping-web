# Preferences — SUPERSEDED

**Status: SUPERSEDED** *(reduced to a pointer 2026-08-17)*

**Authoritative documentation:** [./preferences/README.md](preferences/README.md)

The 6-doc folder — README · [screen-flow](preferences/screen-flow.md) ·
[ui-specification](preferences/ui-specification.md) ·
[component-index](preferences/component-index.md) ·
[api-consumption](preferences/api-consumption.md) ·
[test-scenarios](preferences/test-scenarios.md) — describes the shipped read/edit-mode panel: the
per-tenant company profile (read · save · logo upload / delete / stream) plus the two
always-editable switches.

## What happened to this file's content

The standard Overview / Page Location / UI Components / User Actions / Table Columns / Dialogs /
API Integration / Validation sections are **all covered in the folder** and were removed rather than
maintained twice. The folder is in fact more precise — it names the toggle codes (`00077` / `00074`),
which this file only had as `{env_set_inf}`.

This file's note that the two toggles control whether the **Purpose** and **VAS Account** panels and
their transaction-setup fields are shown is already stated in the folder README, which additionally
names them *Use Purpose* and *Use VAS Account* and records that they persist independently.

**One verified fact was unique to this file and has been migrated** *(corrected 2026-08-17 — an
earlier version of this stub wrongly claimed "nothing unique was lost")*: the toggles are backed by
**`BUSI_ENV_SET_INFM`**, **not** `ENV_SETN_INFM`. It now lives in
[preferences/api-consumption.md § Toggles](preferences/api-consumption.md), with the source evidence
and the `COALESCE(BUSI, SYS)` resolution note.

Its closing caveat, also unresolved and unchanged, was that the exact panel components should be
confirmed against the shipped UI + Figma — **the folder docs are that confirmation**.

This stub is kept so existing links and bookmarks do not 404. Do not add content here.
