"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Cancel01Icon, Search01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import { btnPrimary } from "../shared/styles";
import {
    Backward01Icon,
    CodeIcon,
    Forward01Icon,
    KeyboardIcon,
    NextIcon,
    PauseIcon,
    PinIcon,
    PlayIcon,
    PreviousIcon,
    ReloadIcon,
    RepeatIcon,
} from "@hugeicons/core-free-icons";
import { useStore } from "zustand";
import type { StoreApi } from "zustand/vanilla";
import { cn } from "@/lib/utils";
import { visualizer } from "../engine/instance";
import { canPlay, canStepBack, canStepForward, currentIndex, failedSteps, isPlaying, progressOf } from "../engine/selectors";
import type { VisualizerStore } from "../engine/store";
import { SPEEDS } from "../engine/transport";
import { btn } from "../shared/styles";
import { describeStep, valueText } from "./describe";
import { HOTKEY_HELP } from "./hotkeys";
import { useVisualize } from "../../../lib/workspace/VisualizerApi";


const MAX_ALL_TICKS = 200;
const on = "bg-primary-foreground text-primary-background hover:bg-primary-foreground";

type BtnProps = {
    label: string;
    icon: IconSvgElement;
    onClick: () => void;
    keys?: string;
    disabled?: boolean;
    pressed?: boolean;
    expanded?: boolean;
    controls?: string;
};

function Btn({ label, icon, onClick, keys, disabled, pressed, expanded, controls }: BtnProps) {
    return (
        <button
            type="button"
            className={cn(btn, "w-8 px-0", (pressed || expanded) && on)}
            aria-label={label}
            aria-pressed={pressed}
            aria-expanded={expanded}
            aria-controls={controls}
            aria-keyshortcuts={keys}
            title={keys ? `${label} (${keys})` : label}
            onClick={onClick}
            disabled={disabled}
        >
            <HugeiconsIcon icon={icon} size={14} strokeWidth={1.8} aria-hidden />
        </button>
    );
}

export type TransportOptions = {
    details: boolean;
    onDetails: () => void;
    persist: boolean;
    onPersist: () => void;
    help: boolean;
    onHelp: () => void;
};

/** Play, pause, step, replay, restart, jump, loop, speed, display options, and a slider with one tick per step. */
export function TransportBar({ store = visualizer, options }: { store?: StoreApi<VisualizerStore>; options: TransportOptions }) {
    const t = useStore(store, (s) => s.transport);
    const compiled = useStore(store, (s) => s.compiled);
    const { visualize, loading, error } = useVisualize(store);
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
                <Btn label="Restart" keys="Home" icon={PreviousIcon} onClick={() => act().restart()} disabled={!enabled} />
                <Btn label="Step back" keys="ArrowLeft" icon={Backward01Icon} onClick={() => act().stepBack()} disabled={!canStepBack(t)} />
                <Btn label={playing ? "Pause" : "Play"} keys="Space" icon={playing ? PauseIcon : PlayIcon} onClick={() => act().toggle()} disabled={!enabled} pressed={playing} />
                <Btn label="Step forward" keys="ArrowRight" icon={Forward01Icon} onClick={() => act().stepForward()} disabled={!canStepForward(t)} />
                <Btn label="Replay step" keys="R" icon={ReloadIcon} onClick={() => act().replayStep()} disabled={!enabled || currentIndex(t) < 0} />
                <Btn label="Jump to end" keys="End" icon={NextIcon} onClick={() => act().jumpToEnd()} disabled={!enabled} />
                <Btn label="Loop" keys="L" icon={RepeatIcon} onClick={() => act().setLoop(!t.loop)} pressed={t.loop} />
                
                <div className="ml-auto flex items-center gap-2">
                    <button
                        type="button"
                        className={cn(btnPrimary, "h-8 whitespace-nowrap px-3")}
                        onClick={visualize}
                        disabled={loading}
                        aria-busy={loading}
                        title="Convert the code in the editor into an animation"
                    >
                        {loading ? "Visualizing…" : "Visualize algorithm"}
                    </button>

                  
                    <div role="group" aria-label="Playback speed" className="inline-flex rounded-lg border border-primary-foreground/15 p-0.5">
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

                    <div role="group" aria-label="Display options" className="flex items-center gap-1.5">
                        <Btn label="Details: show the operation call under the narration" keys="M" icon={CodeIcon} onClick={options.onDetails} pressed={options.details} />
                        <Btn label="Keep narration: stay visible on steps that have none" icon={PinIcon} onClick={options.onPersist} pressed={options.persist} />
                        <Btn label="Keyboard shortcuts" keys="?" icon={KeyboardIcon} onClick={options.onHelp} expanded={options.help} controls="player-keys" />
                    </div>
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
            {error && (
                <p role="alert" className="text-xs text-destructive">
                    {error}
                </p>
            )}
        </div>
    );
}

const GROUPS: { title: string; match: RegExp }[] = [
    { title: "Playback", match: /play|pause|restart|replay|jump|loop|speed|start|end/i },
    { title: "Navigation", match: /step|back|forward|seek|next|prev|previous|slider/i },
    { title: "Display", match: /detail|narration|message|shortcut|help|close/i },
];

/** "Shift + ArrowLeft / ArrowRight" -> [["Shift","←"], ["→"]] (alternatives, each a chord). */
function parseKeys(raw: string): string[][] {
    // If it contains a slash or comma that isn't part of "+/-", handle carefully:
    // Better yet, update HOTKEY_HELP entry for +/- to use "or" or handle it in the regex:
    return raw
        .split(/\s*(?:\bor\b)\s*/i) // split by "or" first, or use custom split
        .filter(Boolean)
        .map((alt) => alt.split(/\s*,\s*/).map(k => k.trim())); // wait, if you want F, 0, and +/- as alternatives:
}

function Keycap({ children }: { children: string }) {
    return (
        <kbd
            className={cn(
                "inline-flex h-7 min-w-7 items-center justify-center rounded-md px-2",
                "border border-primary-foreground/15 border-b-[3px] bg-linear-to-b from-primary-foreground/10 to-primary-foreground/3",
                "font-mono text-[11px] font-medium text-primary-foreground shadow-[0_1px_0_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.08)]",
                "transition group-hover:-translate-y-px group-hover:border-[#FF430F]/50 group-hover:text-[#FF430F]",
            )}
        >
            {children}
        </kbd>
    );
}

function KeyCombo({ raw }: { raw: string }) {
    const alts = parseKeys(raw);
    return (
        <span className="flex flex-wrap items-center justify-end gap-x-1.5 gap-y-1">
            {alts.map((chord, i) => (
                <span key={i} className="flex items-center gap-1.5">
                    {i > 0 && <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60">or</span>}
                    <span className="flex items-center gap-1">
                        {chord.map((k, j) => (
                            <span key={j} className="flex items-center gap-1">
                                {j > 0 && <span className="text-xs text-muted-foreground/60">+</span>}
                                <Keycap>{k}</Keycap>
                            </span>
                        ))}
                    </span>
                </span>
            ))}
        </span>
    );
}

/** Centered, blurred-backdrop modal listing every keyboard shortcut. Toggled by the keyboard button or the "?" hotkey. */
export function ShortcutsHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
    const ref = useRef<HTMLDialogElement>(null);
    const [query, setQuery] = useState("");

    useEffect(() => {
        const d = ref.current;
        if (!d) return;
        if (open && !d.open) d.showModal();
        if (!open && d.open) d.close();
    }, [open]);

    const sections = useMemo(() => {
        const q = query.trim().toLowerCase();
        const rows = HOTKEY_HELP.filter(([k, v]) => !q || k.toLowerCase().includes(q) || v.toLowerCase().includes(q));
        const buckets = new Map<string, typeof rows>();
        for (const row of rows) {
            const title = GROUPS.find((g) => g.match.test(row[1]))?.title ?? "General";
            buckets.set(title, [...(buckets.get(title) ?? []), row]);
        }
        const order = [...GROUPS.map((g) => g.title), "General"];
        return order.filter((t) => buckets.has(t)).map((t) => ({ title: t, rows: buckets.get(t)! }));
    }, [query]);

    return (
        <dialog
            ref={ref}
            id="player-keys"
            aria-labelledby="player-keys-title"
            onClose={() => {
                setQuery("");
                onClose();
            }}
            onClick={(e) => e.target === ref.current && onClose()}
            className={cn(
                "m-auto w-[min(92vw,44rem)] overflow-visible bg-transparent p-0 text-primary-foreground",
                "backdrop:bg-black/50 backdrop:backdrop-blur-md",
                "open:animate-in open:fade-in-0 open:zoom-in-95 open:duration-200",
            )}
        >
            <div className="relative overflow-hidden rounded-3xl border border-primary-foreground/10 bg-card/90 shadow-[0_30px_120px_-20px_rgba(0,0,0,0.8)] backdrop-blur-xl">
                {/* ambient glow */}

                {/* header */}
                <header className="relative flex items-center gap-4 border-b border-primary-foreground/10 px-6 py-5">
                    <div className="grid size-11 place-items-center rounded-2xl bg-linear-to-br from-[#FF430F] to-[#FF8A3D] text-white shadow-lg shadow-[#FF430F]/30">
                        <HugeiconsIcon icon={KeyboardIcon} size={22} strokeWidth={1.8} aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1">
                        <h2 id="player-keys-title" className="text-lg font-semibold leading-tight tracking-tight">
                            Keyboard shortcuts
                        </h2>
                        <p className="text-xs text-muted-foreground">Drive the visualizer without touching the mouse.</p>
                    </div>
                    <button
                        type="button"
                        aria-label="Close shortcuts"
                        title="Close (Esc)"
                        onClick={onClose}
                        className="grid size-8 place-items-center rounded-lg border border-primary-foreground/10 text-muted-foreground outline-none transition hover:bg-primary-foreground/10 hover:text-primary-foreground focus-visible:ring-2 focus-visible:ring-[#FF430F]/40"
                    >
                        <HugeiconsIcon icon={Cancel01Icon} size={16} strokeWidth={1.8} aria-hidden />
                    </button>
                </header>

                {/* search */}
                <div className="relative px-6 pt-4">
                    <HugeiconsIcon icon={Search01Icon} size={16} strokeWidth={1.8} aria-hidden className="pointer-events-none absolute left-9 top-1/2 mt-2 -translate-y-1/2 text-muted-foreground" />
                    <input
                        type="search"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search shortcuts…"
                        aria-label="Search shortcuts"
                        className="h-10 w-full rounded-xl border border-primary-foreground/10 bg-primary-foreground/[0.04] pl-10 pr-3 text-sm outline-none transition placeholder:text-muted-foreground focus:border-[#FF430F]/50 focus:ring-2 focus:ring-[#FF430F]/20"
                    />
                </div>

                {/* body */}
                <div className="relative max-h-[min(60vh,28rem)] overflow-y-auto scrollbar-thin px-6 py-5">
                    {sections.length === 0 ? (
                        <p className="py-10 text-center text-sm text-muted-foreground">No shortcuts match “{query}”.</p>
                    ) : (
                        <div className="grid gap-6 sm:grid-cols-2">
                            {sections.map((s) => (
                                <section key={s.title} className="flex flex-col gap-1.5">
                                    <h3 className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                                        <span className="h-px w-3 bg-[#FF430F]" />
                                        {s.title}
                                    </h3>
                                    <dl className="flex flex-col">
                                        {s.rows.map(([k, v]) => (
                                            <div key={k} className="group flex items-center justify-between gap-4 rounded-xl px-2.5 py-2 transition hover:bg-primary-foreground/[0.05]">
                                                <dd className="min-w-0 text-sm text-primary-foreground/90">{v}</dd>
                                                <dt className="shrink-0">
                                                    <KeyCombo raw={k} />
                                                </dt>
                                            </div>
                                        ))}
                                    </dl>
                                </section>
                            ))}
                        </div>
                    )}
                </div>

                {/* footer */}
                <footer className="relative flex items-center justify-between border-t border-primary-foreground/10 bg-primary-foreground/[0.02] px-6 py-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                        Press <Keycap>?</Keycap> anytime to toggle
                    </span>
                    <span className="flex items-center gap-1.5">
                        <Keycap>Esc</Keycap> to close
                    </span>
                </footer>
            </div>
        </dialog>
    );
}