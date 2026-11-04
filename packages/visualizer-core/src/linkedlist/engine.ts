import { HEX_RE, isPrimitive } from "../core/validate";
import {
    ARROW_DEFAULT_COLOR,
    LIST_ID,
    MAX_NODES,
    TYPE_LABEL,
    createList,
    describe,
    hasAnnotations,
    lengthOf,
    orderOf,
    relink,
} from "./model";
import { lowestFreeId } from "../shared/ids";
import { buildSteps, type StepHint } from "./steps";
import type { Anim, Explain, ListOp, ListState, ListType, Outcome, Primitive, Step } from "./types";
import { MARKER_HELP, NAME_RE } from "./validate";

const NONE: Anim = { kind: "none" };
const COLOR_HELP = "Color must look like #RRGGBB, e.g. #FF430F.";
const READ_ONLY = "Nothing. This is a read-only operation, so the list did not change.";
const ALL_SAME = "Every node, every pointer, HEAD, TAIL, marks, highlights and arrows.";

export const fmt = (v: unknown) => JSON.stringify(v);

export function callText(op: ListOp): string {
    const { type, ...rest } = op;
    if (type === "initialize") {
        const n = (op as Extract<ListOp, { type: "initialize" }>).values.length;
        return `initialize(${n} ${n === 1 ? "value" : "values"})`;
    }
    const args = Object.values(rest)
        .filter((v) => v !== undefined)
        .map((v) => JSON.stringify(v))
        .join(", ");
    return `${type}(${args})`;
}

const ex = (ran: string, affected: string, changed: string, unchanged: string): Explain => ({ ran, affected, changed, unchanged });

function reject(s: ListState, ran: string, error: string): Outcome {
    return {
        ok: false,
        state: s,
        anim: NONE,
        steps: [],
        error,
        explain: ex(`${ran} (rejected)`, "Nothing.", error, "Everything: nodes, pointers, HEAD, TAIL, marks and arrows are exactly as before."),
    };
}

function accept(state: ListState, explain: Explain, anim: Anim = NONE, steps: Step[] = [], result?: Outcome["result"], select?: string | null): Outcome {
    return { ok: true, state, explain, anim, steps, result, select };
}

const stepsText = (steps: Step[]) => (steps.length ? steps.map((x) => x.text).join("; ") + "." : "No pointer changed.");
const badIndex = (i: unknown, n: number, allowEnd = false) =>
    !Number.isInteger(i)
        ? "Index must be a whole number."
        : n === 0 && !allowEnd
          ? `Index ${i} is invalid: the list is empty, so there is no valid index.`
          : `Index ${i} is invalid: valid indices are 0..${allowEnd ? n : n - 1}.`;
const inRange = (i: unknown, n: number, allowEnd = false): i is number =>
    Number.isInteger(i) && (i as number) >= 0 && (i as number) < n + (allowEnd ? 1 : 0);

const where = (order: string[], index: number) => {
    const n = order.length;
    if (n === 0) return "into the empty list";
    if (index === 0) return `at the head, before ${order[0]}`;
    if (index === n) return `at the tail, after ${order[n - 1]}`;
    return `between ${order[index - 1]} and ${order[index]}`;
};
const nodeNotFound = (s: ListState, id: string) => {
    const ids = orderOf(s);
    return ids.length
        ? `No node has the id "${id}". Existing ids: ${ids.join(", ")}.`
        : `No node has the id "${id}": the list is empty.`;
};

/* ───────────── shared primitives: every convenience operation calls these ───────────── */

function insertAtPrimitive(s: ListState, ran: string, index: number, value: Primitive | undefined, label: string): Outcome {
    const order = orderOf(s);
    const n = order.length;
    const v = value === undefined ? null : value;
    if (!isPrimitive(v)) return reject(s, ran, "Only strings, numbers, booleans and null are supported.");
    if (!inRange(index, n, true)) return reject(s, ran, badIndex(index, n, true));
    if (n >= MAX_NODES) return reject(s, ran, `The lab limits the list to ${MAX_NODES} nodes so it stays readable.`);

    const id = lowestFreeId(Object.keys(s.nodes)); // the lowest free number: delete n6 and the next node is n6 again
    const nodes = { ...s.nodes, [id]: { id, value: v, next: null, prev: null } };
    const newOrder = [...order.slice(0, index), id, ...order.slice(index)];
    const next = relink(s, newOrder, s.type, nodes);
    const steps = buildSteps(s, next, { mode: "insert", id });
    return accept(
        next,
        ex(
            ran,
            `New node ${id} (${fmt(v)}${v === null ? ", null is a real value" : ""}) was created and placed at index ${index}, ${where(order, index)}.`,
            `Length ${n} → ${n + 1}. Pointer changes: ${stepsText(steps)}`,
            n === 0
                ? "Nothing else existed."
                : `No existing node was copied or moved in memory: only pointers changed. All ${n} existing nodes keep their ids, values and marks.`,
        ),
        { kind: "insert", id, index, steps },
        steps,
        { label, value: { id, index, value: v } },
    );
}

function deleteAtPrimitive(s: ListState, ran: string, index: number, label: string): Outcome {
    const order = orderOf(s);
    const n = order.length;
    if (n === 0) return reject(s, ran, "The list is empty, so there is nothing to delete.");
    if (!inRange(index, n)) return reject(s, ran, badIndex(index, n));
    const id = order[index];
    const gone = s.nodes[id];
    const newOrder = order.filter((x) => x !== id);
    const highlights = { ...s.highlights };
    delete highlights[id];
    const base: ListState = {
        ...s,
        markers: s.markers.filter((m) => m.nodeId !== id),
        highlights,
        arrows: s.arrows.filter((a) => a.toId !== id && a.fromId !== id),
    };
    const next = relink(base, newOrder);
    const steps = buildSteps(s, next, { mode: "delete", id });
    const lostMarks = s.markers.filter((m) => m.nodeId === id).length;
    return accept(
        next,
        ex(
            ran,
            `Node ${id} (${fmt(gone.value)}) at index ${index}${index === 0 ? ", the head" : index === n - 1 ? ", the tail" : ""}.`,
            `Length ${n} → ${n - 1}. The deleted node was ${id} holding ${fmt(gone.value)}. Pointer changes: ${stepsText(steps)}` +
                (lostMarks ? ` ${lostMarks} marker(s) on it were removed.` : ""),
            n === 1 ? "The list is now empty." : `The other ${n - 1} nodes keep their ids, values and marks; none was copied or moved in memory.`,
        ),
        { kind: "delete", ghost: { id, index }, prev: s, steps },
        steps,
        { label, value: { deleted: { id, value: gone.value, index }, length: n - 1 } },
        null,
    );
}

/** Reverse / swap / type change: a new order (or type) and the pointer steps that get there. */
function rewirePrimitive(
    s: ListState,
    ran: string,
    what: "reverse" | "swap" | "retype",
    order: string[],
    type: ListType,
    ids: string[],
    affected: string,
    unchanged: string,
): Outcome {
    const next = relink(s, order, type);
    const hint: StepHint = { mode: "generic" };
    const steps = buildSteps(s, next, hint);
    return accept(
        next,
        ex(ran, affected, `Pointer changes: ${stepsText(steps)}`, unchanged),
        { kind: "rewire", what, ids, steps, prev: s },
        steps,
    );
}

/* ───────────── lookups ───────────── */

function nodeAt(s: ListState, index: number) {
    const id = orderOf(s)[index];
    return { id, node: s.nodes[id] };
}
const view = (s: ListState, index: number) => {
    const { id, node } = nodeAt(s, index);
    return { index, id, value: node.value, next: node.next ?? "NULL", prev: s.type === "dll" ? (node.prev ?? "NULL") : "(none: this list has no prev pointer)" };
};

function target(s: ListState, ran: string, index: number | undefined): { index: number; id: string } | Outcome {
    const n = lengthOf(s);
    if (n === 0) return reject(s, ran, "The list is empty, so there is no node to use.");
    const i = index ?? 0;
    if (!inRange(i, n)) return reject(s, ran, badIndex(i, n));
    return { index: i, id: orderOf(s)[i] };
}
const isOutcome = (x: unknown): x is Outcome => typeof x === "object" && x !== null && "explain" in x;

/* ───────────── dispatcher ───────────── */

export function applyOp(s: ListState, op: ListOp, self: string = LIST_ID): Outcome {
    const ran = callText(op);
    const order = orderOf(s);
    const n = order.length;

    switch (op.type) {
        /* convenience operations: thin wrappers over the shared primitives */
        case "append":
            return insertAtPrimitive(s, ran, n, op.value, "Appended");
        case "prepend":
            return insertAtPrimitive(s, ran, 0, op.value, "Prepended");
        case "insertAt":
            return insertAtPrimitive(s, ran, op.index, op.value, "Inserted");
        case "insertAfter": {
            const i = order.indexOf(op.nodeId);
            if (i < 0) return reject(s, ran, nodeNotFound(s, op.nodeId));
            return insertAtPrimitive(s, ran, i + 1, op.value, "Inserted after");
        }
        case "insertBefore": {
            const i = order.indexOf(op.nodeId);
            if (i < 0) return reject(s, ran, nodeNotFound(s, op.nodeId));
            return insertAtPrimitive(s, ran, i, op.value, "Inserted before");
        }
        case "delete":
            return deleteAtPrimitive(s, ran, op.index, "Deleted");
        case "deleteHead":
            return n === 0 ? reject(s, ran, "The list is empty, so there is no head to delete.") : deleteAtPrimitive(s, ran, 0, "Deleted head");
        case "deleteTail":
            return n === 0 ? reject(s, ran, "The list is empty, so there is no tail to delete.") : deleteAtPrimitive(s, ran, n - 1, "Deleted tail");
        case "deleteById": {
            const i = order.indexOf(op.nodeId);
            if (i < 0) return reject(s, ran, nodeNotFound(s, op.nodeId));
            return deleteAtPrimitive(s, ran, i, "Deleted");
        }

        case "update": {
            if (!inRange(op.index, n)) return reject(s, ran, badIndex(op.index, n));
            if (!isPrimitive(op.value)) return reject(s, ran, "Only strings, numbers, booleans and null are supported.");
            const { id, node } = nodeAt(s, op.index);
            return accept(
                { ...s, nodes: { ...s.nodes, [id]: { ...node, value: op.value } } },
                ex(ran, `Node ${id} at index ${op.index}.`, `Value ${fmt(node.value)} → ${fmt(op.value)}. No pointer changed.`, "Length, every pointer, HEAD, TAIL, node ids, marks, highlights and arrows."),
                { kind: "update", id, oldValue: node.value },
                [],
                { label: "Replaced value", value: { id, index: op.index, old: node.value, new: op.value } },
            );
        }
        case "read": {
            if (!inRange(op.index, n)) return reject(s, ran, badIndex(op.index, n));
            const v = view(s, op.index);
            return accept(
                s,
                ex(ran, `Node ${v.id} at index ${op.index}: value ${fmt(v.value)}, next → ${v.next}.`, READ_ONLY, ALL_SAME),
                { kind: "read", id: v.id },
                [],
                { label: `Node at index ${op.index}`, value: v },
                v.id,
            );
        }
        case "findById": {
            const i = order.indexOf(op.nodeId);
            if (i < 0) return reject(s, ran, nodeNotFound(s, op.nodeId));
            const v = view(s, i);
            return accept(
                s,
                ex(ran, `Node ${v.id} was found by id at index ${i}: value ${fmt(v.value)}.`, READ_ONLY, ALL_SAME),
                { kind: "read", id: v.id },
                [],
                { label: `Node ${op.nodeId}`, value: { found: true, ...v } },
                v.id,
            );
        }
        case "getLength":
            return accept(s, ex(ran, "The whole list.", READ_ONLY, ALL_SAME), NONE, [], { label: "Length", value: n });
        case "isEmpty":
            return accept(s, ex(ran, "The whole list.", READ_ONLY, ALL_SAME), NONE, [], { label: "Is empty?", value: n === 0 });

        case "reverse": {
            if (n < 2)
                return accept(s, ex(ran, n === 0 ? "The list is empty." : "The list has a single node.", "Nothing: reversing fewer than 2 nodes changes no pointer.", ALL_SAME), NONE, [], { label: "Reversed", value: false });
            return rewirePrimitive(
                s,
                ran,
                "reverse",
                [...order].reverse(),
                s.type,
                order,
                `All ${n} nodes: every pointer is redirected the other way, and HEAD and TAIL trade places.`,
                "Every node's id and value, the marks (they stay on their nodes), and the length.",
            );
        }
        case "swap": {
            if (!inRange(op.indexA, n)) return reject(s, ran, badIndex(op.indexA, n));
            if (!inRange(op.indexB, n)) return reject(s, ran, badIndex(op.indexB, n));
            if (op.indexA === op.indexB) return reject(s, ran, "Both indices are the same, so swapping would change nothing.");
            const o = [...order];
            [o[op.indexA], o[op.indexB]] = [o[op.indexB], o[op.indexA]];
            return rewirePrimitive(
                s,
                ran,
                "swap",
                o,
                s.type,
                [order[op.indexA], order[op.indexB]],
                `Nodes ${order[op.indexA]} (index ${op.indexA}) and ${order[op.indexB]} (index ${op.indexB}) trade places by rewiring their neighbours' pointers.`,
                "Every node's id and value, the marks (they travel with their nodes), and the length.",
            );
        }
        case "setType": {
            if (op.to === s.type) return reject(s, ran, `The list is already a ${TYPE_LABEL[s.type].toLowerCase()}.`);
            const what: Record<ListType, string> = {
                sll: "Every prev pointer is dropped and the last node points to NULL.",
                dll: "Every node gains a prev pointer and the last node points to NULL.",
                cll: "The last node's next pointer is redirected from NULL to the head. Any prev pointers are dropped.",
            };
            return rewirePrimitive(
                s,
                ran,
                "retype",
                order,
                op.to,
                [],
                `The list becomes a ${TYPE_LABEL[op.to].toLowerCase()}. ${what[op.to]}`,
                "Node ids, values and order; marks, highlights and arrows.",
            );
        }
        case "clear": {
            if (n === 0) return reject(s, ran, "The list is already empty.");
            return accept(
                { ...s, nodes: {}, head: null, tail: null, markers: [], highlights: {}, arrows: [], cursor: 0 },
                ex(
                    ran,
                    `All ${n} node${n === 1 ? "" : "s"}.`,
                    `Length ${n} → 0. HEAD and TAIL now point to NULL. ${s.markers.length} marker(s), ${s.arrows.length} arrow(s) and ${Object.keys(s.highlights).length} highlight(s) were removed with their nodes; Mark P returned to index 0.`,
                    "The list type and the operation log.",
                ),
                { kind: "clear", prev: s },
                [],
                undefined,
                null,
            );
        }
        case "initialize": {
            if (!Array.isArray(op.values) || op.values.length > MAX_NODES || !op.values.every(isPrimitive))
                return reject(s, ran, `Provide a JSON array of at most ${MAX_NODES} strings, numbers, booleans or null.`);
            const next = createList(s.type, op.values);
            return accept(
                next,
                ex(
                    ran,
                    `${op.values.length} new node${op.values.length === 1 ? "" : "s"}, linked in order as a ${TYPE_LABEL[s.type].toLowerCase()}.`,
                    `List replaced: length ${n} → ${op.values.length}. Markers, highlights and arrows were cleared; Mark P returned to index 0.`,
                    "The list type and the operation log.",
                ),
                { kind: "reset", prev: s },
                [],
                { label: "Length", value: op.values.length },
                null,
            );
        }
        case "reset": {
            const next = createList(s.type);
            return accept(
                next,
                ex(ran, "The whole list.", `Restored the starter list (length ${lengthOf(next)}) as a ${TYPE_LABEL[s.type].toLowerCase()}. Markers, highlights and arrows were cleared.`, "The list type and the operation log."),
                { kind: "reset", prev: s },
                [],
                undefined,
                null,
            );
        }

        /* ── markers (follow nodes) ── */
        case "mark":
        case "createMark": {
            if (!inRange(op.index, n)) return reject(s, ran, badIndex(op.index, n));
            let id: string;
            if (op.type === "createMark") {
                if (!NAME_RE.test(op.markId)) return reject(s, ran, MARKER_HELP);
                if (s.markers.some((m) => m.id === op.markId)) return reject(s, ran, `A marker named ${op.markId} already exists.`);
                id = op.markId;
            } else id = lowestFreeId(s.markers.map((m) => m.id), "m");
            const nodeId = order[op.index];
            return accept(
                { ...s, markers: [...s.markers, { id, nodeId }] },
                ex(ran, `Node ${nodeId} at index ${op.index}.`, `Marker ${id} now sticks to this node and follows it if pointer changes move it.`, "Every node, pointer, HEAD and TAIL."),
                { kind: "markIn", markId: id },
                [],
                { label: "Created marker", value: id },
            );
        }
        case "deleteMark": {
            const m = op.markId ? s.markers.find((x) => x.id === op.markId) : s.markers[s.markers.length - 1];
            if (!m) return reject(s, ran, op.markId ? `No marker "${op.markId}".` : "There are no markers to delete.");
            return accept(
                { ...s, markers: s.markers.filter((x) => x !== m) },
                ex(ran, `Marker ${m.id}.`, `Marker ${m.id} was removed. Node ${m.nodeId} is untouched.`, "Every node, pointer, HEAD and TAIL."),
                { kind: "markOut", nodeId: m.nodeId, markId: m.id },
            );
        }
        case "readMark": {
            const m = op.markId ? s.markers.find((x) => x.id === op.markId) : s.markers[s.markers.length - 1];
            if (!m) return reject(s, ran, op.markId ? `No marker "${op.markId}".` : "There are no markers to read.");
            const i = order.indexOf(m.nodeId);
            if (i < 0) return reject(s, ran, `Marker ${m.id} no longer has a node.`);
            const v = view(s, i);
            return accept(
                s,
                ex(ran, `Marker ${m.id} is on node ${v.id} at index ${i} (value ${fmt(v.value)}).`, READ_ONLY, ALL_SAME),
                { kind: "read", id: v.id },
                [],
                { label: `Marker ${m.id}`, value: v },
                v.id,
            );
        }
        case "moveMarkToIndex": {
            const m = s.markers.find((x) => x.id === op.markId);
            if (!m) return reject(s, ran, `No marker "${op.markId}".`);
            if (!inRange(op.index, n)) return reject(s, ran, badIndex(op.index, n));
            const nodeId = order[op.index];
            return accept(
                { ...s, markers: s.markers.map((x) => (x === m ? { ...x, nodeId } : x)) },
                ex(ran, `Marker ${m.id} → node ${nodeId} at index ${op.index}.`, `Marker ${m.id} is attached to a different node.`, "Every node, pointer, HEAD and TAIL."),
                { kind: "markIn", markId: m.id },
            );
        }

        /* ── Mark P: an index cursor that keeps its index when nodes shift (no wrap, no clamp) ── */
        case "moveMarkOne":
        case "moveMarkBy":
        case "moveMarkTo": {
            if (n === 0) return reject(s, ran, "The list is empty, so Mark P has nowhere to move.");
            const to =
                op.type === "moveMarkOne"
                    ? s.cursor + (op.direction === "left" ? -1 : 1)
                    : op.type === "moveMarkBy"
                      ? s.cursor + op.steps
                      : op.index;
            if (op.type === "moveMarkBy" && (!Number.isInteger(op.steps) || op.steps === 0)) return reject(s, ran, "steps must be a non-zero whole number.");
            if (!inRange(to, n))
                return reject(s, ran, `Mark P cannot move to ${to}: valid indices are 0..${n - 1}. Marks never wrap around, which also keeps circular lists from looping forever.`);
            return accept(
                { ...s, cursor: to },
                ex(ran, `Mark P, now on node ${order[to]} at index ${to} (${fmt(s.nodes[order[to]].value)}).`, `Mark P: index ${s.cursor} → ${to}.`, "Every node, pointer, HEAD and TAIL."),
                { kind: "cursor", from: s.cursor, to },
                [],
                { label: "Mark P index", value: to },
            );
        }

        /* ── annotations ── */
        case "highlight": {
            if (!HEX_RE.test(op.color)) return reject(s, ran, COLOR_HELP);
            const t = target(s, ran, op.index);
            if (isOutcome(t)) return t;
            return accept(
                { ...s, highlights: { ...s.highlights, [t.id]: op.color.toUpperCase() } },
                ex(ran, `Node ${t.id} at index ${t.index}${op.index === undefined ? " (the head, because no index was given)" : ""}.`, `Node filled with ${op.color.toUpperCase()}. It stays until cleared or the node is deleted.`, "Every node, pointer, HEAD and TAIL."),
                { kind: "highlight", id: t.id },
            );
        }
        case "clearHighlights": {
            const c = Object.keys(s.highlights).length;
            if (!c) return reject(s, ran, "There is no highlight to clear.");
            return accept({ ...s, highlights: {} }, ex(ran, "All nodes.", `${c} highlight(s) removed.`, "Nodes, pointers, markers and arrows."));
        }
        case "pointArrow": {
            if (op.list !== self) return reject(s, ran, `List "${op.list}" does not exist. This list is "${self}".`);
            const color = (op.color ?? ARROW_DEFAULT_COLOR).toUpperCase();
            if (!HEX_RE.test(color)) return reject(s, ran, COLOR_HELP);
            const t = target(s, ran, op.index);
            if (isOutcome(t)) return t;
            const id = lowestFreeId(s.arrows.map((a) => a.id), "a");
            return accept(
                { ...s, arrows: [...s.arrows, { id, fromId: null, toId: t.id, color }] },
                ex(ran, `Node ${t.id} at index ${t.index}.`, `A ${color} annotation arrow now points at this node. It is not a list pointer.`, "Every node, pointer, HEAD and TAIL."),
                { kind: "arrow", id },
            );
        }
        case "pointArrowFromTo": {
            if (op.list1 !== self) return reject(s, ran, `List "${op.list1}" does not exist. This list is "${self}".`);
            if (op.list2 !== self) return reject(s, ran, `List "${op.list2}" does not exist. This list is "${self}".`);
            if (!inRange(op.index1, n)) return reject(s, ran, badIndex(op.index1, n));
            if (!inRange(op.index2, n)) return reject(s, ran, badIndex(op.index2, n));
            if (op.index1 === op.index2) return reject(s, ran, "The arrow's start and end are the same node.");
            const color = (op.color ?? "#17A34A").toUpperCase();
            if (!HEX_RE.test(color)) return reject(s, ran, COLOR_HELP);
            const id = lowestFreeId(s.arrows.map((a) => a.id), "a");
            return accept(
                { ...s, arrows: [...s.arrows, { id, fromId: order[op.index1], toId: order[op.index2], color }] },
                ex(ran, `Nodes ${order[op.index1]} → ${order[op.index2]}.`, `A ${color} annotation arrow now runs between them. It is not a list pointer.`, "Every node, pointer, HEAD and TAIL."),
                { kind: "arrow", id },
            );
        }
        case "clearArrows": {
            if (!s.arrows.length) return reject(s, ran, "There are no arrows to clear.");
            return accept(
                { ...s, arrows: [] },
                ex(ran, "All annotation arrows.", `${s.arrows.length} arrow(s) removed. List pointers are not arrows you drew, so they stay.`, "Nodes, pointers, markers and highlights."),
                { kind: "dismiss", prev: s },
            );
        }
    }
}

export { describe, hasAnnotations };
