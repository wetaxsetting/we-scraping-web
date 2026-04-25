import type { Metadata } from "next";
import { Inter, Noto_Sans_KR } from "next/font/google";
import "./globals.css";

import { DialogProvider } from "@/components/shared/dialog";
import { LocaleProvider } from "@/lib/i18n";

const notoSansKR = Noto_Sans_KR({
    weight: ["400", "500", "600", "700"],
    subsets: ["latin"],
    display: "swap",
    variable: "--font-noto-kr",
});

const inter = Inter({
    weight: ["400", "500", "600", "700"],
    subsets: ["latin"],
    display: "swap",
    variable: "--font-inter",
});

export const metadata: Metadata = {
    title: "WeCMS",
    description: "WebCash Management System",
};

export default function RootLayout({
    children,
}: Readonly<{ children: React.ReactNode }>) {
    return (
        <html lang="ko" className={`${notoSansKR.variable} ${inter.variable}`}>
            <body className="min-h-screen bg-white text-neutral-900 antialiased">
                <LocaleProvider>
                    <DialogProvider>{children}</DialogProvider>
                </LocaleProvider>
            </body>
        </html>
    );
}
