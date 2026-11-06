"use client";
import { useEffect, useState, type ComponentType } from "react";
import type { StoreApi } from "zustand/vanilla";
import { VisualizerCanvas } from "../canvas";
import { visualizer } from "../engine/instance";
import type { VisualizerStore } from "../engine/store";
import { LazyScriptEditor } from "./LazyScriptEditor";
import { PlayerChrome } from "./PlayerChrome";
import { SavedWork } from "./SavedWork";
import { ScriptDrawer } from "./ScriptDrawer";
import type { ScriptEditorProps } from "./ScriptEditor";

interface Props {
    store?: StoreApi<VisualizerStore>;
    /** Tests pass a plain textarea instead of Monaco. */
    editor?: ComponentType<ScriptEditorProps>;
    dark?: boolean;
}

const CANVAS_CLASS =
    "relative min-h-[260px] w-full flex-1 touch-none select-none overflow-hidden rounded-2xl border border-neutral-500/25 bg-neutral-500/5 outline-none focus-visible:ring-2 focus-visible:ring-neutral-500/40";

/**
 * When the panel leaves the screen (another dashboard tab), its stages are destroyed.
 * Drop any half-played frame and rest on the last finished step, so coming back is
 * paused and consistent. The compiled script and cursor stay in the store.
 */
export function parkPlayback(store: StoreApi<VisualizerStore>): void {
    const s = store.getState();
    const t = s.transport;
    if (t.running !== null) s.seek(t.cursor);
}

/** The one component the dashboard mounts: canvas, narration, transport, script and saved work. Sized by its parent. */
export function VisualizerPanel({ store = visualizer, editor = LazyScriptEditor, dark = true }: Props) {
    // First visit (nothing compiled yet): open the script drawer so the empty state and examples are visible.
    const [openDrawer] = useState(() => store.getState().compiled === null);

    useEffect(() => () => parkPlayback(store), [store]);

    return (
        <div data-visualizer-panel className="flex h-full min-h-0 w-full flex-col gap-3 overflow-y-auto p-2">
            <div className="flex min-h-65 flex-1 flex-col">
                <VisualizerCanvas store={store} className={CANVAS_CLASS} />
            </div>
            <PlayerChrome store={store} />
            <ScriptDrawer editor={editor} store={store} dark={dark} defaultOpen={openDrawer} extras={(api) => <SavedWork api={api} />} />
        </div>
    );
}
