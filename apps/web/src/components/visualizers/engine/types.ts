import type { Beat } from "../script/compile";

/** A running animation of one beat. `done` settles when it finished OR was cancelled. */
export interface BeatHandle {
    readonly done: Promise<void>;
    pause(): void;
    resume(): void;
    setSpeed(x: number): void;
    cancel(): void;
}

/**
 * What the canvas implements for each structure on it (Phase 3). The engine only talks to this seam,
 * so the whole playback system is testable without a DOM.
 */
export interface GroupRunner {
    /**
     * Render `beat.outcome.state` and animate from where things were to there, using `beat.outcome.anim`.
     * The runner settles itself when finished.
     */
    run(beat: Beat): BeatHandle;
    /** Render a state with no animation and remember where everything is. `null` = this structure does not exist yet. */
    show(state: unknown | null): void;
}

export type RunnerLookup = (instance: string) => GroupRunner | undefined;
