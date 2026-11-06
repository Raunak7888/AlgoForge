import { Router } from "express";
import { analysisController } from "../controllers/analysis.controller";
import { requireAuth } from "../middleware/auth";
import { requireCsrf } from "../middleware/csrf";

const router = Router();

// "/quota" is declared before "/:id" so it is never read as an id.
// POST has no express-level AI limiter: the per-user quota is enforced in the service,
// where cache hits (which cost nothing) can be told apart from billable calls.
router.get("/", requireAuth, analysisController.listAnalyses);
router.get("/quota", requireAuth, analysisController.getQuota);
router.get("/:id", requireAuth, analysisController.getAnalysisById);
router.post("/", requireAuth, requireCsrf, analysisController.createAnalysis);
router.post("/:id/share", requireAuth, requireCsrf, analysisController.shareAnalysis);
router.delete("/:id", requireAuth, requireCsrf, analysisController.deleteAnalysis);

export default router;
