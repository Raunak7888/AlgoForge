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

const TRUST_ITEMS = ["No account needed to visualize", "Runs in your browser"];
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
        <section className="relative overflow-x-clip px-4 py-16 md:px-8 md:py-24">
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
                className="relative mx-auto grid max-w-6xl items-center gap-10 overflow-hidden rounded-3xl border border-foreground/15 bg-foreground/[.03] p-6 sm:rounded-[2.5rem] sm:p-8 md:grid-cols-[1.15fr_1fr] md:gap-14 md:p-14"
            >
                <ParticleField density={0.6} className="absolute inset-0 text-foreground [mask-image:radial-gradient(ellipse_at_80%_50%,#000_20%,transparent_75%)]" />

                {/* Left: copy */}
                <div className="relative flex flex-col items-start gap-6">
                    <Eyebrow>Try it in your browser</Eyebrow>
                    <h2 className="text-3xl font-black leading-[1.02] tracking-tight sm:text-4xl md:text-6xl">
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
                                    <div className="text-lg font-black tracking-tight sm:text-xl">{s.v}</div>
                                    <div className="font-mono text-[10px] uppercase tracking-widest text-foreground/55">{s.l}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="absolute right-1 -top-6 md:-right-5 md:-top-10">
                        <Buddy size={68} />
                    </div>
                </div>
            </motion.div>
        </section>
    );
}
