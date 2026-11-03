import type { Primitive } from "../core/types";
export type { Primitive };

export type TreeType = "binary" | "bst";
export type Side = "left" | "right";

/** Stable identity, independent of the value. Child AND parent pointers are stored explicitly. */
export interface TNode {
    id: string;
    value: Primitive;
    left: string | null;
    right: string | null;
    parent: string | null;
}
/** A named marker that follows a node by id, never by screen position. "P" is created by default. */
export interface Marker {
    id: string;
    nodeId: string;
}
export interface TreeArrow {
    id: string;
    fromId: string | null; // null = arrow points at one node only
    toId: string;
    color: string; // #RRGGBB
}

/**
 * Pure data. Every node belongs to exactly one tree: the ACTIVE tree (reachable from `root`)
 * or one of the DETACHED subtrees (`detached` lists their roots). Nothing is ever orphaned.
 */
export interface TreeState {
    type: TreeType;
    nodes: Record<string, TNode>;
    root: string | null;
    detached: string[];
    markers: Marker[];
    highlights: Record<string, string>; // nodeId -> #RRGGBB
    arrows: TreeArrow[];
}

export interface Shape {
    value: Primitive;
    left: Shape | null;
    right: Shape | null;
}
/** Parsed initialization input: an exact shape, or values placed by the selected tree's own rule. */
export type InitSpec = { kind: "shape"; root: Shape | null } | { kind: "values"; values: Primitive[] };

export type TreeOp =
    | { type: "initialize"; data: InitSpec }
    | { type: "reset" }
    | { type: "createRoot"; value?: Primitive }
    | { type: "insertNode"; parentId: string; side: Side; value?: Primitive }
    | { type: "insertAtPath"; path: string; value?: Primitive }
    | { type: "insert"; value?: Primitive }
    | { type: "read"; nodeId: string }
    | { type: "readAtPath"; path: string }
    | { type: "update"; nodeId: string; value: Primitive }
    | { type: "setLeft"; parentId: string; childId?: string }
    | { type: "setRight"; parentId: string; childId?: string }
    | { type: "detach"; nodeId: string }
    | { type: "deleteNode"; nodeId: string }
    | { type: "deleteSubtree"; nodeId: string }
    | { type: "getRoot" }
    | { type: "getParent"; nodeId: string }
    | { type: "getLeft"; nodeId: string }
    | { type: "getRight"; nodeId: string }
    | { type: "getHeight"; nodeId?: string }
    | { type: "getDepth"; nodeId: string }
    | { type: "getDegree"; nodeId: string }
    | { type: "getNodeCount" }
    | { type: "isEmpty" }
    | { type: "clear" }
    | { type: "swapChildren"; nodeId: string }
    | { type: "setType"; to: TreeType }
    | { type: "highlight"; color: string; nodeId?: string }
    | { type: "clearHighlights" }
    | { type: "mark"; nodeId: string }
    | { type: "createMark"; markId: string; nodeId: string }
    | { type: "deleteMark"; markId?: string }
    | { type: "readMark"; markId?: string }
    | { type: "moveMarkTo"; nodeId: string }
    | { type: "moveMarkToIndex"; markId: string; nodeId: string }
    | { type: "pointArrow"; tree: string; nodeId: string; color?: string }
    | { type: "pointArrowFromTo"; tree1: string; nodeId1: string; tree2: string; nodeId2: string; color?: string }
    | { type: "clearArrows" };

export type OpType = TreeOp["type"];

/** One readable pointer change. `removes` / `adds` are edge keys ("parent>child:left"). */
export interface Step {
    text: string;
    removes: string[];
    adds: string[];
    root?: boolean;
}

/** Describes what the stage should animate. Never a source of truth. */
export type Anim =
    | { kind: "none" }
    | { kind: "insert"; id: string; steps: Step[] }
    | { kind: "delete"; ghostIds: string[]; prev: TreeState; steps: Step[] }
    | { kind: "rewire"; what: "detach" | "attach" | "swap"; ids: string[]; steps: Step[]; prev: TreeState }
    | { kind: "update"; id: string; oldValue: Primitive }
    | { kind: "read"; id: string }
    | { kind: "relate"; from: string; to: string | null }
    | { kind: "path"; ids: string[] }
    | { kind: "retype"; ids: string[] }
    | { kind: "clear"; prev: TreeState }
    | { kind: "reset"; prev: TreeState }
    | { kind: "highlight"; id: string }
    | { kind: "markIn"; markId: string }
    | { kind: "markOut"; nodeId: string; markId: string }
    | { kind: "markMove"; markId: string; fromId: string }
    | { kind: "arrow"; id: string }
    | { kind: "dismiss"; prev: TreeState }
    | { kind: "restore"; prev: TreeState };

export interface Explain {
    ran: string;
    affected: string;
    changed: string;
    unchanged: string;
}

export interface Outcome {
    ok: boolean;
    /** Same object reference as the input state when nothing changed. */
    state: TreeState;
    explain: Explain;
    anim: Anim;
    steps: Step[];
    result?: { label: string; value: unknown };
    error?: string;
    /** UI selection (the "selected node" indicator), kept out of the tree so reads stay pure. */
    select?: string | null;
}

export interface LogEntry {
    seq: number;
    op: TreeOp;
    call: string;
    outcome: Outcome;
    before: string;
    after: string;
    mutated: boolean;
}
