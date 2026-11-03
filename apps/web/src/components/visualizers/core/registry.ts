import { arrayAdapter, createArray } from "./adapters/array";
import { createGraph, graphAdapter } from "./adapters/graph";
import { createHash, hashAdapter } from "./adapters/hash";
import { createLinear, linearAdapter } from "./adapters/linear";
import { createLinkedList, linkedListAdapter } from "./adapters/linkedlist";
import { createTree, treeAdapter } from "./adapters/tree";
import type { AnyAdapter, DsType, OpMeta } from "./types";

const types: DsType[] = [
    { name: "array", label: "Array", aliases: ["arr"], adapter: arrayAdapter, create: createArray },
    { name: "stack", label: "Stack", aliases: [], adapter: linearAdapter, hiddenOps: ["enqueue", "dequeue"], create: () => createLinear("stack") },
    { name: "queue", label: "Queue", aliases: [], adapter: linearAdapter, hiddenOps: ["push", "pop"], create: () => createLinear("queue") },
    { name: "linkedlist", label: "Linked list (singly)", aliases: ["list", "ll", "sll", "singlylinkedlist"], adapter: linkedListAdapter, create: () => createLinkedList("sll") },
    { name: "doublylinkedlist", label: "Linked list (doubly)", aliases: ["dll"], adapter: linkedListAdapter, create: () => createLinkedList("dll") },
    { name: "circularlinkedlist", label: "Linked list (circular)", aliases: ["cll"], adapter: linkedListAdapter, create: () => createLinkedList("cll") },
    { name: "tree", label: "Binary tree", aliases: ["binarytree"], adapter: treeAdapter, create: () => createTree("binary") },
    { name: "bst", label: "Binary search tree", aliases: ["binarysearchtree"], adapter: treeAdapter, create: () => createTree("bst") },
    { name: "map", label: "Hash map", aliases: ["hashmap", "hash", "hashtable", "dict", "dictionary"], adapter: hashAdapter, create: () => createHash("map") },
    { name: "set", label: "Hash set", aliases: ["hashset"], adapter: hashAdapter, create: () => createHash("set") },
    { name: "graph", label: "Graph", aliases: [], adapter: graphAdapter, create: createGraph },
];

export const DS_TYPES: readonly DsType[] = types;

const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const byName = new Map<string, DsType>();
for (const t of types) {
    byName.set(squash(t.name), t);
    for (const a of t.aliases) byName.set(squash(a), t);
}

/** "Array", "hash-map", "hashmap" all resolve. Returns undefined for unknown names. */
export const findDsType = (name: string): DsType | undefined => byName.get(squash(name));

/** Every spelling a script may use for `ds` (canonical names first). */
export const DS_NAMES: readonly string[] = [...types.map((t) => t.name), ...types.flatMap((t) => t.aliases)];

/** Each distinct adapter once. */
export const ADAPTERS: readonly AnyAdapter[] = Array.from(new Set(types.map((t) => t.adapter)));

/** The operations a script may use on this structure. */
export function opsOf(type: DsType): Readonly<Record<string, OpMeta>> {
    const hidden = type.hiddenOps;
    if (!hidden || hidden.length === 0) return type.adapter.ops;
    return Object.fromEntries(Object.entries(type.adapter.ops).filter(([name]) => !hidden.includes(name)));
}
