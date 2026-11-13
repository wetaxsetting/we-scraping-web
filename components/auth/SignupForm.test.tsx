import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ request: vi.fn(), post: vi.fn() }));

vi.mock("@/lib/axios", async (io) => {
    const real = await io<typeof import("@/lib/axios")>();
    return { ...real, api: { ...real.api, post: h.post } };
});
vi.mock("next/link", () => ({ default: ({ href, children, ...p }: { href: string; children: React.ReactNode }) => <a href={href} {...p}>{children}</a> }));

import { SignupForm, validateSignup } from "@/components/auth/SignupForm";
import { tokenStorage, userStorage } from "@/lib/auth/storage";
import { LocaleProvider } from "@/lib/i18n";

// docs/features/weinvoice/weinvoice-self-signup-2026-11-13.md

const ok = (data: unknown) => ({ data: { status: { error: false, code: "WBI0000", message: "OK" }, data } });

function fill(values: Partial<Record<"name" | "email" | "phone" | "company" | "pw" | "confirm", string>>) {
    const ids = { name: "su-name", email: "su-email", phone: "su-phone", company: "su-company", pw: "su-pw", confirm: "su-confirm" } as const;
    for (const [k, v] of Object.entries(values)) {
        fireEvent.change(document.getElementById(ids[k as keyof typeof ids])!, { target: { value: v } });
    }
}

function renderForm() {
    const onDone = vi.fn();
    render(
        <LocaleProvider>
            <SignupForm onDone={onDone} />
        </LocaleProvider>,
    );
    return onDone;
}

describe("validateSignup", () => {
    it("mirrors the backend rules", () => {
        const good = { name: "A", email: "a@b.vn", password: "abc12345", confirm: "abc12345" };
        expect(validateSignup(good)).toEqual({});
        expect(validateSignup({ ...good, email: "a@b" }).email).toBe("signup.err.email");
        expect(validateSignup({ ...good, password: "abcdefgh", confirm: "abcdefgh" }).password).toBe("signup.err.password");
        expect(validateSignup({ ...good, password: "1234567a", confirm: "x" }).confirm).toBe("signup.err.confirm");
        expect(validateSignup({ ...good, name: " " }).name).toBe("signup.err.required");
    });
});

describe("SignupForm", () => {
    beforeEach(() => {
        h.post.mockReset();
        tokenStorage.clear();
        userStorage.clear();
    });

    it("does not call the backend while the form is invalid", () => {
        renderForm();
        fill({ name: "Nguyễn Văn A", email: "bad", pw: "short", confirm: "other" });
        fireEvent.click(screen.getByRole("button", { name: "Tạo tài khoản" }));
        expect(h.post).not.toHaveBeenCalled();
        expect(screen.getByText("Email không hợp lệ.")).toBeTruthy();
        expect(screen.getByText("Mật khẩu nhập lại không khớp.")).toBeTruthy();
    });

    it("posts snake_case fields, stores the session and continues", async () => {
        h.post.mockResolvedValue(ok({
            access_token: "jwt", token_type: "Bearer", expires_in: 3600, user_id: "a@b.vn", user_nm: "Nguyễn Văn A",
            biz_key: "WEINVOICE", lang_cd: "VI", cmpn_nm: "Công ty A", auth_gr_cd: "USER",
        }));
        const onDone = renderForm();
        fill({ name: " Nguyễn Văn A ", email: "a@b.vn", phone: "0901", company: "Công ty A", pw: "abc12345", confirm: "abc12345" });
        fireEvent.click(screen.getByRole("button", { name: "Tạo tài khoản" }));

        await waitFor(() => expect(onDone).toHaveBeenCalled());
        expect(h.post).toHaveBeenCalledWith("/api/v1/auth/signup", {
            email: "a@b.vn", user_nm: "Nguyễn Văn A", user_pw: "abc12345", clph_no: "0901", cmpn_nm: "Công ty A",
        });
        expect(tokenStorage.get()).toBe("jwt");
        expect(userStorage.get()?.companyName).toBe("Công ty A");
    });

    it("shows the backend message when the email is taken", async () => {
        h.post.mockRejectedValue(Object.assign(new Error("400"), {
            isAxiosError: true,
            response: { data: { status: { error: true, code: "WBE3040", message: "Email a@b.vn đã được đăng ký. Vui lòng đăng nhập." } } },
        }));
        const onDone = renderForm();
        fill({ name: "A", email: "a@b.vn", pw: "abc12345", confirm: "abc12345" });
        fireEvent.click(screen.getByRole("button", { name: "Tạo tài khoản" }));

        expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Email a@b.vn đã được đăng ký. Vui lòng đăng nhập. (WBE3040)");
        expect(onDone).not.toHaveBeenCalled();
        expect((screen.getByRole("button", { name: "Tạo tài khoản" }) as HTMLButtonElement).disabled).toBe(false);
    });
});
