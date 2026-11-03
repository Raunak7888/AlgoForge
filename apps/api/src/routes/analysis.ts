import { Router } from "express";
import { analysisController } from "../controllers/analysis.controller";
import { requireAuth } from "../middleware/auth";
import { requireCsrf } from "../middleware/csrf";
import { aiRateLimiter } from "../middleware/rate-limit";

const router = Router();

router.get("/", requireAuth, analysisController.listAnalyses);
router.get("/:id", requireAuth, analysisController.getAnalysisById);
router.post(
  "/",
  requireAuth,
  requireCsrf,
  aiRateLimiter("analysis"),
  analysisController.createAnalysis,
);
router.post(
  "/:id/share",
  requireAuth,
  requireCsrf,
  analysisController.shareAnalysis,
);

export default router;
