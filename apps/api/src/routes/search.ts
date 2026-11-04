import { Router } from "express";
import { searchController } from "../controllers/search.controller";
import { env } from "../config/env";
import { optionalAuth } from "../middleware/auth";
import { generalRateLimiter } from "../middleware/rate-limit";

const router = Router();

router.get(
  "/",
  optionalAuth,
  generalRateLimiter({ scope: "catalog", limitPerMinute: env.redis.catalogRateLimitPerMinute }),
  searchController.search,
);

export default router;
