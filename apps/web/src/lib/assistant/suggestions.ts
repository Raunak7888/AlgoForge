import type { ContextSources } from "./context-core";

const MAX_CHIPS = 3;

/** Structure names used by a script, read with a regex so a half-typed script still works. */
export function structuresIn(script: string | null): string[] {
  if (!script) return [];
  const found = new Set<string>();
  for (const m of script.matchAll(/"(?:ds|dsname)"\s*:\s*"([A-Za-z]+)"/g)) found.add(m[1].toLowerCase());
  return [...found];
}

const pretty: Record<string, string> = { bst: "binary search tree", map: "hash map", set: "hash set", linkedlist: "linked list" };
const label = (ds: string) => pretty[ds] ?? ds;

/** Chips that match what is actually on screen. Always 1 to 3, never empty. */
export function suggestionsFor(s: ContextSources): string[] {
  const out: string[] = [];
  const add = (text: string) => {
    if (!out.includes(text)) out.push(text);
  };
  const ds = structuresIn(s.script);

  if (s.step) add("Explain this step");
  if (ds.length > 0) add(ds.length === 1 ? `Explain my ${label(ds[0])}` : "Explain my visualization");
  if (s.algorithmSlug) add(`Walk me through ${s.algorithmSlug.replace(/-/g, " ")}`);
  if (s.code.trim() !== "") {
    add("Suggest optimizations");
    add("What is the time complexity?");
  }
  if (ds.includes("graph")) add("Generate BFS code");
  add("Generate BFS code");
  add("Explain bubble sort");
  return out.slice(0, MAX_CHIPS);
}
