import { HEX_RE, isPrimitive } from "../core/validate";
import { lowestFreeId } from "../shared/ids";
import { G, nextPosition } from "./layout";
import {
    ARROW_DEFAULT_COLOR,
    DEFAULT_MARK,
    GRAPH_ID,
    MAX_EDGES,
    MAX_VERTICES,
    buildGraph,
    connectivityOfState,
    createGraph,
    degreeInfo,
    edgeCount,
    edgeList,
    findEdge,
    inNeighbors,
    incidentEdges,
    outNeighbors,
    propsText,
    satisfiesConnected,
    vertexCount,
    vertexIds,
    withDefaultMark,
} from "./model";
import type { Anim, Edge, Explain, GraphOp, GraphProps, GraphState, Outcome, Vertex } from "./types";
import { MARKER_HELP, NAME_RE, VERTEX_ID_HELP } from "./validate";

const NONE: Anim = { kind: "none" };
const COLOR_HELP = "Color must look like #RRGGBB, e.g. #FF430F.";
const READ_ONLY = "Nothing. This is a read-only operation, so the graph did not change.";
const ALL_SAME = "Every vertex, edge, weight, mark, highlight, arrow and position.";
const LOOP_RULE = "Self-loop rule: it counts 2 toward an undirected degree, and 1 in + 1 out (total 2) in a directed graph.";

export const fmt = (v: unknown) => JSON.stringify(v);

export function callText(op: GraphOp): string {
    if (op.type === "initialize") return `initialize(${op.data.vertices.length} vertices, ${op.data.edges.length} edges)`;
    const rest = { ...op } as Record<string, unknown>;
    delete rest.type;
    delete rest.dragged;
    const args = Object.values(rest)
        .filter((v) => v !== undefined)
        .map((v) => JSON.stringify(v))
        .join(", ");
    return `${op.type}(${args})`;
}

const ex = (ran: string, affected: string, changed: string, unchanged: string): Explain => ({ ran, affected, changed, unchanged });
function reject(s: GraphState, ran: string, error: string): Outcome {
    return {
        ok: false,
        state: s,
        anim: NONE,
        error,
        explain: ex(`${ran} (rejected)`, "Nothing.", error, "Everything: vertices, edges, weights, marks and properties are exactly as before."),
    };
}
function accept(state: GraphState, explain: Explain, anim: Anim = NONE, result?: Outcome["result"], select?: Outcome["select"]): Outcome {
    return { ok: true, state, explain, anim, result, select };
}
const isOutcome = (x: unknown): x is Outcome => typeof x === "object" && x !== null && "explain" in x;

const arrowOf = (s: GraphState) => (s.props.directed ? "→" : "—");
const edgeName = (s: GraphState, e: Edge) => `${e.id} (${e.source} ${arrowOf(s)} ${e.target}${e.weight !== null ? `, weight ${e.weight}` : ""})`;

function needV(s: GraphState, ran: string, id: string): Vertex | Outcome {
    if (!NAME_RE.test(id ?? "")) return reject(s, ran, VERTEX_ID_HELP);
    const v = s.vertices[id];
    if (v) return v;
    const ids = vertexIds(s);
    return reject(s, ran, ids.length ? `No vertex has the id "${id}". Existing ids: ${ids.join(", ")}.` : `No vertex has the id "${id}": the graph is empty.`);
}

/** Rejects a mutation that would break the Connected property. */
function connectedGuard(next: GraphState, s: GraphState, ran: string, what: string): Outcome | null {
    if (!next.props.connected || satisfiesConnected(next, next.props.directed)) return null;
    const c = connectivityOfState(next);
    const how = next.props.directed
        ? "not strongly connected (some vertex could no longer reach every other vertex by following edge directions)"
        : `disconnected (${c.components} separate components)`;
    return reject(s, ran, `${what} would leave the graph ${how}, but it is set to Connected. Nothing was changed. Switch the graph to Open first if you want this.`);
}

function vertexDetails(s: GraphState, id: string) {
    const d = degreeInfo(s, id);
    const base = { id, value: s.vertices[id].value, degree: d.total };
    return s.props.directed
        ? { ...base, inDegree: d.in, outDegree: d.out, outNeighbors: outNeighbors(s, id), inNeighbors: inNeighbors(s, id), edges: incidentEdges(s, id) }
        : { ...base, neighbors: outNeighbors(s, id), edges: incidentEdges(s, id) };
}
const edgeDetails = (s: GraphState, e: Edge) => ({ id: e.id, source: e.source, target: e.target, weight: e.weight, directed: s.props.directed });

export function applyOp(s: GraphState, op: GraphOp, self: string = GRAPH_ID): Outcome {
    const ran = callText(op);
    const p = s.props;
    const V = vertexCount(s);
    const E = edgeCount(s);

    switch (op.type) {
        /* ── whole graph ── */
        case "initialize": {
            const built = buildGraph(p, op.data);
            if (built.error) return reject(s, ran, built.error);
            return accept(
                built.state,
                ex(ran, `${vertexCount(built.state)} vertices and ${edgeCount(built.state)} edges, built as a ${propsText(p).toLowerCase()} graph.`, `Graph replaced: ${V} V / ${E} E → ${vertexCount(built.state)} V / ${edgeCount(built.state)} E. Marks, highlights and arrows were cleared; Mark P sits on the first vertex.`, "The graph properties and the operation log."),
                { kind: "reset", prev: s },
                { label: "Vertices / edges", value: { vertices: vertexCount(built.state), edges: edgeCount(built.state) } },
                { vertexId: null, edgeId: null },
            );
        }
        case "reset": {
            const next = createGraph(p);
            return accept(next, ex(ran, "The whole graph.", `Restored the starter graph (4 vertices, 5 edges). Marks, highlights and arrows were cleared.`, "The graph properties and the operation log."), { kind: "reset", prev: s }, undefined, { vertexId: null, edgeId: null });
        }
        case "clear": {
            if (V === 0) return reject(s, ran, "The graph is already empty.");
            return accept(
                { ...s, vertices: {}, edges: {}, markers: [], highlights: {}, arrows: [], positions: {} },
                ex(ran, `All ${V} vertices and ${E} edges.`, `Vertex count ${V} → 0, edge count ${E} → 0. ${s.markers.length} mark(s), ${s.arrows.length} arrow(s) and ${Object.keys(s.highlights).length} highlight(s) were removed with their vertices.`, "The graph properties and the operation log."),
                { kind: "clear", prev: s },
                undefined,
                { vertexId: null, edgeId: null },
            );
        }
        case "setProps": {
            const bad = Object.entries(op.props).find(([, v]) => typeof v !== "boolean");
            if (bad) return reject(s, ran, `${bad[0]} must be true or false.`);
            const np: GraphProps = { ...p, ...op.props };
            if (np.weighted === p.weighted && np.directed === p.directed && np.connected === p.connected) return reject(s, ran, `The graph is already ${propsText(p).toLowerCase()}.`);
            const list = edgeList(s);
            if (p.directed && !np.directed) {
                for (const e of list) {
                    const twin = list.find((x) => x.id !== e.id && x.source === e.target && x.target === e.source);
                    if (twin) return reject(s, ran, `Cannot become undirected: ${e.id} (${e.source} → ${e.target}) and ${twin.id} (${twin.source} → ${twin.target}) would become the same undirected edge, and parallel edges are not enabled. Remove one of them first.`);
                }
            }
            let edges = s.edges;
            if (np.weighted !== p.weighted) edges = Object.fromEntries(list.map((e) => [e.id, { ...e, weight: np.weighted ? 1 : null }]));
            const next: GraphState = { ...s, props: np, edges };
            if (np.connected && !p.connected && !satisfiesConnected(next, np.directed))
                return reject(s, ran, `Cannot become Connected: the graph is not ${np.directed ? "strongly connected (directed connectivity needs a directed path both ways between every pair)" : "connected"}. Add edges first, or keep it Open.`);
            const notes = [
                np.weighted !== p.weighted ? (np.weighted ? `every edge got weight 1` : `all weights were dropped (an unweighted graph has none)`) : "",
                np.directed !== p.directed ? (np.directed ? "edges keep the orientation they were created with and now matter" : "edge directions no longer matter; each edge works both ways") : "",
                np.connected !== p.connected ? (np.connected ? `Connected is now enforced (${np.directed ? "strong" : "ordinary"} connectivity)` : "disconnected results are allowed again") : "",
            ].filter(Boolean);
            return accept(
                next,
                ex(ran, `Graph properties: ${propsText(p)} → ${propsText(np)}.`, `${notes.join("; ")}.`, "Every vertex, its value and id, every edge's endpoints, marks, highlights, arrows and positions."),
                { kind: "props" },
                { label: "Properties", value: propsText(np) },
            );
        }

        /* ── vertices ── */
        case "addVertex": {
            const value = op.value === undefined ? null : op.value;
            if (!isPrimitive(value)) return reject(s, ran, "Only strings, numbers, booleans and null are supported.");
            if (V >= MAX_VERTICES) return reject(s, ran, `The lab limits the graph to ${MAX_VERTICES} vertices so it stays readable.`);
            let anchor: Vertex | undefined;
            if (op.attachTo !== undefined && op.attachTo !== "") {
                const a = needV(s, ran, op.attachTo);
                if (isOutcome(a)) return a;
                anchor = a;
            } else if (p.connected && V > 0)
                return reject(s, ran, `This graph is set to Connected, so a new vertex cannot start isolated. Give attachTo (an existing vertex id) to join it with an edge${p.directed ? " in each direction, which keeps it strongly connected" : ""}, or switch the graph to Open.`);
            const made = anchor ? (p.directed ? 2 : 1) : 0;
            if (E + made > MAX_EDGES) return reject(s, ran, `The lab limits the graph to ${MAX_EDGES} edges.`);
            let pos = nextPosition(Object.values(s.positions));
            if (op.at) {
                const { x, y } = op.at;
                if (!Number.isFinite(x) || !Number.isFinite(y) || x < G.R || x > G.W - G.R || y < G.R || y > G.H - G.R) return reject(s, ran, `Place the vertex on the canvas: x between ${G.R} and ${G.W - G.R}, y between ${G.R} and ${G.H - G.R}.`);
                pos = { x, y };
            }
            const id = lowestFreeId(Object.keys(s.vertices), "v");
            const edges = { ...s.edges };
            const created: string[] = [];
            const link = (source: string, target: string) => {
                const eid = lowestFreeId(Object.keys(edges), "e");
                edges[eid] = { id: eid, source, target, weight: p.weighted ? 1 : null };
                created.push(eid);
            };
            if (anchor) {
                link(anchor.id, id);
                if (p.directed) link(id, anchor.id);
            }
            let next: GraphState = { ...s, vertices: { ...s.vertices, [id]: { id, value } }, edges, positions: { ...s.positions, [id]: pos } };
            if (V === 0) next = withDefaultMark(next);
            return accept(
                next,
                ex(
                    ran,
                    `New vertex ${id} (${fmt(value)}${value === null ? ", null is a real value" : ""}). Ids are independent of values, so duplicate labels are fine.`,
                    `Vertex count ${V} → ${V + 1}.${created.length ? ` Created ${created.join(", ")} to join it to ${anchor!.id}${p.weighted ? " (weight 1)" : ""}.` : ` It has no edges yet (an isolated vertex${p.connected ? "" : ", which an Open graph allows"}).`}${V === 0 ? " Mark P was placed on it." : ""}`,
                    `All ${V} existing vertices keep their ids, values and positions; no existing edge changed.`,
                ),
                { kind: "addVertex", id, edgeIds: created },
                { label: "Added", value: { id, value, edgesCreated: created } },
                { vertexId: id, edgeId: null },
            );
        }
        case "updateVertex": {
            const v = needV(s, ran, op.vertexId);
            if (isOutcome(v)) return v;
            if (!isPrimitive(op.value)) return reject(s, ran, "Only strings, numbers, booleans and null are supported.");
            if (v.value === op.value) return accept(s, ex(ran, `Vertex ${v.id}.`, `It already holds ${fmt(op.value)}, so nothing changed.`, ALL_SAME));
            return accept(
                { ...s, vertices: { ...s.vertices, [v.id]: { ...v, value: op.value } } },
                ex(ran, `Vertex ${v.id}.`, `Value ${fmt(v.value)} → ${fmt(op.value)}.`, "Its id, every edge, weight, mark, highlight and position."),
                { kind: "updateVertex", id: v.id, oldValue: v.value },
                { label: "Replaced value", value: { id: v.id, old: v.value, new: op.value } },
            );
        }
        case "readVertex": {
            const v = needV(s, ran, op.vertexId);
            if (isOutcome(v)) return v;
            const d = vertexDetails(s, v.id);
            return accept(s, ex(ran, `Vertex ${v.id} (${fmt(v.value)}): degree ${d.degree}${p.directed ? ` (in ${degreeInfo(s, v.id).in}, out ${degreeInfo(s, v.id).out})` : ""}.`, READ_ONLY, ALL_SAME), { kind: "read", vertexIds: [v.id], edgeIds: incidentEdges(s, v.id) }, { label: `Vertex ${v.id}`, value: d }, { vertexId: v.id, edgeId: null });
        }
        case "getVertex": {
            const v = needV(s, ran, op.vertexId);
            if (isOutcome(v)) return v;
            return accept(s, ex(ran, `Vertex ${v.id} holds ${fmt(v.value)}.`, READ_ONLY, ALL_SAME), { kind: "read", vertexIds: [v.id], edgeIds: [] }, { label: `Vertex ${v.id}`, value: { id: v.id, value: v.value } }, { vertexId: v.id, edgeId: null });
        }
        case "getVertices":
            return accept(s, ex(ran, `${V} vertex${V === 1 ? "" : " ids with their values"}.`, READ_ONLY, ALL_SAME), NONE, { label: "Vertices", value: vertexIds(s).map((id) => ({ id, value: s.vertices[id].value })) });
        case "getVertexCount":
            return accept(s, ex(ran, `${V} vertices and ${E} edges exist.`, READ_ONLY, ALL_SAME), NONE, { label: "Vertex count", value: V });
        case "isEmpty":
            return accept(s, ex(ran, V === 0 ? "There are no vertices." : `There are ${V} vertices.`, READ_ONLY, ALL_SAME), NONE, { label: "Is empty?", value: V === 0 });
        case "deleteVertex": {
            const v = needV(s, ran, op.vertexId);
            if (isOutcome(v)) return v;
            const inc = edgeList(s).filter((e) => e.source === v.id || e.target === v.id);
            const edges = { ...s.edges };
            for (const e of inc) delete edges[e.id];
            const vertices = { ...s.vertices };
            delete vertices[v.id];
            const positions = { ...s.positions };
            delete positions[v.id];
            const highlights = { ...s.highlights };
            delete highlights[v.id];
            const lostMarks = s.markers.filter((m) => m.vertexId === v.id).map((m) => m.id);
            const lostArrows = s.arrows.filter((a) => a.toId === v.id || a.fromId === v.id).length;
            const next: GraphState = {
                ...s,
                vertices,
                edges,
                positions,
                highlights,
                markers: s.markers.filter((m) => m.vertexId !== v.id),
                arrows: s.arrows.filter((a) => a.toId !== v.id && a.fromId !== v.id),
            };
            const guard = connectedGuard(next, s, ran, `Deleting ${v.id}`);
            if (guard) return guard;
            return accept(
                next,
                ex(
                    ran,
                    `Vertex ${v.id} (${fmt(v.value)}) and its ${inc.length} incident edge${inc.length === 1 ? "" : "s"}${inc.length ? `: ${inc.map((e) => e.id).join(", ")}` : ""}.`,
                    `Vertex count ${V} → ${V - 1}, edge count ${E} → ${E - inc.length}.${lostMarks.length ? ` Mark${lostMarks.length > 1 ? "s" : ""} ${lostMarks.join(", ")} removed with the vertex.` : ""}${lostArrows ? ` ${lostArrows} arrow(s) removed.` : ""}`,
                    "Every other vertex keeps its id, value and position; edges between the remaining vertices are untouched.",
                ),
                { kind: "deleteVertex", id: v.id, prev: s },
                { label: "Deleted", value: { id: v.id, value: v.value, edgesRemoved: inc.map((e) => e.id) } },
                { vertexId: null, edgeId: null },
            );
        }

        /* ── edges ── */
        case "addEdge": {
            const a = needV(s, ran, op.sourceId);
            if (isOutcome(a)) return a;
            const b = needV(s, ran, op.targetId);
            if (isOutcome(b)) return b;
            if (!p.weighted && op.weight !== undefined) return reject(s, ran, "This graph is unweighted, so edges have no weight. Switch to Weighted or leave the weight out.");
            if (p.weighted && op.weight !== undefined && (typeof op.weight !== "number" || !Number.isFinite(op.weight))) return reject(s, ran, "A weight must be a finite number.");
            const dup = findEdge(s, a.id, b.id);
            if (dup)
                return reject(s, ran, `${edgeName(s, dup)} already joins them${p.directed ? " in that direction (the opposite direction would be a different edge)" : ", and an undirected edge works both ways"}. Parallel edges are not enabled.`);
            if (E >= MAX_EDGES) return reject(s, ran, `The lab limits the graph to ${MAX_EDGES} edges.`);
            const id = lowestFreeId(Object.keys(s.edges), "e");
            const weight = p.weighted ? (op.weight ?? 1) : null;
            const e: Edge = { id, source: a.id, target: b.id, weight };
            const loop = a.id === b.id;
            return accept(
                { ...s, edges: { ...s.edges, [id]: e } },
                ex(
                    ran,
                    `New edge ${id}: ${a.id} ${arrowOf(s)} ${b.id}${weight !== null ? `, weight ${weight}${op.weight === undefined ? " (default)" : ""}` : ""}${loop ? ", a self-loop" : ""}.`,
                    `Edge count ${E} → ${E + 1}.${p.directed ? ` Only ${a.id} → ${b.id} exists; ${b.id} → ${a.id} does not.` : ` It works both ways: hasEdge(${b.id}, ${a.id}) is also true.`}${loop ? ` ${LOOP_RULE}` : ""}`,
                    "Every vertex, every other edge and weight, marks, highlights and positions.",
                ),
                { kind: "addEdge", id },
                { label: "Added edge", value: edgeDetails(s, e) },
                { vertexId: null, edgeId: id },
            );
        }
        case "removeEdge": {
            const a = needV(s, ran, op.sourceId);
            if (isOutcome(a)) return a;
            const b = needV(s, ran, op.targetId);
            if (isOutcome(b)) return b;
            const e = findEdge(s, a.id, b.id);
            if (!e) return reject(s, ran, `There is no edge ${a.id} ${arrowOf(s)} ${b.id}${p.directed && findEdge({ ...s, props: { ...p, directed: false } }, a.id, b.id) ? ` (the opposite edge ${b.id} → ${a.id} exists, but direction matters)` : ""}.`);
            const edges = { ...s.edges };
            delete edges[e.id];
            const next = { ...s, edges };
            const guard = connectedGuard(next, s, ran, `Removing ${e.id}`);
            if (guard) return guard;
            return accept(
                next,
                ex(ran, `Edge ${edgeName(s, e)}.`, `Edge count ${E} → ${E - 1}. Both vertices still exist.`, "Every vertex, every other edge, marks, highlights and positions."),
                { kind: "removeEdge", id: e.id, prev: s },
                { label: "Removed edge", value: edgeDetails(s, e) },
                { vertexId: null, edgeId: null },
            );
        }
        case "updateEdge": {
            if (!p.weighted) return reject(s, ran, "This graph is unweighted: edges have no weight to update. Switch to Weighted first.");
            const a = needV(s, ran, op.sourceId);
            if (isOutcome(a)) return a;
            const b = needV(s, ran, op.targetId);
            if (isOutcome(b)) return b;
            if (typeof op.weight !== "number" || !Number.isFinite(op.weight)) return reject(s, ran, "A weight must be a finite number.");
            const e = findEdge(s, a.id, b.id);
            if (!e) return reject(s, ran, `There is no edge ${a.id} ${arrowOf(s)} ${b.id}.`);
            if (e.weight === op.weight) return accept(s, ex(ran, `Edge ${e.id}.`, `It already has weight ${op.weight}, so nothing changed.`, ALL_SAME));
            return accept(
                { ...s, edges: { ...s.edges, [e.id]: { ...e, weight: op.weight } } },
                ex(ran, `Edge ${edgeName(s, e)}.`, `Weight ${e.weight} → ${op.weight}. Its endpoints did not change.`, "Every vertex, every other edge, marks, highlights and positions."),
                { kind: "weight", id: e.id, oldWeight: e.weight },
                { label: "Updated weight", value: { id: e.id, old: e.weight, new: op.weight } },
                { vertexId: null, edgeId: e.id },
            );
        }
        case "readEdge": {
            const a = needV(s, ran, op.sourceId);
            if (isOutcome(a)) return a;
            const b = needV(s, ran, op.targetId);
            if (isOutcome(b)) return b;
            const e = findEdge(s, a.id, b.id);
            if (!e) return reject(s, ran, `There is no edge ${a.id} ${arrowOf(s)} ${b.id}.`);
            return accept(s, ex(ran, `Edge ${edgeName(s, e)}.`, READ_ONLY, ALL_SAME), { kind: "read", vertexIds: [e.source, e.target], edgeIds: [e.id] }, { label: `Edge ${e.id}`, value: edgeDetails(s, e) }, { vertexId: null, edgeId: e.id });
        }
        case "hasEdge": {
            const a = needV(s, ran, op.sourceId);
            if (isOutcome(a)) return a;
            const b = needV(s, ran, op.targetId);
            if (isOutcome(b)) return b;
            const e = findEdge(s, a.id, b.id);
            return accept(
                s,
                ex(ran, e ? `Yes: ${edgeName(s, e)}.` : `No edge ${a.id} ${arrowOf(s)} ${b.id}.${p.directed ? " Direction matters: the opposite edge is a different edge." : ""}`, READ_ONLY, ALL_SAME),
                e ? { kind: "read", vertexIds: [e.source, e.target], edgeIds: [e.id] } : NONE,
                { label: "Has edge?", value: !!e },
                e ? { vertexId: null, edgeId: e.id } : undefined,
            );
        }
        case "getEdges":
            return accept(s, ex(ran, `${E} edge${E === 1 ? "" : "s"}.`, READ_ONLY, ALL_SAME), NONE, { label: "Edges", value: edgeList(s).map((e) => edgeDetails(s, e)) });
        case "getDegree":
        case "getInDegree":
        case "getOutDegree": {
            const v = needV(s, ran, op.vertexId);
            if (isOutcome(v)) return v;
            if (op.type !== "getDegree" && !p.directed) return reject(s, ran, `${op.type}() needs a directed graph: an undirected graph has no incoming or outgoing edges. Use getDegree(${v.id}).`);
            const d = degreeInfo(s, v.id);
            const n = op.type === "getDegree" ? d.total : op.type === "getInDegree" ? d.in : d.out;
            const word = op.type === "getDegree" ? "Degree" : op.type === "getInDegree" ? "In-degree" : "Out-degree";
            const hasLoop = edgeList(s).some((e) => e.source === v.id && e.target === v.id);
            return accept(
                s,
                ex(ran, `${word} of ${v.id}: ${n}${op.type === "getDegree" && p.directed ? ` (in ${d.in} + out ${d.out})` : ""}.${hasLoop ? ` ${LOOP_RULE}` : ""}`, READ_ONLY, ALL_SAME),
                { kind: "read", vertexIds: [v.id], edgeIds: incidentEdges(s, v.id) },
                { label: `${word} of ${v.id}`, value: n },
                { vertexId: v.id, edgeId: null },
            );
        }

        /* ── layout (never touches topology) ── */
        case "moveVertex": {
            const v = needV(s, ran, op.vertexId);
            if (isOutcome(v)) return v;
            if (!Number.isFinite(op.x) || !Number.isFinite(op.y)) return reject(s, ran, "x and y must be finite numbers.");
            const hiX = G.W - G.R;
            const hiY = G.H - G.R;
            if (op.x < G.R || op.x > hiX || op.y < G.R || op.y > hiY) return reject(s, ran, `Keep the vertex on the canvas: x between ${G.R} and ${hiX}, y between ${G.R} and ${hiY}.`);
            const from = s.positions[v.id];
            if (from.x === op.x && from.y === op.y) return accept(s, ex(ran, `Vertex ${v.id}.`, "It is already there, so nothing changed.", ALL_SAME));
            return accept(
                { ...s, positions: { ...s.positions, [v.id]: { x: op.x, y: op.y } } },
                ex(ran, `Vertex ${v.id}: (${from.x}, ${from.y}) → (${op.x}, ${op.y}).`, "Only the drawing position changed. Layout is separate from topology.", "Every vertex id and value, every edge and weight, degrees, marks and highlights."),
                op.dragged ? NONE : { kind: "move", id: v.id },
            );
        }

        /* ── annotations ── */
        case "highlight": {
            if (!HEX_RE.test(op.color)) return reject(s, ran, COLOR_HELP);
            let ids: string[];
            if (op.vertexId === undefined || op.vertexId === "") {
                ids = vertexIds(s);
                if (!ids.length) return reject(s, ran, "The graph is empty, so there is nothing to highlight.");
            } else {
                const v = needV(s, ran, op.vertexId);
                if (isOutcome(v)) return v;
                ids = [v.id];
            }
            const c = op.color.toUpperCase();
            const hl = { ...s.highlights };
            for (const id of ids) hl[id] = c;
            return accept({ ...s, highlights: hl }, ex(ran, ids.length === 1 ? `Vertex ${ids[0]}.` : `All ${ids.length} vertices (no vertex was given).`, `Filled with ${c} and given a dashed ring. It stays until cleared or the vertex is deleted.`, "Every vertex, edge, weight and mark."), { kind: "highlight", ids });
        }
        case "clearHighlights": {
            const c = Object.keys(s.highlights).length;
            if (!c) return reject(s, ran, "There is no highlight to clear.");
            return accept({ ...s, highlights: {} }, ex(ran, "All vertices.", `${c} highlight(s) removed.`, "Vertices, edges, marks and arrows."));
        }
        case "pointArrow": {
            if (op.graph !== self) return reject(s, ran, `Graph "${op.graph}" does not exist. This graph is "${self}".`);
            const color = (op.color ?? ARROW_DEFAULT_COLOR).toUpperCase();
            if (!HEX_RE.test(color)) return reject(s, ran, COLOR_HELP);
            const v = needV(s, ran, op.vertexId);
            if (isOutcome(v)) return v;
            const id = lowestFreeId(s.arrows.map((a) => a.id), "a");
            return accept({ ...s, arrows: [...s.arrows, { id, fromId: null, toId: v.id, color }] }, ex(ran, `Vertex ${v.id}.`, `A ${color} annotation arrow points at it. It is not an edge.`, "Every vertex, edge and weight."), { kind: "arrow", id });
        }
        case "pointArrowFromTo": {
            for (const g of [op.graph1, op.graph2]) if (g !== self) return reject(s, ran, `Graph "${g}" does not exist. This graph is "${self}".`);
            const a = needV(s, ran, op.vertexId1);
            if (isOutcome(a)) return a;
            const b = needV(s, ran, op.vertexId2);
            if (isOutcome(b)) return b;
            if (a.id === b.id) return reject(s, ran, "The arrow's start and end are the same vertex.");
            const color = (op.color ?? "#17A34A").toUpperCase();
            if (!HEX_RE.test(color)) return reject(s, ran, COLOR_HELP);
            const id = lowestFreeId(s.arrows.map((x) => x.id), "a");
            return accept({ ...s, arrows: [...s.arrows, { id, fromId: a.id, toId: b.id, color }] }, ex(ran, `Vertices ${a.id} → ${b.id}.`, `A dashed ${color} annotation arrow runs between them. It is NOT an edge: no edge was created.`, "Every vertex, edge and weight."), { kind: "arrow", id });
        }
        case "clearArrows": {
            if (!s.arrows.length) return reject(s, ran, "There are no arrows to clear.");
            return accept({ ...s, arrows: [] }, ex(ran, "All annotation arrows.", `${s.arrows.length} arrow(s) removed. Edges are not arrows you drew, so they stay.`, "Vertices, edges, marks and highlights."), { kind: "dismiss", prev: s });
        }

        /* ── marks (follow vertex ids, never screen positions) ── */
        case "mark":
        case "createMark": {
            const v = needV(s, ran, op.vertexId);
            if (isOutcome(v)) return v;
            let id: string;
            if (op.type === "createMark") {
                if (!NAME_RE.test(op.markId)) return reject(s, ran, MARKER_HELP);
                if (s.markers.some((m) => m.id === op.markId)) return reject(s, ran, `A mark named ${op.markId} already exists. Use moveMarkToIndex(${op.markId}, vertexId) to move it.`);
                id = op.markId;
            } else id = lowestFreeId(s.markers.map((m) => m.id), "m");
            return accept({ ...s, markers: [...s.markers, { id, vertexId: v.id }] }, ex(ran, `Vertex ${v.id} (${fmt(v.value)}).`, `Mark ${id} now follows this vertex by id, wherever it is dragged. It disappears if the vertex is deleted.`, "Every vertex, edge and weight."), { kind: "markIn", markId: id }, { label: "Created mark", value: id });
        }
        case "deleteMark": {
            const m = op.markId ? s.markers.find((x) => x.id === op.markId) : s.markers[s.markers.length - 1];
            if (!m) return reject(s, ran, op.markId ? `No mark "${op.markId}".` : "There are no marks to delete.");
            return accept({ ...s, markers: s.markers.filter((x) => x !== m) }, ex(ran, `Mark ${m.id}.`, `Mark ${m.id} was removed. Vertex ${m.vertexId} is untouched.`, "Every vertex, edge and weight."), { kind: "markOut", vertexId: m.vertexId, markId: m.id });
        }
        case "readMark": {
            const id = op.markId ?? DEFAULT_MARK;
            const m = s.markers.find((x) => x.id === id);
            if (!m) return reject(s, ran, `No mark "${id}".${op.markId === undefined ? " Mark P may have been removed with its vertex; use moveMarkTo(vertexId) to bring it back." : ""}`);
            return accept(s, ex(ran, `Mark ${m.id} is on vertex ${m.vertexId} (${fmt(s.vertices[m.vertexId].value)}).`, READ_ONLY, ALL_SAME), { kind: "read", vertexIds: [m.vertexId], edgeIds: [] }, { label: `Mark ${m.id}`, value: vertexDetails(s, m.vertexId) }, { vertexId: m.vertexId, edgeId: null });
        }
        case "moveMarkTo":
        case "moveMarkToIndex": {
            const id = op.type === "moveMarkTo" ? DEFAULT_MARK : op.markId;
            const v = needV(s, ran, op.vertexId);
            if (isOutcome(v)) return v;
            const m = s.markers.find((x) => x.id === id);
            if (!m) {
                if (op.type === "moveMarkToIndex") return reject(s, ran, `No mark "${id}".`);
                return accept({ ...s, markers: [...s.markers, { id, vertexId: v.id }] }, ex(ran, `Vertex ${v.id}.`, "Mark P did not exist (it is removed with its vertex), so it was created here.", "Every vertex, edge and weight."), { kind: "markIn", markId: id }, { label: "Mark P", value: v.id });
            }
            if (m.vertexId === v.id) return reject(s, ran, `Mark ${m.id} is already on ${v.id}.`);
            return accept({ ...s, markers: s.markers.map((x) => (x === m ? { ...x, vertexId: v.id } : x)) }, ex(ran, `Mark ${m.id}: ${m.vertexId} → ${v.id}.`, `Mark ${m.id} moved to vertex ${v.id} (${fmt(v.value)}).`, "Every vertex, edge and weight."), { kind: "markMove", markId: m.id, fromId: m.vertexId }, { label: `Mark ${m.id}`, value: v.id });
        }
    }
}
