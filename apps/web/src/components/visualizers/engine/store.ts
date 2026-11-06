import { createStore, type StoreApi } from "zustand/vanilla";
import type { Compiled, Frame } from "../script/compile";
import { dwellFor, PlaybackController } from "./controller";
import { initialTransport, type Action, type TransportState } from "./transport";
import type { GroupRunner } from "./types";

export interface VisualizerStore {
    compiled: Compiled | null;
    transport: TransportState;
    /** Mirrors the user's reduced-motion setting. */
    reduced: boolean;

    load(compiled: Compiled | null): void;
    play(): void;
    pause(): void;
    toggle(): void;
    stepForward(): void;
    stepBack(): void;
    replayStep(): void;
    restart(): void;
    jumpToEnd(): void;
    seek(to: number): void;
    seekStart(): void;
    seekTo(to: number): void;
    seekEnd(): void;
    setSpeed(speed: number): void;
    setLoop(loop: boolean): void;
    setReduced(reduced: boolean): void;
    /** A canvas group announces itself. It is brought up to date immediately. Returns the unregister function. */
    registerRunner(instance: string, runner: GroupRunner): () => void;
}

export interface VisualizerOptions {
    reduced?: boolean;
    dwell?: (frame: Frame) => number;
    onError?: (instance: string, error: unknown) => void;
}

/**
 * The one store for the whole visualizer: the compiled script, the playback state and the runners.
 * Created outside React so switching dashboard tabs never resets a run.
 */
export function createVisualizer(options: VisualizerOptions = {}): StoreApi<VisualizerStore> {
    const runners = new Map<string, GroupRunner>();

    return createStore<VisualizerStore>((set, get) => {
        const controller = new PlaybackController(
            {
                getCompiled: () => get().compiled,
                lookup: (id) => runners.get(id),
                reduced: () => get().reduced,
                dwell: options.dwell ?? dwellFor,
                onError: options.onError,
            },
            initialTransport,
            (transport) => set({ transport }),
        );
        const go = (a: Action) => () => controller.dispatch(a);

        return {
            compiled: null,
            transport: initialTransport,
            reduced: options.reduced ?? false,

            load(compiled) {
                for (const r of runners.values()) r.show(null); // clear whatever the previous script left
                set({ compiled });
                controller.dispatch({ type: "load", total: compiled?.frames.length ?? 0, ok: compiled?.ok ?? false });
            },
            play: go({ type: "play" }),
            pause: go({ type: "pause" }),
            toggle() {
                controller.dispatch({ type: get().transport.status === "playing" ? "pause" : "play" });
            },
            stepForward: go({ type: "stepForward" }),
            stepBack: go({ type: "stepBack" }),
            replayStep: go({ type: "replayStep" }),
            restart: go({ type: "restart" }),
            jumpToEnd: go({ type: "jumpToEnd" }),
            seek(to) {
                controller.dispatch({ type: "seekTo", to });
            },
            seekStart: go({ type: "seekStart" }),
            seekTo(to) {
                controller.dispatch({ type: "seekTo", to });
            },
            seekEnd: go({ type: "seekEnd" }),
            setSpeed: (speed) => controller.dispatch({ type: "setSpeed", speed }),
            setLoop: (loop) => controller.dispatch({ type: "setLoop", loop }),
            setReduced: (reduced) => set({ reduced }),

            registerRunner(instance, runner) {
                runners.set(instance, runner);
                const t = controller.state;
                const c = get().compiled;
                // Bring a late-mounting structure up to date, unless it is about to animate anyway.
                if (c && t.running === null) {
                    const cursor = t.cursor;
                    runner.show(cursor < 0 ? null : (c.frames[cursor]?.snapshot[instance] ?? null));
                }
                return () => {
                    if (runners.get(instance) === runner) runners.delete(instance);
                };
            },
        };
    });
}
