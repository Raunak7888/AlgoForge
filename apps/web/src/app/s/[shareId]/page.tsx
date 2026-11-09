"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { PageShell } from "@/components/site/PageShell";
import { SharedView } from "@/components/share/SharedView";
import { btn } from "@/components/visualizers/shared/styles";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { usePublicShare } from "@/lib/query";

export default function PublicSharePage() {
    const params = useParams<{ shareId: string }>();
    const shareId = typeof params.shareId === "string" ? params.shareId : "";
    const query = usePublicShare(shareId);

    if (query.isPending) {
        return (
            <PageShell wide>
                <p role="status" aria-busy className="text-foreground/60">Loading shared item…</p>
            </PageShell>
        );
    }
    if (query.isError) {
        const gone = isApiError(query.error) && query.error.status === 404;
        return (
            <PageShell>
                <h1 className="mb-2 text-2xl font-bold">{gone ? "This link is not available" : "Could not load this link"}</h1>
                <p className="mb-4 text-foreground/60">
                    {gone ? "It may have been turned off by its owner, or the address is wrong." : errorMessage(query.error)}
                </p>
                <div className="flex gap-2">
                    <Link href="/" className={btn}>Go to AlgoForge</Link>
                    {!gone && <button type="button" className={btn} onClick={() => void query.refetch()}>Try again</button>}
                </div>
            </PageShell>
        );
    }
    return (
        <PageShell wide>
            <SharedView share={query.data} />
        </PageShell>
    );
}
