import LoginForm from "@/components/auth/LoginForm";
import MarketingPanel from "@/components/auth/MarketingPanel";

export const metadata = {
    title: "Login — WeCMS",
};

export default function LoginPage() {
    return (
        <>
            <MarketingPanel />
            <LoginForm />
        </>
    );
}
