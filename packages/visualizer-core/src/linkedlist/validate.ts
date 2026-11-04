import { isPrimitive, parseInteger, parseValue, type Parsed } from "../core/validate";
import { MAX_NODES } from "./model";
import type { Primitive } from "./types";

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

export function parseOptionalInt(text: string, label = "index"): Parsed<number | undefined> {
    return text.trim() === "" ? ok(undefined) : parseInteger(text, label);
}

export function parseInitial(text: string): Parsed<Primitive[]> {
    let v: unknown;
    try {
        v = JSON.parse(text);
    } catch {
        return fail('Invalid JSON. Example: [10, "two", null, true]');
    }
    if (!Array.isArray(v)) return fail("The value must be a JSON array.");
    if (v.length > MAX_NODES) return fail(`At most ${MAX_NODES} nodes are supported.`);
    if (!v.every(isPrimitive)) return fail("Values must be strings, numbers, booleans or null.");
    return ok(v);
}
