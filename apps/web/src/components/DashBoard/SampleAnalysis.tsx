"use client";

/**
 * Fixed sample report. Development only: AnalysisFeature loads this file on demand and FeatureGate
 * only shows it when mock data is enabled, so production never renders (or downloads) it.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, MotionConfig } from "framer-motion";
import { ArrowRight, Brain, Check, Code2, Search, ShieldCheck, Zap } from "lucide-react";
import { wait } from "@/lib/async";
import { SampleChip } from "@/components/ui/SampleChip";
import { EASE, ResultsScreen, SECTIONS, fadeUp, stagger, type Analysis, type Language } from "./Analysis";

type State = "idle" | "analyzing" | "completed";

// ─── Mock data (updated shape) ────────────────────────────────────────────────

export const codeAnalysis: Record<Language, Analysis> = {
    python: {
        language: "python",
        result: {
            summary:
                "Iterative binary search on a sorted array. Correctly halves the search space each iteration with O(log n) time and O(1) space.",
            complexity: {
                time: { best: "O(1)", average: "O(log n)", worst: "O(log n)" },
                space: "O(1)",
            },
            breakdown: {
                approach:
                    "Divide and conquer — maintain lo/hi pointers and check midpoint each iteration.",
                steps: [
                    "Initialise lo = 0, hi = len(arr) - 1",
                    "While lo ≤ hi compute mid = (lo + hi) // 2",
                    "Return mid if arr[mid] == target",
                    "Narrow window: hi = mid-1 or lo = mid+1",
                    "Return -1 when window collapses",
                ],
            },
            bottlenecks: [
                {
                    issue: "No pre-sort guard",
                    impact: "Silently returns wrong index on unsorted input",
                    location: "function entry",
                },
                {
                    issue: "Integer overflow risk",
                    impact: "Rare in Python due to arbitrary-precision ints, but a concern in other runtimes",
                    location: "mid = (lo + hi) // 2",
                },
            ],
            antiPatterns: [
                "Missing input validation (non-list, non-comparable elements)",
                "No handling for duplicate values — returns arbitrary match",
            ],
            improvements: [
                {
                    suggestion: "Assert or raise if array is not sorted",
                    expectedImpact: "Prevents silent incorrect results",
                },
                {
                    suggestion: "Use mid = lo + (hi - lo) // 2",
                    expectedImpact:
                        "Portable overflow-safe midpoint calculation",
                },
                {
                    suggestion:
                        "Return all matching indices for duplicate values",
                    expectedImpact: "Makes the API correct for multisets",
                },
            ],
            optimizedCode: `def binary_search(arr: list[int], target: int) -> int:
    if not arr:
        return -1
    lo, hi = 0, len(arr) - 1
    while lo <= hi:
        mid = lo + (hi - lo) // 2
        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            lo = mid + 1
        else:
            hi = mid - 1
    return -1`,
            comparison: {
                originalVsOptimized:
                    "Original used (lo+hi)//2 and lacked input validation; optimised version adds empty-array guard and overflow-safe midpoint.",
                improvementSummary:
                    "Correctness improved for edge inputs; algorithmic complexity unchanged at O(log n).",
            },
            edgeCases: [
                "Empty array",
                "Target missing",
                "Single element",
                "Duplicate values",
                "Target at boundaries",
            ],
            readabilityScore: 82,
            tags: [
                "binary-search",
                "divide-and-conquer",
                "sorted-array",
                "iterative",
            ],
        },
    },
    javascript: {
        language: "javascript",
        result: {
            summary:
                "Recursive binary search implementation. Functionally correct but risks call-stack overflow on very large arrays.",
            complexity: {
                time: { best: "O(1)", average: "O(log n)", worst: "O(log n)" },
                space: "O(log n)",
            },
            breakdown: {
                approach:
                    "Recursive divide-and-conquer splitting the array by midpoint each call.",
                steps: [
                    "Base case: return -1 if lo > hi",
                    "Compute mid = Math.floor((lo + hi) / 2)",
                    "Return mid on match",
                    "Recurse on left half if target < arr[mid]",
                    "Recurse on right half otherwise",
                ],
            },
            bottlenecks: [
                {
                    issue: "Recursive call stack",
                    impact: "O(log n) stack frames — stack overflow possible for very large arrays in some engines",
                    location: "recursive call sites",
                },
                {
                    issue: "No type checking",
                    impact: "Sparse arrays or non-numeric elements produce NaN comparisons",
                    location: "comparison expression",
                },
            ],
            antiPatterns: [
                "Recursion where a simple while loop suffices",
                "No guard against non-array or empty input",
                "Assumes numeric elements without assertion",
            ],
            improvements: [
                {
                    suggestion: "Convert to iterative with a while loop",
                    expectedImpact:
                        "Eliminates O(log n) stack overhead entirely",
                },
                {
                    suggestion: "Add Array.isArray and length guard at entry",
                    expectedImpact: "Prevents TypeError on invalid inputs",
                },
                {
                    suggestion: "Validate element types before comparison",
                    expectedImpact:
                        "Avoids silent NaN comparisons on non-numeric arrays",
                },
            ],
            optimizedCode: `function binarySearch(arr, target) {
  if (!Array.isArray(arr) || arr.length === 0) return -1;
  let lo = 0, hi = arr.length - 1;
  while (lo <= hi) {
    const mid = lo + ((hi - lo) >> 1);
    if (arr[mid] === target) return mid;
    if (arr[mid] < target) lo = mid + 1;
    else hi = mid - 1;
  }
  return -1;
}`,
            comparison: {
                originalVsOptimized:
                    "Original: recursive, no guards. Optimised: iterative while loop, input validation, bitwise midpoint.",
                improvementSummary:
                    "Space complexity reduced from O(log n) to O(1); correctness improved for edge inputs.",
            },
            edgeCases: [
                "Empty array",
                "Duplicate values",
                "Target missing",
                "Non-integer indices",
                "Sparse arrays",
            ],
            readabilityScore: 74,
            tags: ["binary-search", "recursive", "sorted-array", "javascript"],
        },
    },
};

const ANALYSIS_STEPS = [
    { label: "Initializing deep scan", icon: Search },
    { label: "Mapping structural patterns", icon: Code2 },
    { label: "Computing complexity bounds", icon: Brain },
    { label: "Verifying edge coverage", icon: ShieldCheck },
];

// ─── Idle screen ─────────────────────────────────────────────────────────────

function IdleScreen({ onStart }: { onStart: () => void }) {
    return (
        <div className="relative flex h-full w-full items-center justify-center overflow-hidden p-8">
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0"
                style={{
                    backgroundImage:
                        "radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)",
                    backgroundSize: "24px 24px",
                    maskImage:
                        "radial-gradient(ellipse 60% 55% at 50% 50%, #000 20%, transparent 75%)",
                    WebkitMaskImage:
                        "radial-gradient(ellipse 60% 55% at 50% 50%, #000 20%, transparent 75%)",
                }}
            />
            <motion.div
                variants={stagger}
                initial="hidden"
                animate="show"
                className="relative flex w-full max-w-md flex-col items-center gap-8 text-center"
            >
                <motion.div
                    variants={fadeUp}
                    className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-zinc-900"
                >
                    <Zap className="h-5 w-5 text-zinc-50" strokeWidth={1.5} />
                </motion.div>

                <motion.div variants={fadeUp} className="flex flex-col gap-3">
                    <h2 className="text-2xl font-semibold tracking-tight text-zinc-50">
                        Forge Engine
                    </h2>
                    <SampleChip className="self-center" />
                    <p className="text-sm leading-relaxed text-zinc-400">
                        A preview of the analysis report. In this build the
                        result is a fixed sample; it is not an analysis of your
                        code.
                    </p>
                </motion.div>

                <motion.ul
                    variants={stagger}
                    className="grid w-full grid-cols-2 gap-x-6 border-y border-white/8 py-4 text-left sm:grid-cols-3"
                >
                    {SECTIONS.map((s, i) => (
                        <motion.li
                            key={s.id}
                            variants={fadeUp}
                            className="flex items-baseline gap-2 py-1 font-mono text-[11px]"
                        >
                            <span className="text-zinc-600 tabular-nums">
                                0{i + 1}
                            </span>
                            <span className="text-zinc-400">{s.label}</span>
                        </motion.li>
                    ))}
                </motion.ul>

                <motion.div variants={fadeUp}>
                    <button
                        onClick={onStart}
                        className="group flex cursor-pointer items-center gap-3 rounded-lg bg-zinc-50 py-2 pl-4 pr-2.5 text-sm font-medium text-zinc-950 transition-all duration-200 hover:bg-white active:scale-[0.98]"
                    >
                        Show sample report
                        <span className="flex items-center gap-1.5 rounded-md bg-primary-background/30 px-1.5 py-0.5 font-mono text-[11px] text-zinc-900">
                            Enter
                            <ArrowRight className="h-3 w-3 transition-transform duration-200 group-hover:translate-x-0.5" />
                        </span>
                    </button>
                </motion.div>
            </motion.div>
        </div>
    );
}

// ─── Analyzing screen ────────────────────────────────────────────────────────

function useElapsed() {
    const [ms, setMs] = useState(0);
    useEffect(() => {
        const t0 = performance.now();
        const id = setInterval(() => setMs(performance.now() - t0), 100);
        return () => clearInterval(id);
    }, []);
    return ms;
}

function AnalyzingScreen({ step }: { step: number }) {
    const pct = ((step + 1) / ANALYSIS_STEPS.length) * 100;
    const ms = useElapsed();

    return (
        <div className="flex h-full w-full items-center justify-center p-6">
            <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: EASE }}
                className="w-full max-w-md overflow-hidden rounded-xl border border-white/8 bg-zinc-900/40"
            >
                <div className="relative flex items-center justify-between border-b border-white/8 px-4 py-3">
                    <span className="font-mono text-xs text-zinc-300">
                        forge run <span className="text-zinc-500">· sample</span>
                    </span>
                    <span className="font-mono text-[11px] text-zinc-500 tabular-nums">
                        {(ms / 1000).toFixed(1)}s
                    </span>
                    <motion.span
                        className="absolute bottom-0 left-0 h-px bg-zinc-100"
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.5, ease: EASE }}
                    />
                </div>

                <ul className="flex flex-col py-2">
                    {ANALYSIS_STEPS.map((s, i) => {
                        const done = i < step;
                        const active = i === step;
                        const Icon = s.icon;
                        return (
                            <li
                                key={s.label}
                                className={`flex items-center gap-3 px-4 py-2.5 font-mono text-xs transition-colors duration-300 ${
                                    done
                                        ? "text-zinc-500"
                                        : active
                                          ? "text-zinc-50"
                                          : "text-zinc-600"
                                }`}
                            >
                                <span className="relative flex h-5 w-5 items-center justify-center">
                                    {done ? (
                                        <motion.span
                                            initial={{ scale: 0.5, opacity: 0 }}
                                            animate={{ scale: 1, opacity: 1 }}
                                            transition={{ duration: 0.25, ease: EASE }}
                                        >
                                            <Check
                                                className="h-3.5 w-3.5 text-emerald-400"
                                                strokeWidth={2}
                                            />
                                        </motion.span>
                                    ) : (
                                        <>
                                            {active && (
                                                <motion.span
                                                    animate={{ rotate: 360 }}
                                                    transition={{
                                                        duration: 1.1,
                                                        repeat: Infinity,
                                                        ease: "linear",
                                                    }}
                                                    className="absolute inset-0 rounded-full border border-white/10 border-t-zinc-100"
                                                />
                                            )}
                                            <Icon
                                                className="h-3 w-3"
                                                strokeWidth={1.75}
                                            />
                                        </>
                                    )}
                                </span>
                                <span className="flex-1">{s.label}</span>
                                <span className="text-[11px]">
                                    {done ? "ok" : active ? "…" : "—"}
                                </span>
                            </li>
                        );
                    })}
                </ul>
            </motion.div>
        </div>
    );
}

// ─── Root component ──────────────────────────────────────────────────────────

interface AnalysisPanelProps {
    language: Language;
    onComplete: () => void;
}

export function SampleAnalysisPanel({
    language,
    onComplete, // eslint-disable-line @typescript-eslint/no-unused-vars
}: AnalysisPanelProps) {
    const [status, setStatus] = useState<State>("idle");
    const [analysisStep, setAnalysisStep] = useState(0);

    const abortRef = useRef<AbortController | null>(null);

    // Leaving the panel (tab switch, unmount) cancels the run and clears its timer.
    useEffect(() => () => abortRef.current?.abort(), []);

    const handleStart = useCallback(async () => {
        abortRef.current?.abort();
        const ctrl = new AbortController();
        abortRef.current = ctrl;
        setStatus("analyzing");
        for (let i = 0; i < ANALYSIS_STEPS.length; i++) {
            setAnalysisStep(i);
            if (!(await wait(620, ctrl.signal))) return; // cancelled
        }
        setStatus("completed");
    }, []);

    const handleReset = useCallback(() => {
        abortRef.current?.abort();
        setAnalysisStep(0);
        setStatus("idle");
    }, []);

    // Keyboard: Enter starts, R re-runs.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const t = e.target as HTMLElement | null;
            if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable))
                return;
            if (e.metaKey || e.ctrlKey || e.altKey) return;
            if (e.key === "Enter" && status === "idle") {
                e.preventDefault();
                handleStart();
            } else if ((e.key === "r" || e.key === "R") && status === "completed") {
                handleReset();
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [status, handleStart, handleReset]);

    return (
        <MotionConfig reducedMotion="user">
            <div
                className="relative h-full min-h-0 w-full overflow-hidden bg-primary-background text-zinc-100 antialiased"
                style={{
                    fontFamily:
                        "var(--font-geist-sans), ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
                }}
            >
                <AnimatePresence mode="wait">
                    {status === "idle" && (
                        <motion.div
                            key="idle"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.25 }}
                            className="h-full"
                        >
                            <IdleScreen onStart={handleStart} />
                        </motion.div>
                    )}

                    {status === "analyzing" && (
                        <motion.div
                            key="analyzing"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.25 }}
                            className="h-full"
                        >
                            <AnalyzingScreen step={analysisStep} />
                        </motion.div>
                    )}

                    {status === "completed" && (
                        <motion.div
                            key="completed"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.3 }}
                            className="h-full"
                        >
                            <ResultsScreen language={language} result={codeAnalysis[language].result} sample onReset={handleReset} />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </MotionConfig>
    );
}

