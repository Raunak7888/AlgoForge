//# filename: apps/api/src/controllers/admin.controller.ts

import { Request, Response } from "express";
import { LIMITS, type AdminRoleChangeResponse, type AdminUserListResponse } from "@algoforge/contracts";
import { serializeAdminUser } from "../serializers/admin";
import { adminService } from "../services/admin.service";
import { AUDIT_ACTIONS, auditService } from "../services/audit.service";
import { asyncHandler } from "../utils/async-handler";
import { AppError } from "../utils/app-error";

const { defaultSize: DEFAULT_PAGE_SIZE, maxSize: MAX_PAGE_SIZE } = LIMITS.pagination.adminUsers;

function parseLimit(value: unknown): number {
  if (value === undefined) return DEFAULT_PAGE_SIZE;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > MAX_PAGE_SIZE) {
    throw AppError.badRequest(`limit must be an integer between 1 and ${MAX_PAGE_SIZE}.`);
  }
  return n;
}

function readUserId(body: unknown): string {
  const { userId } = (body ?? {}) as { userId?: unknown };
  if (typeof userId !== "string" || !userId.trim()) throw AppError.badRequest("userId is required.");
  return userId.trim();
}

class AdminController {
  /** POST /api/admin/upgrade-user. The role is hard-coded server-side, never read from the body. */
  upgradeUser = asyncHandler(async (req: Request, res: Response) => {
    const result = await adminService.upgradeToAdmin(readUserId(req.body));
    if (result.changed) await auditService.recordFromRequest(req, AUDIT_ACTIONS.USER_UPGRADE, { type: "user", id: result.user.id }, { newRole: "ADMIN" });
    const body: AdminRoleChangeResponse = {
      changed: result.changed,
      user: { id: result.user.id, email: result.user.email, role: result.user.role },
    };
    res.json(body);
  });

  /** POST /api/admin/downgrade-user */
  downgradeUser = asyncHandler(async (req: Request, res: Response) => {
    const result = await adminService.downgradeToUser(readUserId(req.body));
    if (result.changed) await auditService.recordFromRequest(req, AUDIT_ACTIONS.USER_DOWNGRADE, { type: "user", id: result.user.id }, { newRole: "USER" });
    const body: AdminRoleChangeResponse = {
      changed: result.changed,
      user: { id: result.user.id, email: result.user.email, role: result.user.role },
    };
    res.json(body);
  });

  /** GET /api/admin/users?limit=50&cursor=<userId> */
  listUsers = asyncHandler(async (req: Request, res: Response) => {
    const limit = parseLimit(req.query.limit);
    const cursor = typeof req.query.cursor === "string" && req.query.cursor.trim() ? req.query.cursor.trim() : undefined;
    const { items, meta } = await adminService.listUsers(limit, cursor);
    const body: AdminUserListResponse = { data: items.map(serializeAdminUser), meta };
    res.json(body);
  });
}

export const adminController = new AdminController();
