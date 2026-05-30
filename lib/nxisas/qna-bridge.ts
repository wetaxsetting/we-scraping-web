/**
 * Bridge between the legacy NXiSAS bundle's `.layerCont.security-question`
 * popup and the existing React `<QnaDialog>` already proven on the Bank
 * Transaction Sync flow.
 *
 * <p><b>Why a bridge instead of a replacement:</b> the bundle's QNA
 * submit handler (registered at `nxisas_v2.js:137-330` on bundle load,
 * jQuery-delegated against `body`) reads DOM state out of the popup
 * it injected — `#selectList0 li.selected[data-val][data-hiddenval]`
 * + `input[name='res']` + `input[name='req']` — and then calls
 * `_v2nxisas.execute(...)` to continue the 2nd-cert flow. Replacing
 * the popup with a pure React component would require re-implementing
 * the bundle's entire continuation pipeline. Instead, we keep the
 * legacy popup in the DOM (the bundle's own handlers stay valid),
 * hide it via {@link `app/nxisas-modals.css`} so the user never sees
 * the broken layout, mirror it with the React `<QnaDialog>`, and on
 * Confirm/Cancel hydrate the hidden DOM + trigger the bundle's
 * existing `.save` / `.cancel` click handler. The bundle never knows
 * the difference.
 *
 * <p>Detection: {@link installNxisasQnaBridge} attaches a
 * {@link MutationObserver} to `document.body` that fires whenever the
 * bundle appends a `.layerCont.security-question` element (see
 * `nxisas_v2.js:1610` — `$('body').append(_popup)` inside
 * `open2ndCertPop`). The observer extracts bank name, login ID, and
 * the question list, then dispatches a CustomEvent
 * {@link QNA_CHALLENGE_EVENT} that React listens for to render the
 * dialog. When the bundle later removes the popup (via
 * `_v2common.app.closeLayerPopup`), the same observer fires a
 * {@link QNA_DISMISS_EVENT} so React can unmount its mirror.
 *
 * <p>Submission: {@link submitNxisasQna} writes back to the hidden
 * popup — toggling `.selected` on the matching `<li>`, populating the
 * readonly `selectValue` trigger input (for the bundle's WBE6120
 * validation at `nxisas_v2.js:161`), populating the answer input
 * (`name='res'`), and triggering `.save` via `HTMLElement.click()`.
 * The bundle's handler runs synchronously and the engine proceeds.
 *
 * <p>Cancellation: {@link cancelNxisasQna} triggers the bundle's
 * `.cancel` handler at `nxisas_v2.js:78` which closes the popup and
 * aborts the in-progress 2nd-cert flow.
 *
 * <p>Scope: applies anywhere the NXiSAS bundle injects a
 * `security-question` popup — currently only the Own Account Transfer
 * Update Balance / Confirm Transfer flows. The Bank Transaction Sync
 * page does NOT use this bridge — it uses Coocon's server-side
 * scraping gateway, which returns a JSON QNA challenge consumed by
 * `<TransactionSyncDialog>` directly.
 */

import type { ApiQnaQuestion } from "@/lib/api/bankCredentials";

/* ===================================================================
 *  Public types + event constants
 * ================================================================= */

export const QNA_CHALLENGE_EVENT = "wb:nxisas-qna-challenge" as const;
export const QNA_DISMISS_EVENT   = "wb:nxisas-qna-dismiss" as const;

export type NxisasQnaChallenge = {
    /** Display name extracted from the popup's first `.top` header
     *  cell — populated by `nxisas_v2.js:1534` with
     *  `_v2nxisas.orgObj[ind].bankNm`. Used as the modal header. */
    bankName: string;
    /** Login ID extracted from the popup's second `.top` header cell
     *  (populated by `nxisas_v2.js:1535` with the orgObj's
     *  `loginID`). Shown read-only beside the bank name. */
    loginId:  string;
    /** Bank-supplied question list extracted from the popup's
     *  `#selectList0 li[data-val][data-hiddenval]` elements (built
     *  at `nxisas_v2.js:1549-1551`). Mapped to the snake_case wire
     *  shape `<QnaDialog>` consumes so the same component handles
     *  both NXiSAS-local and Coocon-server-side challenges. */
    questions: ApiQnaQuestion[];
    /** Opaque handle to the live `.layerCont.security-question`
     *  element. Pass back to {@link submitNxisasQna} /
     *  {@link cancelNxisasQna} so the bridge targets the correct
     *  popup when the user has multiple 2nd-cert challenges
     *  queued (the bundle's `_2ndCertList` can hold more than one). */
    popup: HTMLElement;
};

declare global {
    interface WindowEventMap {
        [QNA_CHALLENGE_EVENT]: CustomEvent<NxisasQnaChallenge>;
        [QNA_DISMISS_EVENT]:   CustomEvent<{ popup: HTMLElement }>;
    }
}

/* ===================================================================
 *  Internal — extract challenge metadata from the injected popup
 * ================================================================= */

const HEADER_LOGIN_LABELS = [
    // Match every locale variant of the bundle's `nxisas_v2_j065`
    // ML label rendered at `nxisas_v2.js:1522`. The DOM cell carries
    // the literal label + login ID joined by a non-breaking space:
    // `${ML_BANK_LOGID}&nbsp;${BANK_LOGID}`. We strip the label prefix
    // to leave the ID. The jexML shim returns the English fallback
    // ("Login ID") today, but Phase B may upgrade it — keeping the
    // KO/VI variants here means a locale flip on jexML doesn't break
    // the bridge.
    "Login ID",
    "로그인 아이디",
    "ID đăng nhập",
] as const;

function extractChallenge(popup: HTMLElement): NxisasQnaChallenge | null {
    // Two `.top > p` siblings — first is bank name, second is the
    // "Login ID NNN" pair. Order is guaranteed by the template at
    // `nxisas_v2.js:456-463`.
    const tops = popup.querySelectorAll<HTMLElement>(".top p");
    if (tops.length < 1) return null;
    const bankName = tops[0]?.textContent?.trim() ?? "";

    let loginId = "";
    if (tops.length >= 2) {
        // Pull just the ID, stripping the localized label prefix.
        // The bundle separates label and value with a non-breaking
        // space (`&nbsp;`), so a simple `split` on first whitespace
        // works for every locale.
        const raw = (tops[1]?.textContent ?? "")
            .replace(/ /g, " ")
            .trim();
        loginId = raw;
        for (const label of HEADER_LOGIN_LABELS) {
            if (loginId.startsWith(label)) {
                loginId = loginId.slice(label.length).trim();
                break;
            }
        }
    }

    // Question list — every `<li>` carries `data-val` (the human
    // question text) and `data-hiddenVal` (the bank's opaque token
    // echoed back with the answer). The bundle's template uses
    // mixed-case `data-hiddenVal` in markup but jQuery/`getAttribute`
    // normalises to lowercase. We accept either to be safe.
    const lis = popup.querySelectorAll<HTMLLIElement>(
        ".select-box-default-st #selectList0 > li",
    );
    const questions: ApiQnaQuestion[] = [];
    lis.forEach((li) => {
        const question = li.getAttribute("data-val")
            ?? li.textContent?.trim()
            ?? "";
        const hidden_value = li.getAttribute("data-hiddenval")
            ?? li.getAttribute("data-hiddenVal")
            ?? "";
        if (question) {
            questions.push({ hidden_value, question });
        }
    });

    return { bankName, loginId, questions, popup };
}

/* ===================================================================
 *  Submission — write back to legacy DOM + trigger bundle's handler
 * ================================================================= */

/**
 * Confirm path. Mirrors the user-action sequence the bundle's submit
 * handler ({@code nxisas_v2.js:137-330}) reads out of the popup DOM:
 *
 * <ol>
 *   <li>Mark the chosen `<li>` as `.selected` so
 *       `$("#selectList0 li.selected").attr('data-hiddenval')` returns
 *       the picked token (line 225).</li>
 *   <li>Populate the readonly `input[name='req']` trigger input —
 *       the bundle's validation guard at line 161 short-circuits with
 *       WBE6120 when this is empty.</li>
 *   <li>Populate the answer input (`name='res'`) — read at line
 *       226 / 195.</li>
 *   <li>Click `.btn-st.primary.save` to fire the bundle's existing
 *       jQuery-delegated submit handler. The handler builds the
 *       header + calls `_v2nxisas.execute(...)` and the engine
 *       proceeds — no further bridge work required.</li>
 * </ol>
 *
 * Native `HTMLElement.click()` triggers jQuery delegates the same
 * way a real user click does (jQuery binds to the native event).
 */
export function submitNxisasQna(
    popup:       HTMLElement,
    hiddenValue: string,
    question:    string,
    answer:      string,
): void {
    // 1. Toggle `.selected` on the matching `<li>`. Match by
    //    hiddenValue (the stable token) — `data-val` text could
    //    collide between locales or duplicate questions.
    popup.querySelectorAll<HTMLLIElement>("#selectList0 > li").forEach((li) => {
        const liHidden = li.getAttribute("data-hiddenval")
            ?? li.getAttribute("data-hiddenVal")
            ?? "";
        if (liHidden === hiddenValue) {
            li.classList.add("selected");
        } else {
            li.classList.remove("selected");
        }
    });

    // 2. Trigger input — `name='req'`, readonly. Populating this
    //    satisfies the WBE6120 guard at `nxisas_v2.js:161`.
    const trigger = popup.querySelector<HTMLInputElement>("input[name='req'].selectValue");
    if (trigger) {
        trigger.value = question;
    }

    // 3. Answer input — `name='res'`, the user's typed answer.
    const answerInput = popup.querySelector<HTMLInputElement>("input[name='res']");
    if (answerInput) {
        answerInput.value = answer;
    }

    // 4. Fire the bundle's `.save` click handler. Use native
    //    `.click()` so the jQuery-delegated handler at
    //    `nxisas_v2.js:137` fires on the bubbling phase.
    const saveBtn = popup.querySelector<HTMLElement>(".btn-st.primary.save");
    if (saveBtn) {
        saveBtn.click();
    }
}

/**
 * Cancel path. Triggers the bundle's existing `.cancel` click
 * handler ({@code nxisas_v2.js:77-130}) which closes the popup
 * (removes the `.layerCont` from `<body>`) and aborts the in-flight
 * 2nd-cert flow. The MutationObserver picks up the removal and
 * dispatches {@link QNA_DISMISS_EVENT} so the React mirror unmounts.
 */
export function cancelNxisasQna(popup: HTMLElement): void {
    const cancelBtn = popup.querySelector<HTMLElement>(".btn-st.common.cancel");
    if (cancelBtn) {
        cancelBtn.click();
        return;
    }
    // Fallback — bundle removed the cancel button (shouldn't happen,
    // but be defensive). Just detach the popup so the user's React
    // dialog closes; the engine flow will eventually time out.
    popup.parentElement?.removeChild(popup);
}

/* ===================================================================
 *  Observer install — idempotent
 * ================================================================= */

let installed = false;

/**
 * One-time install. Subsequent calls are no-ops. Safe to invoke
 * from the engine bootstrapper alongside
 * {@link installJexjsAdapter}.
 */
export function installNxisasQnaBridge(): void {
    if (installed) return;
    if (typeof window === "undefined" || typeof document === "undefined") return;
    installed = true;

    // Diagnostic — visible in browser console on first install.
    // The presence of this line confirms (a) qna-bridge.ts was
    // bundled, (b) installNxisasQnaBridge() was called by
    // installJexjsAdapter(), (c) the install branch ran (not the
    // SSR guard).
    console.log("[nxisas-qna-bridge] installed — observing document.body for .layerCont.security-question");

    // Track which popups we've already dispatched a challenge for so
    // we don't double-fire when the MutationObserver fires more than
    // once for the same node (it shouldn't, but Radix portal
    // shuffles can confuse observers).
    const seen = new WeakSet<HTMLElement>();

    const onAdded = (popup: HTMLElement) => {
        if (seen.has(popup)) return;
        seen.add(popup);
        const challenge = extractChallenge(popup);
        console.log(
            "[nxisas-qna-bridge] legacy popup detected — challenge extracted:",
            challenge
                ? {
                      bankName: challenge.bankName,
                      loginId:  challenge.loginId,
                      questions: challenge.questions.length,
                  }
                : "(extract failed — popup structure unexpected)",
        );
        if (!challenge) return;
        window.dispatchEvent(
            new CustomEvent<NxisasQnaChallenge>(QNA_CHALLENGE_EVENT, {
                detail: challenge,
            }),
        );
        console.log("[nxisas-qna-bridge] dispatched", QNA_CHALLENGE_EVENT);
    };

    const onRemoved = (popup: HTMLElement) => {
        if (!seen.has(popup)) return;
        // No need to mutate `seen` — the WeakSet drops the entry
        // automatically once the node is GC'd.
        console.log("[nxisas-qna-bridge] legacy popup removed — dispatching dismiss");
        window.dispatchEvent(
            new CustomEvent<{ popup: HTMLElement }>(QNA_DISMISS_EVENT, {
                detail: { popup },
            }),
        );
    };

    const observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
            m.addedNodes.forEach((n) => {
                if (n.nodeType !== Node.ELEMENT_NODE) return;
                const el = n as HTMLElement;
                if (el.classList?.contains("layerCont")
                    && el.classList.contains("security-question")) {
                    onAdded(el);
                }
            });
            m.removedNodes.forEach((n) => {
                if (n.nodeType !== Node.ELEMENT_NODE) return;
                const el = n as HTMLElement;
                if (el.classList?.contains("layerCont")
                    && el.classList.contains("security-question")) {
                    onRemoved(el);
                }
            });
        }
    });

    observer.observe(document.body, { childList: true });

    // Catch popups that the bundle might have appended before this
    // bridge mounted (unlikely, but cheap to handle).
    document.body
        .querySelectorAll<HTMLElement>(".layerCont.security-question")
        .forEach(onAdded);
}
