import type { Metadata } from "next";
import type { ReactNode } from "react";

const API_URL = (process.env.API_URL ?? "http://localhost:4000").replace(/\/+$/, "");
const ID_RE = /^[A-Za-z0-9_-]{12}$/;
const KIND = { analysis: "Code analysis", explain: "AI chat", visualization: "Visualization" } as const;

type Lite = { type?: keyof typeof KIND; data?: { title?: string | null }; creator?: { name?: string | null } };

export async function generateMetadata({ params }: { params: Promise<{ shareId: string }> }): Promise<Metadata> {
    const { shareId } = await params;
    const base: Metadata = { title: "Shared on AlgoForge", robots: { index: false, follow: false } };
    if (!ID_RE.test(shareId)) return base;
    try {
        const res = await fetch(`${API_URL}/api/share/${shareId}`, { cache: "no-store", signal: AbortSignal.timeout(3000) });
        if (!res.ok) return base;
        const j = (await res.json()) as Lite;
        const kind = j.type ? KIND[j.type] : "Shared item";
        const title = j.data?.title ? `${j.data.title} · AlgoForge` : `${kind} · AlgoForge`;
        const description = `${kind}${j.creator?.name ? ` by ${j.creator.name}` : ""}, shared on AlgoForge.`;
        return { title, description, robots: { index: false, follow: false }, openGraph: { title, description, type: "article" }, twitter: { card: "summary", title, description } };
    } catch {
        return base;
    }
}

export default function ShareLayout({ children }: { children: ReactNode }) {
    return children;
}
