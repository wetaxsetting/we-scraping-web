# e-Sign — Source Material

**Status: PRE-IMPLEMENTATION SOURCE MATERIAL / DESIGN HANDOFF.**
**Not current frontend implementation documentation.**

> **Read this before treating anything in this folder as a spec for `wecms-web`.** Nothing here
> describes code that exists in this repository. These are product research, legal research, a
> workflow design handoff, a standalone browser prototype, and presentation material — gathered
> ahead of any implementation decision.

## Evidence for that classification

Verified against current `wecms-web` source on 2026-08-17:

| Check | Result |
|---|---|
| e-Sign route under `app/` | **none** — no `/e-sign`, no `esign` segment anywhere in the App Router |
| e-Sign component or module | **none** — no `components/**/e-sign*`, no `lib/**/esign*` |
| e-Sign API client | **none** — no e-Sign endpoint in any of the 35 modules under `lib/api/` |
| e-Sign menu entry / permission code | **none** in `components/layout/sidebarNav.ts` or `lib/menuAuth.ts` |
| e-Sign locale keys | **none** in `locales/{en,ko,vi}.json` |
| Inbound links from other docs | **none** — no document in `docs/` links into this folder |

The only "eSign" strings that appear in a repo-wide grep are substring matches inside the word
*design*.

## Inventory

Nine documents plus one image, 641 KB total. Dates in filenames are `YYMMDD` (`260703` =
2026-07-03).

| File | Size | What it is |
|---|---|---|
| [eSign_Boards_MVP.html](eSign_Boards_MVP.html) | 259 KB | **Standalone browser prototype** — a single self-contained HTML/CSS/JS file for the "Boards" approval-workflow module. Runs entirely client-side; no server, no build, no dependency on this app. Open it directly in a browser. |
| `z8002597448137_634f8d549a222318b15fde07f74deb28.jpg` | 247 KB | Image asset with a machine-generated filename. Not referenced by any document here. |
| [Overview_260703_EN.html](Overview_260703_EN.html) | 35 KB | Presentation / overview deliverable |
| [Design_260703_EN.md](Design_260703_EN.md) | 21 KB | **Legal + design research** — Vietnamese legal basis (Law on E-Transactions 2023, Decree 23/2025, Accounting Law 2015, Decree 174/2016), document classification, signing requirements by law |
| [eSign_Boards_MVP_docs.md](eSign_Boards_MVP_docs.md) | 20 KB | Product documentation for the prototype — **written in Vietnamese** |
| [ProcessFunctions_260703_EN.html](ProcessFunctions_260703_EN.html) | 19 KB | Process & functions analysis (HTML form) |
| [eSign_Boards_MVP_docs_EN.md](eSign_Boards_MVP_docs_EN.md) | 18 KB | English counterpart of the Vietnamese product doc above |
| [IntegratedWorkflow_260703_EN.md](IntegratedWorkflow_260703_EN.md) | 10 KB | Integration design — unifies the existing Webcash model (Misa AMIS · internal documents · WeCMS + Workflow Template builder) with the researched legal-compliance layer |
| [Index_260703_EN.html](Index_260703_EN.html) | 7 KB | Landing page for the HTML set |
| [ProcessFunctions_260703_EN.md](ProcessFunctions_260703_EN.md) | 5 KB | Markdown synthesis of the process/functions analysis (includes a Mermaid diagram) |

`ProcessFunctions_260703_EN` exists in both `.html` and `.md`; `eSign_Boards_MVP_docs` exists in
Vietnamese and English. Both pairs are retained as delivered.

## How to treat this folder

- **Do not** cite anything here as a `wecms-web` specification, or infer that an e-Sign feature
  exists, is planned, or is scheduled.
- **Do not** reinterpret, summarize, or "correct" the legal and product research. It was authored
  by domain owners; this README only classifies and inventories it.
- **Do not** delete it. It is original research and a working prototype.
- Read it as background if and when an e-Sign feature is actually scoped.

## Open decisions (not resolved here)

Deliberately left to a human / PO call rather than settled during documentation remediation.

### Decision 1 — Placement (the primary call)

Three options. Nothing here is a recommendation; the evidence for each is stated so the decision can
be made without re-auditing the folder.

| Option | What it means | Evidence for | Evidence against |
|---|---|---|---|
| **KEEP IN REPO** | Leave the folder at `wecms-web/docs/e-sign/`, classified by this README | If e-Sign lands as a `wecms-web` feature, the research is already beside the code that will implement it; the classification banner prevents mis-citation; zero migration risk | Documents **no code in this repository**; 641 KB and the heaviest folder in the docs tree; a 259 KB standalone prototype is not frontend documentation; contradicts the tree's own rule that docs describe shipped behaviour |
| **MOVE TO SHARED SOURCE MATERIAL** | Relocate to a workspace-level source-material location, outside both project repos | Content is **cross-system** — Vietnamese legal research, Misa AMIS integration design, and a Webcash-wide workflow model, none of it frontend-specific; a future e-Sign feature would span api + web, so neither repo is its natural owner | Loses proximity to the eventual implementation; the workspace-level location is outside this clone, so a `wecms-web`-only developer would no longer see it exists |
| **ARCHIVE ELSEWHERE** | Move out of active docs into an archive / attachment store, leaving a pointer | Nothing links to it; nothing depends on it; it is a point-in-time 2026-07-03 handoff, not living documentation | It is **original research and a working prototype** — archiving must not mean deleting; if e-Sign is scoped soon, retrieval cost is real |

**Facts that bear on the choice, all verified 2026-08-17:**

- **Implementation status: none.** No route, component, `lib/api/` client, menu entry, permission
  code, or locale key exists (see the evidence table above).
- **Inbound links: zero.** No document in `docs/` links into this folder, so any of the three options
  is link-safe — no relative-link repair is required either way.
- **Size: 641 KB across 9 documents + 1 image**, dominated by `eSign_Boards_MVP.html` (259 KB) and
  the untitled JPG (247 KB). Those two are **79 %** of the folder.
- **Language mix: not uniformly English.** `eSign_Boards_MVP_docs.md` is Vietnamese; the rest are
  English. The docs tree states elsewhere that "all documentation is in English", so this folder is
  already an exception.
- **Naming: non-conforming.** `PascalCase_YYMMDD_EN` and `camelCase` against the tree's kebab-case
  convention.
- **Prototype status: standalone and self-contained.** `eSign_Boards_MVP.html` runs client-side with
  no server, no build step, and no dependency on this app. It is not wired to `wecms-web` in any way
  and cannot be — it is opened directly in a browser.
- **Format duplication:** `ProcessFunctions_260703_EN` exists as both `.html` and `.md`;
  `eSign_Boards_MVP_docs` exists in Vietnamese and English. Both pairs are retained as delivered.

**Whoever decides should also state whether the prototype and the JPG travel with the documents** —
they are the bulk of the weight and have the weakest claim to living in a documentation tree.

### Decision 2 — Naming

Filenames do not follow the tree's kebab-case convention. Renaming is **safe** (zero inbound links)
but has not been done, so the delivered artifacts stay byte-identical to what was handed over.
Renaming should probably be folded into whichever placement decision is taken, not done separately.

### Decision 3 — The untitled JPG

`z8002597448137_634f8d549a222318b15fde07f74deb28.jpg` (247 KB) has a machine-generated filename and
is **referenced by no document in this folder**. It needs a descriptive name or removal, once someone
confirms what it depicts. This is the one item that may be safely deletable rather than relocatable —
but only its author can confirm that.

---

Until those are decided, this README is the folder's contract: **source material, not documentation
of the shipped product.** No action in the P0–P2 documentation remediation passes moved, renamed, or
deleted anything here.
