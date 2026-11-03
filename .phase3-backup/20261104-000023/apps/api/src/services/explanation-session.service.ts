import { randomBytes } from "crypto";
import { explanationSessionRepository } from "../repositories/explanation-session.repository";
import { processQuery } from "../ai/query-processor";
import { buildCodebaseContext, serializeContext } from "../ai/context-builder";
import { buildExplanationPrompt } from "../prompts/explanation.prompt";
import { aiService } from "./ai.service";
import { AppError } from "../utils/app-error";
import { env } from "../config/env";
import type {
  CreateSessionInput,
  SendMessageInput,
  ListSessionsQuery,
} from "../validation/explanation-session";
import { layeredCache } from "./lib/layered-cache";

export type SessionMessage = {
  id:        string;
  role:      "user" | "assistant";
  content:   string;
  intent?:   string;
  createdAt: string;
};

type SessionRecord = NonNullable<
  Awaited<ReturnType<typeof explanationSessionRepository.findOneByUser>>
>;

const SESSION_CACHE_TTL_SECONDS = 300;
const MAX_STORED_MESSAGES       = 100; // 50 exchanges
const AI_HISTORY_MESSAGES       = 10;  // last 5 exchanges sent to AI

/** Private session cache entries are scoped to the owner, so one user can never be served another's session. */
function sessionCacheKey(userId: string, id: string): string {
  return `explain:session:${userId}:${id}`;
}

function publicCacheKey(shareId: string): string {
  return `explain:public:${shareId}`;
}

function newMessageId(): string {
  return randomBytes(6).toString("hex");
}

function newShareId(): string {
  return randomBytes(9).toString("base64url");
}

function buildShareUrl(shareId: string): string {
  return `${env.webAppUrl}/share/explain/${shareId}`;
}

class ExplanationSessionService {
  async createSession(userId: string, input: CreateSessionInput) {
    return explanationSessionRepository.create(userId, input.title);
  }

  async listSessions(userId: string, query: ListSessionsQuery) {
    const sessions = await explanationSessionRepository.findManyByUser(userId, {
      take:   query.limit,
      cursor: query.cursor,
    });

    const nextCursor = sessions.length === query.limit
      ? (sessions[sessions.length - 1]?.id ?? null)
      : null;

    return { sessions, nextCursor };
  }

  async getSession(userId: string, id: string) {
    const key = sessionCacheKey(userId, id);
    const cached = await layeredCache.get<SessionRecord>(key);

    // Defense in depth: even under the owner-scoped key, verify ownership.
    if (cached && cached.userId === userId) return cached;

    const session = await explanationSessionRepository.findOneByUser(id, userId);
    if (!session) throw AppError.notFound("Session not found.");

    await layeredCache.set(key, session, SESSION_CACHE_TTL_SECONDS);
    return session;
  }

  async sendMessage(userId: string, sessionId: string, input: SendMessageInput) {
    const session = await explanationSessionRepository.findOneByUser(sessionId, userId);
    if (!session) throw AppError.notFound("Session not found.");

    const existingMessages = (session.messages as unknown as SessionMessage[]) ?? [];

    const userMessage: SessionMessage = {
      id:        newMessageId(),
      role:      "user",
      content:   input.query,
      createdAt: new Date().toISOString(),
    };

    const scope       = await processQuery(input.query);
    const context     = await buildCodebaseContext(scope.targetSlugs);
    const contextText = serializeContext(context);
    const prompt      = buildExplanationPrompt(contextText, scope);

    // Include prior conversation history so the AI has multi-turn context.
    const history = existingMessages
      .slice(-AI_HISTORY_MESSAGES)
      .map((m) => ({
        role:    m.role as "user" | "assistant",
        content: m.content,
      }));

    const rawAnswer = await aiService.generateText([
      ...history,
      { role: "user", content: prompt },
    ]);

    const assistantMessage: SessionMessage = {
      id:        newMessageId(),
      role:      "assistant",
      content:   rawAnswer.trim(),
      intent:    scope.intent,
      createdAt: new Date().toISOString(),
    };

    // Cap stored history to MAX_STORED_MESSAGES (drop oldest when over limit)
    const updatedMessages: SessionMessage[] = [
      ...existingMessages.slice(-(MAX_STORED_MESSAGES - 2)),
      userMessage,
      assistantMessage,
    ];

    const title = session.title ?? input.query.slice(0, 80);
    await explanationSessionRepository.appendMessages(sessionId, updatedMessages, title);
    await layeredCache.del(sessionCacheKey(userId, sessionId));
    if (session.shareId) await layeredCache.del(publicCacheKey(session.shareId));

    return { userMessage, assistantMessage };
  }

  async deleteSession(userId: string, id: string): Promise<void> {
    const session = await explanationSessionRepository.findOneByUser(id, userId);
    if (!session) throw AppError.notFound("Session not found.");

    const result = await explanationSessionRepository.delete(id, userId);
    if (result.count === 0) throw AppError.notFound("Session not found.");

    await layeredCache.del(sessionCacheKey(userId, id));
    // A deleted public session must stop being readable immediately.
    if (session.shareId) await layeredCache.del(publicCacheKey(session.shareId));
  }

  async shareSession(userId: string, id: string) {
    const session = await explanationSessionRepository.findOneByUser(id, userId);
    if (!session) throw AppError.notFound("Session not found.");

    if (session.shareId && session.isPublic) {
      return { shareUrl: buildShareUrl(session.shareId) };
    }

    const shareId = newShareId();
    await explanationSessionRepository.share(id, shareId);
    await layeredCache.del(sessionCacheKey(userId, id));

    return { shareUrl: buildShareUrl(shareId) };
  }

  async getPublicSession(shareId: string) {
    const cacheKey = publicCacheKey(shareId);

    const cached = await layeredCache.get<
      Awaited<ReturnType<typeof explanationSessionRepository.findPublicByShareId>>
    >(cacheKey);
    if (cached) return cached;

    const session = await explanationSessionRepository.findPublicByShareId(shareId);
    if (!session) throw AppError.notFound("Session not found or not public.");

    await layeredCache.set(cacheKey, session, SESSION_CACHE_TTL_SECONDS * 2);
    return session;
  }
}

export const explanationSessionService = new ExplanationSessionService();
