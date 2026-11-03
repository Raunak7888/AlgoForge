export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = "AppError";
    Object.setPrototypeOf(this, new.target.prototype);
  }

  static badRequest(message: string): AppError {
    return new AppError(400, message, "BAD_REQUEST");
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

  static badGateway(message: string): AppError {
    return new AppError(502, message, "BAD_GATEWAY");
  }

  static internal(message: string): AppError {
    return new AppError(500, message, "INTERNAL_ERROR");
  }
}
