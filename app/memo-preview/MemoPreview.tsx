"use client";

import { useState } from "react";

import { MemoDrawer } from "@/components/shared/memo";

/* ============================================================================
 *  Static preview harness for the Memo drawer.
 *
 *  Renders a neutral page with a button that opens the MemoDrawer so the
 *  static UI can be compared 1:1 against Figma (5549:24184 + 5549:24278).
 *  The drawer opens by default on mount. No auth, no API — this route lives
 *  outside the (dashboard) group so it renders without a backend.
 * ========================================================================== */

export default function MemoPreview() {
    const [open, setOpen] = useState(true);

    return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-wb-bg-sidebar p-8">
            <h1 className="text-wb-18 font-semibold tracking-wb-tight text-wb-dark">Memo Drawer — Static Preview</h1>
            <p className="max-w-md text-center text-wb-13 font-medium text-wb-ntrl-6">
                UI-only. Add / edit / delete and the color tags all use local React state — no API,
                no persistence. Reloading resets everything.
            </p>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="flex h-9 cursor-pointer items-center justify-center rounded-md bg-brand px-4 text-wb-14 font-medium text-white shadow-wb-brand-btn hover:bg-brand-hover"
            >
                Open Memo
            </button>

            {open && <MemoDrawer onClose={() => setOpen(false)} />}
        </div>
    );
}
