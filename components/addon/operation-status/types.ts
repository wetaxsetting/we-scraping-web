/**
 * Tax-authority operation status for a customer/supplier company. Mirrors
 * the JEX live screen `aosv_0001_001.act` — companies whose e-invoice
 * certificate + operating state are polled from the Vietnamese General
 * Department of Taxation (Tổng cục Thuế).
 */
export type OperationStatusCode = "active_certificate_issued" | "suspended" | "not_registered";

export type OperationCompanyRow = {
    id: string;
    companyName: string;
    taxCode: string;
    address: string;
    status: OperationStatusCode;
    lastUpdate: string;
};
