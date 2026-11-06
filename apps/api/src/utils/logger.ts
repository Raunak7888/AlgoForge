type Level = "info" | "warn" | "error";
type Fields = Record<string, unknown>;

function write(level: Level, message: string, fields: Fields): void {
  const line = JSON.stringify({
    level,
    time: new Date().toISOString(),
    message,
    ...fields,
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  info: (message: string, fields: Fields = {}): void => write("info", message, fields),
  warn: (message: string, fields: Fields = {}): void => write("warn", message, fields),
  error: (message: string, fields: Fields = {}): void => write("error", message, fields),
};

export function serializeError(err: unknown): Fields {
  if (err instanceof Error) {
    return { errorName: err.name, errorMessage: err.message, stack: err.stack };
  }
  return { errorValue: String(err) };
}
