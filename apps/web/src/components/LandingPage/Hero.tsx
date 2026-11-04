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

            <section id="home" className="relative min-h-svh overflow-x-clip pt-20">
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

                <div className="relative z-10 mx-auto grid min-h-[calc(100svh-5rem)] max-w-7xl grid-cols-1 items-center gap-10 px-4 py-10 sm:px-6 lg:grid-cols-2 lg:py-0">
                    <div className="relative max-w-xl">
                        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                            <Eyebrow>Built for learning data structures</Eyebrow>
                        </motion.div>

                        <h1 className="mb-6 mt-6 text-4xl font-bold leading-[0.95] tracking-tight text-foreground min-[400px]:text-5xl md:text-6xl lg:text-7xl">
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
                            className="mb-8 text-base leading-relaxed text-foreground/60 sm:text-lg md:text-xl"
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
                                    "group h-12 w-full justify-center rounded-full bg-accent px-6 font-semibold text-black transition-all hover:-translate-y-0.5 hover:bg-accent/90 active:translate-y-0 active:scale-[0.98] sm:w-auto sm:px-8",
                                )}
                            >
                                Start Visualizing
                                <span className="ml-1 inline-block transition-transform group-hover:translate-x-1">→</span>
                            </Link>
                            <Link
                                href="#watch"
                                className={cn(
                                    buttonVariants(),
                                    "h-12 w-full justify-center rounded-full border border-foreground/15 bg-foreground/5 px-6 text-foreground transition-all hover:-translate-y-0.5 hover:border-foreground/40 hover:bg-foreground hover:text-background active:scale-[0.98] sm:w-auto sm:px-8",
                                )}
                            >
                                Watch the tour
                            </Link>
                        </motion.div>

                        <motion.div className="mt-8 flex flex-wrap gap-x-5 gap-y-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 1 }}>
                            {["No account needed to visualize", "Runs in your browser", `${PRODUCT_FACTS.structures} data structures`].map((t) => (
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
                                className="w-full max-w-150"
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

                <a href="#watch" aria-label="Scroll down" className="absolute bottom-6 left-1/2 hidden -translate-x-1/2 lg:block">
                    <div className="flex h-9 w-5 justify-center rounded-full border border-foreground/25 pt-2">
                        <span className="af-scroll-dot h-1.5 w-1 rounded-full bg-accent" />
                    </div>
                </a>
            </section>
        </>
    );
}
