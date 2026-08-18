# Tax Filing — Test Scenarios

## 1. Existing automated coverage

**One suite:**
[`components/addon/tax-filing/declarationPdf.test.ts`](../../../../components/addon/tax-filing/declarationPdf.test.ts)
— 284 lines, 20 cases, run by Vitest (`npm run test`; the config's `include` globs cover
`components/**/*.test.{ts,tsx}`).

> **Test names are written in Vietnamese.** This is the only test file in the repository that does
> so. Noted as an observed convention of this module, not a rule to propagate.

`describe("declarationPdf — rendered from the workbook")` asserts that the browser-rendered PDF is
faithful to the authority's template:

| Assertion | Why it matters |
|---|---|
| Is a printable A4-portrait document | statutory form factor |
| Preserves the workbook's table layout | PDF must be the same document as the XLSX |
| Keeps template merges as `colspan` / `rowspan` | 90 merges in the sheet |
| Keeps empty cells so content stays in the right column | prevents column drift |
| Column widths follow the **exact ECMA-376 formula**, not an approximation | statutory layout fidelity |
| Scales to exactly A4's printable width, never narrower | |
| Table width equals the sum of column widths | |
| Text overflows into empty cells, clipped only when the neighbour has content | matches Excel behaviour |
| Row heights match Excel's declaration; empty cells don't stretch filler rows | |
| **Prints within a single A4 page** | split across two, the indicator table loses its header row and stops reading as the statutory form |
| Cell borders come from the template | |
| Font and size come from the template, not a hand-picked font | |
| Text colour from the template — not everything blackened | |
| Legal heading pulled from `sharedStrings` | |
| Figures correct, Vietnamese thousands formatting | |
| Period label distinguishes month from quarter | |
| `[02]` marked X on first filing; `[03]` shows the number on a supplemental | |
| **Escapes user data — no tag injection** | security |
| **Uses the same patch set as the XLSX — the two files cannot diverge** | the load-bearing invariant |
| Filename shares its stem with the XLSX | |

### Coverage gaps

No automated coverage exists for: the list page (filters, paging, row actions), the create dialog,
the indicator grid or its validation, `lib/vat/vatFormula.ts` (the derived-figure engine — the
highest-value untested unit in the module), `annexGrouping.ts`, the annex tabs, or the other three
exporters.

## 2. Manual scenarios

### 2a. Access and navigation

1. User **with** `addon-vat-declaration` → sidebar shows Tax Filing under the Reports/Tax group;
   `/addon/tax-filing` loads.
2. User **without** the grant → item hidden; direct URL is blocked by the `lib/menuAuth.ts` guard.
3. Top nav "Add-on Service" and the sidebar item both show active state on the route.

### 2b. List

4. Change **Year** → request refires; rows reload. Same for **Status** (All / Confirmed / Draft) and
   **keyword**. Confirm the pagination total changes with the filter — proof the filter is
   server-side.
5. Page size / page change → refires with `page` (0-based) + `size`.
6. Amounts render Vietnamese-formatted with the `đ` suffix; the three amount columns are right-aligned.
7. Period column distinguishes a month from a quarter.
8. `e-Transaction code` empty → renders the `not_submitted` label, not a blank cell.
9. **Delete the only row on the last page** → list clamps to a valid page rather than showing an
   empty out-of-range page (`clampToTotal`).

### 2c. Create

10. **+ New Declaration** → dialog opens with Monthly selected, BKBR + BKMV pre-checked.
11. Switch to Quarterly → the period control switches from month to quarter.
12. **Next** → declaration created; form overlay opens with exactly the checked annex tabs.
13. Create a **duplicate period** → error dialog reading the `duplicate_period` message, not a raw
    server string.
14. **Close** → nothing created.

### 2d. Form

15. Tab strip shows Declaration first, then only annexes whose detail flag is `"Y"`.
16. Edit a source cell (e.g. `ct29`) → dependants reseed (`ct27`, `ct34`, …) per the formulas.
17. Manually override a derived cell → the override **survives** until its source changes again.
18. Confirm truncation is **floor**: a figure that would round up must not.
19. **Save Draft** with a negative cell → error dialog naming the cell code; no request sent.
20. Save Draft with a non-integer cell → the not-integer message; no request sent.
21. Tax-agent code: blank ✅ · 10 digits ✅ · 13 digits ✅ · 11/12 digits ❌ · non-numeric ❌.
22. **Lock** → saves the draft first, then locks; status becomes Confirmed and the form goes read-only.
23. Lock while the **previous period is Draft** → `prev_period_not_locked` message.
24. Lock with **no previous-period declaration** → `prev_period_missing`. Verify across a year
    boundary (locking 01/2026 requires 12/2025).
25. **Sync** on a Draft → currently **fails**, since the endpoint is not implemented server-side; the
    error must surface in a dialog rather than failing silently.
26. Sync on a locked declaration → `decl_locked`.

### 2e. Annexes

27. BKBR / BKMV group rows by VAT rate (`KKKNT` / `8%` / `10%` / `KCT`) with a group header and subtotal.
28. **Page through a group that straddles a page boundary** → its subtotal stays the full-set value,
    not the page's partial sum.
29. Row numbering restarts within each group.
30. PL-reduce8 renders two sections; the reduced column equals `(4) × 80%`.

### 2f. Exports

31. Declaration tab → **Excel** downloads the patched 01/GTGT workbook.
32. Declaration tab → **PDF** opens the print dialog; the output is one A4 page and matches the XLSX.
33. Export a declaration with **unsaved edits** → the browser-generated XLSX/PDF reflect them
    (this is why the server-side PDF endpoint is not used).
34. BKBR / BKMV tab → Excel produces the 01-1/GTGT listing.
35. PL-142 tab → Excel produces the reduce-8% annex.
36. PL-CSSX / PL-VT tab → Excel warns `select_annex_tab`.
37. Non-declaration tab → PDF warns `pdf_declaration_only`.
38. **XML on a Draft** → `not_locked` message. XML on a locked declaration → file downloads.

### 2g. Row actions

39. **Unlock** a Confirmed row → confirm (Yes/No) → success dialog → list refreshes → status Draft.
40. Unlock while a **later period is still locked** → `next_period_locked`.
41. **Delete** a Draft → confirm shows a **red** Continue (the only destructive CTA here) → success →
    row gone.
42. Delete a **Confirmed** row → rejected with `decl_locked`.
43. **Edit** → opens the form for that row.
44. **Supplemental** → the menu item renders but has **no handler wired**; confirm whether that is
    intended before treating it as a defect.

### 2h. i18n

45. Switch EN / KO / VI → every `tax_filing.*` string resolves; no raw keys, no untranslated
    fallback in the indicator grid, tab labels, or error dialogs.
