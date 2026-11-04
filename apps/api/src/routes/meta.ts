import { Router } from "express";
import { metaController } from "../controllers/meta.controller";

const router = Router();

router.get("/capabilities", metaController.capabilities);

export default router;
