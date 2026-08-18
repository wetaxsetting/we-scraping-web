# Exchange Rate Inquiry — Screen Flow

User flow + React state for `ExchangeRateInquiryPage`. Backend behaviour is in the API
[`wecms-api/…/business-flow.md`](../../../../../wecms-api/docs/features/payment/exchange-rate-inquiry/business-flow.md).

---

## 1. Entry

- User navigates Payment → Overseas Payment → Exchange Rate Inquiry
  (`/payment/overseas-payment/exchange-rate-inquiry`). Top-nav (Payment) and sidebar active
  states derive from `usePathname()`.
- The page boots with: `refDate = todayLocalIso()` (browser-local day — legacy `moment()`
  parity, avoids the UTC off-by-one for ICT users after 17:00 UTC), `bankCd = Shinhan
  (11704088)`, `seqNo = null` (latest), `compareEnabled = false`, `search = ""`.

## 2. Initial load

1. `useApiData(() => fetchExchangeRates({ refDate, bankCd, seqNo, ...sortParams }), [refDate, bankCd, seqNo, sortParams])` fetches the primary rate set on mount.
2. `useApiData(() => fetchExchangeRateBanks(), [])` populates the bank dropdown (falls back to
   the static Shinhan/Woori list when the API returns `[]`).
3. A stable-data latch keeps the previous matrix visible while filters change; a
   sticky-loading gate shows `common.loading` centered in the body for ≥ 400 ms on first paint.
4. The matrix renders the **fixed 12-currency** grid; `-` shows where a rate is missing.

## 3. Filter interactions

| Action | State change | Effect |
|---|---|---|
| Pick bank | `setBankCd` | re-fetch primary rates; compare bank auto-syncs to a different bank |
| Pick round | `setSeqNo(value || null)` | re-fetch for that round (or latest when null) |
| Pick date (`<DateField>`) | `setRefDate` | re-fetch for the new `ref_date` |
| Toggle compare | `setCompareEnabled` | enables the compare bank dropdown; fires a 2nd fetch |
| Pick compare bank | `setCompareBankCd` (swaps with primary if equal) | re-fetch compare rates (same round) |
| Type in search | `setSearch` | client-side filter of the matrix by currency code |
| Click a sortable header | `toggleSort(fieldId)` | cycle default → ASC → DESC → default; re-fetch + client-side re-sort |

## 4. Round dropdown specifics

- **Shinhan**: always offers `Last time` (value `""`) + `1st time` (value = the lowest
  `seq_no`, taken from the END of the DESC-ordered `rounds` list — using `[0]` would make
  "1st time" identical to "Last time").
- **Woori**: lists each round as `HH:MM:SS [Nth]`, reversed, no "Last time".
- If the current `seqNo` is not in the refreshed `rounds`, it resets to the latest round.

## 5. Compare flow

- When `compareEnabled` is true, a `useEffect` fires `fetchExchangeRates({ refDate, bankCd: compareBankCd, seqNo })` (same selected round) and stores the result in `compareData`.
- The matrix becomes 13 columns: `[Bank1 | Bank2 | Diff]` per rate type. Diff = primary − compare,
  rendered as a colored pill (positive green, negative `(parenthesised)` red, `0.00` green, `-` neutral when either side is null/zero).
- Toggling compare off clears `compareData` and returns to the 5-column layout.

## 6. Empty + error states

- **Empty** — when the filtered/sorted rows are empty: centered `payment.exchange_rate.empty`
  (or `common.loading` during the initial sticky load).
- **Error** — a `useEffect` on `apiError` opens `useDialog().open({ type: "error", title: t("dialog.error"), description: t("payment.exchange_rate.error.load_failed") })`. There is **no silent mock fallback**.

## 7. Footer

- "Inquired on {date}" — rendered bottom-right (Figma 38:14116) when the first rate row carries
  `lastUpdateDate` + `lastUpdateTime`; formatted `DD/MM/YYYY HH:MM:SS`.

## 8. Flow diagram

```
mount
 ├─ fetchExchangeRates(refDate, bankCd, seqNo, sort) ─→ stable matrix latch ─→ 12-currency grid
 └─ fetchExchangeRateBanks() ─→ bank dropdown (static fallback)
        │
   user changes bank / date / round / sort ─→ re-fetch primary
        │
   toggle compare ─→ fetchExchangeRates(compareBankCd, same seqNo) ─→ 13-col matrix + Diff
        │
   apiError ─→ useDialog error  |  empty ─→ empty-state copy  |  footer ─→ "Inquired on"
```
