import type { Diagnostic } from "../core/types";

/** 1-based line and column -> offset into the text (clamped). Lines are split on "\n" like the parser does. */
export function offsetOf(text: string, line: number, column: number): number {
    let off = 0;
    for (let l = 1; l < line; l++) {
        const nl = text.indexOf("\n", off);
        if (nl < 0) return text.length;
        off = nl + 1;
    }
    return Math.min(text.length, off + Math.max(0, column - 1));
}

/** The script with the diagnostic's quick fix applied, or null when it has none. */
export function applyFix(text: string, d: Diagnostic): string | null {
    if (!d.fix) return null;
    const a = offsetOf(text, d.line, d.column);
    const b = offsetOf(text, d.endLine, d.endColumn);
    return text.slice(0, a) + d.fix.replacement + text.slice(Math.max(a, b));
}
