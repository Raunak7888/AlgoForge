// FeatureCard.tsx
"use client";

import { useRef } from "react";
import { motion, Variants } from "framer-motion";
import { HugeiconsIcon } from "@hugeicons/react";
import gsap from "gsap";
import { Tick02Icon } from "@hugeicons/core-free-icons";

type FeatureCardProps = {
    points: string[];
};

const listVariants: Variants = {
    hidden: {},
    visible: {
        transition: { staggerChildren: 0.07, delayChildren: 0.15 },
    },
};

const itemVariants: Variants = {
    hidden: { opacity: 0, x: -14 },
    visible: {
        opacity: 1,
        x: 0,
        transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] },
    },
};

function PointItem({ point }: { point: string }) {
    const ref = useRef<HTMLLIElement>(null);
    const lineRef = useRef<HTMLDivElement>(null);

    const onEnter = () => {
        gsap.to(ref.current, {
            x: 5,
            borderColor: "rgba(var(--accent), 0.3)",
            duration: 0.25,
            ease: "power2.out",
        });
        gsap.fromTo(
            lineRef.current,
            { scaleX: 0, transformOrigin: "left center" },
            { scaleX: 1, duration: 0.25, ease: "power3.out" },
        );
    };

    const onLeave = () => {
        gsap.to(ref.current, {
            x: 0,
            borderColor: "rgba(255,255,255,0.06)",
            duration: 0.25,
            ease: "power2.inOut",
        });
        gsap.to(lineRef.current, {
            scaleX: 0,
            transformOrigin: "right center",
            duration: 0.25,
            ease: "power2.in",
        });
    };

    return (
        <motion.li
            ref={ref}
            variants={itemVariants}
            className="
                relative group flex items-center gap-3 px-4 py-3 cursor-default
                border border-foreground/6
                bg-foreground/3 rounded-2xl
                backdrop-blur-sm
                overflow-hidden
            "
            onMouseEnter={onEnter}
            onMouseLeave={onLeave}
            style={{ willChange: "transform" }}
        >
            {/* Check icon */}
            <span className="flex h-5 w-5 shrink-0 items-center justify-center border border-accent/20 bg-accent/5">
                <HugeiconsIcon
                    icon={Tick02Icon}
                    size={11}
                    color="currentColor"
                    strokeWidth={2}
                    className="text-accent"
                />
            </span>

            <span className="text-sm font-medium text-foreground/60 group-hover:text-foreground/90 transition-colors duration-200">
                {point}
            </span>

            {/* Bottom accent line — GSAP */}
            <div
                ref={lineRef}
                className="absolute bottom-0 left-0 h-px w-full bg-accent"
                style={{
                    transform: "scaleX(0)",
                    transformOrigin: "left center",
                }}
            />
        </motion.li>
    );
}

export default function FeatureCard({ points }: FeatureCardProps) {
    return (
        /* Glassmorphism shell */
        <div
            className="
                relative overflow-hidden
                border border-foreground/10
                bg-foreground/4 rounded-2xl
                backdrop-blur-xl
                p-px
            "
        >
            {/* Inner glass layer */}
            <div
                className="
                    relative
                    bg-background/60
                    backdrop-blur-2xl
                    border border-foreground/6
                    p-6
                "
            >
                {/* Top accent line */}
                <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-accent to-transparent opacity-40" />

                <motion.ul
                    variants={listVariants}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: false, margin: "-60px" }}
                    className="flex flex-col gap-2"
                >
                    {points.map((point, i) => (
                        <PointItem key={i} point={point} />
                    ))}
                </motion.ul>
            </div>
        </div>
    );
}
