import { z } from "zod";
import type { PageSizeLimits } from "./limits";

export const REQUEST_ID_HEADER = "X-Request-Id";
export const CSRF_HEADER_NAME = "X-CSRF-Token";
export const CSRF_COOKIE_NAME = "af_csrf";
export const ACCESS_COOKIE_NAME = "af_access";
export const RETRY_AFTER_HEADER = "Retry-After";

/** Every date on the wire is an ISO 8601 UTC string. */
export const IsoDateTimeSchema = z.iso.datetime();
export const CursorSchema = z.string().min(1).max(512);

/** Response conventions: a single resource is a plain object; every list is { data }, paginated lists add { meta }. */
export const PageMetaSchema = z.object({ nextCursor: z.string().nullable(), hasMore: z.boolean() });
export type PageMeta = z.infer<typeof PageMetaSchema>;

export const listResponse = <T extends z.ZodType>(item: T) => z.object({ data: z.array(item) });
export const paginatedResponse = <T extends z.ZodType>(item: T) => z.object({ data: z.array(item), meta: PageMetaSchema });

/** Documentation schema for ?limit&cursor (query values arrive as strings and are coerced by the API). */
export const pageQuerySchema = (limits: PageSizeLimits) =>
  z.object({
    limit: z.number().int().min(1).max(limits.maxSize).optional().describe(`Page size. Default ${limits.defaultSize}, max ${limits.maxSize}.`),
    cursor: CursorSchema.optional().describe("Opaque cursor: meta.nextCursor of the previous page."),
  });

export const IdParamsSchema = z.object({ id: z.string().min(1) });
export const SlugParamsSchema = z.object({ slug: z.string().min(1) });
export const ShareIdParamsSchema = z.object({ shareId: z.string().min(1) });
