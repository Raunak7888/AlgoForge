import { Router } from "express";
import { env } from "../config/env";
import { publicShareController as c } from "../controllers/share.controller";
import { generalRateLimiter } from "../middleware/rate-limit";

const router = Router();
const limit = generalRateLimiter({ scope: "share-public", limitPerMinute: env.redis.publicShareRateLimitPerMinute });

// Deprecated aliases: same resolver, data only.
router.get("/analysis/:shareId", limit, c.resolveAnalysis);
router.get("/explain/:shareId", limit, c.resolveExplain);
// Unified resolver: { type, data, creator }.
router.get("/:shareId", limit, c.resolve);

export default router;
