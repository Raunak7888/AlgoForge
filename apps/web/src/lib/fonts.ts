const FALLBACK = 'ui-monospace, "SF Mono", "Cascadia Code", Menlo, Consolas, monospace';
type Read = () => string;

const readRoot: Read = () =>
    typeof document === "undefined" ? "" : getComputedStyle(document.documentElement).getPropertyValue("--font-mono");

/**
 * Monaco needs a font-family string, not a CSS variable. next/font gives fonts hashed names,
 * so the real name is read from the computed --font-mono token (var() is already substituted).
 */
export function resolveMonoFontFamily(read: Read = readRoot): string {
    return read().trim() || FALLBACK;
}
