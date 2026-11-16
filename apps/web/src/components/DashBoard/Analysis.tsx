"use client";

import { growthFor } from "@/lib/complexity";
import type { FeatureCopy } from "@/components/auth/FeatureGate";
import { SampleChip } from "@/components/ui/SampleChip";
import type {
    AnalysisLanguage,
    AnalysisReport,
    AnalysisResult,
    Bottleneck,
    Breakdown,
    Comparison,
    ComplexityResult,
    Improvement,
} from "@algoforge/contracts";

import {
    ArrowUpRight,
    Check,
    ChevronRight,
    Copy,
    RotateCcw,
    Zap,
} from "lucide-react";
import {
    ReactNode,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import {
    Area,
    AreaChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import {
    AnimatePresence,
    animate,
    motion,
    useMotionValue,
    useScroll,
    useTransform,
    Variants,
} from "framer-motion";

// ─── Types ────────────────────────────────────────────────────────────────────

// Analysis types come from the shared contracts package; none are declared here.
export type { AnalysisResult, Bottleneck, Breakdown, Comparison, ComplexityResult, Improvement };
export type Language = AnalysisLanguage;
export type Analysis = AnalysisReport;

export type SeriesKey = "best" | "avg" | "worst" | "space";
export interface ChartPoint {
    n: number;
    best: number | null;
    avg: number | null;
    worst: number | null;
    space: number | null;
}
export interface ChartModel {
    points: ChartPoint[];
    /** Series whose complexity string we could not map to a known growth class. */
    unsupported: { series: SeriesKey; value: string }[];
}

// ─── generateChartData ───────────────────────────────────────────────────────

export function generateChartData(complexity: ComplexityResult): ChartModel {
    const requested: [SeriesKey, string][] = [
        ["best", complexity.time.best],
        ["avg", complexity.time.average],
        ["worst", complexity.time.worst],
        ["space", complexity.space],
    ];
    const fns = {} as Record<SeriesKey, ReturnType<typeof growthFor>>;
    const unsupported: ChartModel["unsupported"] = [];
    for (const [series, value] of requested) {
        fns[series] = growthFor(value);
        if (!fns[series]) unsupported.push({ series, value });
    }
    const y = (k: SeriesKey, n: number) =>
        fns[k] ? parseFloat(fns[k]!(n).toFixed(2)) : null;
    const points: ChartPoint[] = [];
    for (let n = 0; n <= 100; n += 5)
        points.push({
            n,
            best: y("best", n),
            avg: y("avg", n),
            worst: y("worst", n),
            space: y("space", n),
        });
    return { points, unsupported };
}

export const SECTIONS = [
    { id: "overview", label: "Overview" },
    { id: "growth", label: "Growth" },
    { id: "breakdown", label: "Breakdown" },
    { id: "risks", label: "Risks" },
    { id: "fixes", label: "Fixes" },
    { id: "code", label: "Code" },
];

// ─── Motion ──────────────────────────────────────────────────────────────────

export const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

export const stagger: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: 0.05, delayChildren: 0.04 } },
};

export const fadeUp: Variants = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE } },
};

const rowIn: Variants = {
    hidden: { opacity: 0, y: 6 },
    show: (i: number = 0) => ({
        opacity: 1,
        y: 0,
        transition: { duration: 0.35, delay: 0.05 + i * 0.045, ease: EASE },
    }),
};

// ─── Tokens ──────────────────────────────────────────────────────────────────

const SERIES_COLOR: Record<SeriesKey, string> = {
    best: "#4ade80",
    avg: "#60a5fa",
    worst: "#f87171",
    space: "#a78bfa",
};

// ─── Primitives ──────────────────────────────────────────────────────────────

function Eyebrow({ children }: { children: ReactNode }) {
    return (
        <span className="select-none font-mono text-[11px] uppercase tracking-[0.12em] text-zinc-500">
            {children}
        </span>
    );
}

function Kbd({ children }: { children: ReactNode }) {
    return (
        <kbd className="rounded border border-white/10 bg-white/4 px-1.5 py-px font-mono text-[10px] leading-4 text-zinc-400">
            {children}
        </kbd>
    );
}

function Section({
    id,
    index,
    title,
    aside,
    children,
}: {
    id: string;
    index: string;
    title: string;
    aside?: ReactNode;
    children: ReactNode;
}) {
    return (
        <motion.section
            id={id}
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "0px 0px -60px 0px" }}
            transition={{ duration: 0.5, ease: EASE }}
            className="scroll-mt-20 border-t border-white/8 py-10 first:border-t-0 first:pt-0"
        >
            <header className="flex items-center justify-between gap-4">
                <div className="flex items-baseline gap-3">
                    <span className="font-mono text-[11px] text-zinc-500 tabular-nums">
                        {index}
                    </span>
                    <h3 className="text-sm font-medium tracking-tight text-zinc-100">
                        {title}
                    </h3>
                </div>
                {aside}
            </header>
            <div className="mt-6">{children}</div>
        </motion.section>
    );
}

function CountUp({ value, className }: { value: number; className?: string }) {
    const mv = useMotionValue(0);
    const text = useTransform(mv, (v) => Math.round(v).toString());
    useEffect(() => {
        const c = animate(mv, value, { duration: 1.1, ease: EASE });
        return () => c.stop();
    }, [value, mv]);
    return <motion.span className={className}>{text}</motion.span>;
}

// ─── Readability meter ───────────────────────────────────────────────────────

function gradeFor(score: number) {
    if (score >= 85) return { label: "Excellent", color: "#4ade80" };
    if (score >= 70) return { label: "Good", color: "#a3e635" };
    if (score >= 50) return { label: "Fair", color: "#fbbf24" };
    return { label: "Needs work", color: "#f87171" };
}

function ReadabilityMeter({ score }: { score: number }) {
    const SEG = 25;
    const filled = Math.round((score / 100) * SEG);
    const grade = gradeFor(score);

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-end justify-between">
                <div className="flex items-baseline gap-1">
                    <CountUp
                        value={score}
                        className="text-5xl font-semibold tracking-tight text-zinc-50 tabular-nums"
                    />
                    <span className="font-mono text-xs text-zinc-500">/100</span>
                </div>
                <span
                    className="font-mono text-[11px] uppercase tracking-[0.12em]"
                    style={{ color: grade.color }}
                >
                    {grade.label}
                </span>
            </div>

            <div className="flex h-8 items-end gap-0.75">
                {Array.from({ length: SEG }, (_, i) => {
                    const on = i < filled;
                    return (
                        <motion.span
                            key={i}
                            initial={{ scaleY: 0.35, opacity: 0.5 }}
                            animate={{ scaleY: 1, opacity: 1 }}
                            transition={{
                                duration: 0.4,
                                delay: 0.25 + i * 0.022,
                                ease: EASE,
                            }}
                            className="h-full flex-1 origin-bottom rounded-[1px]"
                            style={{
                                backgroundColor: on
                                    ? grade.color
                                    : "rgba(255,255,255,0.08)",
                            }}
                        />
                    );
                })}
            </div>

            <div className="relative h-3 font-mono text-[10px] text-zinc-500">
                {[0, 50, 70, 85, 100].map((t) => (
                    <span
                        key={t}
                        className="absolute -translate-x-1/2 first:translate-x-0 last:-translate-x-full"
                        style={{ left: `${t}%` }}
                    >
                        {t}
                    </span>
                ))}
            </div>
        </div>
    );
}

// ─── Complexity matrix ───────────────────────────────────────────────────────

const CLASS_LABELS = ["O(1)", "O(log n)", "O(n)", "O(n log n)", "O(n²)", "O(2ⁿ)"];
const CLASS_KEYS = ["o(1)", "o(logn)", "o(n)", "o(nlogn)", "o(n^2)", "o(2^n)"];

const classIndex = (v: string) =>
    CLASS_KEYS.indexOf(
        v.toLowerCase().replace(/\s+/g, "").replace("²", "^2").replace("ⁿ", "^n"),
    );

function ComplexityMatrix({ complexity }: { complexity: ComplexityResult }) {
    const rows: { label: string; value: string; key: SeriesKey }[] = [
        { label: "Best", value: complexity.time.best, key: "best" },
        { label: "Average", value: complexity.time.average, key: "avg" },
        { label: "Worst", value: complexity.time.worst, key: "worst" },
        { label: "Space", value: complexity.space, key: "space" },
    ];

    return (
        <div className="overflow-x-auto">
            <div className="min-w-130 rounded-lg border border-white/8">
                <div className="grid grid-cols-[72px_1fr_84px] items-center border-b border-white/8 px-4 py-2.5">
                    <span />
                    <div className="grid grid-cols-6">
                        {CLASS_LABELS.map((c) => (
                            <span
                                key={c}
                                className="text-center font-mono text-[10px] text-zinc-500"
                            >
                                {c}
                            </span>
                        ))}
                    </div>
                    <span />
                </div>

                {rows.map((r, ri) => {
                    const idx = classIndex(r.value);
                    const color = SERIES_COLOR[r.key];
                    return (
                        <div
                            key={r.key}
                            className="grid grid-cols-[72px_1fr_84px] items-center border-b border-white/6 px-4 last:border-b-0"
                        >
                            <span className="font-mono text-[11px] text-zinc-400">
                                {r.label}
                            </span>

                            <div className="relative grid h-11 grid-cols-6">
                                {idx >= 0 && (
                                    <motion.span
                                        initial={{ scaleX: 0 }}
                                        animate={{ scaleX: 1 }}
                                        transition={{
                                            duration: 0.7,
                                            delay: 0.2 + ri * 0.08,
                                            ease: EASE,
                                        }}
                                        className="absolute left-0 top-1/2 h-px origin-left"
                                        style={{
                                            width: `${((idx + 0.5) / 6) * 100}%`,
                                            backgroundColor: color,
                                            opacity: 0.45,
                                        }}
                                    />
                                )}
                                {CLASS_LABELS.map((c, ci) => (
                                    <div
                                        key={c}
                                        className="relative flex items-center justify-center"
                                    >
                                        {ci === idx ? (
                                            <motion.span
                                                initial={{ scale: 0 }}
                                                animate={{ scale: 1 }}
                                                transition={{
                                                    duration: 0.4,
                                                    delay: 0.55 + ri * 0.08,
                                                    ease: EASE,
                                                }}
                                                className="h-2.5 w-2.5 rounded-full"
                                                style={{ backgroundColor: color }}
                                            />
                                        ) : (
                                            <span className="h-1 w-1 rounded-full bg-white/15" />
                                        )}
                                    </div>
                                ))}
                            </div>

                            <span
                                className="text-right font-mono text-xs tabular-nums"
                                style={{ color: idx >= 0 ? color : "#a1a1aa" }}
                            >
                                {r.value}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ─── Charts ──────────────────────────────────────────────────────────────────

interface SeriesDef {
    key: SeriesKey;
    color: string;
    label: string;
}

const TIME_SERIES: SeriesDef[] = [
    { key: "best", color: SERIES_COLOR.best, label: "Best" },
    { key: "avg", color: SERIES_COLOR.avg, label: "Average" },
    { key: "worst", color: SERIES_COLOR.worst, label: "Worst" },
];
const SPACE_SERIES: SeriesDef[] = [
    { key: "space", color: SERIES_COLOR.space, label: "Space" },
];

export const plottedSeries = (model: ChartModel, defs: SeriesDef[]) =>
    defs.filter((s) => !model.unsupported.some((u) => u.series === s.key));

export function ComplexityChart({
    model,
    type,
    hidden = [],
}: {
    model: ChartModel;
    type: "time" | "space";
    hidden?: SeriesKey[];
}) {
    const defs = type === "time" ? TIME_SERIES : SPACE_SERIES;
    const available = plottedSeries(model, defs);
    const series = available.filter((s) => !hidden.includes(s.key));
    const missing = model.unsupported.filter((u) =>
        defs.some((s) => s.key === u.series),
    );
    const [hoverN, setHoverN] = useState<number | null>(null);

    if (available.length === 0)
        return (
            <div
                role="note"
                className="flex h-56 items-center justify-center rounded-lg border border-dashed border-white/10 px-6 text-center text-xs text-zinc-400"
            >
                No chart for {missing.map((m) => m.value).join(", ")}: this
                growth rate is not one we can plot.
            </div>
        );

    const point =
        model.points.find((p) => p.n === hoverN) ??
        model.points[model.points.length - 1];

    return (
        <div className="flex flex-col gap-4">
            <div className="flex h-5 items-center gap-5 font-mono text-[11px] tabular-nums">
                <span className="text-zinc-500">
                    n = <span className="text-zinc-200">{point.n}</span>
                </span>
                {series.map((s) => (
                    <span key={s.key} className="flex items-center gap-1.5">
                        <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: s.color }}
                        />
                        <span className="text-zinc-500">{s.label}</span>
                        <span className="text-zinc-100">{point[s.key]}</span>
                    </span>
                ))}
            </div>

            <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                        data={model.points}
                        margin={{ top: 8, right: 8, left: -24, bottom: 0 }}
                        onMouseMove={(s: unknown) => {
                            const l = (s as { activeLabel?: string | number })
                                ?.activeLabel;
                            if (l !== undefined) setHoverN(Number(l));
                        }}
                        onMouseLeave={() => setHoverN(null)}
                    >
                        <defs>
                            {series.map((s) => (
                                <linearGradient
                                    key={s.key}
                                    id={`grad-${type}-${s.key}`}
                                    x1="0"
                                    y1="0"
                                    x2="0"
                                    y2="1"
                                >
                                    <stop
                                        offset="0%"
                                        stopColor={s.color}
                                        stopOpacity={0.12}
                                    />
                                    <stop
                                        offset="100%"
                                        stopColor={s.color}
                                        stopOpacity={0}
                                    />
                                </linearGradient>
                            ))}
                        </defs>
                        <CartesianGrid
                            stroke="rgba(255,255,255,0.06)"
                            strokeDasharray="2 4"
                            vertical={false}
                        />
                        <XAxis
                            dataKey="n"
                            tick={{ fontSize: 11, fill: "#71717a" }}
                            tickLine={false}
                            axisLine={false}
                        />
                        <YAxis
                            tick={{ fontSize: 11, fill: "#71717a" }}
                            tickLine={false}
                            axisLine={false}
                        />
                        <Tooltip
                            content={() => null}
                            cursor={{
                                stroke: "rgba(255,255,255,0.3)",
                                strokeDasharray: "3 3",
                            }}
                        />
                        {series.map((s) => (
                            <Area
                                key={s.key}
                                type="monotone"
                                dataKey={s.key}
                                name={s.label}
                                stroke={s.color}
                                strokeWidth={1.5}
                                fill={`url(#grad-${type}-${s.key})`}
                                dot={false}
                                activeDot={{
                                    r: 3,
                                    strokeWidth: 0,
                                    fill: s.color,
                                }}
                                animationDuration={800}
                            />
                        ))}
                    </AreaChart>
                </ResponsiveContainer>
            </div>

            {missing.length > 0 && (
                <p className="font-mono text-[11px] text-zinc-500">
                    Not plotted:{" "}
                    {missing.map((m) => `${m.series} = ${m.value}`).join(", ")}.
                </p>
            )}
        </div>
    );
}

function Segmented<T extends string>({
    value,
    options,
    onChange,
    id,
}: {
    value: T;
    options: { value: T; label: string }[];
    onChange: (v: T) => void;
    id: string;
}) {
    return (
        <div className="flex gap-0.5 rounded-lg border border-white/8 bg-white/2 p-0.5">
            {options.map((o) => (
                <button
                    key={o.value}
                    onClick={() => onChange(o.value)}
                    className={`relative cursor-pointer rounded-md px-3 py-1 font-mono text-[11px] transition-colors ${
                        value === o.value
                            ? "text-zinc-50"
                            : "text-zinc-500 hover:text-zinc-300"
                    }`}
                >
                    {value === o.value && (
                        <motion.span
                            layoutId={id}
                            transition={{ duration: 0.3, ease: EASE }}
                            className="absolute inset-0 rounded-md bg-white/8"
                        />
                    )}
                    <span className="relative">{o.label}</span>
                </button>
            ))}
        </div>
    );
}

function SeriesToggle({
    def,
    off,
    onToggle,
}: {
    def: SeriesDef;
    off: boolean;
    onToggle: () => void;
}) {
    return (
        <button
            onClick={onToggle}
            aria-pressed={!off}
            className={`flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-[11px] transition-all duration-200 ${
                off
                    ? "border-white/6 text-zinc-600"
                    : "border-white/10 text-zinc-300 hover:bg-white/4"
            }`}
        >
            <span
                className="h-1.5 w-1.5 rounded-full transition-opacity"
                style={{
                    backgroundColor: def.color,
                    opacity: off ? 0.3 : 1,
                }}
            />
            {def.label}
        </button>
    );
}

// ─── Code block ──────────────────────────────────────────────────────────────

function highlight(line: string, lang: Language): ReactNode[] {
    const kw =
        lang === "python"
            ? "def|return|if|elif|else|while|for|in|not|and|or|None|True|False|int|list"
            : "function|return|if|else|while|const|let|var|for|true|false|null";
    const re = new RegExp(
        `(#.*|//.*)|("[^"]*"|'[^']*')|\\b(${kw})\\b|\\b(\\d+)\\b`,
        "g",
    );
    const out: ReactNode[] = [];
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(line)) !== null) {
        if (m.index > last) out.push(line.slice(last, m.index));
        const cls = m[1]
            ? "text-zinc-500 italic"
            : m[2]
              ? "text-emerald-300"
              : m[3]
                ? "text-sky-300"
                : "text-amber-300";
        out.push(
            <span key={m.index} className={cls}>
                {m[0]}
            </span>,
        );
        last = m.index + m[0].length;
    }
    if (last < line.length) out.push(line.slice(last));
    return out;
}

function CodeBlock({ code, language }: { code: string; language: Language }) {
    const [copied, setCopied] = useState(false);
    const lines = code.split("\n");

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
        } catch {
            /* clipboard unavailable */
        }
    };

    return (
        <div className="overflow-hidden rounded-lg border border-white/8">
            <div className="flex items-center justify-between border-b border-white/8 px-4 py-2">
                <div className="flex items-center gap-2 font-mono text-[11px]">
                    <span className="text-zinc-300">
                        optimized.{language === "python" ? "py" : "js"}
                    </span>
                    <span className="rounded border border-white/8 px-1.5 text-[10px] text-zinc-500">
                        {lines.length} lines
                    </span>
                </div>
                <button
                    onClick={copy}
                    className="flex h-6 cursor-pointer items-center gap-1.5 rounded-md px-2 font-mono text-[11px] text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-100"
                >
                    <AnimatePresence mode="wait" initial={false}>
                        <motion.span
                            key={copied ? "ok" : "copy"}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            transition={{ duration: 0.15 }}
                            className="flex items-center gap-1.5"
                        >
                            {copied ? (
                                <>
                                    <Check className="h-3 w-3 text-emerald-400" />
                                    Copied
                                </>
                            ) : (
                                <>
                                    <Copy className="h-3 w-3" />
                                    Copy
                                </>
                            )}
                        </motion.span>
                    </AnimatePresence>
                </button>
            </div>
            <pre className="overflow-x-auto py-3 font-mono text-[12.5px] leading-6">
                <code className="grid">
                    {lines.map((line, i) => (
                        <span
                            key={i}
                            className="flex transition-colors hover:bg-white/3"
                        >
                            <span className="w-11 shrink-0 select-none pr-4 text-right text-zinc-600 tabular-nums">
                                {i + 1}
                            </span>
                            <span className="whitespace-pre pr-4 text-zinc-300">
                                {highlight(line, language)}
                                {line === "" && " "}
                            </span>
                        </span>
                    ))}
                </code>
            </pre>
        </div>
    );
}

// ─── Results screen ──────────────────────────────────────────────────────────

interface ResultsProps {
    language: Language;
    result: AnalysisResult;
    /** The result is fixed sample content (development only). */
    sample?: boolean;
    resetLabel?: string;
    onReset: () => void;
}

export function ResultsScreen({ language, result, sample = false, resetLabel = "Re-run", onReset }: ResultsProps) {
    const { complexity } = result;
    const chart = useMemo(() => generateChartData(complexity), [complexity]);

    const scrollRef = useRef<HTMLDivElement>(null);
    const { scrollYProgress } = useScroll({ container: scrollRef });
    const [active, setActive] = useState(SECTIONS[0].id);

    const [tab, setTab] = useState<"time" | "space">("time");
    const [hidden, setHidden] = useState<SeriesKey[]>([]);
    const [focusStep, setFocusStep] = useState<number | null>(null);
    const [openFix, setOpenFix] = useState<number | null>(0);
    const [checked, setChecked] = useState<Set<string>>(new Set());

    const onScroll = useCallback(() => {
        const el = scrollRef.current;
        if (!el) return;
        const base = el.getBoundingClientRect().top;
        let cur = SECTIONS[0].id;
        for (const s of SECTIONS) {
            const node = el.querySelector<HTMLElement>(`#${s.id}`);
            if (node && node.getBoundingClientRect().top - base <= 120)
                cur = s.id;
        }
        setActive(cur);
    }, []);

    const goTo = (id: string) => {
        const el = scrollRef.current;
        const node = el?.querySelector<HTMLElement>(`#${id}`);
        if (!el || !node) return;
        el.scrollTo({
            top:
                el.scrollTop +
                node.getBoundingClientRect().top -
                el.getBoundingClientRect().top -
                72,
            behavior: "smooth",
        });
    };

    const toggleSeries = (k: SeriesKey) =>
        setHidden((h) => (h.includes(k) ? h.filter((x) => x !== k) : [...h, k]));

    const toggleEdge = (e: string) =>
        setChecked((prev) => {
            const next = new Set(prev);
            if (next.has(e)) next.delete(e);
            else next.add(e);
            return next;
        });

    return (
        <div
            ref={scrollRef}
            onScroll={onScroll}
            className="h-full overflow-y-auto overscroll-contain scroll-smooth [scrollbar-color:#27272a_transparent] [scrollbar-width:thin]"
        >
            {/* Header */}
            <header className="sticky top-0 z-20 border-b border-white/8 bg-primary-background/80 backdrop-blur-md">
                <div className="relative mx-auto flex h-12 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
                    <div className="flex items-center gap-2.5 font-mono text-xs">
                        <Zap className="h-3.5 w-3.5 text-zinc-50" strokeWidth={1.5} />
                        <span className="text-zinc-100">Forge</span>
                        <span className="text-zinc-600">/</span>
                        <span className="text-zinc-400">Analysis</span>
                        <span className="text-zinc-600">/</span>
                        <span className="text-zinc-400">
                            {language === "python" ? "python" : "javascript"}
                        </span>
                    </div>
                    <div className="flex items-center gap-3">
                        {sample && <SampleChip />}
                        <span className="hidden items-center gap-1.5 font-mono text-[11px] text-zinc-400 sm:flex">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                            Complete
                        </span>
                        <button
                            onClick={onReset}
                            className="flex h-7 cursor-pointer items-center gap-2 rounded-md border border-white/10 px-2.5 text-[11px] text-zinc-300 transition-colors hover:bg-white/5 hover:text-zinc-50"
                        >
                            <RotateCcw className="h-3 w-3" />
                            {resetLabel}
                            {sample && <Kbd>R</Kbd>}
                        </button>
                    </div>
                    <motion.span
                        aria-hidden
                        className="absolute bottom-0 left-0 h-px w-full origin-left bg-zinc-100/70"
                        style={{ scaleX: scrollYProgress }}
                    />
                </div>
            </header>

            <div className="mx-auto grid max-w-6xl gap-12 px-4 py-10 sm:px-6 lg:grid-cols-[140px_minmax(0,1fr)]">
                {/* Side nav */}
                <aside className="hidden lg:block">
                    <nav className="sticky top-24 flex flex-col">
                        {SECTIONS.map((s, i) => {
                            const on = active === s.id;
                            return (
                                <button
                                    key={s.id}
                                    onClick={() => goTo(s.id)}
                                    className={`relative flex cursor-pointer items-baseline gap-2 py-1.5 pl-3 text-left text-xs transition-colors ${
                                        on
                                            ? "text-zinc-50"
                                            : "text-zinc-500 hover:text-zinc-300"
                                    }`}
                                >
                                    <span className="absolute left-0 top-0 h-full w-px bg-white/10" />
                                    {on && (
                                        <motion.span
                                            layoutId="nav-indicator"
                                            transition={{ duration: 0.3, ease: EASE }}
                                            className="absolute left-0 top-0 h-full w-px bg-zinc-50"
                                        />
                                    )}
                                    <span className="font-mono text-[10px] text-zinc-600 tabular-nums">
                                        0{i + 1}
                                    </span>
                                    {s.label}
                                </button>
                            );
                        })}
                    </nav>
                </aside>

                <main className="min-w-0">
                    {/* 01 Overview */}
                    <Section id="overview" index="01" title="Overview">
                        <div className="grid gap-10 lg:grid-cols-[1fr_260px]">
                            <div className="flex flex-col gap-5">
                                <div>
                                    <Eyebrow>Average time</Eyebrow>
                                    <motion.h2
                                        initial={{ opacity: 0, y: 12 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.6, ease: EASE }}
                                        className="mt-2 text-5xl font-semibold tracking-tight text-zinc-50 sm:text-6xl"
                                    >
                                        {complexity.time.average}
                                    </motion.h2>
                                    <p className="mt-2 font-mono text-xs text-zinc-500">
                                        space {complexity.space}
                                    </p>
                                </div>
                                <p className="max-w-prose text-[15px] leading-relaxed text-zinc-300">
                                    {result.summary}
                                </p>
                                {result.tags && result.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-[11px] text-zinc-500">
                                        {result.tags.map((t) => (
                                            <span key={t}>#{t}</span>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-col gap-3">
                                <Eyebrow>Readability</Eyebrow>
                                {result.readabilityScore !== undefined ? (
                                    <ReadabilityMeter score={result.readabilityScore} />
                                ) : (
                                    <p className="text-sm text-zinc-400">
                                        No score available.
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="mt-10">
                            <ComplexityMatrix complexity={complexity} />
                        </div>
                    </Section>

                    {/* 02 Growth */}
                    <Section
                        id="growth"
                        index="02"
                        title="Growth"
                        aside={
                            <Segmented
                                id="growth-seg"
                                value={tab}
                                onChange={setTab}
                                options={[
                                    { value: "time", label: "Time" },
                                    { value: "space", label: "Space" },
                                ]}
                            />
                        }
                    >
                        {tab === "time" && (
                            <div className="mb-5 flex flex-wrap gap-2">
                                {plottedSeries(chart, TIME_SERIES).map((s) => (
                                    <SeriesToggle
                                        key={s.key}
                                        def={s}
                                        off={hidden.includes(s.key)}
                                        onToggle={() => toggleSeries(s.key)}
                                    />
                                ))}
                            </div>
                        )}
                        <AnimatePresence mode="wait" initial={false}>
                            <motion.div
                                key={tab}
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.2 }}
                            >
                                <ComplexityChart
                                    model={chart}
                                    type={tab}
                                    hidden={hidden}
                                />
                            </motion.div>
                        </AnimatePresence>
                    </Section>

                    {/* 03 Breakdown */}
                    <Section id="breakdown" index="03" title="Breakdown">
                        <p className="mb-6 max-w-prose text-[13px] leading-relaxed text-zinc-400">
                            {result.breakdown.approach}
                        </p>
                        <ol className="relative flex flex-col">
                            <motion.span
                                aria-hidden
                                initial={{ scaleY: 0 }}
                                whileInView={{ scaleY: 1 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.9, ease: EASE }}
                                className="absolute bottom-4 left-3.25 top-4 w-px origin-top bg-white/10"
                            />
                            {result.breakdown.steps.map((step, i) => {
                                const dim = focusStep !== null && focusStep !== i;
                                const on = focusStep === i;
                                return (
                                    <motion.li
                                        key={i}
                                        custom={i}
                                        variants={rowIn}
                                        initial="hidden"
                                        whileInView="show"
                                        viewport={{ once: true }}
                                    >
                                        <button
                                            onMouseEnter={() => setFocusStep(i)}
                                            onMouseLeave={() => setFocusStep(null)}
                                            onFocus={() => setFocusStep(i)}
                                            onBlur={() => setFocusStep(null)}
                                            className={`relative flex w-full cursor-pointer items-start gap-4 rounded-md py-2.5 text-left transition-opacity duration-200 ${
                                                dim ? "opacity-40" : "opacity-100"
                                            }`}
                                        >
                                            <span
                                                className={`z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border font-mono text-[11px] tabular-nums transition-colors duration-200 ${
                                                    on
                                                        ? "border-zinc-50 bg-zinc-50 text-zinc-950"
                                                        : "border-white/12 bg-primary-background text-zinc-400"
                                                }`}
                                            >
                                                {i + 1}
                                            </span>
                                            <span className="pt-1 text-[13px] leading-relaxed text-zinc-200">
                                                {step}
                                            </span>
                                        </button>
                                    </motion.li>
                                );
                            })}
                        </ol>
                    </Section>

                    {/* 04 Risks */}
                    <Section id="risks" index="04" title="Risks">
                        <div className="grid gap-10 lg:grid-cols-2">
                            <div className="flex flex-col gap-3">
                                <div className="flex items-center justify-between">
                                    <Eyebrow>Bottlenecks</Eyebrow>
                                    <span className="font-mono text-[11px] text-zinc-500">
                                        {result.bottlenecks.length}
                                    </span>
                                </div>
                                {result.bottlenecks.map((b, i) => (
                                    <motion.div
                                        key={i}
                                        custom={i}
                                        variants={rowIn}
                                        initial="hidden"
                                        whileInView="show"
                                        viewport={{ once: true }}
                                        className="relative rounded-lg border border-white/8 py-3.5 pl-5 pr-4 transition-colors hover:bg-white/2"
                                    >
                                        <span className="absolute bottom-3 left-0 top-3 w-0.5 rounded-full bg-red-400/70" />
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <span className="text-[13px] font-medium text-zinc-100">
                                                {b.issue}
                                            </span>
                                            {b.location && (
                                                <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[11px] text-zinc-400">
                                                    {b.location}
                                                </code>
                                            )}
                                        </div>
                                        <p className="mt-1.5 text-[12px] leading-relaxed text-zinc-400">
                                            {b.impact}
                                        </p>
                                    </motion.div>
                                ))}
                            </div>

                            <div className="flex flex-col gap-10">
                                <div className="flex flex-col gap-3">
                                    <Eyebrow>Anti-patterns</Eyebrow>
                                    <ul className="flex flex-col">
                                        {result.antiPatterns.map((ap, i) => (
                                            <motion.li
                                                key={i}
                                                custom={i}
                                                variants={rowIn}
                                                initial="hidden"
                                                whileInView="show"
                                                viewport={{ once: true }}
                                                className="flex items-start gap-3 border-b border-white/6 py-2.5 text-[13px] leading-relaxed text-zinc-300 last:border-b-0"
                                            >
                                                <span className="mt-px font-mono text-xs text-amber-400">
                                                    ×
                                                </span>
                                                {ap}
                                            </motion.li>
                                        ))}
                                    </ul>
                                </div>

                                <div className="flex flex-col gap-3">
                                    <div className="flex items-center justify-between">
                                        <Eyebrow>Edge cases</Eyebrow>
                                        <span className="font-mono text-[11px] text-zinc-500 tabular-nums">
                                            {checked.size}/{result.edgeCases.length}{" "}
                                            checked
                                        </span>
                                    </div>
                                    <ul className="flex flex-col">
                                        {result.edgeCases.map((ec) => {
                                            const on = checked.has(ec);
                                            return (
                                                <li key={ec}>
                                                    <button
                                                        onClick={() => toggleEdge(ec)}
                                                        className="group flex w-full cursor-pointer items-center gap-3 border-b border-white/6 py-2.5 text-left transition-colors hover:bg-white/2"
                                                    >
                                                        <span
                                                            className={`flex h-4 w-4 items-center justify-center rounded border transition-colors duration-200 ${
                                                                on
                                                                    ? "border-zinc-50 bg-zinc-50"
                                                                    : "border-white/20 group-hover:border-white/40"
                                                            }`}
                                                        >
                                                            <AnimatePresence>
                                                                {on && (
                                                                    <motion.span
                                                                        initial={{ scale: 0 }}
                                                                        animate={{ scale: 1 }}
                                                                        exit={{ scale: 0 }}
                                                                        transition={{ duration: 0.15 }}
                                                                    >
                                                                        <Check
                                                                            className="h-3 w-3 text-zinc-950"
                                                                            strokeWidth={3}
                                                                        />
                                                                    </motion.span>
                                                                )}
                                                            </AnimatePresence>
                                                        </span>
                                                        <span
                                                            className={`text-[13px] transition-colors duration-200 ${
                                                                on
                                                                    ? "text-zinc-500 line-through"
                                                                    : "text-zinc-300"
                                                            }`}
                                                        >
                                                            {ec}
                                                        </span>
                                                    </button>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </Section>

                    {/* 05 Fixes */}
                    <Section id="fixes" index="05" title="Fixes">
                        <ul className="overflow-hidden rounded-lg border border-white/8">
                            {result.improvements.map((imp, i) => {
                                const open = openFix === i;
                                return (
                                    <li
                                        key={i}
                                        className="border-b border-white/8 last:border-b-0"
                                    >
                                        <button
                                            onClick={() => setOpenFix(open ? null : i)}
                                            aria-expanded={open}
                                            className="flex w-full cursor-pointer items-center gap-4 px-4 py-3.5 text-left transition-colors hover:bg-white/2"
                                        >
                                            <span className="font-mono text-[11px] text-zinc-500 tabular-nums">
                                                0{i + 1}
                                            </span>
                                            <span className="flex-1 text-[13px] text-zinc-100">
                                                {imp.suggestion}
                                            </span>
                                            <ChevronRight
                                                className={`h-4 w-4 text-zinc-500 transition-transform duration-300 ${
                                                    open ? "rotate-90" : ""
                                                }`}
                                            />
                                        </button>
                                        <AnimatePresence initial={false}>
                                            {open && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: "auto", opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    transition={{ duration: 0.3, ease: EASE }}
                                                    className="overflow-hidden"
                                                >
                                                    <p className="flex items-start gap-2 px-4 pb-4 pl-13 text-[12px] leading-relaxed text-emerald-300">
                                                        <ArrowUpRight
                                                            className="mt-0.5 h-3.5 w-3.5 shrink-0"
                                                            strokeWidth={1.75}
                                                        />
                                                        {imp.expectedImpact}
                                                    </p>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </li>
                                );
                            })}
                        </ul>
                    </Section>

                    {/* 06 Code */}
                    <Section id="code" index="06" title="Code">
                        <CodeBlock code={result.optimizedCode} language={language} />

                        {result.comparison && (
                            <div className="mt-4 grid divide-white/8 overflow-hidden rounded-lg border border-white/8 md:grid-cols-2 md:divide-x">
                                <div className="p-4">
                                    <Eyebrow>Original → Optimized</Eyebrow>
                                    <p className="mt-2 text-[13px] leading-relaxed text-zinc-400">
                                        {result.comparison.originalVsOptimized}
                                    </p>
                                </div>
                                <div className="border-t border-white/8 p-4 md:border-t-0">
                                    <Eyebrow>Net result</Eyebrow>
                                    <p className="mt-2 text-[13px] leading-relaxed text-emerald-300">
                                        {result.comparison.improvementSummary}
                                    </p>
                                </div>
                            </div>
                        )}
                    </Section>
                </main>
            </div>
        </div>
    );
}

export const ANALYSIS_COPY: FeatureCopy = {
    signInTitle: "Sign in to analyze your code",
    signInBody: "Analysis, history and sharing belong to your account. The editor and the visualizer keep working without one.",
    unavailableTitle: "Analysis isn't available yet",
    unavailableBody: "The analysis engine is not connected to this build. The Visualizer works today: pick it in the toolbar.",
};

/**
 * Real analysis needs an account and a connected engine. The server's capabilities decide what is shown;
 * the fixed sample report appears only in development.
 */
// The default panel moved to AnalysisFeature.tsx (Phase 7): it chooses between real and sample analysis.
