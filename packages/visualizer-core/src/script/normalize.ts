import { INSTANCE_ID_RE } from "../core/ids";
import type { Diagnostic } from "../core/types";
import { didYouMean } from "./suggest";
import { LineIndex, setOwn, toValue, type JNode, type JObject, type Span } from "./parse";

export const MAX_MESSAGE_LENGTH = 500;
const MAX_STEP = 1_000_000;

export interface ArgEntry {
    value: unknown;
    keySpan: Span;
    valueSpan: Span;
}

export interface Entry {
    /** Position in the source array. */
    index: number;
    span: Span;
    kind: "op" | "message";
    step?: number;
    stepSpan?: Span;
    id?: string;
    idSpan?: Span;
    ds?: string;
    dsSpan?: Span;
    op?: string;
    opSpan?: Span;
    message?: string;
    messageSpan?: Span;
    at?: { x: number; y: number };
    /** Every key that is not part of the script grammar: the operation's own arguments. */
    args: Record<string, ArgEntry>;
    /** True when the entry's own fields were malformed. The compiler skips it. */
    invalid: boolean;
}

export interface Options {
    onError: "continue" | "halt";
}
export const DEFAULT_OPTIONS: Options = { onError: "continue" };

export interface Normalized {
    entries: Entry[];
    options: Options;
    diagnostics: Diagnostic[];
}

/** The script grammar. Everything else is an operation argument. */
type Slot = "step" | "id" | "ds" | "op" | "message" | "at";
const CANONICAL = new Map<string, Slot>([
    ["step", "step"],
    ["id", "id"],
    ["ds", "ds"],
    ["dsname", "ds"],
    ["op", "op"],
    ["operationname", "op"],
    ["operation", "op"],
    ["message", "message"],
    ["msg", "message"],
    ["at", "at"],
]);
const GRAMMAR_KEYS = [...CANONICAL.keys()];

export function normalize(root: JNode, lines: LineIndex): Normalized {
    const diagnostics: Diagnostic[] = [];
    const err = (span: Span, message: string, fix?: Diagnostic["fix"]) => diagnostics.push(lines.diagnostic(span, "error", message, fix));
    const options: Options = { ...DEFAULT_OPTIONS };

    let list: JNode | undefined;
    if (root.kind === "array") {
        list = root;
    } else if (root.kind === "object") {
        for (const p of root.props) {
            if (p.key === "script" || p.key === "steps") {
                if (list) err(p.keySpan, `Only one of "script" or "steps" is allowed.`);
                else list = p.value;
            } else if (p.key === "onError") {
                const v = p.value.kind === "string" ? p.value.value : undefined;
                if (v === "continue" || v === "halt") options.onError = v;
                else err(p.value.span, `"onError" must be "continue" or "halt".`);
            } else {
                diagnostics.push(lines.diagnostic(p.keySpan, "warning", `Unknown option "${p.key}" was ignored.${didYouMean(p.key, ["script", "onError"])}`));
            }
        }
        if (!list) err(root.span, 'An object script needs a "script" array of steps.');
    } else {
        err(root.span, "A script is a JSON array of steps, for example [ { \"step\": 1, ... } ].");
    }
    if (!list) return { entries: [], options, diagnostics };
    if (list.kind !== "array") {
        err(list.span, '"script" must be an array of steps.');
        return { entries: [], options, diagnostics };
    }

    const entries: Entry[] = [];
    list.items.forEach((item, index) => {
        if (item.kind !== "object") {
            err(item.span, "Each step must be an object, for example { \"step\": 1, \"id\": \"A\", \"op\": \"append\", \"value\": 5 }.");
            return;
        }
        entries.push(readEntry(item, index, lines, diagnostics));
    });
    return { entries, options, diagnostics };
}

function readEntry(obj: JObject, index: number, lines: LineIndex, diagnostics: Diagnostic[]): Entry {
    const entry: Entry = { index, span: obj.span, kind: "op", args: {}, invalid: false };
    const bad = (span: Span, message: string, fix?: Diagnostic["fix"]) => {
        entry.invalid = true;
        diagnostics.push(lines.diagnostic(span, "error", message, fix));
    };
    const seen = new Map<string, string>(); // canonical -> key as written
    const seenArgs = new Set<string>();

    for (const p of obj.props) {
        const slot = CANONICAL.get(p.key);
        if (!slot) {
            if (seenArgs.has(p.key)) bad(p.keySpan, `Duplicate key "${p.key}".`);
            seenArgs.add(p.key);
            setOwn(entry.args, p.key, { value: toValue(p.value), keySpan: p.keySpan, valueSpan: p.value.span } satisfies ArgEntry);
            continue;
        }
        const prior = seen.get(slot);
        if (prior !== undefined) {
            bad(p.keySpan, prior === p.key ? `Duplicate key "${p.key}".` : `"${p.key}" and "${prior}" mean the same thing. Use only one.`);
            continue;
        }
        seen.set(slot, p.key);
        const v = p.value;
        switch (slot) {
            case "step":
                if (v.kind === "number" && Number.isInteger(v.value) && v.value >= 0 && v.value <= MAX_STEP) {
                    entry.step = v.value;
                    entry.stepSpan = v.span;
                } else bad(v.span, `"step" must be a whole number, 0 or greater.`);
                break;
            case "id":
                if (v.kind === "string" && INSTANCE_ID_RE.test(v.value)) {
                    entry.id = v.value;
                    entry.idSpan = v.span;
                } else bad(v.span, `"id" must start with a letter and use only letters, digits, _ or - (at most 16 characters).`);
                break;
            case "ds":
                if (v.kind === "string" && v.value.trim() !== "") {
                    entry.ds = v.value;
                    entry.dsSpan = v.span;
                } else bad(v.span, `"${p.key}" must be the name of a data structure, for example "array".`);
                break;
            case "op":
                if (v.kind === "string" && v.value.trim() !== "") {
                    entry.op = v.value;
                    entry.opSpan = v.span;
                } else bad(v.span, `"${p.key}" must be the name of an operation, for example "append".`);
                break;
            case "message":
                if (v.kind !== "string") bad(v.span, `"${p.key}" must be text.`);
                else if (v.value.length > MAX_MESSAGE_LENGTH) bad(v.span, `A message can have at most ${MAX_MESSAGE_LENGTH} characters.`);
                else {
                    entry.message = v.value;
                    entry.messageSpan = v.span;
                }
                break;
            case "at": {
                const x = v.kind === "object" ? v.props.find((q) => q.key === "x")?.value : undefined;
                const y = v.kind === "object" ? v.props.find((q) => q.key === "y")?.value : undefined;
                if (v.kind === "object" && x?.kind === "number" && y?.kind === "number" && v.props.length === 2) entry.at = { x: x.value, y: y.value };
                else bad(v.span, `"at" must look like { "x": 40, "y": 300 }.`);
                break;
            }
        }
    }

    const hasMessage = seen.has("message");
    const hasOp = seen.has("op");
    if (hasMessage) {
        entry.kind = "message";
        if (hasOp || seen.has("ds") || seen.has("id") || seen.has("at") || Object.keys(entry.args).length > 0)
            bad(obj.span, `A message entry can only have "message" and "step". Put operations in their own entry.`);
    } else if (!hasOp && !entry.invalid) {
        const first = obj.props[0];
        bad(first ? first.keySpan : obj.span, `This step needs an "op" (an operation like "append") or a "message".${didYouMean(first?.key ?? "", GRAMMAR_KEYS)}`);
    }
    return entry;
}
