import type { Box } from "../edges";

export interface EdgeGeo {
    shaft: string;
    head: string; // "" when the edge has no arrowhead
    label: [number, number];
}
const f = (n: number) => n.toFixed(1);
const unit = (x: number, y: number): [number, number] => {
    const l = Math.hypot(x, y) || 1;
    return [x / l, y / l];
};
function arrowHead(x: number, y: number, dx: number, dy: number): string {
    const L = 10;
    const c = Math.cos(0.5);
    const s = Math.sin(0.5);
    return `M${f(x - L * (dx * c - dy * s))} ${f(y - L * (dy * c + dx * s))}L${f(x)} ${f(y)}L${f(x - L * (dx * c + dy * s))} ${f(y - L * (dy * c - dx * s))}`;
}

/**
 * The one edge shape used by every lab.
 *  bend 0: straight; bend ±1: curved (keeps A→B and B→A apart); self: a loop above the node.
 *  The line starts and ends on the circle edges, never inside them.
 */
export function edgeCurve(a: Box, b: Box, o: { directed: boolean; bend?: number; self?: boolean }): EdgeGeo {
    const ax = a.x + a.w / 2;
    const ay = a.y + a.h / 2;
    const r = a.w / 2;
    if (o.self) {
        const sx = ax - r * 0.707;
        const sy = ay - r * 0.707;
        const ex = ax + r * 0.707;
        const ey = ay - r * 0.707;
        const c1x = ax - r * 1.6;
        const c1y = ay - r * 3.3;
        const c2x = ax + r * 1.6;
        const c2y = ay - r * 3.3;
        const [dx, dy] = unit(ex - c2x, ey - c2y);
        return {
            shaft: `M${f(sx)} ${f(sy)}C${f(c1x)} ${f(c1y)} ${f(c2x)} ${f(c2y)} ${f(ex)} ${f(ey)}`,
            head: o.directed ? arrowHead(ex, ey, dx, dy) : "",
            label: [0.125 * sx + 0.375 * c1x + 0.375 * c2x + 0.125 * ex, 0.125 * sy + 0.375 * c1y + 0.375 * c2y + 0.125 * ey - 9],
        };
    }
    const bx = b.x + b.w / 2;
    const by = b.y + b.h / 2;
    const [ux, uy] = unit(bx - ax, by - ay);
    const off = (o.bend ?? 0) * 44;
    const mx = (ax + bx) / 2 - uy * off;
    const my = (ay + by) / 2 + ux * off;
    const [sux, suy] = unit(mx - ax, my - ay);
    const [eux, euy] = unit(mx - bx, my - by);
    const sx = ax + sux * (r + 1);
    const sy = ay + suy * (r + 1);
    const gap = o.directed ? 4 : 1;
    const ex = bx + eux * (r + gap);
    const ey = by + euy * (r + gap);
    const [dx, dy] = unit(ex - mx, ey - my);
    return {
        shaft: `M${f(sx)} ${f(sy)}Q${f(mx)} ${f(my)} ${f(ex)} ${f(ey)}`,
        head: o.directed ? arrowHead(ex, ey, dx, dy) : "",
        label: [0.25 * sx + 0.5 * mx + 0.25 * ex, 0.25 * sy + 0.5 * my + 0.25 * ey],
    };
}
