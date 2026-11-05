import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LocaleProvider } from "@/lib/i18n";
import DialogProvider, { useDialog } from "./DialogProvider";
import type { DialogApi } from "./types";

function Capture({ onReady }: { onReady: (api: DialogApi) => void }) {
    onReady(useDialog());
    return null;
}

function setup() {
    let api!: DialogApi;
    render(
        <LocaleProvider>
            <DialogProvider>
                <Capture onReady={(a) => (api = a)} />
            </DialogProvider>
        </LocaleProvider>,
    );
    return () => api;
}

describe("useDialog Promise helpers", () => {
    it("confirm resolves true on the primary button", async () => {
        const api = setup();
        let p!: Promise<boolean>;
        act(() => {
            p = api().confirm({ title: "Delete?", message: "Sure?", confirmLabel: "Yes" });
        });
        fireEvent.click(screen.getByRole("button", { name: "Yes" }));
        await expect(p).resolves.toBe(true);
    });

    it("confirm resolves false on Cancel", async () => {
        const api = setup();
        let p!: Promise<boolean>;
        act(() => {
            p = api().confirm({ title: "Delete?", confirmLabel: "Yes", cancelLabel: "No" });
        });
        fireEvent.click(screen.getByRole("button", { name: "No" }));
        await expect(p).resolves.toBe(false);
    });

    it("toast renders a dismissible status message", () => {
        const api = setup();
        act(() => api().toast("Saved", "success"));
        expect(screen.getByRole("status")).toHaveTextContent("Saved");
        fireEvent.click(screen.getByRole("button", { name: "Close" }));
        expect(screen.queryByRole("status")).toBeNull();
    });
});
