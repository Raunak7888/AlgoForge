// FeaturePanel.tsx
"use client";

import { useRef } from "react";
import { motion, Variants } from "framer-motion";
import FeatureCard from "@/components/ui/FeatureCard";
import { StatusChip } from "@/components/ui/StatusChip";
import type { FeatureStatus } from "@/lib/featureStatus";

export type Feature = {
    id: string;
    tag: string;
    index: string;
    status: FeatureStatus;
    title: string;
    description: string;
    points: string[];
};

const containerVariants: Variants = {
    hidden: {},
    visible: {
        transition: { staggerChildren: 0.09, delayChildren: 0.05 },
    },
};

const itemVariants: Variants = {
    hidden: { opacity: 0, y: 18 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] },
    },
};

export default function FeaturePanel({ feature }: { feature: Feature }) {
    return (
        <div className="grid w-full max-w-6xl grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-24 items-center">
            {/* ── Left: text ── */}
            <motion.div
                variants={containerVariants}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: false, margin: "-80px" }}
                className="flex flex-col gap-6"
            >
                {/* Eyebrow */}
                <motion.div
                    variants={itemVariants}
                    className="inline-flex items-center gap-2 rounded-2xl w-fit border border-foreground/15 bg-foreground/[.04] px-3 py-1"
                >
                    <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                    <span className="font-mono text-[11px]  uppercase tracking-widest font-bold text-foreground/60">
                        {feature.tag}
                    </span>
                    <StatusChip status={feature.status} />
                </motion.div>

                {/* Index + Title */}
                <motion.div variants={itemVariants} className="flex items-start gap-4">
                    <span className="font-mono text-xs text-foreground/60 tracking-widest mt-2 select-none">
                        {feature.index}
                    </span>
                    <h2 className="text-4xl font-black leading-tight tracking-tight text-foreground md:text-5xl xl:text-6xl">
                        {feature.title}
                    </h2>
                </motion.div>

                {/* Description */}
                <motion.p
                    variants={itemVariants}
                    className="max-w-md text-sm leading-relaxed text-foreground/60"
                >
                    {feature.description}
                </motion.p>

                {/* Decorative rule */}
                <motion.div
                    variants={itemVariants}
                    className="flex items-center gap-3"
                >
                    <div className="h-px w-8 bg-foreground/10" />
                    <div className="h-px w-16 bg-accent" />
                    <div className="h-px w-8 bg-foreground/10" />
                </motion.div>
            </motion.div>

            {/* ── Right: card ── */}
            <motion.div
                variants={containerVariants}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: false, margin: "-80px" }}
            >
                <FeatureCard points={feature.points} />
            </motion.div>
        </div>
    );
}