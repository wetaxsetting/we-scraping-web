"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Default minimum-visibility window in milliseconds. Picked so the user
 * has time to register that "something is loading" without making fast
 * APIs feel artificially slow. 400 ms sits between the 300 ms lower
 * bound suggested in the Settings UX spec and the 500 ms upper bound
 * that begins to feel laggy on snappy networks.
 */
const DEFAULT_MIN_VISIBLE_MS = 400;

/**
 * Hold a transient `loading` flag visible for at least `minMs` so the
 * UI doesn't flicker when an API call settles in under that window.
 *
 * <ul>
 *   <li>When the source flag flips <i>false → true</i>, the hook flips
 *       to true immediately and stamps the start time.</li>
 *   <li>When the source flag flips <i>true → false</i>, the hook holds
 *       true until {@code minMs} has elapsed since the start stamp,
 *       then flips to false on a scheduled tick. If the elapsed time
 *       already exceeds {@code minMs}, the flip is synchronous on the
 *       next effect run.</li>
 *   <li>If the source flag flips back to true during the hold window,
 *       the hook stays true and the original start stamp is retained
 *       — burst refetches read as a single continuous loading window
 *       instead of a rapid on/off blink.</li>
 * </ul>
 *
 * <p>Intended for list-load gates ({@code showLoadingNotice}) and
 * mutation-in-flight gates ({@code submitting} / {@code mutationInFlight})
 * across the Settings module — anywhere a transient boolean would
 * otherwise produce a sub-perceptible UI flash.</p>
 *
 * @param loading source flag from the API hook / mutation state.
 * @param minMs   minimum-visibility window (default 400 ms).
 * @returns whether the UI should currently display the loading state.
 */
export function useStickyLoading(
    loading: boolean,
    minMs: number = DEFAULT_MIN_VISIBLE_MS,
): boolean {
    const [visible, setVisible] = useState(loading);
    /* Wall-clock timestamp when the current loading window started.
     * `Date.now()` is impure so we never read it during render — the
     * stamp is captured inside the effect below. `null` means "no
     * loading window currently being timed". */
    const startRef = useRef<number | null>(null);

    useEffect(() => {
        if (loading) {
            // Entering / continuing a loading window. Surface true
            // immediately and stamp the start time on the false → true
            // edge so a later false-flip can compute the hold tail.
            // This setState is the legitimate "sync timer with React
            // state" pattern that an effect exists for — flipping
            // `visible` on a delay is the hook's whole purpose.
            if (!visible) {
                startRef.current = Date.now();
                // eslint-disable-next-line react-hooks/set-state-in-effect
                setVisible(true);
            } else if (startRef.current === null) {
                startRef.current = Date.now();
            }
            return;
        }

        // Exiting a loading window. Hold `visible` true until the
        // minimum-visibility window has elapsed since the start stamp.
        if (!visible) return;
        const start = startRef.current ?? Date.now();
        const elapsed = Date.now() - start;
        if (elapsed >= minMs) {
            startRef.current = null;
            setVisible(false);
            return;
        }
        const handle = window.setTimeout(() => {
            startRef.current = null;
            setVisible(false);
        }, minMs - elapsed);
        return () => window.clearTimeout(handle);
    }, [loading, visible, minMs]);

    return visible;
}
