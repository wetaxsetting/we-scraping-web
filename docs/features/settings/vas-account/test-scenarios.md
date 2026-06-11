# Settings > VAS Account — Test Scenarios (Frontend)

Frontend SIT/UAT scenarios. Legend: ✅ verified · ⏳ pending. Backend coverage:
[wecms-api/docs/features/settings/vas-account/test-scenarios.md](../../../../../wecms-api/docs/features/settings/vas-account/test-scenarios.md).

## Navigation & load

| # | Scenario | Expected | Status |
|---|---|---|---|
| N1 | Open Settings → VAS Account | Panel renders inside `<SettingsModal>`; no URL change | ✅ |
| N2 | Non-admin without `settings-core-vas-account` | VAS Account entry hidden (`isSettingsPanelVisible`) | ✅ |
| N3 | Initial load (both statuses checked) | `GET …?stts=A&stts=I&all=true`; grid populates | ✅ |
| N4 | Uncheck both Active + Inactive | Empty list, **no** wire call (short-circuit) | ✅ |

## Search / filter

| # | Scenario | Expected | Status |
|---|---|---|---|
| F1 | Search by code | Filtered rows (code match) | ✅ |
| F2 | Search by name | Filtered rows (name match) | ✅ |
| F3 | Active only | Only Active rows | ✅ |
| F4 | Inactive only | Only Inactive rows | ✅ |

## Grid

| # | Scenario | Expected | Status |
|---|---|---|---|
| G1 | Parent/child prefix grouping | Children indented under code-prefix parent; parent bold | ✅ |
| G2 | Parent chevron | Present but inert (no expand/collapse; all rows always render) | ✅ |
| G3 | Status pill | Active = brand-softer; Inactive = rejected tokens | ✅ |
| G4 | No sort glyph / no selection checkbox / no display-order column | Confirmed absent | ✅ |

## Create

| # | Scenario | Expected | Status |
|---|---|---|---|
| C1 | Valid create (code + name + status) | POST; success; grid refetch | ✅ |
| C2 | Code < 3 / > 15 / bad chars | Zod blocks; error dialog | ✅ |
| C3 | Duplicate code | Backend `WBE0003` → error dialog | ✅ |
| C4 | Name blank | Zod blocks | ✅ |
| C5 | English/Type/Notes fields | Not rendered (omitted from payload) | ✅ |

## Update

| # | Scenario | Expected | Status |
|---|---|---|---|
| U1 | Edit name only | PUT; preserved type/enm/cont; refetch | ✅ |
| U2 | Change code to existing | `WBE0003` → error dialog | ✅ |
| U3 | Toggle status (Active↔Inactive radio) | PUT updates `stts` | ✅ |
| U4 | Edit dialog re-seeds per row (`key=edit-${id}`) | Opening row B after A shows B's values | ✅ |

## Delete

| # | Scenario | Expected | Status |
|---|---|---|---|
| D1 | Delete via kebab | Confirmation dialog (blue Continue, not destructive-red); DELETE; refetch | ✅ |
| D2 | Re-entry guard | Second click while deleting is ignored (`deletingIds`) | ✅ |
| D3 | Bulk delete | N/A — no selection UI (verified absent) | ✅ |

## Import / Export

| # | Scenario | Expected | Status |
|---|---|---|---|
| I1 | Download template | Static XLSX per locale (KM→EN fallback) | ✅ |
| I2 | Browse non-Excel file | Error dialog `upload.error_file_type` | ✅ |
| I3 | Template header mismatch | Error dialog `template_mismatch`; selection cleared | ✅ |
| I4 | Valid file preview | Rows + Completed/Error chips | ✅ |
| I5 | Upload with errors | Blocked; error dialog `error_has_errors` | ✅ |
| I6 | Add New import | Confirmation → import → success dialog → refetch | ✅ |
| I7 | Reset and replace import | Confirmation (reset_replace copy); `dup_db` errors dropped client-side | ✅ |
| I8 | Excel export button | N/A — not exposed in the UI (OQ-VAS-1) | ✅ (verified absent) |

## Picker (cross-feature)

| # | Scenario | Expected | Status |
|---|---|---|---|
| P1 | Open Bank Account Edit → VAS picker | `/lookup` called once, cached; active+live only | ✅ |
| P2 | Filter picker by code/name | Client-side substring filter | ✅ |
| P3 | Clear selection | Resets to null | ✅ |

## States & errors

| # | Scenario | Expected | Status |
|---|---|---|---|
| E1 | Empty data | "No Data Found" | ✅ |
| E2 | API failure | `useDialog({ type:"error", errorCode })` (red chrome, `trace_id` shown) | ✅ |
| E3 | Validation failure (Zod / file-type / row) | **error** dialog, never warning chrome | ✅ |
