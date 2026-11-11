"use client";
import { useState } from "react";
import type { StoreApi } from "zustand/vanilla";
import { visualizer } from "../engine/instance";
import type { VisualizerStore } from "../engine/store";
import { MessageDock } from "./MessageDock";
import { ShortcutsHelp, TransportBar } from "./TransportBar";
import { useTransportHotkeys } from "./useTransportHotkeys";

/** Everything under the canvas: narration, transport (with display options), and shortcut help. Phase 6 mounts this inside the panel. */
export function PlayerChrome({
    store = visualizer,
}: {
    store?: StoreApi<VisualizerStore>;
}) {
    const [details, setDetails] = useState(false);
    const [persist, setPersist] = useState(true);
    const [help, setHelp] = useState(false);

    const toggleDetails = () => setDetails((d) => !d);
    const toggleHelp = () => setHelp((h) => !h);

    useTransportHotkeys(store, { messages: toggleDetails, help: toggleHelp });

    return (
        <div className="flex flex-col gap-3">
            <MessageDock store={store} details={details} persist={persist} />
            <TransportBar
                store={store}
                options={{
                    details,
                    onDetails: toggleDetails,
                    persist,
                    onPersist: () => setPersist((p) => !p),
                    help,
                    onHelp: toggleHelp,
                }}
            />
            <ShortcutsHelp open={help} onClose={() => setHelp(false)} />
        </div>
    );
}
