import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

const twMerge = extendTailwindMerge({
    extend: {
        classGroups: {
            // Classify all text-wb-{number} tokens as font-size so they don't
            // conflict with text-wb-{name} color tokens (e.g. text-wb-ink).
            "font-size": [
                {
                    text: [
                        {
                            wb: [
                                "10", "11", "12", "13",
                                "14", "14-tight", "14-loose",
                                "15", "16", "18", "22", "24", "28", "34",
                            ],
                        },
                    ],
                },
            ],
        },
    },
});

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}
