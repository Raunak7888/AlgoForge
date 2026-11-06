import type { Metadata } from "next";
import { PageShell } from "@/components/site/PageShell";

export const metadata: Metadata = { title: "Privacy Policy · AlgoForge" };

export default function PrivacyPage() {
    return (
        <PageShell>
            <h1 className="mb-2 text-3xl font-bold tracking-tight">Privacy Policy</h1>
            <p className="mb-8 text-sm text-foreground/60">Last updated: 5 November 2026. This is a short plain-language draft. Have it reviewed before you rely on it.</p>
            <div className="space-y-6 text-[15px] leading-relaxed text-foreground/80">
                <section>
                    <h2 className="mb-1 text-lg font-semibold text-foreground">Without an account</h2>
                    <p>Your script and settings stay in your browser (local storage). Nothing is sent to our servers when you only use the editor and the visualizer.</p>
                </section>
                <section>
                    <h2 className="mb-1 text-lg font-semibold text-foreground">With an account</h2>
                    <p>When you sign in with Google we receive your name, email address and profile picture. We store what you create: saved visualizations, analyses and chats. We store basic details about your sign-in sessions (time, IP address and browser) so you can see and end them in Settings.</p>
                </section>
                <section>
                    <h2 className="mb-1 text-lg font-semibold text-foreground">Cookies</h2>
                    <p>We use cookies only to keep you signed in and to protect requests from forgery. We do not use advertising cookies.</p>
                </section>
                <section>
                    <h2 className="mb-1 text-lg font-semibold text-foreground">Your choices</h2>
                    <p>You can delete any saved item, sign out of any device, and delete your account in Settings. Deleting your account removes what you created, and shared links stop working.</p>
                </section>
            </div>
        </PageShell>
    );
}
