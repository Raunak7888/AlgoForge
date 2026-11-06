import { LIMITS as CONTRACT_LIMITS } from "@algoforge/contracts/src/limits";
import type { Diagnostic } from "./core/types";
import { compileScript } from "./script/compile";

/** Bump when the script format changes in a way old stored scripts cannot be read. */
export const SCRIPT_SCHEMA_VERSION = 1;
/** Same number the API validators and the capabilities endpoint use. */
export const MAX_SCRIPT_CHARS: number = CONTRACT_LIMITS.script.maxChars;

export interface ScriptStructure {
  id: string;
  ds: string;
  label: string;
}

export interface ScriptAnalysis {
  /** False when there is at least one error. A rejected operation is only a warning. */
  ok: boolean;
  stepCount: number;
  structures: ScriptStructure[];
  diagnostics: Diagnostic[];
}

/** Compile a script and summarize it. A script with no steps is not storable, so it is an error here. */
export function analyzeScript(text: string): ScriptAnalysis {
  const compiled = compileScript(text);
  const diagnostics: Diagnostic[] = [...compiled.diagnostics];
  if (compiled.ok && compiled.frames.length === 0) {
    diagnostics.push({
      severity: "error",
      message: "The script has no steps. Add at least one operation.",
      line: 1,
      column: 1,
      endLine: 1,
      endColumn: 2,
    });
  }
  return {
    ok: !diagnostics.some((d) => d.severity === "error"),
    stepCount: compiled.frames.length,
    structures: compiled.instances.map((i) => ({ id: i.id, ds: i.ds, label: i.label })),
    diagnostics,
  };
}
