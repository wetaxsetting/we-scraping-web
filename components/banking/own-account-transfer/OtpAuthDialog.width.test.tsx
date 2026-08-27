import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "@/lib/i18n";

import OtpAuthDialog from "./OtpAuthDialog";

/**
 * Width parity for the NXiSAS OTP prompt.
 *
 * The dialog shipped at `max-w-[660px]` — a repo-wide one-off. On SIT it
 * read as visibly wider than the `<SystemDialog>` Confirmation stacked over
 * it (500 px) and wider than the transfer composer it interrupts (480 px),
 * for a panel holding one graphic and one input. Sonny called it, 2026-08-27.
 *
 * This pins the width to the shared 500 px cap so a future edit — or a
 * well-meaning "restore the Figma value" revert — trips a test rather than
 * reaching SIT. See docs/bugs/otp-dialog-width-inconsistent-2026-08-27.md.
 */
describe("OtpAuthDialog — modal width", () => {
    const data = { bankName: "IBK VN" };

    /** The panel is the element carrying the `max-w-*` cap. Resolved from a
     *  node inside the dialog rather than by test id, so the assertion keeps
     *  working if the internal markup is reshuffled. */
    function renderPanel(): HTMLElement {
        render(
            <LocaleProvider>
                <OtpAuthDialog
                    open
                    data={data}
                    onSubmit={vi.fn()}
                    onCancel={vi.fn()}
                />
            </LocaleProvider>,
        );
        const panel = document.querySelector<HTMLElement>("[class*='max-w-']");
        expect(panel, "OTP dialog panel should render with a max-w cap").not.toBeNull();
        return panel!;
    }

    it("caps at the shared 500px modal width, matching SystemDialog", () => {
        expect(renderPanel().className).toContain("max-w-[500px]");
    });

    it("is not the 660px one-off it shipped with", () => {
        // Fails loudly if 660 is reinstated, naming the reason in the message.
        expect(renderPanel().className).not.toContain("max-w-[660px]");
    });

    it("still renders the OTP input, so the width change did not gut the dialog", () => {
        renderPanel();
        // The dialog is useless without its input — guards against a width
        // "fix" that accidentally breaks the body it was sizing.
        expect(document.querySelector("input")).not.toBeNull();
    });
});
