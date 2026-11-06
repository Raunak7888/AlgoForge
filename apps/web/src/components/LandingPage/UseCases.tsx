"use client";

import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { GraduationScrollIcon, JobSearchIcon, TeacherIcon, ArrowRight02Icon, CodeIcon } from "@hugeicons/core-free-icons";
import { IconSvgObject } from "@/lib/types";
import { DASHBOARD_HREF } from "@/lib/site";
import { Eyebrow, IconBubble, Reveal, SpotCard } from "./shared";

type UseCasesCard = {
    id: string;
    role: string;
    tagline: string;
    description: string;
    cta: string;
    Icon: IconSvgObject;
    badge: string;
    stat: string;
    size: "normal" | "large";
};

const CARDS: UseCasesCard[] = [
    {
        id: "student", role: "Students", tagline: "See the structure, not just the code.",
        description: "Write a short script and watch arrays, trees, graphs and hash tables change one operation at a time. Pause, step back and replay until it makes sense.",
        cta: "Step through an example", Icon: GraduationScrollIcon, badge: "Student", stat: "Step back and replay", size: "large",
    },
    {
        id: "developer", role: "Developers", tagline: "Check a structure before you build on it.",
        description: "Insert, delete and swap, and see exactly which pointers and buckets change. Rejected operations are shown, not hidden.",
        cta: "Test a structure", Icon: CodeIcon, badge: "Developer", stat: "Pointer-level steps", size: "normal",
    },
    {
        id: "interviewee", role: "Interview Candidates", tagline: "Rehearse the walkthrough.",
        description: "Practise explaining how a hash map handles a collision or how a BST deletes a node, with the steps on screen as you talk.",
        cta: "Practice a walkthrough", Icon: JobSearchIcon, badge: "Interviewee", stat: "Collisions and BST deletes", size: "normal",
    },
    {
        id: "teacher", role: "Teachers & Educators", tagline: "Narrate it once, replay it in class.",
        description: "Each step in a script can carry a message. Write the walkthrough once and replay it at any speed, as often as you need.",
        cta: "Build a narrated script", Icon: TeacherIcon, badge: "Educator", stat: "Narrated steps", size: "large",
    },
];

export default function UseCases() {
    return (
        <section id="usecases" className="relative flex flex-col justify-center overflow-x-clip px-4 py-16 md:px-8 md:py-28">
            <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-10">
                <Reveal className="mx-auto max-w-2xl text-center">
                    <Eyebrow>Who it&apos;s for</Eyebrow>
                    <h2 className="mt-6 text-3xl font-black leading-[1.08] tracking-tight sm:text-4xl md:text-5xl">
                        One platform. <span className="text-accent">Every type</span> of coder.
                    </h2>
                </Reveal>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {CARDS.map((card, i) => (
                        <Reveal key={card.id} delay={i * 0.08} className={card.size === "large" ? "md:col-span-2" : ""}>
                            <SpotCard className="h-full">
                                <div className="flex h-full flex-col gap-3 p-5 sm:p-6">
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <IconBubble icon={card.Icon} />
                                        <div className="flex flex-wrap items-center justify-end gap-2">
                                            <span className="rounded-full border border-accent/25 bg-accent/10 px-2.5 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-widest text-accent">
                                                {card.badge}
                                            </span>
                                            <span className="rounded-full border border-foreground/10 px-2.5 py-0.5 font-mono text-[11px] text-foreground/60">
                                                {card.stat}
                                            </span>
                                        </div>
                                    </div>
                                    <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
                                        For {card.role}
                                    </p>
                                    <h3 className="text-xl font-bold leading-snug">{card.tagline}</h3>
                                    <p className="flex-1 text-sm leading-relaxed text-foreground/60">{card.description}</p>
                                    <Link
                                        href={DASHBOARD_HREF}
                                        className="group/btn mt-3 flex w-full items-center justify-center gap-2 rounded-full border border-foreground/10 bg-foreground/[.03] py-2.5 text-sm font-semibold text-foreground/70 transition-all duration-200 hover:border-accent/40 hover:bg-accent/10 hover:text-foreground"
                                    >
                                        <span>{card.cta}</span>
                                        <HugeiconsIcon icon={ArrowRight02Icon} size={15} color="currentColor" strokeWidth={1.5} className="transition-transform duration-200 group-hover/btn:translate-x-1" />
                                    </Link>
                                </div>
                            </SpotCard>
                        </Reveal>
                    ))}
                </div>

                <div className="flex items-center justify-between px-1">
                    <span className="font-mono text-[11px] uppercase tracking-widest text-foreground/60">4 use cases</span>
                    <span className="font-mono text-[11px] uppercase tracking-widest text-accent">Preview</span>
                </div>
            </div>
        </section>
    );
}
