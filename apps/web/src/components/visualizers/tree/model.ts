import type { InitSpec, Primitive, Shape, TreeState, TreeType } from "./types";
import { bstViolations, placeBst } from "./bst";

/**
 * Pure data model: no DOM, no React, no animation.
 *
 * INVARIANTS (checked by checkInvariants, and tested after every operation):
 *   - every pointer refers to an existing node; child.parent === its parent (parent pointers agree).
 *   - every node has AT MOST ONE parent; no node is its own ancestor (no cycles).
 *   - the root has no parent; detached roots have no parent and are not the root.
 *   - every node belongs to exactly one tree: the active tree or one detached subtree (no orphans).
 *   - BST type: strict ordering, one key type, no duplicates (see bst.ts).
 *   - markers, highlights and arrows only refer to existing nodes.
 */
export const MAX_NODES = 15;
export const MAX_PATH = 12;
export const TREE_ID = "T";
export const ARROW_DEFAULT_COLOR = "#0070F3";
/** Exact shape, valid as a Binary Tree AND as a BST, so switching type works out of the box. */
export const STARTER_SHAPE: Shape = {
    value: 10,
    left: { value: 5, left: { value: 3, left: null, right: null }, right: { value: 7, left: null, right: null } },
    right: { value: 15, left: null, right: { value: 20, left: null, right: null } },
};
export const STARTER_VALUES: readonly Primitive[] = [10, 5, 15, 3, 7, 20];
export const TYPE_LABEL: Record<TreeType, string> = { binary: "Binary tree", bst: "Binary search tree" };
export const DEFAULT_MARK = "P";

export const lengthOf = (s: TreeState) => Object.keys(s.nodes).length;

/** Preorder ids of the subtree under `id`. Bounded by the node count, so a corrupt tree cannot loop forever. */
export function subtreeIds(s: Pick<TreeState, "nodes">, id: string): string[] {
    const out: string[] = [];
    const seen = new Set<string>();
    const stack = [id];
    const cap = Object.keys(s.nodes).length;
    while (stack.length && out.length < cap) {
        const cur = stack.pop()!;
        if (seen.has(cur) || !s.nodes[cur]) continue;
        seen.add(cur);
        out.push(cur);
        const n = s.nodes[cur];
        if (n.right) stack.push(n.right);
        if (n.left) stack.push(n.left);
    }
    return out;
}
export const activeIds = (s: TreeState) => (s.root ? subtreeIds(s, s.root) : []);

/** Root of the (active or detached) tree that contains this node. */
export function treeRootOf(s: Pick<TreeState, "nodes">, id: string): string {
    let cur = id;
    for (let guard = 0; s.nodes[cur]?.parent && guard <= Object.keys(s.nodes).length; guard++) cur = s.nodes[cur].parent!;
    return cur;
}
export const isActive = (s: TreeState, id: string) => s.root !== null && treeRootOf(s, id) === s.root;

/** Edges from the root of its own tree down to the node. */
export function depthOf(s: Pick<TreeState, "nodes">, id: string): number {
    let d = 0;
    let cur = id;
    for (let guard = 0; s.nodes[cur]?.parent && guard <= Object.keys(s.nodes).length; guard++) {
        cur = s.nodes[cur].parent!;
        d++;
    }
    return d;
}
/** Height in edges: a leaf is 0 and an empty tree is -1. */
export function heightOf(s: Pick<TreeState, "nodes">, id: string | null, guard = 0): number {
    if (id === null || !s.nodes[id] || guard > Object.keys(s.nodes).length) return -1;
    const n = s.nodes[id];
    return 1 + Math.max(heightOf(s, n.left, guard + 1), heightOf(s, n.right, guard + 1));
}
export const degreeOf = (s: Pick<TreeState, "nodes">, id: string) => (s.nodes[id].left ? 1 : 0) + (s.nodes[id].right ? 1 : 0);
/** True when `a` is `b` or one of b's ancestors. */
export function isAncestorOrSelf(s: Pick<TreeState, "nodes">, a: string, b: string): boolean {
    let cur: string | null = b;
    for (let guard = 0; cur !== null && guard <= Object.keys(s.nodes).length; guard++) {
        if (cur === a) return true;
        cur = s.nodes[cur]?.parent ?? null;
    }
    return false;
}

export function emptyTree(type: TreeType): TreeState {
    return { type, nodes: {}, root: null, detached: [], markers: [], highlights: {}, arrows: [] };
}

/** The default Mark P sits on the root. */
export function withDefaultMark(s: TreeState): TreeState {
    return s.root && !s.markers.some((m) => m.id === DEFAULT_MARK) ? { ...s, markers: [...s.markers, { id: DEFAULT_MARK, nodeId: s.root }] } : s;
}

/** Builds a whole tree from scratch, so its ids are n1, n2, … (the old tree is gone entirely). */
function fromShape(type: TreeType, shape: Shape | null): TreeState {
    const s = emptyTree(type);
    let counter = 1;
    const build = (sh: Shape | null, parent: string | null): string | null => {
        if (!sh) return null;
        const id = `n${counter++}`;
        s.nodes[id] = { id, value: sh.value, left: null, right: null, parent };
        s.nodes[id].left = build(sh.left, id);
        s.nodes[id].right = build(sh.right, id);
        return id;
    };
    s.root = build(shape, null);
    return s;
}

/** Binary tree: values fill the tree level by level, left to right. BST: each value is inserted by the ordering rule. */
function fromValues(type: TreeType, values: readonly Primitive[]): { state: TreeState; error?: string } {
    if (type === "binary") {
        const shapeAt = (i: number): Shape | null => (i < values.length ? { value: values[i], left: shapeAt(2 * i + 1), right: shapeAt(2 * i + 2) } : null);
        return { state: fromShape(type, shapeAt(0)) };
    }
    const s = emptyTree(type);
    for (let i = 0; i < values.length; i++) {
        const v = values[i];
        const id = `n${i + 1}`;
        if (s.root === null) {
            if (bstViolations({ nodes: { [id]: { id, value: v, left: null, right: null, parent: null } }, root: id, detached: [] }).length)
                return { state: s, error: `value ${i} (${JSON.stringify(v)}) cannot be placed in a BST: only numbers or strings can be ordered` };
            s.nodes[id] = { id, value: v, left: null, right: null, parent: null };
            s.root = id;
        } else {
            const p = placeBst(s.nodes, s.root, v);
            if ("error" in p) return { state: s, error: `value ${i}: ${p.error}` };
            if ("duplicate" in p) return { state: s, error: `value ${i} (${JSON.stringify(v)}) is a duplicate of ${p.duplicate}: a BST stores each value once` };
            s.nodes[id] = { id, value: v, left: null, right: null, parent: p.parent };
            s.nodes[p.parent] = { ...s.nodes[p.parent], [p.side]: id };
        }
    }
    return { state: s };
}

export function buildTree(type: TreeType, spec: InitSpec): { state: TreeState; error?: string } {
    const built = spec.kind === "shape" ? { state: fromShape(type, spec.root) } : fromValues(type, spec.values);
    if (built.error) return built;
    if (type === "bst") {
        const bad = bstViolations(built.state);
        if (bad.length) return { state: built.state, error: `that shape is not a valid BST: ${bad[0]}` };
    }
    return { state: withDefaultMark(built.state) };
}

/** With no values, builds the starter tree. With values: a Binary Tree is filled level by level, a BST is inserted one by one. */
export const createTree = (type: TreeType, values?: readonly Primitive[]): TreeState =>
    buildTree(type, values ? { kind: "values", values: [...values] } : { kind: "shape", root: STARTER_SHAPE }).state;

/* ───────────── invariants ───────────── */

export function checkInvariants(s: TreeState): string[] {
    const bad: string[] = [];
    const ids = Object.keys(s.nodes);
    const parentCount: Record<string, number> = {};
    for (const id of ids) {
        const n = s.nodes[id];
        if (n.id !== id) bad.push(`node key ${id} does not match its id`);
        for (const side of ["left", "right"] as const) {
            const c = n[side];
            if (c === null) continue;
            if (!s.nodes[c]) bad.push(`${id}.${side} points at missing node ${c}`);
            else {
                parentCount[c] = (parentCount[c] ?? 0) + 1;
                if (s.nodes[c].parent !== id) bad.push(`${c}.parent is ${s.nodes[c].parent}, expected ${id}`);
            }
            if (c === id) bad.push(`${id} is its own ${side} child`);
        }
        if (n.left !== null && n.left === n.right) bad.push(`${id} has the same node as left and right child`);
        if (n.parent !== null && !s.nodes[n.parent]) bad.push(`${id}.parent points at missing node ${n.parent}`);
    }
    for (const id of ids) {
        if ((parentCount[id] ?? 0) > 1) bad.push(`${id} has ${parentCount[id]} parents`);
        if ((parentCount[id] ?? 0) === 0 && s.nodes[id].parent !== null) bad.push(`${id}.parent is set but no node points down to it`);
    }
    if (s.root !== null) {
        if (!s.nodes[s.root]) bad.push("root is not a node");
        else if (s.nodes[s.root].parent !== null) bad.push("root must not have a parent");
    }
    const roots = [...(s.root !== null ? [s.root] : []), ...s.detached];
    if (new Set(roots).size !== roots.length) bad.push("a tree root is listed twice");
    for (const d of s.detached) {
        if (!s.nodes[d]) bad.push(`detached root ${d} is not a node`);
        else if (s.nodes[d].parent !== null) bad.push(`detached root ${d} still has a parent`);
    }
    // every node belongs to exactly one tree, and no tree contains a cycle
    const owner = new Map<string, string>();
    for (const r of roots) {
        if (!s.nodes[r]) continue;
        const seen = new Set<string>();
        const stack = [r];
        while (stack.length) {
            const cur = stack.pop()!;
            if (seen.has(cur)) {
                bad.push(`cycle: ${cur} is reached twice from ${r}`);
                break;
            }
            seen.add(cur);
            if (owner.has(cur)) bad.push(`${cur} is in two trees`);
            owner.set(cur, r);
            const n = s.nodes[cur];
            if (!n) continue;
            if (n.left) stack.push(n.left);
            if (n.right) stack.push(n.right);
        }
    }
    for (const id of ids) if (!owner.has(id)) bad.push(`${id} is orphaned: it is in no tree`);
    if (s.type === "bst") bad.push(...bstViolations(s));
    for (const m of s.markers) if (!s.nodes[m.nodeId]) bad.push(`marker ${m.id} points at a missing node`);
    if (new Set(s.markers.map((m) => m.id)).size !== s.markers.length) bad.push("two markers share a name");
    for (const id of Object.keys(s.highlights)) if (!s.nodes[id]) bad.push(`highlight on missing node ${id}`);
    for (const a of s.arrows) if (!s.nodes[a.toId] || (a.fromId !== null && !s.nodes[a.fromId])) bad.push(`arrow ${a.id} points at a missing node`);
    return bad;
}

/* ───────────── edges: the lines the stage draws ───────────── */

export interface Edge {
    key: string; // "parent>child:left"
    from: string;
    to: string;
    kind: "left" | "right";
}
export const edgeKey = (from: string, to: string, kind: "left" | "right") => `${from}>${to}:${kind}`;
export function parseEdgeKey(key: string): Edge {
    const [pair, kind] = key.split(":");
    const [from, to] = pair.split(">");
    return { key, from, to, kind: kind as "left" | "right" };
}
/** Every child pointer that is set. A missing child has no line. */
export function edgesOf(s: Pick<TreeState, "nodes">): Edge[] {
    const out: Edge[] = [];
    for (const id of Object.keys(s.nodes)) {
        const n = s.nodes[id];
        if (n.left) out.push({ key: edgeKey(id, n.left, "left"), from: id, to: n.left, kind: "left" });
        if (n.right) out.push({ key: edgeKey(id, n.right, "right"), from: id, to: n.right, kind: "right" });
    }
    return out;
}

const fmt = (v: Primitive) => JSON.stringify(v);
function nest(s: TreeState, id: string | null, guard = 0): string {
    if (id === null || !s.nodes[id] || guard > 40) return "·";
    const n = s.nodes[id];
    return !n.left && !n.right ? fmt(n.value) : `${fmt(n.value)} (${nest(s, n.left, guard + 1)}, ${nest(s, n.right, guard + 1)})`;
}
/** One-line description used by the Before / After summaries. */
export function describe(s: TreeState): string {
    const count = activeIds(s).length;
    const head = `nodes ${count}${s.detached.length ? ` + ${lengthOf(s) - count} detached` : ""} · ${s.root ? `root ${fmt(s.nodes[s.root].value)}` : "empty"}`;
    const body = s.root ? nest(s, s.root) : "(empty tree)";
    const det = s.detached.map((d) => `detached: ${nest(s, d)}`).join("\n");
    return `${head}\n${body}${det ? `\n${det}` : ""}`;
}

/** Follow an L/R path from the root. Returns the ids visited (root first) and how far it got. */
export function walkPath(s: TreeState, path: string): { ids: string[]; missingAt: number | null } {
    const ids: string[] = [];
    let cur = s.root;
    if (cur === null) return { ids, missingAt: 0 };
    ids.push(cur);
    for (let i = 0; i < path.length; i++) {
        const next: string | null = s.nodes[cur!][path[i] === "L" ? "left" : "right"];
        if (next === null) return { ids, missingAt: i };
        ids.push(next);
        cur = next;
    }
    return { ids, missingAt: null };
}
export const pathOf = (s: TreeState, id: string): string => {
    let out = "";
    let cur = id;
    for (let guard = 0; s.nodes[cur]?.parent && guard <= lengthOf(s); guard++) {
        const p = s.nodes[s.nodes[cur].parent!];
        out = (p.left === cur ? "L" : "R") + out;
        cur = p.id;
    }
    return out;
};
