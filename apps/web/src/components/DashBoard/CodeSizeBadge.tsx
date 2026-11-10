// Phase 0b-2: live code size indicator
"use client";

import { useCodeLimits } from "@/lib/workspace/code-limits";

/**
 * "12 / 100 lines". Turns red above the limit, with the reason as a tooltip.
 * Mount it next to the editor. Uses the same check as the API.
 */
export function CodeSizeBadge({ className = "" }: { className?: string }) {
    const { check, maxLines, maxChars } = useCodeLimits();
    const over = !check.ok && (check.reason === "too_many_lines" || check.reason === "too_long");
    const showChars = !check.ok && check.reason === "too_long";

    return (
        <span
            data-testid="code-size-badge"
            aria-live="polite"
            title={check.ok ? undefined : check.message}
            className={`font-mono text-[11px] tabular-nums ${over ? "text-red-400" : "text-zinc-500"} ${className}`}
        >
            {check.lines} / {maxLines} lines
            {showChars ? ` · ${check.chars.toLocaleString()} / ${maxChars.toLocaleString()} chars` : ""}
        </span>
    );
}
