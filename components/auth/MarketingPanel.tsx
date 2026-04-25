/*
 * Typography — Figma WB365 (source of truth).
 *   hero title (Figma 4728:40157) → 34/48 SemiBold -0.04em; responsive ladder:
 *        base  text-wb-22 (22/32)
 *        md    text-wb-28 (28/40)
 *        2xl   text-wb-34 (34/48)
 *   tile label (Figma 4728:40188…) → 14/24 Medium -0.04em #404040
 *   bottom-band section title      → 14/24 Bold  -0.04em #0b3c6f
 *   bottom-band check items        → 12/16 Medium -0.04em #0b3c6f
 * Weights: SemiBold (600) for hero, Bold (700) for section titles, Medium (500) elsewhere.
 * Tracking: tracking-wb-tighter (-0.04em) across the panel (Korean copy).
 */

type Feature = { svgSrc: string; label: string; colStart: string };

// 4-column grid — 3 rows (Figma cross pattern, matches both Laptop 1280 and Desktop 1920):
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
        <aside className="relative hidden min-h-screen flex-col justify-between overflow-hidden bg-[#f0f7ff] pt-[64px] md:flex lg:pt-[88px]">
            {/* ── Title + icon grid ── */}
            <div className="flex flex-col items-center gap-[32px] lg:gap-[48px]">
                {/* Hero title — Figma 4728:40157: 34/48 SemiBold -0.04em.
                   Responsive ladder: 22 mobile → 28 md → 34 desktop (2xl).  */}
                <div className="flex w-full items-center justify-center px-[32px] lg:px-[48px] 2xl:px-[64px]">
                    <h1 className="text-center font-semibold whitespace-normal text-black text-wb-22 tracking-wb-tighter md:text-wb-28 2xl:text-wb-34">
                        자금업무는 빠르고 안전하게! 자동화하여 관리비용은 낮추고!
                    </h1>
                </div>

                {/* Icon grid with union SVG backdrop */}
                <div className="relative mx-auto aspect-[924/505] w-full max-w-[520px] lg:max-w-[680px] xl:max-w-[760px] 2xl:max-w-[860px]">
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
                                className={`${colStart} flex flex-col items-center gap-[8px] lg:gap-[10px] 2xl:gap-[12px]`}
                            >
                                <span
                                    className="relative flex size-[56px] items-center justify-center rounded-[16px] bg-[radial-gradient(circle_at_50%_100%,#e0eefe_0%,#ffffff_70%)] shadow-[0px_6px_20px_0px_rgba(0,96,185,0.07),0px_6px_10px_0px_rgba(0,96,185,0.06),0px_1px_4px_0px_rgba(0,0,0,0.08),0px_0px_0px_1px_#e7ecf3] before:pointer-events-none before:absolute before:inset-0 before:rounded-[inherit] before:shadow-[inset_0px_0px_0px_1px_#fdfdfd] lg:size-[76px] lg:rounded-[22px] xl:size-[88px] xl:rounded-[26px] 2xl:size-[100px] 2xl:rounded-[30px]"
                                    aria-hidden={true}
                                >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={svgSrc}
                                        alt=""
                                        className="size-[36px] lg:size-[48px] xl:size-[56px] 2xl:size-[64px]"
                                    />
                                </span>
                                {/* Tile label — Figma: 14/24 Medium -0.04em #404040 */}
                                <span className="whitespace-nowrap text-center text-wb-12 font-medium tracking-wb-tighter text-wb-ntrl-8 lg:text-wb-14">
                                    {label}
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>

            {/* ── Bottom feature band ── */}
            <div className="flex w-full shrink-0 items-start justify-center gap-[12px] bg-[#e0eefe] px-[16px] py-[20px] lg:gap-[24px] lg:px-[24px] lg:py-[24px] xl:gap-[32px] 2xl:gap-[48px] 2xl:py-[28px]">
                {sections.map(({ svgSrc, title, items }) => (
                    <div key={title} className="flex w-[124px] flex-col gap-[6px] lg:w-[150px] lg:gap-[8px] 2xl:w-[168px] 2xl:gap-[10px]">
                        {/* Icon + section title — Figma: 14/24 Bold -0.04em #0b3c6f */}
                        <div className="flex items-center gap-[6px] lg:gap-[8px]">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={svgSrc}
                                alt=""
                                aria-hidden={true}
                                className="size-[22px] shrink-0 lg:size-[28px] 2xl:size-[32px]"
                            />
                            <span className="whitespace-nowrap text-wb-12 font-bold tracking-wb-tighter text-wb-navy lg:text-wb-14">
                                {title}
                            </span>
                        </div>
                        {/* Check-item list — Figma: 12/16 Medium -0.04em #0b3c6f */}
                        <ul className="flex flex-col gap-[2px] 2xl:gap-[4px]">
                            {items.map((it) => (
                                <li key={it} className="flex items-center gap-[4px] 2xl:gap-[6px]">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src="/images/login/ico-check.svg"
                                        alt=""
                                        aria-hidden={true}
                                        className="size-[9px] shrink-0 lg:size-[10px] 2xl:size-[12px]"
                                    />
                                    <span className="truncate text-wb-12 font-medium tracking-wb-tighter text-wb-navy">
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
