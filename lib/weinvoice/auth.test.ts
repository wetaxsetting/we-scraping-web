import { AxiosError, type AxiosResponse } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ post: vi.fn(), get: vi.fn() }));

vi.mock("@/lib/axios", async (importOriginal) => {
    const real = await importOriginal<typeof import("@/lib/axios")>();
    return { ...real, api: { ...real.api, post: h.post, get: h.get } };
});

import { tokenStorage, userStorage } from "@/lib/auth/storage";
import { AuthError, fetchMe, login, logout, session } from "@/lib/weinvoice/auth";

const ok = <T,>(data: T) => ({ data: { status: { error: false, code: "WBI0000", message: "OK" }, data } }) as AxiosResponse;

beforeEach(() => {
    h.post.mockReset();
    h.get.mockReset();
    window.localStorage.clear();
});

describe("login — contract of POST /api/v1/auth/login (dto/LoginResponse)", () => {
    it("stores the token + profile on the authenticated shape and maps snake_case once", async () => {
        h.post.mockResolvedValue(
            ok({ access_token: "jwt-1", token_type: "Bearer", expires_in: 3600, user_id: "u1", user_nm: "Nguyễn An", biz_key: "VN_X_000001", lang_cd: "VI", cmpn_nm: "Công ty A", auth_gr_cd: "ADMIN", tax_id: "0109876543" }),
        );
        await expect(login("u1", "pw")).resolves.toEqual({ kind: "authenticated" });
        expect(h.post).toHaveBeenCalledWith("/api/v1/auth/login", { user_id: "u1", user_pw: "pw" });
        expect(tokenStorage.get()).toBe("jwt-1");
        expect(session.get()).toEqual({ userId: "u1", name: "Nguyễn An", companyName: "Công ty A", taxId: "0109876543", role: "ADMIN" });
    });

    it("returns the company chooser without storing a token, and re-posts with biz_key", async () => {
        h.post.mockResolvedValueOnce(ok({ user_id: "u1", user_nm: "An", companies_available: [{ biz_key: "VN_A", cmpn_nm: "A" }, { biz_key: "VN_B", cmpn_nm: "B" }] }));
        await expect(login("u1", "pw")).resolves.toEqual({ kind: "chooser", companies: [{ bizKey: "VN_A", companyName: "A" }, { bizKey: "VN_B", companyName: "B" }] });
        expect(tokenStorage.get()).toBeNull();

        h.post.mockResolvedValueOnce(ok({ access_token: "jwt-b", user_id: "u1", user_nm: "An", biz_key: "VN_B", cmpn_nm: "B" }));
        await login("u1", "pw", "VN_B");
        expect(h.post).toHaveBeenLastCalledWith("/api/v1/auth/login", { user_id: "u1", user_pw: "pw", biz_key: "VN_B" });
        expect(tokenStorage.get()).toBe("jwt-b");
    });

    it("surfaces the backend error code from a status.error envelope", async () => {
        h.post.mockResolvedValue({ data: { status: { error: true, code: "WBE1009", message: "ID or password does not match." }, trace_id: "T1" } });
        await expect(login("u1", "bad")).rejects.toMatchObject({ code: "WBE1009", message: "ID or password does not match.", traceId: "T1" });
    });

    it("maps a request with no response to WBE_NETWORK", async () => {
        h.post.mockRejectedValue(new AxiosError("Network Error", "ERR_NETWORK"));
        const err = await login("u1", "pw").catch((e) => e);
        expect(err).toBeInstanceOf(AuthError);
        expect(err.code).toBe("WBE_NETWORK");
    });
});

describe("fetchMe / logout", () => {
    it("rehydrates the profile from GET /api/v1/auth/me", async () => {
        tokenStorage.set("jwt");
        h.get.mockResolvedValue(ok({ user_id: "u1", user_nm: "An", biz_key: "VN_A", lang_cd: "VI", cmpn_nm: "Công ty B", auth_gr_cd: "USER", tax_id: null, all_menus: false, allowed_menu_cds: [] }));
        await fetchMe();
        expect(userStorage.get()).toMatchObject({ companyName: "Công ty B", role: "USER", taxId: "" });
    });

    it("clears auth keys even when the server call fails, and keeps the language choice", async () => {
        tokenStorage.set("jwt");
        window.localStorage.setItem("wecms_locale", "KO");
        h.post.mockRejectedValue(new Error("down"));
        await logout();
        expect(tokenStorage.get()).toBeNull();
        expect(userStorage.get()).toBeNull();
        expect(window.localStorage.getItem("wecms_locale")).toBe("KO");
    });
});
