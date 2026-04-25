import type { DialogType } from "./types";

/**
 * 38×38 inline badge glyph per dialog type — stand-in for the Figma-exported
 * assets (ico_warning_16, ico_clear, icon_success, ico_question) which are not
 * yet in `public/assets/`. Colors match the WB365 status ramp:
 *   warning → amber  #F5A524
 *   error   → red    #D64545
 *   success → green  #29B27A
 *   confirm → brand  #0060B9
 */

const COLORS: Record<DialogType, string> = {
    warning: "#F5A524",
    error: "#D64545",
    success: "#29B27A",
    confirmation: "#0060B9",
};

type Props = { type: DialogType; className?: string };

export default function DialogIcon({ type, className }: Props) {
    const color = COLORS[type];
    return (
        <span className={className} aria-hidden>
            {type === "warning" && (
                <svg viewBox="0 0 38 38" width="38" height="38" xmlns="http://www.w3.org/2000/svg">
                    <path d="M19 4 L35 32 L3 32 Z" fill={color} />
                    <rect x="17.5" y="13" width="3" height="11" rx="1.5" fill="white" />
                    <circle cx="19" cy="27.5" r="1.75" fill="white" />
                </svg>
            )}
            {type === "error" && (
                <svg viewBox="0 0 38 38" width="38" height="38" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="19" cy="19" r="15" fill={color} />
                    <path
                        d="M13.5 13.5 L24.5 24.5 M24.5 13.5 L13.5 24.5"
                        stroke="white"
                        strokeWidth="2.75"
                        strokeLinecap="round"
                    />
                </svg>
            )}
            {type === "success" && (
                <svg viewBox="0 0 38 38" width="38" height="38" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="19" cy="19" r="15" fill={color} />
                    <path
                        d="M12 19.5 L17 24.5 L26 14.5"
                        stroke="white"
                        strokeWidth="2.75"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        fill="none"
                    />
                </svg>
            )}
            {type === "confirmation" && (
                <svg viewBox="0 0 38 38" width="38" height="38" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="19" cy="19" r="15" fill={color} />
                    <path
                        d="M15 15.5 C15 12.75 17 11 19 11 C21.25 11 23 12.75 23 14.75 C23 16.5 22 17.5 20.5 18.5 C19.25 19.25 19 19.75 19 21"
                        stroke="white"
                        strokeWidth="2.25"
                        strokeLinecap="round"
                        fill="none"
                    />
                    <circle cx="19" cy="26" r="1.75" fill="white" />
                </svg>
            )}
        </span>
    );
}
