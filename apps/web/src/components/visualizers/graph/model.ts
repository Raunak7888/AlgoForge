import { circlePositions } from "./layout";
import type { Edge, GraphProps, GraphState, InitSpec } from "./types";

/**
 * Pure data model: no DOM, no React, no animation.
 *
 * RULES (checked by checkInvariants, and tested after every operation):
 *  - every edge joins two existing vertices; ids match their keys.
 *  - NO parallel edges. Undirected: one edge per unordered pair. Directed: one edge per ordered pair
 *    (A→B and B→A are two different edges and may both exist).
 *  - SELF-LOOPS are allowed (at most one per vertex).
 *      Degree: undirected loop counts 2; directed loop counts 1 in + 1 out (total 2).
 *  - Unweighted graphs store weight null; weighted graphs store a finite number on every edge.
 *  - CONNECTED property:
 *      undirected → every vertex is reachable from every other (ordinary connectivity);
 *      directed   → STRONGLY connected: every vertex reaches every other following edge directions.
 *      The empty graph and a single vertex are connected.
 *  - markers, highlights, arrows and positions only refer to existing vertices.
 */
export const MAX_VERTICES = 12;
export const MAX_EDGES = 40;
export const GRAPH_ID = "G";
export const DEFAULT_MARK = "P";
export const ARROW_DEFAULT_COLOR = "#0070F3";
export const DEFAULT_PROPS: GraphProps = { weighted: false, directed: false, connected: false };

const num = (id: string) => parseInt(id.replace(/\D/g, ""), 10) || 0;
export const byId = (a: string, b: string) => num(a) - num(b) || a.localeCompare(b);
export const vertexIds = (s: Pick<GraphState, "vertices">) => Object.keys(s.vertices).sort(byId);
export const edgeIds = (s: Pick<GraphState, "edges">) => Object.keys(s.edges).sort(byId);
export const edgeList = (s: Pick<GraphState, "edges">): Edge[] => edgeIds(s).map((id) => s.edges[id]);
export const vertexCount = (s: Pick<GraphState, "vertices">) => Object.keys(s.vertices).length;
export const edgeCount = (s: Pick<GraphState, "edges">) => Object.keys(s.edges).length;

export const emptyGraph = (props: GraphProps): GraphState => ({ props, vertices: {}, edges: {}, markers: [], highlights: {}, arrows: [], positions: {} });

export const propsText = (p: GraphProps) => `${p.weighted ? "Weighted" : "Unweighted"} · ${p.directed ? "Directed" : "Undirected"} · ${p.connected ? "Connected" : "Open"}`;

/** Does this edge join a and b the way the graph's direction rules say? */
export const sameEnds = (props: GraphProps, e: Edge, a: string, b: string) =>
    props.directed ? e.source === a && e.target === b : (e.source === a && e.target === b) || (e.source === b && e.target === a);
export const findEdge = (s: Pick<GraphState, "edges" | "props">, a: string, b: string): Edge | undefined => edgeList(s).find((e) => sameEnds(s.props, e, a, b));
/** In a directed graph: the edge running the other way, if any (used to curve the pair apart). */
export const findReverse = (s: Pick<GraphState, "edges" | "props">, e: Edge): Edge | undefined =>
    s.props.directed && e.source !== e.target ? edgeList(s).find((x) => x.source === e.target && x.target === e.source) : undefined;

export function degreeInfo(s: Pick<GraphState, "edges" | "props">, id: string): { in: number; out: number; total: number } {
    let inn = 0;
    let out = 0;
    let total = 0;
    for (const e of Object.values(s.edges)) {
        if (s.props.directed) {
            if (e.target === id) inn++;
            if (e.source === id) out++;
        } else {
            if (e.source === id) total++;
            if (e.target === id) total++;
        }
    }
    return s.props.directed ? { in: inn, out, total: inn + out } : { in: 0, out: 0, total };
}
const adj = (s: Pick<GraphState, "edges" | "props">, id: string, dir: "out" | "in"): string[] => {
    const r = new Set<string>();
    for (const e of Object.values(s.edges)) {
        if (!s.props.directed) {
            if (e.source === id) r.add(e.target);
            if (e.target === id) r.add(e.source);
        } else if (dir === "out") {
            if (e.source === id) r.add(e.target);
        } else if (e.target === id) r.add(e.source);
    }
    return [...r].sort(byId);
};
export const outNeighbors = (s: Pick<GraphState, "edges" | "props">, id: string) => adj(s, id, "out");
export const inNeighbors = (s: Pick<GraphState, "edges" | "props">, id: string) => adj(s, id, "in");
export const incidentEdges = (s: Pick<GraphState, "edges">, id: string) => edgeList(s).filter((e) => e.source === id || e.target === id).map((e) => e.id);

/* ───────────── connectivity ───────────── */

export interface Conn {
    weak: boolean; // ignoring directions
    strong: boolean; // following directions both ways
    components: number; // weakly connected components
}
export function connectivityOf(ids: string[], edges: Edge[]): Conn {
    if (ids.length <= 1) return { weak: true, strong: true, components: ids.length };
    const und = new Map<string, string[]>();
    const fwd = new Map<string, string[]>();
    const rev = new Map<string, string[]>();
    for (const id of ids) {
        und.set(id, []);
        fwd.set(id, []);
        rev.set(id, []);
    }
    for (const e of edges) {
        und.get(e.source)?.push(e.target);
        und.get(e.target)?.push(e.source);
        fwd.get(e.source)?.push(e.target);
        rev.get(e.target)?.push(e.source);
    }
    const reach = (start: string, g: Map<string, string[]>) => {
        const seen = new Set([start]);
        const stack = [start];
        while (stack.length) {
            const c = stack.pop()!;
            for (const n of g.get(c) ?? []) if (!seen.has(n)) (seen.add(n), stack.push(n));
        }
        return seen;
    };
    let components = 0;
    const done = new Set<string>();
    for (const id of ids)
        if (!done.has(id)) {
            components++;
            reach(id, und).forEach((x) => done.add(x));
        }
    const strong = reach(ids[0], fwd).size === ids.length && reach(ids[0], rev).size === ids.length;
    return { weak: components === 1, strong, components };
}
export const connectivityOfState = (s: Pick<GraphState, "vertices" | "edges">) => connectivityOf(Object.keys(s.vertices), Object.values(s.edges));
export function satisfiesConnected(s: Pick<GraphState, "vertices" | "edges">, directed: boolean): boolean {
    const c = connectivityOfState(s);
    return directed ? c.strong : c.weak;
}

/* ───────────── building ───────────── */

export function withDefaultMark(s: GraphState): GraphState {
    const first = vertexIds(s)[0];
    return first && !s.markers.some((m) => m.id === DEFAULT_MARK) ? { ...s, markers: [...s.markers, { id: DEFAULT_MARK, vertexId: first }] } : s;
}

/** Starter graph: a 4-cycle with one chord. Valid (and connected) for every combination of properties. */
export const starterSpec = (weighted: boolean): InitSpec => {
    const raw: [number, number, number][] = [[0, 1, 4], [1, 2, 2], [2, 3, 7], [3, 0, 1], [0, 2, 3]];
    return { vertices: ["A", "B", "C", "D"], edges: raw.map(([from, to, w]) => (weighted ? { from, to, weight: w } : { from, to })) };
};

/** Builds a whole graph from scratch: vertices v1, v2, …; edges e1, e2, … in the order given. */
export function buildGraph(props: GraphProps, spec: InitSpec): { state: GraphState; error?: string } {
    const s = emptyGraph(props);
    if (spec.vertices.length > MAX_VERTICES) return { state: s, error: `At most ${MAX_VERTICES} vertices are supported.` };
    if (spec.edges.length > MAX_EDGES) return { state: s, error: `At most ${MAX_EDGES} edges are supported.` };
    const pos = circlePositions(spec.vertices.length);
    spec.vertices.forEach((value, i) => {
        const id = `v${i + 1}`;
        s.vertices[id] = { id, value };
        s.positions[id] = pos[i];
    });
    const n = spec.vertices.length;
    for (let i = 0; i < spec.edges.length; i++) {
        const e = spec.edges[i];
        const a = `v${e.from + 1}`;
        const b = `v${e.to + 1}`;
        if (!s.vertices[a] || !s.vertices[b]) return { state: s, error: `edge ${i} uses vertex index ${!s.vertices[a] ? e.from : e.to}, but there are only ${n} vertices (valid indexes: 0 to ${Math.max(n - 1, 0)}).` };
        if (!props.weighted && e.weight !== undefined) return { state: s, error: `edge ${i} has a weight, but this graph is unweighted. Switch to Weighted or remove the weight.` };
        if (props.weighted && e.weight !== undefined && !Number.isFinite(e.weight)) return { state: s, error: `edge ${i} has a weight that is not a finite number.` };
        const dup = Object.values(s.edges).find((x) => sameEnds(props, x, a, b));
        if (dup) return { state: s, error: `edge ${i} (${a} ${props.directed ? "→" : "—"} ${b}) duplicates ${dup.id}: parallel edges are not enabled.` };
        const id = `e${i + 1}`;
        s.edges[id] = { id, source: a, target: b, weight: props.weighted ? (e.weight ?? 1) : null };
    }
    if (props.connected && !satisfiesConnected(s, props.directed))
        return { state: s, error: `this graph is set to Connected, but the data is not ${props.directed ? "strongly connected" : "connected"}.` };
    return { state: withDefaultMark(s) };
}
export const createGraph = (props: GraphProps): GraphState => buildGraph(props, starterSpec(props.weighted)).state;

/* ───────────── invariants ───────────── */

export function checkInvariants(s: GraphState): string[] {
    const bad: string[] = [];
    const vids = Object.keys(s.vertices);
    const seen = new Map<string, string>();
    for (const id of vids) {
        const v = s.vertices[id];
        if (v.id !== id) bad.push(`vertex key ${id} does not match its id`);
        const t = typeof v.value;
        if (!(v.value === null || t === "string" || t === "number" || t === "boolean")) bad.push(`${id} holds an unsupported value`);
        const p = s.positions[id];
        if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) bad.push(`${id} has no valid position`);
    }
    for (const id of Object.keys(s.positions)) if (!s.vertices[id]) bad.push(`position for missing vertex ${id}`);
    for (const id of Object.keys(s.edges)) {
        const e = s.edges[id];
        if (e.id !== id) bad.push(`edge key ${id} does not match its id`);
        if (!s.vertices[e.source] || !s.vertices[e.target]) {
            bad.push(`${id} joins a missing vertex`);
            continue;
        }
        const key = s.props.directed || e.source === e.target ? `${e.source}>${e.target}` : [e.source, e.target].sort().join("-");
        if (seen.has(key)) bad.push(`${id} duplicates ${seen.get(key)} (parallel edges are not enabled)`);
        seen.set(key, id);
        if (s.props.weighted) {
            if (e.weight === null || !Number.isFinite(e.weight)) bad.push(`${id} needs a finite weight`);
        } else if (e.weight !== null) bad.push(`${id} has a weight in an unweighted graph`);
    }
    if (s.props.connected && !satisfiesConnected(s, s.props.directed)) bad.push(`graph is set to Connected but is not ${s.props.directed ? "strongly connected" : "connected"}`);
    for (const m of s.markers) if (!s.vertices[m.vertexId]) bad.push(`marker ${m.id} points at a missing vertex`);
    if (new Set(s.markers.map((m) => m.id)).size !== s.markers.length) bad.push("two markers share a name");
    for (const id of Object.keys(s.highlights)) if (!s.vertices[id]) bad.push(`highlight on missing vertex ${id}`);
    for (const a of s.arrows) if (!s.vertices[a.toId] || (a.fromId !== null && !s.vertices[a.fromId])) bad.push(`arrow ${a.id} points at a missing vertex`);
    return bad;
}

/** Multi-line Before / After summary (topology only, never positions). */
export function summaryOf(s: GraphState): string {
    const vs = vertexIds(s).map((id) => `${id}=${JSON.stringify(s.vertices[id].value)}`).join(", ") || "(none)";
    const es = edgeList(s).map((e) => `${e.source}${s.props.directed ? "→" : "—"}${e.target}${e.weight !== null ? `(${e.weight})` : ""}`).join(", ") || "(none)";
    return `${propsText(s.props)} · ${vertexCount(s)} V, ${edgeCount(s)} E\nvertices: ${vs}\nedges: ${es}`;
}
