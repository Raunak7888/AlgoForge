import type { Beat, Compiled, Frame } from "../script/compile";
import type { TransportState } from "./transport";

/** The frame the user is looking at: the one animating, else the last one shown. -1 = none yet. */
export const currentIndex = (t: TransportState): number => t.running ?? t.cursor;

export const frameAt = (c: Compiled | null, index: number): Frame | undefined => (c && index >= 0 ? c.frames[index] : undefined);

/**
 * Messages to show. By default a message stays until a later step has its own,
 * so narration does not flicker away on steps that have none.
 */
export function currentMessages(c: Compiled | null, t: TransportState, persist = true): readonly string[] {
    if (!c) return [];
    for (let i = currentIndex(t); i >= 0; i--) {
        const m = c.frames[i]?.messages;
        if (m && m.length > 0) return m;
        if (!persist) break;
    }
    return [];
}

/** The last operation of the current frame: what the caption describes. */
export function currentBeat(c: Compiled | null, t: TransportState): Beat | undefined {
    const f = frameAt(c, currentIndex(t));
    return f?.beats[f.beats.length - 1];
}

export interface Progress {
    /** 1-based number of the step on screen (0 = before the first). */
    position: number;
    total: number;
    /** 0..1 */
    fraction: number;
}

export function progressOf(t: TransportState): Progress {
    const position = Math.max(0, currentIndex(t) + 1);
    return { position, total: t.total, fraction: t.total === 0 ? 0 : position / t.total };
}

/** Steps whose slider tick should be marked as failed. */
export const failedSteps = (c: Compiled | null): number[] => (c ? c.frames.flatMap((f) => (f.failed ? [f.index] : [])) : []);

export const canPlay = (t: TransportState): boolean => t.status !== "empty" && t.status !== "invalid" && t.status !== "seeking";
export const isPlaying = (t: TransportState): boolean => t.status === "playing";
export const canStepBack = (t: TransportState): boolean => canPlay(t) && currentIndex(t) >= 0;
export const canStepForward = (t: TransportState): boolean => canPlay(t) && (t.running !== null || t.cursor < t.total - 1);
