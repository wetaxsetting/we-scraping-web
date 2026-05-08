import { Fragment } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import MenuEntitlementRow from "./MenuEntitlementRow";
import type { EntitlementSection } from "./mockMenuEntitlements";

type MenuEntitlementSectionProps = {
    section: EntitlementSection;
};

/**
 * One entitlement section (Banking / Payment / Add-on Service / Settings).
 *
 * Renders the section header row (icon + label + section-level checkbox)
 * followed by each group's rows. Within a group:
 *   · The category cell (left column) `grid-row: span N` over the
 *     group's items so the label appears once at the group's top while
 *     the bottom border lines up with the last item's bottom border.
 *   · Each item gets its own (item label, checkbox) pair on its own
 *     row; only the LAST item carries the bottom border so internal
 *     items within a group stack as one block.
 *
 * Children are emitted as siblings of the parent grid via fragments —
 * this component does NOT introduce a new grid. The parent
 * `<UserMenuEntitlementPanel>` owns the 3-column track so all checkboxes
 * line up in one vertical column across every section.
 */
export default function MenuEntitlementSection({ section }: MenuEntitlementSectionProps) {
    const { t } = useTranslation();
    const { Icon } = section;
    return (
        <>
            <MenuEntitlementRow
                icon={<Icon className="size-4 shrink-0 text-wb-ink" />}
                label={t(section.labelKey)}
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
                        return (
                            <Fragment key={item.id}>
                                <div className={cn("py-3 pr-3 text-wb-13 font-medium text-wb-ink", borderClass)}>
                                    {t(item.labelKey)}
                                </div>
                                <div className={cn("flex items-center justify-end py-3 pr-2", borderClass)}>
                                    <Checkbox aria-label={t(item.labelKey)} disabled />
                                </div>
                            </Fragment>
                        );
                    })}
                </Fragment>
            ))}
        </>
    );
}
