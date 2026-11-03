"use client";

import type { ReactNode } from "react";
import { errorMessage } from "../api/errors";

export interface QueryStateLike {
  isPending: boolean;
  isError: boolean;
  error: unknown;
  isFetching: boolean;
  refetch: () => unknown;
}

/** The one loading / error / retry pattern. Pass any TanStack query result; render children when data is ready. */
export function QueryBoundary({ query, children, loadingLabel = "Loading…" }: { query: QueryStateLike; children: ReactNode; loadingLabel?: string }) {
  if (query.isPending) {
    return (
      <div role="status" aria-busy className="p-6 text-center text-xs text-muted-foreground">
        {loadingLabel}
      </div>
    );
  }
  if (query.isError) {
    return (
      <div role="alert" className="flex flex-col items-center gap-3 p-6 text-center">
        <p className="text-xs text-muted-foreground">{errorMessage(query.error)}</p>
        <button
          type="button"
          onClick={() => void query.refetch()}
          disabled={query.isFetching}
          className="h-7 rounded-md border border-primary-foreground/20 px-3 text-[11px] font-medium disabled:opacity-50"
        >
          {query.isFetching ? "Retrying…" : "Try again"}
        </button>
      </div>
    );
  }
  return <>{children}</>;
}
