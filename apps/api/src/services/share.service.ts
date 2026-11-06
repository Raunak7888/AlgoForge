import { randomBytes } from "crypto";
import { Prisma, type ShareType } from "@algoforge/db";
import { shareRepository } from "../repositories/share.repository";
import { AppError } from "../utils/app-error";

const MAX_ATTEMPTS = 5;

/** 12 base64url characters, the format the unified share id uses (decision D7). */
export const newShareId = (): string => randomBytes(9).toString("base64url");

const isUniqueViolation = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";

/**
 * Data access for the shares table. No HTTP routes and no cache purging yet (Phase 9).
 * Callers always pass the acting user as `ownerId`; the repository checks ownership inside its transaction.
 */
class ShareService {
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

  async revoke(ownerId: string, shareId: string): Promise<void> {
    const result = await shareRepository.revokeByOwner(shareId, ownerId);
    if (result.count === 0) throw AppError.notFound("Share not found.");
  }

  /** The active (not revoked, not expired) share, or 404. */
  async resolve(shareId: string) {
    const share = await shareRepository.findActiveByShareId(shareId);
    if (!share) throw AppError.notFound("Share not found.");
    return share;
  }
}

export const shareService = new ShareService();
