"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { checkRunnableCode, countLines, LIMITS } from "@algoforge/contracts";
import { FeatureGate } from "@/components/auth/FeatureGate";
import { btn, btnPrimary } from "@/components/visualizers/shared/styles";
import { useAnalysisQuota, useCapabilities } from "@/lib/query";
import { runAnalysis } from "@/lib/workspace/analysis-run";
import { useWorkspace } from "@/lib/workspace/store";
import { ANALYSIS_COPY, ResultsScreen, SampleAnalysisPanel } from "./Analysis";

const LANGUAGE_LABEL = { javascript: "JavaScript", python: "Python" } as const;
const noop = () => {};

function useNow(active: boolean): number {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        if (!active) return;
        const id = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(id);
    }, [active]);
    return now;
}

function timeOf(iso: string): string {
    return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function RealAnalysisPanel() {
    const queryClient = useQueryClient();
    const capabilities = useCapabilities();
    const quota = useAnalysisQuota();
    const language = useWorkspace((s) => s.language);
    const code = useWorkspace((s) => s.codes[s.language]);
    const run = useWorkspace((s) => s.run);
    const resetRun = useWorkspace((s) => s.resetRun);

    const running = run.status === "running";
    const minuteUsedUp = quota.data ? quota.data.minute.remaining <= 0 : false;
    const now = useNow(running || minuteUsedUp || run.retryAt !== null);

    if (run.status === "completed") {
        if (run.result && run.language) {
            return <ResultsScreen language={run.language} result={run.result} resetLabel="Analyze again" onReset={resetRun} />;
        }
        return (
            <div role="status" className="flex h-full items-center justify-center bg-primary-background p-8 text-center">
                <div className="flex max-w-sm flex-col items-center gap-3">
                    <h2 className="text-lg font-semibold tracking-tight text-zinc-100">This result can no longer be shown</h2>
                    <p className="text-sm leading-relaxed text-zinc-400">
                        It was saved in an older or newer format than this version understands. Your code was restored in the editor, so you can analyze it again.
                    </p>
                    <button type="button" className={btn} onClick={resetRun}>
                        Back
                    </button>
                </div>
            </div>
        );
    }

    const maxChars = capabilities.data?.limits.codeMaxChars ?? LIMITS.code.maxChars;
    const lines = countLines(code);

    const runCheck = checkRunnableCode(code);
    let blocked: string | null = null;
    if (!runCheck.ok) blocked = runCheck.message;
    else if (code.length > maxChars) blocked = `The code is ${code.length.toLocaleString()} characters; the limit is ${maxChars.toLocaleString()}.`;
    else if (quota.data && quota.data.day.remaining <= 0) blocked = `Daily limit reached. You can analyze again at ${timeOf(quota.data.day.resetAt)}.`;
    else if (quota.data && minuteUsedUp && Date.parse(quota.data.minute.resetAt) > now)
        blocked = `Per-minute limit reached. Try again in ${Math.max(1, Math.ceil((Date.parse(quota.data.minute.resetAt) - now) / 1000))}s.`;

    const elapsed = run.startedAt ? Math.max(0, Math.floor((now - run.startedAt) / 1000)) : 0;
    const retryIn = run.retryAt !== null ? Math.max(0, Math.ceil((run.retryAt - now) / 1000)) : null;

    return (
        <div className="flex h-full w-full items-center justify-center bg-primary-background p-6 text-zinc-100">
            <div className="flex w-full max-w-md flex-col gap-5">
                <div className="flex flex-col gap-2">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-zinc-900">
                        <Zap className="h-4 w-4" strokeWidth={1.5} aria-hidden />
                    </span>
                    <h2 className="text-xl font-semibold tracking-tight">Analyze your code</h2>
                    <p className="font-mono text-xs text-zinc-400">
                        {LANGUAGE_LABEL[language]} · {lines} / {LIMITS.code.runMaxLines} lines · {runCheck.chars.toLocaleString()} / {LIMITS.code.runMaxChars.toLocaleString()} characters
                    </p>
                </div>

                {running ? (
                    <div role="status" aria-busy className="flex flex-col gap-2 rounded-xl border border-white/8 bg-zinc-900/40 p-4">
                        <p className="text-sm">Analyzing… {elapsed}s</p>
                        <div className="h-1 overflow-hidden rounded bg-white/10">
                            <div className="h-full w-1/3 animate-pulse rounded bg-zinc-100" />
                        </div>
                        <p className="text-xs leading-relaxed text-zinc-400">This can take up to a minute. You can switch tabs: the result will be here when you come back.</p>
                    </div>
                ) : (
                    <>
                        {run.status === "error" && run.error && (
                            <p role="alert" className="rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-xs leading-relaxed text-red-200">
                                {run.error}
                                {retryIn !== null && retryIn > 0 && run.errorCode === "QUOTA_EXCEEDED" ? ` (${retryIn}s)` : ""}
                            </p>
                        )}
                        <div className="flex flex-col gap-2">
                            <button type="button" className={btnPrimary} disabled={blocked !== null} onClick={() => void runAnalysis(queryClient)}>
                                Analyze
                            </button>
                            {blocked && <p className="text-xs text-zinc-400">{blocked}</p>}
                        </div>
                    </>
                )}

                {quota.data && (
                    <p className="font-mono text-[11px] text-zinc-500" data-testid="quota-line">
                        Today: {quota.data.day.remaining} of {quota.data.day.limit} left · This minute: {quota.data.minute.remaining} of {quota.data.minute.limit} left
                    </p>
                )}
                <p className="text-[11px] leading-relaxed text-zinc-500">Repeating an analysis of the same code is free: it comes from cache and does not use your quota.</p>
            </div>
        </div>
    );
}

/**
 * Real analysis needs an account and a connected engine. The server's capabilities decide what is shown;
 * the fixed sample report appears only in development, and only when the server offers nothing.
 */
export default function AnalysisFeature() {
    const language = useWorkspace((s) => s.language);
    return <FeatureGate feature="analysis" copy={ANALYSIS_COPY} preview={<SampleAnalysisPanel language={language} onComplete={noop} />} ready={<RealAnalysisPanel />} />;
}
