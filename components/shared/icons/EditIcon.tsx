import MaskedIcon from "./MaskedIcon";

/**
 * EditIcon — the Figma `ico_pen` glyph (node 5936:24742), the canonical WeCMS
 * "Edit" affordance. Drop-in replacement for the lucide `<Pencil>` that used to
 * mark every edit action (row-action menus, per-row edit buttons, inline-edit
 * pencils, panel "Edit" buttons). Inherits color from `className` / the parent
 * via <MaskedIcon>, so each call site keeps its exact color; default size-4.
 */
export default function EditIcon({ className = "size-4" }: { className?: string }) {
    return <MaskedIcon src="/assets/common/ico-pen.svg" className={className} />;
}
