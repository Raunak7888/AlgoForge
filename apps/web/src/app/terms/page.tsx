import type { Metadata } from "next";
import { PageShell } from "@/components/site/PageShell";

export const metadata: Metadata = { title: "Terms of Use · AlgoForge" };

export default function TermsPage() {
    return (
        <PageShell>
            <h1 className="mb-2 text-3xl font-bold tracking-tight">Terms of Use</h1>
            <p className="mb-8 text-sm text-foreground/60">Last updated: 5 November 2026. This is a short plain-language draft. Have it reviewed before you rely on it.</p>
            <div className="space-y-6 text-[15px] leading-relaxed text-foreground/80">
                <section>
                    <h2 className="mb-1 text-lg font-semibold text-foreground">Using AlgoForge</h2>
                    <p>AlgoForge lets you write short scripts and watch data structures change step by step. The editor and the visualizer work without an account. Analysis, the assistant, history, saved work and sharing need you to sign in with Google.</p>
                </section>
                <section>
                    <h2 className="mb-1 text-lg font-semibold text-foreground">Your content</h2>
                    <p>You own the scripts and code you write. By saving or sharing something you allow AlgoForge to store it and, if you share it, to show it to people who have the link. You can delete saved work and delete your account at any time.</p>
                </section>
                <section>
                    <h2 className="mb-1 text-lg font-semibold text-foreground">Acceptable use</h2>
                    <p>Do not abuse the service, try to break or overload it, or use it to attack others. Limits on size and request rate exist to keep it fast for everyone.</p>
                </section>
                <section>
                    <h2 className="mb-1 text-lg font-semibold text-foreground">No guarantees</h2>
                    <p>The service is provided as it is. AI output can be wrong. Check results before you depend on them.</p>
                </section>
            </div>
        </PageShell>
    );
}
