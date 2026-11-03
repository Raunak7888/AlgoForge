//# filename: apps/api/src/controllers/admin.controller.ts

import { Request, Response } from "express";
import { adminService } from "../services/admin.service";
import { asyncHandler } from "../utils/async-handler";
import { AppError } from "../utils/app-error";

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

function parseLimit(value: unknown): number {
  if (value === undefined) return DEFAULT_PAGE_SIZE;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > MAX_PAGE_SIZE) {
    throw AppError.badRequest(`limit must be an integer between 1 and ${MAX_PAGE_SIZE}.`);
  }
  return n;
}

class AdminController {
  /**
   * POST /api/admin/upgrade-user
   * Body: { userId: string }
   * Role is always hardcoded server-side. Never read from body.
   */
  upgradeUser = asyncHandler(async (req: Request, res: Response) => {
    const { userId } = req.body as { userId?: unknown };
    if (typeof userId !== "string" || !userId.trim()) {
      throw AppError.badRequest("userId is required.");
    }
    const result = await adminService.upgradeToAdmin(userId.trim());
    res.json({
      changed: result.changed,
      user: {
        id: result.user.id,
        email: result.user.email,
        role: result.user.role,
      },
    });
  });

  /**
   * POST /api/admin/downgrade-user
   * Body: { userId: string }
   */
  downgradeUser = asyncHandler(async (req: Request, res: Response) => {
    const { userId } = req.body as { userId?: unknown };
    if (typeof userId !== "string" || !userId.trim()) {
      throw AppError.badRequest("userId is required.");
    }
    const result = await adminService.downgradeToUser(userId.trim());
    res.json({
      changed: result.changed,
      user: {
        id: result.user.id,
        email: result.user.email,
        role: result.user.role,
      },
    });
  });

  /** GET /api/admin/users?limit=50&cursor=<userId> */
  listUsers = asyncHandler(async (req: Request, res: Response) => {
    const limit = parseLimit(req.query.limit);
    const cursor =
      typeof req.query.cursor === "string" && req.query.cursor.trim()
        ? req.query.cursor.trim()
        : undefined;
    const result = await adminService.listUsers(limit, cursor);
    res.json(result);
  });
}

export const adminController = new AdminController();
