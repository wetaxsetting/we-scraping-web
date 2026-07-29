# wecms-web-docs — Folder Structure & Placement Guide

Authoritative map for where frontend docs go under `wecms-web/docs/`. Read alongside `web-doc-rules.md`.

## Directory map

```
wecms-web/docs/
├── README.md                      # docs root index
├── FRONTEND_PROJECT_RULES.md
├── WORKFLOW.md
├── prd.md
├── permissions.md
├── tech-stack.md
├── ui-component-guide.md
│
├── features/                      # SCREEN-ALIGNED / FEATURE-FIRST specs — primary home
│   ├── README.md
│   ├── auth/
│   ├── common/
│   ├── banking/                   # e.g. bank-credentials.md, own-account-transfer/, reports/
│   ├── payment/
│   ├── addon-service/
│   └── settings/
│
├── architecture/
│   ├── README.md
│   ├── components/                # shared/reusable component docs
│   ├── hooks/                     # custom hooks (data-fetching, view-setting, …)
│   ├── routes/                    # Next.js routing structure
│   ├── state-management/
│   ├── integrations/              # backend/API integration patterns
│   └── view-setting/              # global View Setting feature (columns/widths/visibility)
│
├── references/
│   ├── README.md
│   ├── page-mapping/              # JEX _view.jsp → Next.js route mapping
│   ├── screen-flows/              # reserved (non-active flow references)
│   └── legacy/                    # reserved (deprecated reference capture)
│
├── testing/                       # frontend test plans
└── archive/                       # retired docs (do not author new content here)
```

## Placement decision guide

| You are documenting… | Put it under… |
|---|---|
| A screen/page's UI (route, filters, columns, dialogs, validation) | `features/{domain}/` |
| A reusable component | `architecture/components/` |
| A custom hook | `architecture/hooks/` |
| Routing structure / conventions | `architecture/routes/` |
| State management approach | `architecture/state-management/` |
| Backend/API integration pattern | `architecture/integrations/` |
| View Setting (column config) behavior | `architecture/view-setting/` |
| JEX `_view.jsp` → Next.js route mapping | `references/page-mapping/` |
| A UI flow across screens | `references/screen-flows/` |
| A test plan | `testing/` |

## Feature domains

The six top-level domains are fixed: **auth, common, banking, payment, addon-service, settings**. Every screen doc maps to exactly one, mirroring the WeCMS menu structure. Cross-link when a screen spans domains, but give it one canonical home.

## Placement rules

- A new screen doc → `features/{domain}/{screen-slug}.md` (or a subfolder for multi-screen features). Keep the slug identical to its JEX and backend counterparts.
- Never duplicate the same content in two places — pick the canonical home and cross-link.
- `archive/` is read-only history. Do not author new docs there; move-to-archive is a confirmed, explicit action only.
- Always update the nearest `README.md` index when adding a file.
- Every screen doc should link to: its `page-mapping` entry, the components/hooks it uses, and the matching `wecms-api/docs/` feature/api-spec doc.
