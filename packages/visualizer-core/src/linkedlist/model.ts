import { freshIds } from "../shared/ids";
import type { ListState, ListType, LNode, Primitive } from "./types";

/**
 * Pure data model: no DOM, no React, no animation.
 *
 * INVARIANTS (checked by checkInvariants, and tested after every operation):
 *   all types   empty <=> head == tail == null; otherwise head and tail are nodes.
 *               Walking `next` from head visits every node exactly once and the last node is tail.
 *   SLL         tail.next === null.   Every prev === null.
 *   DLL         tail.next === null, head.prev === null, and for every node n:
 *               n.next.prev === n  and  n.prev.next === n.
 *   CLL         tail.next === head (a single node points to itself). Every prev === null.
 */

export const MAX_NODES = 12;
export const STARTER: readonly Primitive[] = [10, 20, 30];
export const LIST_ID = "L";
export const ARROW_DEFAULT_COLOR = "#0070F3";
export const TYPE_LABEL: Record<ListType, string> = {
    sll: "Singly linked list",
    dll: "Doubly linked list",
    cll: "Circular linked list",
};

export const lengthOf = (s: ListState) => Object.keys(s.nodes).length;

/** Node ids from head to tail. Bounded by the node count, so a circular list can never loop forever. */
export function orderOf(s: ListState): string[] {
    const n = lengthOf(s);
    const out: string[] = [];
    let cur = s.head;
    while (cur !== null && out.length < n) {
        const node = s.nodes[cur];
        if (!node) break;
        out.push(cur);
        const nx = node.next;
        if (nx === null || nx === s.head) break;
        cur = nx;
    }
    return out;
}

/**
 * Builds every pointer from an order. This is the single place that knows how
 * each list type wires its nodes, so insert / delete / reverse / swap / type change
 * cannot disagree with each other.
 */
export function relink(
    s: ListState,
    order: string[],
    type: ListType = s.type,
    nodes: Record<string, LNode> = s.nodes,
): ListState {
    const out: Record<string, LNode> = {};
    order.forEach((id, i) => {
        out[id] = {
            ...nodes[id],
            next: i < order.length - 1 ? order[i + 1] : type === "cll" ? order[0] : null,
            prev: type === "dll" ? (i > 0 ? order[i - 1] : null) : null,
        };
    });
    return { ...s, type, nodes: out, head: order[0] ?? null, tail: order[order.length - 1] ?? null };
}

/** Builds a whole list from scratch, so its ids are n1, n2, … (the old list is gone entirely). */
export function createList(type: ListType, values: readonly Primitive[] = STARTER): ListState {
    const nodes: Record<string, LNode> = {};
    const order = freshIds(values.length);
    order.forEach((id, i) => {
        nodes[id] = { id, value: values[i], next: null, prev: null };
    });
    const base: ListState = {
        type,
        nodes: {},
        head: null,
        tail: null,
        markers: [],
        cursor: 0,
        highlights: {},
        arrows: [],
    };
    return relink(base, order, type, nodes);
}

/** Every violated invariant, as readable text. Empty array = healthy. */
export function checkInvariants(s: ListState): string[] {
    const bad: string[] = [];
    const ids = Object.keys(s.nodes);
    const n = ids.length;
    for (const id of ids) if (s.nodes[id].id !== id) bad.push(`node key ${id} does not match its id`);
    if (n === 0) {
        if (s.head !== null || s.tail !== null) bad.push("empty list must have head = tail = null");
    } else {
        if (s.head === null || !s.nodes[s.head]) bad.push("head must be a node");
        if (s.tail === null || !s.nodes[s.tail]) bad.push("tail must be a node");
        const order = orderOf(s);
        if (order.length !== n) bad.push(`walking next from head reaches ${order.length} of ${n} nodes`);
        if (new Set(order).size !== order.length) bad.push("walking next visits a node twice");
        if (order[0] !== s.head) bad.push("first visited node is not head");
        if (order[order.length - 1] !== s.tail) bad.push("last visited node is not tail");
        order.forEach((id, i) => {
            const node = s.nodes[id];
            const last = i === order.length - 1;
            const wantNext = !last ? order[i + 1] : s.type === "cll" ? order[0] : null;
            const wantPrev = s.type === "dll" ? (i > 0 ? order[i - 1] : null) : null;
            if (node.next !== wantNext) bad.push(`${id}.next is ${node.next}, expected ${wantNext}`);
            if (node.prev !== wantPrev) bad.push(`${id}.prev is ${node.prev}, expected ${wantPrev}`);
        });
    }
    for (const m of s.markers) if (!s.nodes[m.nodeId]) bad.push(`marker ${m.id} points at a missing node`);
    for (const id of Object.keys(s.highlights)) if (!s.nodes[id]) bad.push(`highlight on missing node ${id}`);
    for (const a of s.arrows) if (!s.nodes[a.toId] || (a.fromId !== null && !s.nodes[a.fromId])) bad.push(`arrow ${a.id} points at a missing node`);
    if (!Number.isInteger(s.cursor) || s.cursor < 0) bad.push("cursor must be a non-negative integer");
    return bad;
}

/* ───────────── edges: the arrows the stage draws ───────────── */

export interface Edge {
    key: string; // "from>to:kind", to is "NULL" for a null pointer
    from: string;
    to: string;
    kind: "next" | "prev";
}
export const edgeKey = (from: string, to: string | null, kind: "next" | "prev") => `${from}>${to ?? "NULL"}:${kind}`;
export function parseEdgeKey(key: string): Edge {
    const [pair, kind] = key.split(":");
    const [from, to] = pair.split(">");
    return { key, from, to, kind: kind as "next" | "prev" };
}

/** Every pointer that exists as an arrow. SLL/CLL draw next only; DLL draws next and prev; a null pointer points at NULL. */
export function edgesOf(s: ListState): Edge[] {
    const out: Edge[] = [];
    for (const id of orderOf(s)) {
        const node = s.nodes[id];
        out.push({ key: edgeKey(id, node.next, "next"), from: id, to: node.next ?? "NULL", kind: "next" });
        if (s.type === "dll") out.push({ key: edgeKey(id, node.prev, "prev"), from: id, to: node.prev ?? "NULL", kind: "prev" });
    }
    return out;
}

const fmt = (v: Primitive) => JSON.stringify(v);

/** One-line description used by the Before / After summaries. */
export function describe(s: ListState): string {
    const order = orderOf(s);
    const n = order.length;
    const cells = order.map((id) => `[${fmt(s.nodes[id].value)}]`);
    if (n === 0) return `length 0\nHEAD → NULL, TAIL → NULL`;
    const body =
        s.type === "sll"
            ? `HEAD → ${cells.join(" → ")} → NULL`
            : s.type === "dll"
              ? `NULL ⇄ ${cells.join(" ⇄ ")} ⇄ NULL`
              : `HEAD → ${cells.join(" → ")} ↩ back to HEAD`;
    return `length ${n}\n${body}`;
}

export const indexOfId = (s: ListState, id: string) => orderOf(s).indexOf(id);
export const hasAnnotations = (s: ListState) => s.markers.length > 0 || s.arrows.length > 0 || Object.keys(s.highlights).length > 0;
