import { prisma } from "@algoforge/db";
import { layeredCache } from "../services/lib/layered-cache";

export type QueryScope = {
  intent: "explain_flow" | "explain_failure" | "explain_algorithm" | "explain_api" | "general";
  keywords: string[];
  targetSlugs: string[];
  targetRoutes: string[];
  rawQuery: string;
};

const ROUTE_KEYWORDS: Record<string, string[]> = {
  "/api/auth":       ["auth", "login", "logout", "session", "token", "refresh", "google", "oauth"],
  "/api/analysis":   ["analysis", "analyze", "ai", "code analysis"],
  "/api/algorithms": ["algorithm", "visualize", "forge"],
  "/api/categories": ["category", "categories"],
  "/api/share":      ["share", "public", "shareId"],
  "/api/explain":    ["explain", "explanation"],
};

const SLUGS_CACHE_KEY = "meta:slugs";
const SLUGS_CACHE_TTL = 300; // 5 minutes

export async function getKnownSlugs(): Promise<string[]> {
  const cached = await layeredCache.get<string[]>(SLUGS_CACHE_KEY);
  if (cached) return cached;

  const rows = await prisma.algorithm.findMany({
    where:  { isPublished: true },
    select: { slug: true },
  });
  const result = rows.map((r) => r.slug);
  await layeredCache.set(SLUGS_CACHE_KEY, result, SLUGS_CACHE_TTL);
  return result;
}

export async function processQuery(query: string): Promise<QueryScope> {
  const lower = query.toLowerCase();

  const intent       = detectIntent(lower);
  const keywords     = extractKeywords(lower);
  const targetSlugs  = await matchSlugs(lower);
  const targetRoutes = matchRoutes(lower);

  return {
    intent,
    keywords,
    targetSlugs,
    targetRoutes,
    rawQuery: query,
  };
}

function detectIntent(query: string): QueryScope["intent"] {
  if (/why.*(fail|error|broken|wrong|crash|not work)/i.test(query)) {
    return "explain_failure";
  }
  if (/how.*(happen|work|flow|process|execut)/i.test(query)) {
    return "explain_flow";
  }
  if (/api|endpoint|route|request|response/i.test(query)) {
    return "explain_api";
  }
  if (/algorithm|sort|search|graph|tree|heap|stack|queue/i.test(query)) {
    return "explain_algorithm";
  }
  return "general";
}

function extractKeywords(query: string): string[] {
  const stopWords = new Set([
    "this", "that", "the", "is", "are", "was", "were", "a", "an", "and",
    "or", "but", "in", "on", "at", "to", "for", "of", "with", "by",
    "how", "why", "what", "when", "where", "which", "who",
  ]);
  return query
    .split(/\s+/)
    .map((w) => w.replace(/[^a-z0-9-]/g, ""))
    .filter((w) => w.length > 2 && !stopWords.has(w));
}

async function matchSlugs(query: string): Promise<string[]> {
  const knownSlugs = await getKnownSlugs();
  return knownSlugs.filter((slug) => {
    const normalized = slug.replace(/-/g, " ");
    return query.includes(slug) || query.includes(normalized);
  });
}

function matchRoutes(query: string): string[] {
  const matched: string[] = [];
  for (const [route, keywords] of Object.entries(ROUTE_KEYWORDS)) {
    if (keywords.some((kw) => query.includes(kw))) {
      matched.push(route);
    }
  }
  return matched;
}