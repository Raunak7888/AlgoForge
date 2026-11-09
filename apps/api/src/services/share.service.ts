import { randomBytes } from "crypto";
import { Prisma, type ShareType } from "@algoforge/db";
import { env } from "../config/env";
import { shareRepository } from "../repositories/share.repository";
import { AppError } from "../utils/app-error";
import { layeredCache } from "./lib/layered-cache";
import { publicShareCacheKey } from "./lib/share-cache";

const MAX_ATTEMPTS = 5;

/** 12 base64url characters (decision D7). */
export const newShareId = (): string => randomBytes(9).toString("base64url");

const isUniqueViolation = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";

/** The legacy flags every list/detail serializer already reads, now derived from the shares table. */
export type WithShareState<T> = Omit<T, "shareId" | "isPublic"> & { shareId: string | null; isPublic: boolean };

class ShareService {
  /** The one place a share URL is built. */
  urlFor(shareId: string): string {
    return `${env.webAppUrl}/s/${shareId}`;
  }

  /** Idempotent. Retries when a freshly generated id collides with an existing one. */
  async create(ownerId: string, type: ShareType, targetId: string) {
    for (let attempt = 1; ; attempt++) {
      try {
        const share = await shareRepository.createForOwnedTarget(ownerId, type, targetId, newShareId());
        if (!share) throw AppError.notFound("Item not found.");
        return share;
      } catch (error) {
        if (error instanceof AppError) throw error;
        if (isUniqueViolation(error) && attempt < MAX_ATTEMPTS) continue;
        throw error;
      }
    }
  }

  /** Idempotent: revoking an already revoked link succeeds; someone else's or unknown id is 404. */
  async revoke(ownerId: string, shareId: string): Promise<void> {
    const result = await shareRepository.revokeByOwner(shareId, ownerId);
    if (result.count === 0 && !(await shareRepository.existsForOwner(shareId, ownerId))) {
      throw AppError.notFound("Share not found.");
    }
    await layeredCache.del(publicShareCacheKey(shareId));
  }

  listForTarget(ownerId: string, type: ShareType, targetId: string) {
    return shareRepository.listActiveForTarget(ownerId, type, targetId);
  }

  /** targetId -> active shareId, for the caller's own items only. */
  async activeShareMap(ownerId: string, type: ShareType, targetIds: string[]): Promise<Map<string, string>> {
    if (targetIds.length === 0) return new Map();
    const rows = await shareRepository.findActiveShareIds(ownerId, type, targetIds);
    return new Map(rows.map((r) => [r.targetId, r.shareId]));
  }

  /** Overrides isPublic/shareId on rows with the unified share state. */
  async withShareState<T extends { id: string }>(ownerId: string, type: ShareType, rows: readonly T[]): Promise<WithShareState<T>[]> {
    const map = await this.activeShareMap(ownerId, type, rows.map((r) => r.id));
    return rows.map((row) => {
      const shareId = map.get(row.id) ?? null;
      return { ...row, shareId, isPublic: shareId !== null } as WithShareState<T>;
    });
  }

  /** The active (not revoked, not expired) share, or 404. */
  async resolve(shareId: string) {
    const share = await shareRepository.findActiveByShareId(shareId);
    if (!share) throw AppError.notFound("Share not found.");
    return share;
  }
}

export const shareService = new ShareService();
