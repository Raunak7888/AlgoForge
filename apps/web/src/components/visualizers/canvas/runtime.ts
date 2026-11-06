import type { Beat } from "../script/compile";
import type { AnyOutcome } from "../core/types";
import type { TimelineSink } from "../shared/stage/StageEnv";
import type { BeatHandle, GroupRunner } from "../engine/types";

/** What the stage of one structure is told to draw. */
export interface GroupView {
    /** `null` = the structure does not exist yet at this point of the script (nothing is drawn). */
    state: unknown | null;
    anim: { token: number; plan: { kind: string } } | null;
    /** Mirrors the "last operation" the old labs kept in their store. */
    last: { seq: number; outcome: AnyOutcome } | null;
    running: boolean;
}

export const EMPTY_VIEW: GroupView = { state: null, anim: null, last: null, running: false };

interface TimelineLike {
    pause(): unknown;
    resume(): unknown;
    speed: number;
}

/**
 * The `GroupRunner` for one structure on the canvas. It owns no DOM: it decides what the stage should
 * draw (`publish`), and it learns about the stage's running timeline through `sink` and about its end
 * through `finish`. That keeps the play / pause / speed / cancel rules testable without a browser.
 */
export class GroupRuntime implements GroupRunner {
    view: GroupView = EMPTY_VIEW;
    private seq = 0;
    private pending: { token: number; resolve: () => void } | null = null;
    private timeline: TimelineLike | null = null;
    private paused = false;
    private speed = 1;

    constructor(private readonly publish: (view: GroupView) => void) {}

    /** Hand this to the stage (through TimelineSinkProvider). */
    readonly sink: TimelineSink = {
        set: (tl) => {
            this.timeline = tl;
            tl.speed = this.speed;
            if (this.paused) tl.pause();
        },
        clear: (tl) => {
            if (!tl || this.timeline === tl) this.timeline = null;
        },
    };

    /** Hand this to the stage as its `finishAnimation`. */
    readonly finish = (token: number): void => {
        const p = this.pending;
        if (!p || p.token !== token) return;
        this.pending = null;
        this.timeline = null;
        this.update({ ...this.view, running: false });
        p.resolve();
    };

    show(state: unknown | null): void {
        this.stop();
        this.update({ state, anim: null, last: null, running: false });
    }

    run(beat: Beat): BeatHandle {
        this.stop();
        this.paused = false; // the scheduler pauses the new beat itself if the frame is paused
        const o = beat.outcome;
        const token = ++this.seq;
        // Same rule as the old labs: a rejected operation or one with no animation just updates the picture.
        const animate = o.ok && o.anim.kind !== "none";
        let resolve!: () => void;
        const done = new Promise<void>((r) => (resolve = r));
        if (animate) this.pending = { token, resolve };
        this.update({ state: o.state, anim: animate ? { token, plan: o.anim } : null, last: { seq: token, outcome: o }, running: animate });
        if (!animate) queueMicrotask(resolve);
        return {
            done,
            pause: () => this.pause(),
            resume: () => this.resume(),
            setSpeed: (x) => this.setSpeed(x),
            cancel: () => {
                if (this.pending?.token !== token) return;
                this.stop();
                this.update({ ...this.view, running: false });
            },
        };
    }

    private pause(): void {
        this.paused = true;
        this.timeline?.pause();
    }

    private resume(): void {
        this.paused = false;
        this.timeline?.resume();
    }

    private setSpeed(x: number): void {
        this.speed = x;
        if (this.timeline) this.timeline.speed = x;
    }

    /** Stop what is running and settle anyone waiting for it. */
    private stop(): void {
        const p = this.pending;
        this.pending = null;
        if (this.timeline) {
            this.timeline.pause();
            this.timeline = null;
        }
        p?.resolve();
    }

    private update(view: GroupView): void {
        this.view = view;
        this.publish(view);
    }
}
