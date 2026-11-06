import { straightEdge, type Box, type EdgeGeometry } from "../shared/edges";
import { lengthOf } from "./model";
import type { TreeState } from "./types";

/**
 * Pure layout math (no DOM, no React), kept separate from the tree structure.
 *
 * Every node gets the next free COLUMN in left-to-right (in-order) order, and its depth sets the row.
 * That guarantees, by construction: nodes never overlap, a left child is always to the left of its
 * parent and a right child to the right, and edges never cross a node.
 * Detached subtrees are laid out to the right of the active tree, after a gap.
 */
export const T = {
    D: 56, // node diameter
    SLOT: 80,
    ROW: 88,
    PAD_X: 36,
    TOP: 76, // room above the root for the ROOT pill, markers and arrows
    PILL_W: 44,
    MIN_W: 640,
    MIN_H: 330,
} as const;

export interface Layout {
    pos: Map<string, { x: number; y: number }>;
    activeCols: number;
    /** x where the detached zone begins (a divider is drawn just before it). */
    detachedX: number | null;
    width: number;
    height: number;
    maxDepth: number;
}

export const colX = (col: number) => T.PAD_X + col * T.SLOT;
export const rowY = (depth: number) => T.TOP + depth * T.ROW;

export function layoutOf(s: Pick<TreeState, "nodes" | "root" | "detached">): Layout {
    const pos = new Map<string, { x: number; y: number }>();
    let col = 0;
    let maxDepth = 0;
    const seen = new Set<string>();
    const place = (id: string | null, depth: number) => {
        if (id === null || seen.has(id) || !s.nodes[id]) return;
        seen.add(id);
        place(s.nodes[id].left, depth + 1);
        pos.set(id, { x: colX(col), y: rowY(depth) });
        col++;
        maxDepth = Math.max(maxDepth, depth);
        place(s.nodes[id].right, depth + 1);
    };
    place(s.root, 0);
    const activeCols = Math.max(col, 1); // an empty tree still shows one placeholder slot
    col = activeCols;
    let detachedX: number | null = null;
    if (s.detached.length) {
        col += 1; // gap column, holds the divider
        detachedX = colX(col) - T.SLOT / 2 + T.D / 2;
        s.detached.forEach((d, i) => {
            if (i > 0) col += 1;
            place(d, 0);
        });
    }
    return {
        pos,
        activeCols,
        detachedX,
        width: Math.max(T.MIN_W, colX(col) + T.D + T.PAD_X),
        height: Math.max(T.MIN_H, rowY(maxDepth) + T.D + 70),
        maxDepth,
    };
}

export const boxOf = (l: Layout, id: string): Box | null => {
    const p = l.pos.get(id);
    return p ? { x: p.x, y: p.y, w: T.D, h: T.D } : null;
};

/** The ROOT pill sits above the root (or above the empty-tree placeholder). */
export function rootPillPos(s: TreeState, l: Layout): [number, number] {
    const p = s.root ? l.pos.get(s.root) : { x: colX(0), y: rowY(0) };
    return [(p?.x ?? colX(0)) + (T.D - T.PILL_W) / 2, (p?.y ?? rowY(0)) - 32];
}

/** A tree line from a parent circle to a child circle: it starts and ends on the circle edges. */
export function treeEdge(from: Box, to: Box): EdgeGeometry {
    const fx = from.x + from.w / 2;
    const fy = from.y + from.h / 2;
    const tx = to.x + to.w / 2;
    const ty = to.y + to.h / 2;
    const len = Math.hypot(tx - fx, ty - fy) || 1;
    const ux = (tx - fx) / len;
    const uy = (ty - fy) / len;
    const r = from.w / 2;
    return straightEdge(fx + ux * (r + 1), fy + uy * (r + 1), tx - ux * (r + 4), ty - uy * (r + 4));
}

/** Where the small "L" / "R" tag sits: beside the middle of the line, on the side the child is on. */
export function edgeLabel(from: Box, to: Box, kind: "left" | "right"): [number, number] {
    const mx = (from.x + from.w / 2 + to.x + to.w / 2) / 2;
    const my = (from.y + from.h / 2 + to.y + to.h / 2) / 2;
    return [mx + (kind === "left" ? -10 : 10), my];
}

export const treeSize = (s: TreeState) => lengthOf(s);
