import { describe, expect, it } from "vitest";
import { toSearchItems } from "./items";

describe("toSearchItems", () => {
    it("labels and namespaces hits", () => {
        const items = toSearchItems({
            data: [
                { type: "algorithm", id: "a1", title: "BFS", description: "d", href: "/algorithms/bfs" },
                { type: "visualization", id: "a1", title: "Mine", description: "d", href: "/dashboard?tab=visualizer&viz=a1" },
            ],
        });
        expect(items.map((i) => i.id)).toEqual(["algorithm:a1", "visualization:a1"]);
        expect(items.map((i) => i.category)).toEqual(["Algorithm", "Saved visualization"]);
    });
});
