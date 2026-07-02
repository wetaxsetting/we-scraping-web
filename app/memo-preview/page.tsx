import type { Metadata } from "next";

import MemoPreview from "./MemoPreview";

export const metadata: Metadata = {
    title: "Memo Drawer — Static Preview | WeCMS",
    description: "Static UI-only preview of the Memo drawer (no API).",
};

export default function MemoPreviewPage() {
    return <MemoPreview />;
}
