/** Shared contracts for the unified visualizer. Pure types: no DOM, no React. */

export type Primitive = string | number | boolean | null;

/** Coarse shape of one operation argument. Engines still do their own value-level validation. */
export type ArgKind = "primitive" | "primitiveArray" | "integer" | "number" | "string" | "boolean" | "enum" | "json";

export interface ArgMeta {
    readonly name: string;
    readonly optional: boolean;
    readonly kind: ArgKind;
    /** Allowed values when `kind` is "enum". */
    readonly values?: readonly string[];
    /** The argument names a structure (e.g. `arr`). The compiler fills it in with the instance id. */
    readonly ref?: boolean;
}

export interface OpMeta {
    readonly name: string;
    readonly args: readonly ArgMeta[];
    /** Conceptual cost, shown as teaching text. */
    readonly complexity?: string;
}

export type RawOp = { readonly type: string } & Readonly<Record<string, unknown>>;

export interface Explain {
    ran: string;
    affected: string;
    changed: string;
    unchanged: string;
}

/** What every engine returns. The lab-specific `anim` stays opaque until the renderers need it. */
export interface AnyOutcome<S = unknown> {
    ok: boolean;
    /** Same reference as the input state when nothing changed. */
    state: S;
    explain: Explain;
    anim: { kind: string };
    result?: { label: string; value: unknown };
    error?: string;
}

export interface Refs {
    /** Field names that hold the id of the structure an op acts on (`arr`, `list`...). */
    readonly single: readonly string[];
    /** The two fields of an op that connects two structures, if the family has one. */
    readonly pair: readonly [string, string] | null;
}

/** A thin, typed seam around one pure engine. */
export interface AnyAdapter {
    readonly family: "array" | "linear" | "linkedlist" | "tree" | "hash" | "graph";
    readonly ops: Readonly<Record<string, OpMeta>>;
    readonly refs: Refs;
    /** `self` is the id of the instance the op runs on. */
    apply(state: unknown, op: RawOp, self: string): AnyOutcome;
}

/** A data structure a script can name with `ds`. */
export interface DsType {
    readonly name: string;
    readonly label: string;
    readonly aliases: readonly string[];
    readonly adapter: AnyAdapter;
    /** Operations of the shared adapter that do not belong to this structure (a stack has no `enqueue`). */
    readonly hiddenOps?: readonly string[];
    /** A new EMPTY structure. Scripts never depend on starter data. */
    create(): unknown;
}

export interface Diagnostic {
    severity: "error" | "warning" | "info";
    message: string;
    /** 1-based, matches Monaco. */
    line: number;
    column: number;
    endLine: number;
    endColumn: number;
    /** Replace the text of this diagnostic's range with `replacement`. */
    fix?: { label: string; replacement: string };
}
