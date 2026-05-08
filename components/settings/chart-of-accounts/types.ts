/**
 * Chart of Accounts panel — Figma 9196:12740 (Settings popup submenu).
 *
 * The table is a two-level tree: header rows ("ACC-01 / REVENUE") group a
 * set of child rows (Code001 / SALES …). The flat row list below carries
 * `kind: "group" | "child"` so the table renderer can switch styling
 * without holding a separate parent / child collection.
 */
export type ChartOfAccountsRow =
    | {
        id: string;
        kind: "group";
        accountCode: string;
        accountTypeEn: string;
        accountTypeVi: string;
        accountTypeKo: string;
    }
    | {
        id: string;
        kind: "child";
        accountCode: string;
        accountTypeEn: string;
        accountTypeVi: string;
        accountTypeKo: string;
        parentCode: string;
        /** Calc rule sign — only Code009 / Code010 in Figma carry one. */
        calcRule?: "+" | "-";
        status: "active";
    };
