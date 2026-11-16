import { Request, Response } from "express";
import type { WorkspaceDraftResponse } from "@algoforge/contracts";
import { draftService } from "../services/draft.service";
import { asyncHandler } from "../utils/async-handler";
import { parseSaveDraft } from "../validation/draft";

class DraftController {
  get = asyncHandler(async (req: Request, res: Response) => {
    const body: WorkspaceDraftResponse = { draft: await draftService.get(req.auth!.user.id) };
    res.setHeader("Cache-Control", "no-store");
    res.json(body);
  });

  save = asyncHandler(async (req: Request, res: Response) => {
    const result = await draftService.save(req.auth!.user.id, parseSaveDraft(req.body));
    res.setHeader("Cache-Control", "no-store");
    res.json(result);
  });
}

export const draftController = new DraftController();
