"use client";

import Link from "next/link";
import { useState } from "react";
import { PageShell } from "@/components/site/PageShell";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { QueryBoundary, useAlgorithmCatalog, useCategories } from "@/lib/query";
import { btn, inputCls } from "@/components/visualizers/shared/styles";

const DIFFICULTIES = ["beginner", "intermediate", "advanced"] as const;
type Difficulty = (typeof DIFFICULTIES)[number];

export default function AlgorithmsPage() {
    const [q, setQ] = useState("");
    const [categoryId, setCategoryId] = useState("");
    const [difficulty, setDifficulty] = useState<"" | Difficulty>("");
    const term = useDebouncedValue(q.trim(), 250);
    const categories = useCategories();
    const catalog = useAlgorithmCatalog({
        limit: 12,
        ...(term ? { q: term } : {}),
        ...(categoryId ? { categoryId } : {}),
        ...(difficulty ? { difficulty } : {}),
    });
    const items = catalog.data?.pages.flatMap((p) => p.data) ?? [];

    return (
        <PageShell wide>
            <h1 className="mb-1 text-3xl font-bold tracking-tight">Algorithms</h1>
            <p className="mb-6 text-foreground/60">Pick one and watch it run, step by step.</p>

            <div className="mb-6 flex flex-wrap gap-3">
                <label className="sr-only" htmlFor="alg-q">Search algorithms</label>
                <input id="alg-q" className={`${inputCls} max-w-xs`} placeholder="Search by name or topic" value={q} onChange={(e) => setQ(e.target.value)} maxLength={100} />
                <label className="sr-only" htmlFor="alg-cat">Category</label>
                <select id="alg-cat" className={`${inputCls} w-auto`} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                    <option value="">All categories</option>
                    {(categories.data?.data ?? []).map((c) => (
                        <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                </select>
                <label className="sr-only" htmlFor="alg-diff">Difficulty</label>
                <select id="alg-diff" className={`${inputCls} w-auto`} value={difficulty} onChange={(e) => setDifficulty(e.target.value as "" | Difficulty)}>
                    <option value="">Any difficulty</option>
                    {DIFFICULTIES.map((d) => (
                        <option key={d} value={d}>{d}</option>
                    ))}
                </select>
            </div>

            <QueryBoundary query={catalog} loadingLabel="Loading algorithms…">
                {items.length === 0 ? (
                    <p className="py-10 text-center text-foreground/60">No algorithms match. Try fewer filters.</p>
                ) : (
                    <ul className="grid gap-4 sm:grid-cols-2">
                        {items.map((a) => (
                            <li key={a.id}>
                                <Link href={`/algorithms/${a.slug}`} className="flex h-full flex-col gap-2 rounded-2xl border border-foreground/10 bg-foreground/[.03] p-5 transition hover:border-accent/40">
                                    <div className="flex items-center justify-between gap-3">
                                        <h2 className="text-lg font-semibold">{a.name}</h2>
                                        <span className="rounded-full border border-foreground/15 px-2 py-0.5 font-mono text-[11px] uppercase text-foreground/60">{a.difficulty}</span>
                                    </div>
                                    <p className="text-sm text-foreground/60">{a.description}</p>
                                    <div className="mt-auto flex flex-wrap items-center gap-2 pt-2 text-xs text-foreground/50">
                                        <span>{a.categoryLabel}</span>
                                        {a.complexity?.timeAverage && <span className="font-mono">· {a.complexity.timeAverage}</span>}
                                        {a.tags.slice(0, 3).map((t) => (
                                            <span key={t.id}>#{t.label}</span>
                                        ))}
                                    </div>
                                </Link>
                            </li>
                        ))}
                    </ul>
                )}
                {catalog.hasNextPage && (
                    <div className="mt-8 text-center">
                        <button type="button" className={btn} onClick={() => void catalog.fetchNextPage()} disabled={catalog.isFetchingNextPage}>
                            {catalog.isFetchingNextPage ? "Loading…" : "Load more"}
                        </button>
                    </div>
                )}
            </QueryBoundary>
        </PageShell>
    );
}
