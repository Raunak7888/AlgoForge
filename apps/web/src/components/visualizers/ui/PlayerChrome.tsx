"use client";
import { useState } from "react";
import type { StoreApi } from "zustand/vanilla";
import { cn } from "@/lib/utils";
import { visualizer } from "../engine/instance";
import type { VisualizerStore } from "../engine/store";
import { btn } from "../shared/styles";
import { HOTKEY_HELP } from "./hotkeys";
import { MessageDock } from "./MessageDock";
import { TransportBar } from "./TransportBar";
import { useTransportHotkeys } from "./useTransportHotkeys";

const on = "bg-primary-foreground text-primary-background hover:bg-primary-foreground";

/** Everything under the canvas: narration, transport, options and shortcut help. Phase 6 mounts this inside the panel. */
export function PlayerChrome({ store = visualizer }: { store?: StoreApi<VisualizerStore> }) {
    const [details, setDetails] = useState(false);
    const [persist, setPersist] = useState(true);
    const [help, setHelp] = useState(false);

    useTransportHotkeys(store, { messages: () => setDetails((d) => !d), help: () => setHelp((h) => !h) });

    return (
        <div className="flex flex-col gap-3">
            <MessageDock store={store} details={details} persist={persist} />
            <TransportBar store={store} />
            <div className="flex flex-wrap items-center gap-2">
                <button type="button" className={cn(btn, details && on)} aria-pressed={details} aria-keyshortcuts="M" title="Show the operation call under the narration (M)" onClick={() => setDetails((d) => !d)}>
                    Details
                </button>
                <button type="button" className={cn(btn, persist && on)} aria-pressed={persist} title="Keep the last narration visible on steps that have none" onClick={() => setPersist((p) => !p)}>
                    Keep narration
                </button>
                <button type="button" className={btn} aria-expanded={help} aria-controls="player-keys" aria-keyshortcuts="?" onClick={() => setHelp((h) => !h)}>
                    Shortcuts
                </button>
            </div>
            {help && (
                <dl id="player-keys" className="grid gap-x-6 gap-y-1.5 rounded-2xl border border-primary-foreground/10 bg-card/50 p-4 text-xs sm:grid-cols-2">
                    {HOTKEY_HELP.map(([k, v]) => (
                        <div key={k} className="flex items-baseline justify-between gap-3">
                            <dt className="font-mono text-muted-foreground">{k}</dt>
                            <dd className="text-right">{v}</dd>
                        </div>
                    ))}
                </dl>
            )}
        </div>
    );
}
