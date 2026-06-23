# File Management — Screen Flow (Frontend)

**Part of:** Common → file-management
**Last verified:** 2026-06-23

Interaction flows for the shared file UI. Source: `components/settings/contacts/AttachmentsSection.tsx`, `lib/file.ts`.

## 1. Attach in Add mode (staged → upload after create)

The Add Contact dialog has no `trcoKey` yet, so files are **staged locally** and uploaded by the parent after the contact is created.

```
AttachmentsSection mode="add"
  user clicks "+ Add"  → fileInputRef.click()           AttachmentsSection.tsx:84, :216-224
  user picks files
    → snapshot FileList (before input.value="")          :97-98  (avoids live-list clear bug)
    → per file: client validation (ext, empty, size)     :100-133
        bad ext   → error dialog (settings.contacts.attachments.error.extension)
        empty     → error dialog (.error.empty)
        too large → error dialog (.error.too_large, size "10 MB")
    → onStagedChange([...stagedFiles, ...accepted])       :136-138
  staged files render as a list with a remove (Trash2) button per row   :246-268
  ── parent Create succeeds → resolves new trcoKey → uploads each staged file sequentially ──
```

The staged list is held by the **parent** dialog (`stagedFiles` / `onStagedChange` props) precisely so it survives until Create resolves the `trcoKey`.

## 2. Attach in Edit mode (immediate)

The Edit dialog has a `trcoKey`, so files load on mount and upload/delete fire immediately.

```
AttachmentsSection mode="edit" trcoKey={...}
  on mount → mutations.listFiles(trcoKey) → setExistingFiles(rows)      :66-82
  user picks files → same client validation → mutations.uploadFile(trcoKey, f) per file   :141-157
    → append returned row to existingFiles
    → on error: error dialog with ApiCallError.code + message
  existing files render with download (Download) + delete (Trash2) buttons   :269-301
  delete → mutations.deleteFile(trcoKey, fileId) → filter out of list   :167-184
```

## 3. Download click

```
user clicks the download glyph on an existing file row
  → handleDownload(row)                                  :186-202
  → downloadFile(mutations.fileDownloadUrl(trcoKey, row.file_id), row.org_file_nm)
      lib/file.ts:
        api.get(url, { responseType: "blob", transformResponse: [] })   file.ts:49-55
        if content-type is application/json → parse envelope → throw ApiCallError(code,msg)   :83-90
        else → build Blob → object URL → synthetic <a download> click → revoke on next tick   :92-112
        filename: RFC 5987 Content-Disposition  >  caller fallback (org_file_nm)   :97-99, :133-149
  → on ApiCallError: error dialog with ex.code + ex.message
```

The JWT lives in `localStorage`, so a plain `<a href download>` would not carry the Bearer header — `downloadFile` fires an authenticated XHR via the shared `api` axios instance and drives a synthetic anchor (`file.ts:5-45`).

## 4. Empty state

When there are no staged (add) or existing (edit) files, a dashed-border empty card renders `settings.contacts.attachments.empty` (`AttachmentsSection.tsx:204-242`).
