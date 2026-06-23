# Screen Flow — How an Error Surfaces

**Part of:** Common → error-envelope
**Last verified:** 2026-06-23

No screen of its own. This is the flow every API error travels, from the wire to the user-visible dialog.

## 1. Happy path (for contrast)

```
Component → lib/api/<domain>.ts wrapper → api.get/post (lib/axios.ts)
  → request interceptor attaches `Authorization: Bearer <wecms_token>`   (axios.ts:15-24)
  → backend returns { status:{error:false, code:"WBI0000"}, data }
  → unwrap() returns body.data                                          (banking.ts:64-71)
  → component renders rows
```

## 2. Business / validation error (HTTP 200, `status.error === true`)

The backend returns **HTTP 200** for known business errors (e.g. `WBE1009`). The frontend must read
`status.error`, not the HTTP code.

```
api call resolves with 200, body.status.error === true
  → unwrap() sees `body.status.error || !body.data`                     (banking.ts:68)
  → throw new ApiCallError(body.status.code, body.status.message)       (banking.ts:69)
  → component catch → useDialog().open({ type:"error", errorCode, description })
```

Because the response is 200, the axios **response interceptor does NOT fire** its error branch — the
error is surfaced entirely by `unwrap()` re-reading `status.error`. This is the canonical "200-but-failed"
path the envelope exists to make safe.

## 3. Transport / non-200 error (4xx / 5xx with a body)

```
api call rejects (axios throws on non-2xx)
  → unwrap() catch: read e.response.data.status                         (banking.ts:72-77)
  → if envelope present → throw new ApiCallError(head.code, head.message)
  → else (no body) → throw new ApiCallError("NETWORK", e.message)
  → component catch → useDialog().open({ type:"error", errorCode })
```

## 4. 401 → session-expired re-auth (special path)

Handled centrally in the axios **response interceptor** (`axios.ts:59-83`) before any per-call catch:

```
any authenticated call returns HTTP 401
  → interceptor checks: status===401 AND not already retried AND not an auth endpoint   (axios.ts:64-71)
       (AUTH_PATHS excludes /auth/login + /auth/logout so a wrong-password popup attempt
        doesn't recursively re-open the dialog — axios.ts:47-50)
  → await requestReAuth()                                              (sessionExpired.ts:38)
       → surfaces the global <SessionExpiredDialog> (lock-screen re-auth)
  → outcome === "re_authenticated"?
       yes → mark config._isRetry = true, re-send the original request  (axios.ts:80-81)
             (request interceptor re-reads the fresh token from localStorage)
       no  → reject with the original error
  → a SECOND 401 on the retried request has _isRetry=true → falls through to the caller (axios.ts:68)
```

`/api/v1/auth/me` is **intentionally NOT excluded** — an expired token at page-load rehydration should
surface the re-auth popup, matching legacy `jex.wabooks.custom_v2.js:107`, rather than silently bouncing
to `/login` (`axios.ts:36-41`).

## 5. Error reaches the user

```
ApiCallError { code, message }
  → component: useDialog().open({
        type: "error",                 // red icon — never "warning" for an API/network failure
        title: t("dialog.error"),
        description: <message>,
        errorCode: <code>,             // renders the "Error code: WBExxxx" trailer
    })
  → <SystemDialog> portal at z-[100], single OK button, explicit-dismiss only
```

The `trace_id` from the server error body (rendered verbatim) lets the user quote it back to support;
ops greps it against server logs. See [ui-specification.md](ui-specification.md) for the trailer rendering.

## Sequence (text)

```
Component
  → lib/api/<domain> wrapper → lib/axios api instance
       [req interceptor] Bearer token
       [resp interceptor] 401? → requestReAuth() → retry once or reject
  → unwrap(): status.error===true OR non-2xx → throw ApiCallError(code, message)
  → component catch → useDialog({ type:"error", errorCode }) → <SystemDialog>
```
