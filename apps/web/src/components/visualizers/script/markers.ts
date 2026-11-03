import type { Diagnostic } from "../core/types";

/** Monaco's MarkerSeverity values, kept here so this file needs no editor import. */
const SEVERITY = { info: 2, warning: 4, error: 8 } as const;

export interface MarkerData {
    severity: 2 | 4 | 8;
    message: string;
    startLineNumber: number;
    startColumn: number;
    endLineNumber: number;
    endColumn: number;
    source: string;
}

export function toMarkers(diagnostics: readonly Diagnostic[]): MarkerData[] {
    return diagnostics.map((d) => ({
        severity: SEVERITY[d.severity],
        message: d.message,
        startLineNumber: d.line,
        startColumn: d.column,
        endLineNumber: d.endLine,
        // Monaco hides a zero-width marker, so always cover at least one character.
        endColumn: d.endLine === d.line && d.endColumn <= d.column ? d.column + 1 : d.endColumn,
        source: "AlgoForge",
    }));
}

export function countBySeverity(diagnostics: readonly Diagnostic[]): { errors: number; warnings: number } {
    let errors = 0;
    let warnings = 0;
    for (const d of diagnostics) {
        if (d.severity === "error") errors++;
        else if (d.severity === "warning") warnings++;
    }
    return { errors, warnings };
}
