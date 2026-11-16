/** Visualizer scripts for the catalog algorithms, keyed by slug. Pure data, no imports. */
const json = (v: unknown) => JSON.stringify(v, null, 2);

export const CATALOG_SCRIPTS: Record<string, string> = {
  "bubble-sort": json([
    { step: 1, id: "A", ds: "array", op: "initialize", values: [5, 3, 8, 1] },
    { step: 2, id: "A", op: "swap", indexA: 0, indexB: 1 },
    { step: 2, message: "5 > 3, so the two are swapped." },
    { step: 3, id: "A", op: "swap", indexA: 2, indexB: 3 },
    { step: 3, message: "8 > 1, so they are swapped." },
  ]),

  "linear-search": json([
    { step: 1, id: "A", ds: "array", op: "initialize", values: [4, 8, 15, 16] },
    { step: 2, id: "A", op: "highlight", index: 0, color: "#FF430F" },
    { step: 2, message: "Check index 0: 4 is not 15." },
    { step: 3, id: "A", op: "highlight", index: 2, color: "#17A34A" },
    { step: 3, message: "Index 2 holds 15: found." },
  ]),

  "binary-search": json([
    { step: 1, id: "A", ds: "array", op: "initialize", values: [1, 3, 5, 7, 9, 11] },
    { step: 2, id: "A", op: "highlight", index: 2, color: "#FF430F" },
    { step: 2, message: "mid = 2 holds 5, smaller than 9: search the right half." },
    { step: 3, id: "A", op: "highlight", index: 4, color: "#17A34A" },
    { step: 3, message: "mid = 4 holds 9: found." },
  ]),

  "merge-sort": json([
    { step: 1, id: "A", ds: "array", op: "initialize", values: [5, 2, 4, 1] },
    { step: 2, id: "A", op: "swap", indexA: 0, indexB: 1 },
    { step: 2, message: "Merge [5] and [2] into [2, 5]." },
    { step: 3, id: "A", op: "swap", indexA: 2, indexB: 3 },
    { step: 3, message: "Merge [4] and [1] into [1, 4]." },
    { step: 4, id: "A", op: "update", index: 0, value: 1 },
    { step: 4, id: "A", op: "update", index: 1, value: 2 },
    { step: 4, id: "A", op: "update", index: 2, value: 4 },
    { step: 4, id: "A", op: "update", index: 3, value: 5 },
    { step: 4, message: "Merge [2, 5] and [1, 4] into [1, 2, 4, 5]." },
  ]),

  "breadth-first-search": json([
    { step: 1, id: "G", ds: "graph", op: "initialize", data: { vertices: ["A", "B", "C", "D"], edges: [[0, 1], [0, 2], [1, 3]] } },
    { step: 1, id: "Q", ds: "queue", op: "enqueue", value: "A" },
    { step: 1, message: "Start at A: put it in the queue." },
    { step: 2, id: "Q", op: "dequeue" },
    { step: 2, id: "G", op: "highlight", color: "#17A34A", vertexId: "v1" },
    { step: 2, message: "Visit A, then queue its neighbours B and C." },
    { step: 3, id: "Q", op: "enqueue", value: "B" },
    { step: 4, id: "Q", op: "enqueue", value: "C" },
  ]),

  "depth-first-search": json([
    { step: 1, id: "G", ds: "graph", op: "initialize", data: { vertices: ["A", "B", "C", "D"], edges: [[0, 1], [0, 2], [1, 3]] } },
    { step: 1, id: "S", ds: "stack", op: "push", value: "A" },
    { step: 1, message: "Start at A: push it on the stack." },
    { step: 2, id: "G", op: "highlight", color: "#17A34A", vertexId: "v1" },
    { step: 2, id: "S", op: "push", value: "B" },
    { step: 2, message: "Visit A, then go deeper to B." },
    { step: 3, id: "G", op: "highlight", color: "#17A34A", vertexId: "v2" },
    { step: 3, id: "S", op: "push", value: "D" },
    { step: 3, message: "From B go deeper to D." },
  ]),
};