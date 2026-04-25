"use client";

import { useEffect, useState, type ReactNode } from "react";

import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";
import SettingsModalProvider from "@/components/settings/SettingsModalProvider";

export default function AppShell({ children }: { children: ReactNode }) {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    // Lock body scroll when the mobile drawer is open
    useEffect(() => {
        if (typeof document === "undefined") return;
        const { body } = document;
        const prev = body.style.overflow;
        body.style.overflow = sidebarOpen ? "hidden" : prev;
        return () => {
            body.style.overflow = prev;
        };
    }, [sidebarOpen]);

    return (
        // h-screen pins the shell to the viewport so children can distribute
        // remaining height via flex-1 + min-h-0 (table fills, pagination pins).
        // SettingsModalProvider wraps the shell so the top-nav "Settings" menu
        // and any page can call useSettingsModal().open() to pop the modal.
        <SettingsModalProvider>
            <div className="flex h-screen w-full flex-col bg-white font-inter">
                <Header
                    sidebarOpen={sidebarOpen}
                    onToggleSidebar={() => setSidebarOpen((v) => !v)}
                />
                <div className="relative flex min-h-0 flex-1 items-stretch">
                    <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
                    <main className="flex min-h-0 min-w-0 flex-1 flex-col bg-white">
                        {children}
                    </main>
                </div>
            </div>
        </SettingsModalProvider>
    );
}
