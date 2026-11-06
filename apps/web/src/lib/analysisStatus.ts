"use client";

import { useCapabilities } from "./query";

/** True only when the server says analysis works (provider configured). Until then the landing page says "Preview". */
export function useAnalysisAvailable(): boolean {
    const capabilities = useCapabilities();
    return capabilities.data?.analysis === true;
}

/** Copy used on the landing page once analysis is confirmed available. */
export const ANALYSIS_LIVE_COPY = {
    description: "Complexity, bottlenecks and edge cases for the code in your editor, with an optimized version. Sign in to run it.",
    points: ["Time and space complexity", "Bottlenecks and edge cases", "Needs an account. A daily limit applies; repeating the same code is free"],
    faq: "Yes. Sign in with Google, paste your code in the dashboard and press Analyze. A daily limit applies, and repeating an analysis of the same code is free.",
} as const;
