import type { Primitive } from "../core/types";
export type { Primitive };

export type ListType = "sll" | "dll" | "cll";

/** Pointers are stored explicitly: they ARE the data structure. */
export interface LNode {
    id: string; // stable, independent of the value
    value: Primitive;
    next: string | null;
    /** DLL only. Always null for SLL and CLL. */
    prev: string | null;
}
/** A named marker that follows a node by id, wherever pointer rewiring puts it. */
export interface Marker {
    id: string;
    nodeId: string;
}
export interface ListArrow {
    id: string;
    fromId: string | null; // null = arrow points at one node only
    toId: string;
    color: string; // #RRGGBB
}

export interface ListState {
    type: ListType;
    nodes: Record<string, LNode>;
    head: string | null;
    tail: string | null;
    markers: Marker[];
    /** The index Mark "P": a numeric cursor that keeps its index when nodes shift. */
    cursor: number;
    highlights: Record<string, string>; // nodeId -> #RRGGBB
    arrows: ListArrow[];
}

export type ListOp =
    | { type: "initialize"; values: Primitive[] }
    | { type: "reset" }
    | { type: "append"; value?: Primitive }
    | { type: "prepend"; value?: Primitive }
    | { type: "insertAt"; index: number; value?: Primitive }
    | { type: "insertAfter"; nodeId: string; value?: Primitive }
    | { type: "insertBefore"; nodeId: string; value?: Primitive }
    | { type: "update"; index: number; value: Primitive }
    | { type: "read"; index: number }
    | { type: "delete"; index: number }
    | { type: "deleteHead" }
    | { type: "deleteTail" }
    | { type: "deleteById"; nodeId: string }
    | { type: "findById"; nodeId: string }
    | { type: "getLength" }
    | { type: "isEmpty" }
    | { type: "reverse" }
    | { type: "clear" }
    | { type: "swap"; indexA: number; indexB: number }
    | { type: "setType"; to: ListType }
    | { type: "highlight"; color: string; index?: number }
    | { type: "clearHighlights" }
    | { type: "mark"; index: number }
    | { type: "createMark"; markId: string; index: number }
    | { type: "deleteMark"; markId?: string }
    | { type: "readMark"; markId?: string }
    | { type: "moveMarkToIndex"; markId: string; index: number }
    | { type: "moveMarkOne"; direction: "left" | "right" }
    | { type: "moveMarkBy"; steps: number }
    | { type: "moveMarkTo"; index: number }
    | { type: "pointArrow"; list: string; index: number; color?: string }
    | { type: "pointArrowFromTo"; list1: string; index1: number; list2: string; index2: number; color?: string }
    | { type: "clearArrows" };

export type OpType = ListOp["type"];

/**
 * One beginner-readable pointer change. `removes` / `adds` are edge keys
 * ("n1>n2:next"; the target is "NULL" for a null pointer) so the stage can
 * flash the old arrow and draw the new one in sync with `text`.
 */
export interface Step {
    text: string;
    removes: string[];
    adds: string[];
    ptr?: "head" | "tail";
}

/** Describes what the stage should animate. Never a source of truth. */
export type Anim =
    | { kind: "none" }
    | { kind: "insert"; id: string; index: number; steps: Step[] }
    | { kind: "delete"; ghost: { id: string; index: number }; prev: ListState; steps: Step[] }
    | { kind: "rewire"; what: "reverse" | "swap" | "retype"; ids: string[]; steps: Step[]; prev: ListState }
    | { kind: "update"; id: string; oldValue: Primitive }
    | { kind: "read"; id: string }
    | { kind: "clear"; prev: ListState }
    | { kind: "reset"; prev: ListState }
    | { kind: "highlight"; id: string }
    | { kind: "markIn"; markId: string }
    | { kind: "markOut"; nodeId: string; markId: string }
    | { kind: "cursor"; from: number; to: number }
    | { kind: "arrow"; id: string }
    | { kind: "dismiss"; prev: ListState };

export interface Explain {
    ran: string;
    affected: string;
    changed: string;
    unchanged: string;
}

export interface Outcome {
    ok: boolean;
    /** Same object reference as the input state when nothing changed. */
    state: ListState;
    explain: Explain;
    anim: Anim;
    steps: Step[];
    result?: { label: string; value: unknown };
    error?: string;
    /** UI selection (the "selected node" indicator). Kept out of the list state so reads stay pure. */
    select?: string | null;
}

export interface LogEntry {
    seq: number;
    op: ListOp;
    call: string;
    outcome: Outcome;
    before: string;
    after: string;
    mutated: boolean;
}
