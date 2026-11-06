import { NextFunction, Request, Response } from "express";
import type { ErrorCode, ErrorDetail, ErrorResponse } from "@algoforge/contracts";
import { Prisma } from "@algoforge/db";
import { AppError, type ErrorExtras } from "../utils/app-error";
import { logger, serializeError } from "../utils/logger";

type LogLevel = "none" | "warn" | "error";

interface MappedError {
  statusCode: number;
  code: ErrorCode;
  message: string;
  details?: readonly ErrorDetail[];
  extras?: ErrorExtras;
  level: LogLevel;
}

function bodyParserType(err: unknown): string | undefined {
  if (typeof err === "object" && err !== null && "type" in err) {
    const t = (err as { type: unknown }).type;
    return typeof t === "string" ? t : undefined;
  }
  return undefined;
}

function mapError(err: unknown): MappedError {
  if (err instanceof AppError) {
    const provider = err.code.startsWith("AI_");
    return {
      statusCode: err.statusCode,
      code: err.code,
      message: err.message,
      details: err.details,
      extras: err.extras,
      level: err.statusCode >= 500 ? (provider ? "warn" : "error") : "none",
    };
  }

  const parserType = bodyParserType(err);
  if (parserType === "entity.parse.failed") {
    return { statusCode: 400, code: "BAD_REQUEST", message: "Malformed JSON body.", level: "none" };
  }
  if (parserType === "entity.too.large") {
    return { statusCode: 413, code: "PAYLOAD_TOO_LARGE", message: "Request body is too large.", level: "none" };
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      return { statusCode: 409, code: "CONFLICT", message: "A resource with these values already exists.", level: "warn" };
    }
    if (err.code === "P2025") {
      return { statusCode: 404, code: "NOT_FOUND", message: "Resource not found.", level: "warn" };
    }
  }

  return { statusCode: 500, code: "INTERNAL_ERROR", message: "An unexpected error occurred.", level: "error" };
}

export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction): void {
  if (res.headersSent) {
    next(err);
    return;
  }

  const mapped = mapError(err);

  if (mapped.level !== "none") {
    const fields = {
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl.split("?")[0],
      userId: req.auth?.user.id,
      status: mapped.statusCode,
      ...serializeError(err),
    };
    if (mapped.level === "error") logger.error("request failed", fields);
    else logger.warn("request failed", fields);
  }

  const retryAfter = mapped.extras?.retryAfterSeconds;
  if (retryAfter !== undefined) res.setHeader("Retry-After", String(retryAfter));

  const body: ErrorResponse = {
    error: {
      code: mapped.code,
      message: mapped.message,
      ...(mapped.details && mapped.details.length > 0 ? { details: [...mapped.details] } : {}),
      ...(retryAfter !== undefined ? { retryAfterSeconds: retryAfter } : {}),
      ...(mapped.extras?.quota ? { quota: mapped.extras.quota } : {}),
    },
  };
  res.status(mapped.statusCode).json(body);
}
