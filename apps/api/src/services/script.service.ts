import type { ErrorDetail } from "@algoforge/contracts";
import { analyzeScript, type ScriptAnalysis } from "@algoforge/visualizer-core";
import { AppError } from "../utils/app-error";

const MAX_DETAILS = 20;

/** Compile a script with the same compiler the browser uses. Never throws. */
export function checkScript(text: string): ScriptAnalysis {
  return analyzeScript(text);
}

/** Throws a 400 with line numbers when the script has errors. Warnings (rejected operations) are allowed. */
export function assertValidScript(text: string): ScriptAnalysis {
  const analysis = analyzeScript(text);
  if (analysis.ok) return analysis;
  const errors = analysis.diagnostics.filter((d) => d.severity === "error");
  const details: ErrorDetail[] = errors.slice(0, MAX_DETAILS).map((d) => ({
    path: `script:${d.line}:${d.column}`,
    message: d.message,
  }));
  const first = errors[0];
  throw AppError.badRequest(first ? `Invalid script: ${first.message}` : "Invalid script.", details);
}
