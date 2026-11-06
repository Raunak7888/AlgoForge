import { Request, Response } from "express";
import type { AnalysisHistoryResponse, AnalysisQuotaResponse } from "@algoforge/contracts";
import { serializeAnalysisRecord, serializeHistoryItem } from "../serializers/analysis";
import { analysisService } from "../services/analysis.service";
import { asyncHandler } from "../utils/async-handler";
import { ensureString } from "../validation/common";
import { parseAnalysisHistoryQuery, parseAnalysisInput } from "../validation/analysis";

class AnalysisController {
  createAnalysis = asyncHandler(async (req: Request, res: Response) => {
    const input = parseAnalysisInput(req.body);
    const analysis = await analysisService.createAnalysis(req.auth!.user.id, input);
    res.status(201).json(serializeAnalysisRecord(analysis));
  });

  listAnalyses = asyncHandler(async (req: Request, res: Response) => {
    const query = parseAnalysisHistoryQuery(req.query);
    const { items, meta } = await analysisService.listUserAnalyses(req.auth!.user.id, query);
    const data = items.flatMap((row) => {
      const item = serializeHistoryItem(row);
      return item ? [item] : [];
    });
    const body: AnalysisHistoryResponse = { data, meta };
    res.json(body);
  });

  getAnalysisById = asyncHandler(async (req: Request, res: Response) => {
    const id = ensureString(req.params.id, "Analysis id is required.");
    const analysis = await analysisService.getUserAnalysisById(req.auth!.user.id, id);
    res.json(serializeAnalysisRecord(analysis));
  });

  deleteAnalysis = asyncHandler(async (req: Request, res: Response) => {
    const id = ensureString(req.params.id, "Analysis id is required.");
    await analysisService.deleteAnalysis(req.auth!.user.id, id);
    res.status(204).send();
  });

  getQuota = asyncHandler(async (req: Request, res: Response) => {
    const body: AnalysisQuotaResponse = await analysisService.getQuota(req.auth!.user.id);
    res.setHeader("Cache-Control", "no-store");
    res.json(body);
  });

  shareAnalysis = asyncHandler(async (req: Request, res: Response) => {
    const id = ensureString(req.params.id, "Analysis id is required.");
    const result = await analysisService.shareAnalysis(req.auth!.user.id, id);
    res.json(result);
  });

  getPublicAnalysis = asyncHandler(async (req: Request, res: Response) => {
    const shareId = ensureString(req.params.shareId, "Share id is required.");
    const result = await analysisService.getPublicAnalysis(shareId);
    res.json(result);
  });
}

export const analysisController = new AnalysisController();
