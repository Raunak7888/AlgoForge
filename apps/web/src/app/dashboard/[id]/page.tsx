"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect } from "react";
import { SignInPrompt } from "@/components/auth/SignInPrompt";
import AlgoforgeDashboard from "@/components/DashBoard/DashBoard";
import { DashboardGate } from "@/components/DashBoard/DashboardGate";
import { PageShell } from "@/components/site/PageShell";
import { btn } from "@/components/visualizers/shared/styles";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { useAuth } from "@/lib/auth";
import { useAnalysis } from "@/lib/query";
import { useWorkspace } from "@/lib/workspace/store";

/** Reopens a saved analysis: its code and language go back into the editor and its result into the panel. */
export default function ReopenAnalysisPage() {
    const params = useParams<{ id: string }>();
    const id = typeof params.id === "string" ? params.id : "";
    const { status } = useAuth();
    const query = useAnalysis(id, status === "authed");
    const openAnalysis = useWorkspace((s) => s.openAnalysis);
    const lastOpenedId = useWorkspace((s) => s.lastOpenedId);
    const data = query.data;

    useEffect(() => {
        if (data) openAnalysis({ id: data.id, code: data.code, language: data.language, result: data.result, title: data.title });
    }, [data, openAnalysis]);

    if (status === "guest") {
        return (
            <PageShell>
                <div className="h-[60vh]">
                    <SignInPrompt title="Sign in to open this analysis" description="Saved analyses belong to your account." />
                </div>
            </PageShell>
        );
    }

    if (query.isError) {
        const missing = isApiError(query.error) && query.error.status === 404;
        return (
            <PageShell>
                <h1 className="mb-2 text-2xl font-bold">{missing ? "Analysis not found" : "Could not load this analysis"}</h1>
                <p className="mb-4 text-foreground/60">{missing ? "It may have been deleted, or it belongs to another account." : errorMessage(query.error)}</p>
                <div className="flex gap-2">
                    <Link href="/dashboard" className={btn}>Back to the dashboard</Link>
                    {!missing && (
                        <button type="button" className={btn} onClick={() => void query.refetch()}>
                            Try again
                        </button>
                    )}
                </div>
            </PageShell>
        );
    }

    if (status === "loading" || query.isPending || lastOpenedId !== id) {
        return (
            <PageShell>
                <p role="status" aria-busy className="text-foreground/60">
                    Loading analysis…
                </p>
            </PageShell>
        );
    }

    return (
        <DashboardGate>
            <AlgoforgeDashboard />
        </DashboardGate>
    );
}
