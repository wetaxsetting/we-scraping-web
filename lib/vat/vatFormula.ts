/**
 * VAT declaration indicator engine — the single write path for every computed
 * cell of form 01/GTGT.
 *
 * Transcribed from the authority-facing spec, `VAT_Declaration_FunctionalSpec`
 * §8.3 (propagation on manual edit) and §8.4 (aggregate formulas). Both the
 * form and the Excel export read from here, so a figure can never differ
 * between what the user sees and what is filed.
 *
 * Truncation is `floor`, never `round` — a rounded-up tax figure over-declares.
 */

/** The cells a user types into. Every other indicator is derived. */
export type VatInputs = {
    ct22: number;
    ct23: number;
    ct24: number;
    ct25: number;
    ct26: number;
    ct29: number;
    ct30: number;
    ct31: number;
    ct32: number;
    ct32a: number;
    ct33: number;
    ct37: number;
    ct38: number;
    ct39a: number;
    ct40b: number;
    ct42: number;
};

export type VatComputed = {
    ct27: number;
    ct28: number;
    ct34: number;
    ct35: number;
    ct36: number;
    /** Signed intermediate; drives [40a] / [41]. Not filed on its own. */
    hieuSo: number;
    ct40a: number;
    ct40: number;
    ct41: number;
    ct43: number;
};

/** §8.4 — aggregate indicators (the grey cells). */
export function computeVatIndicators(v: VatInputs): VatComputed {
    const ct27 = v.ct29 + v.ct30 + v.ct32 + v.ct32a;
    const ct28 = v.ct31 + v.ct33;
    const ct34 = v.ct26 + ct27;
    const ct35 = ct28;
    const ct36 = ct35 - v.ct25;
    const hieuSo = ct36 - v.ct22 + v.ct37 - v.ct38 - v.ct39a;
    const ct40a = hieuSo > 0 ? hieuSo : 0;
    const ct41 = hieuSo < 0 ? Math.abs(hieuSo) : 0;
    return {
        ct27,
        ct28,
        ct34,
        ct35,
        ct36,
        hieuSo,
        ct40a,
        // No `Math.max(0, …)` on [40] / [43]. The server subtracts raw and
        // rejects the overdraw outright — VatIndicatorCalculator throws
        // WBE_VAT_DECL_INVALID_INDICATOR when [40b] > [40a] or [42] > [41].
        // Clamping here showed the accountant a calm `0` for a figure the save
        // was always going to refuse, and the refusal names no cell, so there
        // was nothing to act on. A negative on screen is the same arithmetic
        // the server does, and it points at the cell that overdrew.
        ct40: ct40a - v.ct40b,
        ct41,
        ct43: ct41 - v.ct42,
    };
}

/**
 * §8.3 — editing a source cell seeds its dependants. The targets stay editable
 * ("Auto / manual" in §8.5), so this only writes them on a source change; a
 * manual override survives until the source moves again.
 *
 * Returns only the cells that change, so callers can spread it over their state.
 */
export function propagateVatInput(
    key: string,
    value: number,
): Partial<VatInputs> {
    switch (key) {
        case "ct23": {
            const ct24 = Math.floor(value * 0.1);
            return { ct24, ct25: ct24 };
        }
        case "ct24":
            return { ct25: value };
        case "ct30":
            return { ct31: Math.floor(value * 0.05) };
        case "ct32":
            return { ct33: Math.floor(value * 0.1) };
        default:
            return {};
    }
}
