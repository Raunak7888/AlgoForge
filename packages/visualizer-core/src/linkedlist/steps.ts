import { edgesOf, type Edge } from "./model";
import type { ListState, Step } from "./types";

/**
 * Turns "what the pointers were" and "what they are now" into the ordered, readable
 * steps a beginner would follow by hand. Built only from the real before / after states,
 * so the explanation can never disagree with the data.
 */
export type StepHint = { mode: "insert"; id: string } | { mode: "delete"; id: string } | { mode: "generic" };

interface Item {
    from: string;
    kind: "next" | "prev";
    old?: Edge;
    next?: Edge;
}

const nm = (id: string | undefined) => id ?? "NULL";

function textOf(it: Item): string {
    const f = `${it.from}.${it.kind}`;
    if (it.old && it.next) return `${f}: ${nm(it.old.to)} → ${nm(it.next.to)}`;
    if (it.next) return `${f} → ${nm(it.next.to)}`;
    return `${f} pointer removed (was ${nm(it.old?.to)})`;
}

function priority(it: Item, hint: StepHint): number {
    const own = hint.mode !== "generic" && it.from === hint.id;
    const nextish = it.kind === "next" ? 0 : 1;
    if (hint.mode === "insert") return own ? nextish : 2 + nextish; // the new node first, then its neighbours
    if (hint.mode === "delete") return own ? 4 : nextish; // bypass first, drop the node's own links last
    return nextish;
}

export function buildSteps(before: ListState, after: ListState, hint: StepHint): Step[] {
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

    const items = [...groups.values()].sort((a, b) => priority(a, hint) - priority(b, hint));
    const steps: Step[] = [];
    // A long run of identical work (reverse, type change) becomes one step per bucket instead of dozens.
    const buckets = new Map<number, Item[]>();
    for (const it of items) buckets.set(priority(it, hint), [...(buckets.get(priority(it, hint)) ?? []), it]);
    for (const [, list] of [...buckets.entries()].sort((a, b) => a[0] - b[0])) {
        if (list.length <= 3) {
            for (const it of list)
                steps.push({ text: textOf(it), removes: it.old ? [it.old.key] : [], adds: it.next ? [it.next.key] : [] });
        } else {
            const kind = list[0].kind;
            const removed = list.filter((i) => i.old).length;
            const added = list.filter((i) => i.next).length;
            steps.push({
                text:
                    removed && added
                        ? `${list.length} ${kind} pointers rewired`
                        : added
                          ? `${added} ${kind} pointers added`
                          : `${removed} ${kind} pointers removed`,
                removes: list.flatMap((i) => (i.old ? [i.old.key] : [])),
                adds: list.flatMap((i) => (i.next ? [i.next.key] : [])),
            });
        }
    }
    if (before.head !== after.head) steps.push({ text: `HEAD: ${nm(before.head ?? undefined)} → ${nm(after.head ?? undefined)}`, removes: [], adds: [], ptr: "head" });
    if (before.tail !== after.tail) steps.push({ text: `TAIL: ${nm(before.tail ?? undefined)} → ${nm(after.tail ?? undefined)}`, removes: [], adds: [], ptr: "tail" });
    return steps;
}
