"use client";
import { useRef, type ReactNode } from "react";
import { useStore } from "zustand";
import type { StoreApi } from "zustand/vanilla";
import { cn } from "@/lib/utils";
import { visualizer } from "../engine/instance";
import { canPlay, canStepBack, canStepForward, currentIndex, failedSteps, isPlaying, progressOf } from "../engine/selectors";
import type { VisualizerStore } from "../engine/store";
import { SPEEDS } from "../engine/transport";
import { btn } from "../shared/styles";
import { describeStep, valueText } from "./describe";
import { Icon, type IconName } from "./icons";

const MAX_ALL_TICKS = 200;
const on = "bg-primary-foreground text-primary-background hover:bg-primary-foreground";

function Btn(p: { label: string; keys?: string; icon: IconName; onClick: () => void; disabled?: boolean; pressed?: boolean; children?: ReactNode }) {
    return (
        <button
            type="button"
            className={cn(btn, "w-8 px-0", p.pressed && on)}
            aria-label={p.label}
            aria-pressed={p.pressed}
            aria-keyshortcuts={p.keys}
            title={p.keys ? `${p.label} (${p.keys})` : p.label}
            onClick={p.onClick}
            disabled={p.disabled}
        >
            <Icon name={p.icon} />
        </button>
    );
}

/** Play, pause, step, replay, restart, jump, loop, speed, and a slider with one tick per step. */
export function TransportBar({ store = visualizer }: { store?: StoreApi<VisualizerStore> }) {
    const t = useStore(store, (s) => s.transport);
    const compiled = useStore(store, (s) => s.compiled);
    const act = () => store.getState();
    const dragging = useRef(false);

    const enabled = canPlay(t);
    const playing = isPlaying(t);
    const { position, total } = progressOf(t);
    const info = describeStep(compiled, t);
    const failed = new Set(failedSteps(compiled));
    const everyTick = total <= MAX_ALL_TICKS;
    const ticks = Array.from({ length: total }, (_, i) => i + 1).filter((i) => everyTick || failed.has(i - 1));

    const startDrag = () => {
        dragging.current = true;
        act().seekStart();
        const end = () => {
            window.removeEventListener("pointerup", end);
            window.removeEventListener("pointercancel", end);
            dragging.current = false;
            act().seekEnd();
        };
        window.addEventListener("pointerup", end);
        window.addEventListener("pointercancel", end);
    };

    return (
        <div role="group" aria-label="Playback controls" className="flex flex-col gap-3 rounded-2xl border border-primary-foreground/10 bg-card/50 p-3">
            <div className="flex flex-wrap items-center gap-1.5">
                <Btn label="Restart" keys="Home" icon="restart" onClick={() => act().restart()} disabled={!enabled} />
                <Btn label="Step back" keys="ArrowLeft" icon="back" onClick={() => act().stepBack()} disabled={!canStepBack(t)} />
                <Btn label={playing ? "Pause" : "Play"} keys="Space" icon={playing ? "pause" : "play"} onClick={() => act().toggle()} disabled={!enabled} pressed={playing} />
                <Btn label="Step forward" keys="ArrowRight" icon="forward" onClick={() => act().stepForward()} disabled={!canStepForward(t)} />
                <Btn label="Replay step" keys="R" icon="replay" onClick={() => act().replayStep()} disabled={!enabled || currentIndex(t) < 0} />
                <Btn label="Jump to end" keys="End" icon="end" onClick={() => act().jumpToEnd()} disabled={!enabled} />
                <Btn label="Loop" keys="L" icon="loop" onClick={() => act().setLoop(!t.loop)} pressed={t.loop} />

                <div role="group" aria-label="Playback speed" className="ml-auto inline-flex rounded-lg border border-primary-foreground/15 p-0.5">
                    {SPEEDS.map((x) => (
                        <button
                            key={x}
                            type="button"
                            aria-label={`Speed ${x}×`}
                            aria-pressed={t.speed === x}
                            onClick={() => act().setSpeed(x)}
                            className={cn("h-7 min-w-9 rounded-md px-2 font-mono text-xs outline-none transition focus-visible:ring-2 focus-visible:ring-primary-foreground/20", t.speed === x ? on : "text-muted-foreground hover:text-primary-foreground")}
                        >
                            {x}×
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex items-center gap-3">
                <span data-counter className="shrink-0 font-mono text-xs tabular-nums">
                    {position} / {total}
                </span>
                <div className="relative min-w-0 flex-1">
                    <input
                        type="range"
                        aria-label="Step"
                        aria-valuetext={valueText(compiled, t)}
                        min={0}
                        max={Math.max(total, 1)}
                        step={1}
                        value={position}
                        disabled={!enabled && t.status !== "seeking"}
                        className="relative z-10 block w-full cursor-pointer accent-[#FF430F] disabled:cursor-not-allowed"
                        onPointerDown={startDrag}
                        onChange={(e) => {
                            const to = Number(e.target.value) - 1;
                            if (dragging.current) act().seekTo(to);
                            else act().seek(to); // keyboard: arrows, PageUp / PageDown
                        }}
                    />
                    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-full -mt-1 h-2">
                        {ticks.map((i) => (
                            <span
                                key={i}
                                data-tick={i}
                                data-failed={failed.has(i - 1) ? "true" : undefined}
                                className={cn("absolute top-0 w-px -translate-x-1/2", failed.has(i - 1) ? "h-2 bg-destructive" : "h-1 bg-primary-foreground/25")}
                                style={{ left: `calc(8px + (100% - 16px) * ${i / total})` }}
                            />
                        ))}
                    </div>
                </div>
                <span className={cn("hidden min-w-0 max-w-[40%] shrink truncate font-mono text-xs sm:block", info.failed ? "text-destructive" : "text-muted-foreground")} title={info.call ?? undefined}>
                    {info.call ?? ""}
                </span>
            </div>
        </div>
    );
}
