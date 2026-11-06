import { findDsType } from "../core/registry";
import type { Compiled, Frame } from "../script/compile";
import { playFrame, showSnapshot, type FrameRun } from "./scheduler";
import { reduce, type Action, type Effect, type TransportState } from "./transport";
import type { RunnerLookup } from "./types";

/** How long a frame's message stays on screen, at least (authored ms). Frames without a message add nothing. */
export function dwellFor(frame: Frame): number {
    const chars = frame.messages.reduce((n, m) => n + m.length, 0);
    return chars === 0 ? 0 : Math.min(4500, 900 + 30 * chars);
}

export interface ControllerDeps {
    getCompiled(): Compiled | null;
    lookup: RunnerLookup;
    reduced(): boolean;
    dwell(frame: Frame): number;
    onError?(instance: string, error: unknown): void;
}

/**
 * Carries out what the transport reducer decides. This is the one place that touches the
 * runners, so replacing the old module-level `playback` singleton means replacing nothing else.
 */
export class PlaybackController {
    state: TransportState;
    private current: FrameRun | null = null;
    private generation = 0;

    constructor(
        private readonly deps: ControllerDeps,
        initial: TransportState,
        private readonly onChange: (s: TransportState) => void,
    ) {
        this.state = initial;
    }

    dispatch(action: Action): void {
        const step = reduce(this.state, action);
        this.state = step.state;
        for (const e of step.effects) this.perform(e);
        this.onChange(this.state);
    }

    /** Put the canvas into the state it has at `cursor` (used on load and when a runner mounts late). */
    showAt(cursor: number): void {
        const c = this.deps.getCompiled();
        if (!c) return;
        showSnapshot(cursor < 0 ? {} : (c.frames[cursor]?.snapshot ?? {}), c.instances, this.deps.lookup);
    }

    private cancelCurrent(): void {
        this.generation++;
        this.current?.cancel();
        this.current = null;
    }

    private perform(e: Effect): void {
        switch (e.type) {
            case "cancel":
                return this.cancelCurrent();
            case "show":
                this.cancelCurrent();
                return this.showAt(e.cursor);
            case "pause":
                return this.current?.pause();
            case "resume":
                return this.current?.resume();
            case "speed":
                return this.current?.setSpeed(e.value);
            case "playFrame": {
                this.cancelCurrent();
                const c = this.deps.getCompiled();
                const frame = c?.frames[e.index];
                if (!c || !frame) {
                    // Nothing to play: report it done so the transport never gets stuck.
                    queueMicrotask(() => this.dispatch({ type: "frameDone", index: e.index }));
                    return;
                }
                const created: Record<string, unknown> = {};
                for (const inst of c.instances) {
                    if (inst.firstFrame === e.index) created[inst.id] = findDsType(inst.ds)?.create() ?? null;
                }
                const id = ++this.generation;
                const run = playFrame(frame, this.deps.lookup, {
                    speed: this.state.speed,
                    reduced: this.deps.reduced(),
                    created,
                    dwellMs: this.deps.dwell(frame),
                    onError: this.deps.onError,
                });
                this.current = run;
                void run.done.then((result) => {
                    if (result === "completed" && id === this.generation) {
                        this.current = null;
                        this.dispatch({ type: "frameDone", index: e.index });
                    }
                });
            }
        }
    }
}
