import {
    MAX_CAPACITY,
    bucketOf,
    exceedsMaxLoad,
    fmtLoad,
    hashOf,
    keysEqual,
} from "./hashing";
import type { Entry, KV, Kind, Primitive, TableState } from "./types";

/** Pure data model: no DOM, no React, no animation. */

export const STARTERS: Record<Kind, KV[]> = {
    // apple and pear collide in bucket 0 at capacity 8
    map: [
        { key: "apple", value: 1 },
        { key: "banana", value: 2 },
        { key: "cherry", value: 3 },
        { key: "date", value: 4 },
        { key: "pear", value: 5 },
    ],
    // 1 and 10 collide in bucket 0; 1 and "1" are different values
    set: [1, "1", 10, 2, 7].map((key) => ({ key, value: null })),
};

export const emptyBuckets = (n: number): Entry[][] =>
    Array.from({ length: n }, () => []);

export function createTable(
    kind: Kind,
    capacity: number,
    entries: KV[] = STARTERS[kind],
    from?: TableState,
): TableState {
    let s: TableState = {
        kind,
        capacity,
        baseCapacity: capacity,
        buckets: emptyBuckets(capacity),
        marks: [],
        highlights: {},
        arrows: [],
        counters: from ? { ...from.counters } : { entry: 1, arrow: 1 },
    };
    for (const e of entries) {
        const found = findEntry(s, e.key);
        s = found
            ? replaceValue(s, found.entry.id, e.value)
            : growWhileNeeded(placeEntry(s, e.key, e.value).state).state;
    }
    return s;
}

export const sizeOf = (s: TableState) =>
    s.buckets.reduce((n, b) => n + b.length, 0);

/** Iteration order: bucket 0..capacity-1, then slot order inside a bucket. */
export const entriesOf = (s: TableState): Entry[] => s.buckets.flat();

export interface Found {
    entry: Entry;
    bucket: number;
    slot: number;
}

export function findEntry(s: TableState, key: Primitive): Found | null {
    const bucket = bucketOf(key, s.capacity);
    const slot = s.buckets[bucket].findIndex((e) => keysEqual(e.key, key));
    return slot < 0 ? null : { entry: s.buckets[bucket][slot], bucket, slot };
}

export function locate(s: TableState, id: string): Found | null {
    for (let bucket = 0; bucket < s.buckets.length; bucket++) {
        const slot = s.buckets[bucket].findIndex((e) => e.id === id);
        if (slot >= 0) return { entry: s.buckets[bucket][slot], bucket, slot };
    }
    return null;
}

export interface Placed {
    state: TableState;
    entry: Entry;
    bucket: number;
    slot: number;
    /** Entries that were already in the bucket: a collision if non-empty. */
    neighbours: Entry[];
}

/** Appends a NEW entry to its bucket. Caller must have checked the key is absent. */
export function placeEntry(s: TableState, key: Primitive, value: Primitive): Placed {
    const bucket = bucketOf(key, s.capacity);
    const entry: Entry = { id: `h${s.counters.entry}`, key, value };
    const neighbours = s.buckets[bucket];
    return {
        state: {
            ...s,
            buckets: s.buckets.map((b, i) => (i === bucket ? [...b, entry] : b)),
            counters: { ...s.counters, entry: s.counters.entry + 1 },
        },
        entry,
        bucket,
        slot: neighbours.length,
        neighbours,
    };
}

export function replaceValue(s: TableState, id: string, value: Primitive): TableState {
    return {
        ...s,
        buckets: s.buckets.map((b) => b.map((e) => (e.id === id ? { ...e, value } : e))),
    };
}

/** Removes an entry together with its marks, highlight and arrows. */
export function removeById(s: TableState, id: string): TableState {
    const highlights = { ...s.highlights };
    delete highlights[id];
    return {
        ...s,
        buckets: s.buckets.map((b) => b.filter((e) => e.id !== id)),
        marks: s.marks.filter((m) => m.entryId !== id),
        arrows: s.arrows.filter((a) => a.entryId !== id),
        highlights,
    };
}

export interface Move {
    entry: Entry;
    from: number;
    to: number;
}
export interface Resize {
    state: TableState;
    steps: { from: number; to: number; load: string }[];
    /** Entries whose bucket changed over the whole resize. */
    moves: Move[];
}

/** Doubles capacity (and rehashes) while load factor > 0.75, up to MAX_CAPACITY. */
export function growWhileNeeded(s: TableState): Resize {
    const steps: Resize["steps"] = [];
    let cur = s;
    while (exceedsMaxLoad(sizeOf(cur), cur.capacity) && cur.capacity < MAX_CAPACITY) {
        steps.push({
            from: cur.capacity,
            to: cur.capacity * 2,
            load: `${sizeOf(cur)}/${cur.capacity} = ${fmtLoad(sizeOf(cur), cur.capacity)}`,
        });
        cur = rehash(cur, cur.capacity * 2);
    }
    const moves: Move[] = [];
    if (steps.length) {
        const before = new Map<string, number>();
        s.buckets.forEach((b, i) => b.forEach((e) => before.set(e.id, i)));
        cur.buckets.forEach((b, i) =>
            b.forEach((e) => {
                const from = before.get(e.id)!;
                if (from !== i) moves.push({ entry: e, from, to: i });
            }),
        );
    }
    return { state: cur, steps, moves };
}

/**
 * Same Entry objects (same ids), new buckets. Hash values never change,
 * only hash % capacity is recomputed. Iterating old buckets in order keeps
 * relative order deterministic. Marks reference ids, so they follow for free.
 */
export function rehash(s: TableState, capacity: number): TableState {
    const buckets = emptyBuckets(capacity);
    for (const e of entriesOf(s)) buckets[hashOf(e.key) % capacity].push(e);
    return { ...s, capacity, buckets };
}

const fmtKey = (v: Primitive) => JSON.stringify(v);
/** Compact one-line description used by the Before / After summaries. */
export function describe(s: TableState): string {
    const parts = s.buckets.flatMap((b, i) =>
        b.length === 0
            ? []
            : [
                  `[${i}] ${b
                      .map((e) => (s.kind === "map" ? `${fmtKey(e.key)}→${fmtKey(e.value)}` : fmtKey(e.key)))
                      .join(", ")}`,
              ],
    );
    return `size ${sizeOf(s)} · capacity ${s.capacity} · load ${fmtLoad(sizeOf(s), s.capacity)}\n${parts.length ? parts.join("   ") : "(empty)"}`;
}
