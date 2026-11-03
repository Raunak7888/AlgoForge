import { isPrimitive, parseInteger, parseValue, type Parsed } from "../core/validate";
import { MAX_NODES, MAX_PATH } from "./model";
import type { InitSpec, Primitive, Shape, TreeType } from "./types";

/**
 * Validation layer. Everything is parsed with JSON.parse (never eval / Function)
 * and checked BEFORE any state is touched.
 */
export { parseInteger, parseValue, isPrimitive };

const ok = <T,>(value: T): Parsed<T> => ({ ok: true, value });
const fail = (error: string): Parsed<never> => ({ ok: false, error });

export const NAME_RE = /^[A-Za-z0-9_-]{1,12}$/;
export const MARKER_HELP = "Marker ids are 1-12 characters: letters, digits, _ or -.";
export const NODE_ID_HELP = "Node ids look like n1, n2, … (letters, digits, _ or -).";

/** "LLR" → "LLR". Case-insensitive; only L and R are allowed. */
export function parsePath(text: string, allowEmpty = false): Parsed<string> {
    const p = text.trim().toUpperCase();
    if (p === "" && !allowEmpty) return fail('A path needs at least one step, for example "L" or "LLR" (L = left, R = right).');
    if (!/^[LR]*$/.test(p)) return fail('A path may only contain L and R, for example "LLR".');
    if (p.length > MAX_PATH) return fail(`A path can have at most ${MAX_PATH} steps.`);
    return ok(p);
}

function countShape(sh: Shape | null): number {
    return sh ? 1 + countShape(sh.left) + countShape(sh.right) : 0;
}
function toShape(v: unknown, depth: number, where: string): Parsed<Shape | null> {
    if (v === null || v === undefined) return ok(null);
    if (typeof v !== "object" || Array.isArray(v)) return fail(`${where} must be an object like {"value": 1, "left": …, "right": …} or null.`);
    const o = v as Record<string, unknown>;
    for (const k of Object.keys(o)) if (!["value", "left", "right"].includes(k)) return fail(`${where} has an unknown key "${k}". Use value, left and right.`);
    if (!("value" in o)) return fail(`${where} needs a "value".`);
    if (!isPrimitive(o.value)) return fail(`${where}.value must be a string, number, boolean or null.`);
    if (depth > MAX_NODES) return fail("That tree is too deep.");
    const l = toShape(o.left, depth + 1, `${where}.left`);
    if (!l.ok) return l;
    const r = toShape(o.right, depth + 1, `${where}.right`);
    if (!r.ok) return r;
    return ok({ value: o.value, left: l.value, right: r.value });
}

/**
 * An object is an exact shape:  {"value": 10, "left": {"value": 5}, "right": {"value": 15}}
 * An array is a list of values:  Binary tree = placed level by level;  BST = inserted one by one.
 */
export function parseInitial(type: TreeType, text: string): Parsed<InitSpec> {
    void type;
    let v: unknown;
    try {
        v = JSON.parse(text);
    } catch {
        return fail('Invalid JSON. Example: [10, 5, 15] or {"value": 10, "left": {"value": 5}}');
    }
    if (Array.isArray(v)) {
        if (v.length > MAX_NODES) return fail(`At most ${MAX_NODES} nodes are supported.`);
        if (!v.every(isPrimitive)) return fail("Values must be strings, numbers, booleans or null.");
        return ok({ kind: "values", values: v as Primitive[] });
    }
    if (v === null) return ok({ kind: "shape", root: null });
    if (typeof v === "object") {
        const sh = toShape(v, 0, "root");
        if (!sh.ok) return sh;
        if (countShape(sh.value) > MAX_NODES) return fail(`At most ${MAX_NODES} nodes are supported.`);
        return ok({ kind: "shape", root: sh.value });
    }
    return fail("The value must be a JSON array of values or an object describing the tree.");
}
