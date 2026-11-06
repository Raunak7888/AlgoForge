import Link from "next/link";
import type { ReactNode } from "react";
import AlgoForgeLogo from "@/components/Logo";

/** A simple frame for static and catalog pages. Works in server and client components. */
export function PageShell({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
    return (
        <div className="min-h-dvh bg-background text-foreground">
            <header className="border-b border-foreground/10">
                <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-5">
                    <Link href="/" className="flex items-center" aria-label="AlgoForge home">
                        <AlgoForgeLogo size={19} />
                        <span className="font-chango text-lg tracking-tight">
                            lgo<span className="text-accent">Forge</span>
                        </span>
                    </Link>
                    <nav className="flex items-center gap-5 text-sm text-foreground/70">
                        <Link href="/algorithms" className="hover:text-foreground">Algorithms</Link>
                        <Link href="/dashboard" className="hover:text-foreground">Open app</Link>
                    </nav>
                </div>
            </header>
            <main id="main-content" className={`mx-auto px-5 py-10 ${wide ? "max-w-5xl" : "max-w-3xl"}`}>
                {children}
            </main>
            <footer className="border-t border-foreground/10 py-6 text-center text-xs text-foreground/50">
                <Link href="/terms" className="hover:text-foreground">Terms</Link>
                <span className="mx-3">·</span>
                <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
            </footer>
        </div>
    );
}
