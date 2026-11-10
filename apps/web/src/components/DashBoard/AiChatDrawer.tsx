"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, History, Maximize2, Minimize2, Pencil, Plus, Sparkles, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { countLines, LIMITS, type ExplainSessionDetail } from "@algoforge/contracts";
import { LoaderOne } from "../ui/loader";
import { endpoints } from "@/lib/api/endpoints";
import { errorMessage } from "@/lib/api/errors";
import { readAssistantContext, readSources } from "@/lib/assistant/context";
import { suggestionsFor } from "@/lib/assistant/suggestions";
import { useAuth, useFeatureState } from "@/lib/auth";
import { useExplainSessions } from "@/lib/query";
import { queryKeys } from "@/lib/query/keys";
import { useWorkspace } from "@/lib/workspace/store";
import { Markdown } from "./Markdown";

const MIN_WIDTH = 320;
const DEFAULT_WIDTH = 400;
const WIDE_WIDTH = 640;
const MAX_RATIO = 0.8;
const STORAGE_KEY = "algoforge:ai-drawer-width";
const GREETING = "Ask about your code, your visualizer script or the step on screen. I can explain, suggest optimizations and write code.";
const UNAVAILABLE_TEXT = "The AI assistant isn't available on this server.";
const SIGN_IN_TEXT = "Sign in to use the AI assistant. The editor and the visualizer work without an account.";
const LOADING_TEXT = "Checking availability…";

const sessionKey = (id: string | null) => ["explain", "session", id] as const;

const clamp = (w: number) => {
    const max = typeof window === "undefined" ? WIDE_WIDTH : Math.max(MIN_WIDTH, window.innerWidth * MAX_RATIO);
    return Math.min(Math.max(w, MIN_WIDTH), max);
};

function AiAvatar({ size = 24 }: { size?: number }) {
    return (
        <div style={{ width: size, height: size }} className="flex shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-accent to-accent/20 text-primary-foreground shadow-[0_0_14px_-2px] shadow-accent/40">
            <Sparkles size={size * 0.5} />
        </div>
    );
}

function IconButton({ onClick, label, children, disabled }: { onClick: () => void; label: string; children: React.ReactNode; disabled?: boolean }) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            aria-label={label}
            title={label}
            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-primary-foreground/60 transition hover:bg-primary-foreground/8 hover:text-primary-foreground/80 disabled:cursor-not-allowed disabled:opacity-40"
        >
            {children}
        </button>
    );
}

function AIChatDrawer({ open, onClose }: { open: boolean; onClose: VoidFunction }) {
    const featureState = useFeatureState("assistant", { uiReady: true });
    const { openLoginModal } = useAuth();
    const qc = useQueryClient();
    const workspaceLanguage = useWorkspace((s) => s.language);
    const workspaceLines = useWorkspace((s) => (s.codes[s.language].trim() === "" ? 0 : s.codes[s.language].split("\n").length));

    const ready = featureState === "ready";
    const needsAccount = featureState === "needs-account";
    const notice = ready ? GREETING : needsAccount ? SIGN_IN_TEXT : featureState === "loading" ? LOADING_TEXT : UNAVAILABLE_TEXT;

    const [activeId, setActiveId] = useState<string | null>(null);
    const [showList, setShowList] = useState(false);
    const [input, setInput] = useState("");
    const [pending, setPending] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [width, setWidth] = useState(DEFAULT_WIDTH);
    const [dragging, setDragging] = useState(false);

    const bottomRef = useRef<HTMLDivElement | null>(null);
    const asideRef = useRef<HTMLElement | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);

    const sessions = useExplainSessions({ enabled: ready && open });
    const detail = useQuery({
        queryKey: sessionKey(activeId),
        queryFn: ({ signal }) => endpoints.explainSession(activeId!, signal),
        enabled: ready && open && activeId !== null,
        retry: false,
    });
    const messages = detail.data?.messages ?? [];
    const listed = sessions.data?.data ?? [];
    const title = listed.find((s) => s.id === activeId)?.title ?? detail.data?.title ?? null;

    // Chips follow what is on screen right now. Recomputed when the drawer opens and after every exchange.
    const chips = useMemo(() => suggestionsFor(readSources()), [open, activeId, messages.length]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        let frame = 0;
        try {
            const saved = Number(localStorage.getItem(STORAGE_KEY));
            if (saved) frame = requestAnimationFrame(() => setWidth(clamp(saved)));
        } catch {
            /* storage unavailable */
        }
        return () => {
            if (frame) cancelAnimationFrame(frame);
        };
    }, []);

    useEffect(() => {
        const onResize = () => setWidth((w) => clamp(w));
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, []);

    // Non-modal panel: move focus in when it opens, hand it back when it closes.
    useEffect(() => {
        if (!open) return;
        const opener = document.activeElement as HTMLElement | null;
        const id = requestAnimationFrame(() => {
            const el = asideRef.current;
            (el?.querySelector<HTMLElement>("textarea:not(:disabled)") ?? el?.querySelector<HTMLElement>("button"))?.focus();
        });
        return () => {
            cancelAnimationFrame(id);
            opener?.focus?.();
        };
    }, [open]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages.length, pending]);

    const persist = useCallback((w: number) => {
        try {
            localStorage.setItem(STORAGE_KEY, String(Math.round(w)));
        } catch {
            /* ignore */
        }
    }, []);

    const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        setDragging(true);
    };
    const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
        if (dragging) setWidth(clamp(window.innerWidth - e.clientX));
    };
    const endDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
        if (!dragging) return;
        e.currentTarget.releasePointerCapture(e.pointerId);
        const next = clamp(window.innerWidth - e.clientX);
        setWidth(next);
        setDragging(false);
        persist(next);
    };
    const onHandleKey = (e: KeyboardEvent<HTMLDivElement>) => {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
        e.preventDefault();
        const step = e.shiftKey ? 80 : 20;
        const next = clamp(width + (e.key === "ArrowLeft" ? step : -step));
        setWidth(next);
        persist(next);
    };
    const toggleWide = () => {
        const next = clamp(width >= WIDE_WIDTH - 8 ? DEFAULT_WIDTH : WIDE_WIDTH);
        setWidth(next);
        persist(next);
    };
    const isWide = width >= WIDE_WIDTH - 8;

    const resizeTextarea = () => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = "auto";
        el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
    };

    // ── chat ──
    const send = async (text: string) => {
        const query = text.trim();
        if (!ready || query === "" || pending !== null) return;
        setError(null);
        setPending(query);
        setInput("");
        requestAnimationFrame(resizeTextarea);
        try {
            let id = activeId;
            if (!id) {
                const created = await endpoints.createExplainSession();
                id = created.id;
                qc.setQueryData<ExplainSessionDetail>(sessionKey(id), created);
                setActiveId(id);
            }
            const res = await endpoints.sendExplainMessage(id, { query, context: readAssistantContext() });
            qc.setQueryData<ExplainSessionDetail>(sessionKey(id), (prev) => (prev ? { ...prev, messages: [...prev.messages, res.userMessage, res.assistantMessage] } : prev));
            void qc.invalidateQueries({ queryKey: queryKeys.explainSessions() });
        } catch (caught) {
            setError(errorMessage(caught));
            setInput(query); // nothing was lost: put the question back
        } finally {
            setPending(null);
        }
    };

    const rename = useMutation({
        mutationFn: ({ id, name }: { id: string; name: string }) => endpoints.renameExplainSession(id, { title: name }),
        onSuccess: () => void qc.invalidateQueries({ queryKey: queryKeys.explainSessions() }),
        onError: (e: unknown) => setError(errorMessage(e)),
    });
    const remove = useMutation({
        mutationFn: (id: string) => endpoints.deleteExplainSession(id),
        onSuccess: (_d, id) => {
            qc.removeQueries({ queryKey: sessionKey(id) });
            if (activeId === id) setActiveId(null);
            void qc.invalidateQueries({ queryKey: queryKeys.explainSessions() });
        },
        onError: (e: unknown) => setError(errorMessage(e)),
    });

    const askRename = (id: string, current: string | null) => {
        const name = window.prompt("Rename chat", current ?? "")?.trim();
        if (name) rename.mutate({ id, name });
    };
    const askDelete = (id: string) => {
        if (window.confirm("Delete this chat? This cannot be undone.")) remove.mutate(id);
    };

    // "Insert into editor" replaces the code of that language. It asks first because it overwrites.
    const insertIntoEditor = (code: string, lang: "javascript" | "python") => {
        const lines = countLines(code);
        const oversize =
            lines > LIMITS.code.runMaxLines
                ? ` It is ${lines} lines: code analysis and the visualizer support up to ${LIMITS.code.runMaxLines}, so they will not run on it.`
                : "";
        if (!window.confirm(`Replace the ${lang} code in the editor with this snippet?${oversize}`)) return;
        useWorkspace.getState().setLanguage(lang);
        useWorkspace.getState().setCode(code);
    };

    const newChat = () => {
        setActiveId(null);
        setShowList(false);
        setError(null);
    };

    const onInputKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            void send(input);
        }
    };

    const canSend = ready && input.trim().length > 0 && pending === null;

    return (
        <AnimatePresence>
            {open && (
                <motion.aside
                    ref={asideRef}
                    aria-label="AI assistant"
                    onKeyDown={(e) => {
                        if (e.key === "Escape") {
                            e.stopPropagation();
                            onClose();
                        }
                    }}
                    initial={{ x: "100%", opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: "100%", opacity: 0 }}
                    transition={{ type: "spring", stiffness: 260, damping: 30 }}
                    style={{ width }}
                    className={`fixed right-0 top-0 z-30 flex h-screen max-w-full flex-col border-l border-primary-foreground/8! bg-primary-background shadow-2xl ${dragging ? "select-none" : ""}`}
                >
                    <div
                        role="separator"
                        aria-orientation="vertical"
                        aria-label="Resize chat drawer"
                        aria-valuenow={Math.round(width)}
                        aria-valuemin={MIN_WIDTH}
                        tabIndex={0}
                        onPointerDown={onPointerDown}
                        onPointerMove={onPointerMove}
                        onPointerUp={endDrag}
                        onPointerCancel={() => setDragging(false)}
                        onDoubleClick={() => {
                            const next = clamp(DEFAULT_WIDTH);
                            setWidth(next);
                            persist(next);
                        }}
                        onKeyDown={onHandleKey}
                        className="group absolute -left-1.5 top-0 z-40 flex h-full w-3 cursor-col-resize touch-none items-center justify-center outline-none"
                    >
                        <span className={`h-full w-px transition-colors ${dragging ? "bg-accent" : "bg-transparent group-hover:bg-accent/60 group-focus-visible:bg-accent"}`} />
                    </div>

                    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-linear-to-b from-accent/8 to-transparent" />

                    <header className="relative flex items-center justify-between gap-2 border-b border-primary-foreground/6! px-4 py-3 backdrop-blur-xl">
                        <div className="flex min-w-0 items-center gap-3">
                            <AiAvatar size={30} />
                            <div className="flex min-w-0 flex-col leading-tight">
                                <span className="truncate text-[13px] font-semibold text-primary-foreground/90">{activeId ? (title ?? "New chat") : "AlgoForge AI"}</span>
                                <span className="flex items-center gap-1.5 text-[11px] text-primary-foreground/60">
                                    <span className={"h-1.5 w-1.5 rounded-full " + (ready ? "bg-emerald-400" : "bg-primary-foreground/30")} />
                                    {ready ? "Online" : needsAccount ? "Sign in required" : "Unavailable"}
                                </span>
                            </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-0.5">
                            {activeId && (
                                <>
                                    <IconButton onClick={() => askRename(activeId, title)} label="Rename chat">
                                        <Pencil size={13} />
                                    </IconButton>
                                    <IconButton onClick={() => askDelete(activeId)} label="Delete chat">
                                        <Trash2 size={13} />
                                    </IconButton>
                                </>
                            )}
                            <IconButton onClick={newChat} label="New chat" disabled={!ready}>
                                <Plus size={14} />
                            </IconButton>
                            <IconButton onClick={() => setShowList((v) => !v)} label={showList ? "Hide chats" : "Recent chats"} disabled={!ready}>
                                <History size={13} />
                            </IconButton>
                            <IconButton onClick={toggleWide} label={isWide ? "Shrink" : "Expand"}>
                                {isWide ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                            </IconButton>
                            <IconButton onClick={onClose} label="Close">
                                <X size={14} />
                            </IconButton>
                        </div>
                    </header>

                    {showList && ready && (
                        <div className="relative max-h-56 shrink-0 overflow-y-auto border-b border-primary-foreground/6! px-2 py-2" aria-label="Recent chats">
                            {sessions.isPending ? (
                                <p className="px-2 py-2 text-xs text-primary-foreground/60">Loading chats…</p>
                            ) : listed.length === 0 ? (
                                <p className="px-2 py-2 text-xs text-primary-foreground/60">No chats yet. Ask something to start one.</p>
                            ) : (
                                <ul className="flex flex-col gap-0.5">
                                    {listed.map((s) => (
                                        <li key={s.id} className={`flex items-center gap-1 rounded-lg px-2 py-1.5 ${s.id === activeId ? "bg-primary-foreground/8" : "hover:bg-primary-foreground/5"}`}>
                                            <button
                                                type="button"
                                                className="min-w-0 flex-1 cursor-pointer truncate text-left text-xs text-primary-foreground/80"
                                                onClick={() => {
                                                    setActiveId(s.id);
                                                    setShowList(false);
                                                    setError(null);
                                                }}
                                            >
                                                {s.title ?? "Untitled chat"}
                                                <span className="ml-2 text-[10px] text-primary-foreground/40">{new Date(s.updatedAt).toLocaleDateString()}</span>
                                            </button>
                                            <IconButton onClick={() => askRename(s.id, s.title)} label={`Rename ${s.title ?? "chat"}`}>
                                                <Pencil size={12} />
                                            </IconButton>
                                            <IconButton onClick={() => askDelete(s.id)} label={`Delete ${s.title ?? "chat"}`}>
                                                <Trash2 size={12} />
                                            </IconButton>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    )}

                    <div role="log" aria-live="polite" aria-relevant="additions" aria-label="Conversation" tabIndex={0} className="scrollbar-thin relative min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
                        {messages.length === 0 && pending === null && (
                            <div className="flex items-end gap-2">
                                <AiAvatar />
                                <div className="max-w-[85%] rounded-2xl rounded-bl-md border border-primary-foreground/8! bg-primary-foreground/4 px-3.5 py-2.5 text-[13px] leading-relaxed text-primary-foreground/80">
                                    {notice}
                                    {needsAccount && (
                                        <button
                                            type="button"
                                            onClick={() => openLoginModal({ message: "Sign in to use the AI assistant." })}
                                            className="mt-2 block cursor-pointer rounded-full border border-accent/40! bg-accent/10 px-3.5 py-1.5 text-[11px] font-medium text-primary-foreground/90 transition hover:bg-accent/20"
                                        >
                                            Sign in with Google
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}

                        {activeId !== null && detail.isPending && <p className="text-xs text-primary-foreground/60">Loading chat…</p>}
                        {detail.isError && (
                            <p role="alert" className="text-xs text-red-300">
                                {errorMessage(detail.error)}
                            </p>
                        )}

                        {messages.map((m) => {
                            const isUser = m.role === "user";
                            return (
                                <motion.div key={m.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }} className={`flex items-end gap-2 ${isUser ? "justify-end" : "justify-start"}`}>
                                    {!isUser && <AiAvatar />}
                                    <div
                                        className={`max-w-[88%] wrap-break-word rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
                                            isUser
                                                ? "whitespace-pre-wrap rounded-br-md bg-linear-to-br from-accent/90 to-accent/60 text-black shadow-lg shadow-accent/10"
                                                : "rounded-bl-md border border-primary-foreground/8! bg-primary-foreground/4 text-primary-foreground/80"
                                        }`}
                                    >
                                        <span className="sr-only">{isUser ? "You: " : "Assistant: "}</span>
                                        {isUser ? m.content : <Markdown source={m.content} onInsert={insertIntoEditor} />}
                                    </div>
                                </motion.div>
                            );
                        })}

                        {pending !== null && (
                            <>
                                <div className="flex justify-end">
                                    <div className="max-w-[88%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-linear-to-br from-accent/90 to-accent/60 px-3.5 py-2.5 text-[13px] text-black">{pending}</div>
                                </div>
                                <div className="flex items-end gap-2">
                                    <AiAvatar />
                                    <div className="flex h-9 items-center rounded-2xl rounded-bl-md border border-primary-foreground/8! bg-primary-foreground/4 px-3.5 text-primary-foreground/60">
                                        <LoaderOne size={5} />
                                    </div>
                                </div>
                            </>
                        )}

                        {ready && messages.length === 0 && pending === null && (
                            <div className="flex flex-wrap gap-2 pl-8" aria-label="Suggestions">
                                {chips.map((s) => (
                                    <button key={s} type="button" onClick={() => void send(s)} className="cursor-pointer rounded-full border border-primary-foreground/10! bg-primary-foreground/3 px-3 py-1.5 text-[11px] text-primary-foreground/60 transition hover:border-accent/40! hover:bg-accent/10 hover:text-primary-foreground/90">
                                        {s}
                                    </button>
                                ))}
                            </div>
                        )}

                        {error && (
                            <p role="alert" className="rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-xs text-red-200">
                                {error}
                            </p>
                        )}
                        <div ref={bottomRef} />
                    </div>

                    <div className="relative px-3 pb-3 pt-2">
                        <div className="flex items-end gap-2 rounded-2xl border border-primary-foreground/10! bg-primary-foreground/3 p-2 pl-3.5 transition focus-within:border-accent/50! focus-within:bg-primary-foreground/5 focus-within:shadow-[0_0_0_3px] focus-within:shadow-accent/10">
                            <textarea
                                aria-label="Message to the assistant"
                                ref={textareaRef}
                                rows={1}
                                value={input}
                                onChange={(e) => {
                                    setInput(e.target.value);
                                    resizeTextarea();
                                }}
                                onKeyDown={onInputKey}
                                placeholder={ready ? "Ask about your algorithm…" : "Not available"}
                                disabled={!ready}
                                className="scrollbar-thin max-h-30 flex-1 resize-none bg-transparent py-1.5 text-[13px] leading-snug text-primary-foreground/80 outline-none placeholder:text-primary-foreground/60"
                            />
                            <button
                                type="button"
                                onClick={() => void send(input)}
                                disabled={!canSend}
                                aria-label="Send message"
                                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition ${canSend ? "cursor-pointer bg-accent text-black shadow-lg shadow-accent/30 hover:brightness-110" : "cursor-not-allowed bg-primary-foreground/6 text-primary-foreground/60"}`}
                            >
                                <ArrowUp size={15} strokeWidth={2.25} />
                            </button>
                        </div>
                        <p data-testid="drawer-context" className="mt-1.5 text-center text-[11px] text-primary-foreground/50">
                            Context: {workspaceLanguage} · {workspaceLines} {workspaceLines === 1 ? "line" : "lines"} in the editor
                        </p>
                        <p className="mt-1.5 text-center text-[11px] text-primary-foreground/60">
                            {ready ? "Enter to send · Shift + Enter for a new line" : needsAccount ? "Sign in to use the assistant" : "The assistant is not available"}
                        </p>
                    </div>
                </motion.aside>
            )}
        </AnimatePresence>
    );
}

export default AIChatDrawer;
