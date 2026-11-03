/**
 * Id allocation shared by the node-based labs (linked list, tree, and later graph).
 * A new node always takes the LOWEST free number: delete n6 and the next new node is n6 again,
 * not n7. Ids of nodes that still exist are never reused, so an id always names one live node.
 */
export function lowestFreeId(used: Iterable<string>, prefix = "n"): string {
    const taken = new Set(used);
    for (let i = 1; ; i++) if (!taken.has(`${prefix}${i}`)) return `${prefix}${i}`;
}

/** `count` ids for a structure that is being rebuilt from scratch: n1, n2, … */
export const freshIds = (count: number, prefix = "n"): string[] => Array.from({ length: count }, (_, i) => `${prefix}${i + 1}`);
