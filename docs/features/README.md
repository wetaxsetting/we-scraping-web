# Features — Frontend Design Docs (feature-first)

**Status: CURRENT (index)** — navigation only. Each linked doc carries its own status; see [../README.md § Status vocabulary](../README.md#status-vocabulary).

This repository renders the **WeInvoice** application (since 2026-11-03). The earlier WeCMS
screens and their documentation were removed — see the dated record
[weinvoice/weinvoice-p1-ui-transformation-2026-11-03.md](weinvoice/weinvoice-p1-ui-transformation-2026-11-03.md).

## Top menu → folder

| WeInvoice top menu | Folder |
|---|---|
| Hoá đơn · Thuế & kê khai · Báo cáo · Kiểm tra · Công cụ · Cài đặt | [weinvoice/](weinvoice/README.md) — one module doc covering every route, plus [test-scenarios.md](weinvoice/test-scenarios.md) |

## What a feature doc covers

Overview · Route/Page · Components · Filters · Table Columns · Pagination · Dialogs/Popups · Data access (mock → API) · Business rules · Test scenarios.

## Conventions

- Feature slugs are kebab-case; routes are slug-based (`/invoices/purchase`).
- UI and business rules come from the WeInvoice UI Spec handover (outside this repo); in-repo frontend conventions are in [../../CLAUDE.md](../../CLAUDE.md).
- When a module grows past one README, split it into `weinvoice/<screen>/` folders with the 6-doc set.
