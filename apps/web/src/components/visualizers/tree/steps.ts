import { edgesOf, type Edge } from "./model";
import type { Step, TreeState } from "./types";

/**
 * Turns "what the child pointers were" and "what they are now" into the ordered, readable
 * steps a beginner would follow by hand. Built only from the real before / after states,
 * so the explanation can never disagree with the data.
 */
export type StepHint = { mode: "insert"; id: string } | { mode: "delete"; id: string } | { mode: "generic" };

interface Item {
    from: string;
    kind: "left" | "right";
    old?: Edge;
    next?: Edge;
}
const nm = (id: string | null | undefined) => id ?? "NULL";

const textOf = (it: Item): string => {
    const f = `${it.from}.${it.kind}`;
    if (it.old && it.next) return `${f}: ${it.old.to} → ${it.next.to}`;
    if (it.next) return `${f} → ${it.next.to}`;
    return `${f}: ${it.old!.to} → NULL`;
};

function priority(it: Item, hint: StepHint): number {
    const own = hint.mode !== "generic" && it.from === hint.id;
    if (hint.mode === "insert") return own ? 0 : 1;
    if (hint.mode === "delete") return own ? 3 : it.next ? 0 : 1; // re-link around the node first, drop its own links last
    return it.next ? 0 : 1;
}

export function buildSteps(before: TreeState, after: TreeState, hint: StepHint): Step[] {
    const eb = edgesOf(before);
    const ea = edgesOf(after);
    const kb = new Set(eb.map((e) => e.key));
    const ka = new Set(ea.map((e) => e.key));
    const groups = new Map<string, Item>();
    const touch = (e: Edge): Item => {
        const k = `${e.from}.${e.kind}`;
        const it = groups.get(k) ?? { from: e.from, kind: e.kind };
        groups.set(k, it);
        return it;
    };
    for (const e of eb) if (!ka.has(e.key)) touch(e).old = e;
    for (const e of ea) if (!kb.has(e.key)) touch(e).next = e;
    // a node that vanished took its own links with it: those are one step, not many
    const gone = new Set(Object.keys(before.nodes).filter((id) => !after.nodes[id]));
    const items = [...groups.values()].sort((a, b) => priority(a, hint) - priority(b, hint));

    const steps: Step[] = [];
    const goneItems = items.filter((i) => gone.has(i.from));
    const keepItems = items.filter((i) => !gone.has(i.from));
    const buckets = new Map<number, Item[]>();
    for (const it of keepItems) buckets.set(priority(it, hint), [...(buckets.get(priority(it, hint)) ?? []), it]);
    for (const [, list] of [...buckets.entries()].sort((a, b) => a[0] - b[0])) {
        if (list.length <= 3) for (const it of list) steps.push({ text: textOf(it), removes: it.old ? [it.old.key] : [], adds: it.next ? [it.next.key] : [] });
        else
            steps.push({
                text: `${list.length} child pointers rewired`,
                removes: list.flatMap((i) => (i.old ? [i.old.key] : [])),
                adds: list.flatMap((i) => (i.next ? [i.next.key] : [])),
            });
    }
    if (goneItems.length) {
        const ids = [...new Set(goneItems.map((i) => i.from))];
        steps.push({
            text: ids.length === 1 ? `${ids[0]}'s links are dropped` : `${ids.length} removed nodes' links are dropped`,
            removes: goneItems.flatMap((i) => (i.old ? [i.old.key] : [])),
            adds: [],
        });
    }
    if (before.root !== after.root) steps.push({ text: `ROOT: ${nm(before.root)} → ${nm(after.root)}`, removes: [], adds: [], root: true });
    return steps;
}
