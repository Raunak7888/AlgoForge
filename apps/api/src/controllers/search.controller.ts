import { Request, Response } from "express";
import { SearchQuerySchema, type SearchResponse } from "@algoforge/contracts";
import { searchService } from "../services/search.service";
import { asyncHandler } from "../utils/async-handler";
import { badRequestFromZod } from "../validation/common";

class SearchController {
  search = asyncHandler(async (req: Request, res: Response) => {
    const parsed = SearchQuerySchema.safeParse({ q: typeof req.query.q === "string" ? req.query.q : "" });
    if (!parsed.success) throw badRequestFromZod(parsed.error, "Invalid search.");
    const body: SearchResponse = { data: await searchService.search(parsed.data.q, req.auth?.user.id) };
    res.json(body);
  });
}

export const searchController = new SearchController();
