"use client";

import { useEffect, useState } from "react";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { endpoints } from "@/lib/api/endpoints";
import { toSearchItems, type SearchResultItem } from "./items";

const EMPTY: SearchResultItem[] = [];

interface Settled {
    q: string;
    items: SearchResultItem[];
    failed: boolean;
}

/**
 * Live search against GET /api/search (published algorithms, plus your saved visualizations when signed in).
 * Plain fetch with abort, so it needs no provider and an old answer can never replace a newer one.
 */
export function useSearch(query: string, enabled = true) {
    const q = useDebouncedValue(query.trim(), 200);
    const [settled, setSettled] = useState<Settled | null>(null);

    useEffect(() => {
        if (!enabled || q === "") return;
        const ctrl = new AbortController();
        endpoints
            .search(q, ctrl.signal)
            .then((r) => setSettled({ q, items: toSearchItems(r), failed: false }))
            .catch(() => {
                if (!ctrl.signal.aborted) setSettled({ q, items: EMPTY, failed: true });
            });
        return () => ctrl.abort();
    }, [q, enabled]);

    const current = enabled && q !== "" && settled?.q === q ? settled : null;
    return {
        items: current?.items ?? EMPTY,
        loading: enabled && query.trim() !== "" && current === null,
        failed: current?.failed ?? false,
    };
}
