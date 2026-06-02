# frontend/integrations/

Browser-side integrations for `wecms-web`.

## Purpose

Document third-party SDKs and embeds that run in the browser: charting libraries, file-upload widgets, Figma-driven design tokens, OTP / 2FA widgets, e-invoice viewers, and any external auth flow.

## What goes here

- Per-integration markdown
- Token / config injection rules (env vars, runtime config endpoint)
- Failure-mode UX (offline, blocked third-party scripts, region-specific deny lists)

## Related

- Server-side counterpart: `integrations` _(wecms-api backend repo — not included in this clone)_
- Figma reference assets: `figma` _(wecms-api backend repo — not included in this clone)_
