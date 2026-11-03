import { OP_ARGS } from "../opMeta.generated";
import type { AnyAdapter, AnyOutcome, ArgMeta, OpMeta, RawOp, Refs } from "../types";

type Family = AnyAdapter["family"];

/** Joins the generated argument metadata with each lab's complexity text. */
export function makeOps(family: Family, complexity: Readonly<Record<string, string>>, refs: Refs): Readonly<Record<string, OpMeta>> {
    const refNames = new Set<string>([...refs.single, ...(refs.pair ?? [])]);
    const ops: Record<string, OpMeta> = {};
    for (const [name, args] of Object.entries(OP_ARGS[family])) {
        const marked: ArgMeta[] = args.map((a) => (refNames.has(a.name) ? { ...a, optional: true, ref: true } : a));
        ops[name] = { name, args: marked, complexity: complexity[name] };
    }
    return ops;
}

type Apply<S, O> = (state: S, op: O, self: string) => AnyOutcome<S>;

/**
 * Wraps a typed engine for the registry. The compiler has already checked the op against `ops`,
 * so the casts here only cross the typed/untyped boundary, they do not hide unchecked input.
 */
export function makeAdapter<S, O>(family: Family, refs: Refs, complexity: Readonly<Record<string, string>>, apply: Apply<S, O>): AnyAdapter {
    return {
        family,
        refs,
        ops: makeOps(family, complexity, refs),
        apply: (state: unknown, op: RawOp, self: string) => apply(state as S, op as unknown as O, self) as AnyOutcome,
    };
}
