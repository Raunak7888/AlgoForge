import { Request, Response } from "express";
import { explanationSessionService } from "../services/explanation-session.service";
import { asyncHandler } from "../utils/async-handler";
import {
  parseCreateSession,
  parseSendMessage,
  parseListSessionsQuery,
} from "../validation/explanation-session";
import { ensureString } from "../validation/common";

class ExplanationSessionController {
  create = asyncHandler(async (req: Request, res: Response) => {
    const input   = parseCreateSession(req.body);
    const session = await explanationSessionService.createSession(req.auth!.user.id, input);
    res.status(201).json(session);
  });

  list = asyncHandler(async (req: Request, res: Response) => {
    const query  = parseListSessionsQuery(req.query);
    const result = await explanationSessionService.listSessions(req.auth!.user.id, query);
    res.json(result);
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    const id      = ensureString(req.params.id, "Session id is required.");
    const session = await explanationSessionService.getSession(req.auth!.user.id, id);
    res.json(session);
  });

  sendMessage = asyncHandler(async (req: Request, res: Response) => {
    const id     = ensureString(req.params.id, "Session id is required.");
    const input  = parseSendMessage(req.body);
    const result = await explanationSessionService.sendMessage(req.auth!.user.id, id, input);
    res.status(201).json(result);
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    const id = ensureString(req.params.id, "Session id is required.");
    await explanationSessionService.deleteSession(req.auth!.user.id, id);
    res.status(204).send();
  });

  share = asyncHandler(async (req: Request, res: Response) => {
    const id     = ensureString(req.params.id, "Session id is required.");
    const result = await explanationSessionService.shareSession(req.auth!.user.id, id);
    res.json(result);
  });

  getPublic = asyncHandler(async (req: Request, res: Response) => {
    const shareId = ensureString(req.params.shareId, "Share id is required.");
    const session = await explanationSessionService.getPublicSession(shareId);
    res.json(session);
  });
}

export const explanationSessionController = new ExplanationSessionController();