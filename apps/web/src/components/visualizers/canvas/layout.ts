import type { Point, Size } from "./viewport";

/** One structure on the canvas, as measured. A hidden structure has size 0 x 0. */
export interface Lane {
    id: string;
    size: Size;
    /** A script may pin a structure; pinned ones sit where they are told and do not take part in the stack. */
    at?: Point;
}

export interface Placed extends Point, Size {}

export interface CanvasLayout {
    placed: Record<string, Placed>;
    /** Bounding box of everything visible. */
    size: Size;
}

export const LANE_GAP = 32;

/**
 * Structures stack in script order, left-aligned (a centred stage would jump sideways whenever its
 * length changes). Structures that are not on screen yet take no room, so nothing leaves a gap.
 */
export function stackLanes(lanes: readonly Lane[], gap = LANE_GAP): CanvasLayout {
    const placed: Record<string, Placed> = {};
    let y = 0;
    let right = 0;
    let bottom = 0;
    for (const lane of lanes) {
        const { w, h } = lane.size;
        if (w <= 0 || h <= 0) {
            placed[lane.id] = { x: lane.at?.x ?? 0, y: lane.at?.y ?? y, w: 0, h: 0 };
            continue;
        }
        const p: Placed = lane.at ? { x: lane.at.x, y: lane.at.y, w, h } : { x: 0, y, w, h };
        placed[lane.id] = p;
        if (!lane.at) y += h + gap;
        right = Math.max(right, p.x + w);
        bottom = Math.max(bottom, p.y + h);
    }
    return { placed, size: { w: right, h: bottom } };
}
