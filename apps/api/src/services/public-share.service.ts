import { z } from "zod";
import { ShareIdSchema, VisualizationStructureSchema, type PublicShareResponse, type ShareType } from "@algoforge/contracts";
import { analysisRepository } from "../repositories/analysis.repository";
import { explanationSessionRepository } from "../repositories/explanation-session.repository";
import { shareRepository } from "../repositories/share.repository";
import { visualizationRepository } from "../repositories/visualization.repository";
import { serializeSharedAnalysis } from "../serializers/analysis";
import { toIso } from "../serializers/dates";
import { serializeMessage } from "../serializers/explain";
import { AppError } from "../utils/app-error";
import { logger, serializeError } from "../utils/logger";
import { layeredCache } from "./lib/layered-cache";
import { publicShareCacheKey } from "./lib/share-cache";

const CACHE_TTL_SECONDS = 60;
const NOT_FOUND = "This link is not available.";
const StructuresSchema = z.array(VisualizationStructureSchema);

type ActiveShare = NonNullable<Awaited<ReturnType<typeof shareRepository.findActiveByShareId>>>;
type UserRow = { name: string | null; username: string | null; image: string | null } | null;

const creatorOf = (u: UserRow) => (u ? { name: u.name, username: u.username ?? u.name, avatarUrl: u.image } : null);

/** Only whitelisted fields leave this function: never a user id, never another item. */
async function load(share: ActiveShare): Promise<PublicShareResponse | null> {
  const createdAt = toIso(share.createdAt);
  switch (share.type) {
    case "analysis": {
      const row = await analysisRepository.findPublicById(share.targetId);
      if (!row) return null;
      const creator = creatorOf(row.user);
      return { type: "analysis", createdAt, data: serializeSharedAnalysis({ ...row, user: null }), ...(creator ? { creator } : {}) };
    }
    case "explain": {
      const row = await explanationSessionRepository.findPublicById(share.targetId);
      if (!row) return null;
      const creator = creatorOf(row.user);
      return {
        type: "explain",
        createdAt,
        data: { id: row.id, title: row.title, messages: row.messageRows.map(serializeMessage), createdAt: toIso(row.createdAt), updatedAt: toIso(row.updatedAt) },
        ...(creator ? { creator } : {}),
      };
    }
    case "visualization": {
      const row = await visualizationRepository.findPublicById(share.targetId);
      if (!row) return null;
      const structures = StructuresSchema.safeParse(row.structures);
      const creator = creatorOf(row.user);
      return {
        type: "visualization",
        createdAt,
        data: { title: row.title, description: row.description, script: row.script, structures: structures.success ? structures.data : [] },
        ...(creator ? { creator } : {}),
      };
    }
  }
}

class PublicShareService {
  /**
   * Order matters for revocation: the share row is checked on EVERY request, before the cache is read,
   * so a revoked link is gone on every instance at once. The cache only saves the heavy target load.
   */
  async resolve(shareId: string): Promise<PublicShareResponse> {
    if (!ShareIdSchema.safeParse(shareId).success) throw AppError.notFound(NOT_FOUND);
    const share = await shareRepository.findActiveByShareId(shareId);
    if (!share) throw AppError.notFound(NOT_FOUND);

    const key = publicShareCacheKey(shareId);
    let payload = await layeredCache.get<PublicShareResponse>(key);
    if (!payload) {
      payload = await load(share);
      if (!payload) throw AppError.notFound(NOT_FOUND);
      await layeredCache.set(key, payload, CACHE_TTL_SECONDS);
    }

    // Cheap and async: a failed counter must never fail a public read.
    void shareRepository.incrementViewCount(shareId).catch((error: unknown) => {
      logger.warn("share view count failed", { shareId, ...serializeError(error) });
    });
    return payload;
  }

  /** For the deprecated type-specific aliases: the id must belong to that type. */
  async resolveAs(shareId: string, type: ShareType): Promise<PublicShareResponse> {
    const payload = await this.resolve(shareId);
    if (payload.type !== type) throw AppError.notFound(NOT_FOUND);
    return payload;
  }
}

export const publicShareService = new PublicShareService();
