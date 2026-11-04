import {
    isPrimitive,
    parseInteger,
    parseValue,
    type Parsed,
} from "../core/validate";
import { CAPACITY_CHOICES, MAX_ENTRIES } from "./hashing";
import type { Kind, KV, Primitive } from "./types";

/**
 * Validation layer. Everything is parsed with JSON.parse (never eval / Function)
 * and checked BEFORE any state is touched.
 */
export { parseInteger, parseValue, isPrimitive };

const ok = <T,>(value: T): Parsed<T> => ({ ok: true, value });
const fail = (error: string): Parsed<never> => ({ ok: false, error });

export const MARK_ID_RE = /^[A-Za-z0-9_-]{1,12}$/;
export const MARK_ID_HELP =
    "Mark ids are 1-12 characters: letters, digits, _ or -.";

/** Keys and set values must be typed explicitly: blank is an error, `null` is a real key. */
export function parseKey(text: string, what = "Key"): Parsed<Primitive> {
    if (text.trim() === "")
        return fail(`${what} is required. Type null for a null ${what.toLowerCase()}.`);
    return parseValue(text);
}

export function parseCapacity(text: string): Parsed<number> {
    const n = parseInteger(text, "capacity");
    if (!n.ok) return n;
    return (CAPACITY_CHOICES as readonly number[]).includes(n.value)
        ? ok(n.value)
        : fail(`Capacity must be one of ${CAPACITY_CHOICES.join(", ")}.`);
}

/**
 * HashMap: a JSON object {"a": 1}  (keys become strings)
 *      or  a JSON array of [key, value] pairs  [[1, "a"], ["1", "b"]]  (any primitive key)
 * HashSet: a JSON array of primitives [1, "1", true, null]
 * Duplicates are allowed in the input: later ones update / are ignored, exactly like set()/add().
 */
export function parseInitial(kind: Kind, text: string): Parsed<KV[]> {
    let v: unknown;
    try {
        v = JSON.parse(text);
    } catch {
        return fail(
            kind === "map"
                ? 'Invalid JSON. Example: {"apple": 1} or [["a", 1], [2, null]]'
                : 'Invalid JSON. Example: [1, "1", true, null]',
        );
    }
    const out: KV[] = [];
    if (kind === "set") {
        if (!Array.isArray(v)) return fail("A HashSet needs a JSON array of values.");
        if (!v.every(isPrimitive))
            return fail("Values must be strings, numbers, booleans or null.");
        v.forEach((key) => out.push({ key, value: null }));
    } else if (Array.isArray(v)) {
        for (const pair of v) {
            if (!Array.isArray(pair) || pair.length !== 2)
                return fail("Each item must be a [key, value] pair.");
            if (!isPrimitive(pair[0]) || !isPrimitive(pair[1]))
                return fail("Keys and values must be strings, numbers, booleans or null.");
            out.push({ key: pair[0], value: pair[1] });
        }
    } else if (v !== null && typeof v === "object") {
        for (const [key, value] of Object.entries(v as Record<string, unknown>)) {
            if (!isPrimitive(value))
                return fail(`Value of "${key}" must be a string, number, boolean or null.`);
            out.push({ key, value });
        }
    } else {
        return fail("A HashMap needs a JSON object or an array of [key, value] pairs.");
    }
    const unique = new Set(out.map((e) => `${typeof e.key}:${String(e.key)}`)).size;
    if (unique > MAX_ENTRIES)
        return fail(`At most ${MAX_ENTRIES} distinct entries are supported.`);
    return ok(out);
}
