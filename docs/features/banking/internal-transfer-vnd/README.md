# Banking › Internal Transfer (VND) — Group Hub (Frontend)

Frontend design docs for the **Banking → Internal Transfer (VND)** sidebar group. Own-account fund movement and the executed-transfer ledger. This page is a navigation index; each submenu page has its own standardized 6-doc module folder.

## Submenu pages (leaf folders, 6-doc set each)

| Submenu | Leaf folder | Route |
|---|---|---|
| Own Account Transfer | [own-account-transfer/](own-account-transfer/README.md) | `/banking/own-account-transfer` |
| Transfer History | [transfer-history/](transfer-history/README.md) | `/banking/internal-transfer/transfer-history` |

> Older single-file specs preserved as `legacy-spec.md` inside each leaf.
> Distinct from the **Payment → Internal Transfer** family (Scheduled Transfer / Transfer Result) — see [../../payment/internal-transfer/](../../payment/internal-transfer/README.md).

## Related
- Components: [`components/banking/internal-transfer/`](../../../../components/banking/internal-transfer/)
- Backend: [wecms-api/.../internal-transfer-vnd/](../../../../../wecms-api/docs/features/banking/internal-transfer-vnd/README.md)
- Banking hub: [../README.md](../README.md)
