/**
 * The single source of truth for every size, length and pagination limit.
 * The API validators, the Express body parser, the shared visualizer compiler and the frontend read these.
 */
export const LIMITS = {
  code: { maxChars: 20_000 },
  script: { maxChars: 200_000 },
  message: { minChars: 5, maxChars: 2_000 },
  title: { maxChars: 200 },
  pagination: {
    analysisHistory: { defaultSize: 10, maxSize: 50 },
    explainSessions: { defaultSize: 20, maxSize: 50 },
    adminUsers: { defaultSize: 50, maxSize: 100 },
    algorithms: { defaultSize: 20, maxSize: 50 },
    visualizations: { defaultSize: 20, maxSize: 50 },
  },
  search: { maxQueryChars: 100, maxAlgorithmHits: 8, maxVisualizationHits: 5 },
  visualization: { maxPerUser: 100 },
  /** Must stay >= 4x script.maxChars so an escaped script still fits in a JSON body. */
  body: { jsonMaxBytes: 1_048_576 },
} as const;

export interface PageSizeLimits {
  readonly defaultSize: number;
  readonly maxSize: number;
}

export const JSON_BODY_LIMIT_BYTES: number = LIMITS.body.jsonMaxBytes;

export const CAPABILITY_LIMITS = {
  codeMaxChars: LIMITS.code.maxChars,
  scriptMaxChars: LIMITS.script.maxChars,
  messageMaxChars: LIMITS.message.maxChars,
} as const;
