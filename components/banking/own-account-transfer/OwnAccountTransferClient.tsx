"use client";

import OwnAccountTransferPage from "./OwnAccountTransferPage";

/**
 * Client wrapper for Banking > Own Account Transfer. The wrapper
 * exists so the Next.js route can stay a thin server component (just
 * page metadata); all data + engine wiring lives inside the page
 * component which is itself "use client".
 *
 * <p>The wrapper is also the right seam to attach feature-wide
 * providers in the future (e.g. a sticky composer popover or a global
 * engine progress overlay) without bouncing the route file.
 */
export default function OwnAccountTransferClient() {
    return <OwnAccountTransferPage />;
}
