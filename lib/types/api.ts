/**
 * Wire types for the backend (`we-scraping-api`, Spring Boot). Property names
 * are lowercase snake_case exactly as they travel over HTTP (global Jackson
 * SNAKE_CASE strategy); translation to camelCase happens once, in the API
 * client modules. Verified against backend source on 2026-11-03 — see
 * docs/features/weinvoice/weinvoice-api-integration-2026-11-03.md.
 */

/** Response envelope of every JSON endpoint. HTTP 200 alone is not success — read `status.error`. */
export interface ApiResponse<T> {
    status: { error: boolean; code: string; message: string };
    data?: T;
    timestamp?: string;
    path?: string;
    trace_id?: string;
}

/** `POST /api/v1/auth/login` body (`dto/LoginRequest`). */
export interface LoginRequestRec {
    user_id: string;
    user_pw: string;
    /** Second step of the two-call login when the user belongs to several companies. */
    biz_key?: string;
}

/** One selectable company in the chooser response (`LoginResponse.CompanyOption`). */
export interface CompanyOptionRec {
    biz_key: string;
    cmpn_nm: string;
    auth_gr_cd?: string;
    prdt_type?: string | null;
}

/** `POST /api/v1/auth/login` data (`dto/LoginResponse`) — authenticated or chooser shape (nulls dropped). */
export interface LoginResponseRec {
    access_token?: string;
    token_type?: string;
    expires_in?: number;
    user_id: string;
    user_nm: string;
    biz_key?: string;
    lang_cd?: string;
    cmpn_nm?: string;
    auth_gr_cd?: string;
    prdt_type?: string | null;
    tax_id?: string | null;
    companies_available?: CompanyOptionRec[];
}

/** `GET /api/v1/auth/me` data (`dto/MeResponse`). */
export interface MeResponseRec {
    user_id: string;
    user_nm: string;
    biz_key: string;
    lang_cd: string;
    cmpn_nm: string;
    auth_gr_cd: string;
    prdt_type?: string | null;
    tax_id?: string | null;
    all_menus: boolean;
    allowed_menu_cds: string[];
}

/*
 * WeInvoice — `GET /api/v1/weinvoice/dashboard?company_mst=&year=` data, as published by the backend
 * (`domain/weinvoice/dto/DashboardResponse`, interface-specification.md § "App and dashboard").
 * Amounts in VND; cancelled + replaced excluded.
 */
export interface DashboardResponseRec {
    company_mst: string;
    year: number;
    kpis: {
        count: number;
        sales_count: number;
        purchase_count: number;
        sales_total: number;
        purchase_total: number;
        out_vat: number;
        in_vat: number;
        vat_payable: number;
    };
    /** 12 entries, `month` = "yyyy-MM". */
    months: { month: string; sales: number; purchase: number; sales_count: number; purchase_count: number }[];
    data_status: {
        missing_xml: number;
        no_code_no_xml: number;
        missing_pdf: number;
        incomplete_periods: { month: string; got: number | null; total: number | null }[];
    };
    top_suppliers: { tax_id: string; name: string; count: number; total: number }[];
    last_sync: { finished_at: string | null; status: string | null } | null;
}
