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
import { publicShareCacheKey } from "./lib/share-cache";
import { shareService } from "./share.service";

/** Kept as an export for existing imports and tests; it is now the unified key. */
export const publicCacheKey = publicShareCacheKey;

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
      take: query.limit + 1, cursorUpdatedAt: query.cursorUpdatedAt, cursorId: query.cursorId,
    });
    const page = paginate(rows, query.limit, (row) => encodeSessionCursor({ updatedAt: row.updatedAt.toISOString(), id: row.id }));
    return { ...page, items: await shareService.withShareState(userId, "explain", page.items) };
  }

  async getSession(userId: string, id: string) {
    const found = await explanationSessionRepository.findOwned(id, userId);
    if (!found) throw AppError.notFound("Session not found.");
    const [session] = await shareService.withShareState(userId, "explain", [found]);
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
    const found = await explanationSessionRepository.findOwned(id, userId);
    if (!found) throw AppError.notFound("Session not found.");
    const [session] = await shareService.withShareState(userId, "explain", [found]);
    return session;
  }

  /**
   * Order matters: validate and check capacity first (cheap), reserve quota only right before the paid call,
   * give the quota back if the provider fails, and write the exchange in one transaction afterwards.
   */
  async sendMessage(userId: string, sessionId: string, input: SendMessageRequest, signal?: AbortSignal) {
    if (!(await explanationSessionRepository.findOwned(sessionId, userId))) throw AppError.notFound("Session not found.");

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
    return exchange;
  }

  async deleteSession(userId: string, id: string): Promise<void> {
    const session = await explanationSessionRepository.findOwned(id, userId);
    if (!session) throw AppError.notFound("Session not found.");
    const shareId = (await shareService.activeShareMap(userId, "explain", [id])).get(id);
    const result = await explanationSessionRepository.delete(id, userId); // also deletes the shares row
    if (result.count === 0) throw AppError.notFound("Session not found.");
    if (shareId) await layeredCache.del(publicShareCacheKey(shareId));
  }

  async shareSession(userId: string, id: string) {
    const share = await shareService.create(userId, "explain", id);
    return { shareUrl: shareService.urlFor(share.shareId) };
  }

}

export const explanationSessionService = new ExplanationSessionService();
