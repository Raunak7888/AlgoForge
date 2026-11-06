"use client";

import React, {
    memo,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    BulbIcon,
    Chart01Icon,
    Clock01Icon,
    JavaScriptFreeIcons,
    PythonFreeIcons,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { SampleChip } from "@/components/ui/SampleChip";

// ─── Types ────────────────────────────────────────────────────────────────────

type Language = "javascript" | "python";
type LanguageFilter = "all" | Language;
type SortOrder = "newest" | "oldest";
type Tone = "good" | "warn" | "bad" | "none";

export interface AnalysisHistoryItem {
    id: string;
    language: Language;
    complexity: string | null;
    suggestion: string | null;
    title?: string | null;
    isShared?: boolean;
    createdAt: string;
}

export interface AnalysisHistoryMeta {
    nextCursor: string | null;
    hasMore: boolean;
}

/** When given, search, language filter and sort are applied by the server instead of in the browser. */
export interface HistoryFilters {
    q: string;
    language: "all" | "javascript" | "python";
    sort: "newest" | "oldest";
    onChange: (patch: Partial<{ q: string; language: "all" | "javascript" | "python"; sort: "newest" | "oldest" }>) => void;
}

interface AnalysisHistoryProps {
    items: AnalysisHistoryItem[];
    meta: AnalysisHistoryMeta;
    /** Fetch the next batch from the server. Called when paging past the loaded rows. */
    onLoadMore: () => void;
    /** Initial load: shows skeleton rows. */
    loading?: boolean;
    /** Fetching the next batch: disables Next and shows skeleton rows. */
    loadingMore?: boolean;
    /** Shown with a retry action when a fetch failed. */
    error?: string | null;
    onRetry?: () => void;
    /** Called with the selected item, or null when the selection is cleared. */
    onSelect?: (item: AnalysisHistoryItem | null) => void;
    /** Optional. When provided, an expanded row shows a Delete action. */
    onDelete?: (item: AnalysisHistoryItem) => void;
    /** Rows per page. Default 8. */
    pageSize?: number;
    /** Builds the dashboard URL for an analysis. Default: `/dashboard/${id}`. */
    getDashboardHref?: (item: AnalysisHistoryItem) => string;
    /** Server-side filters (see HistoryFilters). Omit for client-side filtering of the loaded rows. */
    filters?: HistoryFilters;
    /** The rows are fixed sample content. */
    sample?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const EASE = [0.22, 1, 0.36, 1] as const;

function formatRelativeTime(iso: string, now: number): string {
    const s = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000));
    if (s < 45) return "just now";
    const m = Math.floor(s / 60);
    if (m < 60) return `${Math.max(m, 1)}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d < 30) return `${d}d ago`;
    return new Date(iso).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
    });
}

function formatExact(iso: string): string {
    return new Date(iso).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
    });
}

function groupLabel(iso: string, now: number): string {
    const startOfDay = (t: number) => {
        const d = new Date(t);
        d.setHours(0, 0, 0, 0);
        return d.getTime();
    };
    const days = Math.round(
        (startOfDay(now) - startOfDay(new Date(iso).getTime())) / 86_400_000,
    );
    if (days <= 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return "This week";
    return "Earlier";
}

function complexityTone(complexity: string | null): Tone {
    if (!complexity) return "none";
    const c = complexity.toLowerCase();
    if (c.includes("low") || c.includes("o(1)") || c.includes("o(log"))
        return "good";
    if (c.includes("medium") || c.includes("o(n)")) return "warn";
    return "bad";
}

const TONE_DOT: Record<Tone, string> = {
    good: "bg-emerald-400",
    warn: "bg-amber-400",
    bad: "bg-rose-400",
    none: "bg-zinc-600",
};

/** 1 … 4 5 6 … 12 style page list. */
function pageWindow(current: number, total: number): (number | "gap")[] {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages = new Set([1, total, current, current - 1, current + 1]);
    const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
    const out: (number | "gap")[] = [];
    sorted.forEach((p, i) => {
        if (i > 0 && p - sorted[i - 1] > 1) out.push("gap");
        out.push(p);
    });
    return out;
}

function useNow(intervalMs = 30_000) {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), intervalMs);
        return () => clearInterval(id);
    }, [intervalMs]);
    return now;
}

// ─── Small pieces ─────────────────────────────────────────────────────────────

const Svg = ({ children, size = 14 }: { children: React.ReactNode; size?: number }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
    >
        {children}
    </svg>
);

const SearchIcon = () => (
    <Svg>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
    </Svg>
);
const CopyIcon = () => (
    <Svg>
        <rect x="9" y="9" width="11" height="11" rx="2" />
        <path d="M5 15V6a2 2 0 0 1 2-2h9" />
    </Svg>
);
const CheckIcon = () => (
    <Svg>
        <path d="m5 12 5 5L20 7" />
    </Svg>
);
const CloseIcon = () => (
    <Svg>
        <path d="M6 6l12 12M18 6 6 18" />
    </Svg>
);
const TrashIcon = () => (
    <Svg>
        <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
    </Svg>
);
const ChevronLeft = () => (
    <Svg>
        <path d="m15 18-6-6 6-6" />
    </Svg>
);
const ChevronRight = () => (
    <Svg>
        <path d="m9 18 6-6-6-6" />
    </Svg>
);
const ArrowUpRight = () => (
    <Svg size={12}>
        <path d="M7 17 17 7M8 7h9v9" />
    </Svg>
);

const SkeletonRow = memo(({ index }: { index: number }) => (
    <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: index * 0.04, duration: 0.25 }}
        className="flex items-start gap-3 rounded-lg px-3 py-3"
        aria-hidden
    >
        <div className="h-8 w-8 shrink-0 animate-pulse rounded-md bg-primary-background/80" />
        <div className="flex-1 space-y-2 py-0.5">
            <div className="h-3 w-24 animate-pulse rounded bg-primary-background/80" />
            <div className="h-3 w-full animate-pulse rounded bg-primary-background/60" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-primary-background/40" />
        </div>
        <div className="h-3 w-10 shrink-0 animate-pulse rounded bg-primary-background/80" />
    </motion.div>
));
SkeletonRow.displayName = "SkeletonRow";

const StateMessage = ({
    title,
    body,
    action,
}: {
    title: string;
    body: string;
    action?: { label: string; onClick: () => void };
}) => (
    <div className="flex flex-col items-center justify-center p-8 text-center">
        <p className="text-xs font-semibold text-zinc-200">{title}</p>
        <p className="mt-1 text-xs text-zinc-500">{body}</p>
        {action && (
            <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={action.onClick}
                className="mt-3 h-7 text-[11px]"
            >
                {action.label}
            </Button>
        )}
    </div>
);

/* eslint-disable react/display-name -- generic memo component */
const Segmented = memo(
    <T extends string>({
        value,
        options,
        onChange,
        label,
        id,
    }: {
        value: T;
        options: { value: T; label: string }[];
        onChange: (v: T) => void;
        label: string;
        id: string;
    }) => (
        <div
            role="radiogroup"
            aria-label={label}
            className="relative flex items-center rounded-md border border-primary-foreground/20 p-0.5"
        >
            {options.map((o) => {
                const active = o.value === value;
                return (
                    <button
                        key={o.value}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => onChange(o.value)}
                        className={`relative rounded px-2 py-1 text-[11px] font-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-primary-foreground/30 ${
                            active
                                ? "text-zinc-100"
                                : "text-zinc-500 hover:text-zinc-300"
                        }`}
                    >
                        {active && (
                            <motion.span
                                layoutId={`seg-${id}`}
                                className="absolute inset-0 rounded bg-zinc-800"
                                transition={{
                                    type: "spring",
                                    stiffness: 500,
                                    damping: 38,
                                }}
                            />
                        )}
                        <span className="relative">{o.label}</span>
                    </button>
                );
            })}
        </div>
    ),
) as <T extends string>(p: {
    value: T;
    options: { value: T; label: string }[];
    onChange: (v: T) => void;
    label: string;
    id: string;
}) => React.ReactElement;
/* eslint-enable react/display-name */

// ─── History Item ─────────────────────────────────────────────────────────────

interface HistoryItemProps {
    item: AnalysisHistoryItem;
    index: number;
    now: number;
    isSelected: boolean;
    reduce: boolean;
    href: string;
    onSelect: (id: string) => void;
    onDelete?: (item: AnalysisHistoryItem) => void;
}

const HistoryItem = memo(
    ({
        item,
        index,
        now,
        isSelected,
        reduce,
        href,
        onSelect,
        onDelete,
    }: HistoryItemProps) => {
        const [copied, setCopied] = useState(false);
        const tone = complexityTone(item.complexity);

        useEffect(() => {
            if (!copied) return;
            const t = setTimeout(() => setCopied(false), 1400);
            return () => clearTimeout(t);
        }, [copied]);

        const copy = useCallback(async () => {
            if (!item.suggestion) return;
            try {
                await navigator.clipboard.writeText(item.suggestion);
                setCopied(true);
            } catch {
                /* clipboard unavailable */
            }
        }, [item.suggestion]);

        return (
            <motion.div
                initial={reduce ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                    duration: 0.24,
                    ease: EASE,
                    delay: Math.min(index, 8) * 0.03,
                }}
                className={`rounded-lg border transition-colors duration-150 ${
                    isSelected
                        ? "border-zinc-700 bg-primary-background/80"
                        : "border-transparent hover:bg-primary-background/50"
                }`}
            >
                <div className="flex items-start">
                    <button
                        data-testid="history-row"
                        type="button"
                        aria-expanded={isSelected}
                        onClick={() => onSelect(item.id)}
                        className="group flex min-w-0 flex-1 items-start gap-3 rounded-lg px-3 py-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground/30"
                    >
                        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-primary-foreground/20 bg-primary-background text-primary-foreground">
                            <HugeiconsIcon
                                icon={
                                    item.language === "javascript"
                                        ? JavaScriptFreeIcons
                                        : PythonFreeIcons
                                }
                                className="h-4 w-4"
                            />
                        </span>

                        <span className="flex min-w-0 flex-1 flex-col gap-1">
                            <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                                <span className="text-[13px] font-medium text-zinc-100">
                                    {item.title ?? (item.language === "javascript" ? "JavaScript" : "Python")}
                                    {item.isShared && (
                                        <span className="ml-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-1.5 py-0.5 text-[10px] font-normal text-emerald-300">Shared</span>
                                    )}
                                </span>
                                {item.complexity && (
                                    <span className="inline-flex items-center gap-1.5 text-xs text-zinc-300">
                                        <span
                                            className={`h-1.5 w-1.5 rounded-full ${TONE_DOT[tone]}`}
                                        />
                                        {item.complexity}
                                    </span>
                                )}
                                <time
                                    dateTime={item.createdAt}
                                    title={formatExact(item.createdAt)}
                                    className="whitespace-nowrap text-[11px] tabular-nums text-zinc-500"
                                >
                                    {formatRelativeTime(item.createdAt, now)}
                                </time>
                            </span>
                            {!isSelected && (
                                <span
                                    className={`text-xs leading-relaxed ${
                                        item.suggestion
                                            ? "line-clamp-2 text-zinc-400"
                                            : "italic text-zinc-500"
                                    }`}
                                >
                                    {item.suggestion ?? "No suggestion available"}
                                </span>
                            )}
                        </span>
                    </button>

                    <Link
                        href={href}
                        aria-label={`Open ${item.language} analysis in dashboard`}
                        className="mr-2 mt-2.5 inline-flex h-7 shrink-0 items-center gap-1 rounded-md border border-primary-foreground/20 px-2 text-[11px] font-medium text-zinc-300 outline-none transition-colors duration-150 hover:border-zinc-600 hover:bg-zinc-800/60 hover:text-zinc-100 focus-visible:ring-2 focus-visible:ring-primary-foreground/30"
                    >
                        Open
                        <ArrowUpRight />
                    </Link>
                </div>

                <AnimatePresence initial={false}>
                    {isSelected && (
                        <motion.div
                            key="detail"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: reduce ? 0 : 0.22, ease: EASE }}
                            className="overflow-hidden"
                        >
                            <div className="mx-3 mb-3 ml-15 space-y-3 border-t border-primary-foreground/20 pt-3">
                                <div className="flex gap-2 text-xs leading-relaxed text-zinc-300">
                                    <HugeiconsIcon
                                        icon={BulbIcon}
                                        className="mt-0.5 h-4 w-4 shrink-0 text-primary-foreground"
                                    />
                                    <p>
                                        {item.suggestion ??
                                            "No suggestion was generated for this analysis."}
                                    </p>
                                </div>

                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <span className="flex items-center gap-1.5 text-[11px] text-zinc-500">
                                        <HugeiconsIcon
                                            icon={Clock01Icon}
                                            className="h-3.5 w-3.5"
                                        />
                                        {formatExact(item.createdAt)}
                                    </span>
                                    <span className="flex items-center gap-1">
                                        {item.suggestion && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={copy}
                                                className="h-7 gap-1.5 px-2 text-[11px] text-zinc-400 hover:text-zinc-100"
                                            >
                                                {copied ? <CheckIcon /> : <CopyIcon />}
                                                {copied ? "Copied" : "Copy"}
                                            </Button>
                                        )}
                                        {onDelete && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => onDelete(item)}
                                                className="h-7 gap-1.5 px-2 text-[11px] text-zinc-400 hover:text-rose-400"
                                            >
                                                <TrashIcon />
                                                Delete
                                            </Button>
                                        )}
                                    </span>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        );
    },
);
HistoryItem.displayName = "HistoryItem";

// ─── Pagination ───────────────────────────────────────────────────────────────

const PageButton = ({
    children,
    active,
    disabled,
    label,
    onClick,
}: {
    children: React.ReactNode;
    active?: boolean;
    disabled?: boolean;
    label: string;
    onClick: () => void;
}) => (
    <button
        type="button"
        aria-label={label}
        aria-current={active ? "page" : undefined}
        disabled={disabled}
        onClick={onClick}
        className={`relative flex h-7 min-w-7 items-center justify-center rounded-md px-1.5 text-[11px] font-medium tabular-nums outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-primary-foreground/30 disabled:pointer-events-none disabled:opacity-35 ${
            active ? "text-zinc-100" : "text-zinc-500 hover:text-zinc-200"
        }`}
    >
        {active && (
            <motion.span
                layoutId="page-pill"
                className="absolute inset-0 rounded-md bg-zinc-800"
                transition={{ type: "spring", stiffness: 500, damping: 38 }}
            />
        )}
        <span className="relative flex items-center">{children}</span>
    </button>
);

// ─── Main Component ───────────────────────────────────────────────────────────

const SKELETON_COUNT = 5;

const LANGUAGE_OPTIONS: { value: LanguageFilter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "javascript", label: "JS" },
    { value: "python", label: "Python" },
];

const SORT_OPTIONS: { value: SortOrder; label: string }[] = [
    { value: "newest", label: "Newest" },
    { value: "oldest", label: "Oldest" },
];

export default function AnalysisHistory({
    items,
    meta,
    onLoadMore,
    loading = false,
    loadingMore = false,
    error = null,
    onRetry,
    onSelect,
    onDelete,
    pageSize = 8,
    getDashboardHref = (item) => `/dashboard/${item.id}`,
    sample = false,
    filters,
}: AnalysisHistoryProps) {
    const reduce = !!useReducedMotion();
    const now = useNow();

    const [selectedId, setSelectedId] = useState<string | null>(null);
    const server = filters !== undefined;
    const [localQuery, setLocalQuery] = useState("");
    const [localLanguage, setLocalLanguage] = useState<LanguageFilter>("all");
    const [localSort, setLocalSort] = useState<SortOrder>("newest");
    const query = filters ? filters.q : localQuery;
    const language: LanguageFilter = filters ? filters.language : localLanguage;
    const sort: SortOrder = filters ? filters.sort : localSort;
    const setQuery = (v: string) => (filters ? filters.onChange({ q: v }) : setLocalQuery(v));
    const setLanguage = (v: LanguageFilter) => (filters ? filters.onChange({ language: v }) : setLocalLanguage(v));
    const setSort = (v: SortOrder) => (filters ? filters.onChange({ sort: v }) : setLocalSort(v));
    const [page, setPage] = useState(1);
    const [awaitingMore, setAwaitingMore] = useState(false);

    const listRef = useRef<HTMLDivElement>(null);

    // Filter (suggestion search + language) and sort
    const visible = useMemo(() => {
        if (server) return items; // the server already searched, filtered and sorted
        const q = query.trim().toLowerCase();
        const filtered = items.filter((i) => {
            if (language !== "all" && i.language !== language) return false;
            if (!q) return true;
            return (i.suggestion ?? "").toLowerCase().includes(q);
        });
        return filtered.sort((a, b) => {
            const diff =
                new Date(b.createdAt).getTime() -
                new Date(a.createdAt).getTime();
            return sort === "newest" ? diff : -diff;
        });
    }, [items, query, language, sort, server]);

    const hasFilters = query.trim() !== "" || language !== "all";
    const serverFiltering = server && hasFilters;
    const isFiltering = !server && hasFilters;

    // Pagination over the loaded rows
    const totalPages = Math.max(1, Math.ceil(visible.length / pageSize));
    const canFetchMore = meta.hasMore && !isFiltering;
    const currentPage = Math.min(page, totalPages);
    const start = (currentPage - 1) * pageSize;
    const pageItems = visible.slice(start, start + pageSize);
    const onLastLoadedPage = currentPage >= totalPages;
    const nextDisabled = loadingMore || (onLastLoadedPage && !canFetchMore);

    const groups = useMemo(() => {
        const map = new Map<string, AnalysisHistoryItem[]>();
        for (const item of pageItems) {
            const label = groupLabel(item.createdAt, now);
            map.set(label, [...(map.get(label) ?? []), item]);
        }
        return Array.from(map.entries());
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible, currentPage, pageSize, now]);

    const scrollTop = () =>
        listRef.current
            ?.closest("[data-radix-scroll-area-viewport]")
            ?.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });

    const goTo = useCallback(
        (p: number) => {
            setPage(Math.max(1, Math.min(p, totalPages)));
            scrollTop();
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [totalPages],
    );

    const goNext = useCallback(() => {
        if (!onLastLoadedPage) return goTo(currentPage + 1);
        if (canFetchMore && !loadingMore) {
            setAwaitingMore(true);
            onLoadMore();
        }
    }, [onLastLoadedPage, goTo, currentPage, canFetchMore, loadingMore, onLoadMore]);

    // Once the requested batch arrives, move to the first new page.
    // State is adjusted while rendering (React's pattern for reacting to prop changes), not in an effect.
    const [prevCount, setPrevCount] = useState(items.length);
    if (prevCount !== items.length) {
        setPrevCount(items.length);
        if (awaitingMore && items.length > prevCount) {
            setAwaitingMore(false);
            setPage(currentPage + 1);
        }
    }
    const [prevError, setPrevError] = useState(error);
    if (prevError !== error) {
        setPrevError(error);
        if (awaitingMore && error) setAwaitingMore(false);
    }
    // Scroll the list back to the top whenever the page changes.
    useEffect(() => {
        scrollTop();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentPage]);

    // Reset to page 1 when filters change
    const filterKey = `${query}|${language}|${sort}`;
    const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
    if (prevFilterKey !== filterKey) {
        setPrevFilterKey(filterKey);
        setPage(1);
    }

    // Selection
    const handleSelect = useCallback(
        (id: string) => {
            const next = selectedId === id ? null : id;
            setSelectedId(next);
            onSelect?.(next ? (items.find((i) => i.id === next) ?? null) : null);
        },
        [selectedId, items, onSelect],
    );

    const clearSelection = useCallback(() => {
        setSelectedId(null);
        onSelect?.(null);
    }, [onSelect]);

    // Drop the selection when its row is no longer on the visible page
    useEffect(() => {
        if (selectedId && !pageItems.some((i) => i.id === selectedId)) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setSelectedId(null);
            onSelect?.(null);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pageItems, selectedId]);

    // Keyboard: ↑/↓ rows, ←/→ pages, Esc clears
    const onKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLDivElement>) => {
            const typing = (e.target as HTMLElement).tagName === "INPUT";

            if (e.key === "Escape") {
                if (typing && query) setQuery("");
                else if (selectedId) clearSelection();
                return;
            }
            if (typing) return;

            if (e.key === "ArrowLeft" && currentPage > 1) {
                e.preventDefault();
                goTo(currentPage - 1);
                return;
            }
            if (e.key === "ArrowRight" && !nextDisabled) {
                e.preventDefault();
                goNext();
                return;
            }
            if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;

            const rows = Array.from(
                listRef.current?.querySelectorAll<HTMLButtonElement>(
                    '[data-testid="history-row"]',
                ) ?? [],
            );
            if (!rows.length) return;
            const i = rows.indexOf(document.activeElement as HTMLButtonElement);
            e.preventDefault();
            (e.key === "ArrowDown"
                ? rows[Math.min(i + 1, rows.length - 1)]
                : rows[Math.max(i - 1, 0)]
            )?.focus();
        },
        [query, setQuery, selectedId, clearSelection, currentPage, goTo, goNext, nextDisabled],
    );

    let runningIndex = 0;
    const pages = pageWindow(currentPage, totalPages);

    return (
        <div
            onKeyDown={onKeyDown}
            className="flex h-full w-full flex-col overflow-hidden rounded-2xl border border-primary-foreground/20 bg-primary-background"
        >
            {/* Header */}
            <div className="shrink-0 space-y-3 border-b border-primary-foreground/20 px-4 pb-3 pt-3.5">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <HugeiconsIcon
                            icon={Chart01Icon}
                            className="h-4 w-4 text-zinc-400"
                        />
                        <h2 className="text-sm font-semibold tracking-tight text-zinc-100">
                            Analysis history
                        </h2>
                        
                        {sample && <SampleChip />}
                    </div>
                    <AnimatePresence>
                        {selectedId && (
                            <motion.button
                                key="clear"
                                type="button"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.15 }}
                                onClick={clearSelection}
                                className="rounded px-1.5 py-0.5 text-[11px] text-zinc-400 outline-none transition-colors hover:text-zinc-100 focus-visible:ring-2 focus-visible:ring-primary-foreground/30"
                            >
                                Clear selection
                            </motion.button>
                        )}
                    </AnimatePresence>
                </div>

                {/* Search by suggestion */}
                <div className="relative">
                    <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500">
                        <SearchIcon />
                    </span>
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search analyses"
                        aria-label="Search analyses"
                        className="h-8 w-full rounded-md border border-primary-foreground/20 bg-transparent pl-8 pr-8 text-xs text-zinc-100 outline-none transition-colors placeholder:text-zinc-500 focus:border-zinc-500"
                    />
                    <AnimatePresence>
                        {query && (
                            <motion.button
                                key="x"
                                type="button"
                                aria-label="Clear search"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.12 }}
                                onClick={() => setQuery("")}
                                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-zinc-500 outline-none hover:text-zinc-100 focus-visible:ring-2 focus-visible:ring-primary-foreground/30"
                            >
                                <CloseIcon />
                            </motion.button>
                        )}
                    </AnimatePresence>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <Segmented
                        id="lang"
                        label="Filter by language"
                        value={language}
                        options={LANGUAGE_OPTIONS}
                        onChange={setLanguage}
                    />
                    <Segmented
                        id="sort"
                        label="Sort order"
                        value={sort}
                        options={SORT_OPTIONS}
                        onChange={setSort}
                    />
                </div>
            </div>

            {/* List */}
            <ScrollArea className="min-h-0 flex-1">
                <div ref={listRef} className="px-2 py-2" aria-busy={loading || loadingMore}>
                    {loading ? (
                        Array.from({ length: SKELETON_COUNT }).map((_, i) => (
                            <SkeletonRow key={i} index={i} />
                        ))
                    ) : error && items.length === 0 ? (
                        <StateMessage
                            title="Couldn't load your history"
                            body={error}
                            action={onRetry ? { label: "Try again", onClick: onRetry } : undefined}
                        />
                    ) : items.length === 0 ? (
                        <StateMessage
                            title={serverFiltering ? "No matches" : "No analyses yet"}
                            body={serverFiltering ? "No saved analysis fits these filters." : "Run an analysis and it will show up here."}
                        />
                    ) : visible.length === 0 ? (
                        <StateMessage
                            title="No matches"
                            body="No loaded suggestion fits these filters."
                        />
                    ) : (
                        <div className="space-y-4">
                            {groups.map(([groupTitle, groupItems]) => (
                                <div key={groupTitle} className="space-y-1">
                                    <div className="px-3 py-1 text-[11px] font-semibold text-zinc-500">
                                        {groupTitle}
                                    </div>
                                    <div className="space-y-1">
                                        {groupItems.map((item) => {
                                            const index = runningIndex++;
                                            return (
                                                <HistoryItem
                                                    key={item.id}
                                                    item={item}
                                                    index={index}
                                                    now={now}
                                                    isSelected={selectedId === item.id}
                                                    reduce={reduce}
                                                    href={getDashboardHref(item)}
                                                    onSelect={handleSelect}
                                                    onDelete={onDelete}
                                                />
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                            {loadingMore &&
                                Array.from({ length: 2 }).map((_, i) => (
                                    <SkeletonRow key={`more-${i}`} index={i} />
                                ))}
                        </div>
                    )}
                </div>
            </ScrollArea>

            {/* Footer / Pagination */}
            {!loading && visible.length > 0 && (
                <div className="flex shrink-0 items-center justify-center border-t border-primary-foreground/20 px-4 py-2 text-xs text-zinc-400">
                    
                    <div className="flex items-center gap-1">
                        <PageButton
                            label="Previous page"
                            disabled={currentPage === 1}
                            onClick={() => goTo(currentPage - 1)}
                        >
                            <ChevronLeft />
                        </PageButton>
                        {pages.map((p, idx) =>
                            p === "gap" ? (
                                <span key={`gap-${idx}`} className="px-1 text-zinc-600">
                                    …
                                </span>
                            ) : (
                                <PageButton
                                    key={p}
                                    label={`Page ${p}`}
                                    active={p === currentPage}
                                    onClick={() => goTo(p)}
                                >
                                    {p}
                                </PageButton>
                            ),
                        )}
                        <PageButton
                            label="Next page"
                            disabled={nextDisabled}
                            onClick={goNext}
                        >
                            <ChevronRight />
                        </PageButton>
                    </div>
                </div>
            )}
        </div>
    );
} 