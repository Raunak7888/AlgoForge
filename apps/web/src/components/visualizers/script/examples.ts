export interface Example {
    id: string;
    title: string;
    description: string;
    script: string;
}

const j = (v: unknown) => JSON.stringify(v, null, 2);

export const EXAMPLES: readonly Example[] = [
    {
        id: "parallel",
        title: "Two structures at once",
        description: "Entries that share a step number animate together on one clock.",
        script: j([
            { step: 1, id: "A", ds: "array", op: "initialize", values: [5, 3, 8, 1] },
            { step: 1, message: "A starts unsorted." },
            { step: 2, id: "A", op: "swap", indexA: 0, indexB: 3 },
            { step: 2, id: "S", ds: "stack", op: "push", value: 7 },
            { step: 2, message: "Swap A[0] and A[3] while pushing 7 onto S. Same step, so at once." },
            { step: 3, id: "A", op: "highlight", index: 1, color: "#FF430F" },
            { step: 3, message: "A[1] is highlighted." },
            { step: 4, id: "S", op: "pop" },
            { step: 4, message: "Pop returns the last value pushed." },
        ]),
    },
    {
        id: "append-many",
        title: "Append many values",
        description: "A list in `value` becomes one operation per value, in order.",
        script: j([
            { step: 1, dsname: "array", operationname: "append", value: [4, 8, 15, 16, 23, 42] },
            { step: 1, message: "Six appends inside a single step." },
            { step: 2, dsname: "array", operationname: "pop" },
            { step: 2, message: "Pop removes the last element." },
        ]),
    },
    {
        id: "bst",
        title: "Binary search tree",
        description: "Insert values and watch the tree choose left or right.",
        script: j([
            { step: 1, id: "T", ds: "bst", op: "insert", value: 8 },
            { step: 1, message: "The first value becomes the root." },
            { step: 2, id: "T", op: "insert", value: 3 },
            { step: 3, id: "T", op: "insert", value: 10 },
            { step: 4, id: "T", op: "insert", value: 6 },
            { step: 4, message: "6 is less than 8 and greater than 3, so it becomes 3's right child." },
        ]),
    },
    {
        id: "hash",
        title: "Hash map",
        description: "Keys are hashed to buckets.",
        script: j([
            { step: 1, id: "H", ds: "map", op: "set", key: "apple", value: 3 },
            { step: 2, id: "H", op: "set", key: "pear", value: 5 },
            { step: 3, id: "H", op: "set", key: "plum", value: 7 },
            { step: 4, id: "H", op: "get", key: "pear" },
            { step: 4, message: "Reading a key hashes it and checks one bucket." },
        ]),
    },
    {
        id: "list",
        title: "Linked list",
        description: "Append, then reverse the pointers.",
        script: j([
            { step: 1, id: "L", ds: "linkedlist", op: "append", value: [1, 2, 3] },
            { step: 2, id: "L", op: "reverse" },
            { step: 2, message: "Every next pointer now points the other way." },
        ]),
    },
    {
        id: "graph",
        title: "Graph",
        description: "Vertices are named v1, v2, ... in the order they are added.",
        script: j([
            { step: 1, id: "G", ds: "graph", op: "addVertex", value: "A" },
            { step: 1, id: "G", op: "addVertex", value: "B" },
            { step: 1, id: "G", op: "addVertex", value: "C" },
            { step: 2, id: "G", op: "addEdge", sourceId: "v1", targetId: "v2" },
            { step: 3, id: "G", op: "addEdge", sourceId: "v2", targetId: "v3" },
            { step: 3, message: "A path A - B - C." },
        ]),
    },
];
