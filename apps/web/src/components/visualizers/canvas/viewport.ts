/** Camera math for the shared canvas. Pure: no DOM. */

export interface Size {
    w: number;
    h: number;
}
export interface Point {
    x: number;
    y: number;
}
/** screen = content * k + (x, y) */
export interface Transform {
    x: number;
    y: number;
    k: number;
}

export const MIN_K = 0.25;
export const MAX_K = 2;
export const ZOOM_STEP = 1.25;
export const FIT_PADDING = 24;
/** Never blow a small structure up past this when fitting. */
export const FIT_MAX_K = 1;

export const clampK = (k: number): number => Math.min(MAX_K, Math.max(MIN_K, Number.isFinite(k) ? k : 1));

/** Centre the content at a fixed zoom. */
export function centered(content: Size, view: Size, k: number): Transform {
    const kk = clampK(k);
    return { k: kk, x: (view.w - content.w * kk) / 2, y: (view.h - content.h * kk) / 2 };
}

/**
 * The transform that shows all the content: as large as fits (up to FIT_MAX_K), centred.
 * Content taller than the view is aligned to the top so the first structure stays in sight.
 */
export function fit(content: Size, view: Size, padding = FIT_PADDING, maxK = FIT_MAX_K): Transform {
    if (content.w <= 0 || content.h <= 0 || view.w <= 0 || view.h <= 0) return { x: padding, y: padding, k: 1 };
    const k = clampK(Math.min(maxK, (view.w - 2 * padding) / content.w, (view.h - 2 * padding) / content.h));
    const x = (view.w - content.w * k) / 2;
    const y = content.h * k + 2 * padding <= view.h ? (view.h - content.h * k) / 2 : padding;
    return { x, y, k };
}

/** Zoom by `factor`, keeping the screen point `around` fixed. */
export function zoomAt(t: Transform, factor: number, around: Point): Transform {
    const k = clampK(t.k * factor);
    if (k === t.k) return t;
    const r = k / t.k;
    return { k, x: around.x - (around.x - t.x) * r, y: around.y - (around.y - t.y) * r };
}

export const panBy = (t: Transform, dx: number, dy: number): Transform => ({ ...t, x: t.x + dx, y: t.y + dy });

export const isSame = (a: Transform, b: Transform): boolean => a.x === b.x && a.y === b.y && a.k === b.k;
