"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { PageShell } from "@/components/site/PageShell";
import { visualizer } from "@/components/visualizers/engine/instance";
import { compileScript } from "@/components/visualizers/script/compile";
import { saveScript } from "@/components/visualizers/script/storage";
import { rememberAlgorithm } from "@/lib/assistant/algorithmContext";
import { btn, btnPrimary } from "@/components/visualizers/shared/styles";
import { isApiError } from "@/lib/api/errors";
import { QueryBoundary, useAlgorithm } from "@/lib/query";

export default function AlgorithmPage() {
    const params = useParams<{ slug: string }>();
    const slug = typeof params.slug === "string" ? params.slug : "";
    const router = useRouter();
    const query = useAlgorithm(slug);
    const [lang, setLang] = useState<string | null>(null);

    if (query.isError && isApiError(query.error) && query.error.status === 404) {
        return (
            <PageShell>
                <h1 className="mb-2 text-2xl font-bold">Algorithm not found</h1>
                <p className="mb-4 text-foreground/60">It may have been removed, or it is not published.</p>
                <Link href="/algorithms" className={btn}>Back to the catalog</Link>
            </PageShell>
        );
    }

    const a = query.data;
    const code = a ? (a.displayCodes.find((c) => c.language === lang) ?? a.displayCode) : null;

    // The visualizer reads the script saved in this browser; the store is loaded too so the canvas is ready at once.
    const open = () => {
        if (!a?.script) return;
        saveScript(a.script);
        rememberAlgorithm(a.slug, a.script);
        visualizer.getState().load(compileScript(a.script));
        router.push("/dashboard?tab=visualizer");
    };

    return (
        <PageShell wide>
            <Link href="/algorithms" className="mb-4 inline-block text-sm text-foreground/60 hover:text-foreground">← All algorithms</Link>
            <QueryBoundary query={query} loadingLabel="Loading…">
                {a && (
                    <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr]">
                        <div>
                            <p className="mb-1 font-mono text-xs uppercase tracking-widest text-foreground/50">{a.categoryLabel} · {a.difficulty}</p>
                            <h1 className="mb-3 text-3xl font-bold tracking-tight">{a.name}</h1>
                            <p className="mb-5 text-foreground/70">{a.description}</p>
                            {a.complexity && (
                                <dl className="mb-5 grid grid-cols-2 gap-3 text-sm">
                                    {([["Best", a.complexity.timeBest], ["Average", a.complexity.timeAverage], ["Worst", a.complexity.timeWorst], ["Space", a.complexity.space]] as const).map(([k, v]) => (
                                        <div key={k} className="rounded-xl border border-foreground/10 px-3 py-2">
                                            <dt className="text-xs text-foreground/50">{k}</dt>
                                            <dd className="font-mono">{v ?? "–"}</dd>
                                        </div>
                                    ))}
                                </dl>
                            )}
                            <div className="mb-5 flex flex-wrap gap-2 text-xs text-foreground/60">
                                {a.tags.map((t) => (
                                    <span key={t.id} className="rounded-full border border-foreground/15 px-2 py-0.5">#{t.label}</span>
                                ))}
                            </div>
                            {a.script ? (
                                <button type="button" className={btnPrimary} onClick={open}>Open in the visualizer</button>
                            ) : (
                                <p className="text-sm text-foreground/50">This algorithm has no visualization yet.</p>
                            )}
                        </div>
                        <div>
                            {code ? (
                                <div className="overflow-hidden rounded-2xl border border-foreground/10">
                                    <div className="flex items-center gap-2 border-b border-foreground/10 px-3 py-2">
                                        {a.displayCodes.map((c) => (
                                            <button key={c.language} type="button" aria-pressed={c.language === code.language} onClick={() => setLang(c.language)} className={`rounded-md px-2 py-1 font-mono text-xs ${c.language === code.language ? "bg-foreground text-background" : "text-foreground/60 hover:text-foreground"}`}>
                                                {c.language}
                                            </button>
                                        ))}
                                    </div>
                                    <pre className="overflow-x-auto p-4 font-mono text-[12.5px] leading-6"><code>{code.code}</code></pre>
                                </div>
                            ) : null}
                        </div>
                    </div>
                )}
            </QueryBoundary>
        </PageShell>
    );
}
