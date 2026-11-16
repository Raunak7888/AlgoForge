import { Router } from "express";
import { env } from "../config/env";
import { draftController as c } from "../controllers/draft.controller";
import { requireAuth } from "../middleware/auth";
import { requireCsrf } from "../middleware/csrf";
import { generalRateLimiter } from "../middleware/rate-limit";

const router = Router();
const limit = generalRateLimiter({ scope: "drafts", limitPerMinute: env.redis.draftRateLimitPerMinute });

router.get("/workspace", requireAuth, limit, c.get);
router.patch("/workspace", requireAuth, requireCsrf, limit, c.save);

export default router;
