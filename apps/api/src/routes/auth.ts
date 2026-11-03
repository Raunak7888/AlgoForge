import { Router } from "express";
import { authController } from "../controllers/auth.controller";
import { requireAuth } from "../middleware/auth";
import { requireCsrf } from "../middleware/csrf";

const router = Router();

router.get("/google/start", authController.startGoogleAuth);
router.get("/google/callback", authController.handleGoogleCallback);
router.get("/me", requireAuth, authController.getMe);

// No CSRF token on refresh by design: the refresh cookie is httpOnly, scoped to
// /api/auth and SameSite=Lax, the endpoint only rotates the caller's own session,
// and it returns no cross-origin-readable secret. Do not weaken those cookie flags.
router.post("/refresh", authController.refreshSession);

router.post("/logout", requireCsrf, authController.logout);
router.post("/logout-all", requireAuth, requireCsrf, authController.logoutAll);

export default router;
