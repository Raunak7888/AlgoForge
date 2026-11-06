import type { SearchResponse } from "@algoforge/contracts";

export interface SearchResultItem {
    id: string;
    title: string;
    category: string;
    href: string;
    description: string;
}

/** Server hits to the shape the title bar renders. */
export function toSearchItems(response: SearchResponse): SearchResultItem[] {
    return response.data.map((hit) => ({
        id: `${hit.type}:${hit.id}`,
        title: hit.title,
        description: hit.description,
        href: hit.href,
        category: hit.type === "algorithm" ? "Algorithm" : "Saved visualization",
    }));
}
