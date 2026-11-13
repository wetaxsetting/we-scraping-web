"use client";

import { useRouter } from "next/navigation";

import { AuthShell, nextPath } from "@/components/auth/AuthShell";
import { SignupForm } from "@/components/auth/SignupForm";

/** Public WeInvoice self sign-up (docs/features/weinvoice/weinvoice-self-signup-2026-11-13.md). */
export default function RegisterPage() {
    const router = useRouter();
    return (
        <AuthShell>
            <SignupForm onDone={() => router.replace(nextPath())} />
        </AuthShell>
    );
}
