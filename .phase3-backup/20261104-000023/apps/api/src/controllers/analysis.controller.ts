import { Request, Response } from "express";
import { analysisService } from "../services/analysis.service";
import { asyncHandler } from "../utils/async-handler";
import { ensureString } from "../validation/common";
import { parseAnalysisHistoryQuery, parseAnalysisInput } from "../validation/analysis";

class AnalysisController {
  createAnalysis = asyncHandler(async (req: Request, res: Response) => {
    const input    = parseAnalysisInput(req.body);
    const analysis = await analysisService.createAnalysis(req.auth!.user.id, input);
    res.status(201).json(analysis);
  });

  listAnalyses = asyncHandler(async (req: Request, res: Response) => {
    const query    = parseAnalysisHistoryQuery(req.query);
    const analyses = await analysisService.listUserAnalyses(req.auth!.user.id, query);
    res.json(analyses);
  });

  getAnalysisById = asyncHandler(async (req: Request, res: Response) => {
    const id       = ensureString(req.params.id, "Analysis id is required.");
    const analysis = await analysisService.getUserAnalysisById(req.auth!.user.id, id);
    res.json(analysis);
  });

  shareAnalysis = asyncHandler(async (req: Request, res: Response) => {
    const id     = ensureString(req.params.id, "Analysis id is required.");
    const result = await analysisService.shareAnalysis(req.auth!.user.id, id);
    res.json(result);
  });

  getPublicAnalysis = asyncHandler(async (req: Request, res: Response) => {
    const shareId = ensureString(req.params.shareId, "Share id is required.");
    const result  = await analysisService.getPublicAnalysis(shareId);
    res.json(result);
  });
}

export const analysisController = new AnalysisController();