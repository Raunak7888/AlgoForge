import { Router } from "express";
import { buildOpenApiDocument, type OpenApiDocument } from "@algoforge/contracts";

const router = Router();
let cached: OpenApiDocument | null = null;

/** Mounted by app.ts only outside production. The document is built once from the shared contracts. */
router.get("/openapi.json", (req, res) => {
  cached ??= buildOpenApiDocument({ serverUrl: `${req.protocol}://${req.get("host") ?? "localhost"}` });
  res.json(cached);
});

export default router;
