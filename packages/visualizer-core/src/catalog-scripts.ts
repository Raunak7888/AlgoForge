type Entry = Readonly<Record<string, unknown>>;
const json = (entries: readonly Entry[]): string => JSON.stringify(entries, null, 2);

const ORANGE = "#FF430F";
const GREEN = "#17A34A";

const bubbleSort = json([
  { step: 1, id: "A", ds: "array", op: "initialize", values: [5, 3, 8, 1] },
  { step: 1, message: "Bubble sort compares neighbours and swaps them when they are in the wrong order." },
  { step: 2, id: "A", op: "swap", indexA: 0, indexB: 1 },
  { step: 2, message: "5 > 3, so swap them." },
  { step: 3, id: "A", op: "swap", indexA: 2, indexB: 3 },
  { step: 3, message: "8 > 1, so swap them." },
  { step: 4, id: "A", op: "swap", indexA: 1, indexB: 2 },
  { step: 4, message: "5 > 1, so swap them." },
  { step: 5, id: "A", op: "swap", indexA: 0, indexB: 1 },
  { step: 5, message: "3 > 1, so swap them. The array is sorted." },
]);

const mergeSort = json([
  { step: 1, id: "A", ds: "array", op: "initialize", values: [5, 2, 4, 1] },
  { step: 1, message: "Merge sort splits the array, sorts the halves and merges them." },
  { step: 2, id: "A", op: "swap", indexA: 0, indexB: 1 },
  { step: 2, message: "Merge [5] and [2]: 2 comes first." },
  { step: 3, id: "A", op: "swap", indexA: 2, indexB: 3 },
  { step: 3, message: "Merge [4] and [1]: 1 comes first." },
  { step: 4, id: "B", ds: "array", op: "append", value: 1 },
  { step: 4, message: "Merge [2, 5] and [1, 4] into B. Compare 2 and 1: take 1." },
  { step: 5, id: "B", op: "append", value: 2 },
  { step: 5, message: "Compare 2 and 4: take 2." },
  { step: 6, id: "B", op: "append", value: 4 },
  { step: 6, message: "Compare 5 and 4: take 4." },
  { step: 7, id: "B", op: "append", value: 5 },
  { step: 7, message: "Only 5 is left. B is sorted." },
]);

const linearSearch = json([
  { step: 1, id: "A", ds: "array", op: "initialize", values: [4, 8, 15, 16] },
  { step: 1, message: "Find 15. Check each element in turn." },
  { step: 2, id: "A", op: "highlight", index: 0, color: ORANGE },
  { step: 2, message: "4 is not 15." },
  { step: 3, id: "A", op: "highlight", index: 1, color: ORANGE },
  { step: 3, message: "8 is not 15." },
  { step: 4, id: "A", op: "highlight", index: 2, color: GREEN },
  { step: 4, message: "15 found at index 2." },
]);

const binarySearch = json([
  { step: 1, id: "A", ds: "array", op: "initialize", values: [1, 3, 5, 7, 9, 11] },
  { step: 1, id: "A", op: "createMark", name: "lo", index: 0 },
  { step: 1, id: "A", op: "createMark", name: "hi", index: 5 },
  { step: 1, message: "Find 9. lo and hi mark the part of the array still in play." },
  { step: 2, id: "A", op: "highlight", index: 2, color: ORANGE },
  { step: 2, message: "mid = 2 holds 5. 5 < 9, so move lo to mid + 1." },
  { step: 3, id: "A", op: "moveMarkTo", index: 3, name: "lo" },
  { step: 3, id: "A", op: "clearHighlight" },
  { step: 3, message: "lo is now 3, so mid = 4." },
  { step: 4, id: "A", op: "highlight", index: 4, color: GREEN },
  { step: 4, message: "mid = 4 holds 9. Found." },
]);

const graphSetup: Entry[] = [
  { step: 1, id: "G", ds: "graph", op: "addVertex", value: ["A", "B", "C", "D", "E"] },
  { step: 1, message: "A graph with five vertices: A, B, C, D, E." },
  { step: 2, id: "G", op: "addEdge", sourceId: "v1", targetId: "v2" },
  { step: 2, id: "G", op: "addEdge", sourceId: "v1", targetId: "v3" },
  { step: 2, id: "G", op: "addEdge", sourceId: "v2", targetId: "v4" },
  { step: 2, id: "G", op: "addEdge", sourceId: "v3", targetId: "v5" },
  { step: 2, message: "A is joined to B and C. B is joined to D. C is joined to E." },
];

const bfs = json([
  ...graphSetup,
  { step: 3, id: "Q", ds: "queue", op: "enqueue", value: "A" },
  { step: 3, id: "G", op: "highlight", color: ORANGE, vertexId: "v1" },
  { step: 3, message: "Start at A. Put it in the queue." },
  { step: 4, id: "Q", op: "dequeue" },
  { step: 4, id: "G", op: "highlight", color: GREEN, vertexId: "v1" },
  { step: 4, id: "Q", op: "enqueue", value: ["B", "C"] },
  { step: 4, message: "Visit A. Queue its neighbours B and C." },
  { step: 5, id: "Q", op: "dequeue" },
  { step: 5, id: "G", op: "highlight", color: GREEN, vertexId: "v2" },
  { step: 5, id: "Q", op: "enqueue", value: "D" },
  { step: 5, message: "Visit B. Queue D." },
  { step: 6, id: "Q", op: "dequeue" },
  { step: 6, id: "G", op: "highlight", color: GREEN, vertexId: "v3" },
  { step: 6, id: "Q", op: "enqueue", value: "E" },
  { step: 6, message: "Visit C. Queue E." },
  { step: 7, id: "Q", op: "dequeue" },
  { step: 7, id: "G", op: "highlight", color: GREEN, vertexId: "v4" },
  { step: 7, message: "Visit D." },
  { step: 8, id: "Q", op: "dequeue" },
  { step: 8, id: "G", op: "highlight", color: GREEN, vertexId: "v5" },
  { step: 8, message: "Visit E. The queue is empty, so the search is done." },
]);

const dfs = json([
  ...graphSetup,
  { step: 3, id: "S", ds: "stack", op: "push", value: "A" },
  { step: 3, id: "G", op: "highlight", color: ORANGE, vertexId: "v1" },
  { step: 3, message: "Start at A. Push it on the stack." },
  { step: 4, id: "S", op: "pop" },
  { step: 4, id: "G", op: "highlight", color: GREEN, vertexId: "v1" },
  { step: 4, id: "S", op: "push", value: ["C", "B"] },
  { step: 4, message: "Visit A. Push C, then B, so B is on top." },
  { step: 5, id: "S", op: "pop" },
  { step: 5, id: "G", op: "highlight", color: GREEN, vertexId: "v2" },
  { step: 5, id: "S", op: "push", value: "D" },
  { step: 5, message: "Visit B. Push D. Go deep first." },
  { step: 6, id: "S", op: "pop" },
  { step: 6, id: "G", op: "highlight", color: GREEN, vertexId: "v4" },
  { step: 6, message: "Visit D. It has no new neighbours, so back up." },
  { step: 7, id: "S", op: "pop" },
  { step: 7, id: "G", op: "highlight", color: GREEN, vertexId: "v3" },
  { step: 7, id: "S", op: "push", value: "E" },
  { step: 7, message: "Visit C. Push E." },
  { step: 8, id: "S", op: "pop" },
  { step: 8, id: "G", op: "highlight", color: GREEN, vertexId: "v5" },
  { step: 8, message: "Visit E. The stack is empty, so the search is done." },
]);

/** Visualizer scripts of the seeded catalog, keyed by algorithm slug. */
export const CATALOG_SCRIPTS: Readonly<Record<string, string>> = {
  "bubble-sort": bubbleSort,
  "merge-sort": mergeSort,
  "linear-search": linearSearch,
  "binary-search": binarySearch,
  "breadth-first-search": bfs,
  "depth-first-search": dfs,
};

export const CATALOG_SLUGS: readonly string[] = Object.keys(CATALOG_SCRIPTS);
