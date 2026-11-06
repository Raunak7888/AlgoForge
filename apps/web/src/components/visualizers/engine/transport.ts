/**
 * The playback state machine. Pure: (state, action) -> (state, effects). No DOM, no timers, no React.
 * The controller carries out the effects; this file only decides what should happen.
 *
 * Vocabulary
 *   cursor   the last frame that is fully on screen (-1 = nothing played yet)
 *   running  the frame being animated right now. It is always cursor + 1, or null.
 */

export type Status = "empty" | "invalid" | "ready" | "playing" | "paused" | "finished" | "seeking";

export interface TransportState {
    status: Status;
    total: number;
    cursor: number;
    running: number | null;
    /** Stop after the running frame instead of continuing (step forward, replay). */
    stopAfter: boolean;
    speed: number;
    loop: boolean;
}

export type Action =
    | { type: "load"; total: number; ok: boolean }
    | { type: "play" }
    | { type: "pause" }
    | { type: "stepForward" }
    | { type: "stepBack" }
    | { type: "replayStep" }
    | { type: "restart" }
    | { type: "jumpToEnd" }
    | { type: "seekStart" }
    | { type: "seekTo"; to: number }
    | { type: "seekEnd" }
    | { type: "frameDone"; index: number }
    | { type: "setSpeed"; speed: number }
    | { type: "setLoop"; loop: boolean };

export type Effect =
    | { type: "show"; cursor: number }
    | { type: "playFrame"; index: number }
    | { type: "cancel" }
    | { type: "pause" }
    | { type: "resume" }
    | { type: "speed"; value: number };

export interface Step {
    state: TransportState;
    effects: Effect[];
}

export const SPEEDS = [0.25, 0.5, 1, 2, 4] as const;
export const MIN_SPEED = 0.25;
export const MAX_SPEED = 4;

export const initialTransport: TransportState = {
    status: "empty",
    total: 0,
    cursor: -1,
    running: null,
    stopAfter: false,
    speed: 1,
    loop: false,
};

const clampSpeed = (x: number) => (Number.isFinite(x) ? Math.min(MAX_SPEED, Math.max(MIN_SPEED, x)) : 1);

/** The resting status for a cursor when nothing is animating. */
export function restingStatus(cursor: number, total: number): Status {
    if (cursor < 0) return "ready";
    return cursor >= total - 1 ? "finished" : "paused";
}

const same = (state: TransportState): Step => ({ state, effects: [] });

export function reduce(s: TransportState, a: Action): Step {
    if (a.type === "load") {
        const status: Status = !a.ok ? "invalid" : a.total <= 0 ? "empty" : "ready";
        const total = a.ok ? Math.max(0, Math.floor(a.total)) : 0;
        return { state: { ...s, status, total, cursor: -1, running: null, stopAfter: false }, effects: [{ type: "cancel" }, { type: "show", cursor: -1 }] };
    }
    if (a.type === "setSpeed") {
        const speed = clampSpeed(a.speed);
        return { state: { ...s, speed }, effects: [{ type: "speed", value: speed }] };
    }
    if (a.type === "setLoop") return { state: { ...s, loop: a.loop }, effects: [] };
    if (s.status === "empty" || s.status === "invalid") return same(s);

    const last = s.total - 1;
    const clamp = (i: number) => Math.min(last, Math.max(-1, Math.floor(i)));

    switch (a.type) {
        case "play": {
            if (s.status === "seeking") return same(s);
            if (s.status === "playing") return s.stopAfter ? same({ ...s, stopAfter: false }) : same(s);
            if (s.running !== null) return { state: { ...s, status: "playing", stopAfter: false }, effects: [{ type: "resume" }] };
            if (s.cursor >= last) {
                return { state: { ...s, status: "playing", cursor: -1, running: 0, stopAfter: false }, effects: [{ type: "show", cursor: -1 }, { type: "playFrame", index: 0 }] };
            }
            const index = s.cursor + 1;
            return { state: { ...s, status: "playing", running: index, stopAfter: false }, effects: [{ type: "playFrame", index }] };
        }

        case "pause":
            return s.status === "playing" ? { state: { ...s, status: "paused" }, effects: [{ type: "pause" }] } : same(s);

        case "stepForward": {
            if (s.status === "seeking") return same(s);
            if (s.running !== null) {
                // Mid-animation: finish this step instantly. The next press animates the next one.
                const cursor = s.running;
                return { state: { ...s, cursor, running: null, stopAfter: false, status: restingStatus(cursor, s.total) }, effects: [{ type: "cancel" }, { type: "show", cursor }] };
            }
            if (s.cursor >= last) return same(s);
            const index = s.cursor + 1;
            return { state: { ...s, status: "playing", running: index, stopAfter: true }, effects: [{ type: "playFrame", index }] };
        }

        case "stepBack": {
            if (s.status === "seeking") return same(s);
            const position = s.running ?? s.cursor;
            const cursor = clamp(position - 1);
            if (position < 0) return same(s);
            return { state: { ...s, cursor, running: null, stopAfter: false, status: restingStatus(cursor, s.total) }, effects: [{ type: "cancel" }, { type: "show", cursor }] };
        }

        case "replayStep": {
            if (s.status === "seeking") return same(s);
            const frame = s.running ?? s.cursor;
            if (frame < 0) return same(s);
            return {
                state: { ...s, status: "playing", cursor: frame - 1, running: frame, stopAfter: true },
                effects: [{ type: "show", cursor: frame - 1 }, { type: "playFrame", index: frame }],
            };
        }

        case "restart":
            return { state: { ...s, status: "ready", cursor: -1, running: null, stopAfter: false }, effects: [{ type: "cancel" }, { type: "show", cursor: -1 }] };

        case "jumpToEnd":
            return reduce(s, { type: "seekTo", to: last });

        case "seekStart":
            return { state: { ...s, status: "seeking", running: null, stopAfter: false }, effects: [{ type: "cancel" }] };

        case "seekTo": {
            const cursor = clamp(a.to);
            const status = s.status === "seeking" ? "seeking" : restingStatus(cursor, s.total);
            return { state: { ...s, status, cursor, running: null, stopAfter: false }, effects: [{ type: "show", cursor }] };
        }

        case "seekEnd":
            return s.status === "seeking" ? same({ ...s, status: restingStatus(s.cursor, s.total) }) : same(s);

        case "frameDone": {
            if (s.running !== a.index) return same(s); // stale: that frame was cancelled or replaced
            const cursor = a.index;
            if (s.status === "playing" && !s.stopAfter) {
                if (cursor < last) {
                    const index = cursor + 1;
                    return { state: { ...s, cursor, running: index }, effects: [{ type: "playFrame", index }] };
                }
                if (s.loop) {
                    return { state: { ...s, cursor: -1, running: 0 }, effects: [{ type: "show", cursor: -1 }, { type: "playFrame", index: 0 }] };
                }
            }
            return same({ ...s, cursor, running: null, stopAfter: false, status: restingStatus(cursor, s.total) });
        }
    }
}
