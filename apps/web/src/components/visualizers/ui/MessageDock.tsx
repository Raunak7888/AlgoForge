"use client";
import { useStore } from "zustand";
import type { StoreApi } from "zustand/vanilla";
import { cn } from "@/lib/utils";
import { visualizer } from "../engine/instance";
import { currentMessages } from "../engine/selectors";
import type { VisualizerStore } from "../engine/store";
import { describeStep } from "./describe";
import { splitInlineCode } from "./inlineCode";

interface Props {
    store?: StoreApi<VisualizerStore>;
    /** Show the operation call (and the engine's error) under the narration. */
    details?: boolean;
    /** Keep the last narration on screen until a later step has its own. */
    persist?: boolean;
}

/**
 * Narration for the current step. Takes no space when there is nothing to say (it stays in the
 * accessibility tree so screen readers still hear new narration). Plain text only; `backticks` become code spans.
 */
export function MessageDock({ store = visualizer, details = false, persist = true }: Props) {
    const compiled = useStore(store, (s) => s.compiled);
    const t = useStore(store, (s) => s.transport);
    const messages = currentMessages(compiled, t, persist);
    const info = describeStep(compiled, t);
    const empty = messages.length === 0 && !(details && info.call);

    return (
        <section
            role="status"
            aria-live="polite"
            aria-label="Narration"
            data-message-dock
            className={cn("flex flex-col gap-0.5 rounded-xl border bg-card/50 px-3 py-1.5 text-xs", info.failed ? "border-destructive/60" : "border-primary-foreground/10", empty && "sr-only")}
        >
            {messages.length === 0 ? (
                <p aria-hidden className="sr-only">
                    –
                </p>
            ) : (
                messages.map((m, i) => (
                    <p key={i} className="line-clamp-3 leading-snug">
                        {splitInlineCode(m).map((seg, j) =>
                            seg.code ? (
                                <code key={j} className="rounded bg-primary-foreground/10 px-1 py-0.5 font-mono text-[0.85em]">
                                    {seg.text}
                                </code>
                            ) : (
                                <span key={j}>{seg.text}</span>
                            ),
                        )}
                    </p>
                ))
            )}
            {details && info.call && (
                <p data-details className={cn("truncate font-mono text-[11px]", info.failed ? "text-destructive" : "text-muted-foreground")}>
                    {info.call}
                    {info.failed && info.error ? ` · Rejected: ${info.error}` : ""}
                </p>
            )}
        </section>
    );
}
