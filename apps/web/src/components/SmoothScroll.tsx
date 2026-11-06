"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { setLenis } from "@/lib/lenis";
import { prefersReducedMotion } from "@/lib/reducedMotion";

gsap.registerPlugin(ScrollTrigger);

export default function SmoothScroll({ children }: { children: React.ReactNode }) {
    useEffect(() => {
        if (prefersReducedMotion()) return; // native scrolling
        const lenis = new Lenis({
            duration: 1.2,
            easing: (t: number) => 1 - Math.pow(1 - t, 4),
            smoothWheel: true,
        });
        setLenis(lenis);

        // Window scrolling needs no scrollerProxy: Lenis drives the real window scroll.
        const onScroll = () => ScrollTrigger.update();
        lenis.on("scroll", onScroll);

        const raf = (time: number) => lenis.raf(time * 1000);
        gsap.ticker.add(raf);
        gsap.ticker.lagSmoothing(0);

        const onRefresh = () => lenis.resize();
        ScrollTrigger.addEventListener("refresh", onRefresh);
        ScrollTrigger.refresh();

        return () => {
            ScrollTrigger.removeEventListener("refresh", onRefresh);
            gsap.ticker.remove(raf);
            gsap.ticker.lagSmoothing(500, 33); // GSAP defaults
            lenis.off("scroll", onScroll);
            lenis.destroy();
            setLenis(null);
            // Deliberately no ScrollTrigger.killAll(): each component reverts its own triggers.
        };
    }, []);

    return <div className="root">{children}</div>;
}
