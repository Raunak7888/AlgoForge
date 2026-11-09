"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { endpoints } from "@/lib/api/endpoints";
import { errorMessage } from "@/lib/api/errors";
import { useAuth, useFeatureState } from "@/lib/auth";
import { dropParams, NAV_EVENT, readDashboardParams } from "@/lib/navEvents";
import { queryKeys } from "@/lib/query/keys";
import { useVisualizations } from "@/lib/query/hooks";
import { btn, inputCls } from "../shared/styles";
import type { ScriptApi } from "./ScriptDrawer";
import { useWorkspace } from "@/lib/workspace/store";

/** Save, open, rename and delete visualizations. Signed-in only; guests keep the browser copy and get a sign-in nudge. */
export function SavedWork({ api }: { api: ScriptApi }) {
    const { openLoginModal } = useAuth();
    const state = useFeatureState("savedWork", { uiReady: true });
    const ready = state === "ready";
    const qc = useQueryClient();
    const apiRef = useRef(api);
    useEffect(() => {
        apiRef.current = api;
    });

    const [open, setOpen] = useState(false);
    const current = useWorkspace((s) => s.savedVisualization);
    const setCurrent = useWorkspace((s) => s.setSavedVisualization);
    const [title, setTitle] = useState("");
    const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
    const list = useVisualizations({ enabled: ready && open });
    const rows = list.data?.pages.flatMap((p) => p.data) ?? [];

    const openById = useCallback(async (id: string) => {
        try {
            const v = await endpoints.visualization(id);
            apiRef.current.load(v.script);
            setCurrent({ id: v.id, title: v.title });
            setTitle(v.title);
            setNote({ ok: true, text: `Opened “${v.title}”.` });
        } catch (error) {
            setNote({ ok: false, text: errorMessage(error) });
        }
    }, [setCurrent]);

    // ?viz=<id> (from search results or a link) opens that saved visualization once.
    useEffect(() => {
        if (!ready) return;
        const check = () => {
            const { viz } = readDashboardParams();
            if (!viz) return;
            dropParams(["viz"]);
            void openById(viz);
        };
        check();
        window.addEventListener(NAV_EVENT, check);
        window.addEventListener("popstate", check);
        return () => {
            window.removeEventListener(NAV_EVENT, check);
            window.removeEventListener("popstate", check);
        };
    }, [ready, openById]);

    const save = useMutation({
        mutationFn: async (asNew: boolean) => {
            const name = title.trim() || "Untitled visualization";
            if (current && !asNew) return endpoints.updateVisualization(current.id, { title: name, script: apiRef.current.text });
            return endpoints.createVisualization({ title: name, script: apiRef.current.text });
        },
        onSuccess: (v) => {
            setCurrent({ id: v.id, title: v.title });
            setTitle(v.title);
            setNote({ ok: true, text: "Saved." });
            void qc.invalidateQueries({ queryKey: queryKeys.visualizations() });
        },
        onError: (error: unknown) => setNote({ ok: false, text: errorMessage(error) }),
    });

    const remove = useMutation({
        mutationFn: (id: string) => endpoints.deleteVisualization(id),
        onSuccess: (_data, id) => {
            if (current?.id === id) setCurrent(null);
            setNote({ ok: true, text: "Deleted." });
            void qc.invalidateQueries({ queryKey: queryKeys.visualizations() });
        },
        onError: (error: unknown) => setNote({ ok: false, text: errorMessage(error) }),
    });

    if (state === "needs-account") {
        return (
            <button
                type="button"
                className={btn}
                onClick={() => openLoginModal({ message: "Sign in to save your visualizations to your account. Without an account your script stays in this browser." })}
            >
                Sign in to save
            </button>
        );
    }
    if (!ready) return null;

    return (
        <>
            <label className="sr-only" htmlFor="viz-title">Title</label>
            <input id="viz-title" className={`${inputCls} h-8 w-44 py-0`} placeholder="Title" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} />
            <button type="button" className={btn} disabled={save.isPending} onClick={() => save.mutate(false)}>
                {save.isPending ? "Saving…" : current ? "Save" : "Save to account"}
            </button>
            {current && (
                <button type="button" className={btn} disabled={save.isPending} onClick={() => save.mutate(true)}>
                    Save as new
                </button>
            )}
            <button type="button" className={btn} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
                My work {open ? "▾" : "▸"}
            </button>
            {note && (
                <span role="status" className={`text-xs ${note.ok ? "text-muted-foreground" : "text-destructive"}`}>
                    {note.text}
                </span>
            )}
            {open && (
                <div className="basis-full rounded-xl border border-primary-foreground/10 p-2">
                    {list.isPending ? (
                        <p className="p-2 text-xs text-muted-foreground">Loading…</p>
                    ) : rows.length === 0 ? (
                        <p className="p-2 text-xs text-muted-foreground">Nothing saved yet.</p>
                    ) : (
                        <ul className="flex max-h-48 flex-col overflow-y-auto">
                            {rows.map((r) => (
                                <li key={r.id} className="flex items-center gap-2 border-b border-primary-foreground/10 py-1.5 text-xs last:border-0">
                                    <span className="min-w-0 flex-1 truncate">
                                        {r.title} <span className="text-muted-foreground">· {r.stepCount} steps</span>
                                    </span>
                                    <button type="button" className={`${btn} h-6 px-2 text-xs`} onClick={() => void openById(r.id)}>Open</button>
                                    <button
                                        type="button"
                                        className={`${btn} h-6 px-2 text-xs`}
                                        disabled={remove.isPending}
                                        onClick={() => {
                                            if (window.confirm(`Delete “${r.title}”? This cannot be undone.`)) remove.mutate(r.id);
                                        }}
                                    >
                                        Delete
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                    {list.hasNextPage && (
                        <button type="button" className={`${btn} mt-2 h-6 px-2 text-xs`} onClick={() => void list.fetchNextPage()} disabled={list.isFetchingNextPage}>
                            Load more
                        </button>
                    )}
                </div>
            )}
        </>
    );
}
