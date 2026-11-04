import type {
    Anim,
    ArrayState,
    Explain,
    Op,
    Outcome,
    Primitive,
} from "./types";
import { HEX_RE, MAX_ITEMS, isPrimitive } from "./validate";

export const ARRAY_ID = "A";
export const DEFAULT_MARK = "P";
export const STARTER: readonly Primitive[] = [10, 20, 30, 40];
/** Default colors: single-cell arrows are blue, from→to arrows are green. */
export const ARROW_POINT_COLOR = "#0070F3";
export const ARROW_LINK_COLOR = "#17A34A";
const NAME_RE = /^[A-Za-z][A-Za-z0-9_]{0,7}$/;
const NONE: Anim = { kind: "none" };
const COLOR_HELP = "Color must look like #RRGGBB, e.g. #FF430F.";

export const fmt = (v: Primitive) => JSON.stringify(v);
export const fmtList = (vs: readonly Primitive[]) =>
    `[${vs.map(fmt).join(", ")}]`;
export const valuesOf = (s: ArrayState): Primitive[] =>
    s.items.map((i) => i.value);

export function createState(
    values: readonly Primitive[] = STARTER,
): ArrayState {
    return {
        items: values.map((value, i) => ({ id: `e${i + 1}`, value })),
        markers: [],
        pointers: [{ name: DEFAULT_MARK, index: 0 }],
        highlights: {},
        arrows: [],
        counters: { item: values.length + 1, marker: 1, arrow: 1 },
    };
}

export function callText(op: Op): string {
    const { type, ...rest } = op;
    const args = Object.values(rest)
        .filter((v) => v !== undefined)
        .map((v) => JSON.stringify(v))
        .join(", ");
    return `${type}(${args})`;
}

/* ───────────── helpers ───────────── */

const inRange = (n: unknown, len: number, allowEnd = false): n is number =>
    Number.isInteger(n) &&
    (n as number) >= 0 &&
    (n as number) < len + (allowEnd ? 1 : 0);

const badIndex = (i: unknown, len: number, allowEnd = false) =>
    !Number.isInteger(i)
        ? "Index must be a whole number."
        : len === 0 && !allowEnd
          ? `Index ${i} is invalid: the array is empty, so there is no valid index.`
          : `Index ${i} is invalid: valid indices are 0..${allowEnd ? len : len - 1}.`;

const unknownArray = (name: string, self: string = ARRAY_ID) =>
    `Array "${name}" does not exist. This array is "${self}".`;

const ex = (
    ran: string,
    affected: string,
    changed: string,
    unchanged: string,
): Explain => ({ ran, affected, changed, unchanged });

const READ_ONLY =
    "Nothing. This is a read-only operation, so the array did not change.";
const MARKER_NAME_RE = /^[A-Za-z0-9_-]{1,12}$/;
const MARKER_NAME_HELP =
    "Marker names are 1-12 characters: letters, digits, _ or -.";
const MARK_NAME_HELP =
    "Mark names are 1-8 characters, start with a letter, and use letters, digits or _.";
const findMarker = (s: ArrayState, key?: string) =>
    key
        ? s.markers.find((m) => m.id === key || m.name === key)
        : s.markers[s.markers.length - 1];

const markerNameTaken = (s: ArrayState, name: string, exceptId?: string) =>
    s.markers.some(
        (m) => m.id !== exceptId && (m.name === name || m.id === name),
    );

function reject(s: ArrayState, ran: string, error: string): Outcome {
    return {
        ok: false,
        state: s,
        anim: NONE,
        error,
        explain: ex(
            `${ran} (rejected)`,
            "Nothing.",
            error,
            "Everything: the array, markers and Marks are exactly as before.",
        ),
    };
}

function accept(
    state: ArrayState,
    explain: Explain,
    anim: Anim = NONE,
    result?: Outcome["result"],
): Outcome {
    return { ok: true, state, explain, anim, result };
}

/** True when there is nothing on the stage at all (no cells, annotations or extra Marks). */
function isPristineEmpty(s: ArrayState) {
    return (
        s.items.length === 0 &&
        s.markers.length === 0 &&
        s.arrows.length === 0 &&
        Object.keys(s.highlights).length === 0 &&
        s.pointers.length === 1 &&
        s.pointers[0].name === DEFAULT_MARK &&
        s.pointers[0].index === 0
    );
}

/* ───────────── shared primitive logic ───────────── */

function insert(
    s: ArrayState,
    index: number | undefined,
    value: Primitive | undefined,
    ran: string,
): Outcome {
    const len = s.items.length;
    const at = index ?? len;
    const v = value === undefined ? null : value;
    if (!inRange(at, len, true)) return reject(s, ran, badIndex(at, len, true));
    if (!isPrimitive(v))
        return reject(
            s,
            ran,
            "Only strings, numbers, booleans and null are supported.",
        );
    if (len >= MAX_ITEMS)
        return reject(
            s,
            ran,
            `The lab limits the array to ${MAX_ITEMS} cells so it stays readable.`,
        );

    const item = { id: `e${s.counters.item}`, value: v };
    const shifted = len - at;
    const next: ArrayState = {
        ...s,
        items: [...s.items.slice(0, at), item, ...s.items.slice(at)],
        counters: { ...s.counters, item: s.counters.item + 1 },
    };
    return accept(
        next,
        ex(
            ran,
            `Index ${at} now holds ${fmt(v)}${v === null ? " (null is a real value, not an empty cell)" : ""}.`,
            `Length ${len} → ${len + 1}.` +
                (shifted > 0
                    ? ` ${shifted} element(s) moved right by one.`
                    : "") +
                (shifted > 0 && s.pointers.length
                    ? " Marks keep their numeric index, so they may now point at a different element."
                    : ""),
            "Elements before the insertion point; markers (they follow their elements).",
        ),
        { kind: "insert", id: item.id },
        { label: "Inserted", value: v },
    );
}

function remove(
    s: ArrayState,
    index: number,
    ran: string,
    resultLabel: string,
): Outcome {
    const len = s.items.length;
    if (!inRange(index, len)) return reject(s, ran, badIndex(index, len));

    const gone = s.items[index];
    const highlights = { ...s.highlights };
    delete highlights[gone.id];
    const next: ArrayState = {
        ...s,
        items: s.items.filter((_, i) => i !== index), // dense array, no holes
        markers: s.markers.filter((m) => m.itemId !== gone.id),
        arrows: s.arrows.filter(
            (a) => a.toItemId !== gone.id && a.fromItemId !== gone.id,
        ),
        highlights,
    };
    const dropped = s.markers.length - next.markers.length;
    const droppedArrows = s.arrows.length - next.arrows.length;
    const shifted = len - 1 - index;
    return accept(
        next,
        ex(
            ran,
            `Index ${index} (${fmt(gone.value)}).`,
            `Length ${len} → ${len - 1}.` +
                (shifted > 0
                    ? ` ${shifted} element(s) shifted left to close the gap.`
                    : "") +
                (dropped > 0
                    ? ` ${dropped} marker(s) on the removed element were removed.`
                    : "") +
                (droppedArrows > 0
                    ? ` ${droppedArrows} arrow(s) attached to it were removed.`
                    : ""),
            "Elements before the index; Marks keep their numeric index.",
        ),
        { kind: "remove", ghost: { item: gone, index }, prev: s },
        { label: resultLabel, value: gone.value },
    );
}

function movePointer(
    s: ArrayState,
    name: string,
    target: number,
    ran: string,
): Outcome {
    const p = s.pointers.find((x) => x.name === name);
    if (!p) return reject(s, ran, `Mark ${name} does not exist.`);
    const len = s.items.length;
    if (!inRange(target, len))
        return reject(
            s,
            ran,
            `Mark ${name} cannot move to ${target}: ${badIndex(target, len).replace(/^Index \S+ is invalid: /, "")} Marks never wrap around or clamp.`,
        );
    return accept(
        {
            ...s,
            pointers: s.pointers.map((x) =>
                x === p ? { ...x, index: target } : x,
            ),
        },
        ex(
            ran,
            `Mark ${name}, now at index ${target} (${fmt(s.items[target].value)}).`,
            `Mark ${name}: index ${p.index} → ${target}.`,
            "All array values, order, length and markers.",
        ),
        { kind: "pointer", name },
        { label: `Mark ${name} index`, value: target },
    );
}

/* ───────────── dispatcher ───────────── */

export function applyOp(s: ArrayState, op: Op, self: string = ARRAY_ID): Outcome {
    const ran = callText(op);
    const len = s.items.length;

    switch (op.type) {
        case "add":
            return insert(s, op.index, op.value, ran);
        case "append":
            return insert(s, undefined, op.value, ran);
        case "prepend":
            return insert(s, 0, op.value, ran);
        case "insertAt":
            return insert(s, op.index, op.value, ran);

        case "delete":
            return remove(s, op.index, ran, "Removed value");
        case "pop":
            return len === 0
                ? reject(
                      s,
                      ran,
                      "The array is empty, so there is nothing to pop.",
                  )
                : remove(s, len - 1, ran, "Popped value");
        case "shift":
            return len === 0
                ? reject(
                      s,
                      ran,
                      "The array is empty, so there is nothing to shift.",
                  )
                : remove(s, 0, ran, "Shifted value");

        case "update": {
            if (!inRange(op.index, len))
                return reject(s, ran, badIndex(op.index, len));
            if (!isPrimitive(op.value))
                return reject(
                    s,
                    ran,
                    "Only strings, numbers, booleans and null are supported.",
                );
            const old = s.items[op.index];
            const items = s.items.map((it, i) =>
                i === op.index ? { ...it, value: op.value } : it,
            );
            return accept(
                { ...s, items },
                ex(
                    ran,
                    `Index ${op.index}.`,
                    `Value ${fmt(old.value)} → ${fmt(op.value)}.`,
                    `Length (${len}), every other element, and all markers and Marks.`,
                ),
                { kind: "update", id: old.id, oldValue: old.value },
                { label: "Replaced value", value: old.value },
            );
        }

        case "read": {
            if (!inRange(op.index, len))
                return reject(s, ran, badIndex(op.index, len));
            const it = s.items[op.index];
            return accept(
                s,
                ex(
                    ran,
                    `Index ${op.index}.`,
                    READ_ONLY,
                    "The whole array, markers and Marks.",
                ),
                { kind: "read", id: it.id },
                { label: `Value at index ${op.index}`, value: it.value },
            );
        }

        /* markers (lowercase mark): follow elements */
        case "mark": {
            if (!inRange(op.index, len))
                return reject(s, ran, badIndex(op.index, len));
            const custom = op.name?.trim();
            if (custom) {
                if (!MARKER_NAME_RE.test(custom))
                    return reject(s, ran, MARKER_NAME_HELP);
                if (markerNameTaken(s, custom))
                    return reject(
                        s,
                        ran,
                        `A marker named ${custom} already exists.`,
                    );
            }
            // id is always unique and never collides with an existing marker's name
            let n = s.counters.marker;
            while (s.markers.some((m) => m.name === `m${n}`)) n++;
            const id = `m${n}`;
            const name = custom || id;
            const it = s.items[op.index];
            return accept(
                {
                    ...s,
                    markers: [...s.markers, { id, itemId: it.id, name }],
                    counters: { ...s.counters, marker: n + 1 },
                },
                ex(
                    ran,
                    `Index ${op.index} (${fmt(it.value)}).`,
                    `Marker ${name} now sticks to this element and follows it if it shifts.`,
                    "Array values, order and length.",
                ),
                { kind: "markerIn", id },
                { label: "Created marker", value: name },
            );
        }
        case "deleteMark": {
            const m = findMarker(s, op.markId);
            if (!m)
                return reject(
                    s,
                    ran,
                    op.markId
                        ? `No marker "${op.markId}".`
                        : "There are no markers to delete.",
                );
            return accept(
                { ...s, markers: s.markers.filter((x) => x !== m) },
                ex(
                    ran,
                    `Marker ${m.name}.`,
                    `Marker ${m.name} was removed.`,
                    "The element it pointed at and all array data.",
                ),
                {
                    kind: "markerOut",
                    itemId: m.itemId,
                    markerId: m.id,
                    name: m.name,
                },
            );
        }
        case "readMark": {
            const m = findMarker(s, op.markId);
            if (!m)
                return reject(
                    s,
                    ran,
                    op.markId
                        ? `No marker "${op.markId}".`
                        : "There are no markers to read.",
                );
            const index = s.items.findIndex((x) => x.id === m.itemId);
            if (index < 0)
                return reject(
                    s,
                    ran,
                    `Marker ${m.name} no longer has an element.`,
                );
            return accept(
                s,
                ex(
                    ran,
                    `Marker ${m.name}.`,
                    READ_ONLY,
                    "The whole array, markers and Marks.",
                ),
                { kind: "read", id: m.itemId },
                {
                    label: `Marker ${m.name}`,
                    value: { index, value: s.items[index].value },
                },
            );
        }
        case "moveMarkToIndex": {
            const m = findMarker(s, op.markId);
            if (!m) return reject(s, ran, `No marker "${op.markId}".`);
            if (!inRange(op.index, len))
                return reject(s, ran, badIndex(op.index, len));
            const target = s.items[op.index];
            return accept(
                {
                    ...s,
                    markers: s.markers.map((x) =>
                        x === m ? { ...x, itemId: target.id } : x,
                    ),
                },
                ex(
                    ran,
                    `Marker ${m.name} → index ${op.index} (${fmt(target.value)}).`,
                    `Marker ${m.name} is now attached to a different element.`,
                    "Array values, order and length.",
                ),
                { kind: "markerIn", id: m.id },
            );
        }
        case "renameMarker": {
            const m = findMarker(s, op.markId);
            if (!m)
                return reject(
                    s,
                    ran,
                    op.markId
                        ? `No marker "${op.markId}".`
                        : "There are no markers to rename.",
                );
            const name = op.name.trim();
            if (!MARKER_NAME_RE.test(name))
                return reject(s, ran, MARKER_NAME_HELP);
            if (name === m.name)
                return reject(s, ran, `Marker is already named ${name}.`);
            if (markerNameTaken(s, name, m.id))
                return reject(s, ran, `A marker named ${name} already exists.`);
            return accept(
                {
                    ...s,
                    markers: s.markers.map((x) =>
                        x === m ? { ...x, name } : x,
                    ),
                },
                ex(
                    ran,
                    `Marker ${m.name}.`,
                    `Marker renamed ${m.name} → ${name}.`,
                    "The element it sticks to, all array data, and every other marker.",
                ),
                { kind: "markerRename", id: m.id, from: m.name },
                { label: "Renamed marker", value: `${m.name} → ${name}` },
            );
        }
        case "renameMark": {
            const p = s.pointers.find((x) => x.name === op.from);
            if (!p) return reject(s, ran, `Mark ${op.from} does not exist.`);
            if (!NAME_RE.test(op.to)) return reject(s, ran, MARK_NAME_HELP);
            if (op.to === op.from)
                return reject(s, ran, `Mark is already named ${op.to}.`);
            if (s.pointers.some((x) => x.name === op.to))
                return reject(s, ran, `Mark ${op.to} already exists.`);
            return accept(
                {
                    ...s,
                    pointers: s.pointers.map((x) =>
                        x === p ? { ...x, name: op.to } : x,
                    ),
                },
                ex(
                    ran,
                    `Mark ${op.from} (index ${p.index}).`,
                    `Mark renamed ${op.from} → ${op.to}.`,
                    "Its index, all array data and markers.",
                ),
                { kind: "pointerRename", from: op.from, to: op.to },
                { label: "Renamed Mark", value: `${op.from} → ${op.to}` },
            );
        }

        /* Marks (capital): follow indices */
        case "createMark": {
            if (!NAME_RE.test(op.name)) return reject(s, ran, MARK_NAME_HELP);
            if (s.pointers.some((p) => p.name === op.name))
                return reject(s, ran, `Mark ${op.name} already exists.`);
            if (!inRange(op.index, len))
                return reject(s, ran, badIndex(op.index, len));
            return accept(
                {
                    ...s,
                    pointers: [
                        ...s.pointers,
                        { name: op.name, index: op.index },
                    ],
                },
                ex(
                    ran,
                    `Index ${op.index}.`,
                    `Mark ${op.name} created at index ${op.index}.`,
                    "Array data and markers.",
                ),
                { kind: "pointer", name: op.name },
                { label: `Mark ${op.name}`, value: op.index },
            );
        }
        case "removeMark": {
            if (!s.pointers.some((p) => p.name === op.name))
                return reject(s, ran, `Mark ${op.name} does not exist.`);
            return accept(
                {
                    ...s,
                    pointers: s.pointers.filter((p) => p.name !== op.name),
                },
                ex(
                    ran,
                    `Mark ${op.name}.`,
                    `Mark ${op.name} removed.`,
                    "Array data and markers.",
                ),
                { kind: "dismiss", prev: s },
            );
        }
        case "moveMarkOne": {
            const name = op.name ?? DEFAULT_MARK;
            const p = s.pointers.find((x) => x.name === name);
            if (!p) return reject(s, ran, `Mark ${name} does not exist.`);
            return movePointer(
                s,
                name,
                p.index + (op.direction === "left" ? -1 : 1),
                ran,
            );
        }
        case "moveMarkBy": {
            const name = op.name ?? DEFAULT_MARK;
            const p = s.pointers.find((x) => x.name === name);
            if (!p) return reject(s, ran, `Mark ${name} does not exist.`);
            if (!Number.isInteger(op.steps) || op.steps === 0)
                return reject(s, ran, "steps must be a non-zero whole number.");
            return movePointer(s, name, p.index + op.steps, ran);
        }
        case "moveMarkTo":
            return movePointer(s, op.name ?? DEFAULT_MARK, op.index, ran);

        /* visual annotations */
        case "highlight": {
            if (!inRange(op.index, len))
                return reject(s, ran, badIndex(op.index, len));
            if (!HEX_RE.test(op.color)) return reject(s, ran, COLOR_HELP);
            const it = s.items[op.index];
            return accept(
                {
                    ...s,
                    highlights: {
                        ...s.highlights,
                        [it.id]: op.color.toUpperCase(),
                    },
                },
                ex(
                    ran,
                    `Index ${op.index}.`,
                    `Cell filled with ${op.color.toUpperCase()}.`,
                    "Array values, order and length.",
                ),
                { kind: "highlight", id: it.id },
            );
        }
        case "clearHighlight": {
            const ids =
                op.index === undefined
                    ? Object.keys(s.highlights)
                    : inRange(op.index, len)
                      ? [s.items[op.index].id]
                      : null;
            if (ids === null) return reject(s, ran, badIndex(op.index, len));
            const present = ids.filter((id) => id in s.highlights);
            if (present.length === 0)
                return reject(s, ran, "There is no highlight to clear.");
            const highlights = { ...s.highlights };
            present.forEach((id) => delete highlights[id]);
            return accept(
                { ...s, highlights },
                ex(
                    ran,
                    op.index === undefined
                        ? "All cells."
                        : `Index ${op.index}.`,
                    `${present.length} highlight(s) removed.`,
                    "Array values, order and length.",
                ),
            );
        }
        case "pointArrow": {
            if (op.arr !== self)
                return reject(s, ran, unknownArray(op.arr, self));
            if (!inRange(op.index, len))
                return reject(s, ran, badIndex(op.index, len));
            const color = (op.color ?? ARROW_POINT_COLOR).toUpperCase();
            if (!HEX_RE.test(color)) return reject(s, ran, COLOR_HELP);
            const it = s.items[op.index];
            const id = `a${s.counters.arrow}`;
            return accept(
                {
                    ...s,
                    arrows: [
                        ...s.arrows,
                        { id, fromItemId: null, toItemId: it.id, color },
                    ],
                    counters: { ...s.counters, arrow: s.counters.arrow + 1 },
                },
                ex(
                    ran,
                    `Index ${op.index}.`,
                    `A ${color} arrow now points at index ${op.index}.`,
                    "Array values, order and length.",
                ),
                { kind: "arrow", id },
            );
        }
        case "pointArrowFromTo": {
            if (op.arr1 !== self)
                return reject(s, ran, unknownArray(op.arr1, self));
            if (op.arr2 !== self)
                return reject(s, ran, unknownArray(op.arr2, self));
            if (!inRange(op.index1, len))
                return reject(s, ran, badIndex(op.index1, len));
            if (!inRange(op.index2, len))
                return reject(s, ran, badIndex(op.index2, len));
            if (op.index1 === op.index2)
                return reject(
                    s,
                    ran,
                    "The arrow's start and end are the same cell.",
                );
            const color = (op.color ?? ARROW_LINK_COLOR).toUpperCase();
            if (!HEX_RE.test(color)) return reject(s, ran, COLOR_HELP);
            const id = `a${s.counters.arrow}`;
            return accept(
                {
                    ...s,
                    arrows: [
                        ...s.arrows,
                        {
                            id,
                            fromItemId: s.items[op.index1].id,
                            toItemId: s.items[op.index2].id,
                            color,
                        },
                    ],
                    counters: { ...s.counters, arrow: s.counters.arrow + 1 },
                },
                ex(
                    ran,
                    `Indices ${op.index1} → ${op.index2}.`,
                    `A ${color} arrow now runs from index ${op.index1} to index ${op.index2}.`,
                    "Array values, order and length.",
                ),
                { kind: "arrow", id },
            );
        }
        case "recolorArrows": {
            if (!HEX_RE.test(op.color)) return reject(s, ran, COLOR_HELP);
            const color = op.color.toUpperCase();
            let targets = s.arrows;
            if (op.index !== undefined) {
                if (!inRange(op.index, len))
                    return reject(s, ran, badIndex(op.index, len));
                const id = s.items[op.index].id;
                targets = s.arrows.filter(
                    (a) => a.toItemId === id || a.fromItemId === id,
                );
            }
            if (targets.length === 0)
                return reject(
                    s,
                    ran,
                    op.index === undefined
                        ? "There are no arrows to recolor."
                        : `No arrow touches index ${op.index}.`,
                );
            const ids = new Set(targets.map((a) => a.id));
            return accept(
                {
                    ...s,
                    arrows: s.arrows.map((a) =>
                        ids.has(a.id) ? { ...a, color } : a,
                    ),
                },
                ex(
                    ran,
                    op.index === undefined
                        ? "All arrows."
                        : `Arrows touching index ${op.index}.`,
                    `${targets.length} arrow(s) recolored to ${color}.`,
                    "Array values, order, length and arrow positions.",
                ),
            );
        }
        case "clearArrows": {
            if (s.arrows.length === 0)
                return reject(s, ran, "There are no arrows to clear.");
            return accept(
                { ...s, arrows: [] },
                ex(
                    ran,
                    "All arrows.",
                    `${s.arrows.length} arrow(s) removed.`,
                    "Array values, order and length.",
                ),
                { kind: "dismiss", prev: s },
            );
        }

        /* other mutations */
        case "swap": {
            if (!inRange(op.indexA, len))
                return reject(s, ran, badIndex(op.indexA, len));
            if (!inRange(op.indexB, len))
                return reject(s, ran, badIndex(op.indexB, len));
            if (op.indexA === op.indexB)
                return reject(
                    s,
                    ran,
                    "Both indices are the same, so swapping would change nothing.",
                );
            const items = [...s.items];
            [items[op.indexA], items[op.indexB]] = [
                items[op.indexB],
                items[op.indexA],
            ];
            return accept(
                { ...s, items },
                ex(
                    ran,
                    `Indices ${op.indexA} and ${op.indexB}.`,
                    `${fmt(s.items[op.indexA].value)} and ${fmt(s.items[op.indexB].value)} traded places.`,
                    "Length and all other elements. Markers travelled with their elements; Marks kept their numeric index.",
                ),
                {
                    kind: "swap",
                    a: s.items[op.indexA].id,
                    b: s.items[op.indexB].id,
                },
            );
        }
        case "clear": {
            if (isPristineEmpty(s))
                return reject(s, ran, "The stage is already empty.");
            const extraMarks = s.pointers.filter(
                (p) => p.name !== DEFAULT_MARK,
            ).length;
            return accept(
                {
                    ...s,
                    items: [],
                    markers: [],
                    arrows: [],
                    highlights: {},
                    pointers: [{ name: DEFAULT_MARK, index: 0 }],
                },
                ex(
                    ran,
                    len > 0 ? `All ${len} element(s).` : "Everything on the stage.",
                    `Length ${len} → 0. ` +
                        `${s.markers.length} marker(s), ${s.arrows.length} arrow(s) and ${Object.keys(s.highlights).length} highlight(s) were removed with the elements. ` +
                        (extraMarks > 0
                            ? `${extraMarks} extra Mark(s) were deleted and `
                            : "") +
                        `Mark ${DEFAULT_MARK} returned to index 0.`,
                    "The operation log.",
                ),
                { kind: "clear", prev: s },
            );
        }
        case "initialize": {
            if (
                !Array.isArray(op.values) ||
                op.values.length > MAX_ITEMS ||
                !op.values.every(isPrimitive)
            )
                return reject(
                    s,
                    ran,
                    `Provide a JSON array of at most ${MAX_ITEMS} strings, numbers, booleans or null.`,
                );
            const values = op.values as Primitive[];
            return accept(
                {
                    items: values.map((value, k) => ({
                        id: `e${s.counters.item + k}`,
                        value,
                    })),
                    markers: [],
                    pointers: [{ name: DEFAULT_MARK, index: 0 }],
                    highlights: {},
                    arrows: [],
                    counters: {
                        ...s.counters,
                        item: s.counters.item + values.length,
                    },
                },
                ex(
                    ran,
                    `All ${values.length} new element(s).`,
                    `Array replaced: ${fmtList(valuesOf(s))} → ${fmtList(values)}. Markers, arrows and highlights cleared; Mark P reset to 0.`,
                    "The operation log.",
                ),
                { kind: "reset" },
            );
        }
        case "reset":
            return accept(
                createState(),
                ex(
                    ran,
                    "The whole array.",
                    `Restored the starter array ${fmtList(STARTER)}; markers, extra Marks, arrows and highlights cleared.`,
                    "The operation log.",
                ),
                { kind: "reset" },
            );

        /* read-only info */
        case "getLength":
            return accept(
                s,
                ex(ran, "The whole array.", READ_ONLY, "Everything."),
                NONE,
                { label: "Length", value: len },
            );
        case "isEmpty":
            return accept(
                s,
                ex(ran, "The whole array.", READ_ONLY, "Everything."),
                NONE,
                { label: "Is empty?", value: len === 0 },
            );
    }
}