import type { Item, Kind, LinearState, Primitive } from "./types";

/** Pure data model helpers: no DOM, no React, no animation. */

export const MAX_ITEMS = 16;
export const STARTER: readonly Primitive[] = [10, 20, 30];
export const ARROW_DEFAULT_COLOR = "#0070F3";

export function createState(
    kind: Kind,
    values: readonly Primitive[] = STARTER,
    from?: LinearState,
): LinearState {
    const start = from ? from.counters.item : 1;
    return {
        kind,
        items: values.map((value, i) => ({ id: `e${start + i}`, value })),
        marks: [],
        highlights: {},
        arrows: [],
        counters: { item: start + values.length, arrow: from ? from.counters.arrow : 1 },
    };
}

/** Index of the element peek() looks at: TOP for a stack, FRONT for a queue. */
export const peekIndex = (s: LinearState) => (s.kind === "stack" ? s.items.length - 1 : 0);
export const peekWord = (kind: Kind) => (kind === "stack" ? "top" : "front");
export const inWord = (kind: Kind) => (kind === "stack" ? "top" : "rear");

export function indexOfId(s: LinearState, id: string): number {
    return s.items.findIndex((i) => i.id === id);
}

/** Plain-language description of where an index sits. */
export function positionName(s: LinearState, index: number): string {
    const n = s.items.length;
    if (s.kind === "stack") {
        if (n === 1) return "the only element (both top and bottom)";
        if (index === n - 1) return "the top";
        if (index === 0) return "the bottom";
        return `${n - 1 - index} below the top`;
    }
    if (n === 1) return "the only element (both front and rear)";
    if (index === 0) return "the front";
    if (index === n - 1) return "the rear";
    return `${index} behind the front`;
}

/** Removes one element together with its marks, highlight and arrow. */
export function removeAt(s: LinearState, index: number): LinearState {
    const gone = s.items[index];
    const highlights = { ...s.highlights };
    delete highlights[gone.id];
    return {
        ...s,
        items: s.items.filter((_, i) => i !== index),
        marks: s.marks.filter((m) => m.itemId !== gone.id),
        arrows: s.arrows.filter((a) => a.itemId !== gone.id),
        highlights,
    };
}

const fmt = (v: Primitive) => JSON.stringify(v);

/** One-line description used by the Before / After summaries. */
export function describe(s: LinearState): string {
    const n = s.items.length;
    if (n === 0) return `size 0\n(empty)`;
    const cells = (s.kind === "stack" ? [...s.items].reverse() : s.items).map((i) => `[${fmt(i.value)}]`);
    return s.kind === "stack"
        ? `size ${n}\nTOP ${cells.join(" ")} BOTTOM`
        : `size ${n}\nFRONT ${cells.join(" ")} REAR`;
}

export const hasAnnotations = (s: LinearState) =>
    s.marks.length > 0 || s.arrows.length > 0 || Object.keys(s.highlights).length > 0;

export type { Item };
