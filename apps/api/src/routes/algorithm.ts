//# filename: apps/api/src/routes/algorithm.ts

import { Router } from "express";
import { Role } from "@algoforge/db";
import { algorithmController } from "../controllers/algorithm.controller";
import { optionalAuth, requireAuth, requireRoles } from "../middleware/auth";
import { requireCsrf } from "../middleware/csrf";
import { validateIdParam, validateSlugParam } from "../validation/algorithm";

const router = Router();

// Public reads: anonymous callers only ever see published algorithms.
// optionalAuth lets admins see drafts. Optional ?lang=javascript|python query param.
router.get("/", optionalAuth, algorithmController.list);
router.get("/slug/:slug", optionalAuth, validateSlugParam, algorithmController.getBySlug);
router.get("/id/:id/visualize", optionalAuth, validateIdParam, algorithmController.getVisualize);
router.get("/id/:id", optionalAuth, validateIdParam, algorithmController.getById);

// Admin writes
router.post(
  "/",
  requireAuth,
  requireRoles(Role.ADMIN),
  requireCsrf,
  algorithmController.create,
);

router.patch(
  "/id/:id",
  requireAuth,
  requireRoles(Role.ADMIN),
  requireCsrf,
  validateIdParam,
  algorithmController.update,
);

router.delete(
  "/id/:id",
  requireAuth,
  requireRoles(Role.ADMIN),
  requireCsrf,
  validateIdParam,
  algorithmController.delete,
);

export default router;
