import type { Primitive } from "../core/types";
export type { Primitive };

export type Kind = "stack" | "queue";

/** Stable identity, so duplicate values stay distinguishable and marks can follow elements. */
export interface Item {
    id: string;
    value: Primitive;
}
/** A persistent Mark: follows its element by id, wherever the structure shifts it. */
export interface ItemMark {
    id: string; // user-chosen markId
    itemId: string;
}
export interface ItemArrow {
    id: string;
    itemId: string;
    color: string; // #RRGGBB
}

/**
 * Pure data. `items[0]` is the OLDEST element for both structures:
 *   Stack: items[0] = BOTTOM, last = TOP   (push / pop work at the end)
 *   Queue: items[0] = FRONT,  last = REAR  (enqueue at the end, dequeue at the start)
 */
export interface LinearState {
    kind: Kind;
    items: Item[];
    marks: ItemMark[];
    highlights: Record<string, string>; // itemId -> #RRGGBB
    arrows: ItemArrow[];
    counters: { item: number; arrow: number };
}

export type LinearOp =
    | { type: "push"; value: Primitive }
    | { type: "pop" }
    | { type: "enqueue"; value: Primitive }
    | { type: "dequeue" }
    | { type: "peek" }
    | { type: "isEmpty" }
    | { type: "getSize" }
    | { type: "clear" }
    | { type: "initialize"; values: Primitive[] }
    | { type: "reset" }
    | { type: "createMark"; markId: string; index?: number }
    | { type: "deleteMark"; markId: string }
    | { type: "readMark"; markId: string }
    | { type: "highlight"; color: string; index?: number }
    | { type: "pointArrow"; index?: number; color?: string }
    | { type: "clearHighlights" }
    | { type: "clearArrows" };

export type OpType = LinearOp["type"];

/** Describes what the stage should animate. Never a source of truth. */
export type Anim =
    | { kind: "none" }
    | { kind: "enter"; id: string }
    | { kind: "exit"; ghost: { item: Item; index: number }; prev: LinearState }
    | { kind: "peek"; id: string }
    | { kind: "underflow" }
    | { kind: "overflow" }
    | { kind: "clear"; prev: LinearState }
    | { kind: "reset"; prev: LinearState }
    | { kind: "highlight"; id: string }
    | { kind: "markIn"; markId: string }
    | { kind: "markOut"; itemId: string; markId: string }
    | { kind: "arrow"; id: string }
    | { kind: "dismiss"; prev: LinearState };

export interface Explain {
    ran: string;
    affected: string;
    changed: string;
    unchanged: string;
}

export interface Outcome {
    ok: boolean;
    /** Same object reference as the input state when nothing changed. */
    state: LinearState;
    explain: Explain;
    anim: Anim;
    result?: { label: string; value: unknown };
    error?: string;
}

export interface LogEntry {
    seq: number;
    kind: Kind;
    op: LinearOp;
    call: string;
    outcome: Outcome;
    before: string;
    after: string;
    mutated: boolean;
}
