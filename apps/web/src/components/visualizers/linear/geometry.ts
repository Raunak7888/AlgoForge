import type { Kind } from "./types";

/**
 * Pure layout math (no DOM, no React).
 *
 * The one rule that keeps animations smooth: THE STAGE NEVER CHANGES SIZE WHEN ELEMENTS ARE
 * ADDED OR REMOVED. Only tiles move. Resizing the stage made the whole page reflow and every
 * tile jump when an animation ended, which is what made popping feel laggy past ~5 elements.
 *
 * Stack: VERTICAL, anchored to a fixed floor. Up to 8 elements the rows are full size and
 *        nothing but the entering / leaving tile ever moves. Beyond 8 the rows compress
 *        smoothly (every tile glides, nothing jumps) so up to 16 always fit the same stage.
 * Queue: HORIZONTAL, anchored to the left. A tile's position never depends on the size.
 */
export const S = {
    TW: 176,
    LEFT: 96,
    GUT: 30,
    TOP_PAD: 40,
    /** Height of the area elements live in. */
    AVAIL: 448,
    MAX_ROW: 52,
    MIN_ROW: 28,
    GAP: 6,
    FULL_ROWS: 8,
} as const;

export const Q = {
    TW: 88,
    TH: 56,
    COL: 100,
    PADL: 16,
    RAIL_T: 24,
    TILE_Y: 58,
    MIN_SLOTS: 6,
} as const;
export const Q_RAIL_B = Q.TILE_Y + Q.TH + 10;
export const Q_PTR_Y = Q_RAIL_B + 10;

export const STACK_FLOOR_Y = S.TOP_PAD + S.AVAIL + 2;
export const STACK_STAGE_H = STACK_FLOOR_Y + 36;
export const QUEUE_STAGE_H = Q_PTR_Y + 62;

/** Row pitch for a stack of n elements: full size up to 8, compressing evenly after. */
export const stackRow = (n: number) => Math.max(S.MIN_ROW, Math.min(S.MAX_ROW, Math.floor(S.AVAIL / Math.max(n, 1))));
export const stackTH = (n: number) => stackRow(n) - S.GAP;

export const tileSize = (kind: Kind, n: number) => (kind === "stack" ? { w: S.TW, h: stackTH(n) } : { w: Q.TW, h: Q.TH });

/** Top-left of the tile at `index` when the structure holds `n` elements. */
export function tilePos(kind: Kind, index: number, n: number): [number, number] {
    if (kind === "stack") {
        const row = stackRow(n);
        return [S.LEFT, S.TOP_PAD + S.AVAIL - (index + 1) * row + S.GAP / 2];
    }
    return [Q.PADL + index * Q.COL, Q.TILE_Y];
}

export const queueSlots = (n: number, prevN = 0) => Math.max(Q.MIN_SLOTS, n, prevN);

export const stageWidth = (kind: Kind, n: number, prevN = 0) =>
    kind === "stack" ? S.LEFT + S.TW + S.GUT + 14 : Q.PADL * 2 + queueSlots(n, prevN) * Q.COL;
export const stageHeight = (kind: Kind) => (kind === "stack" ? STACK_STAGE_H : QUEUE_STAGE_H);
