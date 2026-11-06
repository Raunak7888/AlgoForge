"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { endpoints } from "@/lib/api/endpoints";
import { errorMessage } from "@/lib/api/errors";
import { useAnalysisHistory } from "@/lib/query";
import { queryKeys } from "@/lib/query/keys";
import { useWorkspace } from "@/lib/workspace/store";
import AnalysisHistory, { type AnalysisHistoryItem, type HistoryFilters } from "./analysis-history";

type FilterState = Pick<HistoryFilters, "q" | "language" | "sort">;

/** The signed-in person's real history: cursor pages, search/filter/sort on the server, real deletion. */
export default function RealHistory() {
    const queryClient = useQueryClient();
    const [filters, setFilters] = useState<FilterState>({ q: "", language: "all", sort: "newest" });
    const [notice, setNotice] = useState<string | null>(null);
    const q = useDebouncedValue(filters.q.trim(), 300);

    const history = useAnalysisHistory({
        q: q || undefined,
        language: filters.language === "all" ? undefined : filters.language,
        sort: filters.sort,
    });

    const items = useMemo<AnalysisHistoryItem[]>(() => history.data?.pages.flatMap((p) => p.data) ?? [], [history.data]);
    const meta = history.data?.pages[history.data.pages.length - 1]?.meta ?? { nextCursor: null, hasMore: false };

    const remove = useMutation({
        mutationFn: (item: AnalysisHistoryItem) => endpoints.deleteAnalysis(item.id),
        onSuccess: (_data, item) => {
            setNotice(null);
            useWorkspace.getState().forgetAnalysis(item.id);
            queryClient.removeQueries({ queryKey: queryKeys.analysisDetail(item.id) });
            void queryClient.invalidateQueries({ queryKey: ["analysis", "history"] });
        },
        onError: (error: unknown) => setNotice(errorMessage(error)),
    });

    return (
        <div className="flex h-full flex-col">
            {notice && (
                <p role="alert" className="mx-2 mt-2 rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-xs text-red-200">
                    {notice}
                </p>
            )}
            <div className="min-h-0 flex-1">
                <AnalysisHistory
                    items={items}
                    meta={meta}
                    onLoadMore={() => void history.fetchNextPage()}
                    loading={history.isPending}
                    loadingMore={history.isFetchingNextPage}
                    error={history.isError ? errorMessage(history.error) : null}
                    onRetry={() => void history.refetch()}
                    onDelete={(item) => {
                        if (window.confirm("Delete this analysis? This cannot be undone.")) remove.mutate(item);
                    }}
                    filters={{ ...filters, onChange: (patch) => setFilters((f) => ({ ...f, ...patch })) }}
                />
            </div>
        </div>
    );
}
