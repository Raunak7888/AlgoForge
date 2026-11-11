import { Request, Response } from "express";
import type { GenerateVisualizationResponse, ValidateScriptResponse, VisualizationListResponse } from "@algoforge/contracts";
import { visualizationGenerateService } from "../services/visualization-generate.service";
import { serializeVisualization, serializeVisualizationSummary } from "../serializers/visualization";
import { checkScript } from "../services/script.service";
import { visualizationService } from "../services/visualization.service";
import { asyncHandler } from "../utils/async-handler";
import {
  parseCreateVisualization,
  parseGenerateVisualization,
  parseListVisualizationsQuery,
  parseUpdateVisualization,
  parseValidateScript,
  parseVisualizationId,
} from "../validation/visualization";

/** Every handler passes req.auth.user.id into the service, so ownership is part of every query. */
class VisualizationController {
  list = asyncHandler(async (req: Request, res: Response) => {
    const query = parseListVisualizationsQuery(req.query);
    const { items, meta } = await visualizationService.list(req.auth!.user.id, query);
    const body: VisualizationListResponse = { data: items.map(serializeVisualizationSummary), meta };
    res.json(body);
  });

  get = asyncHandler(async (req: Request, res: Response) => {
    const id = parseVisualizationId(req.params.id);
    res.json(serializeVisualization(await visualizationService.get(req.auth!.user.id, id)));
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    const input = parseCreateVisualization(req.body);
    const row = await visualizationService.createFromRequest(req.auth!.user.id, input);
    res.status(201).json(serializeVisualization(row));
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const id = parseVisualizationId(req.params.id);
    const input = parseUpdateVisualization(req.body);
    const row = await visualizationService.updateFromRequest(req.auth!.user.id, id, input);
    res.json(serializeVisualization(row));
  });

  remove = asyncHandler(async (req: Request, res: Response) => {
    const id = parseVisualizationId(req.params.id);
    await visualizationService.remove(req.auth!.user.id, id);
    res.status(204).send();
  });

  generate = asyncHandler(async (req: Request, res: Response) => {
    const input = parseGenerateVisualization(req.body);
    // If the browser goes away mid-generation, stop paying for the provider call.
    const controller = new AbortController();
    res.on("close", () => {
      if (!res.writableFinished) controller.abort();
    });
    const body: GenerateVisualizationResponse = await visualizationGenerateService.generate(req.auth!.user.id, input, controller.signal);
    res.setHeader("Cache-Control", "no-store");
    res.json(body);
  });

  validate = asyncHandler(async (req: Request, res: Response) => {
    const analysis = checkScript(parseValidateScript(req.body));
    const body: ValidateScriptResponse = {
      ok: analysis.ok,
      stepCount: analysis.stepCount,
      structures: analysis.structures,
      diagnostics: analysis.diagnostics,
    };
    res.json(body);
  });
}

export const visualizationController = new VisualizationController();
