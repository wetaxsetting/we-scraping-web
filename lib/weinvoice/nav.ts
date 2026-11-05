import {
    BarChart3,
    Building2,
    FileSpreadsheet,
    FileText,
    Inbox,
    LayoutDashboard,
    Link2,
    ListChecks,
    Merge,
    Percent,
    Receipt,
    RefreshCcw,
    History,
    Search,
    Settings,
    ShieldAlert,
    ShieldCheck,
    Tags,
    Upload,
    Users,
    Wrench,
    FileCode2,
    Landmark,
    BookOpen,
    CreditCard,
    type LucideIcon, MailCheck } from "lucide-react";

/**
 * Navigation map — Invoy feature set, WeCMS navigation pattern
 * (top-nav module → left-sidebar groups). `phase` marks what the MVP
 * implements (MVP) vs. the planned roadmap phase from the Function List.
 */
export type NavItem = { key: string; href: string; icon: LucideIcon; phase: "MVP" | "P2" | "P3" | "P4" | "P5" | "P6" };
export type NavGroup = { key: string; items: NavItem[] };
export type NavModule = { key: string; icon: LucideIcon; home: string; prefixes: string[]; groups: NavGroup[] };

export const NAV: NavModule[] = [
    {
        key: "invoices",
        icon: FileText,
        home: "/dashboard",
        prefixes: ["/dashboard", "/invoices", "/sources", "/sync"],
        groups: [
            { key: "overview", items: [{ key: "dashboard", href: "/dashboard", icon: LayoutDashboard, phase: "MVP" }] },
            {
                key: "invoices",
                items: [
                    { key: "purchase", href: "/invoices/purchase", icon: Receipt, phase: "MVP" },
                    { key: "sales", href: "/invoices/sales", icon: FileText, phase: "MVP" },
                ],
            },
            {
                key: "sources",
                items: [
                    { key: "gdt", href: "/sources/gdt", icon: Link2, phase: "MVP" },
                    { key: "email", href: "/sources/email", icon: Inbox, phase: "MVP" },
                    { key: "mailbox", href: "/sources/mailbox", icon: MailCheck, phase: "MVP" },
                    { key: "upload", href: "/sources/upload", icon: Upload, phase: "MVP" },
                ],
            },
            {
                key: "sync",
                items: [
                    { key: "history", href: "/sync/history", icon: History, phase: "MVP" },
                    { key: "bulk", href: "/sync/bulk", icon: RefreshCcw, phase: "MVP" },
                ],
            },
        ],
    },
    {
        key: "tax",
        icon: Landmark,
        home: "/tax/vat-return",
        prefixes: ["/tax"],
        groups: [
            {
                key: "tax",
                items: [
                    { key: "vat_return", href: "/tax/vat-return", icon: FileSpreadsheet, phase: "P4" },
                    { key: "filed", href: "/tax/filed", icon: ListChecks, phase: "MVP" },
                    { key: "reduction", href: "/tax/reduction", icon: Percent, phase: "P5" },
                    { key: "journal", href: "/tax/journal", icon: BookOpen, phase: "MVP" },
                ],
            },
        ],
    },
    {
        key: "reports",
        icon: BarChart3,
        home: "/reports/listing",
        prefixes: ["/reports"],
        groups: [
            {
                key: "reports",
                items: [
                    { key: "listing", href: "/reports/listing", icon: BarChart3, phase: "P4" },
                    { key: "accounting_export", href: "/reports/accounting-export", icon: FileSpreadsheet, phase: "P3" },
                ],
            },
        ],
    },
    {
        key: "checks",
        icon: ShieldCheck,
        home: "/checks/invoices",
        prefixes: ["/checks"],
        groups: [
            {
                key: "checks",
                items: [
                    { key: "invoice_check", href: "/checks/invoices", icon: ShieldCheck, phase: "MVP" },
                    { key: "supplier_risk", href: "/checks/supplier-risk", icon: ShieldAlert, phase: "MVP" },
                ],
            },
        ],
    },
    {
        key: "tools",
        icon: Wrench,
        home: "/tools/xml-viewer",
        prefixes: ["/tools"],
        groups: [
            {
                key: "tools",
                items: [
                    { key: "xml_viewer", href: "/tools/xml-viewer", icon: FileCode2, phase: "MVP" },
                    { key: "providers", href: "/tools/providers", icon: Building2, phase: "MVP" },
                    { key: "pdf_merge", href: "/tools/pdf-merge", icon: Merge, phase: "P3" },
                    { key: "taxpayer_lookup", href: "/tools/taxpayer-lookup", icon: Search, phase: "MVP" },
                ],
            },
        ],
    },
    {
        key: "settings",
        icon: Settings,
        home: "/settings/general",
        prefixes: ["/settings"],
        groups: [
            {
                key: "settings",
                items: [
                    { key: "general", href: "/settings/general", icon: Settings, phase: "MVP" },
                    { key: "tags", href: "/settings/tags", icon: Tags, phase: "MVP" },
                    { key: "users", href: "/settings/users", icon: Users, phase: "MVP" },
                    { key: "plan", href: "/settings/plan", icon: CreditCard, phase: "P6" },
                ],
            },
        ],
    },
];

export function moduleFor(pathname: string): NavModule {
    return NAV.find((m) => m.prefixes.some((p) => pathname === p || pathname.startsWith(p + "/") || pathname === p + "/")) ?? NAV[0];
}

export function itemFor(pathname: string): NavItem | undefined {
    for (const m of NAV) for (const g of m.groups) for (const i of g.items) if (pathname === i.href || pathname + "/" === i.href) return i;
    return undefined;
}
