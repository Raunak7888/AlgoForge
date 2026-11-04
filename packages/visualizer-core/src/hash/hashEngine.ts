import { HEX_RE, isPrimitive } from "../core/validate";
import {
    CAPACITY_CHOICES,
    DEFAULT_CAPACITY,
    MAX_ENTRIES,
    MAX_LOAD_FACTOR,
    canonical,
    fmtLoad,
    hashOf,
    hex,
    loadFactor,
    typeName,
} from "./hashing";
import {
    createTable,
    describe,
    entriesOf,
    findEntry,
    growWhileNeeded,
    locate,
    placeEntry,
    removeById,
    replaceValue,
    sizeOf,
} from "./tableModel";
import type {
    Anim,
    Explain,
    HashOp,
    Kind,
    Outcome,
    Primitive,
    TableState,
    Trace,
} from "./types";
import { MARK_ID_HELP, MARK_ID_RE } from "./validate";

export const MAP_DEFAULT = DEFAULT_CAPACITY;
const NONE: Anim = { kind: "none" };
const COLOR_HELP = "Color must look like #RRGGBB, e.g. #FF430F.";
export const ARROW_DEFAULT_COLOR = "#0070F3";

export const fmt = (v: unknown) => JSON.stringify(v);

export function callText(op: HashOp, kind: Kind): string {
    const { type, ...rest } = op;
    const name = kind === "set" && type === "moveMarkToKey" ? "moveMarkToValue" : type;
    if (type === "initialize") {
        const n = (op as Extract<HashOp, { type: "initialize" }>).entries.length;
        return `initialize(${n} ${n === 1 ? "item" : "items"})`;
    }
    const args = Object.values(rest)
        .filter((v) => v !== undefined)
        .map((v) => JSON.stringify(v))
        .join(", ");
    return `${name}(${args})`;
}

const ex = (ran: string, affected: string, changed: string, unchanged: string): Explain => ({
    ran,
    affected,
    changed,
    unchanged,
});

const READ_ONLY = "Nothing. This is a read-only operation, so the contents did not change.";
const ALL_SAME = "Every entry, its bucket, its marks, highlights and arrows.";

/* ───────────── outcome helpers ───────────── */

function reject(
    s: TableState,
    ran: string,
    error: string,
    trace: Trace | null = null,
    anim: Anim = NONE,
): Outcome {
    return {
        ok: false,
        state: s,
        anim,
        trace,
        error,
        explain: ex(
            `${ran} (rejected)`,
            "Nothing.",
            error,
            "Everything: entries, buckets, marks, highlights and arrows are exactly as before.",
        ),
    };
}

function accept(
    state: TableState,
    explain: Explain,
    anim: Anim = NONE,
    result?: Outcome["result"],
    trace: Trace | null = null,
): Outcome {
    return { ok: true, state, explain, anim, result, trace };
}

const noun = (s: TableState) => (s.kind === "map" ? "key" : "value");
const Noun = (s: TableState) => (s.kind === "map" ? "Key" : "Value");

function wrongKind(s: TableState, ran: string, op: HashOp): Outcome {
    const need = ["set", "get", "update", "keys", "entries"].includes(op.type) ? "HashMap" : "HashSet";
    return reject(s, ran, `${op.type}() is a ${need} operation. Switch to ${need} to use it.`);
}

/** The hash pipeline for one subject. `bucket` is for the capacity the lookup used. */
function traceOf(
    s: TableState,
    subject: Primitive,
    outcome: string,
    pair?: Primitive,
    resize?: Trace["resize"],
): Trace {
    const hash = hashOf(subject);
    return {
        label: noun(s) as Trace["label"],
        subject,
        pair,
        type: typeName(subject),
        canonical: canonical(subject),
        hash,
        hex: hex(hash),
        capacity: s.capacity,
        bucket: hash % s.capacity,
        outcome,
        resize,
    };
}

const hashLine = (t: Trace) =>
    `${fmt(t.subject)} → ${t.canonical} → ${t.hex} (${t.hash}) → ${t.hash} mod ${t.capacity} = bucket ${t.bucket}.`;

function checkKey(s: TableState, ran: string, key: unknown): Outcome | null {
    return isPrimitive(key)
        ? null
        : reject(s, ran, `${Noun(s)}s must be strings, numbers, booleans or null.`);
}

/* ───────────── shared insertion ───────────── */

function insertNew(s: TableState, ran: string, key: Primitive, value: Primitive): Outcome {
    const size = sizeOf(s);
    const base = traceOf(s, key, "", s.kind === "map" ? value : undefined);
    if (size >= MAX_ENTRIES)
        return reject(
            s,
            ran,
            `The lab limits a table to ${MAX_ENTRIES} entries so it stays readable.`,
            { ...base, outcome: "Rejected: table is full" },
        );

    const placed = placeEntry(s, key, value);
    const grown = growWhileNeeded(placed.state);
    const next = grown.state;
    const collided = placed.neighbours.length > 0;
    const resize = grown.steps.length
        ? { from: s.capacity, to: next.capacity }
        : undefined;

    const loadBefore = fmtLoad(size, s.capacity);
    const loadAfter = fmtLoad(size + 1, next.capacity);

    const collision = collided
        ? ` Collision: bucket ${placed.bucket} already held ${placed.neighbours.map((e) => fmt(e.key)).join(", ")}. ` +
          `Different ${noun(s)}s with the same hash mod ${s.capacity} share a bucket, shown as separate tiles (no chain, no linked nodes).`
        : ` Bucket ${placed.bucket} was empty, so there is no collision.`;
    const resizeText = grown.steps.length
        ? ` Resize: load factor ${grown.steps.map((st) => st.load).join(" then ")} exceeds the maximum ${MAX_LOAD_FACTOR}, ` +
          `so capacity doubled ${s.capacity} → ${next.capacity}. Hash values do not change; each entry's bucket is recomputed as hash mod ${next.capacity}. ` +
          `${grown.moves.length} of ${size + 1} entries changed bucket` +
          (grown.moves.length
              ? ` (${grown.moves
                    .slice(0, 4)
                    .map((m) => `${fmt(m.entry.key)}: ${m.from} → ${m.to}`)
                    .join(", ")}${grown.moves.length > 4 ? ", …" : ""}).`
              : ".")
        : "";

    const trace: Trace = {
        ...base,
        outcome: collided
            ? `Inserted · collision in bucket ${placed.bucket}`
            : `Inserted into bucket ${placed.bucket}`,
        resize,
    };

    return accept(
        next,
        ex(
            ran,
            hashLine(base) + ` New entry placed at bucket ${placed.bucket}, slot ${placed.slot}.`,
            `Size ${size} → ${size + 1}. Load factor ${loadBefore} → ${loadAfter}.` + collision + resizeText,
            `Existing entries keep their ids and marks${resize ? " (they were only moved to new buckets)" : "; none of them moved"}.`,
        ),
        {
            kind: "insert",
            id: placed.entry.id,
            bucket: placed.bucket,
            collided,
            placed: { bucket: placed.bucket, slot: placed.slot },
            resize,
            prev: s,
        },
        { label: s.kind === "map" ? "Inserted" : "Added", value: s.kind === "map" ? { key, value } : key },
        trace,
    );
}

/* ───────────── dispatcher ───────────── */

export function applyOp(s: TableState, op: HashOp): Outcome {
    const ran = callText(op, s.kind);
    const size = sizeOf(s);
    const isMap = s.kind === "map";
    const lf = fmtLoad(size, s.capacity);

    switch (op.type) {
        /* ── HashMap only ── */
        case "set": {
            if (!isMap) return wrongKind(s, ran, op);
            const bad = checkKey(s, ran, op.key) ?? (isPrimitive(op.value) ? null : reject(s, ran, "Values must be strings, numbers, booleans or null."));
            if (bad) return bad;
            const found = findEntry(s, op.key);
            if (!found) return insertNew(s, ran, op.key, op.value);
            const trace = traceOf(s, op.key, `Key exists · value replaced`, op.value);
            return accept(
                replaceValue(s, found.entry.id, op.value),
                ex(
                    ran,
                    hashLine(trace) + ` The key ${fmt(op.key)} is already in bucket ${found.bucket}, so no new entry is created.`,
                    `Value ${fmt(found.entry.value)} → ${fmt(op.value)}. Size stays ${size}.`,
                    "Size, capacity, load factor, bucket placement, entry identity, marks, highlights and arrows.",
                ),
                { kind: "update", id: found.entry.id, oldValue: found.entry.value },
                { label: "Replaced value", value: found.entry.value },
                trace,
            );
        }
        case "update": {
            if (!isMap) return wrongKind(s, ran, op);
            const bad = checkKey(s, ran, op.key) ?? (isPrimitive(op.value) ? null : reject(s, ran, "Values must be strings, numbers, booleans or null."));
            if (bad) return bad;
            const found = findEntry(s, op.key);
            const t = traceOf(s, op.key, found ? "Found · value replaced" : "Key not found", op.value);
            if (!found)
                return reject(
                    s,
                    ran,
                    `Key ${fmt(op.key)} does not exist (looked in bucket ${t.bucket}). update() never inserts; use set() to add it.`,
                    t,
                    { kind: "miss", bucket: t.bucket },
                );
            return accept(
                replaceValue(s, found.entry.id, op.value),
                ex(
                    ran,
                    hashLine(t) + ` Found at slot ${found.slot}.`,
                    `Value ${fmt(found.entry.value)} → ${fmt(op.value)}.`,
                    "Size, capacity, bucket placement, entry identity, marks, highlights and arrows.",
                ),
                { kind: "update", id: found.entry.id, oldValue: found.entry.value },
                { label: "Replaced value", value: found.entry.value },
                t,
            );
        }
        case "get": {
            if (!isMap) return wrongKind(s, ran, op);
            const bad = checkKey(s, ran, op.key);
            if (bad) return bad;
            const found = findEntry(s, op.key);
            const t = traceOf(s, op.key, found ? `Found: ${fmt(found.entry.value)}` : "Not found");
            return accept(
                s,
                ex(
                    ran,
                    hashLine(t) +
                        (found
                            ? ` Compared with the ${s.buckets[t.bucket].length} entr${s.buckets[t.bucket].length === 1 ? "y" : "ies"} in that bucket; match at slot ${found.slot}.`
                            : s.buckets[t.bucket].length
                              ? ` Compared with every entry in that bucket (${s.buckets[t.bucket].length}); none is equal, so the key is missing.`
                              : " That bucket is empty, so the key is missing."),
                    READ_ONLY,
                    ALL_SAME,
                ),
                found ? { kind: "read", id: found.entry.id, bucket: t.bucket } : { kind: "miss", bucket: t.bucket },
                {
                    label: "get",
                    // found:false (missing) is different from found:true,value:null (a stored null).
                    value: found ? { found: true, value: found.entry.value } : { found: false },
                },
                t,
            );
        }
        case "keys":
        case "entries": {
            if (!isMap) return wrongKind(s, ran, op);
            const all = entriesOf(s);
            return accept(
                s,
                ex(
                    ran,
                    `All ${all.length} entries, visited in bucket order 0..${s.capacity - 1}, then slot order.`,
                    READ_ONLY,
                    ALL_SAME,
                ),
                all.length ? { kind: "scan", ids: all.map((e) => e.id) } : NONE,
                {
                    label: op.type === "keys" ? "Keys" : "Entries",
                    value: op.type === "keys" ? all.map((e) => e.key) : all.map((e) => [e.key, e.value]),
                },
            );
        }

        /* ── HashSet only ── */
        case "add": {
            if (isMap) return wrongKind(s, ran, op);
            const bad = checkKey(s, ran, op.key);
            if (bad) return bad;
            const found = findEntry(s, op.key);
            if (!found) return insertNew(s, ran, op.key, null);
            const t = traceOf(s, op.key, "Already present · no change");
            return accept(
                s,
                ex(
                    ran,
                    hashLine(t) + ` ${fmt(op.key)} is already in bucket ${found.bucket}.`,
                    `Nothing. A set never stores duplicates, so the size stays ${size}.`,
                    ALL_SAME,
                ),
                { kind: "read", id: found.entry.id, bucket: found.bucket },
                { label: "Added", value: false },
                t,
            );
        }

        /* ── both ── */
        case "has": {
            const bad = checkKey(s, ran, op.key);
            if (bad) return bad;
            const found = findEntry(s, op.key);
            const t = traceOf(s, op.key, found ? "Found: true" : "Not found: false");
            return accept(
                s,
                ex(
                    ran,
                    hashLine(t) +
                        (found
                            ? ` Match at slot ${found.slot}.`
                            : s.buckets[t.bucket].length
                              ? ` None of the ${s.buckets[t.bucket].length} entr${s.buckets[t.bucket].length === 1 ? "y" : "ies"} in that bucket is equal (type-aware: 1 and "1" differ).`
                              : " That bucket is empty."),
                    READ_ONLY,
                    ALL_SAME,
                ),
                found ? { kind: "read", id: found.entry.id, bucket: t.bucket } : { kind: "miss", bucket: t.bucket },
                { label: "has", value: !!found },
                t,
            );
        }
        case "delete": {
            const bad = checkKey(s, ran, op.key);
            if (bad) return bad;
            const found = findEntry(s, op.key);
            const t = traceOf(s, op.key, found ? "Found · removed" : "Not found");
            if (!found)
                return reject(
                    s,
                    ran,
                    `${Noun(s)} ${fmt(op.key)} does not exist (looked in bucket ${t.bucket}), so nothing was deleted.`,
                    t,
                    { kind: "miss", bucket: t.bucket },
                );
            const next = removeById(s, found.entry.id);
            const lostMarks = s.marks.filter((m) => m.entryId === found.entry.id).length;
            const lostArrows = s.arrows.filter((a) => a.entryId === found.entry.id).length;
            const sameBucket = s.buckets[found.bucket].length - 1 - found.slot;
            return accept(
                next,
                ex(
                    ran,
                    hashLine(t) + ` Removed from slot ${found.slot}.`,
                    `Size ${size} → ${size - 1}. Load factor ${lf} → ${fmtLoad(size - 1, s.capacity)}.` +
                        (sameBucket > 0 ? ` ${sameBucket} later entr${sameBucket === 1 ? "y" : "ies"} in bucket ${found.bucket} slid up.` : "") +
                        (lostMarks ? ` ${lostMarks} mark(s) on it were removed.` : "") +
                        (lostArrows ? ` ${lostArrows} arrow(s) on it were removed.` : ""),
                    `Capacity stays ${s.capacity} (tables never shrink here). Other entries keep their buckets, ids and marks.`,
                ),
                { kind: "remove", ghost: { entry: found.entry, bucket: found.bucket, slot: found.slot }, prev: s },
                { label: "Removed", value: isMap ? { key: found.entry.key, value: found.entry.value } : found.entry.key },
                t,
            );
        }
        case "values": {
            const all = entriesOf(s);
            return accept(
                s,
                ex(
                    ran,
                    `All ${all.length} ${isMap ? "values" : "items"}, visited in bucket order 0..${s.capacity - 1}, then slot order.`,
                    READ_ONLY,
                    ALL_SAME,
                ),
                all.length ? { kind: "scan", ids: all.map((e) => e.id) } : NONE,
                { label: "Values", value: all.map((e) => (isMap ? e.value : e.key)) },
            );
        }

        /* ── info ── */
        case "getSize":
            return accept(s, ex(ran, "The whole table.", READ_ONLY, ALL_SAME), NONE, { label: "Size", value: size });
        case "getCapacity":
            return accept(s, ex(ran, "The whole table.", READ_ONLY, ALL_SAME), NONE, { label: "Capacity", value: s.capacity });
        case "getLoadFactor":
            return accept(
                s,
                ex(ran, `Size ${size} ÷ capacity ${s.capacity}. The table resizes when this exceeds ${MAX_LOAD_FACTOR}.`, READ_ONLY, ALL_SAME),
                NONE,
                { label: "Load factor", value: loadFactor(size, s.capacity) },
            );
        case "isEmpty":
            return accept(s, ex(ran, "The whole table.", READ_ONLY, ALL_SAME), NONE, { label: "Is empty?", value: size === 0 });

        /* ── marks ── */
        case "createMark": {
            if (!MARK_ID_RE.test(op.markId)) return reject(s, ran, MARK_ID_HELP);
            if (s.marks.some((m) => m.id === op.markId))
                return reject(s, ran, `A mark named ${op.markId} already exists.`);
            const bad = checkKey(s, ran, op.key);
            if (bad) return bad;
            const found = findEntry(s, op.key);
            const t = traceOf(s, op.key, found ? `Found · mark ${op.markId}` : "Not found");
            if (!found)
                return reject(s, ran, `${Noun(s)} ${fmt(op.key)} does not exist, so there is nothing to mark.`, t, {
                    kind: "miss",
                    bucket: t.bucket,
                });
            return accept(
                { ...s, marks: [...s.marks, { id: op.markId, entryId: found.entry.id }] },
                ex(
                    ran,
                    hashLine(t),
                    `Mark ${op.markId} now sticks to this entry. It follows the entry if a resize moves it to another bucket, and disappears if the entry is deleted.`,
                    "Contents, size, capacity and bucket placement.",
                ),
                { kind: "markIn", markId: op.markId },
                { label: "Created mark", value: op.markId },
                t,
            );
        }
        case "deleteMark": {
            const m = s.marks.find((x) => x.id === op.markId);
            if (!m) return reject(s, ran, `No mark named "${op.markId}".`);
            return accept(
                { ...s, marks: s.marks.filter((x) => x !== m) },
                ex(ran, `Mark ${m.id}.`, `Mark ${m.id} was removed.`, "The entry it pointed at and all contents."),
                { kind: "markOut", entryId: m.entryId, markId: m.id },
            );
        }
        case "readMark": {
            const m = s.marks.find((x) => x.id === op.markId);
            if (!m) return reject(s, ran, `No mark named "${op.markId}".`);
            const at = locate(s, m.entryId);
            if (!at) return reject(s, ran, `Mark ${m.id} no longer has an entry.`);
            return accept(
                s,
                ex(ran, `Mark ${m.id} → bucket ${at.bucket}, slot ${at.slot}.`, READ_ONLY, ALL_SAME),
                { kind: "read", id: at.entry.id, bucket: at.bucket },
                {
                    label: `Mark ${m.id}`,
                    value: isMap
                        ? { key: at.entry.key, value: at.entry.value, bucket: at.bucket, slot: at.slot }
                        : { value: at.entry.key, bucket: at.bucket, slot: at.slot },
                },
            );
        }
        case "moveMarkToKey": {
            const m = s.marks.find((x) => x.id === op.markId);
            if (!m) return reject(s, ran, `No mark named "${op.markId}".`);
            const bad = checkKey(s, ran, op.key);
            if (bad) return bad;
            const found = findEntry(s, op.key);
            const t = traceOf(s, op.key, found ? `Found · mark ${m.id} moved` : "Not found");
            if (!found)
                return reject(s, ran, `${Noun(s)} ${fmt(op.key)} does not exist, so mark ${m.id} stays where it is.`, t, {
                    kind: "miss",
                    bucket: t.bucket,
                });
            return accept(
                { ...s, marks: s.marks.map((x) => (x === m ? { ...x, entryId: found.entry.id } : x)) },
                ex(
                    ran,
                    hashLine(t),
                    `Mark ${m.id} is now attached to ${fmt(found.entry.key)} in bucket ${found.bucket}.`,
                    "Contents, size, capacity and bucket placement.",
                ),
                { kind: "markIn", markId: m.id },
                undefined,
                t,
            );
        }

        /* ── annotations ── */
        case "highlight": {
            const bad = checkKey(s, ran, op.key);
            if (bad) return bad;
            if (!HEX_RE.test(op.color)) return reject(s, ran, COLOR_HELP);
            const found = findEntry(s, op.key);
            const t = traceOf(s, op.key, found ? "Found · highlighted" : "Not found");
            if (!found)
                return reject(s, ran, `${Noun(s)} ${fmt(op.key)} does not exist, so there is nothing to highlight.`, t, {
                    kind: "miss",
                    bucket: t.bucket,
                });
            return accept(
                { ...s, highlights: { ...s.highlights, [found.entry.id]: op.color.toUpperCase() } },
                ex(ran, hashLine(t), `Entry filled with ${op.color.toUpperCase()}. It stays until you clear it or delete the entry.`, "Contents, size, capacity and bucket placement."),
                { kind: "highlight", id: found.entry.id },
                undefined,
                t,
            );
        }
        case "pointArrow": {
            const bad = checkKey(s, ran, op.key);
            if (bad) return bad;
            const color = (op.color ?? ARROW_DEFAULT_COLOR).toUpperCase();
            if (!HEX_RE.test(color)) return reject(s, ran, COLOR_HELP);
            const found = findEntry(s, op.key);
            const t = traceOf(s, op.key, found ? "Found · arrow" : "Not found");
            if (!found)
                return reject(s, ran, `${Noun(s)} ${fmt(op.key)} does not exist, so there is nothing to point at.`, t, {
                    kind: "miss",
                    bucket: t.bucket,
                });
            const existing = s.arrows.find((a) => a.entryId === found.entry.id);
            const id = existing?.id ?? `a${s.counters.arrow}`;
            return accept(
                existing
                    ? { ...s, arrows: s.arrows.map((a) => (a === existing ? { ...a, color } : a)) }
                    : {
                          ...s,
                          arrows: [...s.arrows, { id, entryId: found.entry.id, color }],
                          counters: { ...s.counters, arrow: s.counters.arrow + 1 },
                      },
                ex(
                    ran,
                    hashLine(t),
                    existing ? `The arrow on this entry was recolored to ${color}.` : `A ${color} arrow now points at this entry.`,
                    "Contents, size, capacity and bucket placement.",
                ),
                { kind: "arrow", id },
                undefined,
                t,
            );
        }
        case "clearHighlights": {
            const n = Object.keys(s.highlights).length;
            if (!n) return reject(s, ran, "There is no highlight to clear.");
            return accept({ ...s, highlights: {} }, ex(ran, "All entries.", `${n} highlight(s) removed.`, "Contents, marks and arrows."));
        }
        case "clearArrows": {
            if (!s.arrows.length) return reject(s, ran, "There are no arrows to clear.");
            return accept(
                { ...s, arrows: [] },
                ex(ran, "All arrows.", `${s.arrows.length} arrow(s) removed.`, "Contents, marks and highlights."),
                { kind: "dismiss", prev: s },
            );
        }

        /* ── whole-table ── */
        case "clear": {
            if (size === 0 && !s.marks.length && !s.arrows.length && !Object.keys(s.highlights).length)
                return reject(s, ran, "The table is already empty.");
            return accept(
                { ...s, buckets: s.buckets.map(() => []), marks: [], highlights: {}, arrows: [] },
                ex(
                    ran,
                    `All ${size} entr${size === 1 ? "y" : "ies"}.`,
                    `Size ${size} → 0. Load factor ${lf} → 0. ${s.marks.length} mark(s), ${s.arrows.length} arrow(s) and ${Object.keys(s.highlights).length} highlight(s) were removed with the entries.`,
                    `Capacity stays ${s.capacity} (clear() empties the buckets, it does not shrink the table). The log is kept.`,
                ),
                { kind: "clear", prev: s },
            );
        }
        case "initialize": {
            if (!Array.isArray(op.entries) || !op.entries.every((e) => isPrimitive(e?.key) && isPrimitive(e?.value)))
                return reject(s, ran, "Entries must use strings, numbers, booleans or null.");
            const distinct = new Set(op.entries.map((e) => `${typeName(e.key)}|${String(e.key)}`)).size;
            if (distinct > MAX_ENTRIES)
                return reject(s, ran, `At most ${MAX_ENTRIES} distinct entries are supported.`);
            const next = createTable(s.kind, s.baseCapacity, op.entries, s);
            const dupes = op.entries.length - distinct;
            return accept(
                next,
                ex(
                    ran,
                    `${distinct} distinct entr${distinct === 1 ? "y" : "ies"} inserted one by one into ${s.baseCapacity} buckets.`,
                    `Contents replaced: size ${size} → ${sizeOf(next)}, capacity ${s.capacity} → ${next.capacity}.` +
                        (dupes ? ` ${dupes} duplicate${dupes === 1 ? "" : "s"} in the input ${isMap ? "updated existing keys" : "were ignored"}.` : "") +
                        (next.capacity > s.baseCapacity ? " The table resized while loading." : "") +
                        " Marks, highlights and arrows were cleared.",
                    "The operation log.",
                ),
                { kind: "reset", prev: s },
                { label: "Size", value: sizeOf(next) },
            );
        }
        case "reset": {
            const cap = op.capacity ?? s.baseCapacity;
            if (!(CAPACITY_CHOICES as readonly number[]).includes(cap))
                return reject(s, ran, `Capacity must be one of ${CAPACITY_CHOICES.join(", ")}.`);
            const next = createTable(s.kind, cap, undefined, s);
            return accept(
                next,
                ex(
                    ran,
                    "The whole table.",
                    `Restored the starter ${isMap ? "map" : "set"} with ${cap} buckets (size ${sizeOf(next)}). Marks, highlights and arrows were cleared.`,
                    "The operation log.",
                ),
                { kind: "reset", prev: s },
            );
        }
    }
}

export { describe };
