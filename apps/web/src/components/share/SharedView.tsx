"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { PublicCreator, PublicShareResponse, SharedAnalysisResponse, SharedExplainSessionResponse, SharedVisualizationResponse } from "@algoforge/contracts";
import { Markdown } from "@/components/DashBoard/Markdown";
import { ResultsScreen } from "@/components/DashBoard/Analysis";
import { VisualizerCanvas } from "@/components/visualizers/canvas";
import { createVisualizer } from "@/components/visualizers/engine";
import { compileScript } from "@/components/visualizers/script/compile";
import { saveScript } from "@/components/visualizers/script/storage";
import { PlayerChrome } from "@/components/visualizers/ui/PlayerChrome";
import { btn, btnPrimary } from "@/components/visualizers/shared/styles";
import { useWorkspace } from "@/lib/workspace/store";

const KIND = { analysis: "Code analysis", explain: "AI chat", visualization: "Visualization" } as const;
const CANVAS_CLASS = "relative min-h-[320px] w-full touch-none select-none overflow-hidden rounded-2xl border border-neutral-500/25 bg-neutral-500/5 outline-none";

function Header({ type, title, creator, createdAt, action }: { type: PublicShareResponse["type"]; title: string; creator?: PublicCreator; createdAt: string; action: React.ReactNode }) {
    const who = creator?.name ?? creator?.username ?? null;
    return (
        <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
                <p className="mb-1 font-mono text-xs uppercase tracking-widest text-foreground/50">{KIND[type]} · read only</p>
                <h1 className="truncate text-2xl font-bold tracking-tight">{title}</h1>
                <p className="mt-1 text-sm text-foreground/60">
                    {who ? `Shared by ${who} · ` : "Shared · "}
                    {new Date(createdAt).toLocaleDateString(undefined, { dateStyle: "medium" })}
                </p>
            </div>
            <div className="flex shrink-0 gap-2">{action}</div>
        </header>
    );
}

function Unreadable({ what }: { what: string }) {
    return (
        <div role="status" className="rounded-2xl border border-foreground/10 p-6 text-sm text-foreground/70">
            This {what} was saved in a format this version cannot display. Its owner can open it again from their dashboard.
        </div>
    );
}

function AnalysisShare({ data, creator, createdAt }: { data: SharedAnalysisResponse; creator?: PublicCreator; createdAt: string }) {
    const router = useRouter();
    const open = () => {
        // A private copy in this browser's editor. Nothing is written to the owner's account or to ours.
        const ws = useWorkspace.getState();
        ws.setLanguage(data.language);
        ws.setCode(data.code);
        router.push("/dashboard");
    };
    return (
        <>
            <Header type="analysis" title={`${data.language === "python" ? "Python" : "JavaScript"} analysis`} creator={creator} createdAt={createdAt} action={<button type="button" className={btnPrimary} onClick={open}>Open code in the editor</button>} />
            {data.result ? (
                <div className="h-[75vh] overflow-hidden rounded-2xl border border-foreground/10">
                    <ResultsScreen language={data.language} result={data.result} resetLabel="Open code in the editor" onReset={open} />
                </div>
            ) : (
                <Unreadable what="analysis" />
            )}
            <details className="mt-6 rounded-2xl border border-foreground/10 p-4">
                <summary className="cursor-pointer text-sm font-medium">The analyzed code</summary>
                <pre className="mt-3 overflow-x-auto font-mono text-[12.5px] leading-6"><code>{data.code}</code></pre>
            </details>
        </>
    );
}

function ExplainShare({ data, creator, createdAt }: { data: SharedExplainSessionResponse; creator?: PublicCreator; createdAt: string }) {
    return (
        <>
            <Header type="explain" title={data.title ?? "AI chat"} creator={creator} createdAt={createdAt} action={<Link href="/dashboard" className={btn}>Open AlgoForge</Link>} />
            <ol aria-label="Conversation" className="flex flex-col gap-4">
                {data.messages.map((m) => {
                    const user = m.role === "user";
                    return (
                        <li key={m.id} className={`flex ${user ? "justify-end" : "justify-start"}`}>
                            <div className={`max-w-[88%] wrap-break-word rounded-2xl px-4 py-3 text-sm leading-relaxed ${user ? "whitespace-pre-wrap bg-foreground/10" : "border border-foreground/10 bg-foreground/[.03]"}`}>
                                <span className="sr-only">{user ? "Question: " : "Answer: "}</span>
                                {user ? m.content : <Markdown source={m.content} />}
                            </div>
                        </li>
                    );
                })}
            </ol>
            {data.messages.length === 0 && <p className="text-foreground/60">This chat has no messages.</p>}
        </>
    );
}

function VisualizationShare({ data, creator, createdAt }: { data: SharedVisualizationResponse; creator?: PublicCreator; createdAt: string }) {
    const router = useRouter();
    // A private store: it never touches the viewer's own visualizer or saved script.
    const [store] = useState(() => createVisualizer());
    const compiled = useMemo(() => compileScript(data.script), [data.script]);
    useEffect(() => {
        store.getState().load(compiled);
    }, [store, compiled]);

    const copy = () => {
        saveScript(data.script); // becomes the viewer's local script; they can save it to their own account
        useWorkspace.getState().setSavedVisualization(null);
        router.push("/dashboard?tab=visualizer");
    };
    return (
        <>
            <Header type="visualization" title={data.title} creator={creator} createdAt={createdAt} action={<button type="button" className={btnPrimary} onClick={copy}>Make your own copy</button>} />
            {data.description && <p className="mb-4 text-foreground/70">{data.description}</p>}
            {!compiled.ok && <p role="alert" className="mb-4 text-sm text-destructive">This script has problems and may not play fully.</p>}
            <div className="flex min-h-[320px] flex-col">
                <VisualizerCanvas store={store} className={CANVAS_CLASS} />
            </div>
            <div className="mt-4">
                <PlayerChrome store={store} />
            </div>
        </>
    );
}

export function SharedView({ share }: { share: PublicShareResponse }) {
    switch (share.type) {
        case "analysis":
            return <AnalysisShare data={share.data} creator={share.creator} createdAt={share.createdAt} />;
        case "explain":
            return <ExplainShare data={share.data} creator={share.creator} createdAt={share.createdAt} />;
        case "visualization":
            return <VisualizationShare data={share.data} creator={share.creator} createdAt={share.createdAt} />;
    }
}
