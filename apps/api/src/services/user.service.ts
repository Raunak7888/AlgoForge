//# filename: apps/api/src/services/user.service.ts

import { type SafeUser } from "@algoforge/analysis";
import type { AuthUser, UpdateProfileRequest } from "@algoforge/contracts";
import { Prisma, Role } from "@algoforge/db";
import { userRepository } from "../repositories/user.repository";
import { verifyAccessToken } from "../utils/token";
import { sessionRepository } from "../repositories/session.repository";
import { AppError } from "../utils/app-error";
import { layeredCache } from "./lib/layered-cache";
import { publicShareCacheKey } from "./lib/share-cache";

/** Names that would be confusing or impersonating if a person could claim them. */
const RESERVED_USERNAMES: ReadonlySet<string> = new Set([
  "admin", "administrator", "root", "support", "system", "api", "algoforge", "me", "null", "undefined", "staff",
]);

class UserService {
  async getUserById(userId: string): Promise<SafeUser | null> {
    const user = await userRepository.findPublicById(userId);
    if (!user) return null;
    return {
      id: user.id,
      name: user.name,
      username: user.username ?? user.name,
      avatarUrl: user.image,
    };
  }

  async getUserByToken(token: string): Promise<SafeUser | null> {
    try {
      const payload = verifyAccessToken(token);
      const session = await sessionRepository.findActiveById(
        payload.sessionId,
        payload.sub,
      );
      if (!session) return null;
      return this.getUserById(payload.sub);
    } catch {
      return null;
    }
  }

  /** The full signed-in user: id, email, name, username, image and role. */
  async getAuthUser(userId: string): Promise<AuthUser | null> {
    return userRepository.findById(userId);
  }

  async updateProfile(userId: string, input: UpdateProfileRequest): Promise<AuthUser> {
    const data: { name?: string; username?: string } = {};
    if (input.name !== undefined) data.name = input.name;

    if (input.username !== undefined) {
      if (RESERVED_USERNAMES.has(input.username)) throw AppError.badRequest("That username is reserved.");
      const taken = await userRepository.findByUsername(input.username);
      if (taken && taken.id !== userId) throw AppError.conflict("That username is already taken.");
      data.username = input.username;
    }

    try {
      return await userRepository.updateNameAndUsername(userId, data);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2002") throw AppError.conflict("That username is already taken.");
        if (error.code === "P2025") throw AppError.notFound("User not found.");
      }
      throw error;
    }
  }

  /**
   * Deletes the account. The database cascades to accounts, sessions, analyses and chat sessions.
   * The last remaining admin cannot delete themselves, so the app is never left without one.
   */
  async deleteAccount(userId: string): Promise<void> {
    const user = await userRepository.findById(userId);
    if (!user) throw AppError.notFound("User not found.");

    if (user.role === Role.ADMIN && (await userRepository.countAdmins()) <= 1) {
      throw AppError.conflict("You are the only admin. Promote another admin before deleting this account.");
    }

    const shared = await userRepository.listShareIds(userId);
    await userRepository.deleteById(userId);

    // Shared chat links must stop working at once, not when their cache entry expires.
    await Promise.all(
      shared.map((row) => layeredCache.del(publicShareCacheKey(row.shareId))),
    );
  }
}

export const userService = new UserService();
