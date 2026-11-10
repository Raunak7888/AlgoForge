/**
 * The single source of truth for every size, length and pagination limit.
 * The API validators, the Express body parser, the shared visualizer compiler and the frontend read these.
 */
export const LIMITS = {
  code: { maxChars: 20_000, runMaxLines: 100, runMaxChars: 8_000 },
  script: { maxChars: 200_000 },
  message: { minChars: 5, maxChars: 2_000 },
  title: { maxChars: 200 },
  pagination: {
    analysisHistory: { defaultSize: 10, maxSize: 50 },
    explainSessions: { defaultSize: 20, maxSize: 50 },
    adminUsers: { defaultSize: 50, maxSize: 100 },
    algorithms: { defaultSize: 20, maxSize: 50 },
    visualizations: { defaultSize: 20, maxSize: 50 },
    explainMessages: { defaultSize: 50, maxSize: 100 },
  },
  search: { maxQueryChars: 100, maxAlgorithmHits: 8, maxVisualizationHits: 5 },
  visualization: { maxPerUser: 100 },
  /** Assistant: one chat holds at most maxMessagesPerSession rows; only the last historyMessages go to the model. */
  assistant: { maxMessagesPerSession: 200, historyMessages: 10, scriptContextChars: 30_000 },
  /** Must stay >= 4x script.maxChars so an escaped script still fits in a JSON body. */
  body: { jsonMaxBytes: 1_048_576 },
} as const;

export interface PageSizeLimits {
  readonly defaultSize: number;
  readonly maxSize: number;
}

export const JSON_BODY_LIMIT_BYTES: number = LIMITS.body.jsonMaxBytes;

/**
 * Lines in the code, counted the same way in the browser and in the API:
 * line endings normalized, surrounding blank space trimmed.
 */
export function countLines(code: string): number {
  const text = code.replace(/\r\n?/g, "\n").trim();
  return text === "" ? 0 : text.split("\n").length;
}

export type CodeCheck =
  | { ok: true; lines: number; chars: number }
  | { ok: false; reason: "empty" | "too_many_lines" | "too_long"; lines: number; chars: number; message: string };

/**
 * Gate for everything that starts real work on the code in the editor (analysis, visualizer).
 * The browser and the API call this same function, so they cannot disagree.
 */
export function checkRunnableCode(
  code: string,
  limits: { maxLines: number; maxChars: number } = { maxLines: LIMITS.code.runMaxLines, maxChars: LIMITS.code.runMaxChars },
): CodeCheck {
  const lines = countLines(code);
  const chars = code.trim().length;
  if (lines === 0) {
    return { ok: false, reason: "empty", lines, chars, message: "Write or paste some code in the editor first." };
  }
  if (lines > limits.maxLines) {
    return {
      ok: false,
      reason: "too_many_lines",
      lines,
      chars,
      message: `Your code is ${lines} lines. Code analysis and the visualizer support up to ${limits.maxLines} lines. Shorten it to continue.`,
    };
  }
  if (chars > limits.maxChars) {
    return {
      ok: false,
      reason: "too_long",
      lines,
      chars,
      message: `Your code is ${chars.toLocaleString()} characters. Code analysis and the visualizer support up to ${limits.maxChars.toLocaleString()}. Shorten it to continue.`,
    };
  }
  return { ok: true, lines, chars };
}

export const CAPABILITY_LIMITS = {
  codeMaxChars: LIMITS.code.maxChars,
  scriptMaxChars: LIMITS.script.maxChars,
  messageMaxChars: LIMITS.message.maxChars,
} as const;
