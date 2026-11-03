"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useStore } from "zustand";
import type { StoreApi } from "zustand/vanilla";
import { visualizer } from "../engine/instance";
import type { VisualizerStore } from "../engine/store";
import { useReducedMotion } from "../shared/animationSettings";
import { CANVAS_CSS } from "./canvasStyles";
import { Group } from "./Group";
import { stackLanes } from "./layout";
import { Viewport } from "./CanvasViewport";
import type { Size } from "./viewport";

const NONE: Size = { w: 0, h: 0 };

/**
 * The one canvas. Every structure of the loaded script lives on it, and one playback (the store's
 * transport) drives all of them together.
 */
export function VisualizerCanvas({ store = visualizer, className }: { store?: StoreApi<VisualizerStore>; className?: string }) {
    const compiled = useStore(store, (s) => s.compiled);
    const instances = compiled?.instances;
    const [sizes, setSizes] = useState<Record<string, Size>>({});
    const reduced = useReducedMotion();

    useEffect(() => store.getState().setReduced(reduced), [store, reduced]);

    const onSize = useCallback((id: string, size: Size) => setSizes((prev) => (prev[id]?.w === size.w && prev[id]?.h === size.h ? prev : { ...prev, [id]: size })), []);

    const layout = useMemo(() => stackLanes((instances ?? []).map((i) => ({ id: i.id, size: sizes[i.id] ?? NONE, at: i.at }))), [instances, sizes]);

    // Do not slide groups into their very first position: only animate moves after the first layout.
    const [laidOut, setLaidOut] = useState(false);
    const hasLayout = layout.size.w > 0;
    useEffect(() => {
        const id = requestAnimationFrame(() => setLaidOut(hasLayout));
        return () => cancelAnimationFrame(id);
    }, [hasLayout]);

    return (
        <Viewport content={layout.size} className={className}>
            <style>{CANVAS_CSS}</style>
            {(instances ?? []).map((inst) => {
                const p = layout.placed[inst.id] ?? { x: 0, y: 0, w: 0, h: 0 };
                return <Group key={inst.id} meta={inst} store={store} x={p.x} y={p.y} glide={laidOut && !reduced} onSize={onSize} />;
            })}
        </Viewport>
    );
}
