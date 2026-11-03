import type { Primitive } from "../core/types";
export type { Primitive };

/** IDs are separate from values so duplicates stay distinguishable. */
export interface Item {
  id: string;
  value: Primitive;
}
/** Lowercase "marker": sticks to an element and follows it. */
export interface Marker {
  id: string; // internal, stable (m1, m2...)
  itemId: string;
  name: string; // display name, renamable; defaults to id
}
/** Capital "Mark": tracks a numeric index (e.g. P). */
export interface MarkPointer {
  name: string;
  index: number;
}
export interface Arrow {
  id: string;
  fromItemId: string | null; // null = arrow points at one cell only
  toItemId: string;
  color: string; // #RRGGBB
}

export interface ArrayState {
  items: Item[];
  markers: Marker[];
  pointers: MarkPointer[];
  highlights: Record<string, string>; // itemId -> #RRGGBB
  arrows: Arrow[];
  counters: { item: number; marker: number; arrow: number };
}

export type Op =
  | { type: "add"; value?: Primitive; index?: number }
  | { type: "update"; index: number; value: Primitive }
  | { type: "delete"; index: number }
  | { type: "read"; index: number }
  | { type: "mark"; index: number; name?: string }
  | { type: "deleteMark"; markId?: string }
  | { type: "readMark"; markId?: string }
  | { type: "moveMarkToIndex"; markId: string; index: number }
  | { type: "renameMarker"; markId?: string; name: string }
  | { type: "createMark"; name: string; index: number }
  | { type: "removeMark"; name: string }
  | { type: "renameMark"; from: string; to: string }
  | { type: "moveMarkOne"; direction: "left" | "right"; name?: string }
  | { type: "moveMarkBy"; steps: number; name?: string }
  | { type: "moveMarkTo"; index: number; name?: string }
  | { type: "highlight"; index: number; color: string }
  | { type: "clearHighlight"; index?: number }
  | { type: "pointArrow"; arr: string; index: number; color?: string }
  | {
      type: "pointArrowFromTo";
      arr1: string;
      index1: number;
      arr2: string;
      index2: number;
      color?: string;
    }
  | { type: "recolorArrows"; color: string; index?: number }
  | { type: "clearArrows" }
  | { type: "append"; value?: Primitive }
  | { type: "prepend"; value?: Primitive }
  | { type: "insertAt"; index: number; value?: Primitive }
  | { type: "pop" }
  | { type: "shift" }
  | { type: "swap"; indexA: number; indexB: number }
  | { type: "getLength" }
  | { type: "isEmpty" }
  | { type: "clear" }
  | { type: "initialize"; values: readonly unknown[] }
  | { type: "reset" };

/**
 * Describes what the stage should animate. Never used as a source of truth.
 * Plans that remove things carry `prev` (the state before the op) so the stage
 * can draw "ghosts" of everything that is leaving: cells, markers, arrows, Marks.
 */
export type Anim =
  | { kind: "none" }
  | { kind: "insert"; id: string }
  | { kind: "remove"; ghost: { item: Item; index: number }; prev: ArrayState }
  | { kind: "clear"; prev: ArrayState }
  | { kind: "dismiss"; prev: ArrayState }
  | { kind: "update"; id: string; oldValue: Primitive }
  | { kind: "read"; id: string }
  | { kind: "swap"; a: string; b: string }
  | { kind: "highlight"; id: string }
  | { kind: "markerIn"; id: string }
  | { kind: "markerOut"; itemId: string; markerId: string; name: string }
  | { kind: "markerRename"; id: string; from: string }
  | { kind: "pointer"; name: string }
  | { kind: "pointerRename"; from: string; to: string }
  | { kind: "arrow"; id: string }
  | { kind: "reset" };

export interface Explain {
  ran: string;
  affected: string;
  changed: string;
  unchanged: string;
}

export interface Outcome {
  ok: boolean;
  /** Same object reference as the input state when nothing changed. */
  state: ArrayState;
  explain: Explain;
  anim: Anim;
  result?: { label: string; value: unknown };
  error?: string;
}

export interface LogEntry {
  seq: number;
  op: Op;
  call: string;
  outcome: Outcome;
  before: Primitive[];
  after: Primitive[];
  mutated: boolean;
}