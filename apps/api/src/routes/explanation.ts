import { Router } from "express";
import { explanationController } from "../controllers/explanation.controller";
import { requireAuth } from "../middleware/auth";
import { requireCsrf } from "../middleware/csrf";
import { aiRateLimiter } from "../middleware/rate-limit";

const router = Router();

router.post(
  "/",
  requireAuth,
  requireCsrf,
  aiRateLimiter("explain"),
  explanationController.explain,
);

export default router;