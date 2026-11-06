import { create } from "zustand";
import type { AnalysisLanguage, AnalysisResult, ErrorCode } from "@algoforge/contracts";

/**
 * The one place that holds what the person is working on: the language, the code of each language,
 * and the state of the current analysis. The editor, the analysis panel, the history and the AI
 * drawer all read it, so they can never disagree.
 */
export const STARTER_CODE: Record<AnalysisLanguage, string> = {
  javascript: `function binarySearch(arr, target) {
  let lo = 0, hi = arr.length - 1;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (arr[mid] === target) return mid;
    if (arr[mid] < target) lo = mid + 1;
    else hi = mid - 1;
  }
  return -1;
}
`,
  python: `def binary_search(arr, target):
    lo, hi = 0, len(arr) - 1
    while lo <= hi:
        mid = (lo + hi) // 2
        if arr[mid] == target:
            return mid
        if arr[mid] < target:
            lo = mid + 1
        else:
            hi = mid - 1
    return -1
`,
};

export type RunStatus = "idle" | "running" | "completed" | "error";

export interface RunState {
  status: RunStatus;
  analysisId: string | null;
  language: AnalysisLanguage | null;
  title: string | null;
  result: AnalysisResult | null;
  /** A stored analysis whose result can no longer be displayed (its code is still restored). */
  unreadable: boolean;
  error: string | null;
  errorCode: ErrorCode | null;
  /** Epoch ms after which trying again can work (quota windows). */
  retryAt: number | null;
  startedAt: number | null;
}

export const IDLE_RUN: RunState = {
  status: "idle",
  analysisId: null,
  language: null,
  title: null,
  result: null,
  unreadable: false,
  error: null,
  errorCode: null,
  retryAt: null,
  startedAt: null,
};

export interface RunFailure {
  message: string;
  code: ErrorCode | null;
  retryAt: number | null;
}

export interface OpenedAnalysis {
  id: string;
  code: string;
  language: AnalysisLanguage;
  result: AnalysisResult | null;
  title: string | null;
}

export interface WorkspaceStore {
  language: AnalysisLanguage;
  codes: Record<AnalysisLanguage, string>;
  run: RunState;
  /** The analysis id that /dashboard/[id] last restored. Unlike run.analysisId it survives new runs. */
  lastOpenedId: string | null;

  setCode: (code: string) => void;
  setLanguage: (language: AnalysisLanguage) => void;
  openAnalysis: (analysis: OpenedAnalysis) => void;
  startRun: () => void;
  finishRun: (done: Omit<OpenedAnalysis, "code">) => void;
  failRun: (failure: RunFailure) => void;
  resetRun: () => void;
  forgetAnalysis: (id: string) => void;
  reset: () => void;
}

const initial = () => ({
  language: "javascript" as AnalysisLanguage,
  codes: { ...STARTER_CODE },
  run: IDLE_RUN,
  lastOpenedId: null as string | null,
});

const completed = (a: Omit<OpenedAnalysis, "code">): RunState => ({
  ...IDLE_RUN,
  status: "completed",
  analysisId: a.id,
  language: a.language,
  title: a.title,
  result: a.result,
  unreadable: a.result === null,
});

export const useWorkspace = create<WorkspaceStore>()((set) => ({
  ...initial(),

  setCode: (code) => set((s) => ({ codes: { ...s.codes, [s.language]: code } })),
  setLanguage: (language) => set({ language }),

  openAnalysis: (a) =>
    set((s) => ({
      language: a.language,
      codes: { ...s.codes, [a.language]: a.code },
      lastOpenedId: a.id,
      run: completed(a),
    })),

  startRun: () => set((s) => ({ run: { ...IDLE_RUN, status: "running", language: s.language, startedAt: Date.now() } })),
  finishRun: (done) => set({ run: completed(done) }),
  failRun: (failure) =>
    set((s) => ({ run: { ...IDLE_RUN, status: "error", language: s.run.language, error: failure.message, errorCode: failure.code, retryAt: failure.retryAt } })),
  resetRun: () => set({ run: IDLE_RUN }),

  forgetAnalysis: (id) =>
    set((s) => {
      const patch: Partial<WorkspaceStore> = {};
      if (s.run.analysisId === id) patch.run = IDLE_RUN;
      if (s.lastOpenedId === id) patch.lastOpenedId = null;
      return patch;
    }),

  reset: () => set(initial()),
}));
