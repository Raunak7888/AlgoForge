import type { Primitive } from "../core/types";
export type { Primitive };

export type Kind = "map" | "set";

/** Stable identity: survives updates and rehashing. */
export interface Entry {
    id: string;
    key: Primitive;
    /** HashSet entries store null here and never show it. */
    value: Primitive;
}
/** A persistent Mark: follows its entry by id, wherever rehashing puts it. */
export interface EntryMark {
    id: string; // user-chosen markId
    entryId: string;
}
export interface EntryArrow {
    id: string;
    entryId: string;
    color: string; // #RRGGBB
}

/**
 * Pure data. `buckets[i]` is the list of distinct entries whose
 * hash % capacity === i. Collisions are just several entries in that list:
 * no chains, no nodes, no pointers.
 */
export interface TableState {
    kind: Kind;
    capacity: number;
    /** Capacity that reset() and initialize() start from. */
    baseCapacity: number;
    buckets: Entry[][];
    marks: EntryMark[];
    highlights: Record<string, string>; // entryId -> #RRGGBB
    arrows: EntryArrow[];
    counters: { entry: number; arrow: number };
}

export interface KV {
    key: Primitive;
    value: Primitive;
}

export type HashOp =
    | { type: "set"; key: Primitive; value: Primitive }
    | { type: "get"; key: Primitive }
    | { type: "has"; key: Primitive }
    | { type: "update"; key: Primitive; value: Primitive }
    | { type: "delete"; key: Primitive }
    | { type: "add"; key: Primitive }
    | { type: "clear" }
    | { type: "getSize" }
    | { type: "getCapacity" }
    | { type: "getLoadFactor" }
    | { type: "isEmpty" }
    | { type: "keys" }
    | { type: "values" }
    | { type: "entries" }
    | { type: "initialize"; entries: KV[] }
    | { type: "reset"; capacity?: number }
    | { type: "createMark"; markId: string; key: Primitive }
    | { type: "deleteMark"; markId: string }
    | { type: "readMark"; markId: string }
    | { type: "moveMarkToKey"; markId: string; key: Primitive }
    | { type: "highlight"; key: Primitive; color: string }
    | { type: "pointArrow"; key: Primitive; color?: string }
    | { type: "clearHighlights" }
    | { type: "clearArrows" };

export type OpType = HashOp["type"];

/** What the hash pipeline strip shows: input -> canonical -> hash -> bucket -> result. */
export interface Trace {
    label: "key" | "value";
    subject: Primitive;
    /** HashMap writes show the value that travels with the key. */
    pair?: Primitive;
    type: string;
    canonical: string;
    hash: number;
    hex: string;
    capacity: number;
    bucket: number;
    outcome: string;
    resize?: { from: number; to: number };
}

/** Describes what the stage should animate. Never a source of truth. */
export type Anim =
    | { kind: "none" }
    | {
          kind: "insert";
          id: string;
          bucket: number;
          collided: boolean;
          /** Where the entry first lands, before any resize. */
          placed: { bucket: number; slot: number };
          resize?: { from: number; to: number };
          prev: TableState;
      }
    | { kind: "update"; id: string; oldValue: Primitive }
    | { kind: "read"; id: string; bucket: number }
    | { kind: "miss"; bucket: number }
    | { kind: "scan"; ids: string[] }
    | { kind: "remove"; ghost: { entry: Entry; bucket: number; slot: number }; prev: TableState }
    | { kind: "clear"; prev: TableState }
    | { kind: "dismiss"; prev: TableState }
    | { kind: "highlight"; id: string }
    | { kind: "markIn"; markId: string }
    | { kind: "markOut"; entryId: string; markId: string }
    | { kind: "arrow"; id: string }
    | { kind: "reset"; prev: TableState };

export interface Explain {
    ran: string;
    affected: string;
    changed: string;
    unchanged: string;
}

export interface Outcome {
    ok: boolean;
    /** Same object reference as the input state when nothing changed. */
    state: TableState;
    explain: Explain;
    anim: Anim;
    trace: Trace | null;
    result?: { label: string; value: unknown };
    error?: string;
}

export interface LogEntry {
    seq: number;
    kind: Kind;
    op: HashOp;
    call: string;
    outcome: Outcome;
    before: string;
    after: string;
    mutated: boolean;
}
