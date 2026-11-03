"use client";

import { useIsMobile } from "@/hooks/useIsMobile";
import SmoothScroll from "@/components/SmoothScroll";
import AlgoForgeLanding from "@/components/LandingPage/MobileTabletLandingPage";
import Hero from "@/components/LandingPage/Hero";
import HorizontalFeatureScroll from "@/components/LandingPage/HorizontalFeatureScroll";
import ParticleBg from "@/components/LandingPage/particles";
import UseCases from "@/components/LandingPage/UseCases";
import WhatYouGet from "@/components/LandingPage/WhatYouGet";
import FinalCTA from "@/components/LandingPage/FinalCTA";
import Footer from "@/components/LandingPage/Footer";

export default function Home() {
    const isMobile = useIsMobile(); // null on the server and first paint

    // Until the browser answers, both trees are in the HTML and CSS shows the right one.
    // Once it answers, only the matching tree stays mounted (no hidden GSAP/Lenis work).
    const showMobile = isMobile !== false;
    const showDesktop = isMobile !== true;

    return (
        <SmoothScroll>
            {showMobile && (
                <main id={isMobile === true ? "main-content" : undefined} tabIndex={-1} className="outline-none md:hidden">
                    <AlgoForgeLanding />
                </main>
            )}
            {showDesktop && (
                <main id="main-content" tabIndex={-1} className="relative hidden overflow-hidden bg-background outline-none md:block">
                    <ParticleBg />
                    <Hero />
                    {isMobile === false ? (
                        <HorizontalFeatureScroll />
                    ) : (
                        <section id="features" aria-hidden className="h-screen" />
                    )}
                    <WhatYouGet />
                    <UseCases />
                    <FinalCTA />
                    <Footer />
                </main>
            )}
        </SmoothScroll>
    );
}
