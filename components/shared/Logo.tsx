import clsx from "clsx";

type LogoProps = {
    className?: string;
};

export default function Logo({ className }: LogoProps) {
    return (
        <div
            className={clsx(
                "text-wb-34 font-bold tracking-wb-tight leading-none",
                className,
            )}
            aria-label="WeCMS"
        >
            <span className="text-brand">We</span>
            <span className="text-neutral-900">CMS</span>
        </div>
    );
}
