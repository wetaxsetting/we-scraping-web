"use client";

import { useEffect, useRef, useState } from "react";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useTranslation } from "@/lib/i18n";
import type { ApiQnaQuestion } from "@/lib/api/bankCredentials";

type Props = {
    /** Bank display name shown in the header row (e.g. "Shinhan VN"). */
    bankName: string;
    /** Login ID the user just typed, shown read-only in the header row. */
    loginId: string;
    /** Bank-supplied list of security questions. Empty array renders
     *  a "no questions returned" message so the user can cancel. */
    questions: ApiQnaQuestion[];
    /** Submit handler — passes the picked question's {@code hidden_value}
     *  + {@code question} + the typed {@code answer} back so the panel
     *  can POST {@code /api/v1/banking/scraping/{sessionId}/qna}. */
    onSubmit: (payload: { hidden_value: string; question: string; answer: string }) => Promise<void> | void;
    onCancel: () => void;
};

/**
 * Security-question challenge dialog. Mirrors the legacy
 * comm_0218_nxisas {@code .security-question} popup — the user picks
 * ONE question from the bank's list (typically 3 options) and types
 * its answer. Stacked on top of the Login ID/PW dialog
 * ({@code stackLevel={4}}) so the modal stack reads:
 * Settings (1) → Registered (2) → Login ID/PW (3) → Security Question (4).
 */
export function QnaDialog({
    bankName,
    loginId,
    questions,
    onSubmit,
    onCancel,
}: Props) {
    const { t } = useTranslation();
    const [selectedHidden, setSelectedHidden] = useState<string>("");
    const [answer, setAnswer] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const selected = questions.find((q) => q.hidden_value === selectedHidden);

    // Confirm lights up only when a question is picked AND an answer is
    // typed (and the bank actually returned questions). Submitting locks
    // it. Computed once so the disabled attr + the disabled visual stay
    // in lockstep — and so the button class can switch without resizing.
    const isConfirmDisabled =
        submitting || !selected || !answer.trim() || questions.length === 0;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selected || !answer.trim()) return;
        setSubmitting(true);
        try {
            await onSubmit({
                hidden_value: selected.hidden_value,
                question: selected.question,
                answer: answer.trim(),
            });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog open onOpenChange={(open) => !open && !submitting && onCancel()}>
            {/* Same shell as the sibling LoginIdPasswordDialog (the popup
               this stacks on): max-w-[440px] + rounded-2xl, a single
               padded column with NO header/footer divider, and the
               primitive's default close X (size-6 @ right-4 top-4). */}
            <DialogContent
                stackLevel={4}
                aria-describedby={undefined}
                /* overflow-visible (overrides the primitive's overflow-hidden)
                   so the custom Question dropdown menu can extend past the
                   dialog box like a real popover — the native <select> was
                   OS-rendered above everything; a styled absolute menu needs
                   the clip lifted. Corners stay rounded (border-radius clips
                   the background, not overflow) and the form's p-6 keeps
                   content off the corners. */
                className="max-w-[440px] overflow-visible rounded-2xl"
            >
                <form className="flex flex-col gap-6 p-6" onSubmit={handleSubmit}>
                    {/* Title — same size/weight as the sibling dialogs. */}
                    <DialogTitle asChild>
                        <h2 className="text-wb-16 font-semibold text-wb-dark">
                            {t("banking.credentials.qna.title")}
                        </h2>
                    </DialogTitle>

                    {/* Bank / Login info box — bank name (left) + Login ID
                       label/value (right), vertically centered in a grey
                       bordered box (shared Settings tokens). */}
                    <div className="flex items-center justify-between rounded-md border border-wb-ntrl-4 bg-wb-bg-sidebar px-4 py-3">
                        <span className="text-wb-14 font-semibold text-wb-dark">
                            {bankName}
                        </span>
                        <span className="flex items-center gap-3 text-wb-14">
                            <span className="text-wb-ntrl-6">
                                {t("banking.credentials.qna.login_id_label")}
                            </span>
                            <span className="font-medium text-wb-dark">
                                {loginId}
                            </span>
                        </span>
                    </div>

                    {/* Fields — stacked label above full-width control,
                       matching the sibling FormField rhythm. */}
                    <div className="flex flex-col gap-4">
                        {/* Question select */}
                        <div className="flex flex-col gap-2">
                            <label
                                htmlFor="qna-question"
                                className="flex items-start gap-0.5 text-wb-14 font-medium leading-4 text-wb-ntrl-8"
                            >
                                <span>{t("banking.credentials.qna.question_label")}</span>
                                <span aria-hidden className="text-wb-red-07">*</span>
                            </label>
                            <QuestionDropdown
                                inputId="qna-question"
                                placeholder={t("banking.credentials.qna.question_placeholder")}
                                questions={questions}
                                value={selectedHidden}
                                onChange={setSelectedHidden}
                                disabled={submitting || questions.length === 0}
                            />
                        </div>

                        {/* Answer input */}
                        <div className="flex flex-col gap-2">
                            <label
                                htmlFor="qna-answer"
                                className="flex items-start gap-0.5 text-wb-14 font-medium leading-4 text-wb-ntrl-8"
                            >
                                <span>{t("banking.credentials.qna.answer_label")}</span>
                                <span aria-hidden className="text-wb-red-07">*</span>
                            </label>
                            <input
                                id="qna-answer"
                                type="text"
                                autoComplete="off"
                                spellCheck={false}
                                value={answer}
                                onChange={(e) => setAnswer(e.target.value)}
                                placeholder={t("banking.credentials.qna.answer_placeholder")}
                                disabled={submitting || !selected}
                                className="w-full rounded-md border border-wb-ntrl-4 bg-white px-3 py-2 text-wb-14 font-medium text-wb-ntrl-8 placeholder:text-wb-ntrl-5 outline-none focus:ring-1 focus:ring-brand disabled:bg-wb-ntrl-2"
                            />
                        </div>

                        {questions.length === 0 && (
                            <p className="text-wb-12 font-medium text-wb-ntrl-6">
                                {t("banking.credentials.qna.no_questions")}
                            </p>
                        )}
                    </div>

                    {/* Footer — clean (no top divider), right-aligned.
                       Buttons keep their size during submit: the label
                       doesn't swap, only the disabled visual changes. */}
                    <div className="flex items-center justify-end gap-2">
                        <button
                            type="button"
                            onClick={onCancel}
                            disabled={submitting}
                            aria-disabled={submitting}
                            className={
                                submitting
                                    ? "flex h-8 cursor-not-allowed items-center justify-center rounded-md bg-white px-3 text-wb-14-tight font-medium tracking-wb-tight text-wb-ntrl-5 shadow-wb-btn opacity-60"
                                    : "flex h-8 cursor-pointer items-center justify-center rounded-md bg-white px-3 text-wb-14-tight font-medium tracking-wb-tight text-wb-ntrl-10 shadow-wb-btn hover:bg-black/[0.03]"
                            }
                        >
                            {t("common.cancel")}
                        </button>
                        <button
                            type="submit"
                            disabled={isConfirmDisabled}
                            aria-disabled={isConfirmDisabled}
                            className={
                                isConfirmDisabled
                                    ? "flex h-8 cursor-not-allowed items-center justify-center rounded-md bg-wb-ntrl-4 px-3 text-wb-14-tight font-medium tracking-wb-tight text-white"
                                    : "flex h-8 cursor-pointer items-center justify-center rounded-md bg-brand px-3 text-wb-14-tight font-medium tracking-wb-tight text-white shadow-wb-brand-btn hover:bg-brand-hover"
                            }
                        >
                            {t("banking.credentials.qna.confirm")}
                        </button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}

type QuestionDropdownProps = {
    inputId: string;
    placeholder: string;
    questions: ApiQnaQuestion[];
    value: string;
    onChange: (next: string) => void;
    disabled: boolean;
};

/**
 * Security-question picker. A custom popdown (NOT a native `<select>`)
 * so the open menu matches the common Settings select styling — the
 * native option list is OS-rendered and can't be themed (gray
 * placeholder highlight, oversized rows). Mirrors the sibling
 * {@code LoginTypeDropdown} in {@code LoginIdPasswordDialog}: a
 * bordered trigger button + an absolute {@code <ul role="listbox">}
 * the SAME width as the trigger (left-0 right-0), 4px below it, with
 * {@code hover:bg-wb-bg-sidebar} rows and the selected row tinted
 * {@code bg-wb-bg-sidebar}. Closes on outside-click / Esc (Esc
 * collapses the menu only — the dialog keeps its own Esc).
 */
function QuestionDropdown({
    inputId,
    placeholder,
    questions,
    value,
    onChange,
    disabled,
}: QuestionDropdownProps) {
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const selected = questions.find((q) => q.hidden_value === value) ?? null;
    const selectedLabel = selected ? selected.question : placeholder;

    useEffect(() => {
        if (!open) return;
        const handlePointerDown = (e: MouseEvent) => {
            if (!containerRef.current) return;
            if (containerRef.current.contains(e.target as Node)) return;
            setOpen(false);
        };
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                e.stopPropagation();
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", handlePointerDown);
        document.addEventListener("keydown", handleKey, true);
        return () => {
            document.removeEventListener("mousedown", handlePointerDown);
            document.removeEventListener("keydown", handleKey, true);
        };
    }, [open]);

    return (
        <div ref={containerRef} className="relative">
            <button
                id={inputId}
                type="button"
                disabled={disabled}
                onClick={() => !disabled && setOpen((prev) => !prev)}
                aria-haspopup="listbox"
                aria-expanded={open}
                className={
                    disabled
                        ? "flex w-full cursor-not-allowed items-center gap-1 rounded-md border border-wb-ntrl-4 bg-wb-ntrl-2 px-3 py-2 text-left"
                        : "flex w-full cursor-pointer items-center gap-1 rounded-md border border-wb-ntrl-4 bg-white px-3 py-2 text-left"
                }
            >
                <span
                    className={
                        "min-w-0 flex-1 truncate text-wb-14 font-medium leading-4 " +
                        (selected ? "text-wb-ntrl-8" : "text-wb-ntrl-5")
                    }
                >
                    {selectedLabel}
                </span>
                {/* Caret — points down when closed, up when open (same
                   glyph + rotation as the sibling LoginTypeDropdown). */}
                <span
                    aria-hidden
                    className="flex size-4 shrink-0 items-center justify-center text-wb-ntrl-6"
                >
                    <svg
                        viewBox="0 0 12 12"
                        className={
                            open
                                ? "size-3 rotate-180 transition-transform"
                                : "size-3 transition-transform"
                        }
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <polyline points="2 4 6 8 10 4" />
                    </svg>
                </span>
            </button>

            {open && (
                <ul
                    role="listbox"
                    aria-label={placeholder}
                    className="absolute left-0 right-0 top-[calc(100%+4px)] z-20 max-h-60 overflow-auto custom-scrollbar-y rounded-md border border-wb-ntrl-4 bg-white shadow-[0px_1px_1px_0px_rgba(0,0,0,0.1),0px_0px_2px_0px_rgba(0,0,0,0.1),0px_6px_20px_0px_rgba(0,0,0,0.1)]"
                >
                    {questions.map((q) => {
                        const isSelected = q.hidden_value === value;
                        return (
                            <li
                                key={q.hidden_value}
                                role="option"
                                aria-selected={isSelected}
                            >
                                <button
                                    type="button"
                                    onClick={() => {
                                        onChange(q.hidden_value);
                                        setOpen(false);
                                    }}
                                    className={
                                        "flex w-full cursor-pointer items-center px-3 py-2 text-left text-wb-14 font-medium leading-4 text-wb-ntrl-8 hover:bg-wb-bg-sidebar " +
                                        (isSelected ? "bg-wb-bg-sidebar" : "bg-white")
                                    }
                                >
                                    {q.question}
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
