//# filename: apps/api/src/routes/admin.ts

import { Router } from "express";
import { Role } from "@algoforge/db";
import { adminController } from "../controllers/admin.controller";
import { requireAuth, requireRoles } from "../middleware/auth";
import { requireCsrf } from "../middleware/csrf";

const router = Router();

// Admin access requires a signed-in ADMIN user. There is no secret-header path.
// Bootstrap the first admin with: pnpm db:make-admin <email>
// Role is never accepted from any request body: it is hardcoded per endpoint.

router.get("/users", requireAuth, requireRoles(Role.ADMIN), adminController.listUsers);

router.post(
  "/upgrade-user",
  requireAuth,
  requireRoles(Role.ADMIN),
  requireCsrf,
  adminController.upgradeUser,
);

router.post(
  "/downgrade-user",
  requireAuth,
  requireRoles(Role.ADMIN),
  requireCsrf,
  adminController.downgradeUser,
);

export default router;
