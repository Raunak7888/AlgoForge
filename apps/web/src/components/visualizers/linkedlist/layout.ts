import { linkEdge, type Box, type EdgeGeometry } from "../shared/edges";
import { lengthOf, orderOf, type Edge } from "./model";
import type { ListState, ListType } from "./types";

/**
 * Pure layout math (no DOM, no React). Nodes sit on one horizontal row, left to right.
 * Slot 0 sits after a fixed left margin that holds the left NULL of a doubly linked list,
 * so switching type never shifts a node.
 */
export const L = {
    W: 80,
    H: 52,
    PITCH: 140,
    PAD_L: 16,
    LS: 84,
    NODE_Y: 118,
    TW: 54,
    TH: 34,
    MIN_SLOTS: 5,
    STAGE_H: 310,
    PILL_W: 40,
} as const;

export const slotX = (i: number) => L.PAD_L + L.LS + i * L.PITCH;
export const nodeBox = (i: number): Box => ({ x: slotX(i), y: L.NODE_Y, w: L.W, h: L.H });
const termY = L.NODE_Y + (L.H - L.TH) / 2;
export const termRBox = (len: number): Box => ({ x: slotX(len), y: termY, w: L.TW, h: L.TH });
export const termLBox = (): Box => ({ x: L.PAD_L + 12, y: termY, w: L.TW, h: L.TH });

export const showRight = (t: ListType) => t !== "cll";
export const showLeft = (t: ListType) => t === "dll";

/** Boxes for every node and terminal. Terminals are "NULL:R" and "NULL:L". */
export function boxesOf(s: ListState, showR: boolean = showRight(s.type), showL: boolean = showLeft(s.type)): Map<string, Box> {
    const m = new Map<string, Box>();
    const order = orderOf(s);
    order.forEach((id, i) => m.set(id, nodeBox(i)));
    if (showR) m.set("NULL:R", termRBox(order.length));
    if (showL) m.set("NULL:L", termLBox());
    return m;
}

export interface PtrPositions {
    head: [number, number];
    tail: [number, number];
    cursor: [number, number];
    cursorOut: boolean;
}
export function ptrPositions(s: ListState): PtrPositions {
    const n = lengthOf(s);
    const y = L.NODE_Y - 28;
    const head: [number, number] = [slotX(0), y];
    const tail: [number, number] = n === 0 ? [slotX(0), y - 24] : [slotX(n - 1) + (n === 1 ? L.W - L.PILL_W : 0), y];
    const cursor: [number, number] = [slotX(s.cursor) + L.W / 2 - 16, L.NODE_Y + L.H + 30];
    return { head, tail, cursor, cursorOut: s.cursor >= n };
}

export const stageWidth = (s: ListState, otherLen = 0) =>
    slotX(Math.max(L.MIN_SLOTS, lengthOf(s), otherLen, s.cursor + 1)) + L.TW + 40;

/** Geometry of one pointer arrow, given where its two ends currently are. */
export function edgeGeometry(
    edge: Pick<Edge, "from" | "to" | "kind">,
    boxes: Map<string, Box>,
    type: ListType,
): EdgeGeometry | null {
    const from = boxes.get(edge.from);
    const to = boxes.get(edge.to === "NULL" ? (edge.kind === "prev" ? "NULL:L" : "NULL:R") : edge.to);
    if (!from || !to) return null;
    const lane = edge.kind === "prev" ? 9 : type === "dll" ? -9 : 0; // a doubly linked pair gets two lanes
    return linkEdge(from, to, { dir: edge.kind === "next" ? "fwd" : "back", lane, self: edge.from === edge.to });
}
export const laneOf = (kind: "next" | "prev", type: ListType) => (kind === "prev" ? 9 : type === "dll" ? -9 : 0);
