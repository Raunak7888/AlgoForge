import { Router } from "express";
import { visualizationController as c } from "../controllers/visualization.controller";
import { env } from "../config/env";
import { requireAuth } from "../middleware/auth";
import { requireCsrf } from "../middleware/csrf";
import { generalRateLimiter } from "../middleware/rate-limit";

const router = Router();
const limit = generalRateLimiter({ scope: "viz", limitPerMinute: env.redis.visualizationRateLimitPerMinute });

// "/validate" is declared before "/:id" so it is never read as an id.
router.get("/", requireAuth, limit, c.list);
router.post("/validate", requireAuth, requireCsrf, limit, c.validate);
router.post("/generate", requireAuth, requireCsrf, limit, c.generate);
router.post("/", requireAuth, requireCsrf, limit, c.create);
router.get("/:id", requireAuth, limit, c.get);
router.patch("/:id", requireAuth, requireCsrf, limit, c.update);
router.delete("/:id", requireAuth, requireCsrf, limit, c.remove);

export default router;
