import { randomBytes } from "crypto";
import { LIMITS, type CreateExplainSessionRequest, type SendMessageRequest } from "@algoforge/contracts";
import { buildAssistantContext, detectIntent } from "../ai/context-builder";
import { env } from "../config/env";
import { buildAssistantMessages } from "../prompts/assistant.prompt";
import { explanationMessageRepository } from "../repositories/explanation-message.repository";
import { explanationSessionRepository, toMessageRow } from "../repositories/explanation-session.repository";
import { AppError } from "../utils/app-error";
import { logger, serializeError } from "../utils/logger";
import { paginate } from "../utils/pagination";
import { encodeSessionCursor, type ListMessagesQuery, type ListSessionsQuery } from "../validation/explanation-session";
import { aiService } from "./ai.service";
import { aiUsageService } from "./ai-usage.service";
import { layeredCache } from "./lib/layered-cache";
import { quotaService } from "./quota.service";

const PUBLIC_CACHE_TTL_SECONDS = 600;

export function publicCacheKey(shareId: string): string {
  return `explain:public:${shareId}`;
}
const newShareId = (): string => randomBytes(9).toString("base64url");
const buildShareUrl = (shareId: string): string => `${env.webAppUrl}/share/explain/${shareId}`;

/**
 * Private reads always go to the database with the owner in the query, so there is no private cache to leak
 * (S-01) and no cached-vs-fresh shape difference (A-07). Only the public share view is cached.
 */
class ExplanationSessionService {
  createSession(userId: string, input: CreateExplainSessionRequest) {
    return explanationSessionRepository.create(userId, input.title);
  }

  async listSessions(userId: string, query: ListSessionsQuery) {
    const rows = await explanationSessionRepository.findManyByUser(userId, {
      take: query.limit + 1,
      cursorUpdatedAt: query.cursorUpdatedAt,
      cursorId: query.cursorId,
    });
    return paginate(rows, query.limit, (row) => encodeSessionCursor({ updatedAt: row.updatedAt.toISOString(), id: row.id }));
  }

  async getSession(userId: string, id: string) {
    const session = await explanationSessionRepository.findOwned(id, userId);
    if (!session) throw AppError.notFound("Session not found.");
    const rows = await explanationMessageRepository.listBySession(id, userId, { take: LIMITS.assistant.maxMessagesPerSession });
    return { session, messages: rows.map(toMessageRow) };
  }

  async listMessages(userId: string, id: string, query: ListMessagesQuery) {
    const session = await explanationSessionRepository.findOwned(id, userId);
    if (!session) throw AppError.notFound("Session not found.");
    const rows = await explanationMessageRepository.listBySession(id, userId, { take: query.limit + 1, afterSeq: query.afterSeq });
    return paginate(rows.map(toMessageRow), query.limit, (row) => String(row.seq));
  }

  async renameSession(userId: string, id: string, title: string) {
    const result = await explanationSessionRepository.rename(id, userId, title);
    if (result.count === 0) throw AppError.notFound("Session not found.");
    const session = await explanationSessionRepository.findOwned(id, userId);
    if (!session) throw AppError.notFound("Session not found.");
    if (session.shareId) await layeredCache.del(publicCacheKey(session.shareId));
    return session;
  }

  /**
   * Order matters: validate and check capacity first (cheap), reserve quota only right before the paid call,
   * give the quota back if the provider fails, and write the exchange in one transaction afterwards.
   */
  async sendMessage(userId: string, sessionId: string, input: SendMessageRequest, signal?: AbortSignal) {
    const session = await explanationSessionRepository.findOwned(sessionId, userId);
    if (!session) throw AppError.notFound("Session not found.");

    const max = LIMITS.assistant.maxMessagesPerSession;
    const count = await explanationMessageRepository.countBySession(sessionId, userId);
    if (count + 2 > max) throw AppError.conflict(`This chat is full (${max} messages). Start a new chat to continue.`);

    const history = await explanationSessionRepository.listRecentMessages(sessionId, userId, LIMITS.assistant.historyMessages);
    const context = await buildAssistantContext(input.context);
    const messages = buildAssistantMessages({ context, history, query: input.query });

    const reservation = await quotaService.reserve(userId, "session");
    let answer: string;
    try {
      answer = (
        await aiService.generateText(messages, {
          timeoutMs: env.ai.assistantTimeoutMs,
          maxOutputTokens: env.ai.assistantMaxOutputTokens,
          ...(signal ? { signal } : {}),
        })
      ).trim();
      if (answer === "") throw AppError.aiInvalidOutput();
    } catch (error) {
      await reservation.release();
      throw error;
    }
    try {
      await aiUsageService.record(userId, "session");
    } catch (error) {
      logger.warn("ai usage could not be recorded", { userId, ...serializeError(error) });
    }

    const exchange = await explanationSessionRepository.appendExchange(sessionId, userId, {
      query: input.query,
      answer,
      intent: detectIntent(input.query),
      title: input.query.replace(/\s+/g, " ").trim().slice(0, 80),
      maxMessages: max,
    });
    if (session.shareId) await layeredCache.del(publicCacheKey(session.shareId));
    return exchange;
  }

  async deleteSession(userId: string, id: string): Promise<void> {
    const session = await explanationSessionRepository.findOwned(id, userId);
    if (!session) throw AppError.notFound("Session not found.");
    const result = await explanationSessionRepository.delete(id, userId);
    if (result.count === 0) throw AppError.notFound("Session not found.");
    // A deleted public session must stop being readable immediately.
    if (session.shareId) await layeredCache.del(publicCacheKey(session.shareId));
  }

  async shareSession(userId: string, id: string) {
    const session = await explanationSessionRepository.findOwned(id, userId);
    if (!session) throw AppError.notFound("Session not found.");
    if (session.shareId && session.isPublic) return { shareUrl: buildShareUrl(session.shareId) };
    const shareId = newShareId();
    await explanationSessionRepository.share(id, userId, shareId);
    return { shareUrl: buildShareUrl(shareId) };
  }

  async getPublicSession(shareId: string) {
    const key = publicCacheKey(shareId);
    const cached = await layeredCache.get<Awaited<ReturnType<typeof explanationSessionRepository.findPublicByShareId>>>(key);
    if (cached) return cached;
    const session = await explanationSessionRepository.findPublicByShareId(shareId);
    if (!session) throw AppError.notFound("Session not found or not public.");
    await layeredCache.set(key, session, PUBLIC_CACHE_TTL_SECONDS);
    return session;
  }
}

export const explanationSessionService = new ExplanationSessionService();
