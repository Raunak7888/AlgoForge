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

const SESSION_CACHE_TTL_SECONDS = 300;
const MAX_STORED_MESSAGES       = 100; // 50 exchanges
const AI_HISTORY_MESSAGES       = 10;  // last 5 exchanges sent to AI

function sessionCacheKey(id: string): string {
  return `explain:session:${id}`;
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
    const cached = await layeredCache.get<
      Awaited<ReturnType<typeof explanationSessionRepository.findOneByUser>>
    >(sessionCacheKey(id));

    if (cached) return cached;

    const session = await explanationSessionRepository.findOneByUser(id, userId);
    if (!session) throw AppError.notFound("Session not found.");

    await layeredCache.set(sessionCacheKey(id), session, SESSION_CACHE_TTL_SECONDS);
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
    await layeredCache.del(sessionCacheKey(sessionId));

    return { userMessage, assistantMessage };
  }

  async deleteSession(userId: string, id: string): Promise<void> {
    const result = await explanationSessionRepository.delete(id, userId);
    if (result.count === 0) throw AppError.notFound("Session not found.");
    await layeredCache.del(sessionCacheKey(id));
  }

  async shareSession(userId: string, id: string) {
    const session = await explanationSessionRepository.findOneByUser(id, userId);
    if (!session) throw AppError.notFound("Session not found.");

    if (session.shareId && session.isPublic) {
      return { shareUrl: buildShareUrl(session.shareId) };
    }

    const shareId = newShareId();
    await explanationSessionRepository.share(id, shareId);
    await layeredCache.del(sessionCacheKey(id));

    return { shareUrl: buildShareUrl(shareId) };
  }

  async getPublicSession(shareId: string) {
    const cacheKey = `explain:public:${shareId}`;

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