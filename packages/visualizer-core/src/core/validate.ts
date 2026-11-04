import type { Primitive } from "./types";

/** Shared input validation. Everything is parsed with JSON.parse; never eval / Function. */

export const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };
const ok = <T,>(value: T): Parsed<T> => ({ ok: true, value });
const fail = (error: string): Parsed<never> => ({ ok: false, error });

export class InputError extends Error {}
export const val = <T,>(p: Parsed<T>): T => {
    if (!p.ok) throw new InputError(p.error);
    return p.value;
};

export const isPrimitive = (v: unknown): v is Primitive =>
    v === null || typeof v === "string" || typeof v === "boolean" || (typeof v === "number" && Number.isFinite(v));

/** Blank -> null. Valid JSON primitive -> that value. Anything else -> plain string. */
export function parseValue(text: string): Parsed<Primitive> {
    const t = text.trim();
    if (t === "") return ok(null);
    try {
        const v: unknown = JSON.parse(t);
        return isPrimitive(v) ? ok(v) : fail("Only strings, numbers, booleans and null are supported (no objects or arrays).");
    } catch {
        return ok(t); // e.g. hello -> "hello"
    }
}

export function parseInteger(text: string, label = "index"): Parsed<number> {
    const t = text.trim();
    return /^[+-]?\d+$/.test(t) ? ok(Number(t)) : fail(`${label} must be a whole number.`);
}

export function parseOptionalInteger(text: string, label = "index"): Parsed<number | undefined> {
    return text.trim() === "" ? ok(undefined) : parseInteger(text, label);
}
