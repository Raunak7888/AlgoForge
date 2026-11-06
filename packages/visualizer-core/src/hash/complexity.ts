import type { OpType } from "./types";

/** Conceptual hash-table costs, not measurements. */
export const COMPLEXITY: Record<OpType, string> = {
    set: "O(1) average: hash, jump to the bucket, compare with the few entries there. O(n) worst case if everything collides. A resize costs O(n) but happens rarely, so inserts stay O(1) amortized.",
    add: "O(1) average, O(n) worst case; amortized O(1) including occasional resizes.",
    get: "O(1) average: one hash and a short scan of one bucket. O(n) worst case.",
    has: "O(1) average: one hash and a short scan of one bucket. O(n) worst case.",
    update: "O(1) average: find the entry, overwrite its value.",
    delete: "O(1) average: find the entry, remove it from its bucket.",
    clear: "O(capacity + n): empty every bucket.",
    getSize: "O(1): the size is a counter.",
    getCapacity: "O(1): the bucket count is stored.",
    getLoadFactor: "O(1): size ÷ capacity.",
    isEmpty: "O(1): compare the size with 0.",
    keys: "O(capacity + n): walk every bucket.",
    values: "O(capacity + n): walk every bucket.",
    entries: "O(capacity + n): walk every bucket.",
    initialize: "O(n) average: one insert per item, plus resizes along the way.",
    reset: "O(n): rebuild the starter contents.",
    createMark: "O(1) average: one lookup, then store the entry id.",
    deleteMark: "O(1): drop the mark; the entry is untouched.",
    readMark: "O(1) conceptually; this lab scans the buckets to find the entry.",
    moveMarkToKey: "O(1) average: one lookup, then re-attach the mark.",
    highlight: "O(1) average: one lookup; annotation only.",
    pointArrow: "O(1) average: one lookup; annotation only.",
    clearHighlights: "Annotation only; no contents are touched.",
    clearArrows: "Annotation only; no contents are touched.",
};
