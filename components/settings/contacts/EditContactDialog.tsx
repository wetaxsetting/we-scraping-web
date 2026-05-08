"use client";

import AddNewContactDialog from "./AddNewContactDialog";

type EditContactDialogProps = {
    onClose: () => void;
};

/**
 * Edit Contact dialog — Figma 12346:165870.
 *
 * Distinct entry point from `<AddNewContactDialog>` (Figma
 * 12346:165800) so callers state their intent at the import site
 * (`<EditContactDialog />` from the row-action Edit handler vs
 * `<AddNewContactDialog />` from the +Add button). Internally it
 * delegates to the same form implementation because both Figma
 * frames specify byte-for-byte identical layout / spacing / field
 * structure — the only differences are:
 *   - title ("Edit Contact" vs "Add New Contact")
 *   - initial values for `contactCode` / `contactName` / `taxId` /
 *     `accounts[1].recipient`
 * Both differences are encapsulated by the parent component's
 * `mode` prop + its `EDIT_DEFAULTS` constant.
 *
 * Should the two Figma nodes diverge in the future, peel the form
 * out of `<AddNewContactDialog>` into a shared inner component and
 * render distinct shells from each entry point — but only when the
 * design difference is real, not anticipatory.
 */
export default function EditContactDialog({ onClose }: EditContactDialogProps) {
    return <AddNewContactDialog mode="edit" onClose={onClose} />;
}
