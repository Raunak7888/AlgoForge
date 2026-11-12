"use client";
import { useEffect } from "react";
import { useStore } from "zustand";
import type { StoreApi } from "zustand/vanilla";
import { VisualizerCanvas } from "../canvas";
import { visualizer } from "../engine/instance";
import type { VisualizerStore } from "../engine/store";
import { PlayerChrome } from "./PlayerChrome";

interface Props {
    store?: StoreApi<VisualizerStore>;
}

const CANVAS_CLASS =
    "relative min-h-[260px] w-full flex-1 touch-none select-none overflow-hidden rounded-2xl border border-neutral-500/25 bg-neutral-500/5 outline-none focus-visible:ring-2 focus-visible:ring-neutral-500/40";

/** Rest on the last finished step when the panel leaves the screen. */
export function parkPlayback(store: StoreApi<VisualizerStore>): void {
    const s = store.getState();
    const t = s.transport;
    if (t.running !== null) s.seek(t.cursor);
}

export function VisualizerPanel({ store = visualizer }: Props) {

    useEffect(() => () => parkPlayback(store), [store]);

    return (
        <div data-visualizer-panel className="flex h-full min-h-0 w-full flex-col gap-1.5 overflow-hidden p-1.5">
            <div className="relative flex min-h-0 flex-1 flex-col">
                <VisualizerCanvas store={store} className={CANVAS_CLASS} />
            </div>
            <div className="shrink-0">
                <PlayerChrome store={store} />
            </div>
        </div>
    );
}
