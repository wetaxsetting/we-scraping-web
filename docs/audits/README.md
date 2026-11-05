# Audits — `wecms-web`

**This folder is the canonical location for frontend audits.** Parity audits, gap analyses,
wiring verifications, and readiness assessments for `wecms-web` all live here — not inside
`docs/features/`.

An audit is a **point-in-time finding record**: it describes what was true on a given date, what was
compared against what, and what was decided. That is different from a feature doc, which describes
how the screen works *now*. Feature docs get updated; audits get superseded.

> **Consolidated 2026-08-17.** Five audit-shaped documents were moved here out of `docs/features/`
> (see the table below). Their findings were not rewritten — only their location and their relative
> links changed.

## An audit stops at the findings — a human approves what happens next

**Added 2026-08-18.** An audit or investigation is **not** a licence to change code. Full rule:
[`../../CLAUDE.md`](../../CLAUDE.md) §16 "Human approval gate between investigation and
implementation".

```
AUDIT  ──identifies──▶  BUG / ISSUE  ──human approval──▶  IMPLEMENTATION
```

- **The record exists before the investigation**, here as `descriptive-name-YYYY-MM-DD.md` — not
  written up afterwards.
- **A request to *check · investigate · review · audit · analyze · design* authorizes documentation and
  read-only inspection only**: source reading, Git/history, existing tests, permitted read-only DB
  inspection, root-cause analysis, parity comparison, and a **recommended** implementation. It does
  **not** authorize modifying source, writing implementation tests, changing SQL, migrations, or
  configuration — nor committing, pushing, merging, or deploying.
- **Finish at the gate**, with the three dimensions stated explicitly:

  ```
  Investigation Status:  COMPLETE
  Approval Status:       PENDING
  Implementation Status: NOT STARTED
  ```

- **`Audit: COMPLETE` means the investigation is complete — not that the defect is fixed.** That
  combination above is a perfectly valid *final* state for an investigation request. Several audits
  indexed below already say this in their own words ("AUDIT ONLY — no implementation performed",
  "docs only — no code changed in this pass"); §16 makes it the rule rather than a per-document habit.
- **The human chooses** `APPROVE IMPLEMENTATION` · `DENY` · `NEEDS MORE INVESTIGATION`. *"OK"*,
  *"thanks"*, *"looks good"* are **not** approval.
- **When a fix is approved**, the audit **stays here unchanged** and the work gets its own record in
  [`../bugs/`](../bugs/) or [`../issues/`](../issues/), which **links back to this audit as evidence** —
  never a copy of it, never a conversion of it.
- **When implementation is denied**, the audit still stays: record the decision
  (`Approval Status: DENIED`), preserve every piece of evidence, and stop. **A denied audit is not
  deleted** — it is the answer for the next person who hits the same symptom.

This binds every team — **Cambodia · Vietnam · Korea · future contributors** — and every tool
(Claude Code · Agents · Cursor · any other AI assistant).

## Index

No audit records yet. The WeCMS audits were removed with the WeCMS code on 2026-11-03 (see [../features/weinvoice/weinvoice-p1-ui-transformation-2026-11-03.md](../features/weinvoice/weinvoice-p1-ui-transformation-2026-11-03.md)).

## Conventions

- **Filename:** kebab-case, ending `-audit.md` or `-gap-analysis.md`, prefixed with the module when
  the same audit shape exists for more than one module (`banking-…`, `settings-…`).
- **Header block:** state scope, date, and status up front. If an audit changes status later, amend
  the header — do not silently rewrite the findings.
- **Findings are historical.** When an audit's conclusion is superseded, add a dated note; do not
  delete the original finding.
- **Cross-system audits live here** when the headline decision is a frontend one (the mobile WebView
  audit documents its own placement reasoning for exactly this case). Backend-owned audits live in
  the `wecms-api` repository.

## Related

- Docs root: [../README.md](../README.md)
- Feature docs (current behaviour, not findings): [../features/](../features/)
- Known-deferred issues, tracked separately from audits: [../tech-debt.md](../tech-debt.md)
