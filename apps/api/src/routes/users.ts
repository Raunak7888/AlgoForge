import { Router } from "express";
import { userController } from "../controllers/user.controller";
import { requireAuth } from "../middleware/auth";
import { requireCsrf } from "../middleware/csrf";
import { generalRateLimiter } from "../middleware/rate-limit";

const router = Router();

router.patch("/me", requireAuth, requireCsrf, generalRateLimiter(), userController.updateMe);
router.delete("/me", requireAuth, requireCsrf, generalRateLimiter(), userController.deleteMe);

export default router;
