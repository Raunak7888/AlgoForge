// Phase 0b: frontend side of the code-size gate (editor, analysis, visualizer).
"use client";

import { useMemo } from "react";
import { checkRunnableCode, LIMITS, type CodeCheck } from "@algoforge/contracts";
import { useWorkspace } from "./store";

export interface CodeLimitsState {
  check: CodeCheck;
  maxLines: number;
  maxChars: number;
}

/** Live size check of the code in the editor. The API enforces the same limits with the same function. */
export function useCodeLimits(): CodeLimitsState {
  const code = useWorkspace((s) => s.codes[s.language]);
  return useMemo(
    () => ({ check: checkRunnableCode(code), maxLines: LIMITS.code.runMaxLines, maxChars: LIMITS.code.runMaxChars }),
    [code],
  );
}
