/**
 * Re-export shim for the Bank Account column metadata.
 *
 * The canonical definitions live in [BankAccountTable.tsx] alongside the
 * cell renderers; this file is kept so existing imports (and any future
 * locale-key audit tooling) still find `BANK_ACCOUNT_FIELD_LABEL_KEY` +
 * `BankAccountFieldId` at the original path.
 */
export {
    BANK_ACCOUNT_FIELD_LABEL_KEY,
    type BankAccountFieldId,
} from "./BankAccountTable";
