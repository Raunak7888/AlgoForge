import type { ErrorCode, ErrorDetail, QuotaInfo } from "@algoforge/contracts";

export interface ErrorExtras {
  retryAfterSeconds?: number;
  quota?: QuotaInfo;
}

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code: ErrorCode,
    public readonly details?: readonly ErrorDetail[],
    public readonly extras?: ErrorExtras,
  ) {
    super(message);
    this.name = "AppError";
    Object.setPrototypeOf(this, new.target.prototype);
  }

  static badRequest(message: string, details?: readonly ErrorDetail[]): AppError {
    return new AppError(400, message, "BAD_REQUEST", details);
  }

  static unauthorized(message: string): AppError {
    return new AppError(401, message, "UNAUTHORIZED");
  }

  static forbidden(message: string): AppError {
    return new AppError(403, message, "FORBIDDEN");
  }

  static notFound(message: string): AppError {
    return new AppError(404, message, "NOT_FOUND");
  }

  static conflict(message: string): AppError {
    return new AppError(409, message, "CONFLICT");
  }

  static payloadTooLarge(message: string): AppError {
    return new AppError(413, message, "PAYLOAD_TOO_LARGE");
  }

  static tooManyRequests(message: string): AppError {
    return new AppError(429, message, "TOO_MANY_REQUESTS");
  }

  static quotaExceeded(message: string, quota: QuotaInfo, retryAfterSeconds: number): AppError {
    return new AppError(429, message, "QUOTA_EXCEEDED", undefined, { quota, retryAfterSeconds });
  }

  static badGateway(message: string): AppError {
    return new AppError(502, message, "BAD_GATEWAY");
  }

  static aiUnavailable(message = "The AI provider is currently unavailable."): AppError {
    return new AppError(503, message, "AI_PROVIDER_UNAVAILABLE", undefined, { retryAfterSeconds: 30 });
  }

  static aiTimeout(message = "The AI provider took too long to answer."): AppError {
    return new AppError(504, message, "AI_PROVIDER_TIMEOUT");
  }

  static aiInvalidOutput(message = "The AI provider returned an unusable answer."): AppError {
    return new AppError(502, message, "AI_INVALID_OUTPUT");
  }

  static internal(message: string): AppError {
    return new AppError(500, message, "INTERNAL_ERROR");
  }
}
