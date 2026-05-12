import LoginForm from "@/components/auth/LoginForm";
import MarketingPanel from "@/components/auth/MarketingPanel";

export const metadata = {
    title: "Login — WeCMS",
};

export default function LoginPage() {
    /*
     * DOM order is form first → marketing panel second so mobile readers
     * (Figma 199:7830) see the login form at the top of the page. At md+
     * the auth layout is `flex-row` and CSS `order` flips visual order
     * so the marketing panel appears on the left, form on the right
     * (Figma 199:7493 / 199:7230 / 199:6973).
     */
    return (
        <>
            <LoginForm />
            <MarketingPanel />
        </>
    );
}
