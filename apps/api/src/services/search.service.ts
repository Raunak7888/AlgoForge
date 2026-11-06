import { LIMITS, type SearchResult } from "@algoforge/contracts";
import { algorithmRepository } from "../repositories/algorithm.repository";
import { visualizationRepository } from "../repositories/visualization.repository";

/** Published algorithms for everyone, plus the caller's own saved visualizations when signed in. */
class SearchService {
  async search(term: string, userId?: string): Promise<SearchResult[]> {
    const [algorithms, visualizations] = await Promise.all([
      algorithmRepository.searchPublished(term, LIMITS.search.maxAlgorithmHits),
      userId ? visualizationRepository.searchByUser(userId, term, LIMITS.search.maxVisualizationHits) : Promise.resolve([]),
    ]);
    return [
      ...algorithms.map((a) => ({
        type: "algorithm" as const,
        id: a.id,
        title: a.name,
        description: a.description,
        href: `/algorithms/${encodeURIComponent(a.slug)}`,
      })),
      ...visualizations.map((v) => ({
        type: "visualization" as const,
        id: v.id,
        title: v.title,
        description: v.description ?? "Saved visualization",
        href: `/dashboard?tab=visualizer&viz=${encodeURIComponent(v.id)}`,
      })),
    ];
  }
}

export const searchService = new SearchService();
