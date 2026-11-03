"use client";
import dynamic from "next/dynamic";
import { ThemeToggle, useTheme } from "@/components/visualizers/ui";

const VisualizerPanel = dynamic(() => import("@/components/visualizers/ui/VisualizerPanel").then((m) => m.VisualizerPanel), {
    ssr: false,
    loading: () => <div aria-busy className="h-full animate-pulse rounded-2xl bg-primary-foreground/5" />,
});

export default function VisualizerPage() {
    const [theme] = useTheme();
    return (
        <main className="flex h-screen flex-col gap-2 bg-background p-3 text-foreground">
            <div className="flex justify-end">
                <ThemeToggle />
            </div>
            <div className="min-h-0 flex-1">
                <VisualizerPanel dark={theme === "dark"} />
            </div>
        </main>
    );
}
