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
        <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-foreground/10 bg-foreground/[.04] px-3 py-1.5 sm:px-4">
            <span className="relative flex h-2 w-2">
                <span className="af-ping absolute inline-flex h-full w-full rounded-full bg-accent" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
            </span>
            <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-foreground/60 sm:text-[11px] sm:tracking-widest">{children}</span>
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
