/* Development seed: 3 categories and 6 published algorithms. Idempotent (upserts).
   Refuses to run in production. */
import { prisma, Difficulty } from "../src/index";

if (process.env.NODE_ENV === "production") {
  console.error("Refusing to seed: NODE_ENV=production.");
  process.exit(1);
}

const categories = [
  { id: "sorting", label: "Sorting", description: "Put items in order.", iconName: "sort", sortOrder: 1 },
  { id: "searching", label: "Searching", description: "Find items in a collection.", iconName: "search", sortOrder: 2 },
  { id: "graph-traversal", label: "Graph traversal", description: "Visit the vertices of a graph.", iconName: "graph", sortOrder: 3 },
];

const bubbleJs = `function bubbleSort(arr) {
  const a = [...arr];
  for (let i = 0; i < a.length - 1; i++) {
    let swapped = false;
    for (let j = 0; j < a.length - 1 - i; j++) {
      if (a[j] > a[j + 1]) {
        [a[j], a[j + 1]] = [a[j + 1], a[j]];
        swapped = true;
      }
    }
    if (!swapped) break;
  }
  return a;
}`;
const bubblePy = `def bubble_sort(arr):
    a = list(arr)
    for i in range(len(a) - 1):
        swapped = False
        for j in range(len(a) - 1 - i):
            if a[j] > a[j + 1]:
                a[j], a[j + 1] = a[j + 1], a[j]
                swapped = True
        if not swapped:
            break
    return a`;

const mergeJs = `function mergeSort(arr) {
  if (arr.length <= 1) return arr;
  const mid = Math.floor(arr.length / 2);
  const left = mergeSort(arr.slice(0, mid));
  const right = mergeSort(arr.slice(mid));
  const out = [];
  let i = 0, j = 0;
  while (i < left.length && j < right.length) {
    out.push(left[i] <= right[j] ? left[i++] : right[j++]);
  }
  return out.concat(left.slice(i), right.slice(j));
}`;
const mergePy = `def merge_sort(arr):
    if len(arr) <= 1:
        return list(arr)
    mid = len(arr) // 2
    left, right = merge_sort(arr[:mid]), merge_sort(arr[mid:])
    out, i, j = [], 0, 0
    while i < len(left) and j < len(right):
        if left[i] <= right[j]:
            out.append(left[i]); i += 1
        else:
            out.append(right[j]); j += 1
    return out + left[i:] + right[j:]`;

const linearJs = `function linearSearch(arr, target) {
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] === target) return i;
  }
  return -1;
}`;
const linearPy = `def linear_search(arr, target):
    for i, value in enumerate(arr):
        if value == target:
            return i
    return -1`;

const binaryJs = `function binarySearch(arr, target) {
  let lo = 0, hi = arr.length - 1;
  while (lo <= hi) {
    const mid = lo + Math.floor((hi - lo) / 2);
    if (arr[mid] === target) return mid;
    if (arr[mid] < target) lo = mid + 1;
    else hi = mid - 1;
  }
  return -1;
}`;
const binaryPy = `def binary_search(arr, target):
    lo, hi = 0, len(arr) - 1
    while lo <= hi:
        mid = lo + (hi - lo) // 2
        if arr[mid] == target:
            return mid
        if arr[mid] < target:
            lo = mid + 1
        else:
            hi = mid - 1
    return -1`;

const bfsJs = `function bfs(graph, start) {
  const seen = new Set([start]);
  const queue = [start];
  const order = [];
  while (queue.length) {
    const node = queue.shift();
    order.push(node);
    for (const next of graph[node] ?? []) {
      if (!seen.has(next)) { seen.add(next); queue.push(next); }
    }
  }
  return order;
}`;
const bfsPy = `from collections import deque

def bfs(graph, start):
    seen, queue, order = {start}, deque([start]), []
    while queue:
        node = queue.popleft()
        order.append(node)
        for nxt in graph.get(node, []):
            if nxt not in seen:
                seen.add(nxt)
                queue.append(nxt)
    return order`;

const dfsJs = `function dfs(graph, start, seen = new Set()) {
  seen.add(start);
  const order = [start];
  for (const next of graph[start] ?? []) {
    if (!seen.has(next)) order.push(...dfs(graph, next, seen));
  }
  return order;
}`;
const dfsPy = `def dfs(graph, start, seen=None):
    seen = seen if seen is not None else set()
    seen.add(start)
    order = [start]
    for nxt in graph.get(start, []):
        if nxt not in seen:
            order.extend(dfs(graph, nxt, seen))
    return order`;

const algorithms = [
  { slug: "bubble-sort", name: "Bubble Sort", categoryId: "sorting", difficulty: Difficulty.beginner,
    description: "Repeatedly swaps adjacent elements that are out of order until the array is sorted.",
    timeBest: "O(n)", timeAverage: "O(n^2)", timeWorst: "O(n^2)", spaceComplexity: "O(1)",
    tags: ["sorting", "comparison", "in-place"], js: bubbleJs, py: bubblePy },
  { slug: "merge-sort", name: "Merge Sort", categoryId: "sorting", difficulty: Difficulty.intermediate,
    description: "Splits the array in halves, sorts each half recursively and merges them.",
    timeBest: "O(n log n)", timeAverage: "O(n log n)", timeWorst: "O(n log n)", spaceComplexity: "O(n)",
    tags: ["sorting", "divide-and-conquer", "stable"], js: mergeJs, py: mergePy },
  { slug: "linear-search", name: "Linear Search", categoryId: "searching", difficulty: Difficulty.beginner,
    description: "Checks every element in order until the target is found.",
    timeBest: "O(1)", timeAverage: "O(n)", timeWorst: "O(n)", spaceComplexity: "O(1)",
    tags: ["searching", "sequential"], js: linearJs, py: linearPy },
  { slug: "binary-search", name: "Binary Search", categoryId: "searching", difficulty: Difficulty.beginner,
    description: "Halves a sorted array on every step to locate the target.",
    timeBest: "O(1)", timeAverage: "O(log n)", timeWorst: "O(log n)", spaceComplexity: "O(1)",
    tags: ["searching", "divide-and-conquer", "sorted-input"], js: binaryJs, py: binaryPy },
  { slug: "breadth-first-search", name: "Breadth-First Search", categoryId: "graph-traversal", difficulty: Difficulty.intermediate,
    description: "Visits a graph level by level using a queue.",
    timeBest: "O(V + E)", timeAverage: "O(V + E)", timeWorst: "O(V + E)", spaceComplexity: "O(V)",
    tags: ["graph", "traversal", "queue"], js: bfsJs, py: bfsPy },
  { slug: "depth-first-search", name: "Depth-First Search", categoryId: "graph-traversal", difficulty: Difficulty.intermediate,
    description: "Explores as far as possible along each branch before backtracking.",
    timeBest: "O(V + E)", timeAverage: "O(V + E)", timeWorst: "O(V + E)", spaceComplexity: "O(V)",
    tags: ["graph", "traversal", "recursion"], js: dfsJs, py: dfsPy },
];

async function main() {
  for (const c of categories) {
    await prisma.category.upsert({ where: { id: c.id }, create: c, update: { label: c.label, description: c.description, iconName: c.iconName, sortOrder: c.sortOrder } });
  }
  for (const a of algorithms) {
    const fields = {
      name: a.name, description: a.description, categoryId: a.categoryId, difficulty: a.difficulty,
      isPublished: true, timeBest: a.timeBest, timeAverage: a.timeAverage, timeWorst: a.timeWorst,
      spaceComplexity: a.spaceComplexity,
    };
    await prisma.algorithm.upsert({
      where: { slug: a.slug },
      update: fields,
      create: {
        slug: a.slug,
        ...fields,
        displayCodes: { create: [{ language: "javascript", code: a.js }, { language: "python", code: a.py }] },
        tags: { create: a.tags.map((label) => ({ tag: { connectOrCreate: { where: { label }, create: { label } } } })) },
      },
    });
  }
  console.log(`Seeded ${categories.length} categories and ${algorithms.length} algorithms.`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
