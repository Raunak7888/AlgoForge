import { Request, Response } from "express";
import type { ExplainMessageListResponse, ExplainSessionListResponse, SendMessageResponse } from "@algoforge/contracts";
import { serializeMessage, serializeSessionDetail, serializeSessionSummary, serializeSharedSession } from "../serializers/explain";
import { explanationSessionService } from "../services/explanation-session.service";
import { asyncHandler } from "../utils/async-handler";
import { ensureString } from "../validation/common";
import {
  parseCreateSession,
  parseListMessagesQuery,
  parseListSessionsQuery,
  parseRenameSession,
  parseSendMessage,
} from "../validation/explanation-session";

class ExplanationSessionController {
  create = asyncHandler(async (req: Request, res: Response) => {
    const input = parseCreateSession(req.body);
    const session = await explanationSessionService.createSession(req.auth!.user.id, input);
    res.status(201).json(serializeSessionDetail(session, []));
  });

  list = asyncHandler(async (req: Request, res: Response) => {
    const query = parseListSessionsQuery(req.query);
    const { items, meta } = await explanationSessionService.listSessions(req.auth!.user.id, query);
    const body: ExplainSessionListResponse = { data: items.map(serializeSessionSummary), meta };
    res.json(body);
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    const id = ensureString(req.params.id, "Session id is required.");
    const { session, messages } = await explanationSessionService.getSession(req.auth!.user.id, id);
    res.json(serializeSessionDetail(session, messages));
  });

  listMessages = asyncHandler(async (req: Request, res: Response) => {
    const id = ensureString(req.params.id, "Session id is required.");
    const query = parseListMessagesQuery(req.query);
    const { items, meta } = await explanationSessionService.listMessages(req.auth!.user.id, id, query);
    const body: ExplainMessageListResponse = { data: items.map(serializeMessage), meta };
    res.json(body);
  });

  rename = asyncHandler(async (req: Request, res: Response) => {
    const id = ensureString(req.params.id, "Session id is required.");
    const { title } = parseRenameSession(req.body);
    const session = await explanationSessionService.renameSession(req.auth!.user.id, id, title);
    res.json(serializeSessionSummary(session));
  });

  sendMessage = asyncHandler(async (req: Request, res: Response) => {
    const id = ensureString(req.params.id, "Session id is required.");
    const input = parseSendMessage(req.body);
    // If the browser goes away mid-answer, stop paying for the provider call.
    const controller = new AbortController();
    res.on("close", () => {
      if (!res.writableFinished) controller.abort();
    });
    const exchange = await explanationSessionService.sendMessage(req.auth!.user.id, id, input, controller.signal);
    const body: SendMessageResponse = { userMessage: serializeMessage(exchange.userMessage), assistantMessage: serializeMessage(exchange.assistantMessage) };
    res.status(201).json(body);
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    const id = ensureString(req.params.id, "Session id is required.");
    await explanationSessionService.deleteSession(req.auth!.user.id, id);
    res.status(204).send();
  });

  share = asyncHandler(async (req: Request, res: Response) => {
    const id = ensureString(req.params.id, "Session id is required.");
    const result = await explanationSessionService.shareSession(req.auth!.user.id, id);
    res.json(result);
  });

  getPublic = asyncHandler(async (req: Request, res: Response) => {
    const shareId = ensureString(req.params.shareId, "Share id is required.");
    const session = await explanationSessionService.getPublicSession(shareId);
    res.json(serializeSharedSession(session));
  });
}

export const explanationSessionController = new ExplanationSessionController();
