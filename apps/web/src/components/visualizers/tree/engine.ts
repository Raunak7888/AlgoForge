import { HEX_RE, isPrimitive } from "../core/validate";
import { BST_RULE, bstViolations, compare, leftmost, placeBst, whyNotKey } from "./bst";
import {
    ARROW_DEFAULT_COLOR,
    DEFAULT_MARK,
    MAX_NODES,
    TREE_ID,
    TYPE_LABEL,
    activeIds,
    buildTree,
    createTree,
    degreeOf,
    depthOf,
    describe,
    emptyTree,
    heightOf,
    isActive,
    isAncestorOrSelf,
    lengthOf,
    pathOf,
    subtreeIds,
    treeRootOf,
    walkPath,
    withDefaultMark,
} from "./model";
import { lowestFreeId } from "../shared/ids";
import { buildSteps } from "./steps";
import type { Anim, Explain, Outcome, Primitive, Side, Step, TNode, TreeOp, TreeState, TreeType } from "./types";
import { MARKER_HELP, NAME_RE, NODE_ID_HELP } from "./validate";

const NONE: Anim = { kind: "none" };
const COLOR_HELP = "Color must look like #RRGGBB, e.g. #FF430F.";
const READ_ONLY = "Nothing. This is a read-only operation, so the tree did not change.";
const ALL_SAME = "Every node, value, pointer, the root, marks, highlights and arrows.";

export const fmt = (v: unknown) => JSON.stringify(v);

export function callText(op: TreeOp): string {
    const { type, ...rest } = op;
    if (type === "initialize") {
        const d = (op as Extract<TreeOp, { type: "initialize" }>).data;
        return d.kind === "values" ? `initialize(${d.values.length} value${d.values.length === 1 ? "" : "s"})` : "initialize(shape)";
    }
    const args = Object.values(rest)
        .filter((v) => v !== undefined)
        .map((v) => JSON.stringify(v))
        .join(", ");
    return `${type}(${args})`;
}

const ex = (ran: string, affected: string, changed: string, unchanged: string): Explain => ({ ran, affected, changed, unchanged });

function reject(s: TreeState, ran: string, error: string): Outcome {
    return {
        ok: false,
        state: s,
        anim: NONE,
        steps: [],
        error,
        explain: ex(`${ran} (rejected)`, "Nothing.", error, "Everything: nodes, pointers, the root, marks and arrows are exactly as before."),
    };
}
function accept(state: TreeState, explain: Explain, anim: Anim = NONE, steps: Step[] = [], result?: Outcome["result"], select?: string | null): Outcome {
    return { ok: true, state, explain, anim, steps, result, select };
}
const isOutcome = (x: unknown): x is Outcome => typeof x === "object" && x !== null && "explain" in x;
const stepsText = (steps: Step[]) => (steps.length ? steps.map((x) => x.text).join("; ") + "." : "No pointer changed.");

/* ───────────── helpers ───────────── */

const nodeNotFound = (s: TreeState, id: string) => {
    const ids = Object.keys(s.nodes);
    return ids.length ? `No node has the id "${id}". Existing ids: ${ids.join(", ")}.` : `No node has the id "${id}": the tree is empty.`;
};
function need(s: TreeState, ran: string, id: string): TNode | Outcome {
    if (!NAME_RE.test(id ?? "")) return reject(s, ran, NODE_ID_HELP);
    const n = s.nodes[id];
    return n ?? reject(s, ran, nodeNotFound(s, id));
}
const where = (s: TreeState, id: string) => (isActive(s, id) ? "in the active tree" : `in a detached subtree (root ${treeRootOf(s, id)})`);

interface Draft {
    nodes: Record<string, TNode>;
    root: string | null;
    detached: string[];
}
const draft = (s: TreeState): Draft => ({ nodes: { ...s.nodes }, root: s.root, detached: [...s.detached] });
const patch = (d: Draft, id: string, p: Partial<TNode>) => {
    d.nodes[id] = { ...d.nodes[id], ...p };
};
const finish = (s: TreeState, d: Draft, extra: Partial<TreeState> = {}): TreeState => ({ ...s, nodes: d.nodes, root: d.root, detached: d.detached, ...extra });
const sideOf = (d: Draft, parentId: string, childId: string): Side => (d.nodes[parentId].left === childId ? "left" : "right");

/** Puts `newId` (or nothing) exactly where `oldId` was: in its parent, as the root, or as a detached root. */
function replaceAt(d: Draft, oldId: string, newId: string | null) {
    const p = d.nodes[oldId].parent;
    if (p !== null) {
        patch(d, p, { [sideOf(d, p, oldId)]: newId });
        if (newId) patch(d, newId, { parent: p });
    } else {
        if (newId) patch(d, newId, { parent: null });
        if (d.root === oldId) d.root = newId;
        else d.detached = d.detached.flatMap((x) => (x === oldId ? (newId ? [newId] : []) : [x]));
    }
}
function dropAnnotations(s: TreeState, gone: Set<string>) {
    const highlights = { ...s.highlights };
    for (const id of gone) delete highlights[id];
    return {
        markers: s.markers.filter((m) => !gone.has(m.nodeId)),
        highlights,
        arrows: s.arrows.filter((a) => !gone.has(a.toId) && !(a.fromId && gone.has(a.fromId))),
    };
}
const lostText = (s: TreeState, gone: Set<string>) => {
    const m = s.markers.filter((x) => gone.has(x.nodeId)).map((x) => x.id);
    const a = s.arrows.filter((x) => gone.has(x.toId) || (x.fromId && gone.has(x.fromId))).length;
    return (m.length ? ` Marker${m.length > 1 ? "s" : ""} ${m.join(", ")} on the removed node${gone.size > 1 ? "s" : ""} ${m.length > 1 ? "were" : "was"} removed.` : "") + (a ? ` ${a} arrow(s) were removed.` : "");
};

/** BST guard for operations that could break the ordering. Returns the rejection or null. */
function bstGuard(next: TreeState, s: TreeState, ran: string, what: string): Outcome | null {
    if (next.type !== "bst") return null;
    const bad = bstViolations(next);
    return bad.length ? reject(s, ran, `${what} would break the BST rule (${bad[0]}). Rule: ${BST_RULE}`) : null;
}

const details = (s: TreeState, id: string) => {
    const n = s.nodes[id];
    return {
        id,
        value: n.value,
        parent: n.parent ?? "NULL",
        left: n.left ?? "NULL",
        right: n.right ?? "NULL",
        depth: depthOf(s, id),
        degree: degreeOf(s, id),
        height: heightOf(s, id),
        tree: isActive(s, id) ? "active" : "detached",
        path: isActive(s, id) ? pathOf(s, id) || "(root)" : "(detached)",
    };
};

/* ───────────── shared primitive: attach a brand-new leaf ───────────── */

function addLeaf(s: TreeState, ran: string, parentId: string | null, side: Side, value: Primitive, label: string, why: string): Outcome {
    if (!isPrimitive(value)) return reject(s, ran, "Only strings, numbers, booleans and null are supported.");
    if (lengthOf(s) >= MAX_NODES) return reject(s, ran, `The lab limits the tree to ${MAX_NODES} nodes so it stays readable.`);
    const id = lowestFreeId(Object.keys(s.nodes)); // the lowest free number: delete n6 and the next node is n6 again
    const d = draft(s);
    d.nodes[id] = { id, value, left: null, right: null, parent: parentId };
    if (parentId === null) d.root = id;
    else patch(d, parentId, { [side]: id });
    const next: TreeState = finish(s, d);
    const guard = bstGuard(next, s, ran, "That");
    if (guard) return guard;
    const steps = buildSteps(s, next, { mode: "insert", id });
    const final = parentId === null ? withDefaultMark(next) : next;
    return accept(
        final,
        ex(
            ran,
            `New node ${id} (${fmt(value)}${value === null ? ", null is a real value" : ""}) ${parentId === null ? "became the root" : `was attached as the ${side} child of ${parentId}`}. ${why}`,
            `Node count ${lengthOf(s)} → ${lengthOf(s) + 1}. Pointer changes: ${stepsText(steps)}`,
            lengthOf(s) === 0 ? "Nothing else existed." : `All ${lengthOf(s)} existing nodes keep their ids, values, parents and marks; only one pointer was set.`,
        ),
        { kind: "insert", id, steps },
        steps,
        { label, value: { id, value, parent: parentId ?? "NULL", side: parentId ? side : "root" } },
    );
}

/* ───────────── deletion ───────────── */

function deleteNodePrimitive(s: TreeState, ran: string, id: string): Outcome {
    const n = s.nodes[id];
    const kids = degreeOf(s, id);
    if (kids === 2 && s.type === "binary")
        return reject(
            s,
            ran,
            `${id} has two children, and a plain binary tree has no rule for which one should take its place. Use deleteSubtree(${id}) to remove it with everything below, or detach one child first with detach(${n.left}) and then delete ${id}.`,
        );
    const d = draft(s);
    let how: string;
    let moved: string | null = null;
    if (kids === 0) {
        replaceAt(d, id, null);
        how = `${id} is a leaf, so it is simply removed.`;
    } else if (kids === 1) {
        const c = (n.left ?? n.right)!;
        replaceAt(d, id, c);
        how = `${id} has one child, so ${c} takes its place.`;
    } else {
        // BST, two children: the in-order successor (smallest value in the right subtree) takes its place.
        const sId = leftmost(d.nodes, n.right!);
        moved = sId;
        const sNode = d.nodes[sId];
        if (sId !== n.right) {
            const sp = sNode.parent!;
            patch(d, sp, { left: sNode.right });
            if (sNode.right) patch(d, sNode.right, { parent: sp });
            patch(d, sId, { right: n.right });
            patch(d, n.right!, { parent: sId });
        }
        patch(d, sId, { left: n.left });
        patch(d, n.left!, { parent: sId });
        replaceAt(d, id, sId);
        how = `${id} has two children, so its in-order successor ${sId} (${fmt(sNode.value)}, the smallest value in its right subtree) takes its place.`;
    }
    delete d.nodes[id];
    const gone = new Set([id]);
    const next: TreeState = finish(s, d, dropAnnotations(s, gone));
    const steps = buildSteps(s, next, { mode: "delete", id });
    return accept(
        next,
        ex(
            ran,
            `Node ${id} (${fmt(n.value)}, ${where(s, id)}, ${kids} ${kids === 1 ? "child" : "children"}). ${how}`,
            `Node count ${lengthOf(s)} → ${lengthOf(next)}. Pointer changes: ${stepsText(steps)}${lostText(s, gone)}`,
            (s.type === "bst" ? "The BST rule still holds. " : "") + `Every other node keeps its id and value${moved ? ` (${moved} moved, but it is the same node)` : ""}; only the nodes next to ${id} changed.`,
        ),
        { kind: "delete", ghostIds: [id], prev: s, steps },
        steps,
        { label: "Deleted", value: { id, value: n.value, replacedBy: moved ?? (n.left ?? n.right ?? "NULL") } },
        null,
    );
}

/* ───────────── dispatcher ───────────── */

export function applyOp(s: TreeState, op: TreeOp, self: string = TREE_ID): Outcome {
    const ran = callText(op);
    const total = lengthOf(s);
    const bst = s.type === "bst";

    switch (op.type) {
        /* ── creation ── */
        case "createRoot":
            if (s.root !== null) return reject(s, ran, `The tree already has a root (${s.root}). Use ${bst ? "insert(value)" : "insertNode(parentId, side, value)"} to add more nodes, or clear() first.`);
            return addLeaf(s, ran, null, "left", op.value === undefined ? null : op.value, "Root created", bst ? "The first value of a BST is the root." : "It is the top of the tree.");
        case "insertNode": {
            if (bst) return reject(s, ran, "A BST decides where a value goes. Use insert(value) instead of choosing a position.");
            const p = need(s, ran, op.parentId);
            if (isOutcome(p)) return p;
            if (op.side !== "left" && op.side !== "right") return reject(s, ran, 'side must be "left" or "right".');
            if (p[op.side] !== null)
                return reject(s, ran, `${p.id} already has a ${op.side} child (${p[op.side]}). To replace it, first run setLeft/setRight(${p.id}) with no child to detach it, or detach(${p[op.side]}).`);
            return addLeaf(s, ran, p.id, op.side, op.value === undefined ? null : op.value, "Inserted", "A Binary Tree puts the value exactly where you asked.");
        }
        case "insertAtPath": {
            if (bst) return reject(s, ran, "A BST decides where a value goes. Use insert(value) instead of a path.");
            if (s.root === null) return reject(s, ran, "The tree is empty, so there is no path to follow. Use createRoot(value) first.");
            const path = (op.path ?? "").toUpperCase();
            if (path === "") return reject(s, ran, "An empty path means the root. Use createRoot(value) for an empty tree.");
            const w = walkPath(s, path.slice(0, -1));
            if (w.missingAt !== null) return reject(s, ran, `The path ${path} cannot be followed: after ${w.ids.length === 1 ? "the root" : w.ids[w.ids.length - 1]} there is no ${path[w.missingAt] === "L" ? "left" : "right"} child at step ${w.missingAt + 1}. Create that node first.`);
            const parentId = w.ids[w.ids.length - 1];
            const side: Side = path[path.length - 1] === "L" ? "left" : "right";
            if (s.nodes[parentId][side] !== null) return reject(s, ran, `The slot at path ${path} is already taken by ${s.nodes[parentId][side]}. Choose an empty position.`);
            return addLeaf(s, ran, parentId, side, op.value === undefined ? null : op.value, "Inserted at path", `Path ${path} was followed from the root (${path.length} step${path.length === 1 ? "" : "s"}).`);
        }
        case "insert": {
            if (!bst) return reject(s, ran, "insert(value) is a BST operation: a Binary Tree needs an explicit position. Use insertNode(parentId, side, value) or insertAtPath(path, value).");
            const v = op.value === undefined ? null : op.value;
            if (!isPrimitive(v)) return reject(s, ran, "Only strings, numbers, booleans and null are supported.");
            if (compareKeyless(v)) return reject(s, ran, `${fmt(v)} cannot go into a BST: ${whyNotKey(v)}. ${op.value === undefined ? "A blank value is null. " : ""}Rule: ${BST_RULE}`);
            if (s.root === null) return addLeaf(s, ran, null, "left", v, "Inserted", "The tree was empty, so the first value is the root.");
            const place = placeBst(s.nodes, s.root, v);
            if ("error" in place) return reject(s, ran, `${place.error}.`);
            if ("duplicate" in place) return reject(s, ran, `${fmt(v)} is already in the tree (${place.duplicate}). This BST stores each value once, so nothing was inserted.`);
            const trail = place.path.map((p) => `${fmt(v)} ${p.cmp < 0 ? "<" : ">"} ${fmt(s.nodes[p.id].value)} (${p.id}) → go ${p.cmp < 0 ? "left" : "right"}`).join("; ");
            return addLeaf(s, ran, place.parent, place.side, v, "Inserted", `BST placement: ${trail}; that slot is empty.`);
        }

        /* ── whole tree ── */
        case "initialize": {
            const built = buildTree(s.type, op.data);
            if (built.error) return reject(s, ran, `${built.error}`);
            if (lengthOf(built.state) > MAX_NODES) return reject(s, ran, `At most ${MAX_NODES} nodes are supported.`);
            return accept(
                built.state,
                ex(
                    ran,
                    `${lengthOf(built.state)} new node${lengthOf(built.state) === 1 ? "" : "s"} built as a ${TYPE_LABEL[s.type].toLowerCase()}.`,
                    `Tree replaced: ${total} → ${lengthOf(built.state)} nodes. Detached subtrees, markers, highlights and arrows were cleared; Mark P sits on the new root.`,
                    "The tree type and the operation log.",
                ),
                { kind: "reset", prev: s },
                [],
                { label: "Node count", value: lengthOf(built.state) },
                null,
            );
        }
        case "reset": {
            const next = createTree(s.type);
            return accept(next, ex(ran, "The whole tree.", `Restored the starter ${TYPE_LABEL[s.type].toLowerCase()} (${lengthOf(next)} nodes). Detached subtrees, markers, highlights and arrows were cleared.`, "The tree type and the operation log."), { kind: "reset", prev: s }, [], undefined, null);
        }
        case "clear": {
            if (total === 0) return reject(s, ran, "The tree is already empty.");
            return accept(
                emptyTree(s.type),
                ex(ran, `All ${total} node${total === 1 ? "" : "s"}, including ${s.detached.length} detached subtree${s.detached.length === 1 ? "" : "s"}.`, `Node count ${total} → 0. The root is now NULL. ${s.markers.length} marker(s), ${s.arrows.length} arrow(s) and ${Object.keys(s.highlights).length} highlight(s) were removed with their nodes.`, "The tree type and the operation log."),
                { kind: "clear", prev: s },
                [],
                undefined,
                null,
            );
        }
        case "setType": {
            if (op.to === s.type) return reject(s, ran, `The tree is already a ${TYPE_LABEL[s.type].toLowerCase()}.`);
            if (op.to === "bst") {
                const bad = bstViolations(s);
                if (bad.length)
                    return reject(s, ran, `This tree cannot become a BST: ${bad[0]}${bad.length > 1 ? ` (and ${bad.length - 1} more problem${bad.length > 2 ? "s" : ""})` : ""}. Nothing was converted. Rule: ${BST_RULE}`);
            }
            return accept(
                { ...s, type: op.to },
                ex(
                    ran,
                    op.to === "bst" ? `All ${total} nodes were checked against the BST rule and all passed.` : "Nothing needs checking: a Binary Tree accepts any shape and values.",
                    `The tree is now a ${TYPE_LABEL[op.to].toLowerCase()}. No node, value or pointer changed.`,
                    "Every node, value, pointer, the root, marks, highlights and arrows.",
                ),
                total ? { kind: "retype", ids: activeIds(s) } : NONE,
            );
        }

        /* ── reads ── */
        case "read": {
            const n = need(s, ran, op.nodeId);
            if (isOutcome(n)) return n;
            const v = details(s, n.id);
            return accept(s, ex(ran, `Node ${n.id} (${fmt(n.value)}), ${where(s, n.id)}: depth ${v.depth}, ${v.degree} ${v.degree === 1 ? "child" : "children"}.`, READ_ONLY, ALL_SAME), { kind: "read", id: n.id }, [], { label: `Node ${n.id}`, value: v }, n.id);
        }
        case "readAtPath": {
            if (s.root === null) return reject(s, ran, "The tree is empty, so there is no path to follow.");
            const path = (op.path ?? "").toUpperCase();
            const w = walkPath(s, path);
            if (w.missingAt !== null)
                return reject(s, ran, `The path ${path} stops at step ${w.missingAt + 1}: ${w.ids[w.ids.length - 1]} has no ${path[w.missingAt] === "L" ? "left" : "right"} child.`);
            const id = w.ids[w.ids.length - 1];
            const v = details(s, id);
            return accept(s, ex(ran, `Path ${path || "(empty)"} leads to node ${id} (${fmt(s.nodes[id].value)}).`, READ_ONLY, ALL_SAME), { kind: "path", ids: w.ids }, [], { label: `Node at path ${path || "(root)"}`, value: v }, id);
        }
        case "getRoot": {
            if (s.root === null) return accept(s, ex(ran, "The root.", READ_ONLY, ALL_SAME), NONE, [], { label: "Root", value: { root: null, note: "the tree is empty" } });
            return accept(s, ex(ran, `The root is ${s.root} (${fmt(s.nodes[s.root].value)}).`, READ_ONLY, ALL_SAME), { kind: "read", id: s.root }, [], { label: "Root", value: details(s, s.root) }, s.root);
        }
        case "getParent":
        case "getLeft":
        case "getRight": {
            const n = need(s, ran, op.nodeId);
            if (isOutcome(n)) return n;
            const target = op.type === "getParent" ? n.parent : op.type === "getLeft" ? n.left : n.right;
            const word = op.type === "getParent" ? "parent" : op.type === "getLeft" ? "left child" : "right child";
            const why = target === null && op.type === "getParent" ? (s.root === n.id ? "it is the root" : "it is the root of a detached subtree") : "";
            return accept(
                s,
                ex(ran, target ? `The ${word} of ${n.id} is ${target} (${fmt(s.nodes[target].value)}).` : `${n.id} has no ${word}${why ? `: ${why}` : ""}, so the answer is NULL.`, READ_ONLY, ALL_SAME),
                { kind: "relate", from: n.id, to: target },
                [],
                { label: `${word[0].toUpperCase()}${word.slice(1)} of ${n.id}`, value: target ? { id: target, value: s.nodes[target].value } : { id: null, note: `no ${word}` } },
                n.id,
            );
        }
        case "getHeight": {
            if (op.nodeId === undefined && s.root === null) return accept(s, ex(ran, "The empty tree.", READ_ONLY, ALL_SAME), NONE, [], { label: "Height", value: { height: -1, note: "an empty tree has height -1 (a single node has height 0)" } });
            const id = op.nodeId ?? s.root!;
            const n = need(s, ran, id);
            if (isOutcome(n)) return n;
            const h = heightOf(s, id);
            return accept(s, ex(ran, `Height of ${id}: the longest downward path has ${h} edge${h === 1 ? "" : "s"} (a leaf is 0).`, READ_ONLY, ALL_SAME), { kind: "read", id }, [], { label: `Height of ${id}`, value: h }, id);
        }
        case "getDepth": {
            const n = need(s, ran, op.nodeId);
            if (isOutcome(n)) return n;
            const dd = depthOf(s, n.id);
            return accept(s, ex(ran, `Depth of ${n.id}: ${dd} edge${dd === 1 ? "" : "s"} from ${isActive(s, n.id) ? "the root" : `the root of its detached subtree (${treeRootOf(s, n.id)})`}.`, READ_ONLY, ALL_SAME), { kind: "read", id: n.id }, [], { label: `Depth of ${n.id}`, value: dd }, n.id);
        }
        case "getDegree": {
            const n = need(s, ran, op.nodeId);
            if (isOutcome(n)) return n;
            const dg = degreeOf(s, n.id);
            return accept(s, ex(ran, `Degree of ${n.id}: ${dg} child${dg === 1 ? "" : "ren"} (${n.left ? "left" : "no left"}, ${n.right ? "right" : "no right"}).`, READ_ONLY, ALL_SAME), { kind: "read", id: n.id }, [], { label: `Degree of ${n.id}`, value: dg }, n.id);
        }
        case "getNodeCount": {
            const a = activeIds(s).length;
            return accept(s, ex(ran, `${a} node${a === 1 ? "" : "s"} in the active tree and ${total - a} in detached subtrees.`, READ_ONLY, ALL_SAME), NONE, [], { label: "Node count", value: { active: a, detached: total - a, total } });
        }
        case "isEmpty":
            return accept(s, ex(ran, s.root === null ? "The root is NULL." : `The root is ${s.root}.`, READ_ONLY, ALL_SAME + (s.root === null && total ? ` (${total} detached node${total === 1 ? "" : "s"} still exist outside the active tree.)` : "")), NONE, [], { label: "Is empty?", value: s.root === null });

        /* ── update ── */
        case "update": {
            const n = need(s, ran, op.nodeId);
            if (isOutcome(n)) return n;
            if (!isPrimitive(op.value)) return reject(s, ran, "Only strings, numbers, booleans and null are supported.");
            if (n.value === op.value) return accept(s, ex(ran, `Node ${n.id}.`, `It already holds ${fmt(op.value)}, so nothing changed.`, ALL_SAME));
            const next: TreeState = { ...s, nodes: { ...s.nodes, [n.id]: { ...n, value: op.value } } };
            const guard = bstGuard(next, s, ran, `Changing ${n.id} from ${fmt(n.value)} to ${fmt(op.value)}`);
            if (guard) return guard;
            return accept(next, ex(ran, `Node ${n.id}.`, `Value ${fmt(n.value)} → ${fmt(op.value)}. No pointer changed.${bst ? " The BST rule still holds." : ""}`, "Node count, every pointer, the root, node ids, marks, highlights and arrows."), { kind: "update", id: n.id, oldValue: n.value }, [], { label: "Replaced value", value: { id: n.id, old: n.value, new: op.value } });
        }

        /* ── explicit pointer surgery ── */
        case "setLeft":
        case "setRight": {
            const side: Side = op.type === "setLeft" ? "left" : "right";
            const p = need(s, ran, op.parentId);
            if (isOutcome(p)) return p;
            const cur = p[side];
            if (op.childId === undefined || op.childId === "") {
                // explicit handling of an existing child: it is detached, never silently lost
                if (cur === null) return reject(s, ran, `${p.id} has no ${side} child, so there is nothing to detach.`);
                return detachPrimitive(s, ran, cur, `${p.id}.${side} was set to nothing, so its ${side} child ${cur} is detached.`);
            }
            const c = need(s, ran, op.childId);
            if (isOutcome(c)) return c;
            if (cur !== null) return reject(s, ran, `${p.id} already has a ${side} child (${cur}). To replace it, first run ${op.type}(${p.id}) with no child (or detach(${cur})); the old child then stays in the lab as a detached subtree.`);
            if (!s.detached.includes(c.id))
                return reject(s, ran, c.parent !== null ? `${c.id} is already the ${s.nodes[c.parent].left === c.id ? "left" : "right"} child of ${c.parent}. A node can have only one parent: detach(${c.id}) it first.` : `${c.id} is the root of the active tree. Only a detached subtree can be attached; the root cannot move under another node.`);
            if (isAncestorOrSelf(s, c.id, p.id)) return reject(s, ran, `That would create a cycle: ${p.id} is ${p.id === c.id ? "the same node as" : "inside the subtree of"} ${c.id}, so ${c.id} would become its own ancestor.`);
            const d = draft(s);
            patch(d, p.id, { [side]: c.id });
            patch(d, c.id, { parent: p.id });
            d.detached = d.detached.filter((x) => x !== c.id);
            const next = finish(s, d);
            const guard = bstGuard(next, s, ran, `Attaching ${c.id} as the ${side} child of ${p.id}`);
            if (guard) return guard;
            const steps = buildSteps(s, next, { mode: "generic" });
            return accept(
                next,
                ex(ran, `Subtree ${c.id} (${subtreeIds(s, c.id).length} node${subtreeIds(s, c.id).length === 1 ? "" : "s"}) is attached as the ${side} child of ${p.id} (${where(s, p.id)}).`, `Pointer changes: ${stepsText(steps)} ${c.id} now has exactly one parent.`, "Every node's id and value, and every other pointer."),
                { kind: "rewire", what: "attach", ids: subtreeIds(s, c.id), steps, prev: s },
                steps,
                { label: "Attached", value: { parent: p.id, side, child: c.id } },
            );
        }
        case "detach": {
            const n = need(s, ran, op.nodeId);
            if (isOutcome(n)) return n;
            return detachPrimitive(s, ran, n.id);
        }
        case "deleteNode": {
            const n = need(s, ran, op.nodeId);
            if (isOutcome(n)) return n;
            return deleteNodePrimitive(s, ran, n.id);
        }
        case "deleteSubtree": {
            const n = need(s, ran, op.nodeId);
            if (isOutcome(n)) return n;
            const ids = subtreeIds(s, n.id);
            const d = draft(s);
            const wasActive = isActive(s, n.id);
            replaceAt(d, n.id, null);
            for (const id of ids) delete d.nodes[id];
            const gone = new Set(ids);
            const next = finish(s, d, dropAnnotations(s, gone));
            const steps = buildSteps(s, next, { mode: "delete", id: n.id });
            return accept(
                next,
                ex(
                    ran,
                    `Node ${n.id} and everything below it: ${ids.length} node${ids.length === 1 ? "" : "s"} (${ids.join(", ")}), ${wasActive ? "from the active tree" : "from a detached subtree"}.`,
                    `Node count ${total} → ${total - ids.length}. These nodes no longer exist. Pointer changes: ${stepsText(steps)}${n.parent === null && wasActive ? " The tree is now empty." : ""}${lostText(s, gone)}`,
                    "Every node outside that subtree keeps its id, value and marks.",
                ),
                { kind: "delete", ghostIds: ids, prev: s, steps },
                steps,
                { label: "Deleted subtree", value: { root: n.id, removed: ids, count: ids.length } },
                null,
            );
        }
        case "swapChildren": {
            const n = need(s, ran, op.nodeId);
            if (isOutcome(n)) return n;
            if (n.left === null && n.right === null) return reject(s, ran, `${n.id} is a leaf: it has no children to swap.`);
            const d = draft(s);
            patch(d, n.id, { left: n.right, right: n.left });
            const next = finish(s, d);
            const guard = bstGuard(next, s, ran, `Swapping the children of ${n.id}`);
            if (guard) return guard;
            const steps = buildSteps(s, next, { mode: "generic" });
            return accept(
                next,
                ex(ran, `Node ${n.id}: its left subtree (${n.left ?? "none"}) and right subtree (${n.right ?? "none"}) trade sides.`, `Pointer changes: ${stepsText(steps)} Whole subtrees move; nothing inside them changes.`, "Every node's id and value, and every pointer below the two children."),
                { kind: "rewire", what: "swap", ids: [...(n.left ? subtreeIds(s, n.left) : []), ...(n.right ? subtreeIds(s, n.right) : [])], steps, prev: s },
                steps,
            );
        }

        /* ── markers (follow node ids) ── */
        case "mark":
        case "createMark": {
            const n = need(s, ran, op.nodeId);
            if (isOutcome(n)) return n;
            let id: string;
            if (op.type === "createMark") {
                if (!NAME_RE.test(op.markId)) return reject(s, ran, MARKER_HELP);
                if (s.markers.some((m) => m.id === op.markId)) return reject(s, ran, `A marker named ${op.markId} already exists. Use moveMarkToIndex(${op.markId}, nodeId) to move it.`);
                id = op.markId;
            } else id = lowestFreeId(s.markers.map((m) => m.id), "m");
            return accept(
                { ...s, markers: [...s.markers, { id, nodeId: n.id }] },
                ex(ran, `Node ${n.id} (${fmt(n.value)}).`, `Marker ${id} now sticks to this node by id. It follows the node when the layout changes and disappears if the node is deleted.`, "Every node, pointer and the root."),
                { kind: "markIn", markId: id },
                [],
                { label: "Created marker", value: id },
            );
        }
        case "deleteMark": {
            const m = op.markId ? s.markers.find((x) => x.id === op.markId) : s.markers[s.markers.length - 1];
            if (!m) return reject(s, ran, op.markId ? `No marker "${op.markId}".` : "There are no markers to delete.");
            return accept({ ...s, markers: s.markers.filter((x) => x !== m) }, ex(ran, `Marker ${m.id}.`, `Marker ${m.id} was removed. Node ${m.nodeId} is untouched.`, "Every node, pointer and the root."), { kind: "markOut", nodeId: m.nodeId, markId: m.id });
        }
        case "readMark": {
            const id = op.markId ?? DEFAULT_MARK;
            const m = s.markers.find((x) => x.id === id);
            if (!m) return reject(s, ran, `No marker "${id}".${op.markId === undefined ? " Mark P may have been removed with its node; use moveMarkTo(nodeId) to bring it back." : ""}`);
            return accept(s, ex(ran, `Marker ${m.id} is on node ${m.nodeId} (${fmt(s.nodes[m.nodeId].value)}).`, READ_ONLY, ALL_SAME), { kind: "read", id: m.nodeId }, [], { label: `Marker ${m.id}`, value: details(s, m.nodeId) }, m.nodeId);
        }
        case "moveMarkTo":
        case "moveMarkToIndex": {
            const id = op.type === "moveMarkTo" ? DEFAULT_MARK : op.markId;
            const n = need(s, ran, op.nodeId);
            if (isOutcome(n)) return n;
            const m = s.markers.find((x) => x.id === id);
            if (!m) {
                if (op.type === "moveMarkToIndex") return reject(s, ran, `No marker "${id}".`);
                return accept({ ...s, markers: [...s.markers, { id, nodeId: n.id }] }, ex(ran, `Node ${n.id}.`, `Mark P did not exist (it is removed along with its node), so it was created on ${n.id}.`, "Every node, pointer and the root."), { kind: "markIn", markId: id }, [], { label: "Mark P", value: n.id });
            }
            if (m.nodeId === n.id) return reject(s, ran, `Marker ${m.id} is already on ${n.id}.`);
            return accept(
                { ...s, markers: s.markers.map((x) => (x === m ? { ...x, nodeId: n.id } : x)) },
                ex(ran, `Marker ${m.id}: ${m.nodeId} → ${n.id}.`, `Marker ${m.id} moved to node ${n.id} (${fmt(n.value)}).`, "Every node, pointer and the root."),
                { kind: "markMove", markId: m.id, fromId: m.nodeId },
                [],
                { label: `Marker ${m.id}`, value: n.id },
            );
        }

        /* ── annotations ── */
        case "highlight": {
            if (!HEX_RE.test(op.color)) return reject(s, ran, COLOR_HELP);
            const id = op.nodeId ?? s.root;
            if (id === null) return reject(s, ran, "The tree is empty, so there is no node to highlight.");
            const n = need(s, ran, id);
            if (isOutcome(n)) return n;
            return accept({ ...s, highlights: { ...s.highlights, [n.id]: op.color.toUpperCase() } }, ex(ran, `Node ${n.id}${op.nodeId === undefined ? " (the root, because no node was given)" : ""}.`, `Node filled with ${op.color.toUpperCase()}. It stays until cleared or the node is deleted.`, "Every node, pointer and the root."), { kind: "highlight", id: n.id });
        }
        case "clearHighlights": {
            const c = Object.keys(s.highlights).length;
            if (!c) return reject(s, ran, "There is no highlight to clear.");
            return accept({ ...s, highlights: {} }, ex(ran, "All nodes.", `${c} highlight(s) removed.`, "Nodes, pointers, markers and arrows."));
        }
        case "pointArrow": {
            if (op.tree !== self) return reject(s, ran, `Tree "${op.tree}" does not exist. This tree is "${self}".`);
            const color = (op.color ?? ARROW_DEFAULT_COLOR).toUpperCase();
            if (!HEX_RE.test(color)) return reject(s, ran, COLOR_HELP);
            const n = need(s, ran, op.nodeId);
            if (isOutcome(n)) return n;
            const id = lowestFreeId(s.arrows.map((a) => a.id), "a");
            return accept({ ...s, arrows: [...s.arrows, { id, fromId: null, toId: n.id, color }] }, ex(ran, `Node ${n.id}.`, `A ${color} annotation arrow now points at this node. It is not a tree pointer.`, "Every node, pointer and the root."), { kind: "arrow", id });
        }
        case "pointArrowFromTo": {
            for (const t of [op.tree1, op.tree2]) if (t !== self) return reject(s, ran, `Tree "${t}" does not exist. This tree is "${self}".`);
            const a = need(s, ran, op.nodeId1);
            if (isOutcome(a)) return a;
            const b = need(s, ran, op.nodeId2);
            if (isOutcome(b)) return b;
            if (a.id === b.id) return reject(s, ran, "The arrow's start and end are the same node.");
            const color = (op.color ?? "#17A34A").toUpperCase();
            if (!HEX_RE.test(color)) return reject(s, ran, COLOR_HELP);
            const id = lowestFreeId(s.arrows.map((x) => x.id), "a");
            return accept({ ...s, arrows: [...s.arrows, { id, fromId: a.id, toId: b.id, color }] }, ex(ran, `Nodes ${a.id} → ${b.id}.`, `A ${color} annotation arrow now runs between them. It is not a tree pointer.`, "Every node, pointer and the root."), { kind: "arrow", id });
        }
        case "clearArrows": {
            if (!s.arrows.length) return reject(s, ran, "There are no arrows to clear.");
            return accept({ ...s, arrows: [] }, ex(ran, "All annotation arrows.", `${s.arrows.length} arrow(s) removed. Tree pointers are not arrows you drew, so they stay.`, "Nodes, pointers, markers and highlights."), { kind: "dismiss", prev: s });
        }
    }
}

/** Cuts a node (with everything below it) loose from its parent. It stays in the lab as a detached subtree. */
function detachPrimitive(s: TreeState, ran: string, id: string, why = ""): Outcome {
    const n = s.nodes[id];
    if (n.parent === null)
        return reject(s, ran, s.root === id ? `${id} is the root of the active tree: it has no parent to be cut from. Use deleteSubtree(${id}) or clear() to remove the tree.` : `${id} is already the root of a detached subtree.`);
    const p = n.parent;
    const d = draft(s);
    patch(d, p, { [sideOf(d, p, id)]: null });
    patch(d, id, { parent: null });
    d.detached = [...d.detached, id];
    const next = finish(s, d);
    const steps = buildSteps(s, next, { mode: "generic" });
    const ids = subtreeIds(s, id);
    return accept(
        next,
        ex(
            ran,
            `${why ? why + " " : ""}Subtree ${id} (${ids.length} node${ids.length === 1 ? "" : "s"}: ${ids.join(", ")}) is cut loose from its parent ${p}.`,
            `Pointer changes: ${stepsText(steps)} The subtree is now DISCONNECTED: it is no longer part of the active tree, but its nodes still exist (shown in the detached area) and can be re-attached with setLeft / setRight or removed with deleteSubtree(${id}).`,
            `Node count is still ${lengthOf(s)}; only the link between ${p} and ${id} changed. Marks and highlights stay on their nodes.`,
        ),
        { kind: "rewire", what: "detach", ids, steps, prev: s },
        steps,
        { label: "Detached", value: { id, parent: p, nodes: ids, status: "disconnected, not deleted" } },
    );
}

/** True when the value can never live in a BST. */
function compareKeyless(v: Primitive): boolean {
    return compare(v, v) === null;
}

export { describe };
export type { TreeType };
