import { Router } from "express";
import { env } from "../config/env";
import { shareController as c } from "../controllers/share.controller";
import { requireAuth } from "../middleware/auth";
import { requireCsrf } from "../middleware/csrf";
import { generalRateLimiter } from "../middleware/rate-limit";

const router = Router();
const limit = generalRateLimiter({ scope: "shares", limitPerMinute: env.redis.shareRateLimitPerMinute });

router.get("/", requireAuth, limit, c.list);
router.post("/", requireAuth, requireCsrf, limit, c.create);
router.delete("/:shareId", requireAuth, requireCsrf, limit, c.revoke);

export default router;
