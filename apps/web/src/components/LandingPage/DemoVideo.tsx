"use client";

import { useEffect, useRef, useState } from "react";

// Put your screen recording here: public/demo/usage.mp4
export const DEMO_VIDEO_SRC = "/demo/usage.mp4";

const Chevron = ({ flip = false }: { flip?: boolean }) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={flip ? "rotate-180" : ""}>
        <path d="M9 6l6 6-6 6" />
    </svg>
);

export default function DemoVideo({ lite = false }: { lite?: boolean }) {
    const wrap = useRef<HTMLDivElement>(null);
    const video = useRef<HTMLVideoElement>(null);
    const [failed, setFailed] = useState(false);

    // Loop while visible. Pause when off screen.
    useEffect(() => {
        const el = wrap.current;
        const v = video.current;
        if (!el || !v) return;
        const io = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) v.play().catch(() => setFailed(true));
                else v.pause();
            },
            { threshold: 0.35 },
        );
        io.observe(el);
        return () => io.disconnect();
    }, []);

    return (
        <div
            ref={wrap}
            className="relative overflow-hidden rounded-2xl border border-foreground/15 bg-background shadow-[0_30px_80px_-30px_rgba(0,0,0,0.65)]"
        >
            {/* Tab strip */}
            <div className="flex items-end gap-2 bg-foreground/6 px-3 pt-2.5 sm:gap-3 sm:px-4 sm:pt-3">
                <div className="flex items-center gap-2 pb-2.5">
                    <span className="h-3 w-3 rounded-full border border-[#e0443e] bg-[#ff5f57]" />
                    <span className="h-3 w-3 rounded-full border border-[#dea123] bg-[#febc2e]" />
                    <span className="h-3 w-3 rounded-full border border-[#1aab29] bg-[#28c840]" />
                </div>

                <div className="ml-1 flex min-w-0 max-w-[60%] items-center gap-2 rounded-t-lg border border-b-0 border-foreground/10 bg-background px-3 py-2 sm:ml-3 sm:max-w-55 sm:px-3.5">
                    <span className="h-3.5 w-3.5 shrink-0 rounded-[5px] bg-accent" />
                    <span className="truncate font-mono text-[11px] text-foreground/75">AlgoForge · Visualizer</span>
                    <span className="ml-2 text-[11px] leading-none text-foreground/40">×</span>
                </div>
                <span className="mb-2 hidden px-1 text-sm leading-none text-foreground/35 sm:inline">+</span>
            </div>
            {/* Toolbar */}
            <div className="flex items-center gap-2 border-b border-foreground/10 bg-background px-3 py-2 sm:gap-3 sm:px-4">
                <div className="hidden items-center gap-1 text-foreground/45 sm:flex">
                    <Chevron flip />
                    <Chevron />
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="ml-1.5">
                        <path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v5h-5" />
                    </svg>
                </div>
                <div className="mx-auto flex w-full min-w-0 max-w-md items-center gap-2 rounded-full border border-foreground/10 bg-foreground/5 px-3 py-1.5 sm:px-4">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-foreground/45">
                        <rect x="5" y="11" width="14" height="9" rx="2" />
                        <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                    </svg>
                    <span className="truncate font-mono text-[11px] text-foreground/55">algoforge.app/visualizer</span>
                </div>
                <div className="hidden items-center gap-2.5 text-foreground/40 sm:flex">
                    <span className="h-1 w-1 rounded-full bg-current" />
                    <span className="h-1 w-1 rounded-full bg-current" />
                    <span className="h-1 w-1 rounded-full bg-current" />
                </div>
            </div>
            {/* Page */}
            <div className="relative aspect-video bg-black">
                <video
                    ref={video}
                    className="pointer-events-none h-full w-full object-cover"
                    src={DEMO_VIDEO_SRC}
                    muted
                    loop
                    playsInline
                    disablePictureInPicture
                    controls={false}
                    preload={lite ? "none" : "metadata"}
                    onError={() => setFailed(true)}
                />
                {failed && (
                    <div className="absolute inset-0 grid place-items-center bg-black/85">
                        <p className="px-6 text-center font-mono text-xs text-white/70">
                            Add your recording at public/demo/usage.mp4 and it will play here.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}