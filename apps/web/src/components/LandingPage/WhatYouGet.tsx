"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { AiBrain01Icon, MessageMultiple01Icon, PlayIcon, TrendingUp } from "@hugeicons/core-free-icons";
import { IconSvgObject } from "@/lib/types";
import { StatusChip } from "@/components/ui/StatusChip";
import type { FeatureStatus } from "@/lib/featureStatus";
import { Eyebrow, IconBubble, LandingStyles, Reveal, SpotCard } from "./shared";

type Feature = {
    id: string;
    icon: IconSvgObject;
    title: string;
    short: string;
    description: string;
    tag: string;
    index: string;
    status: FeatureStatus;
};

const features: Feature[] = [
    {
        id: "visualizer", icon: PlayIcon, title: "Algorithm Visualizer", short: "See every step", tag: "Visual", index: "01", status: "available",
        description: "Step through array, stack, queue, linked list, tree, hash and graph operations with frame-by-frame animation. Pause, scrub, replay and change the speed.",
    },
    {
        id: "ai-analysis", icon: AiBrain01Icon, title: "AI Analysis", short: "Complexity and bottlenecks", tag: "Core", index: "02", status: "preview",
        description: "A report with complexity, bottlenecks and edge cases. The report screen is built; the analysis engine is not connected yet, so it shows a fixed sample.",
    },
    {
        id: "explainer", icon: MessageMultiple01Icon, title: "AI Explainer", short: "Plain-English breakdowns", tag: "Learn", index: "03", status: "planned",
        description: "Plain-language walkthroughs of an algorithm. Not built yet.",
    },
    {
        id: "optimization", icon: TrendingUp, title: "Optimization Hints", short: "Suggested rewrites", tag: "Optimize", index: "04", status: "planned",
        description: "Ranked rewrite suggestions with the expected change in Big-O. Not built yet.",
    },
];

const availableCount = features.filter((f) => f.status === "available").length;

const STRUCTURES = ["Array", "Stack", "Queue", "Linked list", "Binary tree", "Hash map", "Graph"];
const OPS = ["insert()", "push()", "enqueue()", "delete()", "rotate()", "hash()", "bfs()", "swap()"];

// Big animation #4: two counter-moving marquee rows (CSS only, pause on hover)
function MarqueeRow({ items, reverse = false }: { items: string[]; reverse?: boolean }) {
    const half = [...items, ...items, ...items];
    const full = [...half, ...half];
    return (
        <div className="overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_12%,#000_88%,transparent)]">
            <div className={`af-marquee-track flex w-max gap-3 ${reverse ? "af-marquee-rev" : "af-marquee"}`}>
                {full.map((t, i) => (
                    <span
                        key={i}
                        className="inline-flex items-center gap-2 rounded-full border border-foreground/10 bg-foreground/[.03] px-4 py-1.5 font-mono text-xs text-foreground/70 sm:px-5 sm:py-2 sm:text-sm"
                    >
                        <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                        {t}
                    </span>
                ))}
            </div>
        </div>
    );
}

export default function WhatYouGet() {
    return (
        <section id="products" className="relative w-full overflow-x-clip px-4 py-16 md:py-28">
            <LandingStyles />
            <div className="relative z-10 mx-auto max-w-6xl">
                <Reveal className="mb-14 text-center">
                    <Eyebrow>Platform capabilities</Eyebrow>
                    <h2 className="mt-6 text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
                        What you <span className="text-accent">get</span>
                    </h2>
                    <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-foreground/60">
                        What the visualizer does today, and what is still on the way.
                    </p>
                </Reveal>

                <div className="mb-14 space-y-3">
                    <MarqueeRow items={STRUCTURES} />
                    <MarqueeRow items={OPS} reverse />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {features.map((f, i) => (
                        <Reveal key={f.id} delay={i * 0.07}>
                            <SpotCard className="h-full">
                                <div className="flex h-full flex-col gap-5 p-6">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono text-xs font-bold tracking-widest text-foreground/50 transition-colors group-hover:text-accent">
                                                {f.index}
                                            </span>
                                            <StatusChip status={f.status} />
                                        </div>
                                        <span className="font-mono text-[11px] font-semibold uppercase tracking-widest text-foreground/50">
                                            {f.tag}
                                        </span>
                                    </div>
                                    <IconBubble icon={f.icon} />
                                    <div className="flex flex-1 flex-col gap-2">
                                        <h3 className="text-sm font-bold tracking-tight">{f.title}</h3>
                                        <p className="text-xs font-medium text-accent">{f.short}</p>
                                        <p className="mt-1 text-xs leading-relaxed text-foreground/60">{f.description}</p>
                                    </div>
                                </div>
                            </SpotCard>
                        </Reveal>
                    ))}
                </div>

                <div className="mt-8 flex flex-wrap items-center justify-between gap-2 px-1">
                    <span className="font-mono text-[11px] uppercase tracking-widest text-foreground/60">
                        {availableCount} available · {features.length - availableCount} not yet
                    </span>
                    <span className="font-mono text-[11px] uppercase tracking-widest text-accent">Preview</span>
                </div>
            </div>
        </section>
    );
}
