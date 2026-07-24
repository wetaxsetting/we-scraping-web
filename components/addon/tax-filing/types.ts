export type TaxFilingStatus = "confirmed" | "draft" | "submitted" | "cancelled";

export type TaxFilingRow = {
  id: string;
  declId: number;
  filingPeriod: string;
  status: TaxFilingStatus;
  taxPayable: number;
  prevPeriodCredit: number;
  carriedForward: number;
  periodType: "M" | "Q";
  periodValue: number;
  declYear: number;
  supplNo: number;
  declType: string;
  declTypeName: string;
  applicableCircular: string | null;
  etaxCode: string | null;
  modDtm: string | null;
};

export type AnnexItem = {
  id: string;
  code: string;
  filingPeriod: string;
  defaultChecked: boolean;
};

export type DeclarationPeriodMode = "monthly" | "quarterly";

export type TaxFilingStatusFilter = "all" | TaxFilingStatus;

export type TaxIndicatorRow = {
  no: string;
  label: string;
  isSection?: boolean;
  isSectionHeader?: boolean;
  fieldIdLeft?: string;
  valueLeft?: number | null;
  fieldIdRight?: string;
  valueRight?: number | null;
  hasCheckbox?: boolean;
  italic?: boolean;
  bold?: boolean;
  indent?: number;
  isEmptyLeft?: boolean;
  isEmptyRight?: boolean;
  isSubHeader?: boolean;
  isTotal?: boolean;
  isLast?: boolean;
};

export type BkbrRow = {
  no: number;
  symbolCode: string;
  symbolSubCode: string;
  date: string;
  customer: string;
  taxCode: string;
  revenue: number;
  taxRate: string;
  vat: number;
  group: string;
};

export type BkmvRow = {
  no: number;
  symbolCode: string;
  symbolSubCode: string;
  date: string;
  supplier: string;
  taxCode: string;
  revenue: number;
  vat: number;
  imported: boolean;
  importVat: number;
  group: string;
};

export type PlCssxPurchaseRow = {
  no: number;
  description: string;
  revenue: number;
  vat: number;
};

export type PlCssxSaleRow = {
  no: number;
  description: string;
  revenue: number;
  vatRate: string;
  vatAmount: number;
  notes: string;
};

// ─── Annex lines (API-driven) ─────────────────────────────────────────────────

export type AnnexIoDv = "I" | "O";

export type AnnexLine = {
  id: number;
  ioDv: AnnexIoDv;
  invNo: string;
  invSymbol: string;
  invDt: string;          // "dd/MM/yyyy" formatted
  trcoTaxCode: string;
  trcoNm: string;
  prodNm: string;
  splyAmt: number;
  vatRate: string;
  vatAmt: number;
  reducedAmt: number;
  allocRatio: string | null;
  handRegYn: boolean;
};

export type AnnexGroup = {
  prodNm: string;
  rowCount: number;
  totalSplyAmt: number;
  totalReducedAmt: number;
  rows: AnnexLine[];
};

export type AnnexListResult = {
  groups: AnnexGroup[];
  totalCount: number;
  grandTotalReducedAmt: number;
};
