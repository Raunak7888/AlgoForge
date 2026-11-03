import { prisma } from "@algoforge/db";
import { layeredCache } from "../services/lib/layered-cache";

export type CodebaseContext = {
  algorithms: AlgorithmContext[];
  schema: SchemaContext;
  apiRoutes: RouteContext[];
};

type AlgorithmContext = {
  id: string;
  slug: string;
  name: string;
  description: string;
  difficulty: string;
  category: string;
  displayCode: { language: string; code: string } | null;
  complexity: {
    timeBest: string | null;
    timeAverage: string | null;
    timeWorst: string | null;
    space: string | null;
  } | null;
};

type SchemaContext = {
  models: ModelContext[];
};

type ModelContext = {
  name: string;
  fields: string[];
};

type RouteContext = {
  method: string;
  path: string;
  description: string;
};

const STATIC_SCHEMA: SchemaContext = {
  models: [
    {
      name: "User",
      fields: ["id", "email", "username", "name", "image", "role", "createdAt", "updatedAt"],
    },
    {
      name: "Session",
      fields: ["id", "userId", "tokenHash", "expiresAt", "revokedAt", "ipAddress", "userAgent"],
    },
    {
      name: "Analysis",
      fields: ["id", "userId", "code", "language", "complexity", "suggestion", "result", "shareId", "isPublic", "createdAt"],
    },
    {
      name: "Algorithm",
      fields: ["id", "slug", "name", "description", "categoryId", "difficulty", "isPublished", "timeBest", "timeAverage", "timeWorst", "spaceComplexity"],
    },
    {
      name: "Category",
      fields: ["id", "label", "description", "iconName", "sortOrder"],
    },
    {
      name: "ForgeConfig",
      fields: ["id", "algorithmId", "forgeCode", "inputSchema", "guardRanges", "version"],
    },
    {
      name: "DisplayCode",
      fields: ["id", "algorithmId", "language", "code"],
    },
  ],
};

const STATIC_ROUTES: RouteContext[] = [
  { method: "GET",  path: "/api/auth/me",                    description: "Returns authenticated user profile from JWT session" },
  { method: "POST", path: "/api/auth/refresh",               description: "Rotates refresh token and issues new access token via cookie" },
  { method: "POST", path: "/api/auth/logout",                description: "Revokes current session and clears auth cookies" },
  { method: "GET",  path: "/api/algorithms",                 description: "Lists published algorithms with optional categoryId, difficulty, search filters" },
  { method: "GET",  path: "/api/algorithms/id/:id",          description: "Fetches full algorithm detail by UUID" },
  { method: "GET",  path: "/api/algorithms/slug/:slug",      description: "Fetches algorithm detail by slug" },
  { method: "GET",  path: "/api/algorithms/id/:id/visualize",description: "Returns forge execution config for algorithm visualization" },
  { method: "POST", path: "/api/analysis",                   description: "Runs AI code analysis and stores result for authenticated user" },
  { method: "GET",  path: "/api/analysis",                   description: "Lists paginated analysis history for authenticated user" },
  { method: "GET",  path: "/api/analysis/:id",               description: "Fetches a single analysis by ID for authenticated user" },
  { method: "POST", path: "/api/analysis/:id/share",         description: "Makes an analysis public and returns a share URL" },
  { method: "GET",  path: "/api/share/:shareId",             description: "Returns publicly shared analysis by shareId" },
  { method: "GET",  path: "/api/categories",                 description: "Lists all categories sorted by sortOrder" },
  { method: "POST", path: "/api/explain",                    description: "Accepts natural language query and returns AI explanation mapped to codebase" },
  { method: "POST", path: "/api/explain-sessions",           description: "Creates a persistent AI explanation chat session" },
  { method: "POST", path: "/api/explain-sessions/:id/messages", description: "Sends a message in a persistent explanation session" },
];

const CONTEXT_CACHE_TTL = 60; // seconds

export async function buildCodebaseContext(slugs?: string[]): Promise<CodebaseContext> {
  const cacheKey = `ctx:${(slugs ?? []).slice().sort().join(",")}`;

  const cached = await layeredCache.get<CodebaseContext>(cacheKey);
  if (cached) return cached;

  const where = slugs?.length
    ? { slug: { in: slugs }, isPublished: true }
    : { isPublished: true };

  const algorithms = await prisma.algorithm.findMany({
    where,
    take: 10,
    include: {
      category:     { select: { label: true } },
      displayCodes: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const algorithmContexts: AlgorithmContext[] = algorithms.map((algo) => {
    const jsCode    = algo.displayCodes.find((dc) => dc.language === "javascript");
    const firstCode = algo.displayCodes[0] ?? null;

    return {
      id:          algo.id,
      slug:        algo.slug,
      name:        algo.name,
      description: algo.description,
      difficulty:  algo.difficulty,
      category:    algo.category.label,
      displayCode: jsCode ?? (firstCode ? { language: firstCode.language, code: firstCode.code } : null),
      complexity:
        algo.timeBest || algo.timeAverage || algo.timeWorst || algo.spaceComplexity
          ? {
              timeBest:    algo.timeBest,
              timeAverage: algo.timeAverage,
              timeWorst:   algo.timeWorst,
              space:       algo.spaceComplexity,
            }
          : null,
    };
  });

  const result: CodebaseContext = {
    algorithms: algorithmContexts,
    schema:     STATIC_SCHEMA,
    apiRoutes:  STATIC_ROUTES,
  };

  await layeredCache.set(cacheKey, result, CONTEXT_CACHE_TTL);
  return result;
}

export function serializeContext(ctx: CodebaseContext): string {
  const sections: string[] = [];

  sections.push("=== DATABASE SCHEMA ===");
  for (const model of ctx.schema.models) {
    sections.push(`Model ${model.name}: [${model.fields.join(", ")}]`);
  }

  sections.push("\n=== API ROUTES ===");
  for (const route of ctx.apiRoutes) {
    sections.push(`${route.method} ${route.path} — ${route.description}`);
  }

  if (ctx.algorithms.length > 0) {
    sections.push("\n=== ALGORITHMS ===");
    for (const algo of ctx.algorithms) {
      sections.push(`[${algo.slug}] ${algo.name} (${algo.difficulty}, category: ${algo.category})`);
      sections.push(`  Description: ${algo.description}`);
      if (algo.complexity) {
        sections.push(
          `  Complexity: time=${algo.complexity.timeAverage ?? "?"}, space=${algo.complexity.space ?? "?"}`,
        );
      }
      if (algo.displayCode) {
        const snippet = algo.displayCode.code.slice(0, 600);
        sections.push(`  Code (${algo.displayCode.language}):\n${snippet}${algo.displayCode.code.length > 600 ? "\n  [truncated]" : ""}`);
      }
    }
  }

  return sections.join("\n");
}