/**
 * Static schema for the VAT Declaration "Tax Indicators" table.
 *
 * Every row here defines its STRUCTURE and i18n key only — no values.
 * At render time DeclarationTab merges this schema with live `indicators`
 * data from the API: indicators[schema.ctLeft] / indicators[schema.ctRight].
 *
 * `no`        — row number column (A / B / 1 / 2 / I / II …)
 * `labelKey`  — i18n translation key for the description column
 * `ctLeft`    — key inside ApiVatDeclarationIndicators for the left value cell
 * `ctRight`   — key inside ApiVatDeclarationIndicators for the right value cell
 */
export type IndicatorSchemaRow = {
    no: string;
    labelKey: string;
    ctLeft?: string;
    ctRight?: string;
    hasCheckbox?: boolean;
    isSectionHeader?: boolean;
    isSubHeader?: boolean;
    isSection?: boolean;
    isTotal?: boolean;
    isLast?: boolean;
    isEmptyLeft?: boolean;
    isEmptyRight?: boolean;
    italic?: boolean;
    bold?: boolean;
    indent?: number;
};

export const INDICATOR_SCHEMA: IndicatorSchemaRow[] = [
    {
        no: "A",
        labelKey: "tax_filing.indicator.a",
        ctRight: "ct21",
        hasCheckbox: true,
        isSectionHeader: true,
    },
    {
        no: "B",
        labelKey: "tax_filing.indicator.b",
        ctRight: "ct22",
        isSectionHeader: true,
    },
    {
        no: "C",
        labelKey: "tax_filing.indicator.c",
        isSection: true,
        isSectionHeader: true,
        isEmptyLeft: true,
        isEmptyRight: true,
    },
    {
        no: "I",
        labelKey: "tax_filing.indicator.i",
        isSectionHeader: true,
        isSubHeader: true,
        isEmptyLeft: true,
        isEmptyRight: true,
    },
    {
        no: "1",
        labelKey: "tax_filing.indicator.i_1",
        ctLeft: "ct23",
        ctRight: "ct24",
        indent: 1,
    },
    {
        no: "",
        labelKey: "tax_filing.indicator.i_1a",
        ctLeft: "ct23a",
        ctRight: "ct24a",
        italic: true,
        indent: 2,
    },
    {
        no: "2",
        labelKey: "tax_filing.indicator.i_2",
        ctRight: "ct25",
        indent: 1,
    },
    {
        no: "II",
        labelKey: "tax_filing.indicator.ii",
        isSectionHeader: true,
        isSubHeader: true,
        isEmptyLeft: true,
        isEmptyRight: true,
    },
    {
        no: "1",
        labelKey: "tax_filing.indicator.ii_1",
        ctLeft: "ct26",
        indent: 1,
    },
    {
        no: "2",
        labelKey: "tax_filing.indicator.ii_2",
        ctLeft: "ct27",
        ctRight: "ct28",
        bold: true,
        indent: 1,
        isTotal: true,
    },
    {
        no: "a",
        labelKey: "tax_filing.indicator.ii_2a",
        ctLeft: "ct29",
        indent: 2,
    },
    {
        no: "b",
        labelKey: "tax_filing.indicator.ii_2b",
        ctLeft: "ct30",
        ctRight: "ct31",
        indent: 2,
    },
    {
        no: "c",
        labelKey: "tax_filing.indicator.ii_2c",
        ctLeft: "ct32",
        ctRight: "ct33",
        indent: 2,
    },
    {
        no: "d",
        labelKey: "tax_filing.indicator.ii_2d",
        ctLeft: "ct32a",
        indent: 2,
    },
    {
        no: "3",
        labelKey: "tax_filing.indicator.ii_3",
        ctLeft: "ct34",
        ctRight: "ct35",
        bold: true,
        indent: 1,
        isTotal: true,
    },
    {
        no: "III",
        labelKey: "tax_filing.indicator.iii",
        ctRight: "ct36",
        isSectionHeader: true,
        isSubHeader: true,
        isTotal: true,
    },
    {
        no: "IV",
        labelKey: "tax_filing.indicator.iv",
        isSectionHeader: true,
        isSubHeader: true,
        isEmptyLeft: true,
        isEmptyRight: true,
    },
    {
        no: "1",
        labelKey: "tax_filing.indicator.iv_1",
        ctRight: "ct37",
        indent: 1,
    },
    {
        no: "2",
        labelKey: "tax_filing.indicator.iv_2",
        ctRight: "ct38",
        indent: 1,
    },
    {
        no: "V",
        labelKey: "tax_filing.indicator.v",
        ctRight: "ct39a",
        isSectionHeader: true,
        isSubHeader: true,
        isTotal: true,
    },
    {
        no: "VI",
        labelKey: "tax_filing.indicator.vi",
        isSectionHeader: true,
        isSubHeader: true,
        isEmptyRight: true,
    },
    {
        no: "1",
        labelKey: "tax_filing.indicator.vi_1",
        ctRight: "ct40a",
        indent: 1,
        isTotal: true,
    },
    {
        no: "2",
        labelKey: "tax_filing.indicator.vi_2",
        ctRight: "ct40b",
        indent: 1,
    },
    {
        no: "3",
        labelKey: "tax_filing.indicator.vi_3",
        ctRight: "ct40",
        bold: true,
        indent: 1,
        isTotal: true,
    },
    {
        no: "4",
        labelKey: "tax_filing.indicator.vi_4",
        ctRight: "ct41",
        indent: 1,
        isTotal: true,
    },
    {
        no: "4.1",
        labelKey: "tax_filing.indicator.vi_4_1",
        ctRight: "ct42",
        indent: 2,
    },
    {
        no: "",
        labelKey: "tax_filing.indicator.vi_4_1a",
        ctRight: "ct42a",
        italic: true,
        indent: 3,
    },
    {
        no: "",
        labelKey: "tax_filing.indicator.vi_4_1b",
        ctRight: "ct42b",
        italic: true,
        indent: 3,
    },
    {
        no: "4.2",
        labelKey: "tax_filing.indicator.vi_4_2",
        ctRight: "ct43",
        bold: true,
        indent: 2,
        isLast: true,
        isTotal: true,
    },
];
