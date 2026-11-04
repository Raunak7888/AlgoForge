import { isPrimitive, parseInteger, parseValue, type Parsed } from "../core/validate";
import { MAX_ITEMS } from "./model";
import type { Primitive } from "./types";

/**
 * Validation layer. Everything is parsed with JSON.parse (never eval / Function)
 * and checked BEFORE any state is touched.
 */
export { parseValue, isPrimitive };

const ok = <T,>(value: T): Parsed<T> => ({ ok: true, value });
const fail = (error: string): Parsed<never> => ({ ok: false, error });

export const MARK_ID_RE = /^[A-Za-z0-9_-]{1,12}$/;
export const MARK_ID_HELP = "Mark ids are 1-12 characters: letters, digits, _ or -.";

/** Blank means "the peek end" (top / front). */
export function parseOptionalIndex(text: string): Parsed<number | undefined> {
    if (text.trim() === "") return ok(undefined);
    return parseInteger(text, "position");
}

/** JSON array of primitives, oldest element first (bottom of a stack / front of a queue). */
export function parseInitial(text: string): Parsed<Primitive[]> {
    let v: unknown;
    try {
        v = JSON.parse(text);
    } catch {
        return fail('Invalid JSON. Example: [10, "two", null, true]');
    }
    if (!Array.isArray(v)) return fail("The value must be a JSON array.");
    if (v.length > MAX_ITEMS) return fail(`At most ${MAX_ITEMS} elements are supported.`);
    if (!v.every(isPrimitive)) return fail("Elements must be strings, numbers, booleans or null.");
    return ok(v);
}
