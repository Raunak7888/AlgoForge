import { Request, Response } from "express";
import { Role } from "@algoforge/db";
import type { AlgorithmListResponse } from "@algoforge/contracts";
import { algorithmService } from "../services/algorithm/index";
import type { AlgorithmVisibility } from "../types/algorithm.types";
import { asyncHandler } from "../utils/async-handler";
import { ensureString } from "../validation/common";
import { parseCreateAlgorithm, parseUpdateAlgorithm, parseAlgorithmQuery } from "../validation/algorithm";

const ADMIN_VIEW: AlgorithmVisibility = { isAdmin: true };

function visibilityOf(req: Request): AlgorithmVisibility {
  return { isAdmin: req.auth?.user.role === Role.ADMIN };
}

class AlgorithmController {
  list = asyncHandler(async (req: Request, res: Response) => {
    const query = parseAlgorithmQuery(req.query);
    const algorithms = await algorithmService.listAlgorithms(query, visibilityOf(req));
    const body: AlgorithmListResponse = { data: algorithms };
    res.json(body);
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    const id = ensureString(req.params.id, "Algorithm ID is required.");
    const lang = typeof req.query.lang === "string" ? req.query.lang : undefined;
    const algorithm = await algorithmService.getAlgorithmById(id, lang, visibilityOf(req));
    res.json(algorithm);
  });

  getBySlug = asyncHandler(async (req: Request, res: Response) => {
    const slug = ensureString(req.params.slug, "Algorithm slug is required.");
    const lang = typeof req.query.lang === "string" ? req.query.lang : undefined;
    const algorithm = await algorithmService.getAlgorithmBySlug(slug, lang, visibilityOf(req));
    res.json(algorithm);
  });

  getVisualize = asyncHandler(async (req: Request, res: Response) => {
    const id = ensureString(req.params.id, "Algorithm ID is required.");
    const execution = await algorithmService.getAlgorithmExecution(id, visibilityOf(req));
    res.json(execution);
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    const input = parseCreateAlgorithm(req.body);
    const created = await algorithmService.createAlgorithm(input);
    res.status(201).json(created);
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const id = ensureString(req.params.id, "Algorithm ID is required.");
    const input = parseUpdateAlgorithm(req.body);
    const updated = await algorithmService.updateAlgorithm(id, input);
    res.status(200).json(updated);
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    const id = ensureString(req.params.id, "Algorithm ID is required.");
    await algorithmService.deleteAlgorithm(id);
    res.status(204).send();
  });
}

export const algorithmController = new AlgorithmController();
