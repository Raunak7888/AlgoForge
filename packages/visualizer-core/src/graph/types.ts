import type { Primitive } from "../core/types";
export type { Primitive };

/** Three independent properties, not six exclusive types. */
export interface GraphProps {
    weighted: boolean; // W / U
    directed: boolean; // D / UD
    connected: boolean; // C / O (directed + connected means STRONGLY connected)
}
export interface Vertex {
    id: string;
    value: Primitive;
}
/** Stable identity (e1, e2, …). Undirected edges are stored in the orientation they were created in but behave symmetrically. */
export interface Edge {
    id: string;
    source: string;
    target: string;
    weight: number | null; // null in unweighted graphs
}
export interface Marker {
    id: string;
    vertexId: string;
}
export interface GraphArrow {
    id: string;
    fromId: string | null;
    toId: string;
    color: string;
}
export interface Pos {
    x: number;
    y: number;
}

/**
 * Topology (props, vertices, edges) is the source of truth.
 * `positions` is a separate map used only for drawing; no topology rule reads it.
 */
export interface GraphState {
    props: GraphProps;
    vertices: Record<string, Vertex>;
    edges: Record<string, Edge>;
    markers: Marker[];
    highlights: Record<string, string>; // vertexId -> #RRGGBB
    arrows: GraphArrow[];
    positions: Record<string, Pos>;
}

export interface InitEdge {
    from: number; // vertex INDEX (0-based), so duplicate labels are never ambiguous
    to: number;
    weight?: number;
}
export interface InitSpec {
    vertices: Primitive[];
    edges: InitEdge[];
}

export type GraphOp =
    | { type: "initialize"; data: InitSpec }
    | { type: "reset" }
    | { type: "setProps"; props: Partial<GraphProps> }
    | { type: "addVertex"; value?: Primitive; attachTo?: string; at?: Pos }
    | { type: "updateVertex"; vertexId: string; value: Primitive }
    | { type: "readVertex"; vertexId: string }
    | { type: "deleteVertex"; vertexId: string }
    | { type: "getVertex"; vertexId: string }
    | { type: "getVertices" }
    | { type: "getVertexCount" }
    | { type: "isEmpty" }
    | { type: "clear" }
    | { type: "addEdge"; sourceId: string; targetId: string; weight?: number }
    | { type: "removeEdge"; sourceId: string; targetId: string }
    | { type: "updateEdge"; sourceId: string; targetId: string; weight: number }
    | { type: "readEdge"; sourceId: string; targetId: string }
    | { type: "hasEdge"; sourceId: string; targetId: string }
    | { type: "getEdges" }
    | { type: "getDegree"; vertexId: string }
    | { type: "getInDegree"; vertexId: string }
    | { type: "getOutDegree"; vertexId: string }
    | { type: "moveVertex"; vertexId: string; x: number; y: number; dragged?: boolean }
    | { type: "highlight"; color: string; vertexId?: string }
    | { type: "clearHighlights" }
    | { type: "pointArrow"; graph: string; vertexId: string; color?: string }
    | { type: "pointArrowFromTo"; graph1: string; vertexId1: string; graph2: string; vertexId2: string; color?: string }
    | { type: "clearArrows" }
    | { type: "mark"; vertexId: string }
    | { type: "createMark"; markId: string; vertexId: string }
    | { type: "deleteMark"; markId?: string }
    | { type: "readMark"; markId?: string }
    | { type: "moveMarkTo"; vertexId: string }
    | { type: "moveMarkToIndex"; markId: string; vertexId: string };

export type OpType = GraphOp["type"];

/** What the stage should animate. Never a source of truth. */
export type Anim =
    | { kind: "none" }
    | { kind: "addVertex"; id: string; edgeIds: string[] }
    | { kind: "deleteVertex"; id: string; prev: GraphState }
    | { kind: "addEdge"; id: string }
    | { kind: "removeEdge"; id: string; prev: GraphState }
    | { kind: "weight"; id: string; oldWeight: number | null }
    | { kind: "updateVertex"; id: string; oldValue: Primitive }
    | { kind: "move"; id: string }
    | { kind: "read"; vertexIds: string[]; edgeIds: string[] }
    | { kind: "props" }
    | { kind: "clear"; prev: GraphState }
    | { kind: "reset"; prev: GraphState }
    | { kind: "highlight"; ids: string[] }
    | { kind: "markIn"; markId: string }
    | { kind: "markOut"; vertexId: string; markId: string }
    | { kind: "markMove"; markId: string; fromId: string }
    | { kind: "arrow"; id: string }
    | { kind: "dismiss"; prev: GraphState }
    | { kind: "restore"; prev: GraphState };

export interface Explain {
    ran: string;
    affected: string;
    changed: string;
    unchanged: string;
}

export interface Outcome {
    ok: boolean;
    /** Same object reference as the input when nothing changed. */
    state: GraphState;
    explain: Explain;
    anim: Anim;
    result?: { label: string; value: unknown };
    error?: string;
    /** UI selection, kept out of the graph so reads stay pure. */
    select?: { vertexId?: string | null; edgeId?: string | null };
}

export interface LogEntry {
    seq: number;
    op: GraphOp;
    call: string;
    outcome: Outcome;
    before: string;
    after: string;
    mutated: boolean;
}
