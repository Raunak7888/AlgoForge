import { INSTANCE_ID_RE } from "../core/ids";
import { DS_NAMES, findDsType, opsOf } from "../core/registry";
import { isPrimitive } from "../core/validate";
import type { AnyOutcome, ArgMeta, Diagnostic, DsType, OpMeta, RawOp } from "../core/types";
import { normalize, DEFAULT_OPTIONS, type ArgEntry, type Entry, type Options } from "./normalize";
import { LineIndex, parseJson, type Span } from "./parse";
import { didYouMean, closest } from "./suggest";

export const LIMITS = {
    chars: 1_000_000,
    entries: 5_000,
    instances: 12,
    steps: 2_000,
    beatsPerStep: 20,
} as const;

/** One engine call. Beats of different instances in the same frame animate together. */
export interface Beat {
    instance: string;
    /** Index of the script entry that produced it (for pointing back at the source). */
    entry: number;
    op: RawOp;
    outcome: AnyOutcome;
}

export interface Frame {
    /** 0-based position on the transport. */
    index: number;
    /** The script's own `step` number. */
    step: number;
    beats: Beat[];
    messages: string[];
    /** instance id -> state AFTER this frame. Untouched instances share references with the previous frame. */
    snapshot: Readonly<Record<string, unknown>>;
    /** At least one operation was rejected by its engine. */
    failed: boolean;
}

export interface InstanceMeta {
    id: string;
    ds: string;
    label: string;
    family: string;
    /** Frame where the instance first appears. */
    firstFrame: number;
    at?: { x: number; y: number };
}

export interface Compiled {
    /** False when the script has errors. Rejected operations are only warnings. */
    ok: boolean;
    frames: Frame[];
    instances: InstanceMeta[];
    diagnostics: Diagnostic[];
    options: Options;
}

interface Inst {
    id: string;
    ds: DsType;
    state: unknown;
    meta: InstanceMeta;
}

const list = (xs: readonly string[]) => xs.map((x) => `"${x}"`).join(", ");
const quote = (s: string) => JSON.stringify(s);

/** A coarse shape check. Value-level problems (index out of range...) are left to the engines, which explain them better. */
function checkArg(a: ArgMeta, v: unknown): string | null {
    switch (a.kind) {
        case "primitive":
            return isPrimitive(v) ? null : `"${a.name}" must be a string, number, boolean or null.`;
        case "primitiveArray":
            return Array.isArray(v) && v.every(isPrimitive) ? null : `"${a.name}" must be a list of strings, numbers, booleans or null.`;
        case "integer":
        case "number":
            return typeof v === "number" && Number.isFinite(v) ? null : `"${a.name}" must be a number.`;
        case "string":
            return typeof v === "string" ? null : `"${a.name}" must be text in double quotes.`;
        case "boolean":
            return typeof v === "boolean" ? null : `"${a.name}" must be true or false.`;
        case "enum":
            return typeof v === "string" && a.values?.includes(v) ? null : `"${a.name}" must be one of ${list(a.values ?? [])}.${typeof v === "string" ? didYouMean(v, a.values ?? []) : ""}`;
        case "json":
            return null;
    }
}

export function compileScript(text: string): Compiled {
    const lines = new LineIndex(text);
    const diagnostics: Diagnostic[] = [];
    const add = (span: Span, severity: Diagnostic["severity"], message: string, fix?: Diagnostic["fix"]) => diagnostics.push(lines.diagnostic(span, severity, message, fix));
    const fail = (options: Options = DEFAULT_OPTIONS): Compiled => ({ ok: false, frames: [], instances: [], diagnostics, options });

    if (text.length > LIMITS.chars) {
        add({ start: 0, end: 1 }, "error", `The script is ${text.length.toLocaleString("en-US")} characters; the limit is ${LIMITS.chars.toLocaleString("en-US")}.`);
        return fail();
    }
    const parsed = parseJson(text);
    if (!parsed.ok) {
        add(parsed.span, "error", parsed.message);
        return fail();
    }
    const norm = normalize(parsed.root, lines);
    diagnostics.push(...norm.diagnostics);
    const { entries, options } = norm;
    if (entries.length > LIMITS.entries) {
        add(parsed.root.span, "error", `The script has ${entries.length} entries; the limit is ${LIMITS.entries}.`);
        return fail(options);
    }

    /* ── bind every entry to a step ── */
    const groups = new Map<number, Entry[]>();
    const put = (step: number, e: Entry) => {
        const g = groups.get(step);
        if (g) g.push(e);
        else groups.set(step, [e]);
    };
    const orphans: Entry[] = [];
    let lastStep: number | undefined;
    for (const e of entries) {
        if (e.invalid) continue;
        if (e.step !== undefined) lastStep = e.step;
        if (e.step !== undefined) put(e.step, e);
        else if (e.kind === "message") {
            if (lastStep !== undefined) put(lastStep, e);
            else orphans.push(e);
        } else add(e.span, "error", `This operation needs a "step" number, for example "step": 1.`);
    }
    const steps = [...groups.keys()].sort((a, b) => a - b);
    for (const o of orphans) {
        const first = steps[0];
        if (first === undefined) add(o.span, "error", "This message has no step to attach to.");
        else {
            add(o.span, "warning", `This message comes before any step, so it was attached to step ${first}.`);
            groups.get(first)!.unshift(o);
        }
    }
    if (steps.length > LIMITS.steps) {
        add(parsed.root.span, "error", `The script has ${steps.length} steps; the limit is ${LIMITS.steps}.`);
        return fail(options);
    }

    /* ── run ── */
    const instances = new Map<string, Inst>();
    const frames: Frame[] = [];
    let snapshot: Record<string, unknown> = {};

    function resolve(e: Entry, touched: Record<string, unknown>): Inst | undefined {
        const type = e.ds !== undefined ? findDsType(e.ds) : undefined;
        if (e.ds !== undefined && !type) {
            const c = closest(e.ds, DS_NAMES);
            add(e.dsSpan!, "error", `Unknown data structure "${e.ds}".${c ? ` Did you mean "${c}"?` : ` Use one of ${list(DS_NAMES.slice(0, 11))}.`}`, c ? { label: `Change to "${c}"`, replacement: quote(c) } : undefined);
            return undefined;
        }
        const id = e.id ?? (type ? `${type.name}1` : undefined);
        if (id === undefined) {
            if (instances.size === 1) return [...instances.values()][0];
            add(e.span, "error", instances.size === 0 ? `Name the structure with "ds" (for example "array") and, optionally, "id".` : `Which structure? Add an "id" (${list([...instances.keys()])}).`);
            return undefined;
        }
        if (!INSTANCE_ID_RE.test(id)) {
            add(e.dsSpan ?? e.span, "error", `"${id}" is not a valid id. Use a letter, then letters, digits, _ or - (at most 16 characters).`);
            return undefined;
        }
        const existing = instances.get(id);
        if (existing) {
            if (type && type !== existing.ds) {
                add(e.dsSpan!, "error", `"${id}" is already a ${existing.ds.label}, not a ${type.label}. Use another id for the new structure.`);
                return undefined;
            }
            return existing;
        }
        if (!type) {
            add(e.idSpan ?? e.span, "error", `"${id}" is not defined yet. Create it first by adding "ds" (for example "array") to its first step.`);
            return undefined;
        }
        if (instances.size >= LIMITS.instances) {
            add(e.span, "error", `A script can use at most ${LIMITS.instances} structures.`);
            return undefined;
        }
        const meta: InstanceMeta = { id, ds: type.name, label: type.label, family: type.adapter.family, firstFrame: frames.length, ...(e.at ? { at: e.at } : {}) };
        const inst: Inst = { id, ds: type, state: type.create(), meta };
        instances.set(id, inst);
        touched[id] = inst.state;
        return inst;
    }

    function buildOps(e: Entry, inst: Inst): RawOp[] | undefined {
        const adapter = inst.ds.adapter;
        const op = e.op!;
        const available = opsOf(inst.ds);
        const meta: OpMeta | undefined = Object.prototype.hasOwnProperty.call(available, op) ? available[op] : undefined;
        if (!meta) {
            const c = closest(op, Object.keys(available));
            add(e.opSpan!, "error", `A ${inst.ds.label} has no operation "${op}".${c ? ` Did you mean "${c}"?` : ""}`, c ? { label: `Change to "${c}"`, replacement: quote(c) } : undefined);
            return undefined;
        }
        let ok = true;
        const bad = (span: Span, message: string, fix?: Diagnostic["fix"]) => {
            ok = false;
            add(span, "error", message, fix);
        };
        const given: Record<string, ArgEntry> = { ...e.args };

        // `to` is shorthand for the second structure of an arrow between two structures.
        const pair = adapter.refs.pair;
        const isPairOp = pair !== null && pair.every((n) => meta.args.some((a) => a.name === n));
        let toArg: ArgEntry | undefined;
        if (isPairOp && given.to && !meta.args.some((a) => a.name === "to")) {
            toArg = given.to;
            delete given.to;
        }

        const names = meta.args.map((a) => a.name);
        for (const [key, a] of Object.entries(given)) {
            if (names.includes(key)) continue;
            const c = closest(key, names);
            const expects = names.filter((n) => !meta.args.find((x) => x.name === n)?.ref);
            bad(a.keySpan, `"${op}" does not take "${key}".${c ? ` Did you mean "${c}"?` : expects.length ? ` It takes ${list(expects)}.` : " It takes no arguments."}`, c ? { label: `Change to "${c}"`, replacement: quote(c) } : undefined);
        }

        // `value: [a, b, c]` on an operation that takes only a value means "do it once per value".
        let values: unknown[] | undefined;
        const v = given.value;
        const valueMeta = meta.args.find((a) => a.name === "value" && a.kind === "primitive");
        if (valueMeta && v && Array.isArray(v.value)) {
            if (Object.keys(given).length > 1) bad(v.valueSpan, `A list of values only works for operations that take nothing but a value. Give one value here.`);
            else if (v.value.length === 0) bad(v.valueSpan, `The list of values is empty.`);
            else if (!v.value.every(isPrimitive)) bad(v.valueSpan, `Every value must be a string, number, boolean or null.`);
            else values = v.value;
        }

        for (const a of meta.args) {
            const g = given[a.name];
            if (a.ref) continue;
            if (!g) {
                if (!a.optional) {
                    const missing = meta.args.filter((x) => !x.optional && !given[x.name]).map((x) => x.name);
                    bad(e.opSpan ?? e.span, `"${op}" needs ${list(missing)}.`);
                    break;
                }
                continue;
            }
            if (values && a.name === "value") continue;
            const problem = checkArg(a, g.value);
            if (problem) bad(g.valueSpan, problem);
        }

        // Structure references: filled in with this instance's id. Connecting two structures is not supported yet.
        const notSelf = (span: Span, got: unknown) =>
            bad(span, `Connecting two different structures ("${String(got)}" and "${inst.id}") is not supported yet. Arrows must stay inside one structure.`);
        for (const a of meta.args) {
            if (!a.ref) continue;
            const g = given[a.name];
            if (g) {
                if (g.value !== inst.id) notSelf(g.valueSpan, g.value);
            }
        }
        if (toArg && toArg.value !== inst.id) notSelf(toArg.valueSpan, toArg.value);
        if (!ok) return undefined;

        const build = (value: unknown): RawOp => {
            const o: Record<string, unknown> = { type: op };
            // Canonical key order, so engine call text always reads in the same order.
            for (const a of meta.args) {
                if (a.ref) o[a.name] = inst.id;
                else if (a.name === "value" && values) o[a.name] = value;
                else if (given[a.name]) o[a.name] = given[a.name].value;
            }
            return o as RawOp;
        };
        return values ? values.map((x) => build(x)) : [build(undefined)];
    }

    for (const step of steps) {
        const prev = snapshot;
        const touched: Record<string, unknown> = {};
        const frame: Frame = { index: frames.length, step, beats: [], messages: [], snapshot: prev, failed: false };
        let halted = false;
        let overBudget = false;

        for (const e of groups.get(step)!) {
            if (e.kind === "message") {
                frame.messages.push(e.message!);
                continue;
            }
            const inst = resolve(e, touched);
            if (!inst) continue;
            const ops = buildOps(e, inst);
            if (!ops) continue;
            for (const op of ops) {
                if (frame.beats.length >= LIMITS.beatsPerStep) {
                    if (!overBudget) add(e.span, "error", `Step ${step} has more than ${LIMITS.beatsPerStep} operations. Split it into more steps.`);
                    overBudget = true;
                    break;
                }
                const outcome = inst.ds.adapter.apply(inst.state, op, inst.id);
                inst.state = outcome.state;
                touched[inst.id] = outcome.state;
                frame.beats.push({ instance: inst.id, entry: e.index, op, outcome });
                if (!outcome.ok) {
                    frame.failed = true;
                    add(e.opSpan ?? e.span, "warning", `${outcome.explain.ran} was rejected: ${outcome.error ?? "the engine refused it."}`);
                    if (options.onError === "halt") {
                        halted = true;
                        break;
                    }
                }
            }
            if (halted) break;
        }

        if (Object.keys(touched).length > 0) frame.snapshot = { ...prev, ...touched };
        snapshot = frame.snapshot as Record<string, unknown>;
        frames.push(frame);
        if (halted) {
            const last = frame.beats[frame.beats.length - 1];
            diagnostics.push({ severity: "info", message: `Stopped after step ${step} because "onError" is "halt".`, ...positionOfEntry(lines, entries, last?.entry) });
            break;
        }
    }

    return {
        ok: !diagnostics.some((d) => d.severity === "error"),
        frames,
        instances: [...instances.values()].map((i) => i.meta),
        diagnostics,
        options,
    };
}

function positionOfEntry(lines: LineIndex, entries: Entry[], index: number | undefined) {
    const e = entries.find((x) => x.index === index);
    const d = lines.diagnostic(e ? e.span : { start: 0, end: 1 }, "info", "");
    return { line: d.line, column: d.column, endLine: d.endLine, endColumn: d.endColumn };
}

/** Compile a script that is already a JS value (for example generated by code or an AI). */
export function compileValue(value: unknown): Compiled {
    return compileScript(JSON.stringify(value, null, 2));
}
