"use client";

import React, { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { gsap } from "gsap";
import { HugeiconsIcon } from "@hugeicons/react";
import { TwitterIcon, Linkedin01Icon, GithubIcon, Facebook01Icon, InstagramIcon } from "@hugeicons/core-free-icons";
import AlgoForgeLogo from "../Logo";
import { DASHBOARD_HREF, SITE } from "@/lib/site";
import type { IconSvgObject } from "@/lib/types";
import { prefersReducedMotion } from "@/lib/reducedMotion";
import { Buddy } from "./shared";

// ✏️ EDIT THESE: put your real profile URLs here.
const SOCIALS: { label: string; href: string; icon: IconSvgObject }[] = [
    { label: "GitHub", href: "https://github.com/your-username", icon: GithubIcon },
    { label: "Instagram", href: "https://instagram.com/your-username", icon: InstagramIcon },
    { label: "X", href: "https://x.com/your-username", icon: TwitterIcon },
    { label: "LinkedIn", href: "https://linkedin.com/in/your-username", icon: Linkedin01Icon },
    { label: "Facebook", href: "https://facebook.com/your-username", icon: Facebook01Icon },
];

const LINK_GROUPS: { title: string; links: { label: string; href: string }[] }[] = [
    {
        title: "Explore",
        links: [
            { label: "Home", href: "#home" },
            { label: "Features", href: "#features" },
            { label: "Live Demo", href: "#watch" },
            { label: "Products", href: "#products" },
            { label: "Use Cases", href: "#usecases" },
        ],
    },
    {
        title: "Product",
        links: [
            { label: "Product tour", href: "#watch" },
            { label: "Open the visualizer", href: DASHBOARD_HREF },
        ],
    },
];

const Footer = () => {
    const footerRef = useRef(null);

    useEffect(() => {
        if (prefersReducedMotion()) return;
        const ctx = gsap.context(() => {
            gsap.from(".footer-item", { y: 30, opacity: 0, duration: 1, stagger: 0.12, ease: "expo.out", delay: 0.2 });
        }, footerRef);
        return () => ctx.revert();
    }, []);

    return (
        <footer ref={footerRef} className="overflow-x-clip px-4 pb-10 pt-8 font-sans">
            <div className="mx-auto max-w-6xl rounded-3xl border border-foreground/10 bg-foreground/[.02] px-5 py-8 sm:rounded-[2.5rem] sm:px-6 sm:py-10 md:px-10">
                <div className="grid grid-cols-2 gap-x-6 gap-y-10 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr] lg:gap-10">
                    <div className="footer-item col-span-2 flex flex-col items-start gap-4 lg:col-span-1">
                        <div className="flex items-center gap-3">
                            <Buddy size={44} />
                            <div className="flex items-center">
                                <div className="rounded-lg">
                                    <AlgoForgeLogo size={27} />
                                </div>
                                <span className="font-chango text-2xl font-bold tracking-tighter">
                                    lgo<span className="text-accent">Forge</span>
                                </span>
                            </div>
                        </div>
                        <p className="max-w-xs text-sm leading-relaxed text-foreground/55">
                            Step through data structures one operation at a time.
                        </p>
                    </div>

                    {LINK_GROUPS.map((group) => (
                        <nav key={group.title} className="footer-item" aria-label={group.title}>
                            <h3 className="mb-4 font-mono text-[11px] font-bold uppercase tracking-widest text-foreground/45">
                                {group.title}
                            </h3>
                            <ul className="space-y-3">
                                {group.links.map((link) => (
                                    <li key={link.href}>
                                        <motion.a
                                            href={link.href}
                                            className="inline-block text-sm font-medium text-foreground/65 transition-colors hover:text-accent"
                                            whileHover={{ x: 3, transition: { duration: 0.2 } }}
                                            whileTap={{ scale: 0.97 }}
                                        >
                                            {link.label}
                                        </motion.a>
                                    </li>
                                ))}
                            </ul>
                        </nav>
                    ))}

                    <div className="footer-item col-span-2 lg:col-span-1">
                        <h3 className="mb-4 font-mono text-[11px] font-bold uppercase tracking-widest text-foreground/45">
                            Follow
                        </h3>
                        <div className="flex flex-wrap gap-3">
                            {SOCIALS.map(({ label, href, icon }, index) => (
                                <motion.a
                                    key={label}
                                    href={href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    aria-label={label}
                                    title={label}
                                    className="flex h-11 w-11 items-center justify-center rounded-2xl border border-foreground/10 bg-foreground/[.04] text-foreground/60 transition-colors hover:border-accent/40 hover:bg-accent/10 hover:text-accent"
                                    whileHover={{ y: -4, rotate: index % 2 === 0 ? 5 : -5 }}
                                    transition={{ type: "spring", stiffness: 400, damping: 10 }}
                                >
                                    <HugeiconsIcon icon={icon} size={19} color="currentColor" strokeWidth={1.6} />
                                </motion.a>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="footer-item my-8 w-full border-t border-dashed border-foreground/10" />

                <div className="footer-item flex flex-col items-center justify-between gap-4 text-center md:flex-row md:text-left">
                    <p className="text-[11px] uppercase tracking-widest text-foreground/55 sm:text-xs">
                        © {SITE.year} {SITE.name}. All rights reserved.
                    </p>
                    <button
                        type="button"
                        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                        className="rounded-full border border-foreground/15 px-4 py-1.5 font-mono text-[11px] uppercase tracking-widest text-foreground/70 transition-colors hover:border-accent/50 hover:text-accent"
                    >
                        Back to top ↑
                    </button>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
