import { Router } from "express";
import { explanationSessionController } from "../controllers/explanation-session.controller";
import { requireAuth } from "../middleware/auth";
import { requireCsrf } from "../middleware/csrf";

const router = Router();

// POST /:id/messages has no express-level AI limiter: the per-user quota (AiUsage + Redis, per minute and per day)
// is enforced in the service, where it can be released again when the provider fails.
router.get("/", requireAuth, explanationSessionController.list);
router.post("/", requireAuth, requireCsrf, explanationSessionController.create);
router.get("/:id", requireAuth, explanationSessionController.getById);
router.patch("/:id", requireAuth, requireCsrf, explanationSessionController.rename);
router.delete("/:id", requireAuth, requireCsrf, explanationSessionController.delete);
router.get("/:id/messages", requireAuth, explanationSessionController.listMessages);
router.post("/:id/messages", requireAuth, requireCsrf, explanationSessionController.sendMessage);
router.post("/:id/share", requireAuth, requireCsrf, explanationSessionController.share);

export default router;
