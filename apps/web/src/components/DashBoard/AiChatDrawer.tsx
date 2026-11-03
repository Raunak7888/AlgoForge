"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
    ArrowUp,
    Maximize2,
    Minimize2,
    Sparkles,
    X,
} from "lucide-react";
import {
    useCallback,
    useEffect,
    useRef,
    useState,
    type KeyboardEvent,
    type PointerEvent as ReactPointerEvent,
} from "react";
import { LoaderOne } from "../ui/loader";
import { MOCK_DATA_ENABLED } from "@/lib/featureFlags";

// ─── Config ──────────────────────────────────────────────────────────────────

const MIN_WIDTH = 320;
const DEFAULT_WIDTH = 400;
const WIDE_WIDTH = 640;
const MAX_RATIO = 0.8;
const STORAGE_KEY = "algoforge:ai-drawer-width";
const PREVIEW_GREETING =
    "This is a preview. The assistant is not connected yet, so replies are fixed samples and do not look at your code.";
const UNAVAILABLE_TEXT = "The AI assistant isn't available yet.";

const SUGGESTIONS = [
    "Explain my graph",
    "Suggest optimizations",
    "Generate BFS code",
];

type Role = "ai" | "user";
interface Message {
    id: number;
    role: Role;
    text: string;
}

const clamp = (w: number) => {
    const max =
        typeof window === "undefined"
            ? WIDE_WIDTH
            : Math.max(MIN_WIDTH, window.innerWidth * MAX_RATIO);
    return Math.min(Math.max(w, MIN_WIDTH), max);
};

// ─── Small pieces ────────────────────────────────────────────────────────────

function AiAvatar({ size = 24 }: { size?: number }) {
    return (
        <div
            style={{ width: size, height: size }}
            className="flex shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-accent to-accent/20 text-primary-foreground shadow-[0_0_14px_-2px] shadow-accent/40"
        >
            <Sparkles size={size * 0.5} />
        </div>
    );
}

function IconButton({
    onClick,
    label,
    children,
}: {
    onClick: () => void;
    label: string;
    children: React.ReactNode;
}) {
    return (
        <button
            onClick={onClick}
            aria-label={label}
            title={label}
            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-primary-foreground/60 transition hover:bg-primary-foreground/8 hover:text-primary-foreground/80"
        >
            {children}
        </button>
    );
}

// ─── Drawer ──────────────────────────────────────────────────────────────────

function AIChatDrawer({
    open,
    onClose,
}: {
    open: boolean;
    onClose: VoidFunction;
}) {
    const available = MOCK_DATA_ENABLED;
    const [messages, setMessages] = useState<Message[]>([
        { id: 0, role: "ai", text: available ? PREVIEW_GREETING : UNAVAILABLE_TEXT },
    ]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [width, setWidth] = useState(DEFAULT_WIDTH);
    const [dragging, setDragging] = useState(false);

    const bottomRef = useRef<HTMLDivElement | null>(null);
    const asideRef = useRef<HTMLElement | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    const replyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const nextId = useRef(1);
    const widthRef = useRef(width);
    widthRef.current = width;

    // restore saved width
    useEffect(() => {
        try {
            const saved = Number(localStorage.getItem(STORAGE_KEY));
            if (saved) setWidth(clamp(saved));
        } catch {
            /* storage unavailable */
        }
    }, []);

    // keep width valid when the window shrinks
    useEffect(() => {
        const onResize = () => setWidth((w) => clamp(w));
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, []);

    // Non-modal panel: move focus in when it opens, hand it back to the opener when it closes.
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
    }, [messages, loading]);

    useEffect(
        () => () => {
            if (replyTimer.current) clearTimeout(replyTimer.current);
        },
        [],
    );

    const persist = useCallback((w: number) => {
        try {
            localStorage.setItem(STORAGE_KEY, String(Math.round(w)));
        } catch {
            /* ignore */
        }
    }, []);

    // ── resize handlers ──
    const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        setDragging(true);
    };
    const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
        if (!dragging) return;
        setWidth(clamp(window.innerWidth - e.clientX));
    };
    const endDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
        if (!dragging) return;
        e.currentTarget.releasePointerCapture(e.pointerId);
        setDragging(false);
        persist(widthRef.current);
    };
    const onHandleKey = (e: KeyboardEvent<HTMLDivElement>) => {
        const step = e.shiftKey ? 80 : 20;
        if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
            e.preventDefault();
            const next = clamp(
                widthRef.current + (e.key === "ArrowLeft" ? step : -step),
            );
            setWidth(next);
            persist(next);
        }
    };
    const resetWidth = () => {
        setWidth(clamp(DEFAULT_WIDTH));
        persist(DEFAULT_WIDTH);
    };
    const toggleWide = () => {
        const next = clamp(width >= WIDE_WIDTH - 8 ? DEFAULT_WIDTH : WIDE_WIDTH);
        setWidth(next);
        persist(next);
    };
    const isWide = width >= WIDE_WIDTH - 8;

    // ── chat ──
    const resizeTextarea = () => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = "auto";
        el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
    };

    const send = (override?: string) => {
        const text = (override ?? input).trim();
        if (!available || !text || loading) return;

        setInput("");
        requestAnimationFrame(resizeTextarea);
        setLoading(true);
        setMessages((m) => [
            ...m,
            { id: nextId.current++, role: "user", text },
        ]);

        // fake AI delay (replace with API later)
        replyTimer.current = setTimeout(() => {
            setMessages((m) => [
                ...m,
                {
                    id: nextId.current++,
                    role: "ai",
                    text: "Sample reply: this is placeholder text, not an analysis of your graph.",
                },
            ]);
            setLoading(false);
        }, 700);
    };

    const onInputKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            send();
        }
    };

    const canSend = available && input.trim().length > 0 && !loading;

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
                    className={`fixed right-0 top-0 z-30 flex h-screen max-w-full flex-col border-l border-primary-foreground/8! bg-primary-background shadow-2xl ${
                        dragging ? "select-none" : ""
                    }`}
                >
                    {/* Resize handle */}
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
                        onPointerCancel={endDrag}
                        onDoubleClick={resetWidth}
                        onKeyDown={onHandleKey}
                        className="group absolute -left-1.5 top-0 z-40 flex h-full w-3 cursor-col-resize touch-none items-center justify-center outline-none"
                    >
                        <span
                            className={`h-full w-px transition-colors ${
                                dragging
                                    ? "bg-accent"
                                    : "bg-transparent group-hover:bg-accent/60 group-focus-visible:bg-accent"
                            }`}
                        />
                        <span
                            className={`absolute top-1/2 h-10 w-1 -translate-y-1/2 rounded-full transition-all ${
                                dragging
                                    ? "bg-accent"
                                    : "bg-primary-foreground/15 group-hover:bg-accent/70"
                            }`}
                        />
                    </div>

                    {/* Ambient glow */}
                    <div
                        aria-hidden
                        className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-linear-to-b from-accent/8 to-transparent"
                    />

                    {/* Header */}
                    <header className="relative flex items-center justify-between border-b border-primary-foreground/6! px-4 py-3 backdrop-blur-xl">
                        <div className="flex items-center gap-3">
                            <AiAvatar size={30} />
                            <div className="flex flex-col leading-tight">
                                <span className="text-[13px] font-semibold text-primary-foreground/90">
                                    AlgoForge AI
                                </span>
                                <span className="flex items-center gap-1.5 text-[11px] text-primary-foreground/60">
                                    <span className={"h-1.5 w-1.5 rounded-full " + (available ? "bg-amber-400" : "bg-primary-foreground/30")} />
                                    {available ? "Preview" : "Unavailable"}
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center gap-0.5">
                            <IconButton
                                onClick={toggleWide}
                                label={isWide ? "Shrink" : "Expand"}
                            >
                                {isWide ? (
                                    <Minimize2 size={13} />
                                ) : (
                                    <Maximize2 size={13} />
                                )}
                            </IconButton>
                            <IconButton onClick={onClose} label="Close">
                                <X size={14} />
                            </IconButton>
                        </div>
                    </header>

                    {/* Messages */}
                    <div
                        role="log"
                        aria-live="polite"
                        aria-relevant="additions"
                        aria-label="Conversation"
                        tabIndex={0}
                        className="scrollbar-thin relative min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4"
                    >
                        {messages.map((m) => {
                            const isUser = m.role === "user";
                            return (
                                <motion.div
                                    key={m.id}
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.22 }}
                                    className={`flex items-end gap-2 ${
                                        isUser ? "justify-end" : "justify-start"
                                    }`}
                                >
                                    {!isUser && <AiAvatar />}
                                    <div
                                        className={`max-w-[85%] whitespace-pre-wrap wrap-break-word rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
                                            isUser
                                                ? "rounded-br-md bg-linear-to-br from-accent/90 to-accent/60 text-black shadow-lg shadow-accent/10"
                                                : "rounded-bl-md border border-primary-foreground/8! bg-primary-foreground/4 text-primary-foreground/80"
                                        }`}
                                    >
                                        <span className="sr-only">{isUser ? "You: " : "Assistant: "}</span>
                                        {m.text}
                                    </div>
                                </motion.div>
                            );
                        })}

                        {/* Suggestions on a fresh chat */}
                        {available && messages.length === 1 && !loading && (
                            <motion.div
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.25 }}
                                className="flex flex-wrap gap-2 pl-8"
                            >
                                {SUGGESTIONS.map((s) => (
                                    <button
                                        key={s}
                                        onClick={() => send(s)}
                                        className="cursor-pointer rounded-full border border-primary-foreground/10! bg-primary-foreground/3 px-3 py-1.5 text-[11px] text-primary-foreground/60 transition hover:border-accent/40! hover:bg-accent/10 hover:text-primary-foreground/90"
                                    >
                                        {s}
                                    </button>
                                ))}
                            </motion.div>
                        )}

                        {/* Typing indicator */}
                        {loading && (
                            <motion.div
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="flex items-end gap-2"
                            >
                                <AiAvatar />
                                <div className="flex h-9 items-center rounded-2xl rounded-bl-md border border-primary-foreground/8! bg-primary-foreground/4 px-3.5 text-primary-foreground/60">
                                    <LoaderOne size={5} />
                                </div>
                            </motion.div>
                        )}
                        <div ref={bottomRef} />
                    </div>

                    {/* Composer */}
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
                                placeholder={available ? "Ask about your algorithm…" : "Not available yet"}
                                disabled={!available}
                                className="scrollbar-thin max-h-30 flex-1 resize-none bg-transparent py-1.5 text-[13px] leading-snug text-primary-foreground/80 outline-none placeholder:text-primary-foreground/60"
                            />
                            <motion.button
                                onClick={() => send()}
                                whileTap={canSend ? { scale: 0.9 } : undefined}
                                disabled={!canSend}
                                aria-label="Send message"
                                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition ${
                                    canSend
                                        ? "cursor-pointer bg-accent text-black shadow-lg shadow-accent/30 hover:brightness-110"
                                        : "cursor-not-allowed bg-primary-foreground/6 text-primary-foreground/60"
                                }`}
                            >
                                <ArrowUp size={15} strokeWidth={2.25} />
                            </motion.button>
                        </div>
                        <p className="mt-1.5 text-center text-[11px] text-primary-foreground/60">
                            {available ? "Enter to send · Shift + Enter for a new line" : "Chat is turned off in this build"}
                        </p>
                    </div>
                </motion.aside>
            )}
        </AnimatePresence>
    );
}

export default AIChatDrawer;