import type { Primitive } from "./types";

/**
 * Hashing rules (deterministic, no randomness, no per-session seed):
 *
 * 1. CANONICALIZE  Every value is turned into a type-tagged string first:
 *      "apple" -> "s:apple"    1 -> "n:1"    "1" -> "s:1"
 *      true    -> "b:true"     null -> "z:null"
 *    The tag keeps 1 and "1" (and true and "true") apart, both in the hash
 *    and in equality.
 * 2. HASH          32-bit FNV-1a over the UTF-16 code units of that string:
 *      h = 0x811C9DC5;  for each unit u:  h ^= u;  h = (h * 0x01000193) mod 2^32
 * 3. BUCKET        bucket = hash mod capacity   (capacity is always a power of two)
 *
 * Equality is strict and type-aware (`===` on primitives), so 1 !== "1",
 * and 0 === -0 (their canonical forms are identical too).
 */

export const MAX_LOAD_FACTOR = 0.75;
export const DEFAULT_CAPACITY = 8;
export const CAPACITY_CHOICES = [4, 8, 16, 32] as const;
export const MAX_CAPACITY = 32;
/** 0.75 * MAX_CAPACITY, so a full table never needs more than MAX_CAPACITY buckets. */
export const MAX_ENTRIES = 24;

export type TypeName = "string" | "number" | "boolean" | "null";

export function typeName(v: Primitive): TypeName {
    return v === null ? "null" : (typeof v as TypeName);
}

export function canonical(v: Primitive): string {
    switch (typeName(v)) {
        case "string":
            return `s:${v as string}`;
        case "number":
            return `n:${Object.is(v, -0) ? "0" : String(v)}`;
        case "boolean":
            return `b:${String(v)}`;
        default:
            return "z:null";
    }
}

export function fnv1a(text: string): number {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
        h ^= text.charCodeAt(i);
        h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h >>> 0;
}

export const hashOf = (v: Primitive): number => fnv1a(canonical(v));
export const hex = (h: number): string =>
    `0x${h.toString(16).toUpperCase().padStart(8, "0")}`;
export const bucketIndex = (hash: number, capacity: number): number =>
    hash % capacity;
export const bucketOf = (v: Primitive, capacity: number): number =>
    bucketIndex(hashOf(v), capacity);

/** Strict, type-aware equality. */
export const keysEqual = (a: Primitive, b: Primitive): boolean => a === b;

export const loadFactor = (size: number, capacity: number): number =>
    capacity === 0 ? 0 : size / capacity;
/** Strictly greater than 0.75, so exactly 0.75 is still allowed. */
export const exceedsMaxLoad = (size: number, capacity: number): boolean =>
    size > capacity * MAX_LOAD_FACTOR;
export const fmtLoad = (size: number, capacity: number): string =>
    loadFactor(size, capacity).toFixed(3).replace(/0+$/, "").replace(/\.$/, ".0");
