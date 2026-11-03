//# filename: apps/api/src/services/admin.service.ts

import { Role } from "@algoforge/db";
import { userRepository } from "../repositories/user.repository";
import { AppError } from "../utils/app-error";

class AdminService {
  /**
   * Promotes userId to ADMIN.
   * Role is always hardcoded here, it is never accepted from the request body.
   */
  async upgradeToAdmin(userId: string) {
    const user = await userRepository.findById(userId);
    if (!user) throw AppError.notFound("User not found.");

    if (user.role === Role.ADMIN) {
      return { user, changed: false };
    }

    const updated = await userRepository.setRole(userId, Role.ADMIN);
    return { user: updated, changed: true };
  }

  /**
   * Demotes userId to USER.
   * Role is always hardcoded here, it is never accepted from the request body.
   */
  async downgradeToUser(userId: string) {
    const user = await userRepository.findById(userId);
    if (!user) throw AppError.notFound("User not found.");

    if (user.role === Role.USER) {
      return { user, changed: false };
    }

    const updated = await userRepository.setRole(userId, Role.USER);
    return { user: updated, changed: true };
  }

  async listUsers(limit: number, cursor?: string) {
    const rows = await userRepository.findPage({ take: limit + 1, cursor });
    const hasMore = rows.length > limit;
    const users = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? users[users.length - 1].id : null;
    return { users, nextCursor };
  }
}

export const adminService = new AdminService();
