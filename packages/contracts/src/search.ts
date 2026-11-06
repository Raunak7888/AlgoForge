import { z } from "zod";
import { LIMITS } from "./limits";

export const SearchResultSchema = z.object({
  type: z.enum(["algorithm", "visualization"]),
  id: z.string(),
  title: z.string(),
  description: z.string(),
  href: z.string(),
});
export const SearchResponseSchema = z.object({ data: z.array(SearchResultSchema) });
export const SearchQuerySchema = z.object({
  q: z.string().trim().min(1).max(LIMITS.search.maxQueryChars).describe("Search text."),
});

export type SearchResult = z.infer<typeof SearchResultSchema>;
export type SearchResponse = z.infer<typeof SearchResponseSchema>;
