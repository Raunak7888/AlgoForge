import { SPEEDS } from "../engine/transport";

export type Command =
    | "toggle"
    | "stepBack"
    | "stepForward"
    | "back5"
    | "forward5"
    | "replay"
    | "restart"
    | "end"
    | "slower"
    | "faster"
    | "loop"
    | "messages"
    | "help";

export interface KeyLike {
    key: string;
    ctrlKey: boolean;
    metaKey: boolean;
    altKey: boolean;
    shiftKey: boolean;
}

/** Maps a key press to a transport command. Modified keys (Ctrl/Cmd/Alt) belong to the browser and the editor. */
export function commandFor(e: KeyLike): Command | null {
    if (e.ctrlKey || e.metaKey || e.altKey) return null;
    switch (e.key) {
        case " ":
            return "toggle";
        case "ArrowLeft":
            return e.shiftKey ? "back5" : "stepBack";
        case "ArrowRight":
            return e.shiftKey ? "forward5" : "stepForward";
        case "Home":
            return "restart";
        case "End":
            return "end";
        case "[":
            return "slower";
        case "]":
            return "faster";
        case "r":
        case "R":
            return "replay";
        case "l":
        case "L":
            return "loop";
        case "m":
        case "M":
            return "messages";
        case "?":
            return "help";
        default:
            return null;
    }
}

export interface TargetLike {
    tagName?: string;
    isContentEditable?: boolean;
    closest?: (selector: string) => unknown;
}

/** Keys must never be stolen from a text field, the slider, a select, or the Monaco editor. */
export function isTypingTarget(t: TargetLike | null): boolean {
    if (!t) return false;
    const tag = t.tagName?.toUpperCase();
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
    if (t.isContentEditable) return true;
    return !!t.closest?.(".monaco-editor");
}

/** Space already activates a focused button or link, so the global shortcut must stay out of its way. */
export function ignoresSpace(t: TargetLike | null): boolean {
    return !!t?.closest?.("button,a,summary,[role=button]");
}

/** The next preset speed up or down from the current one. */
export function stepSpeed(current: number, dir: 1 | -1): number {
    let i = SPEEDS.findIndex((s) => s >= current);
    if (i < 0) i = SPEEDS.length - 1;
    const idx = dir === 1 ? (SPEEDS[i] > current ? i : i + 1) : i - 1;
    return SPEEDS[Math.min(SPEEDS.length - 1, Math.max(0, idx))];
}

export const HOTKEY_HELP: readonly (readonly [string, string])[] = [
    ["Space", "Play / pause"],
    ["← →", "Step back / forward"],
    ["Shift + ← →", "Jump 5 steps"],
    ["R", "Replay the current step"],
    ["Home / End", "Restart / jump to the end"],
    ["[ ]", "Slower / faster"],
    ["L", "Loop on / off"],
    ["M", "Show / hide operation details"],
    ["F, 0, + −", "Fit, 100%, zoom (when the canvas is focused)"],
    ["?", "This help"],
];
