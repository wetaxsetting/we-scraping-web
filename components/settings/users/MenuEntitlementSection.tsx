"use client";

import { Fragment, useMemo } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import MenuEntitlementRow from "./MenuEntitlementRow";
import type { EntitlementSection } from "./mockMenuEntitlements";

type MenuEntitlementSectionProps = {
    section: EntitlementSection;
    /** Read-only set of currently-granted item slugs. Per-item checked
     *  state is derived from `granted.has(item.id)`. */
    granted: Set<string>;
    /** Edit-mode toggle handler. When undefined, every checkbox renders
     *  disabled (view mode). */
    onToggle?: (itemId: string, checked: boolean) => void;
    /** Section-header click handler — grants / revokes every item in
     *  the section in one go. Disabled in view mode. */
    onSectionToggle?: (section: EntitlementSection, checked: boolean) => void;
};

/**
 * One entitlement section (Banking / Payment / Add-on Service / Settings).
 *
 * Renders the section header row (icon + label + section-level checkbox)
 * followed by each group's rows. The section header tristate behaves
 * like "select all items in this section": checked when every item is
 * granted, unchecked when none are granted, indeterminate (visually
 * unchecked here) in between.
 *
 * Children are emitted as siblings of the parent grid via fragments —
 * this component does NOT introduce a new grid. The parent
 * `<UserMenuEntitlementPanel>` owns the 3-column track so all checkboxes
 * line up in one vertical column across every section.
 */
export default function MenuEntitlementSection({
    section,
    granted,
    onToggle,
    onSectionToggle,
}: MenuEntitlementSectionProps) {
    const { t } = useTranslation();
    const { Icon } = section;
    const editable = !!onToggle;

    const allItems = useMemo(
        () => section.groups.flatMap((g) => g.items),
        [section],
    );
    const allGranted = allItems.every((item) => granted.has(item.id));

    return (
        <>
            <MenuEntitlementRow
                icon={<Icon className="size-4 shrink-0 text-wb-ink" />}
                label={t(section.labelKey)}
                checked={allGranted}
                onCheckedChange={
                    editable && onSectionToggle
                        ? (v) => onSectionToggle(section, v)
                        : undefined
                }
                disabled={!editable}
            />
            {section.groups.map((group) => (
                <Fragment key={group.id}>
                    <div
                        className="border-b border-wb-ntrl-3 py-3 pr-3 text-wb-13 font-medium text-wb-ink"
                        style={{ gridRow: `span ${group.items.length}` }}
                    >
                        {t(group.categoryKey)}
                    </div>
                    {group.items.map((item, idx) => {
                        const isLast = idx === group.items.length - 1;
                        const borderClass = isLast ? "border-b border-wb-ntrl-3" : "";
                        const isChecked = granted.has(item.id);
                        return (
                            <Fragment key={item.id}>
                                <div className={cn("py-3 pr-3 text-wb-13 font-medium text-wb-ink", borderClass)}>
                                    {t(item.labelKey)}
                                </div>
                                <div className={cn("flex items-center justify-end py-3 pr-2", borderClass)}>
                                    <Checkbox
                                        aria-label={t(item.labelKey)}
                                        checked={isChecked}
                                        disabled={!editable}
                                        onCheckedChange={
                                            editable && onToggle
                                                ? (v) => onToggle(item.id, v === true)
                                                : undefined
                                        }
                                    />
                                </div>
                            </Fragment>
                        );
                    })}
                </Fragment>
            ))}
        </>
    );
}
