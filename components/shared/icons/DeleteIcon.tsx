import MaskedIcon from "./MaskedIcon";

/**
 * DeleteIcon — the Figma `ico_trash` glyph (node 5936:24743), the canonical
 * WeCMS "Delete" affordance. Drop-in replacement for the lucide `<Trash2>` that
 * used to mark every delete / remove action (row-action menus, per-row delete
 * buttons, "Delete" labelled buttons, remove-file / remove-address chips).
 * Inherits color from `className` / the parent via <MaskedIcon>, so red
 * deletes, ink deletes, and inherited variants all render correctly; default
 * size-4.
 */
export default function DeleteIcon({ className = "size-4" }: { className?: string }) {
    return <MaskedIcon src="/assets/common/ico-trash.svg" className={className} />;
}
