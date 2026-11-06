/* Development seed. Idempotent (upserts with fixed ids). Refuses to run in production.
   Creates: 3 categories, 6 published algorithms (3 with visualizer scripts), 2 demo users,
   2 analyses, 2 chat sessions with 6 messages, 2 visualizations (one a fork),
   3 shares, 2 AI usage rows and 2 audit-log rows. Demo emails use the reserved .invalid TLD.
   Sessions/accounts are intentionally not seeded (they hold auth tokens). */
import { createHash } from "node:crypto";
import { prisma, Difficulty, Role, Prisma } from "../src/index";
import { CATALOG_SCRIPTS } from "@algoforge/visualizer-core/src/catalog-scripts";

if (process.env.NODE_ENV === "production") {
  console.error("Refusing to seed: NODE_ENV=production.");
  process.exit(1);
}

const sha256 = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");
const messageRowId = (sessionId: string, seq: number) => createHash("md5").update(`${sessionId}:${seq}`).digest("hex");
const utcDay = (d = new Date()) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
const json = (v: unknown) => v as Prisma.InputJsonValue;

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

// Visualizer scripts in the frontend's JSON script format (see Phase 6 for the shared compiler).
const scripts: Record<string, string> = {
  "bubble-sort": JSON.stringify(
    [
      { step: 1, id: "A", ds: "array", op: "initialize", values: [5, 3, 8, 1] },
      { step: 2, id: "A", op: "swap", indexA: 0, indexB: 1 },
      { step: 2, message: "5 > 3, so the two are swapped." },
      { step: 3, id: "A", op: "swap", indexA: 2, indexB: 3 },
      { step: 3, message: "8 > 1, so they are swapped." },
    ],
    null,
    2,
  ),
  "linear-search": JSON.stringify(
    [
      { step: 1, id: "A", ds: "array", op: "initialize", values: [4, 8, 15, 16] },
      { step: 2, id: "A", op: "highlight", index: 0, color: "#FF430F" },
      { step: 2, message: "Check index 0: 4 is not 15." },
      { step: 3, id: "A", op: "highlight", index: 2, color: "#17A34A" },
      { step: 3, message: "Index 2 holds 15: found." },
    ],
    null,
    2,
  ),
  "binary-search": JSON.stringify(
    [
      { step: 1, id: "A", ds: "array", op: "initialize", values: [1, 3, 5, 7, 9, 11] },
      { step: 2, id: "A", op: "highlight", index: 2, color: "#FF430F" },
      { step: 2, message: "mid = 2 holds 5, which is smaller than 9: search the right half." },
      { step: 3, id: "A", op: "highlight", index: 4, color: "#17A34A" },
      { step: 3, message: "mid = 4 holds 9: found." },
    ],
    null,
    2,
  ),
};

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
  // ── users ──
  const admin = await prisma.user.upsert({
    where: { email: "dev-admin@example.invalid" },
    update: { role: Role.ADMIN, name: "Dev Admin" },
    create: { email: "dev-admin@example.invalid", username: "dev_admin", name: "Dev Admin", role: Role.ADMIN },
    select: { id: true },
  });
  const learner = await prisma.user.upsert({
    where: { email: "dev-learner@example.invalid" },
    update: { name: "Dev Learner" },
    create: { email: "dev-learner@example.invalid", username: "dev_learner", name: "Dev Learner", role: Role.USER },
    select: { id: true },
  });

  // ── catalog ──
  for (const c of categories) {
    await prisma.category.upsert({
      where: { id: c.id },
      create: { ...c, slug: c.id },
      update: { label: c.label, description: c.description, iconName: c.iconName, sortOrder: c.sortOrder },
    });
  }
  let order = 0;
  for (const a of algorithms) {
    order += 1;
    const script = CATALOG_SCRIPTS[a.slug] ?? scripts[a.slug] ?? null;
    const fields = {
      name: a.name, description: a.description, categoryId: a.categoryId, difficulty: a.difficulty,
      isPublished: true, timeBest: a.timeBest, timeAverage: a.timeAverage, timeWorst: a.timeWorst,
      spaceComplexity: a.spaceComplexity, sortOrder: order, script, scriptVersion: 1,
    };
    await prisma.algorithm.upsert({
      where: { slug: a.slug },
      update: fields,
      create: {
        slug: a.slug,
        ...fields,
        publishedAt: new Date(),
        createdById: admin.id,
        displayCodes: { create: [{ language: "javascript", code: a.js }, { language: "python", code: a.py }] },
        tags: { create: a.tags.map((label) => ({ tag: { connectOrCreate: { where: { label }, create: { label } } } })) },
      },
    });
  }
  const bubble = await prisma.algorithm.findUnique({ where: { slug: "bubble-sort" }, select: { id: true } });

  // ── analyses (one shared) ──
  const code1 = linearJs;
  const result = (summary: string) => ({
    schemaVersion: 1,
    data: {
      summary,
      complexity: { time: { best: "O(1)", average: "O(n)", worst: "O(n)" }, space: "O(1)" },
      breakdown: { approach: "Sequential scan.", steps: ["Visit each element", "Compare with the target", "Return the index or -1"] },
      bottlenecks: [],
      antiPatterns: [],
      improvements: [{ suggestion: "Sort the data and use binary search for repeated lookups.", expectedImpact: "O(log n) per lookup" }],
      optimizedCode: "function linearSearch(arr, target) { return arr.indexOf(target); }",
      edgeCases: [],
      readabilityScore: 90,
      tags: ["searching"],
    },
  });
  await prisma.analysis.upsert({
    where: { id: "seed_analysis_1" },
    update: {},
    create: {
      id: "seed_analysis_1", userId: learner.id, code: code1, language: "javascript", complexity: "O(n)",
      suggestion: "Sort the data and use binary search for repeated lookups.", result: json(result("Linear search over an array.")),
      title: "Linear search", model: "seed", promptVersion: "seed-1", schemaVersion: 1, codeHash: sha256(code1),
      latencyMs: 820, shareId: "seedshare001", isPublic: true,
    },
  });
  const code2 = bubbleJs;
  await prisma.analysis.upsert({
    where: { id: "seed_analysis_2" },
    update: {},
    create: {
      id: "seed_analysis_2", userId: learner.id, code: code2, language: "javascript", complexity: "O(n^2)",
      suggestion: "Use a built-in O(n log n) sort for large inputs.", result: json(result("Bubble sort with an early exit.")),
      title: "Bubble sort", model: "seed", promptVersion: "seed-1", schemaVersion: 1, codeHash: sha256(code2), latencyMs: 1010,
    },
  });
  await prisma.share.upsert({
    where: { shareId: "seedshare001" }, update: {},
    create: { shareId: "seedshare001", type: "analysis", targetId: "seed_analysis_1", ownerId: learner.id },
  });

  // ── chat sessions + messages (legacy JSON and the new table are kept in sync) ──
  const sessions = [
    {
      id: "seed_session_1", title: "How does bubble sort work?", shareId: "seedshare002" as string | null,
      contextType: "algorithm" as const, contextId: bubble?.id ?? null,
      messages: [
        { role: "user" as const, content: "How does bubble sort work?" },
        { role: "assistant" as const, content: "It repeatedly swaps neighbouring elements that are out of order.", intent: "explain_algorithm" },
        { role: "user" as const, content: "Why is it O(n^2)?" },
        { role: "assistant" as const, content: "Each of the n passes compares up to n elements.", intent: "explain_algorithm" },
      ],
    },
    {
      id: "seed_session_2", title: "Binary search edge cases", shareId: null,
      contextType: "none" as const, contextId: null,
      messages: [
        { role: "user" as const, content: "What breaks binary search?" },
        { role: "assistant" as const, content: "Unsorted input and overflow in (lo + hi) / 2.", intent: "general" },
      ],
    },
  ];
  for (const s of sessions) {
    const now = Date.now();
    const rows = s.messages.map((m, i) => ({ ...m, id: `seed_msg_${s.id}_${i + 1}`, createdAt: new Date(now - (s.messages.length - i) * 60_000) }));
    await prisma.explanationSession.upsert({
      where: { id: s.id }, update: {},
      create: {
        id: s.id, userId: learner.id, title: s.title, shareId: s.shareId, isPublic: s.shareId !== null,
        contextType: s.contextType, contextId: s.contextId,
        messages: json(rows.map((r) => ({ id: r.id, role: r.role, content: r.content, ...(r.intent ? { intent: r.intent } : {}), createdAt: r.createdAt.toISOString() }))),
      },
    });
    await prisma.explanationMessage.createMany({
      data: rows.map((r, i) => ({ id: messageRowId(s.id, i + 1), sessionId: s.id, seq: i + 1, role: r.role, content: r.content, intent: r.intent ?? null, createdAt: r.createdAt })),
      skipDuplicates: true,
    });
    if (s.shareId) {
      await prisma.share.upsert({
        where: { shareId: s.shareId }, update: {},
        create: { shareId: s.shareId, type: "explain", targetId: s.id, ownerId: learner.id },
      });
    }
  }

  // ── visualizations (one shared, one fork) ──
  const structures = [{ id: "A", ds: "array", label: "Array" }];
  await prisma.visualization.upsert({
    where: { id: "seed_viz_1" }, update: {},
    create: {
      id: "seed_viz_1", userId: learner.id, title: "Bubble sort, first pass", description: "Two swaps on a four-element array.",
      script: scripts["bubble-sort"], structures: json(structures), stepCount: 3, schemaVersion: 1,
    },
  });
  await prisma.visualization.upsert({
    where: { id: "seed_viz_2" }, update: {},
    create: {
      id: "seed_viz_2", userId: admin.id, title: "Bubble sort (copy)", description: "A fork of the learner's visualization.",
      script: scripts["bubble-sort"], structures: json(structures), stepCount: 3, schemaVersion: 1, forkedFromId: "seed_viz_1",
    },
  });
  await prisma.share.upsert({
    where: { shareId: "seedshare003" }, update: {},
    create: { shareId: "seedshare003", type: "visualization", targetId: "seed_viz_1", ownerId: learner.id },
  });

  // ── AI usage and audit log ──
  const day = utcDay();
  for (const u of [
    { feature: "analysis" as const, requests: 2, tokensIn: 1800, tokensOut: 2600 },
    { feature: "session" as const, requests: 3, tokensIn: 900, tokensOut: 1400 },
  ]) {
    await prisma.aiUsage.upsert({
      where: { userId_feature_day: { userId: learner.id, feature: u.feature, day } }, update: {},
      create: { userId: learner.id, feature: u.feature, day, requests: u.requests, tokensIn: u.tokensIn, tokensOut: u.tokensOut },
    });
  }
  await prisma.auditLog.upsert({
    where: { id: "seed_audit_1" }, update: {},
    create: { id: "seed_audit_1", actorId: admin.id, action: "seed.data_created", targetType: "seed", targetId: null, meta: json({ source: "seed.ts" }) },
  });
  await prisma.auditLog.upsert({
    where: { id: "seed_audit_2" }, update: {},
    create: { id: "seed_audit_2", actorId: admin.id, action: "algorithm.create", targetType: "algorithm", targetId: bubble?.id ?? null, meta: json({ slug: "bubble-sort", source: "seed.ts" }) },
  });

  console.log(`Seeded ${categories.length} categories, ${algorithms.length} algorithms and demo data for every Phase 5 model.`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
