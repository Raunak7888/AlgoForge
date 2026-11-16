#!/usr/bin/env python
"""
AlgoForge Phase 1 patch. Run from the repository root:

    python3 phase1_apply.py            # validate every edit, then apply
    python3 phase1_apply.py --check    # validate only, change nothing

All edits are staged in memory and checked first (every anchor must match exactly the expected
number of times). If anything does not match, NOTHING is written.
"""
import os
import re
import sys
import pathlib

ROOT = pathlib.Path.cwd()
CHECK_ONLY = "--check" in sys.argv

files = {}        # path -> text (LF normalised)
crlf = set()      # paths that were CRLF on disk
created = {}      # new files
moves = []        # (src, dst)
removed = set()
errors = []


def read(p):
    if p in files:
        return files[p]
    path = ROOT / p
    if not path.exists():
        errors.append(f"missing file: {p}")
        files[p] = ""
        return ""
    with open(path, "r", encoding="utf-8", newline="") as f:
        text = f.read()
    if "\r\n" in text:
        crlf.add(p)
        text = text.replace("\r\n", "\n")
    files[p] = text
    return text


def sub(p, old, new, count=1):
    t = read(p)
    n = t.count(old)
    if n != count:
        errors.append(f"{p}: expected {count} match(es) of {old[:70]!r}, found {n}")
        return
    files[p] = t.replace(old, new)


def rx(p, pattern, repl, flags=0, count=1):
    t = read(p)
    new_t, n = re.subn(pattern, repl, t, flags=flags)
    if n != count:
        errors.append(f"{p}: expected {count} regex match(es) of {pattern[:70]!r}, found {n}")
        return
    files[p] = new_t


def create(p, content):
    if (ROOT / p).exists():
        errors.append(f"refusing to overwrite existing file: {p}")
        return
    created[p] = content.lstrip("\n")


def overwrite(p, content):
    read(p)
    files[p] = content.lstrip("\n")


def move(src, dst):
    text = read(src)
    files[dst] = text
    if src in crlf:
        crlf.add(dst)
    files.pop(src, None)
    removed.add(src)
    moves.append((src, dst))


API = "apps/api/src"
WEB = "apps/web/src"
CON = "packages/contracts/src"
DB = "packages/db"

# ───────────────────────── 1. Database ─────────────────────────

schema = f"{DB}/prisma/schema.prisma"
rx(schema, r"(enum AiFeature \{[^}]*?  session\n)\}", r"\1  visualize\n}", re.S)
rx(schema, r"enum ExplanationContextType \{.*?\}\n\n", "", re.S)
rx(schema, r"^  contextType .*\n  contextId .*\n", "", re.M)
rx(schema, r"(  auditLogs\s+AuditLog\[\]\n)", r"\1  workspaceDraft      WorkspaceDraft?\n")
files[schema] = files[schema].rstrip("\n") + '''

// One autosaved editor draft per user. clientUpdatedAt is the client's edit time: a save only
// wins when it is newer than what is stored, so an old tab can never overwrite newer work.
model WorkspaceDraft {
  userId          String   @id @map("user_id")
  language        String
  codes           Json
  clientUpdatedAt DateTime @map("client_updated_at")
  updatedAt       DateTime @default(now()) @updatedAt @map("updated_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("workspace_drafts")
}
'''

create(f"{DB}/prisma/migrations/20261116000000_phase1_foundation/migration.sql", '''
-- Phase 1: separate visualization quota, drop the unused context columns, add workspace drafts.

ALTER TYPE "AiFeature" ADD VALUE IF NOT EXISTS 'visualize';

ALTER TABLE "explanation_sessions" DROP COLUMN IF EXISTS "context_type";
ALTER TABLE "explanation_sessions" DROP COLUMN IF EXISTS "context_id";
DROP TYPE IF EXISTS "ExplanationContextType";

CREATE TABLE "workspace_drafts" (
    "user_id" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "codes" JSONB NOT NULL,
    "client_updated_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "workspace_drafts_pkey" PRIMARY KEY ("user_id")
);

ALTER TABLE "workspace_drafts"
    ADD CONSTRAINT "workspace_drafts_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
''')

seed = f"{DB}/prisma/seed.ts"
rx(seed, r"^[ \t]*contextType:.*\n", "", re.M, count=3)
rx(f"{DB}/prisma/verify-phase5.ts",
   r'\n  \{\n    name: "sessions whose valid JSON messages.*?\n  \},', "", re.S)

# ───────────────────────── 2. API: env, quotas, rate limiter ─────────────────────────

env = f"{API}/config/env.ts"
sub(env, 'const geminiApiKey = requireEnv("GEMINI_API_KEY");',
    '// Optional: without both, analysis and the assistant are reported as unavailable by /api/meta/capabilities.\nconst geminiApiKey = (process.env.GEMINI_API_KEY ?? "").trim();')
sub(env, '// No hard-coded model: it must be chosen explicitly.\nconst aiModel = requireEnv("AI_MODEL");',
    '// No hard-coded model: it must be chosen explicitly.\nconst aiModel = (process.env.AI_MODEL ?? "").trim();')
sub(env, '    assistantPerDay: parseInteger("AI_ASSISTANT_PER_DAY", 100),',
    '    assistantPerDay: parseInteger("AI_ASSISTANT_PER_DAY", 100),\n'
    '    /** Code -> visualization (AiUsage feature "visualize"). Its own pool, separate from analysis. */\n'
    '    visualizePerMinute: parseInteger("AI_VISUALIZE_PER_MINUTE", 3),\n'
    '    visualizePerDay: parseInteger("AI_VISUALIZE_PER_DAY", 30),')
sub(env, '    aiRateLimitPerHour: parseInteger("AI_RATE_LIMIT_PER_HOUR", 5),\n', "")
sub(env, '    publicShareRateLimitPerMinute: parseInteger("PUBLIC_SHARE_RATE_LIMIT_PER_MINUTE", 60),',
    '    publicShareRateLimitPerMinute: parseInteger("PUBLIC_SHARE_RATE_LIMIT_PER_MINUTE", 60),\n'
    '    draftRateLimitPerMinute: parseInteger("DRAFT_RATE_LIMIT_PER_MINUTE", 60),')

# aiRateLimiter was never mounted (AI spend is limited by quota.service): remove it.
overwrite(f"{API}/middleware/rate-limit.ts", r'''
import { NextFunction, Request, Response } from "express";
import { getRedisClient } from "../config/redis";
import { env } from "../config/env";
import { AppError } from "../utils/app-error";
import { logger, serializeError } from "../utils/logger";

/**
 * The client IP, as computed by Express from the configured `trust proxy` setting.
 * The forwarded-for request header is never read directly: its first entry is client-controlled.
 * (AI spend is limited per user by quota.service, not by this middleware.)
 */
function clientIp(req: Request): string {
  return req.ip ?? "unknown";
}

/* ───────────── in-memory fallback (used when Redis is unavailable) ───────────── */

const memory = new Map<string, { count: number; resetAt: number }>();
const MEMORY_MAX_KEYS = 10_000;

function memoryHit(key: string, windowMs: number): { count: number; retryAfterSeconds: number } {
  const now = Date.now();

  if (memory.size >= MEMORY_MAX_KEYS) {
    for (const [k, v] of memory) {
      if (v.resetAt <= now) memory.delete(k);
    }
    if (memory.size >= MEMORY_MAX_KEYS) {
      const oldest = memory.keys().next();
      if (!oldest.done) memory.delete(oldest.value);
    }
  }

  const entry = memory.get(key);
  if (!entry || entry.resetAt <= now) {
    memory.set(key, { count: 1, resetAt: now + windowMs });
    return { count: 1, retryAfterSeconds: Math.ceil(windowMs / 1000) };
  }
  entry.count += 1;
  return {
    count: entry.count,
    retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
  };
}

/* ───────────── general limiter (sliding window, per IP) ───────────── */

const SLIDING_WINDOW_SCRIPT = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local windowMs = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local member = ARGV[4]
local cutoff = now - windowMs
redis.call('ZREMRANGEBYSCORE', key, '-inf', cutoff)
redis.call('ZADD', key, now, member)
redis.call('PEXPIRE', key, windowMs)
return redis.call('ZCARD', key)
`;

export function generalRateLimiter(options: { scope?: string; limitPerMinute?: number } = {}) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const ip = clientIp(req);
    const windowMs = 60_000;
    const limit = options.limitPerMinute ?? env.redis.defaultRateLimitPerMinute;
    const key = `rl:${options.scope ?? "general"}:${ip}`;
    const now = Date.now();
    const member = `${now}:${process.hrtime.bigint().toString()}`;

    let count: number;
    let retryAfterSeconds = Math.ceil(windowMs / 1000);

    try {
      const redis = getRedisClient();
      count = (await redis.eval(
        SLIDING_WINDOW_SCRIPT,
        1,
        key,
        String(now),
        String(windowMs),
        String(limit),
        member,
      )) as number;
    } catch (err) {
      logger.warn("rate limiter: redis unavailable, using in-memory fallback", serializeError(err));
      const hit = memoryHit(key, windowMs);
      count = hit.count;
      retryAfterSeconds = hit.retryAfterSeconds;
    }

    if (count > limit) {
      res.setHeader("Retry-After", String(retryAfterSeconds));
      next(AppError.tooManyRequests(`Rate limit exceeded. Limit: ${limit} requests/minute.`));
      return;
    }

    next();
  };
}
''')

quota = f"{API}/services/quota.service.ts"
sub(quota, 'export type QuotaFeature = "analysis" | "session";', 'export type QuotaFeature = "analysis" | "session" | "visualize";')
sub(quota, '    return feature === "session"',
    '    if (feature === "visualize") return { minute: env.quotas.visualizePerMinute, day: env.quotas.visualizePerDay };\n    return feature === "session"')
sub(quota, '    const what = feature === "session" ? "assistant message" : "analysis";',
    '    const what = feature === "session" ? "assistant message" : feature === "visualize" ? "visualization" : "analysis";')

# ───────────────────────── 3. API: capability detection + token usage ─────────────────────────

overwrite(f"{API}/services/providers/provider-factory.ts", r'''
import { env } from "../../config/env";
import { AppError } from "../../utils/app-error";
import type { AIProvider } from "./ai-provider";
import { GeminiProvider } from "./gemini.provider";

let _instance: AIProvider | null = null;

/** Gemini is the only AI provider. Without a key and a model the AI features answer 503 instead of crashing the server. */
export function getAIProvider(): AIProvider {
  if (!env.geminiApiKey || !env.ai.model) {
    throw AppError.aiUnavailable("The AI provider is not configured on this server.");
  }
  _instance ??= new GeminiProvider({
    apiKey: env.geminiApiKey,
    model: env.ai.model,
  });
  return _instance;
}
''')

prov = f"{API}/services/providers/ai-provider.ts"
sub(prov, "export type AIGenerateResponse = {",
    "export type AIUsage = { tokensIn: number; tokensOut: number };\n\nexport type AIGenerateResponse = {")
sub(prov, "  history: AIMessage[];\n};",
    "  history: AIMessage[];\n  /** Token counts reported by the provider. */\n  usage?: AIUsage;\n};")

sub(f"{API}/services/providers/gemini.provider.ts", "        history: [...request.messages, message],",
    "        history: [...request.messages, message],\n"
    "        usage: {\n"
    "          tokensIn: response.usageMetadata?.promptTokenCount ?? 0,\n"
    "          // Thinking tokens are billed as output.\n"
    "          tokensOut: (response.usageMetadata?.candidatesTokenCount ?? 0) + (response.usageMetadata?.thoughtsTokenCount ?? 0),\n"
    "        },")

overwrite(f"{API}/services/ai.service.ts", r'''
import type { AnalysisLanguage, AnalysisResult } from "@algoforge/analysis";
import { env } from "../config/env";
import { ANALYSIS_PROMPT_VERSION, buildAnalysisMessages } from "../prompts/analysis.prompt";
import { AppError } from "../utils/app-error";
import { logger } from "../utils/logger";
import { parseAnalysisOutput } from "./lib/ai-output";
import { getAIProvider } from "./providers/provider-factory";
import type { AIMessage, AIUsage } from "./providers/ai-provider";

type AnalyzeCodeInput = {
  code: string;
  language: AnalysisLanguage;
};

export interface AnalysisOutput {
  result: AnalysisResult;
  model: string;
  promptVersion: string;
  /** Tokens of every provider attempt this analysis needed (failed retries are billed too). */
  usage: AIUsage;
}

interface GenerateOptions {
  timeoutMs: number;
  maxOutputTokens: number;
  /** Budget for one provider attempt (one key on one model). Defaults to half of timeoutMs. */
  attemptTimeoutMs?: number;
  /** Aborts the provider request when the caller goes away (for example the HTTP client disconnected). */
  signal?: AbortSignal;
}

/** A retry is only worth starting when at least this much of the analysis budget is left. */
const MIN_RETRY_MS = 10_000;

const NO_USAGE: AIUsage = { tokensIn: 0, tokensOut: 0 };
const addUsage = (a: AIUsage, b: AIUsage): AIUsage => ({ tokensIn: a.tokensIn + b.tokensIn, tokensOut: a.tokensOut + b.tokensOut });

/** One provider attempt gets half of the call budget, so rotation can still reach a second model. */
function defaultAttemptTimeout(totalMs: number): number {
  return Math.max(15_000, Math.floor(totalMs / 2));
}

class AIService {
  /**
   * One billable analysis. Invalid output is retried (env.ai.maxRetries times); timeouts and
   * provider outages are not, because retrying them only makes the person wait longer.
   */
  async analyzeCode(input: AnalyzeCodeInput): Promise<AnalysisOutput> {
    const attempts = 1 + Math.max(0, env.ai.maxRetries);
    let lastError: AppError | null = null;
    let usage = NO_USAGE;
    // One analysis never takes longer than twice the per-call timeout, however many retries are configured.
    const deadline = Date.now() + env.ai.analysisTimeoutMs * 2;

    for (let attempt = 1; attempt <= attempts; attempt++) {
      const remainingMs = deadline - Date.now();
      if (attempt > 1 && remainingMs < MIN_RETRY_MS) break;
      const generated = await this.generate(
        buildAnalysisMessages(input),
        "json",
        { timeoutMs: Math.min(env.ai.analysisTimeoutMs, remainingMs), maxOutputTokens: env.ai.analysisMaxOutputTokens },
      );
      usage = addUsage(usage, generated.usage);
      try {
        return { result: parseAnalysisOutput(generated.content), model: generated.model, promptVersion: ANALYSIS_PROMPT_VERSION, usage };
      } catch (error) {
        if (!(error instanceof AppError)) throw error;
        lastError = error;
        logger.warn("ai: invalid analysis output", { attempt, attempts, model: generated.model, message: error.message });
      }
    }
    throw lastError ?? AppError.aiInvalidOutput();
  }

  async generateTextWithUsage(
    messages: AIMessage[],
    options: Partial<GenerateOptions> & { responseFormat?: "json" | "text" } = {},
  ): Promise<{ content: string; usage: AIUsage }> {
    const { content, usage } = await this.generate(messages, options.responseFormat ?? "text", {
      timeoutMs: options.timeoutMs ?? env.ai.timeoutMs,
      maxOutputTokens: options.maxOutputTokens ?? env.ai.textMaxOutputTokens,
      ...(options.signal ? { signal: options.signal } : {}),
    });
    return { content, usage };
  }

  async generateText(messages: AIMessage[], options: Partial<GenerateOptions> & { responseFormat?: "json" | "text" } = {}): Promise<string> {
    return (await this.generateTextWithUsage(messages, options)).content;
  }

  private async generate(
    messages: AIMessage[],
    responseFormat: "json" | "text",
    options: GenerateOptions,
  ): Promise<{ content: string; model: string; usage: AIUsage }> {
    const provider = getAIProvider();
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, options.timeoutMs);
    const onCallerAbort = () => controller.abort();
    if (options.signal) {
      if (options.signal.aborted) controller.abort();
      else options.signal.addEventListener("abort", onCallerAbort, { once: true });
    }

    try {
      const response = await provider.generate({
        messages,
        responseFormat,
        maxOutputTokens: options.maxOutputTokens,
        signal: controller.signal,
        attemptTimeoutMs: options.attemptTimeoutMs ?? defaultAttemptTimeout(options.timeoutMs),
      });
      return { content: response.message.content, model: response.model, usage: response.usage ?? NO_USAGE };
    } catch (error) {
      if (timedOut) {
        throw AppError.aiTimeout(`The AI provider did not answer within ${Math.round(options.timeoutMs / 1000)} seconds.`);
      }
      if (options.signal?.aborted) throw AppError.badRequest("The request was cancelled.");
      if (error instanceof AppError) {
        if (error.code === "BAD_GATEWAY") throw AppError.aiUnavailable(error.message);
        throw error;
      }
      throw AppError.aiUnavailable("The AI request failed.");
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", onCallerAbort);
    }
  }
}

export const aiService = new AIService();
''')

an = f"{API}/services/analysis.service.ts"
sub(an, 'import { aiService } from "./ai.service";', 'import { aiService } from "./ai.service";\nimport type { AIUsage } from "./providers/ai-provider";')
sub(an, '      const reservation = await quotaService.reserve(userId, "analysis");',
    '      let usage: AIUsage = { tokensIn: 0, tokensOut: 0 };\n      const reservation = await quotaService.reserve(userId, "analysis");')
sub(an, '        entry = { result: out.result, model: out.model };', '        entry = { result: out.result, model: out.model };\n        usage = out.usage;')
sub(an, '        await aiUsageService.record(userId, "analysis");', '        await aiUsageService.record(userId, "analysis", usage);')

es = f"{API}/services/explanation-session.service.ts"
sub(es, 'import { aiService } from "./ai.service";', 'import { aiService } from "./ai.service";\nimport type { AIUsage } from "./providers/ai-provider";')
sub(es, "    let answer: string;", "    let answer: string;\n    let usage: AIUsage = { tokensIn: 0, tokensOut: 0 };")
sub(es, "      answer = (", "      const generated = (")
sub(es, "        await aiService.generateText(messages, {", "        await aiService.generateTextWithUsage(messages, {")
sub(es, "      ).trim();", "      );\n      answer = generated.content.trim();\n      usage = generated.usage;")
sub(es, '      await aiUsageService.record(userId, "session");', '      await aiUsageService.record(userId, "session", usage);')

vg = f"{API}/services/visualization-generate.service.ts"
sub(vg, '    const reservation = await quotaService.reserve(userId, "analysis");', '    const reservation = await quotaService.reserve(userId, "visualize");')
sub(vg, "      let best: Evaluated | null = null;", "      let best: Evaluated | null = null;\n      let usage = { tokensIn: 0, tokensOut: 0 };")
sub(vg, "        const raw = await aiService.generateText(buildVisualizeMessages({ code: input.code, language: input.language, previous }), {",
    "        const generated = await aiService.generateTextWithUsage(buildVisualizeMessages({ code: input.code, language: input.language, previous }), {")
sub(vg, "        const result = evaluate(raw);",
    "        usage = { tokensIn: usage.tokensIn + generated.usage.tokensIn, tokensOut: usage.tokensOut + generated.usage.tokensOut };\n        const result = evaluate(generated.content);")
sub(vg, '        await aiUsageService.record(userId, "analysis");', '        await aiUsageService.record(userId, "visualize", usage);')

# ───────────────────────── 4. API: drop the legacy JSON message mirror ─────────────────────────

esr = f"{API}/repositories/explanation-session.repository.ts"
sub(esr, 'import { prisma, type Prisma } from "@algoforge/db";', 'import { prisma } from "@algoforge/db";')
sub(esr, "   * The legacy JSON column is mirrored until Phase 9 moves sharing to the rows (verify:phase5 and public shares read it).",
    "   * The legacy JSON `messages` column is no longer written: the message rows are the only source.")
rx(esr,
   r'      const rows = await tx\.explanationMessage\.findMany\(\{ where: \{ sessionId \}, orderBy: \{ seq: "asc" \} \}\);.*?assistantMessage: toMessageRow\(rows\[rows\.length - 1\]\) \};',
   '''      const rows = await tx.explanationMessage.findMany({ where: { sessionId, seq: { gte: last + 1 } }, orderBy: { seq: "asc" } });
      // Bump updatedAt (the chat sorts by it) and set the title once.
      await tx.explanationSession.updateMany({
        where: { id: sessionId, userId },
        data: { updatedAt: new Date(), ...(row.title ? {} : { title: input.title }) },
      });

      return { userMessage: toMessageRow(rows[0]), assistantMessage: toMessageRow(rows[1]) };''', re.S)

# ───────────────────────── 5. Drafts (contracts, API, web) ─────────────────────────

create(f"{CON}/drafts.ts", '''
import { z } from "zod";
import { AnalysisLanguageSchema } from "@algoforge/analysis";
import { IsoDateTimeSchema } from "./common";
import { LIMITS } from "./limits";

const CodeSchema = z.string().max(LIMITS.code.maxChars);

/** The editor content of the signed-in person. updatedAt is the time of the last edit, set by the client. */
export const WorkspaceDraftSchema = z.object({
  language: AnalysisLanguageSchema,
  codes: z.object({ javascript: CodeSchema, python: CodeSchema }),
  updatedAt: IsoDateTimeSchema,
});
export const WorkspaceDraftResponseSchema = z.object({ draft: WorkspaceDraftSchema.nullable() });
export const SaveWorkspaceDraftRequestSchema = WorkspaceDraftSchema;
/** applied=false means a newer draft was already stored; `draft` is the one that is kept. */
export const SaveWorkspaceDraftResponseSchema = z.object({ draft: WorkspaceDraftSchema, applied: z.boolean() });

export type WorkspaceDraft = z.infer<typeof WorkspaceDraftSchema>;
export type WorkspaceDraftResponse = z.infer<typeof WorkspaceDraftResponseSchema>;
export type SaveWorkspaceDraftRequest = z.infer<typeof SaveWorkspaceDraftRequestSchema>;
export type SaveWorkspaceDraftResponse = z.infer<typeof SaveWorkspaceDraftResponseSchema>;
''')
sub(f"{CON}/index.ts", 'export * from "./capabilities";', 'export * from "./capabilities";\nexport * from "./drafts";')
sub(f"{CON}/registry.ts", 'import { CapabilitiesResponseSchema } from "./capabilities";',
    'import { CapabilitiesResponseSchema } from "./capabilities";\nimport { SaveWorkspaceDraftRequestSchema, SaveWorkspaceDraftResponseSchema, WorkspaceDraftResponseSchema } from "./drafts";')
sub(f"{CON}/registry.ts", "  CapabilitiesResponse: CapabilitiesResponseSchema,",
    "  CapabilitiesResponse: CapabilitiesResponseSchema,\n  WorkspaceDraftResponse: WorkspaceDraftResponseSchema,\n  SaveWorkspaceDraftRequest: SaveWorkspaceDraftRequestSchema,\n  SaveWorkspaceDraftResponse: SaveWorkspaceDraftResponseSchema,")
sub(f"{CON}/routes.ts", 'import { CapabilitiesResponseSchema } from "./capabilities";',
    'import { CapabilitiesResponseSchema } from "./capabilities";\nimport { SaveWorkspaceDraftRequestSchema, SaveWorkspaceDraftResponseSchema, WorkspaceDraftResponseSchema } from "./drafts";')
sub(f"{CON}/routes.ts", '  { id: "metaCapabilities",',
    '  { id: "draftsGet", method: "get", path: "/api/drafts/workspace", summary: "My autosaved editor draft", tag: "Drafts", auth: "user", csrf: false, rateLimit: "general", responses: { 200: WorkspaceDraftResponseSchema } },\n'
    '  { id: "draftsSave", method: "patch", path: "/api/drafts/workspace", summary: "Save my editor draft (kept only when newer than the stored one)", tag: "Drafts", auth: "user", csrf: true, rateLimit: "general", body: SaveWorkspaceDraftRequestSchema, responses: { 200: SaveWorkspaceDraftResponseSchema } },\n'
    '  { id: "metaCapabilities",')
# /algos is the primary catalog route; /algorithms keeps working through a redirect.
sub(f"{CON}/return-to.ts", 'new Set(["dashboard", "visualizer", "algorithms", "s", "terms", "privacy"])',
    'new Set(["dashboard", "visualizer", "algos", "algorithms", "s", "terms", "privacy"])')

create(f"{API}/repositories/draft.repository.ts", '''
import { prisma, Prisma } from "@algoforge/db";

export interface DraftWrite {
  language: string;
  codes: { javascript: string; python: string };
  clientUpdatedAt: Date;
}

export const draftRepository = {
  findByUser(userId: string) {
    return prisma.workspaceDraft.findUnique({ where: { userId } });
  },

  /**
   * Stores the draft only when it is newer than the stored one. The comparison lives in the query,
   * so two tabs saving at the same moment cannot overwrite each other with older content.
   * Returns the draft that is stored afterwards.
   */
  async saveIfNewer(userId: string, data: DraftWrite) {
    const codes = data.codes as unknown as Prisma.InputJsonValue;
    const updated = await prisma.workspaceDraft.updateMany({
      where: { userId, clientUpdatedAt: { lt: data.clientUpdatedAt } },
      data: { language: data.language, codes, clientUpdatedAt: data.clientUpdatedAt },
    });
    if (updated.count === 0) {
      try {
        await prisma.workspaceDraft.create({ data: { userId, language: data.language, codes, clientUpdatedAt: data.clientUpdatedAt } });
      } catch (error) {
        // A row already exists and is as new or newer: keep it.
        if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) throw error;
      }
    }
    const row = await prisma.workspaceDraft.findUnique({ where: { userId } });
    if (!row) throw new Error("Draft disappeared after saving.");
    return row;
  },
};
''')

create(f"{API}/services/draft.service.ts", '''
import {
  AnalysisLanguageSchema,
  WorkspaceDraftSchema,
  type SaveWorkspaceDraftRequest,
  type SaveWorkspaceDraftResponse,
  type WorkspaceDraft,
} from "@algoforge/contracts";
import { draftRepository } from "../repositories/draft.repository";

/** A client clock far in the future would otherwise lock every later save out. */
const MAX_FUTURE_MS = 5 * 60_000;

type Row = NonNullable<Awaited<ReturnType<typeof draftRepository.findByUser>>>;

/** Stored JSON is data, not trusted: anything unreadable counts as "no draft". */
function toDraft(row: Row): WorkspaceDraft | null {
  const language = AnalysisLanguageSchema.safeParse(row.language);
  const parsed = WorkspaceDraftSchema.safeParse({ language: language.success ? language.data : null, codes: row.codes, updatedAt: row.clientUpdatedAt.toISOString() });
  return parsed.success ? parsed.data : null;
}

class DraftService {
  async get(userId: string): Promise<WorkspaceDraft | null> {
    const row = await draftRepository.findByUser(userId);
    return row ? toDraft(row) : null;
  }

  async save(userId: string, input: SaveWorkspaceDraftRequest): Promise<SaveWorkspaceDraftResponse> {
    const at = Math.min(Date.parse(input.updatedAt), Date.now() + MAX_FUTURE_MS);
    const row = await draftRepository.saveIfNewer(userId, { language: input.language, codes: input.codes, clientUpdatedAt: new Date(at) });
    const draft = toDraft(row) ?? { ...input, updatedAt: new Date(at).toISOString() };
    return { draft, applied: row.clientUpdatedAt.getTime() === at };
  }
}

export const draftService = new DraftService();
''')

create(f"{API}/validation/draft.ts", '''
import { SaveWorkspaceDraftRequestSchema, type SaveWorkspaceDraftRequest } from "@algoforge/contracts";
import { badRequestFromZod } from "./common";

export function parseSaveDraft(value: unknown): SaveWorkspaceDraftRequest {
  const r = SaveWorkspaceDraftRequestSchema.safeParse(value);
  if (!r.success) throw badRequestFromZod(r.error, "Invalid draft.");
  return r.data;
}
''')

create(f"{API}/controllers/draft.controller.ts", '''
import { Request, Response } from "express";
import type { WorkspaceDraftResponse } from "@algoforge/contracts";
import { draftService } from "../services/draft.service";
import { asyncHandler } from "../utils/async-handler";
import { parseSaveDraft } from "../validation/draft";

class DraftController {
  get = asyncHandler(async (req: Request, res: Response) => {
    const body: WorkspaceDraftResponse = { draft: await draftService.get(req.auth!.user.id) };
    res.setHeader("Cache-Control", "no-store");
    res.json(body);
  });

  save = asyncHandler(async (req: Request, res: Response) => {
    const result = await draftService.save(req.auth!.user.id, parseSaveDraft(req.body));
    res.setHeader("Cache-Control", "no-store");
    res.json(result);
  });
}

export const draftController = new DraftController();
''')

create(f"{API}/routes/drafts.ts", '''
import { Router } from "express";
import { env } from "../config/env";
import { draftController as c } from "../controllers/draft.controller";
import { requireAuth } from "../middleware/auth";
import { requireCsrf } from "../middleware/csrf";
import { generalRateLimiter } from "../middleware/rate-limit";

const router = Router();
const limit = generalRateLimiter({ scope: "drafts", limitPerMinute: env.redis.draftRateLimitPerMinute });

router.get("/workspace", requireAuth, limit, c.get);
router.patch("/workspace", requireAuth, requireCsrf, limit, c.save);

export default router;
''')

app = f"{API}/app.ts"
sub(app, 'import shareManageRouter from "./routes/shares";', 'import shareManageRouter from "./routes/shares";\nimport draftRouter from "./routes/drafts";')
sub(app, 'app.use("/api/shares", shareManageRouter); // owner: create / revoke / list',
    'app.use("/api/shares", shareManageRouter); // owner: create / revoke / list\napp.use("/api/drafts", draftRouter);')

# search results link to the new catalog route
sub(f"{API}/services/search.service.ts", "/algorithms/${encodeURIComponent(a.slug)}", "/algos/${encodeURIComponent(a.slug)}")

# ───────────────────────── 6. Web: drafts ─────────────────────────

ep = f"{WEB}/lib/api/endpoints.ts"
sub(ep, "  PublicShareResponseSchema,\n",
    "  PublicShareResponseSchema,\n  SaveWorkspaceDraftResponseSchema,\n  WorkspaceDraftResponseSchema,\n  type SaveWorkspaceDraftRequest,\n  type SaveWorkspaceDraftResponse,\n  type WorkspaceDraftResponse,\n")
sub(ep, "      client.get(`/api/share/${seg(shareId)}`, PublicShareResponseSchema, opt(signal)),",
    "      client.get(`/api/share/${seg(shareId)}`, PublicShareResponseSchema, opt(signal)),\n"
    "    workspaceDraft: (signal?: AbortSignal): Promise<WorkspaceDraftResponse> => client.get(\"/api/drafts/workspace\", WorkspaceDraftResponseSchema, opt(signal)),\n"
    "    saveWorkspaceDraft: (body: SaveWorkspaceDraftRequest): Promise<SaveWorkspaceDraftResponse> => client.patch(\"/api/drafts/workspace\", SaveWorkspaceDraftResponseSchema, body),")

create(f"{WEB}/lib/workspace/draft-storage.ts", '''
import type { AnalysisLanguage } from "@algoforge/contracts";

export const DRAFT_KEY = "algoforge:draft:v1";
const MAX_CHARS = 200_000;

export interface LocalDraft {
  language: AnalysisLanguage;
  codes: Record<AnalysisLanguage, string>;
  /** Epoch ms of the last edit. */
  updatedAt: number;
}

type Reader = Pick<Storage, "getItem">;
type Writer = Pick<Storage, "setItem">;
type Remover = Pick<Storage, "removeItem">;

function browserStorage(): Storage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined; // blocked storage (private mode, policy)
  }
}

/** Stored text is data, not trusted: anything malformed is "no draft". */
export function parseDraft(raw: string | null): LocalDraft | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as { language?: unknown; codes?: { javascript?: unknown; python?: unknown }; updatedAt?: unknown };
    const { javascript, python } = v.codes ?? {};
    if (v.language !== "javascript" && v.language !== "python") return null;
    if (typeof javascript !== "string" || typeof python !== "string") return null;
    if (javascript.length > MAX_CHARS || python.length > MAX_CHARS) return null;
    if (typeof v.updatedAt !== "number" || !Number.isFinite(v.updatedAt) || v.updatedAt <= 0) return null;
    return { language: v.language, codes: { javascript, python }, updatedAt: v.updatedAt };
  } catch {
    return null;
  }
}

export function loadDraft(storage: Reader | undefined = browserStorage()): LocalDraft | null {
  try {
    return parseDraft(storage?.getItem(DRAFT_KEY) ?? null);
  } catch {
    return null;
  }
}

/** Best effort: a full or blocked storage never breaks the editor. */
export function saveDraft(draft: LocalDraft, storage: Writer | undefined = browserStorage()): boolean {
  try {
    if (!storage) return false;
    storage.setItem(DRAFT_KEY, JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

export function clearDraft(storage: Remover | undefined = browserStorage()): void {
  try {
    storage?.removeItem(DRAFT_KEY);
  } catch {
    /* ignore */
  }
}
''')

create(f"{WEB}/lib/workspace/draft-storage.test.ts", '''
import { describe, expect, it } from "vitest";
import { DRAFT_KEY, clearDraft, loadDraft, parseDraft, saveDraft, type LocalDraft } from "./draft-storage";

function fake() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  };
}
const draft: LocalDraft = { language: "python", codes: { javascript: "a", python: "b" }, updatedAt: 1_700_000_000_000 };

describe("draft storage", () => {
  it("round-trips a draft", () => {
    const s = fake();
    expect(saveDraft(draft, s)).toBe(true);
    expect(loadDraft(s)).toEqual(draft);
  });
  it("treats malformed or foreign data as no draft", () => {
    for (const raw of ["", "nope", "{}", JSON.stringify({ ...draft, language: "ruby" }), JSON.stringify({ ...draft, updatedAt: "x" }), JSON.stringify({ ...draft, codes: { javascript: 1, python: "b" } })]) {
      expect(parseDraft(raw)).toBeNull();
    }
  });
  it("clears the draft", () => {
    const s = fake();
    saveDraft(draft, s);
    clearDraft(s);
    expect(s.getItem(DRAFT_KEY)).toBeNull();
  });
  it("survives storage that throws", () => {
    const bad = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("full"); } };
    expect(loadDraft(bad)).toBeNull();
    expect(saveDraft(draft, bad)).toBe(false);
  });
});
''')

create(f"{WEB}/lib/workspace/useWorkspaceDraft.ts", '''
"use client";

import { useEffect, useRef } from "react";
import type { WorkspaceDraft } from "@algoforge/contracts";
import { endpoints } from "@/lib/api/endpoints";
import { useAuth } from "@/lib/auth";
import { loadDraft, saveDraft, type LocalDraft } from "./draft-storage";
import { useWorkspace } from "./store";

const LOCAL_DEBOUNCE_MS = 400;
const SERVER_DEBOUNCE_MS = 2500;

/** draftAt of the last restored draft. A restore is not an edit, so it must not be saved again. */
let restoredAt: number | null = null;

function snapshot(): LocalDraft | null {
  const s = useWorkspace.getState();
  return s.draftAt === null ? null : { language: s.language, codes: s.codes, updatedAt: s.draftAt };
}

function restore(d: LocalDraft): void {
  restoredAt = d.updatedAt;
  useWorkspace.getState().restoreDraft(d);
}

function adopt(d: WorkspaceDraft): void {
  const at = Date.parse(d.updatedAt);
  restore({ language: d.language, codes: d.codes, updatedAt: at });
  saveDraft({ language: d.language, codes: d.codes, updatedAt: at });
}

async function pushToServer(): Promise<void> {
  const snap = snapshot();
  if (!snap) return;
  try {
    const res = await endpoints.saveWorkspaceDraft({ language: snap.language, codes: snap.codes, updatedAt: new Date(snap.updatedAt).toISOString() });
    // Another device saved something newer: take it, unless the person kept typing meanwhile.
    if (!res.applied && Date.parse(res.draft.updatedAt) > snap.updatedAt && useWorkspace.getState().draftAt === snap.updatedAt) adopt(res.draft);
  } catch {
    /* offline, too large or signed out: the browser copy still exists */
  }
}

/**
 * Keeps the editor content across refreshes.
 *  - Everyone: a copy in this browser (localStorage).
 *  - Signed in: also a copy on the server, so it follows the person between devices.
 * The newest edit wins; a restore never replaces something typed after the page loaded.
 */
export function useWorkspaceDraft(): void {
  const { status } = useAuth();
  const authed = status === "authed";
  const authedRef = useRef(authed);
  useEffect(() => {
    authedRef.current = authed;
  });

  // 1. Restore the browser copy, but only if nothing was edited or opened yet.
  useEffect(() => {
    const d = loadDraft();
    if (d && useWorkspace.getState().draftAt === null) restore(d);
  }, []);

  // 2. Signed in: reconcile with the server copy. Newer wins in both directions.
  useEffect(() => {
    if (!authed) return;
    const ctl = new AbortController();
    endpoints
      .workspaceDraft(ctl.signal)
      .then(({ draft }) => {
        const local = useWorkspace.getState().draftAt ?? 0;
        const remote = draft ? Date.parse(draft.updatedAt) : 0;
        if (draft && remote > local) adopt(draft);
        else if (local > remote) void pushToServer();
      })
      .catch(() => undefined);
    return () => ctl.abort();
  }, [authed]);

  // 3. Autosave edits.
  useEffect(() => {
    let localTimer: ReturnType<typeof setTimeout> | undefined;
    let serverTimer: ReturnType<typeof setTimeout> | undefined;
    let localDirty = false;
    let serverDirty = false;

    const flushLocal = () => {
      clearTimeout(localTimer);
      if (!localDirty) return;
      localDirty = false;
      const snap = snapshot();
      if (snap) saveDraft(snap);
    };
    const flushServer = () => {
      clearTimeout(serverTimer);
      if (!serverDirty || !authedRef.current) return;
      serverDirty = false;
      void pushToServer();
    };

    const unsubscribe = useWorkspace.subscribe((s, prev) => {
      if (s.draftAt === null || s.draftAt === prev.draftAt || s.draftAt === restoredAt) return;
      localDirty = true;
      clearTimeout(localTimer);
      localTimer = setTimeout(flushLocal, LOCAL_DEBOUNCE_MS);
      if (authedRef.current) {
        serverDirty = true;
        clearTimeout(serverTimer);
        serverTimer = setTimeout(flushServer, SERVER_DEBOUNCE_MS);
      }
    });
    const onHide = () => {
      if (document.visibilityState === "hidden") flushLocal();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flushLocal);

    return () => {
      unsubscribe();
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flushLocal);
      flushLocal();
      flushServer();
    };
  }, []);
}
''')

store = f"{WEB}/lib/workspace/store.ts"
sub(store, "  selectedAnalysisId: string | null;",
    "  selectedAnalysisId: string | null;\n  /** When the editor content last changed (epoch ms). Null until the person edits, opens something or a draft is restored. */\n  draftAt: number | null;")
sub(store, "  setCode: (code: string) => void;",
    "  setCode: (code: string) => void;\n  restoreDraft: (draft: { language: AnalysisLanguage; codes: Record<AnalysisLanguage, string>; updatedAt: number }) => void;")
sub(store, "  savedVisualization: null as { id: string; title: string } | null,",
    "  savedVisualization: null as { id: string; title: string } | null,\n  draftAt: null as number | null,")
sub(store, "  setCode: (code) => set((s) => ({ codes: { ...s.codes, [s.language]: code } })),",
    "  setCode: (code) => set((s) => ({ codes: { ...s.codes, [s.language]: code }, draftAt: Date.now() })),")
sub(store, "  setLanguage: (language) => set({ language }),",
    "  setLanguage: (language) => set({ language, draftAt: Date.now() }),\n  restoreDraft: (d) => set({ language: d.language, codes: { ...d.codes }, draftAt: d.updatedAt }),")
sub(store, "      lastOpenedId: a.id,", "      lastOpenedId: a.id,\n      draftAt: Date.now(),")

dash = f"{WEB}/components/DashBoard/DashBoard.tsx"
sub(dash, 'import { useWorkspace } from "@/lib/workspace/store";',
    'import { useWorkspace } from "@/lib/workspace/store";\nimport { useWorkspaceDraft } from "@/lib/workspace/useWorkspaceDraft";')
sub(dash, "    const containerRef = useRef<HTMLElement | null>(null);",
    "    const containerRef = useRef<HTMLElement | null>(null);\n    useWorkspaceDraft();")

auth = f"{WEB}/lib/auth/AuthProvider.tsx"
sub(auth, 'import { onSessionExpired } from "./sessionEvents";',
    'import { clearDraft } from "../workspace/draft-storage";\nimport { onSessionExpired } from "./sessionEvents";')
sub(auth, "  const clearSession = useCallback(() => {", "  const clearSession = useCallback(() => {\n    clearDraft(); // the browser copy of the editor must not outlive the account on a shared computer")

# ───────────────────────── 7. Web: /algos route ─────────────────────────

move(f"{WEB}/app/algorithms/page.tsx", f"{WEB}/app/algos/page.tsx")
move(f"{WEB}/app/algorithms/[slug]/page.tsx", f"{WEB}/app/algos/[slug]/page.tsx")
sub(f"{WEB}/app/algos/page.tsx", "/algorithms/${a.slug}", "/algos/${a.slug}")
sub(f"{WEB}/app/algos/[slug]/page.tsx", 'href="/algorithms"', 'href="/algos"', count=2)
sub(f"{WEB}/components/site/PageShell.tsx", '<Link href="/algorithms" className="hover:text-foreground">Algorithms</Link>',
    '<Link href="/algos" className="hover:text-foreground">Algorithms</Link>')
sub("apps/web/next.config.ts", '      { source: "/share/analysis/:id", destination: "/s/:id", permanent: false },',
    '      { source: "/algorithms", destination: "/algos", permanent: true },\n'
    '      { source: "/algorithms/:slug", destination: "/algos/:slug", permanent: true },\n'
    '      { source: "/share/analysis/:id", destination: "/s/:id", permanent: false },')

# ───────────────────────── 8. Web: Analysis.tsx split, sample data out of the production path ─────────────────────────

ap = f"{WEB}/components/DashBoard/Analysis.tsx"
lines = read(ap).split("\n")


def find(prefix):
    for i, l in enumerate(lines):
        if l.startswith(prefix):
            return i
    errors.append(f"{ap}: marker not found: {prefix!r}")
    return 0


if not errors:
    m_mock, m_steps, m_sections = find("// ─── Mock data"), find("const ANALYSIS_STEPS = ["), find("const SECTIONS = [")
    m_idle, m_results = find("// ─── Idle screen"), find("// ─── Results screen")
    m_root, m_copy = find("// ─── Root component"), find("export const ANALYSIS_COPY")
    if not errors and not (m_mock < m_steps < m_sections < m_idle < m_results < m_root < m_copy):
        errors.append(f"{ap}: section markers are not in the expected order")
    if not errors:
        mock = "\n".join(lines[m_mock:m_steps])
        steps = "\n".join(lines[m_steps:m_sections])
        screens = "\n".join(lines[m_idle:m_results])
        root = "\n".join(lines[m_root:m_copy])
        rest = lines[:m_mock] + lines[m_sections:m_idle] + lines[m_results:m_root] + lines[m_copy:]
        text = "\n".join(rest)
        for old in ['import { wait } from "@/lib/async";\n', "    ArrowRight,\n", "    Brain,\n", "    Code2,\n", "    Search,\n",
                    "    ShieldCheck,\n", "    MotionConfig,\n", 'type State = "idle" | "analyzing" | "completed";\n']:
            if text.count(old) != 1:
                errors.append(f"{ap}: expected exactly one {old.strip()!r}, found {text.count(old)}")
            text = text.replace(old, "", 1)
        for old, new in [("const SECTIONS = [", "export const SECTIONS = ["),
                         ("const EASE: [number", "export const EASE: [number"),
                         ("const stagger: Variants", "export const stagger: Variants"),
                         ("const fadeUp: Variants", "export const fadeUp: Variants")]:
            if text.count(old) != 1:
                errors.append(f"{ap}: expected exactly one {old!r}, found {text.count(old)}")
            text = text.replace(old, new, 1)
        files[ap] = text
        root = root.replace("export function SampleAnalysisPanel(", "export function SampleAnalysisPanel(", 1)
        create(f"{WEB}/components/DashBoard/SampleAnalysis.tsx", '''"use client";

/**
 * Fixed sample report. Development only: AnalysisFeature loads this file on demand and FeatureGate
 * only shows it when mock data is enabled, so production never renders (or downloads) it.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, MotionConfig } from "framer-motion";
import { ArrowRight, Brain, Check, Code2, Search, ShieldCheck, Zap } from "lucide-react";
import { wait } from "@/lib/async";
import { SampleChip } from "@/components/ui/SampleChip";
import { EASE, ResultsScreen, SECTIONS, fadeUp, stagger, type Analysis, type Language } from "./Analysis";

type State = "idle" | "analyzing" | "completed";

''' + mock + "\n" + steps + "\n" + screens + "\n" + root + "\n")

af = f"{WEB}/components/DashBoard/AnalysisFeature.tsx"
sub(af, 'import { ANALYSIS_COPY, ResultsScreen, SampleAnalysisPanel } from "./Analysis";',
    'import dynamic from "next/dynamic";\nimport { ANALYSIS_COPY, ResultsScreen } from "./Analysis";\n\n'
    '// Development-only sample report: loaded on demand, never part of the production path.\n'
    'const SampleAnalysisPanel = dynamic(() => import("./SampleAnalysis").then((m) => m.SampleAnalysisPanel), { ssr: false });')

fp = f"{WEB}/components/DashBoard/FeaturePanel.tsx"
sub(fp, 'import AnalysisHistory from "./analysis-history";\n', "")
sub(fp, 'import { SAMPLE_HISTORY, SAMPLE_META } from "@/data/samples/analysisHistory";\n', "")
sub(fp, "const noop = () => {};", 'const SampleHistory = dynamic(() => import("./SampleHistory"), { ssr: false });')
sub(fp, "preview={<AnalysisHistory items={SAMPLE_HISTORY} meta={SAMPLE_META} sample onLoadMore={noop} />}", "preview={<SampleHistory />}")
create(f"{WEB}/components/DashBoard/SampleHistory.tsx", '''
"use client";

import { SAMPLE_HISTORY, SAMPLE_META } from "@/data/samples/analysisHistory";
import AnalysisHistory from "./analysis-history";

const noop = () => {};

/** Development-only sample rows (see FeaturePanel). */
export default function SampleHistory() {
    return <AnalysisHistory items={SAMPLE_HISTORY} meta={SAMPLE_META} sample onLoadMore={noop} />;
}
''')

# ───────────────────────── 9. Landing page copy and footer ─────────────────────────

hf = f"{WEB}/components/LandingPage/HorizontalFeatureScroll.tsx"
sub(hf, 'id: "ai-explainer", tag: "Learning", index: "03", status: "planned", title: "AI Explainer",',
    'id: "ai-explainer", tag: "Learning", index: "03", status: "available", title: "AI Explainer",')
sub(hf, 'description: "Plain-language explanations of an algorithm or snippet.",',
    'description: "A tutor that sees your code, your visualizer script and the step on screen. Ask it to explain, optimize or write code.",')
sub(hf, 'points: ["Explain an algorithm in plain English", "Answer follow-up questions", "Needs an account"],',
    'points: ["Explain an algorithm in plain English", "Answers follow-up questions in saved chats", "Needs an account. A daily limit applies"],')
sub(hf, 'id: "dashboard", tag: "Productivity", index: "04", status: "planned", title: "Saved Work",',
    'id: "dashboard", tag: "Productivity", index: "04", status: "available", title: "Saved Work",')
sub(hf, 'description: "Keep and revisit your past work in one place.",',
    'description: "Save visualizations and analyses to your account and reopen them later.",')
sub(hf, 'points: ["History of saved visualizations", "Needs accounts and storage, not built yet"],',
    'points: ["Saved visualizations and analysis history", "Your editor draft survives a refresh", "Needs an account"],')
sub(hf, 'id: "share", tag: "Collaboration", index: "05", status: "planned", title: "Shareable Links",',
    'id: "share", tag: "Collaboration", index: "05", status: "available", title: "Shareable Links",')
sub(hf, 'description: "A link to a visualization that anyone can open.",',
    'description: "A read-only link to a visualization, an analysis or a chat that anyone can open.",')
sub(hf, 'points: ["One link per saved visualization", "Needs an account and saved work, not built yet"],',
    'points: ["One link per saved item, turned off with one click", "Viewers need no account", "Creating a link needs an account"],')

ml = f"{WEB}/components/LandingPage/MobileTabletLandingPage.tsx"
sub(ml, '{ tag: "AI Explainer", status: "planned", headline: "Ask what a step means.", points: ["Plain-language explanations", "Follow-up questions", "Needs an account"] },',
    '{ tag: "AI Explainer", status: "available", headline: "Ask what a step means.", points: ["Sees your code, script and current step", "Follow-up questions in saved chats", "Needs an account"] },')
sub(ml, '{ tag: "Shareable Links", status: "planned", headline: "Send a visualization.", points: ["One link per saved visualization", "Needs an account and saved work, not built yet"] },',
    '{ tag: "Shareable Links", status: "available", headline: "Send a visualization.", points: ["One read-only link per saved item", "Viewers need no account", "Creating a link needs an account"] },')

wy = f"{WEB}/components/LandingPage/WhatYouGet.tsx"
sub(wy, 'id: "explainer", icon: MessageMultiple01Icon, title: "AI Explainer", short: "Plain-English breakdowns", tag: "Learn", index: "03", status: "planned",',
    'id: "explainer", icon: MessageMultiple01Icon, title: "AI Explainer", short: "Plain-English breakdowns", tag: "Learn", index: "03", status: "available",')
sub(wy, 'description: "Plain-language walkthroughs of an algorithm. Not built yet.",',
    'description: "An AI tutor that sees your code, your script and the step on screen. Needs an account.",')

ft = f"{WEB}/components/LandingPage/Footer.tsx"
sub(ft, 'import { DASHBOARD_HREF, SITE } from "@/lib/site";', 'import { DASHBOARD_HREF, SITE, SOCIAL_LINKS, type SocialLabel } from "@/lib/site";')
rx(ft, r"// ✏️ EDIT THESE.*?\n\];\n",
   "const SOCIAL_ICONS: Record<SocialLabel, IconSvgObject> = { GitHub: GithubIcon, LinkedIn: Linkedin01Icon, Twitter: TwitterIcon, Facebook: Facebook01Icon, Instagram: InstagramIcon };\n"
   "// Real profile URLs live in lib/site.ts (SOCIAL_LINKS). With none listed, the Follow column is hidden.\n"
   "const SOCIALS = SOCIAL_LINKS.map((l) => ({ ...l, icon: SOCIAL_ICONS[l.label] }));\n", re.S)
sub(ft, '{ label: "Open the visualizer", href: DASHBOARD_HREF },',
    '{ label: "Open the visualizer", href: DASHBOARD_HREF },\n            { label: "Algorithms", href: "/algos" },\n            { label: "Terms", href: "/terms" },\n            { label: "Privacy", href: "/privacy" },')
sub(ft, '<div className="footer-item col-span-2 lg:col-span-1">',
    '<div className={`footer-item col-span-2 lg:col-span-1 ${SOCIALS.length === 0 ? "hidden" : ""}`}>')

# ───────────────────────── 10. Node alignment ─────────────────────────

sub("apps/api/tsup.config.ts", 'target: "node20",', 'target: "node24",')
sub("apps/web/package.json", '"@types/node": "^22.20.5",', '"@types/node": "^24.0.0",')
sub("apps/api/package.json", '  "private": true,', '  "private": true,\n  "engines": { "node": ">=24.15.0" },')
sub("apps/web/package.json", '  "private": true,', '  "private": true,\n  "engines": { "node": ">=24.15.0" },')

# ───────────────────────── validate, then apply ─────────────────────────

if errors:
    print("NOTHING WAS CHANGED. These edits did not match your files:\n")
    for e in errors:
        print("  - " + e)
    sys.exit(1)

print(f"All {len(files)} edited and {len(created)} new files validated.")
if CHECK_ONLY:
    sys.exit(0)


def write(p, text):
    path = ROOT / p
    path.parent.mkdir(parents=True, exist_ok=True)
    if p in crlf:
        text = text.replace("\n", "\r\n")
    with open(path, "w", encoding="utf-8", newline="") as f:
        f.write(text)


for p, text in files.items():
    if p not in removed:
        write(p, text)
for p, text in created.items():
    write(p, text)
for src, _dst in moves:
    try:
        (ROOT / src).unlink()
    except FileNotFoundError:
        pass
for d in [f"{WEB}/app/algorithms/[slug]", f"{WEB}/app/algorithms"]:
    try:
        (ROOT / d).rmdir()
    except OSError:
        pass

# Delete UI files nothing imports (checked on disk after the edits above).
src_files = [p for p in (ROOT / WEB).rglob("*") if p.suffix in (".ts", ".tsx") and p.is_file()]


def referenced(pattern, exclude):
    rx_ = re.compile(pattern)
    for p in src_files:
        if p.resolve() in exclude or not p.exists():
            continue
        if rx_.search(p.read_text(encoding="utf-8", errors="ignore")):
            return True
    return False


deleted = []
candidates = [
    ("components/ui/hover-border-gradient-demo.tsx", r"hover-border-gradient-demo[\"']"),
    ("components/ui/hover-border-gradient.tsx", r"/hover-border-gradient[\"']"),
    ("components/ui/card-hover-effect.tsx", r"card-hover-effect[\"']"),
    ("components/ui/FeaturePanel.tsx", r"components/ui/FeaturePanel[\"']"),
    ("components/ui/FeatureCard.tsx", r"/FeatureCard[\"']"),
    ("components/ui/glowing-effect.tsx", r"glowing-effect[\"']"),
]
for rel, pat in candidates:
    f = (ROOT / WEB / rel)
    if f.exists() and not referenced(pat, {f.resolve()}):
        f.unlink()
        deleted.append(rel)
        src_files = [p for p in src_files if p.exists()]

print("Applied.")
print("Moved: app/algorithms -> app/algos")
print("Deleted unused UI files: " + (", ".join(deleted) if deleted else "none"))
print("\nNext: pnpm db:generate && pnpm db:migrate:dev && pnpm typecheck && pnpm typecheck:web && pnpm lint && pnpm lint:web && pnpm test && pnpm build")