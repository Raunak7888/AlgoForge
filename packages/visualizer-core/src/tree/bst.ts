import type { Primitive, TNode, TreeState } from "./types";

/**
 * BST rules (the documented policy):
 *
 *  ORDER      left subtree < node < right subtree, strictly.
 *  COMPARE    A BST holds ONE kind of key, either all numbers or all strings.
 *             Numbers compare numerically. Strings compare by UTF-16 code units
 *             (JavaScript's `<`), so "B" < "a" and "10" < "9".
 *             Numbers and strings are never compared with each other, and booleans
 *             and null cannot be ordered, so they are rejected.
 *  DUPLICATES A value that is already in the tree is REJECTED. insert, initialize and
 *             update all follow this, so a BST never holds two equal values.
 */
export const BST_RULE =
    "left < node < right. A BST holds all numbers or all strings (strings compare by UTF-16 code units, so \"B\" < \"a\"). Booleans and null cannot be ordered. Duplicate values are rejected.";

export type KeyType = "number" | "string";
export const keyTypeOf = (v: Primitive): KeyType | null =>
    typeof v === "number" && Number.isFinite(v) ? "number" : typeof v === "string" ? "string" : null;

/** -1 / 0 / 1, or null when the two values cannot be ordered. */
export function compare(a: Primitive, b: Primitive): -1 | 0 | 1 | null {
    const ta = keyTypeOf(a);
    const tb = keyTypeOf(b);
    if (!ta || ta !== tb) return null;
    return a === b ? 0 : (a as number | string) < (b as number | string) ? -1 : 1;
}

export const whyNotKey = (v: Primitive): string =>
    v === null
        ? "null cannot be ordered, so a BST cannot hold it"
        : typeof v === "boolean"
          ? "booleans cannot be ordered, so a BST cannot hold them"
          : "that value cannot be ordered";

const show = (v: Primitive) => JSON.stringify(v);

/** Every way the BST rule is broken, as readable text. Empty array = valid. */
export function bstViolations(s: Pick<TreeState, "nodes" | "root" | "detached">): string[] {
    const bad: string[] = [];
    const ids = Object.keys(s.nodes);
    const types = new Set(ids.map((id) => keyTypeOf(s.nodes[id].value) ?? "other"));
    if (types.has("other")) {
        const id = ids.find((x) => keyTypeOf(s.nodes[x].value) === null)!;
        bad.push(`${id} holds ${show(s.nodes[id].value)}: ${whyNotKey(s.nodes[id].value)}`);
    } else if (types.size > 1) bad.push("the tree mixes numbers and strings, which cannot be compared");
    if (bad.length) return bad;

    const walk = (id: string | null, lo: TNode | null, hi: TNode | null, seen: Set<string>) => {
        if (id === null || seen.has(id)) return;
        seen.add(id);
        const n = s.nodes[id];
        if (!n) return;
        if (lo && compare(n.value, lo.value)! <= 0) bad.push(`${id} (${show(n.value)}) is in the right subtree of ${lo.id} (${show(lo.value)}) but is not greater than it`);
        if (hi && compare(n.value, hi.value)! >= 0) bad.push(`${id} (${show(n.value)}) is in the left subtree of ${hi.id} (${show(hi.value)}) but is not smaller than it`);
        walk(n.left, lo, n, seen);
        walk(n.right, n, hi, seen);
    };
    for (const r of [s.root, ...s.detached]) walk(r, null, null, new Set());
    return bad;
}

export type Placement = { parent: string; side: "left" | "right"; path: { id: string; cmp: -1 | 1 }[] } | { duplicate: string } | { error: string };

/** Where a new value goes in the tree that starts at `rootId`. Follows the ordering rule only. */
export function placeBst(nodes: Record<string, TNode>, rootId: string, value: Primitive): Placement {
    const path: { id: string; cmp: -1 | 1 }[] = [];
    let cur: string | null = rootId;
    for (let guard = 0; cur !== null && guard <= Object.keys(nodes).length; guard++) {
        const n: TNode = nodes[cur];
        const c = compare(value, n.value);
        if (c === null) return { error: `${show(value)} cannot be compared with ${show(n.value)} in ${n.id}: a BST holds all numbers or all strings` };
        if (c === 0) return { duplicate: n.id };
        path.push({ id: n.id, cmp: c });
        const next: string | null = c < 0 ? n.left : n.right;
        if (next === null) return { parent: n.id, side: c < 0 ? "left" : "right", path };
        cur = next;
    }
    return { error: "the tree is malformed" };
}

export function leftmost(nodes: Record<string, TNode>, id: string): string {
    let cur = id;
    for (let guard = 0; nodes[cur].left !== null && guard <= Object.keys(nodes).length; guard++) cur = nodes[cur].left!;
    return cur;
}
