/**
 * Pure edge geometry (no DOM, no React). Straight and curved arrows between two boxes,
 * with the arrowhead as two separate "wing" paths so it can be drawn on after the shaft.
 * Written for the linked-list lab, kept generic so tree and graph visualizers can reuse it.
 */
export interface Box {
    x: number;
    y: number;
    w: number;
    h: number;
}
export interface EdgeGeometry {
    shaft: string;
    wings: [string, string];
}

const f = (n: number) => Math.round(n * 10) / 10;

/** Two wing strokes for an arrowhead at (tx, ty) arriving from (sx, sy). */
export function arrowHead(tx: number, ty: number, sx: number, sy: number, size = 8): [string, string] {
    const ang = Math.atan2(ty - sy, tx - sx);
    const spread = Math.PI / 7;
    const wing = (a: number) => `M${f(tx)} ${f(ty)}L${f(tx + Math.cos(a) * size)} ${f(ty + Math.sin(a) * size)}`;
    return [wing(ang + Math.PI - spread), wing(ang + Math.PI + spread)];
}

export function straightEdge(ax: number, ay: number, bx: number, by: number): EdgeGeometry {
    return { shaft: `M${f(ax)} ${f(ay)}L${f(bx)} ${f(by)}`, wings: arrowHead(bx, by, ax, ay) };
}

/** Cubic arc that leaves A, bows `depth` below or above, and arrives at B pointing back at the nodes. */
export function arcEdge(ax: number, ay: number, bx: number, by: number, depth: number, side: "below" | "above"): EdgeGeometry {
    const s = side === "below" ? 1 : -1;
    const c1y = ay + s * depth;
    const c2y = by + s * depth;
    return {
        shaft: `M${f(ax)} ${f(ay)}C${f(ax)} ${f(c1y)} ${f(bx)} ${f(c2y)} ${f(bx)} ${f(by)}`,
        wings: arrowHead(bx, by, bx, c2y),
    };
}

/**
 * A pointer between two boxes.
 *  dir "fwd":  expected to point right. If the target is not to the right (a circular
 *              wrap-around, or a reversal in progress) it becomes an arc below the nodes.
 *  dir "back": expected to point left. Otherwise it becomes an arc above.
 *  lane:       vertical offset of a straight edge, so a doubly linked pair gets two lanes.
 */
export function linkEdge(from: Box, to: Box, opts: { dir: "fwd" | "back"; lane?: number; self?: boolean }): EdgeGeometry {
    const lane = opts.lane ?? 0;
    if (opts.dir === "fwd") {
        if (!opts.self && to.x > from.x) {
            return straightEdge(from.x + from.w, from.y + from.h / 2 + lane, to.x - 3, to.y + to.h / 2 + lane);
        }
        const ax = from.x + from.w * 0.7;
        const bx = opts.self ? from.x + from.w * 0.3 : to.x + to.w * 0.3;
        const depth = 46 + Math.min(110, Math.abs(ax - bx) * 0.16);
        return arcEdge(ax, from.y + from.h, bx, to.y + to.h, depth, "below");
    }
    if (to.x < from.x) {
        return straightEdge(from.x, from.y + from.h / 2 + lane, to.x + to.w + 3, to.y + to.h / 2 + lane);
    }
    const ax = from.x + from.w * 0.3;
    const bx = to.x + to.w * 0.7;
    const depth = 46 + Math.min(110, Math.abs(ax - bx) * 0.16);
    return arcEdge(ax, from.y, bx, to.y, depth, "above");
}

/** A decorative arrow that arcs over the top from one box to another (user annotations). */
export function annotationArc(from: Box, to: Box): EdgeGeometry {
    const ax = from.x + from.w / 2;
    const bx = to.x + to.w / 2;
    const ay = from.y - 4;
    const by = to.y - 4;
    const depth = 40 + Math.min(70, Math.abs(ax - bx) * 0.14);
    const cy = Math.min(ay, by) - depth;
    return {
        shaft: `M${f(ax)} ${f(ay)}Q${f((ax + bx) / 2)} ${f(cy)} ${f(bx)} ${f(by)}`,
        wings: arrowHead(bx, by, (ax + bx) / 2, cy),
    };
}
