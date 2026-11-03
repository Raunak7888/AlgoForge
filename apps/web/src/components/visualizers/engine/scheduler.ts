import type { Beat, Frame } from "../script/compile";
import { Timer } from "./timer";
import type { BeatHandle, GroupRunner, RunnerLookup } from "./types";

/** Beats of one structure run one after another. */
export function lanesOf(beats: readonly Beat[]): Map<string, Beat[]> {
    const lanes = new Map<string, Beat[]>();
    for (const b of beats) {
        const lane = lanes.get(b.instance);
        if (lane) lane.push(b);
        else lanes.set(b.instance, [b]);
    }
    return lanes;
}

export interface PlayOptions {
    speed: number;
    /** Skip animations: show each result directly. */
    reduced: boolean;
    /** Structures that appear in this frame, with their empty starting state. Shown before anything animates. */
    created?: Readonly<Record<string, unknown>>;
    /** Keep the frame on screen at least this long (authored ms), so its message can be read. */
    dwellMs?: number;
    onError?: (instance: string, error: unknown) => void;
}

export interface FrameRun {
    readonly done: Promise<"completed" | "cancelled">;
    pause(): void;
    resume(): void;
    setSpeed(x: number): void;
    cancel(): void;
}

/**
 * Plays one frame: every structure's beats run in its own lane, all lanes start together and share
 * pause / resume / speed, and the frame is finished when the last lane (and the reading time) is.
 * Lanes are sequential inside, parallel with each other.
 */
export function playFrame(frame: Frame, lookup: RunnerLookup, o: PlayOptions): FrameRun {
    let cancelled = false;
    let paused = false;
    let speed = o.speed;
    const active = new Set<BeatHandle>();
    let finish!: (r: "completed" | "cancelled") => void;
    const done = new Promise<"completed" | "cancelled">((r) => (finish = r));
    const timer = o.dwellMs && o.dwellMs > 0 ? new Timer(o.dwellMs, speed) : null;

    for (const [id, state] of Object.entries(o.created ?? {})) lookup(id)?.show(state);

    async function lane(instance: string, beats: Beat[]): Promise<void> {
        const runner: GroupRunner | undefined = lookup(instance);
        if (!runner) return; // that structure is not on the canvas (yet): nothing to animate
        for (const beat of beats) {
            if (cancelled) return;
            if (o.reduced) {
                runner.show(beat.outcome.state);
                continue;
            }
            let handle: BeatHandle;
            try {
                handle = runner.run(beat);
            } catch (e) {
                o.onError?.(instance, e);
                runner.show(beat.outcome.state);
                continue;
            }
            handle.setSpeed(speed);
            if (paused) handle.pause();
            active.add(handle);
            try {
                await handle.done;
            } catch (e) {
                o.onError?.(instance, e);
            }
            active.delete(handle);
        }
    }

    const lanes = [...lanesOf(frame.beats)].map(([instance, beats]) => lane(instance, beats));
    timer?.start();
    void Promise.all(lanes)
        .then(() => timer?.done)
        .then(() => {
            if (!cancelled) finish("completed");
        });

    return {
        done,
        pause() {
            paused = true;
            active.forEach((h) => h.pause());
            timer?.pause();
        },
        resume() {
            paused = false;
            active.forEach((h) => h.resume());
            timer?.resume();
        },
        setSpeed(x) {
            speed = x;
            active.forEach((h) => h.setSpeed(x));
            timer?.setSpeed(x);
        },
        cancel() {
            if (cancelled) return;
            cancelled = true;
            active.forEach((h) => h.cancel());
            active.clear();
            timer?.cancel();
            finish("cancelled");
        },
    };
}

/** Put every structure on the canvas into the given snapshot, with no animation. Missing = not created yet. */
export function showSnapshot(snapshot: Readonly<Record<string, unknown>>, instances: readonly { id: string }[], lookup: RunnerLookup): void {
    for (const inst of instances) lookup(inst.id)?.show(Object.prototype.hasOwnProperty.call(snapshot, inst.id) ? snapshot[inst.id] : null);
}
