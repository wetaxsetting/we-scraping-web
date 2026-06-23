# File Management — Test Scenarios (Frontend)

**Part of:** Common → file-management
**Last verified:** 2026-06-23

Expected UI behaviours for the shared file pattern. ⚠️ No dedicated frontend test for `AttachmentsSection` / `lib/file.ts` was found in this pass — these are the cases that should be covered.

## Add mode (staged)

| # | Given | When | Then |
|---|---|---|---|
| A1 | Add dialog, no `trcoKey` | pick a valid pdf | file appears in the staged list with a Trash2 remove button; no network call |
| A2 | staged list has 2 files | click remove on one | that file is spliced out via `onStagedChange`; the other remains |
| A3 | pick the same filename twice (after first add) | re-pick | works — input value is reset after each pick so the same file can be re-selected |
| A4 | parent Create succeeds | — | parent uploads each staged file sequentially against the new `trcoKey` |

## Edit mode (immediate)

| # | Given | When | Then |
|---|---|---|---|
| E1 | Edit dialog, valid `trcoKey` | mount | `listFiles(trcoKey)` populates the existing-files list |
| E2 | pick a valid file | upload | `uploadFile` fires; returned row appended; `busy` toggles during the call |
| E3 | click delete on a row | delete | `deleteFile` fires; row removed from the list on success |
| E4 | upload/delete API returns an error envelope | — | error dialog with `ex.code` + `ex.message` |

## Client-side validation (both modes)

| # | Given | When | Then |
|---|---|---|---|
| V1 | extension not in allow-list | pick | error dialog `settings.contacts.attachments.error.extension`; no file accepted |
| V2 | zero-byte file | pick | error dialog `…error.empty` |
| V3 | file `> 10 MB` | pick | error dialog `…error.too_large` with `{ size: "10 MB" }` |
| V4 | mixed batch where one file is invalid | pick | first invalid file aborts the whole batch with its error dialog (no partial accept) |

## Download

| # | Given | When | Then |
|---|---|---|---|
| D1 | existing file, server streams bytes | click download | browser save dialog; filename from RFC 5987 `Content-Disposition`, falling back to `org_file_nm` |
| D2 | server returns HTTP 200 + JSON error envelope (e.g. file unavailable) | click download | `downloadFile` sniffs `application/json`, throws `ApiCallError(code)`; error dialog shown — no bytes-of-JSON downloaded |
| D3 | transport failure (no response) | click download | `ApiCallError("NETWORK")`; error dialog |
| D4 | JSON body with no recognisable envelope | click download | `ApiCallError("WBE9999")` |

## Empty state

| # | Given | When | Then |
|---|---|---|---|
| S1 | no staged (add) / no existing (edit) files | render | dashed-border empty card with `settings.contacts.attachments.empty` |
