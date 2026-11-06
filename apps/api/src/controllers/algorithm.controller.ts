import { Request, Response } from "express";
import { Role } from "@algoforge/db";
import type { AlgorithmListResponse } from "@algoforge/contracts";
import { algorithmService } from "../services/algorithm/index";
import { AUDIT_ACTIONS, auditService } from "../services/audit.service";
import type { AlgorithmVisibility } from "../types/algorithm.types";
import { asyncHandler } from "../utils/async-handler";
import { ensureString } from "../validation/common";
import { parseCreateAlgorithm, parseUpdateAlgorithm, parseAlgorithmQuery } from "../validation/algorithm";

function visibilityOf(req: Request): AlgorithmVisibility {
  return { isAdmin: req.auth?.user.role === Role.ADMIN };
}

class AlgorithmController {
  list = asyncHandler(async (req: Request, res: Response) => {
    const query = parseAlgorithmQuery(req.query);
    const page = await algorithmService.listAlgorithms(query, visibilityOf(req));
    const body: AlgorithmListResponse = { data: page.items, meta: page.meta };
    res.json(body);
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    const id = ensureString(req.params.id, "Algorithm ID is required.");
    const lang = typeof req.query.lang === "string" ? req.query.lang : undefined;
    res.json(await algorithmService.getAlgorithmById(id, lang, visibilityOf(req)));
  });

  getBySlug = asyncHandler(async (req: Request, res: Response) => {
    const slug = ensureString(req.params.slug, "Algorithm slug is required.");
    const lang = typeof req.query.lang === "string" ? req.query.lang : undefined;
    res.json(await algorithmService.getAlgorithmBySlug(slug, lang, visibilityOf(req)));
  });

  getVisualize = asyncHandler(async (req: Request, res: Response) => {
    const id = ensureString(req.params.id, "Algorithm ID is required.");
    res.json(await algorithmService.getAlgorithmExecution(id, visibilityOf(req)));
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    const input = parseCreateAlgorithm(req.body);
    const created = await algorithmService.createAlgorithm(input, req.auth?.user.id);
    await auditService.recordFromRequest(req, AUDIT_ACTIONS.ALGORITHM_CREATE, { type: "algorithm", id: created.id }, { slug: input.slug });
    res.status(201).json(created);
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const id = ensureString(req.params.id, "Algorithm ID is required.");
    const input = parseUpdateAlgorithm(req.body);
    const updated = await algorithmService.updateAlgorithm(id, input);
    await auditService.recordFromRequest(req, AUDIT_ACTIONS.ALGORITHM_UPDATE, { type: "algorithm", id }, { fields: Object.keys(input) });
    res.status(200).json(updated);
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    const id = ensureString(req.params.id, "Algorithm ID is required.");
    await algorithmService.deleteAlgorithm(id);
    await auditService.recordFromRequest(req, AUDIT_ACTIONS.ALGORITHM_DELETE, { type: "algorithm", id });
    res.status(204).send();
  });
}

export const algorithmController = new AlgorithmController();
