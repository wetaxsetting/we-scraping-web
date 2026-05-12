/*
 * MarketingPanel — left/bottom illustration + feature band on the auth screen.
 *
 * Figma frames (source of truth):
 *   199:7830 Mobile  393×Null  → bottom of page, full width, pt-[88px]
 *   199:7493 Tablet   992×800  → 50% column on the LEFT, pt-[88px]
 *   199:7230 Laptop  1280×832  → 50% column on the LEFT, pt-[88px]
 *   199:6973 Desktop 1920×1000 → 50% column on the LEFT, pt-[88px]
 *
 * Tailwind breakpoint mapping per app contract (see CLAUDE.md / globals.css):
 *   Mobile   < 768  (default, no prefix)
 *   Tablet   ≥ 768  (md:)
 *   Laptop   ≥ 1280 (xl:) — Tailwind default
 *   Desktop  ≥ 1440 (2xl: — overridden from Tailwind's 1536 default)
 *
 * Typography (uniform across breakpoints, Figma WB365):
 *   hero title    → text-wb-34 SemiBold tracking-[-1.36px]; leading-[38px] on
 *                   mobile (wraps to 4 lines), leading-[48px] from md+.
 *   section title → text-wb-14 Bold   tracking-[-0.56px] #0b3c6f
 *   check item    → text-wb-12 Medium tracking-[-0.48px] #0b3c6f
 *
 * Bottom band layout — `grid grid-cols-2` at every breakpoint (matches the
 *   legacy `padding: 32px 100px; grid-template-columns: 1fr 1fr` band used
 *   at viewport ≤ 1740 in dev.wecms.vn).
 *
 * Illustration — single icon-cross composition (union SVG backdrop +
 *   8 individual icon SVGs in a 4-col × 3-row grid) rendered at every
 *   breakpoint. The previous hybrid (PNG `<picture>` below xl, icon-cross
 *   at xl+) was retired because the `xl:` toggle silently failed to fire
 *   when a 1280-px OS window had a vertical scrollbar (the CSS viewport
 *   ended up at ~1263 px, below the 1280-px breakpoint). Symptom: image
 *   stayed visible at the laptop range. Rendering individual SVGs at every
 *   width eliminates the race condition entirely — SVGs scale losslessly
 *   so the cross stays crisp from a 320-px mobile column up to a
 *   860-px desktop column.
 */

type Feature = { svgSrc: string; label: string; colStart: string };

// Cross pattern (Figma 199:6973 / 199:7230) — 4 columns × 3 rows:
// Row 1:     [2] [3]           지급관리, 모바일
// Row 2:  [1][2][3][4]         전계좌관리, 급여이체, 보고서, 법인카드 관리
// Row 3:     [2] [3]           국세청 전자세금계산서, 사업장 휴폐업조회
const features: Feature[] = [
    { svgSrc: "/images/login/icon-payment.svg",     label: "지급관리",               colStart: "col-start-2" },
    { svgSrc: "/images/login/icon-mobile.svg",      label: "모바일",                  colStart: "col-start-3" },
    { svgSrc: "/images/login/icon-all-account.svg", label: "전계좌관리",              colStart: "col-start-1" },
    { svgSrc: "/images/login/icon-salary.svg",      label: "급여이체",                colStart: "col-start-2" },
    { svgSrc: "/images/login/icon-reports.svg",     label: "보고서",                  colStart: "col-start-3" },
    { svgSrc: "/images/login/icon-corp-card.svg",   label: "법인카드 관리",            colStart: "col-start-4" },
    { svgSrc: "/images/login/icon-tax.svg",         label: "국세청 전자세금계산서",    colStart: "col-start-2" },
    { svgSrc: "/images/login/icon-business.svg",    label: "사업장 휴폐업조회",        colStart: "col-start-3" },
];

type Section = { svgSrc: string; title: string; items: readonly string[] };

const sections: readonly Section[] = [
    {
        svgSrc: "/images/login/ico-clock.svg",
        title: "수기업무 투입시간 감소",
        items: [
            "간편 지급결의서 작성",
            "원클릭 매입대급 결제",
            "실시간 자금 현황 보고서",
        ],
    },
    {
        svgSrc: "/images/login/ico-cursor.svg",
        title: "원클릭 조회",
        items: [
            "모든 금융기관 계좌정보 조회",
            "베트남국세청 매출/매입",
            "법인카드내역 조회",
        ],
    },
    {
        svgSrc: "/images/login/ico-network.svg",
        title: "모바일 앱 지원",
        items: [
            "외근 중에도 손쉬운 업무수행",
            "앱으로 실시간 보고서 확인",
            "지출결의서 작성도 손쉽게",
        ],
    },
    {
        svgSrc: "/images/login/ico-erp.svg",
        title: "ERP 연동",
        items: [
            "미사, SAP 다양한 ERP 연계",
            "엑셀 연계/API 연계 지원",
            "매칭내역 ERP 자동전송",
        ],
    },
];

export default function MarketingPanel() {
    return (
        <aside
            className="
                relative flex w-full max-w-full min-w-0 flex-col overflow-hidden bg-[#f0f7ff]
                gap-y-[48px] pt-[88px]
                md:order-1 md:flex-1 md:basis-1/2 md:justify-between md:gap-y-0 md:pt-[48px]
                xl:pt-[64px]
                2xl:pt-[88px]
            "
        >
            {/* ── Title + icon grid ───────────────────────────────────── */}
            <div
                className="
                    flex w-full min-w-0 flex-col items-center
                    gap-[48px]
                    md:gap-[20px]
                    xl:gap-[28px]
                    2xl:gap-[40px]
                "
            >
                {/* Hero title — 28px SemiBold tracking-[-1.12px] uniform across
                   every breakpoint (was Figma's 34/48 ladder). 28/40 leading
                   keeps the Korean copy on 1–3 lines depending on column width:
                   mobile wraps to 3, tablet/laptop to 2, desktop to 1.
                   `break-keep` enforces Korean word-boundary wrapping so no
                   line breaks mid-word on narrow viewports.
                   `max-w-[640px]` keeps the line measure comfortable on the
                   widest desktop column without the title stretching beyond
                   the icon illustration below it. */}
                <div className="w-full px-[20px] md:px-[40px]">
                    <h1 className="mx-auto max-w-[640px] break-keep text-center text-wb-28 font-semibold leading-[40px] tracking-[-1.12px] text-black">
                        자금업무는 빠르고 안전하게! 자동화하여 관리비용은 낮추고!
                    </h1>
                </div>

                {/*
                 * Illustration — single icon-cross composition rendered at
                 * EVERY breakpoint (matches Figma 199:7230 Laptop /
                 * 199:6973 Desktop frames).
                 *
                 * The previous hybrid (PNG <picture> below xl, icon-cross
                 * at xl+) was retired because Tailwind's `xl:` triggers at
                 * a *CSS-viewport* width of 1280 px, but a real browser
                 * window of 1280 px reserves ~17 px for the vertical
                 * scrollbar — so the user's actual viewport at OS-window
                 * 1280 was ~1263 and `xl:` silently failed to fire. Result:
                 * the image (the asset the user was trying to remove)
                 * stayed visible at 1280-px laptops.
                 *
                 * Rendering icons everywhere eliminates that whole race
                 * condition. SVGs scale losslessly, so the cross looks
                 * crisp at any column width — the responsive ladder below
                 * just rescales the cards / inner-icon / labels per
                 * breakpoint to match the Figma sizes.
                 *
                 * Card / inner-icon / radius / label ladder:
                 *   Mobile  (< md)            48 / 30 / 14 / 11
                 *   Tablet  (md ≤ < xl)       60 / 38 / 18 / 13
                 *   Laptop  (xl ≤ < 2xl)      70 / 44 / 22 / 14
                 *   Desktop (≥ 2xl)          100 / 64 / 30 / 14
                 *
                 * Container max-w follows the same ladder so the cross
                 * fills (and never overflows) the marketing column at
                 * each breakpoint.
                 */}
                <div
                    className="
                        relative mx-auto aspect-[924/505] w-full
                        max-w-[393px]
                        md:max-w-[440px]
                        xl:max-w-[640px]
                        2xl:max-w-[860px]
                    "
                >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src="/images/login/feature-union.svg"
                        alt=""
                        aria-hidden={true}
                        className="pointer-events-none absolute inset-0 z-0 h-full w-full"
                    />

                    <ul className="relative z-10 grid h-full grid-cols-4 grid-rows-3 content-between items-center justify-items-center">
                        {features.map(({ svgSrc, label, colStart }) => (
                            <li
                                key={label}
                                className={`${colStart} flex flex-col items-center gap-[6px] xl:gap-[8px] 2xl:gap-[10px]`}
                            >
                                <span
                                    className="
                                        relative flex items-center justify-center
                                        bg-[radial-gradient(circle_at_50%_100%,#e0eefe_0%,#ffffff_70%)]
                                        shadow-[0px_6px_20px_0px_rgba(0,96,185,0.07),0px_6px_10px_0px_rgba(0,96,185,0.06),0px_1px_4px_0px_rgba(0,0,0,0.08),0px_0px_0px_1px_#e7ecf3]
                                        before:pointer-events-none before:absolute before:inset-0 before:rounded-[inherit]
                                        before:shadow-[inset_0px_0px_0px_1px_#fdfdfd]
                                        size-[48px] rounded-[14px]
                                        md:size-[60px] md:rounded-[18px]
                                        xl:size-[70px] xl:rounded-[22px]
                                        2xl:size-[100px] 2xl:rounded-[30px]
                                    "
                                    aria-hidden={true}
                                >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={svgSrc}
                                        alt=""
                                        className="
                                            size-[30px]
                                            md:size-[38px]
                                            xl:size-[44px]
                                            2xl:size-[64px]
                                        "
                                    />
                                </span>
                                {/* Tile label — Figma 14/24 Medium tracking-[-0.56px] #404040.
                                   Hidden on Mobile (< 768) and Tablet (768–1279) — only the
                                   icon cards are shown there. Visible from Laptop up
                                   (xl ≥ 1280, Desktop ≥ 2xl 1440) at the full Figma scale. */}
                                <span className="hidden break-keep text-center text-wb-14 font-medium leading-[24px] tracking-[-0.56px] text-wb-ntrl-8 xl:block xl:whitespace-nowrap">
                                    {label}
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>

            {/*
             * Bottom feature band — responsive shape per breakpoint:
             *
             *   Mobile + Tablet (< xl) → exact Figma spec from node 199:7851
             *     (Mobile) / 199:7501 (Tablet):
             *       display: flex
             *       padding: 32px 48px
             *       gap: 32px 48px (row × column)
             *       justify-content: center
             *       align-items: center
             *       align-content: center
             *       flex-wrap: wrap
             *     Sections sit at their intrinsic width and wrap based on
             *     available row space — 1 per row at narrow phones, 2 per
             *     row at the 768–1279 tablet column.
             *
             *   Laptop + Desktop (≥ xl) → 1 × 4 CSS Grid with `items-start`
             *     so all 4 columns share equal width and the title rows sit
             *     on the same vertical baseline regardless of bullet count.
             */}
            <div
                className="
                    grid w-full min-w-0 shrink-0 grid-cols-1 justify-items-center
                    bg-[#e0eefe]
                    gap-y-[32px] px-[24px] py-[32px]
                    md:flex md:flex-wrap md:content-center md:items-start md:justify-center md:gap-x-[48px] md:gap-y-[32px] md:px-[48px] md:py-[32px]
                    xl:grid xl:grid-cols-4 xl:items-start xl:content-start xl:justify-items-stretch xl:gap-x-[16px] xl:gap-y-0 xl:px-[20px] xl:py-[24px]
                    2xl:gap-x-[32px] 2xl:px-[48px] 2xl:py-[32px]
                "
            >
                {sections.map(({ svgSrc, title, items }) => (
                    <div
                        key={title}
                        className="
                            flex w-[168px] shrink-0 flex-col items-start gap-[16px]
                            xl:w-full xl:shrink xl:gap-[12px]
                        "
                    >
                        {/* Icon + section title — Figma 14/24 Bold tracking-[-0.56px] #0b3c6f.
                           md+ keeps the title on one line. xl drops to text-wb-12 +
                           size-24 icon so all 4 sections fit a 631w column at xl=1280
                           without title wrap. 2xl scales the title back to the Figma
                           14/24 spec since the 720+w column has room for it. */}
                        <div className="flex w-full items-center gap-[8px] xl:gap-[6px] 2xl:gap-[8px]">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={svgSrc}
                                alt=""
                                aria-hidden={true}
                                className="size-[32px] shrink-0 xl:size-[24px] 2xl:size-[32px]"
                            />
                            <span
                                className="
                                    min-w-0 flex-1 break-keep text-wb-14 font-bold leading-[24px] tracking-[-0.56px] text-wb-navy
                                    md:whitespace-nowrap
                                    xl:text-wb-12 xl:leading-[18px] xl:tracking-[-0.48px]
                                    2xl:text-wb-14 2xl:leading-[24px] 2xl:tracking-[-0.56px]
                                "
                            >
                                {title}
                            </span>
                        </div>
                        {/* Check-item list — Figma 12/16 Medium tracking-[-0.48px] #0b3c6f.
                           Bullets stay 12px on every breakpoint and align with the
                           section's left edge (no hanging indent — matches the legacy
                           dev.wecms.vn layout where the check column sits flush with
                           the section icon column). */}
                        <ul className="flex w-full min-w-0 flex-col gap-[4px]">
                            {items.map((it) => (
                                <li
                                    key={it}
                                    className="flex w-full min-w-0 items-start gap-[6px] xl:gap-[4px]"
                                >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src="/images/login/ico-check.svg"
                                        alt=""
                                        aria-hidden={true}
                                        className="size-[16px] shrink-0 xl:size-[12px] 2xl:size-[16px]"
                                    />
                                    <span className="min-w-0 flex-1 break-keep text-wb-12 font-medium leading-[16px] tracking-[-0.48px] text-wb-navy xl:whitespace-nowrap">
                                        {it}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>
        </aside>
    );
}
