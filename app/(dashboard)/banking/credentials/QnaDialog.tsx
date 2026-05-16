"use client";

import { useState } from "react";

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
            <DialogContent
                stackLevel={4}
                aria-describedby={undefined}
                className="max-w-[560px] rounded-2xl p-0"
            >
                <form className="flex flex-col" onSubmit={handleSubmit}>
                    {/* Header row — title only. */}
                    <div className="flex items-center justify-between border-b border-wb-border-sidebar px-6 py-4">
                        <DialogTitle asChild>
                            <h2 className="text-wb-16 font-semibold text-wb-dark">
                                {t("banking.credentials.qna.title")}
                            </h2>
                        </DialogTitle>
                    </div>

                    {/* Body — bank name + login id summary row, then the
                       question dropdown and the answer input. */}
                    <div className="flex flex-col gap-4 px-6 py-5">
                        {/* Bank name (left) + Login ID (right) summary row. */}
                        <div className="flex items-center justify-between text-wb-14">
                            <span className="font-semibold text-wb-dark">{bankName}</span>
                            <span className="text-wb-ntrl-8">
                                <span className="text-wb-ntrl-6">
                                    {t("banking.credentials.qna.login_id_label")}
                                </span>
                                <span className="ml-3 font-medium text-wb-dark">
                                    {loginId}
                                </span>
                            </span>
                        </div>

                        {/* Question dropdown */}
                        <div className="flex items-start gap-4">
                            <label
                                htmlFor="qna-question"
                                className="flex w-[110px] shrink-0 items-center gap-0.5 pt-2 text-wb-14 font-medium text-wb-ntrl-8"
                            >
                                <span>{t("banking.credentials.qna.question_label")}</span>
                                <span aria-hidden className="text-wb-red-07">*</span>
                            </label>
                            <select
                                id="qna-question"
                                value={selectedHidden}
                                onChange={(e) => setSelectedHidden(e.target.value)}
                                disabled={submitting || questions.length === 0}
                                className="h-9 min-w-0 flex-1 rounded-md border border-wb-ntrl-4 bg-white px-3 text-wb-14 text-wb-ntrl-8 focus:outline-none focus:ring-1 focus:ring-brand disabled:bg-wb-ntrl-2"
                            >
                                <option value="" disabled>
                                    {t("banking.credentials.qna.question_placeholder")}
                                </option>
                                {questions.map((q) => (
                                    <option key={q.hidden_value} value={q.hidden_value}>
                                        {q.question}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Answer input */}
                        <div className="flex items-start gap-4">
                            <label
                                htmlFor="qna-answer"
                                className="flex w-[110px] shrink-0 items-center gap-0.5 pt-2 text-wb-14 font-medium text-wb-ntrl-8"
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
                                className="h-9 min-w-0 flex-1 rounded-md border border-wb-ntrl-4 bg-white px-3 text-wb-14 text-wb-ntrl-8 placeholder:text-wb-ntrl-5 focus:outline-none focus:ring-1 focus:ring-brand disabled:bg-wb-ntrl-2"
                            />
                        </div>

                        {questions.length === 0 && (
                            <p className="text-wb-13 italic text-wb-ntrl-6">
                                {t("banking.credentials.qna.no_questions")}
                            </p>
                        )}
                    </div>

                    {/* Footer — Cancel (white) + Confirm (brand blue). */}
                    <div className="flex items-center justify-end gap-2 border-t border-wb-border-sidebar px-6 py-3">
                        <button
                            type="button"
                            onClick={onCancel}
                            disabled={submitting}
                            className="flex h-8 cursor-pointer items-center justify-center rounded-md bg-white px-3 text-wb-14-tight font-medium tracking-wb-tight text-wb-ntrl-10 shadow-wb-btn hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {t("common.cancel")}
                        </button>
                        <button
                            type="submit"
                            disabled={
                                submitting ||
                                !selected ||
                                !answer.trim() ||
                                questions.length === 0
                            }
                            className="flex h-8 cursor-pointer items-center justify-center rounded-md bg-brand px-3 text-wb-14-tight font-medium tracking-wb-tight text-white shadow-wb-brand-btn hover:bg-brand-hover disabled:cursor-not-allowed disabled:bg-wb-ntrl-4 disabled:shadow-none"
                        >
                            {submitting
                                ? t("banking.credentials.qna.submitting")
                                : t("banking.credentials.qna.confirm")}
                        </button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
