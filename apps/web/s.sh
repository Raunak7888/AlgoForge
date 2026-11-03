#!/usr/bin/env bash
# Run from your project root.
# Applies the landing page upgrade to src\components\LandingPage:
#  - Manifesto redesigned: scroll runs a real binary search (answer first, then every step)
#  - Particle graph: parallax nodes, data packets on edges, random shooting stars
#  - No blur glows anywhere
#  - AlgoStage removed, DemoVideo back to the real video
set -euo pipefail

export MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL="*"

V="src\components\LandingPage"
mkdir -p "$V"

rm -f "$V/AlgoStage.tsx"


FILE=DemoVideo.tsx
cat > "$V/$FILE" <<'__LANDING_FILE_0_EOF__'
"use client";

import { useRef, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { PlayIcon } from "@hugeicons/core-free-icons";

// Put your screen recording here: public/demo/usage.mp4
export const DEMO_VIDEO_SRC = "/demo/usage.mp4";

export default function DemoVideo({ lite = false }: { lite?: boolean }) {
    const ref = useRef<HTMLVideoElement>(null);
    const [playing, setPlaying] = useState(false);
    const [failed, setFailed] = useState(false);

    const start = () => {
        ref.current?.play().catch(() => setFailed(true));
    };

    return (
        <div className="relative overflow-hidden rounded-3xl border border-foreground/10 bg-background shadow-[0_24px_60px_-30px_rgba(0,0,0,0.7)]">
            <div className="flex items-center gap-2 border-b border-foreground/10 bg-foreground/[.03] px-4 py-3">
                <span className="h-2.5 w-2.5 rounded-full bg-accent" />
                <span className="h-2.5 w-2.5 rounded-full bg-foreground/25" />
                <span className="h-2.5 w-2.5 rounded-full bg-foreground/15" />
                <span className="mx-auto rounded-full border border-foreground/10 px-4 py-0.5 font-mono text-[11px] text-foreground/50">
                    algoforge · product tour
                </span>
                <span className="w-10" />
            </div>

            <div className="relative aspect-video bg-black">
                <video
                    ref={ref}
                    className="h-full w-full object-cover"
                    src={DEMO_VIDEO_SRC}
                    controls={playing}
                    playsInline
                    preload={lite ? "none" : "metadata"}
                    onPlay={() => setPlaying(true)}
                    onPause={() => setPlaying(false)}
                    onEnded={() => setPlaying(false)}
                    onError={() => setFailed(true)}
                />

                {!playing && (
                    <div className="absolute inset-0 grid place-items-center bg-gradient-to-t from-black/70 via-black/20 to-transparent">
                        {failed ? (
                            <p className="px-6 text-center font-mono text-xs text-white/70">
                                Add your recording at public/demo/usage.mp4 and it will play here.
                            </p>
                        ) : (
                            <button
                                type="button"
                                onClick={start}
                                aria-label="Play product demo"
                                className="group relative flex h-20 w-20 items-center justify-center rounded-full bg-accent text-black transition-transform duration-300 hover:scale-110 active:scale-95"
                            >
                                {!lite && <span className="af-ping absolute inset-0 rounded-full bg-accent/60" />}
                                <span className="relative">
                                    <HugeiconsIcon icon={PlayIcon} size={30} color="currentColor" strokeWidth={1.5} />
                                </span>
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
__LANDING_FILE_0_EOF__

FILE=FinalCTA.tsx
cat > "$V/$FILE" <<'__LANDING_FILE_1_EOF__'
"use client";

import { useRef } from "react";
import { motion } from "framer-motion";
import gsap from "gsap";
import { HugeiconsIcon } from "@hugeicons/react";
import { Tick02Icon } from "@hugeicons/core-free-icons";
import AnimatedButton from "../ui/ButtonAnimated";
import { DASHBOARD_HREF } from "@/lib/site";
import { PRODUCT_FACTS } from "@/lib/productFacts";
import { prefersReducedMotion } from "@/lib/reducedMotion";
import { Buddy, Eyebrow, LandingStyles } from "./shared";
import ParticleField from "./ParticleField";

const TRUST_ITEMS = ["No account needed", "Runs in your browser"];
const BARS = [40, 72, 55, 90, 35, 80, 62, 48, 85, 58];
const EASE = [0.16, 1, 0.3, 1] as const;

export default function FinalCTA() {
    const magnet = useRef<HTMLDivElement>(null);

    const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (prefersReducedMotion() || !magnet.current) return;
        const r = e.currentTarget.getBoundingClientRect();
        gsap.to(magnet.current, {
            x: (e.clientX - (r.left + r.width / 2)) * 0.22,
            y: (e.clientY - (r.top + r.height / 2)) * 0.22,
            duration: 0.4,
            ease: "power3.out",
        });
    };
    const onLeave = () => {
        if (magnet.current) gsap.to(magnet.current, { x: 0, y: 0, duration: 0.8, ease: "elastic.out(1,0.4)" });
    };

    return (
        <section className="relative overflow-x-clip px-4 py-24 md:px-8">
            <LandingStyles />
            <style>{`
@keyframes af-bar{0%,100%{transform:scaleY(.4)}50%{transform:scaleY(1)}}
.af-bar{transform-origin:bottom;animation:af-bar 2.8s ease-in-out infinite}
@media (prefers-reduced-motion: reduce){.af-bar{animation:none}}
`}</style>

            <motion.div
                initial={{ opacity: 0, y: 32, scale: 0.98 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.8, ease: EASE }}
                className="relative mx-auto grid max-w-6xl items-center gap-10 overflow-hidden rounded-[2.5rem] border border-foreground/15 bg-foreground/[.03] p-8 md:grid-cols-[1.15fr_1fr] md:gap-14 md:p-14"
            >
                <ParticleField density={0.6} className="absolute inset-0 text-foreground [mask-image:radial-gradient(ellipse_at_80%_50%,#000_20%,transparent_75%)]" />

                {/* Left: copy */}
                <div className="relative flex flex-col items-start gap-6">
                    <Eyebrow>Try it in your browser</Eyebrow>
                    <h2 className="text-4xl font-black leading-[1.02] tracking-tight md:text-6xl">
                        Stop guessing.
                        <br />
                        Start <span className="text-accent">visualizing.</span>
                    </h2>
                    <p className="max-w-md text-base leading-relaxed text-foreground/60">
                        Write a short script, press play, and watch each operation run. Pause, step back and replay until the structure makes sense.
                    </p>

                    <div className="flex flex-wrap items-center gap-4">
                        <div onMouseMove={onMove} onMouseLeave={onLeave} className="-m-3 p-3">
                            <div ref={magnet}>
                                <AnimatedButton text="Open the visualizer" href={DASHBOARD_HREF} />
                            </div>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            {TRUST_ITEMS.map((t) => (
                                <span key={t} className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-widest text-foreground/60">
                                    <HugeiconsIcon icon={Tick02Icon} size={12} color="currentColor" strokeWidth={2} className="text-accent" />
                                    {t}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right: mini live panel */}
                <div className="relative">
                    <div className="rounded-3xl border border-foreground/10 bg-background/80 p-5 backdrop-blur-sm">
                        <div className="mb-4 flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full bg-accent" />
                            <span className="h-2.5 w-2.5 rounded-full bg-foreground/25" />
                            <span className="h-2.5 w-2.5 rounded-full bg-foreground/15" />
                            <span className="ml-auto font-mono text-[11px] uppercase tracking-widest text-foreground/50">running</span>
                        </div>

                        <div className="flex h-36 items-end gap-2">
                            {BARS.map((h, i) => (
                                <div
                                    key={i}
                                    className={`af-bar flex-1 rounded-t-xl ${i % 3 === 1 ? "bg-accent" : "bg-foreground/75"}`}
                                    style={{ height: `${h}%`, animationDelay: `${i * 0.18}s` }}
                                />
                            ))}
                        </div>

                        <div className="mt-5 grid grid-cols-2 gap-2">
                            {[
                                { v: String(PRODUCT_FACTS.structures), l: "Structures" },
                                { v: PRODUCT_FACTS.speedRange, l: "Speed" },
                            ].map((s) => (
                                <div key={s.l} className="rounded-2xl border border-foreground/10 bg-foreground/[.03] px-4 py-3 text-center">
                                    <div className="text-xl font-black tracking-tight">{s.v}</div>
                                    <div className="font-mono text-[10px] uppercase tracking-widest text-foreground/55">{s.l}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="absolute -right-3 -top-8 md:-right-5 md:-top-10">
                        <Buddy size={68} />
                    </div>
                </div>
            </motion.div>
        </section>
    );
}
__LANDING_FILE_1_EOF__

FILE=Hero.tsx
cat > "$V/$FILE" <<'__LANDING_FILE_2_EOF__'
"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { CodeIcon, PlayIcon, ZapIcon, Target, Tick02Icon } from "@hugeicons/core-free-icons";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DASHBOARD_HREF } from "@/lib/site";
import { PRODUCT_FACTS } from "@/lib/productFacts";
import { SmartNavbar } from "./Navbar";
import { CodeEditor } from "../CodeEditor";
import { Language } from "@/components/CodeEditor/types";
import { CometCard } from "../ui/comet-card";
import { Buddy, Eyebrow, LandingStyles, ScrollProgress } from "./shared";
import ParticleField from "./ParticleField";

export const defaultCodeBinarySearch: Record<Language, string> = {
    python: `def binary_search(arr, target):
    left, right = 0, len(arr) - 1
    while left <= right:
        mid = left + (right - left) // 2
        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            left = mid + 1
        else:
            right = mid - 1
    return -1`,

    javascript: `function binarySearch(arr, target) {
    let left = 0, right = arr.length - 1;
    while (left <= right) {
        const mid = left + Math.floor((right - left) / 2);
        if (arr[mid] === target) {
            return mid;
        } else if (arr[mid] < target) {
            left = mid + 1;
        } else {
            right = mid - 1;
        }
    }
    return -1;
}`,
};

const CHIPS = [
    { label: "Array", icon: CodeIcon, pos: "-left-6 top-10", delay: "0s" },
    { label: "Hash map", icon: Target, pos: "-right-4 top-28", delay: "-1.2s" },
    { label: "Step back", icon: PlayIcon, pos: "left-8 -bottom-3", delay: "-2.4s" },
    { label: "0.25× – 4×", icon: ZapIcon, pos: "right-12 -bottom-5", delay: "-3.3s" },
];

const HEADLINE = [
    ["See", "Your", "Code"],
    ["Actually", "Work"],
];

const EASE = [0.16, 1, 0.3, 1] as const;

export default function Hero() {
    const [value, setValue] = useState<string | undefined>(undefined);
    let wordIndex = 0;

    return (
        <>
            <LandingStyles />
            <ScrollProgress />
            <SmartNavbar />

            <section id="home" className="relative min-h-screen pt-20">
                {/* dotted grid + a quiet graph of drifting nodes, no glow */}
                <div className="pointer-events-none absolute inset-0">
                    <div
                        className="absolute inset-0 opacity-[0.06]"
                        style={{
                            backgroundImage: "radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)",
                            backgroundSize: "28px 28px",
                            maskImage: "radial-gradient(ellipse at center, #000 30%, transparent 75%)",
                        }}
                    />
                    <ParticleField className="absolute inset-0 text-foreground [mask-image:radial-gradient(ellipse_at_center,#000_35%,transparent_80%)]" />
                    <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-foreground/15 to-transparent" />
                </div>

                <div className="relative z-10 mx-auto grid h-[calc(100vh-5rem)] max-w-7xl grid-cols-1 items-center gap-10 px-6 lg:grid-cols-2">
                    <div className="relative max-w-xl">
                        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                            <Eyebrow>Built for learning data structures</Eyebrow>
                        </motion.div>

                        <h1 className="mb-6 mt-6 text-5xl font-bold leading-[0.95] tracking-tight text-foreground md:text-6xl lg:text-7xl">
                            {HEADLINE.map((line, li) => (
                                <span key={li} className={cn("block", li === 1 && "text-accent")}>
                                    {line.map((w) => {
                                        const i = wordIndex++;
                                        return (
                                            <span key={w + i} className="mr-[0.22em] inline-block overflow-hidden pb-[0.08em] align-bottom">
                                                <motion.span
                                                    className="inline-block"
                                                    initial={{ y: "115%", rotate: 4 }}
                                                    animate={{ y: 0, rotate: 0 }}
                                                    transition={{ duration: 0.8, delay: 0.1 + i * 0.08, ease: EASE }}
                                                >
                                                    {w}
                                                </motion.span>
                                            </span>
                                        );
                                    })}
                                </span>
                            ))}
                        </h1>

                        <motion.p
                            className="mb-8 text-lg leading-relaxed text-foreground/60 md:text-xl"
                            initial={{ opacity: 0, y: 14 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6, delay: 0.55 }}
                        >
                            Visualize data structures step by step and see exactly what each operation does, with clarity, not guesswork.
                        </motion.p>

                        <motion.div className="flex flex-wrap gap-4" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.7 }}>
                            <Link
                                href={DASHBOARD_HREF}
                                className={cn(
                                    buttonVariants(),
                                    "group h-12 rounded-full bg-accent px-8 font-semibold text-black transition-all hover:-translate-y-0.5 hover:bg-accent/90 active:translate-y-0 active:scale-[0.98]",
                                )}
                            >
                                Start Visualizing
                                <span className="ml-1 inline-block transition-transform group-hover:translate-x-1">→</span>
                            </Link>
                            <Link
                                href="#watch"
                                className={cn(
                                    buttonVariants(),
                                    "h-12 rounded-full border border-foreground/15 bg-foreground/5 px-8 text-foreground transition-all hover:-translate-y-0.5 hover:border-foreground/40 hover:bg-foreground hover:text-background active:scale-[0.98]",
                                )}
                            >
                                Watch the tour
                            </Link>
                        </motion.div>

                        <motion.div className="mt-8 flex flex-wrap gap-x-5 gap-y-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 1 }}>
                            {["No account needed", "Runs in your browser", `${PRODUCT_FACTS.structures} data structures`].map((t) => (
                                <span key={t} className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-widest text-foreground/55">
                                    <HugeiconsIcon icon={Tick02Icon} size={12} color="currentColor" strokeWidth={2} className="text-accent" />
                                    {t}
                                </span>
                            ))}
                        </motion.div>

                        <div className="absolute -bottom-20 left-0 hidden xl:block">
                            <Buddy size={56} />
                        </div>
                    </div>

                    {/* RIGHT: same code editor, same props */}
                    <motion.div
                        className="relative hidden h-full w-full items-center justify-center lg:flex"
                        initial={{ opacity: 0, x: 40 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.9, delay: 0.3, ease: EASE }}
                    >
                        <CometCard className="hidden lg:flex items-center w-full h-full justify-center" translateDepth={5} rotateDepth={5}>
                            <CodeEditor
                                language={"python"}
                                readOnly={true}
                                height="440px"
                                className="w-150"
                                defaultValue={defaultCodeBinarySearch}
                                onChange={(v) => {
                                    if (value !== undefined) setValue(v);
                                }}
                                {...(value !== undefined ? { value } : {})}
                            />
                        </CometCard>

                        {CHIPS.map((c) => (
                            <div key={c.label} className={`af-float pointer-events-none absolute z-20 ${c.pos}`} style={{ animationDelay: c.delay }}>
                                <span className="inline-flex items-center gap-2 rounded-full border border-foreground/15 bg-background/90 px-3.5 py-1.5 font-mono text-xs text-foreground/80">
                                    <HugeiconsIcon icon={c.icon} size={14} color="currentColor" strokeWidth={1.8} className="text-accent" />
                                    {c.label}
                                </span>
                            </div>
                        ))}
                    </motion.div>
                </div>

                <a href="#watch" aria-label="Scroll down" className="absolute bottom-6 left-1/2 hidden -translate-x-1/2 md:block">
                    <div className="flex h-9 w-5 justify-center rounded-full border border-foreground/25 pt-2">
                        <span className="af-scroll-dot h-1.5 w-1 rounded-full bg-accent" />
                    </div>
                </a>
            </section>
        </>
    );
}
__LANDING_FILE_2_EOF__

FILE=HorizontalFeatureScroll.tsx
cat > "$V/$FILE" <<'__LANDING_FILE_3_EOF__'
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
import Manifesto from "./Manifesto";
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
        points: ["Time and space complexity", "Bottlenecks and edge cases", "Today: a sample report, not based on your code"],
    },
    {
        id: "ai-explainer", tag: "Learning", index: "03", status: "planned", title: "AI Explainer",
        description: "Plain-language explanations of an algorithm or snippet.",
        points: ["Explain an algorithm in plain English", "Answer follow-up questions"],
    },
    {
        id: "dashboard", tag: "Productivity", index: "04", status: "planned", title: "Saved Work",
        description: "Keep and revisit your past work in one place.",
        points: ["History of saved visualizations", "Needs accounts and storage, not built yet"],
    },
    {
        id: "share", tag: "Collaboration", index: "05", status: "planned", title: "Shareable Links",
        description: "A link to a visualization that anyone can open.",
        points: ["One link per saved visualization", "Needs a backend, not built yet"],
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
        <section id="watch" className="relative overflow-x-clip px-6 py-28">
            <div className="relative mx-auto max-w-5xl">
                <Reveal className="mb-12 text-center">
                    <Eyebrow>Product tour</Eyebrow>
                    <h2 className="mt-6 text-4xl font-black tracking-tight md:text-6xl">
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
            <Manifesto />
            <VideoBlock />

            <section id="features" className="relative overflow-x-clip px-6 py-28">
                <div className="mx-auto max-w-6xl">
                    <Reveal className="mb-14 text-center">
                        <Eyebrow>Platform features</Eyebrow>
                        <h2 className="mt-6 text-4xl font-black tracking-tight md:text-6xl">
                            Everything in <span className="text-accent">one place.</span>
                        </h2>
                    </Reveal>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {features.map((f, i) => (
                            <Reveal key={f.id} delay={i * 0.08} className={i === 0 ? "lg:col-span-2" : ""}>
                                <SpotCard className="h-full">
                                    <div className="flex h-full flex-col gap-4 p-7">
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
__LANDING_FILE_3_EOF__

FILE=Manifesto.tsx
cat > "$V/$FILE" <<'__LANDING_FILE_4_EOF__'
"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { usePrefersReducedMotion } from "@/lib/reducedMotion";
import { Eyebrow } from "./shared";
import ParticleField from "./ParticleField";

gsap.registerPlugin(ScrollTrigger);

/**
 * "Most tools show you the answer. AlgoForge shows you every single step."
 * Scroll runs a real binary search. Before you scroll you only see the result;
 * each scroll step reveals one comparison: l, mid and r move, the range shrinks,
 * and the trace fills in.
 */
const ARR = [3, 8, 12, 19, 24, 31, 37, 42, 50, 58, 63, 71, 77, 85, 91, 97];
const TARGET = 97;

type Step = { l: number; r: number; m: number; found: boolean; note: string };

function buildTrace(): Step[] {
    const out: Step[] = [];
    let l = 0;
    let r = ARR.length - 1;
    while (l <= r) {
        const m = (l + r) >> 1;
        const v = ARR[m];
        if (v === TARGET) {
            out.push({ l, r, m, found: true, note: `arr[${m}] = ${v}, found it` });
            break;
        }
        if (v < TARGET) {
            out.push({ l, r, m, found: false, note: `arr[${m}] = ${v} < ${TARGET}, go right` });
            l = m + 1;
        } else {
            out.push({ l, r, m, found: false, note: `arr[${m}] = ${v} > ${TARGET}, go left` });
            r = m - 1;
        }
    }
    return out;
}

const STEPS = buildTrace();
const N = STEPS.length;
const ANSWER = STEPS[N - 1].m;
const N_CELLS = ARR.length;

function Words({ text, show, hot = [], dim = [], exitUp = false }: { text: string; show: boolean; hot?: number[]; dim?: number[]; exitUp?: boolean }) {
    return (
        <>
            {text.split(" ").map((w, i) => (
                <span
                    key={i}
                    className={`mr-[0.28em] inline-block transition-all duration-700 ease-[cubic-bezier(.16,1,.3,1)] ${
                        show ? "translate-y-0 opacity-100 blur-0" : `${exitUp ? "-translate-y-5" : "translate-y-5"} opacity-0 blur-sm`
                    } ${hot.includes(i) ? "text-accent" : dim.includes(i) ? "text-foreground/45" : "text-foreground"}`}
                    style={{ transitionDelay: show ? `${i * 55}ms` : `${i * 12}ms` }}
                >
                    {w}
                </span>
            ))}
        </>
    );
}

function Marker({ idx, label, pos, align = "center", on }: { idx: number; label: string; pos: "top" | "bottom"; align?: "left" | "center" | "right"; on: boolean }) {
    const accent = label === "m";
    return (
        <div
            className={`absolute flex flex-col items-center font-mono leading-none transition-[left,opacity] duration-700 ease-[cubic-bezier(.16,1,.3,1)] ${pos === "top" ? "-top-7" : "-bottom-7"} ${on ? "opacity-100" : "opacity-0"} ${accent ? "text-accent" : "text-foreground/60"}`}
            style={{
                left: `calc(${idx} * 100% / ${N_CELLS})`,
                width: `calc(100% / ${N_CELLS})`,
                alignItems: align === "left" ? "flex-start" : align === "right" ? "flex-end" : "center",
                paddingInline: align === "center" ? 0 : 3,
            }}
        >
            {pos === "bottom" && <span className="text-[8px]">▲</span>}
            <span className="text-[10px] font-bold md:text-xs">{label}</span>
            {pos === "top" && <span className="text-[8px]">▼</span>}
        </div>
    );
}

export default function Manifesto() {
    const root = useRef<HTMLElement>(null);
    const reduced = usePrefersReducedMotion();
    const [entered, setEntered] = useState(false);
    const [s, setS] = useState(-1); // -1 = answer only, 0..N-1 = binary search steps

    useEffect(() => {
        if (!reduced) return;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setEntered(true);
        setS(N - 1);
    }, [reduced]);

    useLayoutEffect(() => {
        const el = root.current;
        if (!el || reduced) return;
        const ctx = gsap.context(() => {
            ScrollTrigger.create({ trigger: el, start: "top 75%", once: true, onEnter: () => setEntered(true) });
            ScrollTrigger.create({
                trigger: el,
                start: "top top",
                end: "+=380%",
                pin: true,
                anticipatePin: 1,
                onUpdate: (self) => {
                    const next = Math.min(N - 1, Math.floor(self.progress * (N + 1)) - 1);
                    setS((prev) => (prev === next ? prev : next));
                },
            });
        }, el);
        return () => ctx.revert();
    }, [reduced]);

    const phase1 = s >= 0;
    const st = phase1 ? STEPS[s] : null;
    const done = !!st?.found;
    const rise = (d: number) => ({
        className: `transition-all duration-700 ease-[cubic-bezier(.16,1,.3,1)] ${entered ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"}`,
        style: { transitionDelay: `${d}ms` },
    });

    return (
        <section ref={root} className={`relative flex flex-col items-center justify-center overflow-x-clip px-5 ${reduced ? "py-24" : "h-screen"}`}>
            <ParticleField
                density={0.8}
                className="absolute inset-0 text-foreground [mask-image:radial-gradient(ellipse_at_center,#000_30%,transparent_78%)]"
            />

            <div className="relative z-10 flex w-full max-w-5xl flex-col items-center gap-7 md:gap-9">
                <div {...rise(0)}>
                    <Eyebrow>Why it exists</Eyebrow>
                </div>

                <h2 className="sr-only">Most tools show you the answer. AlgoForge shows you every single step it took to get there.</h2>
                <div aria-hidden className="grid w-full place-items-center text-center text-3xl font-black leading-[1.12] tracking-tight md:text-5xl lg:text-6xl">
                    <span className="col-start-1 row-start-1">
                        <Words text="Most tools show you the answer." show={entered && !phase1} dim={[4, 5]} exitUp />
                    </span>
                    <span className="col-start-1 row-start-1">
                        <Words text="AlgoForge shows you every single step it took to get there." show={entered && phase1} hot={[3, 4, 5]} />
                    </span>
                </div>

                <div className="grid w-full gap-4 lg:grid-cols-[1.7fr_1fr]">
                    {/* visualizer card */}
                    <div {...rise(150)} className={`${rise(150).className} overflow-hidden rounded-3xl border border-foreground/10 bg-background/80 backdrop-blur-sm`}>
                        <div className="flex items-center gap-2 border-b border-foreground/10 bg-foreground/[.03] px-4 py-2.5">
                            <span className="h-2.5 w-2.5 rounded-full bg-accent" />
                            <span className="h-2.5 w-2.5 rounded-full bg-foreground/25" />
                            <span className="h-2.5 w-2.5 rounded-full bg-foreground/15" />
                            <span className="ml-2 font-mono text-[11px] text-foreground/55">binary_search(arr, {TARGET})</span>
                            <span className={`ml-auto rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-widest transition-colors duration-500 ${phase1 ? "border-accent/40 text-accent" : "border-foreground/15 text-foreground/55"}`}>
                                {phase1 ? `step ${s + 1}/${N}` : `returns ${ANSWER}`}
                            </span>
                        </div>

                        <div className="px-3 pb-10 pt-12 md:px-6">
                            <div className="relative">
                                <div className="flex">
                                    {ARR.map((v, i) => {
                                        const inRange = !!st && i >= st.l && i <= st.r;
                                        const isM = !!st && i === st.m;
                                        const isAnswer = !phase1 && i === ANSWER;
                                        const found = done && isM;
                                        const state = found
                                            ? "-translate-y-1 border-accent bg-accent font-bold text-black"
                                            : isAnswer
                                              ? "border-accent bg-accent font-bold text-black"
                                              : isM
                                                ? "-translate-y-1.5 border-accent bg-accent/15 text-foreground"
                                                : phase1
                                                  ? inRange
                                                      ? "border-foreground/25 bg-foreground/[.05] text-foreground"
                                                      : "border-foreground/5 text-foreground/20"
                                                  : "border-foreground/15 bg-foreground/[.03] text-foreground/50";
                                        return (
                                            <div key={i} className="flex-1 p-[2px]">
                                                <div className={`flex h-10 items-center justify-center rounded-lg border font-mono text-[9px] transition-all duration-500 sm:text-xs md:h-14 md:text-sm ${state}`}>
                                                    {v}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="pointer-events-none absolute inset-0">
                                    <Marker idx={st?.m ?? 0} label="m" pos="top" on={phase1} />
                                    <Marker idx={st?.l ?? 0} label="l" pos="bottom" align="left" on={phase1} />
                                    <Marker idx={st?.r ?? N_CELLS - 1} label="r" pos="bottom" align="right" on={phase1} />
                                </div>
                            </div>

                            <p className="mt-9 h-4 truncate font-mono text-[11px] text-accent md:text-xs" aria-live="polite">
                                {st ? `› ${st.note}` : "› ..."}
                            </p>
                        </div>
                    </div>

                    {/* trace */}
                    <div {...rise(250)} className={`${rise(250).className} relative hidden rounded-3xl border border-foreground/10 bg-background/80 p-5 font-mono text-xs backdrop-blur-sm lg:block`}>
                        <div className="mb-4 flex items-center justify-between text-[11px] uppercase tracking-widest text-foreground/45">
                            <span>execution trace</span>
                            <span>{phase1 ? `${s + 1} lines` : "0 lines"}</span>
                        </div>
                        <ol className="space-y-3">
                            {STEPS.map((x, i) => (
                                <li
                                    key={i}
                                    className={`flex gap-2.5 transition-all duration-500 ${i <= s ? "translate-x-0 opacity-100" : "translate-x-3 opacity-0"} ${i === s ? "text-foreground" : "text-foreground/50"}`}
                                >
                                    <span className="text-accent">{String(i + 1).padStart(2, "0")}</span>
                                    <span className="leading-snug">
                                        l={x.l} r={x.r} m={x.m}
                                        <br />
                                        <span className={x.found ? "text-accent" : ""}>{x.note}</span>
                                    </span>
                                </li>
                            ))}
                        </ol>
                        <p className={`absolute inset-x-5 top-1/2 -translate-y-1/2 text-center leading-relaxed text-foreground/45 transition-opacity duration-500 ${phase1 ? "opacity-0" : "opacity-100"}`}>
                            {"// the steps are hidden."}
                            <br />
                            {"// you only get the result."}
                        </p>
                    </div>
                </div>

                {/* progress rail */}
                <div {...rise(350)} className={`${rise(350).className} w-full max-w-md ${reduced ? "hidden" : ""}`}>
                    <div className="flex gap-1.5">
                        {Array.from({ length: N + 1 }).map((_, k) => (
                            <span key={k} className={`h-1 flex-1 rounded-full transition-colors duration-500 ${k <= s + 1 ? "bg-accent" : "bg-foreground/10"}`} />
                        ))}
                    </div>
                    <p className="mt-3 text-center font-mono text-[11px] uppercase tracking-widest text-foreground/45">
                        {!phase1 ? "scroll to step through ↓" : done ? `found in ${N} steps · O(log n)` : `comparing · step ${s + 1} of ${N}`}
                    </p>
                </div>
            </div>
        </section>
    );
}
__LANDING_FILE_4_EOF__

FILE=ParticleField.tsx
cat > "$V/$FILE" <<'__LANDING_FILE_5_EOF__'
"use client";

import { useEffect, useRef } from "react";
import { prefersReducedMotion } from "@/lib/reducedMotion";

type RGB = [number, number, number];
type P = { x: number; y: number; vx: number; vy: number; r: number; z: number; hot: boolean; ph: number; pulse: number; rx: number; ry: number };
type Star = { x: number; y: number; vx: number; vy: number; len: number; t: number; max: number; accent: boolean };
type Packet = { a: number; b: number; t: number; spd: number };

const rand = (a: number, b: number) => a + Math.random() * (b - a);

/** Normalises any CSS colour (hex, rgb, oklch, color-mix) to rgb via a 1px canvas. */
function parseColor(css: string, fallback: RGB): RGB {
    try {
        const cv = document.createElement("canvas");
        cv.width = cv.height = 1;
        const x = cv.getContext("2d", { willReadFrequently: true });
        if (!x) return fallback;
        x.fillStyle = "#010203";
        x.fillStyle = css;
        if (x.fillStyle === "#010203") return fallback;
        x.fillRect(0, 0, 1, 1);
        const d = x.getImageData(0, 0, 1, 1).data;
        return [d[0], d[1], d[2]];
    } catch {
        return fallback;
    }
}

/**
 * A quiet living graph, on theme for a DSA product:
 *  - depth-layered nodes with parallax, twinkle and slow drift
 *  - edges between near nodes; nodes near the cursor link to it and get nudged away
 *  - data "packets" travel along edges and make the destination node pulse
 *  - occasional shooting stars streak across at random
 * No glow or blur. Pauses off-screen, static when reduced motion is on.
 * Colour comes from CSS `color` (use text-foreground) and the --accent variable.
 */
export default function ParticleField({
    className = "",
    density = 1,
    link = 120,
    stars = true,
    packets = true,
    starEvery = [3, 8],
}: {
    className?: string;
    density?: number;
    link?: number;
    stars?: boolean;
    packets?: boolean;
    /** min / max seconds between shooting stars */
    starEvery?: [number, number];
}) {
    const ref = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const c = ref.current;
        const ctx = c?.getContext("2d");
        if (!c || !ctx) return;

        const reduce = prefersReducedMotion();
        let w = 0, h = 0, raf = 0, visible = true;
        let last = performance.now();
        let pts: P[] = [];
        let shooting: Star[] = [];
        let packs: Packet[] = [];
        let fg: RGB = [255, 255, 255];
        let ac: RGB = [255, 77, 26];
        let nextStar = last + rand(starEvery[0], starEvery[1]) * 1000;
        let nextPacket = last + 700;
        const mouse = { x: 0, y: 0, on: false };
        const rgba = (col: RGB, a: number) => `rgba(${col[0]},${col[1]},${col[2]},${a})`;

        const colors = () => {
            fg = parseColor(getComputedStyle(c).color, fg);
            ac = parseColor(getComputedStyle(document.documentElement).getPropertyValue("--accent").trim(), ac);
        };

        const spawnStar = () => {
            const dir = Math.random() < 0.5 ? 1 : -1;
            const ang = rand(0.3, 0.6);
            const sp = rand(9, 14);
            shooting.push({
                x: dir > 0 ? rand(-0.05 * w, 0.55 * w) : rand(0.45 * w, 1.05 * w),
                y: rand(-0.05 * h, 0.5 * h),
                vx: dir * Math.cos(ang) * sp,
                vy: Math.sin(ang) * sp,
                len: rand(90, 160),
                t: 0,
                max: rand(45, 80),
                accent: Math.random() < 0.3,
            });
        };

        const spawnPacket = () => {
            for (let tries = 0; tries < 8; tries++) {
                const a = Math.floor(Math.random() * pts.length);
                const near: number[] = [];
                for (let j = 0; j < pts.length; j++) {
                    if (j !== a && Math.hypot(pts[a].rx - pts[j].rx, pts[a].ry - pts[j].ry) < link * 0.9) near.push(j);
                }
                if (near.length) {
                    packs.push({ a, b: near[Math.floor(Math.random() * near.length)], t: 0, spd: rand(0.012, 0.025) });
                    return;
                }
            }
        };

        const step = (now: number, still = false) => {
            const dt = still ? 0 : Math.min(3, (now - last) / 16.667);
            last = now;
            const mx = mouse.on ? mouse.x - w / 2 : 0;
            const my = mouse.on ? mouse.y - h / 2 : 0;

            // update nodes
            for (const p of pts) {
                if (!still) {
                    if (mouse.on) {
                        const dx = p.x - mouse.x;
                        const dy = p.y - mouse.y;
                        const d = Math.hypot(dx, dy);
                        if (d < 110 && d > 0) {
                            p.vx += (dx / d) * 0.02 * dt;
                            p.vy += (dy / d) * 0.02 * dt;
                        }
                    }
                    const damp = Math.pow(0.99, dt);
                    p.vx *= damp;
                    p.vy *= damp;
                    if (Math.abs(p.vx) < 0.05) p.vx += (Math.random() - 0.5) * 0.01;
                    if (Math.abs(p.vy) < 0.05) p.vy += (Math.random() - 0.5) * 0.01;
                    p.x += p.vx * dt * p.z;
                    p.y += p.vy * dt * p.z;
                    if (p.x < -10) p.x = w + 10;
                    if (p.x > w + 10) p.x = -10;
                    if (p.y < -10) p.y = h + 10;
                    if (p.y > h + 10) p.y = -10;
                    p.pulse *= Math.pow(0.94, dt);
                }
                p.rx = p.x + mx * (p.z - 0.7) * 0.05;
                p.ry = p.y + my * (p.z - 0.7) * 0.05;
            }

            // spawn
            if (!still && visible) {
                if (stars && now >= nextStar) {
                    spawnStar();
                    if (Math.random() < 0.2) spawnStar();
                    nextStar = now + rand(starEvery[0], starEvery[1]) * 1000;
                }
                if (packets && now >= nextPacket && packs.length < 4 && pts.length > 4) {
                    spawnPacket();
                    nextPacket = now + rand(500, 1300);
                }
            }

            ctx.clearRect(0, 0, w, h);
            ctx.lineWidth = 1;

            // edges
            ctx.strokeStyle = rgba(fg, 1);
            for (let i = 0; i < pts.length; i++) {
                for (let j = i + 1; j < pts.length; j++) {
                    const d = Math.hypot(pts[i].rx - pts[j].rx, pts[i].ry - pts[j].ry);
                    if (d < link) {
                        ctx.globalAlpha = (1 - d / link) * 0.16 * (0.6 + 0.2 * (pts[i].z + pts[j].z));
                        ctx.beginPath();
                        ctx.moveTo(pts[i].rx, pts[i].ry);
                        ctx.lineTo(pts[j].rx, pts[j].ry);
                        ctx.stroke();
                    }
                }
            }

            // cursor links
            if (mouse.on) {
                ctx.strokeStyle = rgba(ac, 1);
                for (const p of pts) {
                    const d = Math.hypot(p.rx - mouse.x, p.ry - mouse.y);
                    if (d < 150) {
                        ctx.globalAlpha = (1 - d / 150) * 0.45;
                        ctx.beginPath();
                        ctx.moveTo(p.rx, p.ry);
                        ctx.lineTo(mouse.x, mouse.y);
                        ctx.stroke();
                    }
                }
            }

            // packets travelling along edges
            ctx.strokeStyle = rgba(ac, 1);
            ctx.fillStyle = rgba(ac, 1);
            packs = packs.filter((k) => {
                const A = pts[k.a];
                const B = pts[k.b];
                if (!A || !B) return false;
                if (Math.hypot(A.rx - B.rx, A.ry - B.ry) > link * 1.2) return false;
                k.t += k.spd * dt;
                if (k.t >= 1) {
                    B.pulse = 1;
                    return false;
                }
                const hx = A.rx + (B.rx - A.rx) * k.t;
                const hy = A.ry + (B.ry - A.ry) * k.t;
                const t0 = Math.max(0, k.t - 0.2);
                ctx.globalAlpha = 0.7;
                ctx.beginPath();
                ctx.moveTo(A.rx + (B.rx - A.rx) * t0, A.ry + (B.ry - A.ry) * t0);
                ctx.lineTo(hx, hy);
                ctx.stroke();
                ctx.globalAlpha = 1;
                ctx.beginPath();
                ctx.arc(hx, hy, 2, 0, Math.PI * 2);
                ctx.fill();
                return true;
            });

            // nodes
            for (const p of pts) {
                const tw = 0.75 + 0.25 * Math.sin(now / 1000 * 1.3 + p.ph);
                ctx.globalAlpha = (p.hot ? 0.9 : 0.25 + 0.3 * p.z) * tw;
                ctx.fillStyle = rgba(p.hot ? ac : fg, 1);
                ctx.beginPath();
                ctx.arc(p.rx, p.ry, (p.hot ? p.r + 0.6 : p.r) * (0.7 + 0.3 * p.z), 0, Math.PI * 2);
                ctx.fill();
                if (p.pulse > 0.02) {
                    ctx.globalAlpha = p.pulse * 0.6;
                    ctx.strokeStyle = rgba(ac, 1);
                    ctx.beginPath();
                    ctx.arc(p.rx, p.ry, p.r + (1 - p.pulse) * 10, 0, Math.PI * 2);
                    ctx.stroke();
                }
            }

            // shooting stars
            shooting = shooting.filter((s) => {
                s.x += s.vx * dt;
                s.y += s.vy * dt;
                s.t += dt;
                if (s.t > s.max) return false;
                const sp = Math.hypot(s.vx, s.vy) || 1;
                const tx = s.x - (s.vx / sp) * s.len;
                const ty = s.y - (s.vy / sp) * s.len;
                const col = s.accent ? ac : fg;
                const g = ctx.createLinearGradient(tx, ty, s.x, s.y);
                g.addColorStop(0, rgba(col, 0));
                g.addColorStop(1, rgba(col, 1));
                ctx.globalAlpha = Math.max(0, Math.min(1, s.t / 8, (s.max - s.t) / 25)) * 0.85;
                ctx.strokeStyle = g;
                ctx.lineWidth = 1.4;
                ctx.beginPath();
                ctx.moveTo(tx, ty);
                ctx.lineTo(s.x, s.y);
                ctx.stroke();
                ctx.fillStyle = rgba(col, 1);
                ctx.beginPath();
                ctx.arc(s.x, s.y, 1.5, 0, Math.PI * 2);
                ctx.fill();
                ctx.lineWidth = 1;
                return true;
            });
            ctx.globalAlpha = 1;
        };

        const resize = () => {
            const r = c.getBoundingClientRect();
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            w = r.width;
            h = r.height;
            c.width = Math.round(w * dpr);
            c.height = Math.round(h * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            const n = Math.min(100, Math.round(((w * h) / 16000) * density));
            pts = Array.from({ length: n }, (_, i) => {
                const x = Math.random() * w;
                const y = Math.random() * h;
                return {
                    x, y, rx: x, ry: y,
                    vx: (Math.random() - 0.5) * 0.25,
                    vy: (Math.random() - 0.5) * 0.25,
                    r: Math.random() * 1.2 + 0.8,
                    z: rand(0.4, 1),
                    hot: i % 9 === 0,
                    ph: Math.random() * Math.PI * 2,
                    pulse: 0,
                };
            });
            packs = [];
            colors();
            step(performance.now(), true);
        };

        const loop = (now: number) => {
            if (visible) step(now);
            else last = now;
            raf = requestAnimationFrame(loop);
        };

        const onMove = (e: MouseEvent) => {
            const r = c.getBoundingClientRect();
            mouse.x = e.clientX - r.left;
            mouse.y = e.clientY - r.top;
            mouse.on = mouse.x > -60 && mouse.y > -60 && mouse.x < r.width + 60 && mouse.y < r.height + 60;
        };
        const onLeave = () => { mouse.on = false; };

        resize();
        const ro = new ResizeObserver(resize);
        ro.observe(c);
        const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; });
        io.observe(c);
        if (!reduce) {
            window.addEventListener("mousemove", onMove, { passive: true });
            document.addEventListener("mouseleave", onLeave);
            raf = requestAnimationFrame(loop);
        }
        return () => {
            cancelAnimationFrame(raf);
            ro.disconnect();
            io.disconnect();
            window.removeEventListener("mousemove", onMove);
            document.removeEventListener("mouseleave", onLeave);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [density, link, stars, packets, starEvery[0], starEvery[1]]);

    return <canvas ref={ref} aria-hidden className={`pointer-events-none h-full w-full ${className}`} />;
}
__LANDING_FILE_5_EOF__

FILE=shared.tsx
cat > "$V/$FILE" <<'__LANDING_FILE_6_EOF__'
"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { motion, useReducedMotion, useScroll, useSpring } from "framer-motion";
import { HugeiconsIcon } from "@hugeicons/react";
import type { IconSvgObject } from "@/lib/types";
import { prefersReducedMotion } from "@/lib/reducedMotion";

/** Tiny keyframe sheet shared by every landing section (CSS only, cheap). */
export function LandingStyles() {
    return (
        <style>{`
@keyframes af-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
@keyframes af-wiggle{0%,100%{transform:rotate(0)}25%{transform:rotate(-8deg)}75%{transform:rotate(8deg)}}
@keyframes af-ping{0%{transform:scale(1);opacity:.5}100%{transform:scale(2.4);opacity:0}}
@keyframes af-marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}
@keyframes af-marquee-rev{from{transform:translateX(-50%)}to{transform:translateX(0)}}
@keyframes af-eye{0%,92%,100%{transform:scaleY(1)}96%{transform:scaleY(.1)}}
@keyframes af-spin{to{transform:rotate(360deg)}}
@keyframes af-scroll{0%{transform:translateY(0);opacity:1}100%{transform:translateY(12px);opacity:0}}
.af-float{animation:af-float 5s ease-in-out infinite}
.af-ping{animation:af-ping 2.4s ease-out infinite}
.af-marquee{animation:af-marquee 38s linear infinite}
.af-marquee-rev{animation:af-marquee-rev 44s linear infinite}
.af-marquee-track:hover{animation-play-state:paused}
.af-eye{animation:af-eye 5s ease-in-out infinite}
.af-orbit{animation:af-spin 26s linear infinite}
.af-orbit-item{animation:af-spin 26s linear infinite reverse}
.af-scroll-dot{animation:af-scroll 1.6s ease-in-out infinite}
.af-reveal{opacity:0;transform:translateY(14px);transition:opacity .5s ease,transform .5s ease}
.af-in{opacity:1;transform:none}
@media (prefers-reduced-motion: reduce){
  .af-float,.af-ping,.af-marquee,.af-marquee-rev,.af-eye,.af-orbit,.af-orbit-item,.af-scroll-dot{animation:none!important}
  .af-reveal{opacity:1;transform:none;transition:none}
}
`}</style>
    );
}

/** Thin accent progress line pinned to the top of the viewport. */
export function ScrollProgress() {
    const { scrollYProgress } = useScroll();
    const scaleX = useSpring(scrollYProgress, { stiffness: 140, damping: 30, mass: 0.3 });
    return <motion.div aria-hidden style={{ scaleX }} className="fixed inset-x-0 top-0 z-[1000] h-[2px] origin-left bg-accent" />;
}

export function Eyebrow({ children }: { children: ReactNode }) {
    return (
        <div className="inline-flex items-center gap-2 rounded-full border border-foreground/10 bg-foreground/[.04] px-4 py-1.5">
            <span className="relative flex h-2 w-2">
                <span className="af-ping absolute inline-flex h-full w-full rounded-full bg-accent" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
            </span>
            <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-foreground/60">{children}</span>
        </div>
    );
}

export function Reveal({ children, delay = 0, y = 22, className = "" }: { children: ReactNode; delay?: number; y?: number; className?: string }) {
    const reduce = useReducedMotion();
    return (
        <motion.div
            className={className}
            initial={reduce ? false : { opacity: 0, y, filter: "blur(4px)" }}
            whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}
        >
            {children}
        </motion.div>
    );
}

/** Card with a faint cursor-following highlight and a lift on hover. */
export function SpotCard({ children, className = "" }: { children: ReactNode; className?: string }) {
    return (
        <div
            onMouseMove={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
                e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
            }}
            className={`group relative overflow-hidden rounded-3xl border border-foreground/10 bg-foreground/[.03] transition-all duration-300 hover:-translate-y-1 hover:border-accent/30 ${className}`}
        >
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                style={{ background: "radial-gradient(240px circle at var(--mx,50%) var(--my,50%), color-mix(in srgb, var(--accent) 7%, transparent), transparent 70%)" }}
            />
            <div className="relative h-full">{children}</div>
        </div>
    );
}

export function IconBubble({ icon, size = 20 }: { icon: IconSvgObject; size?: number }) {
    return (
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-foreground/10 bg-foreground/[.04] text-foreground/70 transition-colors duration-300 group-hover:border-accent/40 group-hover:bg-accent/10 group-hover:text-accent group-hover:[animation:af-wiggle_.6s_ease-in-out]">
            <HugeiconsIcon icon={icon} size={size} color="currentColor" strokeWidth={1.5} />
        </span>
    );
}

/** Orange mascot. Eyes follow the cursor (desktop), blink, float. */
export function Buddy({ size = 72, track = true }: { size?: number; track?: boolean }) {
    const left = useRef<HTMLSpanElement>(null);
    const right = useRef<HTMLSpanElement>(null);

    useEffect(() => {
        if (!track || prefersReducedMotion()) return;
        const on = (e: MouseEvent) => {
            [left.current, right.current].forEach((p) => {
                const eye = p?.parentElement;
                if (!p || !eye) return;
                const b = eye.getBoundingClientRect();
                const dx = e.clientX - (b.left + b.width / 2);
                const dy = e.clientY - (b.top + b.height / 2);
                const d = Math.hypot(dx, dy) || 1;
                const m = Math.min(size * 0.06, d / 25);
                p.style.transform = `translate(${(dx / d) * m}px,${(dy / d) * m}px)`;
            });
        };
        window.addEventListener("mousemove", on, { passive: true });
        return () => window.removeEventListener("mousemove", on);
    }, [track, size]);

    const eye = size * 0.24;
    return (
        <div className="af-float relative shrink-0" style={{ width: size, height: size }} aria-hidden>
            <div className="absolute inset-0 rounded-[30%] bg-accent shadow-[0_8px_16px_-10px_rgba(0,0,0,0.7)]" />
            <div className="absolute left-1/2 top-[34%] flex -translate-x-1/2" style={{ gap: size * 0.16 }}>
                {[left, right].map((r, i) => (
                    <span key={i} className="af-eye flex items-center justify-center rounded-full bg-white" style={{ width: eye, height: eye }}>
                        <span ref={r} className="block rounded-full bg-black" style={{ width: eye * 0.5, height: eye * 0.5 }} />
                    </span>
                ))}
            </div>
            <span className="absolute left-1/2 -translate-x-1/2 rounded-b-full border-b-[3px] border-black" style={{ top: "62%", width: size * 0.22, height: size * 0.11 }} />
            <span className="absolute rounded-full bg-white/30" style={{ left: "14%", top: "58%", width: size * 0.13, height: size * 0.08 }} />
            <span className="absolute rounded-full bg-white/30" style={{ right: "14%", top: "58%", width: size * 0.13, height: size * 0.08 }} />
        </div>
    );
}
__LANDING_FILE_6_EOF__

# Mobile page: drop the blurred orange glow behind the hero
M="$V/MobileTabletLandingPage.tsx"
if [ -f "$M" ]; then
    sed -i.bak '/absolute -top-10 right-0 h-48 w-48/d' "$M" && rm -f "$M.bak"
fi

echo "Landing page upgrade applied."