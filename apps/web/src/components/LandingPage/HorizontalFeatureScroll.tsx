"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { HugeiconsIcon } from "@hugeicons/react";
import { Tick02Icon } from "@hugeicons/core-free-icons";
import { StatusChip } from "@/components/ui/StatusChip";
import type { FeatureStatus } from "@/lib/featureStatus";
import { usePrefersReducedMotion } from "@/lib/reducedMotion";
import DemoVideo from "./DemoVideo";
import { Eyebrow, Reveal, SpotCard } from "./shared";

gsap.registerPlugin(ScrollTrigger);

type Feature = {
    id: string;
    tag: string;
    index: string;
    status: FeatureStatus;
    title: string;
    description: string;
    points: string[];
};

const features: Feature[] = [
    {
        id: "visualizer", tag: "Interactive", index: "01", status: "available", title: "Algorithm Visualizer",
        description: "Watch operations run step by step on arrays, stacks, queues, linked lists, trees, hash maps and graphs.",
        points: [
            "Play, pause, step back, scrub and replay",
            "Several structures animate together on one canvas",
            "Narration you write into the script, shown with each step",
            "Speed from 0.25× to 4×",
            "Scriptable with JSON, with errors that point at the line",
        ],
    },
    {
        id: "ai-analysis", tag: "Analysis", index: "02", status: "preview", title: "AI Code Analysis",
        description: "Complexity and bottleneck analysis. The report screen is built; the engine is not connected, so it currently shows a fixed sample.",
        points: ["Time and space complexity", "Bottlenecks and edge cases", "Needs an account. Today it shows a sample report, not based on your code"],
    },
    {
        id: "ai-explainer", tag: "Learning", index: "03", status: "planned", title: "AI Explainer",
        description: "Plain-language explanations of an algorithm or snippet.",
        points: ["Explain an algorithm in plain English", "Answer follow-up questions", "Needs an account"],
    },
    {
        id: "dashboard", tag: "Productivity", index: "04", status: "planned", title: "Saved Work",
        description: "Keep and revisit your past work in one place.",
        points: ["History of saved visualizations", "Needs accounts and storage, not built yet"],
    },
    {
        id: "share", tag: "Collaboration", index: "05", status: "planned", title: "Shareable Links",
        description: "A link to a visualization that anyone can open.",
        points: ["One link per saved visualization", "Needs an account and saved work, not built yet"],
    },
];

// The video frame grows and untilts as you scroll
function VideoBlock() {
    const wrap = useRef<HTMLDivElement>(null);
    const reduced = usePrefersReducedMotion();

    useEffect(() => {
        const el = wrap.current;
        if (!el || reduced) return;
        const ctx = gsap.context(() => {
            gsap.fromTo(
                el,
                { scale: 0.86, y: 70, rotateX: 12, transformPerspective: 900 },
                {
                    scale: 1, y: 0, rotateX: 0, ease: "none",
                    scrollTrigger: { trigger: el, start: "top 95%", end: "top 35%", scrub: true },
                },
            );
        });
        return () => ctx.revert();
    }, [reduced]);

    return (
        <section id="watch" className="relative overflow-x-clip px-4 py-16 sm:px-6 md:py-28">
            <div className="relative mx-auto max-w-5xl">
                <Reveal className="mb-12 text-center">
                    <Eyebrow>Product tour</Eyebrow>
                    <h2 className="mt-6 text-3xl font-black tracking-tight sm:text-4xl md:text-6xl">
                        See it in <span className="text-accent">action.</span>
                    </h2>
                    <p className="mx-auto mt-4 max-w-md text-foreground/60">
                        A short recording of writing a script, pressing play and stepping through it.
                    </p>
                </Reveal>
                <div ref={wrap}>
                    <DemoVideo />
                </div>
            </div>
        </section>
    );
}

export default function HorizontalFeatureScroll() {
    return (
        <>
            <VideoBlock />

            <section id="features" className="relative overflow-x-clip px-4 py-16 sm:px-6 md:py-28">
                <div className="mx-auto max-w-6xl">
                    <Reveal className="mb-14 text-center">
                        <Eyebrow>Platform features</Eyebrow>
                        <h2 className="mt-6 text-3xl font-black tracking-tight sm:text-4xl md:text-6xl">
                            Everything in <span className="text-accent">one place.</span>
                        </h2>
                    </Reveal>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {features.map((f, i) => (
                            <Reveal key={f.id} delay={i * 0.08} className={i === 0 ? "md:col-span-2" : ""}>
                                <SpotCard className="h-full">
                                    <div className="flex h-full flex-col gap-4 p-5 sm:p-7">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <span className="font-mono text-xs font-bold tracking-widest text-foreground/50 transition-colors group-hover:text-accent">
                                                    {f.index}
                                                </span>
                                                <StatusChip status={f.status} />
                                            </div>
                                            <span className="font-mono text-[11px] uppercase tracking-widest text-foreground/50">{f.tag}</span>
                                        </div>
                                        <h3 className="text-2xl font-bold tracking-tight">{f.title}</h3>
                                        <p className="text-sm leading-relaxed text-foreground/60">{f.description}</p>
                                        <ul className="mt-auto space-y-2 pt-2">
                                            {f.points.map((p, pi) => (
                                                <li
                                                    key={p}
                                                    className="flex items-start gap-2.5 text-sm text-foreground/75 transition-transform duration-300 group-hover:translate-x-1"
                                                    style={{ transitionDelay: `${pi * 35}ms` }}
                                                >
                                                    <HugeiconsIcon icon={Tick02Icon} size={14} color="currentColor" strokeWidth={2} className="mt-1 shrink-0 text-accent" />
                                                    {p}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </SpotCard>
                            </Reveal>
                        ))}
                    </div>
                </div>
            </section>
        </>
    );
}
