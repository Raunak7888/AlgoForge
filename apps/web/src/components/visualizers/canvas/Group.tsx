"use client";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { StoreApi } from "zustand/vanilla";
import type { VisualizerStore } from "../engine/store";
import type { InstanceMeta } from "../script/compile";
import { TimelineSinkProvider } from "../shared/stage/StageEnv";
import { renderStage } from "./renderers";
import { EMPTY_VIEW, GroupRuntime, type GroupView } from "./runtime";
import type { Size } from "./viewport";

interface Props {
    meta: InstanceMeta;
    store: StoreApi<VisualizerStore>;
    x: number;
    y: number;
    /** Slide to the new position instead of jumping (lanes above grew or shrank). */
    glide: boolean;
    onSize: (id: string, size: Size) => void;
}

/** One structure on the canvas: a title, and the existing stage for its family. */
export function Group({ meta, store, x, y, glide, onSize }: Props) {
    const [view, setView] = useState<GroupView>(EMPTY_VIEW);
    const runtime = useMemo(() => new GroupRuntime(setView), []);
    const box = useRef<HTMLDivElement>(null);

    // Announce this structure to the playback engine. It is brought up to date straight away.
    useEffect(() => store.getState().registerRunner(meta.id, runtime), [store, meta.id, runtime]);

    // Report the real size so lanes can be stacked without gaps or overlaps.
    useLayoutEffect(() => {
        const el = box.current;
        if (!el) return;
        const report = () => onSize(meta.id, { w: el.offsetWidth, h: el.offsetHeight });
        report();
        if (typeof ResizeObserver === "undefined") return;
        const ro = new ResizeObserver(report);
        ro.observe(el);
        return () => ro.disconnect();
    }, [meta.id, onSize, view.state === null]);

    const hidden = view.state === null;
    return (
        <div
            data-canvas-group={meta.id}
            style={{
                position: "absolute",
                left: 0,
                top: 0,
                width: "max-content",
                transform: `translate(${x}px, ${y}px)`,
                transition: glide ? "transform 260ms cubic-bezier(.2,.8,.2,1)" : "none",
            }}
        >
            <div ref={box} role="group" aria-label={`${meta.id}: ${meta.label}`} aria-hidden={hidden} style={{ display: hidden ? "none" : "block" }}>
                <div className="mb-2 flex items-center gap-2 px-1">
                    <span className="inline-flex h-6 items-center rounded-md border border-primary-foreground/15 bg-primary-background px-2 font-mono text-xs font-semibold">{meta.id}</span>
                    <span className="text-xs text-muted-foreground">{meta.label}</span>
                </div>
                {/* Read-only: panning works from anywhere, and a structure can never be dragged out of step with the script. */}
                <div style={{ pointerEvents: "none" }}>
                    <TimelineSinkProvider value={runtime.sink}>{renderStage(meta, view, runtime.finish)}</TimelineSinkProvider>
                </div>
            </div>
        </div>
    );
}
