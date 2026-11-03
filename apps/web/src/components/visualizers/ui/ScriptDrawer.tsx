"use client";
import { useCallback, useEffect, useRef, useState, type ComponentType } from "react";
import type { StoreApi } from "zustand/vanilla";
import { cn } from "@/lib/utils";
import type { Diagnostic } from "../core/types";
import { visualizer } from "../engine/instance";
import type { VisualizerStore } from "../engine/store";
import { compileScript } from "../script/compile";
import { EXAMPLES } from "../script/examples";
import { applyFix } from "../script/fixes";
import { countBySeverity } from "../script/markers";
import { loadScript, saveScript } from "../script/storage";
import { btn, btnPrimary, inputCls } from "../shared/styles";
import type { EditorHandle, ScriptEditorProps } from "./ScriptEditor";

interface Props {
    /** Pass LazyScriptEditor in the app. Tests pass a plain textarea. */
    editor: ComponentType<ScriptEditorProps>;
    store?: StoreApi<VisualizerStore>;
    dark?: boolean;
    defaultOpen?: boolean;
}

const LINT_MS = 300;
const SAVE_MS = 400;
const dot: Record<Diagnostic["severity"], string> = { error: "bg-destructive", warning: "bg-amber-500", info: "bg-sky-500" };

/**
 * Script drawer: a JSON editor with problems, quick fixes, examples and Run.
 * Typing only lints (the canvas does not rebuild); Run (button or Ctrl/Cmd+Enter) loads the script into the one visualizer store.
 */
export function ScriptDrawer({ editor: Editor, store = visualizer, dark = true, defaultOpen = false }: Props) {
    const [open, setOpen] = useState(defaultOpen);
    const [text, setText] = useState("");
    const [diagnostics, setDiagnostics] = useState<Diagnostic[]>([]);
    const [ran, setRan] = useState<{ ok: boolean; steps: number } | null>(null);
    const textRef = useRef(text);
    textRef.current = text;
    const handle = useRef<EditorHandle | null>(null);
    const hydrated = useRef(false);
    const onReady = useCallback((h: EditorHandle) => {
        handle.current = h;
    }, []);

    const runText = useCallback(
        (t: string) => {
            const c = compileScript(t);
            store.getState().load(c);
            setDiagnostics(c.diagnostics);
            setRan({ ok: c.ok, steps: c.frames.length });
        },
        [store],
    );
    const run = useCallback(() => runText(textRef.current), [runText]);

    // Restore the last script. If nothing is loaded yet, show it on the canvas straight away.
    useEffect(() => {
        const saved = loadScript();
        if (saved && saved.trim() !== "") {
            setText(saved);
            if (store.getState().compiled === null) runText(saved);
        }
        hydrated.current = true;
    }, [store, runText]);

    useEffect(() => {
        if (!hydrated.current) return;
        const id = setTimeout(() => saveScript(text), SAVE_MS);
        return () => clearTimeout(id);
    }, [text]);

    // Live validation only lints; it never rebuilds the canvas.
    useEffect(() => {
        const id = setTimeout(() => setDiagnostics(text.trim() === "" ? [] : compileScript(text).diagnostics), LINT_MS);
        return () => clearTimeout(id);
    }, [text]);

    // Ctrl/Cmd+Enter outside the editor (inside it, the editor's own command handles it).
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== "Enter" || !(e.ctrlKey || e.metaKey)) return;
            if ((e.target as HTMLElement | null)?.closest?.(".monaco-editor")) return;
            e.preventDefault();
            run();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, run]);

    const loadExample = (id: string) => {
        const ex = EXAMPLES.find((x) => x.id === id);
        if (!ex) return;
        setText(ex.script);
        runText(ex.script);
    };
    const fix = (d: Diagnostic) => {
        const next = applyFix(textRef.current, d);
        if (next !== null) setText(next);
    };

    const { errors, warnings } = countBySeverity(diagnostics);
    const blank = text.trim() === "";

    return (
        <section aria-label="Script" className="flex flex-col gap-3 rounded-2xl border border-primary-foreground/10 bg-card/50 p-3">
            <div className="flex flex-wrap items-center gap-2">
                <button type="button" className={cn(btn, "font-semibold")} aria-expanded={open} aria-controls="script-body" onClick={() => setOpen((o) => !o)}>
                    Script {open ? "▾" : "▸"}
                </button>
                <label className="sr-only" htmlFor="script-examples">
                    Examples
                </label>
                <select id="script-examples" className={cn(inputCls, "h-8 w-auto py-0")} value="" onChange={(e) => loadExample(e.target.value)}>
                    <option value="">Examples…</option>
                    {EXAMPLES.map((x) => (
                        <option key={x.id} value={x.id} title={x.description}>
                            {x.title}
                        </option>
                    ))}
                </select>
                <button type="button" className={btnPrimary} onClick={run} aria-keyshortcuts="Control+Enter Meta+Enter" title="Run (Ctrl/Cmd+Enter)">
                    Run
                </button>
                <span role="status" aria-live="polite" className={cn("ml-auto text-xs", errors > 0 || (ran && !ran.ok) ? "text-destructive" : "text-muted-foreground")}>
                    {errors > 0 ? `${errors} error${errors === 1 ? "" : "s"}` : ran?.ok ? `Ready · ${ran.steps} step${ran.steps === 1 ? "" : "s"}` : ""}
                    {warnings > 0 ? `${errors > 0 ? " · " : ""}${warnings} warning${warnings === 1 ? "" : "s"}` : ""}
                </span>
            </div>

            {open && (
                <div id="script-body" className="flex flex-col gap-3">
                    {blank && (
                        <div data-empty className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-primary-foreground/20 p-3 text-sm text-muted-foreground">
                            <span>No script yet. Pick an example, or start from a sample.</span>
                            <button type="button" className={btn} onClick={() => loadExample(EXAMPLES[0].id)}>
                                Load sample
                            </button>
                        </div>
                    )}
                    <div className="h-72 overflow-hidden rounded-xl border border-primary-foreground/10">
                        <Editor value={text} onChange={setText} onRun={run} diagnostics={diagnostics} dark={dark} onReady={onReady} />
                    </div>

                    <div aria-label="Problems" className="flex flex-col gap-1">
                        <h3 className="text-xs font-semibold">Problems {diagnostics.length > 0 ? `(${diagnostics.length})` : ""}</h3>
                        {diagnostics.length === 0 ? (
                            <p className="text-xs text-muted-foreground">No problems.</p>
                        ) : (
                            <ul className="flex max-h-40 flex-col overflow-y-auto">
                                {diagnostics.map((d, i) => (
                                    <li key={i} data-problem={d.severity} className="flex items-start gap-2 border-b border-primary-foreground/10 py-1.5 text-xs last:border-0">
                                        <span aria-label={d.severity} className={cn("mt-1 h-1.5 w-1.5 shrink-0 rounded-full", dot[d.severity])} />
                                        <button type="button" className="min-w-0 flex-1 text-left outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary-foreground/20" onClick={() => handle.current?.reveal(d.line, d.column)}>
                                            <span className="font-mono text-muted-foreground">
                                                {d.line}:{d.column}
                                            </span>{" "}
                                            {d.message}
                                        </button>
                                        {d.fix && (
                                            <button type="button" className={cn(btn, "h-6 shrink-0 px-2 text-xs")} onClick={() => fix(d)}>
                                                {d.fix.label}
                                            </button>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            )}
        </section>
    );
}
