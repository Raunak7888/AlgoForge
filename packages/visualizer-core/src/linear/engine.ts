import { HEX_RE, isPrimitive } from "../core/validate";
import {
    ARROW_DEFAULT_COLOR,
    MAX_ITEMS,
    createState,
    describe,
    hasAnnotations,
    inWord,
    peekIndex,
    peekWord,
    positionName,
    removeAt,
} from "./model";
import type { Anim, Explain, Kind, LinearOp, LinearState, Outcome, Primitive } from "./types";
import { MARK_ID_HELP, MARK_ID_RE } from "./validate";

const NONE: Anim = { kind: "none" };
const COLOR_HELP = "Color must look like #RRGGBB, e.g. #FF430F.";
const READ_ONLY = "Nothing. This is a read-only operation, so the contents did not change.";
const ALL_SAME = "Every element, its order, marks, highlights and arrows.";

export const fmt = (v: unknown) => JSON.stringify(v);

export function callText(op: LinearOp, kind: Kind): string {
    void kind;
    const { type, ...rest } = op;
    if (type === "initialize") {
        const n = (op as Extract<LinearOp, { type: "initialize" }>).values.length;
        return `initialize(${n} ${n === 1 ? "element" : "elements"})`;
    }
    const args = Object.values(rest)
        .filter((v) => v !== undefined)
        .map((v) => JSON.stringify(v))
        .join(", ");
    return `${type}(${args})`;
}

const ex = (ran: string, affected: string, changed: string, unchanged: string): Explain => ({
    ran,
    affected,
    changed,
    unchanged,
});

function reject(s: LinearState, ran: string, error: string, anim: Anim = NONE): Outcome {
    return {
        ok: false,
        state: s,
        anim,
        error,
        explain: ex(`${ran} (rejected)`, "Nothing.", error, "Everything: elements, order, marks, highlights and arrows are exactly as before."),
    };
}

function accept(state: LinearState, explain: Explain, anim: Anim = NONE, result?: Outcome["result"]): Outcome {
    return { ok: true, state, explain, anim, result };
}

const STACK_ONLY = new Set(["push", "pop"]);
function wrongKind(s: LinearState, ran: string, type: string): Outcome {
    const need = STACK_ONLY.has(type) ? "Stack" : "Queue";
    return reject(s, ran, `${type}() is a ${need} operation. Switch to ${need} to use it.`);
}

const emptyMsg = (s: LinearState, what: string) =>
    s.kind === "stack"
        ? `Stack underflow: the stack is empty, so there is no top to ${what}.`
        : `Queue underflow: the queue is empty, so there is no front to ${what}.`;

/** Resolves an optional position to an element; blank means the peek end. */
function target(s: LinearState, ran: string, index: number | undefined): { index: number; id: string } | Outcome {
    const n = s.items.length;
    if (n === 0) return reject(s, ran, `The ${s.kind} is empty, so there is no element to use.`, { kind: "underflow" });
    const i = index ?? peekIndex(s);
    if (!Number.isInteger(i) || i < 0 || i >= n)
        return reject(s, ran, `Position ${i} is invalid: valid positions are 0..${n - 1} (0 = ${s.kind === "stack" ? "bottom" : "front"}).`);
    return { index: i, id: s.items[i].id };
}
const isOutcome = (x: unknown): x is Outcome => typeof x === "object" && x !== null && "explain" in x;

/* ───────────── add / remove ───────────── */

function addOne(s: LinearState, ran: string, value: Primitive): Outcome {
    if (!isPrimitive(value)) return reject(s, ran, "Only strings, numbers, booleans and null are supported.");
    const n = s.items.length;
    if (n >= MAX_ITEMS)
        return reject(
            s,
            ran,
            `${s.kind === "stack" ? "Stack overflow" : "Queue overflow"}: the lab limits it to ${MAX_ITEMS} elements so it stays readable.`,
            { kind: "overflow" },
        );
    const item = { id: `e${s.counters.item}`, value };
    const next: LinearState = { ...s, items: [...s.items, item], counters: { ...s.counters, item: s.counters.item + 1 } };
    const stack = s.kind === "stack";
    const nullNote = value === null ? " (null is a real value, not an empty slot)" : "";
    return accept(
        next,
        ex(
            ran,
            stack
                ? `${fmt(value)} is placed on the top (index ${n}).${nullNote}`
                : `${fmt(value)} joins at the rear (index ${n}).${nullNote}`,
            stack
                ? `Size ${n} → ${n + 1}. ${fmt(value)} is now the top.`
                : `Size ${n} → ${n + 1}. ${fmt(value)} is now the rear${n === 0 ? " and also the front" : `; the front is still ${fmt(s.items[0].value)}`}.`,
            n === 0
                ? "Nothing else existed, so nothing else could change."
                : stack
                  ? `All ${n} elements below keep their ids, order and marks; nothing moved.`
                  : `All ${n} elements already waiting keep their ids, order and marks; nothing moved.`,
        ),
        { kind: "enter", id: item.id },
        { label: stack ? "Pushed" : "Enqueued", value },
    );
}

function removeOne(s: LinearState, ran: string): Outcome {
    const n = s.items.length;
    const stack = s.kind === "stack";
    if (n === 0) return reject(s, ran, emptyMsg(s, stack ? "pop" : "dequeue"), { kind: "underflow" });
    const index = stack ? n - 1 : 0;
    const gone = s.items[index];
    const next = removeAt(s, index);
    const lostMarks = s.marks.filter((m) => m.itemId === gone.id).length;
    const lostArrows = s.arrows.filter((a) => a.itemId === gone.id).length;
    const tail = (lostMarks ? ` ${lostMarks} mark(s) on it were removed.` : "") + (lostArrows ? ` ${lostArrows} arrow(s) on it were removed.` : "");
    return accept(
        next,
        ex(
            ran,
            stack ? `The top element (index ${index}) holds ${fmt(gone.value)}.` : `The front element (index 0) holds ${fmt(gone.value)}.`,
            stack
                ? `Size ${n} → ${n - 1}. ${fmt(gone.value)} was removed and returned. ${n > 1 ? `The new top is ${fmt(next.items[n - 2].value)}.` : "The stack is now empty."}${tail}`
                : `Size ${n} → ${n - 1}. ${fmt(gone.value)} was removed and returned. ${n > 1 ? `The new front is ${fmt(next.items[0].value)}; every remaining element moved one place toward the front (marks followed them).` : "The queue is now empty."}${tail}`,
            stack
                ? "Elements below the top keep their ids, order, indices and marks."
                : "Order is preserved: the remaining elements keep their ids and relative order.",
        ),
        { kind: "exit", ghost: { item: gone, index }, prev: s },
        { label: stack ? "Popped" : "Dequeued", value: gone.value },
    );
}

/* ───────────── dispatcher ───────────── */

export function applyOp(s: LinearState, op: LinearOp): Outcome {
    const ran = callText(op, s.kind);
    const n = s.items.length;
    const stack = s.kind === "stack";

    switch (op.type) {
        case "push":
            return stack ? addOne(s, ran, op.value) : wrongKind(s, ran, op.type);
        case "enqueue":
            return stack ? wrongKind(s, ran, op.type) : addOne(s, ran, op.value);
        case "pop":
            return stack ? removeOne(s, ran) : wrongKind(s, ran, op.type);
        case "dequeue":
            return stack ? wrongKind(s, ran, op.type) : removeOne(s, ran);

        case "peek": {
            if (n === 0) return reject(s, ran, emptyMsg(s, "peek at"), { kind: "underflow" });
            const i = peekIndex(s);
            const it = s.items[i];
            return accept(
                s,
                ex(ran, `The ${peekWord(s.kind)} element (index ${i}) holds ${fmt(it.value)}.`, READ_ONLY, ALL_SAME),
                { kind: "peek", id: it.id },
                { label: stack ? "Top" : "Front", value: it.value },
            );
        }
        case "isEmpty":
            return accept(s, ex(ran, `The whole ${s.kind}.`, READ_ONLY, ALL_SAME), NONE, { label: "Is empty?", value: n === 0 });
        case "getSize":
            return accept(s, ex(ran, `The whole ${s.kind}.`, READ_ONLY, ALL_SAME), NONE, { label: "Size", value: n });

        case "clear": {
            if (n === 0 && !hasAnnotations(s)) return reject(s, ran, `The ${s.kind} is already empty.`);
            return accept(
                { ...s, items: [], marks: [], highlights: {}, arrows: [] },
                ex(
                    ran,
                    `All ${n} element${n === 1 ? "" : "s"}.`,
                    `Size ${n} → 0. ${s.marks.length} mark(s), ${s.arrows.length} arrow(s) and ${Object.keys(s.highlights).length} highlight(s) were removed with the elements.`,
                    "The operation log.",
                ),
                { kind: "clear", prev: s },
            );
        }
        case "initialize": {
            if (!Array.isArray(op.values) || op.values.length > MAX_ITEMS || !op.values.every(isPrimitive))
                return reject(s, ran, `Provide a JSON array of at most ${MAX_ITEMS} strings, numbers, booleans or null.`);
            const next = createState(s.kind, op.values, s);
            return accept(
                next,
                ex(
                    ran,
                    `${op.values.length} element${op.values.length === 1 ? "" : "s"}, oldest first.`,
                    stack
                        ? `Contents replaced (size ${n} → ${op.values.length}). The first value is the bottom and the last value is the top. Marks, highlights and arrows were cleared.`
                        : `Contents replaced (size ${n} → ${op.values.length}). The first value is the front and the last value is the rear. Marks, highlights and arrows were cleared.`,
                    "The operation log.",
                ),
                { kind: "reset", prev: s },
                { label: "Size", value: op.values.length },
            );
        }
        case "reset": {
            const next = createState(s.kind, undefined, s);
            return accept(
                next,
                ex(ran, `The whole ${s.kind}.`, `Restored the starter ${s.kind} (size ${next.items.length}). Marks, highlights and arrows were cleared.`, "The operation log."),
                { kind: "reset", prev: s },
            );
        }

        /* ── marks ── */
        case "createMark": {
            if (!MARK_ID_RE.test(op.markId)) return reject(s, ran, MARK_ID_HELP);
            if (s.marks.some((m) => m.id === op.markId)) return reject(s, ran, `A mark named ${op.markId} already exists.`);
            const t = target(s, ran, op.index);
            if (isOutcome(t)) return t;
            return accept(
                { ...s, marks: [...s.marks, { id: op.markId, itemId: t.id }] },
                ex(
                    ran,
                    `Index ${t.index} (${fmt(s.items[t.index].value)}), ${positionName(s, t.index)}.`,
                    `Mark ${op.markId} now sticks to this element. It follows it when others are added or removed, and disappears if the element is removed.`,
                    "Contents, order and size.",
                ),
                { kind: "markIn", markId: op.markId },
                { label: "Created mark", value: op.markId },
            );
        }
        case "deleteMark": {
            const m = s.marks.find((x) => x.id === op.markId);
            if (!m) return reject(s, ran, `No mark named "${op.markId}".`);
            return accept(
                { ...s, marks: s.marks.filter((x) => x !== m) },
                ex(ran, `Mark ${m.id}.`, `Mark ${m.id} was removed.`, "The element it pointed at and all contents."),
                { kind: "markOut", itemId: m.itemId, markId: m.id },
            );
        }
        case "readMark": {
            const m = s.marks.find((x) => x.id === op.markId);
            if (!m) return reject(s, ran, `No mark named "${op.markId}".`);
            const index = s.items.findIndex((i) => i.id === m.itemId);
            if (index < 0) return reject(s, ran, `Mark ${m.id} no longer has an element.`);
            return accept(
                s,
                ex(ran, `Mark ${m.id} is on index ${index}, ${positionName(s, index)}.`, READ_ONLY, ALL_SAME),
                { kind: "peek", id: m.itemId },
                { label: `Mark ${m.id}`, value: { index, value: s.items[index].value, position: positionName(s, index) } },
            );
        }

        /* ── annotations ── */
        case "highlight": {
            if (!HEX_RE.test(op.color)) return reject(s, ran, COLOR_HELP);
            const t = target(s, ran, op.index);
            if (isOutcome(t)) return t;
            return accept(
                { ...s, highlights: { ...s.highlights, [t.id]: op.color.toUpperCase() } },
                ex(ran, `Index ${t.index}, ${positionName(s, t.index)}.`, `Element filled with ${op.color.toUpperCase()}. It stays until cleared or the element is removed.`, "Contents, order and size."),
                { kind: "highlight", id: t.id },
            );
        }
        case "pointArrow": {
            const color = (op.color ?? ARROW_DEFAULT_COLOR).toUpperCase();
            if (!HEX_RE.test(color)) return reject(s, ran, COLOR_HELP);
            const t = target(s, ran, op.index);
            if (isOutcome(t)) return t;
            const existing = s.arrows.find((a) => a.itemId === t.id);
            const id = existing?.id ?? `a${s.counters.arrow}`;
            return accept(
                existing
                    ? { ...s, arrows: s.arrows.map((a) => (a === existing ? { ...a, color } : a)) }
                    : { ...s, arrows: [...s.arrows, { id, itemId: t.id, color }], counters: { ...s.counters, arrow: s.counters.arrow + 1 } },
                ex(
                    ran,
                    `Index ${t.index}, ${positionName(s, t.index)}.`,
                    existing ? `The arrow on this element was recolored to ${color}.` : `A ${color} arrow now points at this element.`,
                    "Contents, order and size.",
                ),
                { kind: "arrow", id },
            );
        }
        case "clearHighlights": {
            const c = Object.keys(s.highlights).length;
            if (!c) return reject(s, ran, "There is no highlight to clear.");
            return accept({ ...s, highlights: {} }, ex(ran, "All elements.", `${c} highlight(s) removed.`, "Contents, marks and arrows."));
        }
        case "clearArrows": {
            if (!s.arrows.length) return reject(s, ran, "There are no arrows to clear.");
            return accept(
                { ...s, arrows: [] },
                ex(ran, "All arrows.", `${s.arrows.length} arrow(s) removed.`, "Contents, marks and highlights."),
                { kind: "dismiss", prev: s },
            );
        }
    }
}

export { describe, inWord };
