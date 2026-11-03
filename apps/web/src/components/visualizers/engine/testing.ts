import type { Beat } from "../script/compile";
import type { BeatHandle, GroupRunner } from "./types";

// Test doubles for the canvas side of the engine. Not used by the app.

export class FakeHandle implements BeatHandle {
    readonly done: Promise<void>;
    private resolve!: () => void;
    paused = false;
    speed = 1;
    cancelled = false;
    finished = false;
    constructor(readonly beat: Beat) {
        this.done = new Promise<void>((r) => (this.resolve = r));
    }
    pause() { this.paused = true; }
    resume() { this.paused = false; }
    setSpeed(x: number) { this.speed = x; }
    cancel() { this.cancelled = true; this.resolve(); }
    complete() { this.finished = true; this.resolve(); }
}

export class FakeRunner implements GroupRunner {
    handles: FakeHandle[] = [];
    shown: unknown[] = [];
    throwOnRun = false;
    run(beat: Beat): BeatHandle {
        if (this.throwOnRun) throw new Error("boom");
        const h = new FakeHandle(beat);
        this.handles.push(h);
        return h;
    }
    show(state: unknown | null) { this.shown.push(state); }
    get last() { return this.handles[this.handles.length - 1]; }
}

/** Lets chained promises run to completion. */
export const settle = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };

