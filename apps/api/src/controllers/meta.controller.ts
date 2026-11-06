import { Request, Response } from "express";
import type { CapabilitiesResponse } from "@algoforge/contracts";
import { capabilitiesService } from "../services/capabilities.service";
import { asyncHandler } from "../utils/async-handler";

class MetaController {
  /** GET /api/meta/capabilities. Public and cheap: depends only on server configuration. */
  capabilities = asyncHandler(async (_req: Request, res: Response) => {
    const body: CapabilitiesResponse = capabilitiesService.get();
    res.setHeader("Cache-Control", "public, max-age=30");
    res.json(body);
  });
}

export const metaController = new MetaController();
