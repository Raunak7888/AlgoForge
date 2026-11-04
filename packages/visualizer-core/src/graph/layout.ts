import type { Box } from "../shared/edges";
import { NODE_D } from "../shared/stage/tokens";
import type { Pos } from "./types";

/** Pure drawing math. Nothing here knows about edges' meaning or graph rules. */
export const G = { R: NODE_D / 2, W: 780, H: 480, MARGIN: 44 } as const;
export const DIAM = G.R * 2;
/** The one edge shape is shared with the tree lab. */
export { edgeCurve as edgeGeo } from "../shared/stage/geometry";
export type { EdgeGeo } from "../shared/stage/geometry";

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const clampPos = (x: number, y: number): Pos => ({ x: Math.round(clamp(x, G.R, G.W - G.R)), y: Math.round(clamp(y, G.R, G.H - G.R)) });
export const boxAt = (p: Pos): Box => ({ x: p.x - G.R, y: p.y - G.R, w: DIAM, h: DIAM });

/** n points on an ellipse, starting at the top. Used when a graph is built from scratch. */
export function circlePositions(n: number): Pos[] {
    if (n === 0) return [];
    if (n === 1) return [{ x: G.W / 2, y: G.H / 2 }];
    const rx = G.W / 2 - G.MARGIN - 50;
    const ry = G.H / 2 - G.MARGIN - 20;
    return Array.from({ length: n }, (_, i) => {
        const a = -Math.PI / 2 + (2 * Math.PI * i) / n;
        return { x: Math.round(G.W / 2 + rx * Math.cos(a)), y: Math.round(G.H / 2 + ry * Math.sin(a)) };
    });
}

/** Farthest-point placement: the free spot with the biggest distance to every existing vertex. Deterministic. */
export function nextPosition(taken: Pos[]): Pos {
    if (!taken.length) return { x: G.W / 2, y: G.H / 2 };
    let best: Pos = { x: G.MARGIN, y: G.MARGIN };
    let bestD = -1;
    for (let y = G.MARGIN; y <= G.H - G.MARGIN; y += 20)
        for (let x = G.MARGIN; x <= G.W - G.MARGIN; x += 20) {
            const d = Math.min(...taken.map((p) => Math.hypot(p.x - x, p.y - y)));
            if (d > bestD) {
                bestD = d;
                best = { x, y };
            }
        }
    return best;
}
