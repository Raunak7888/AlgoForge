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
 * Narration for the current step, docked below the canvas so it never covers content.
 * Plain text only (React escapes it); `backticks` become code spans. Announced politely to screen readers.
 */
export function MessageDock({ store = visualizer, details = false, persist = true }: Props) {
    const compiled = useStore(store, (s) => s.compiled);
    const t = useStore(store, (s) => s.transport);
    const messages = currentMessages(compiled, t, persist);
    const info = describeStep(compiled, t);

    return (
        <section role="status" aria-live="polite" aria-label="Narration" data-message-dock className={cn("flex min-h-[4.5rem] flex-col gap-1.5 rounded-2xl border bg-card/50 px-4 py-3 text-sm", info.failed ? "border-destructive/60" : "border-primary-foreground/10")}>
            {messages.length === 0 ? (
                <p aria-hidden className="text-muted-foreground">
                    –
                </p>
            ) : (
                messages.map((m, i) => (
                    <p key={i} className="leading-relaxed">
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
                <p data-details className={cn("border-t border-primary-foreground/10 pt-1.5 font-mono text-xs", info.failed ? "text-destructive" : "text-muted-foreground")}>
                    {info.call}
                    {info.failed && info.error ? ` · Rejected: ${info.error}` : ""}
                </p>
            )}
        </section>
    );
}
