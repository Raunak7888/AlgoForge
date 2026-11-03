"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { getLenis } from "@/lib/lenis";

import {
    Navbar,
    NavBody,
    NavItems,
    MobileNav,
    NavbarLogo,
    MobileNavHeader,
    MobileNavToggle,
    MobileNavMenu,
} from "@/components/ui/resizable-navbar";
import { InteractiveHoverButton } from "../ui/interactive-hover-button";
import Link from "next/link";
import { DASHBOARD_HREF } from "@/lib/site";

export function SmartNavbar() {
    const navRef = useRef<HTMLDivElement | null>(null);
    const [open, setOpen] = useState(false);

    const navItems = [
        { name: "Home", link: "#home" },
        { name: "Features", link: "#features" },
        { name: "Action", link: "#watch" },
        { name: "Products", link: "#products" },
        { name: "Use Cases", link: "#usecases" },
    ];

    useEffect(() => {
        if (!navRef.current) return;

        const nav = navRef.current;

        // 🔥 smooth setters
        const setScaleY = gsap.quickTo(nav, "scaleY", {
            duration: 0.3,
            ease: "power2.out",
        });

        const setScaleX = gsap.quickTo(nav, "scaleX", {
            duration: 0.3,
            ease: "power2.out",
        });

        const setPadding = gsap.quickTo(nav, "paddingTop", {
            duration: 0.3,
            ease: "power2.out",
        });

        const attach = () => {
            const lenis = getLenis();
            if (!lenis) return false;

            const onScroll = ({ scroll }: { scroll: number }) => {
                const progress = Math.min(scroll / 200, 1); // 0 → 1

                // scale: 1 → 0.92
                setScaleX(1 - progress * 0.08);
                setScaleY(1 - progress * 0.08);

                // padding: 20px → 8px
                setPadding(20 - progress * 12);

                // optional blur (direct, no gsap needed)
            };

            lenis.on("scroll", onScroll);

            return () => {
                lenis.off("scroll", onScroll);
            };
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let cleanup: any;
        const interval = setInterval(() => {
            const res = attach();
            if (res) {
                cleanup = res;
                clearInterval(interval);
            }
        }, 50);

        return () => {
            clearInterval(interval);
            if (cleanup) cleanup();
        };
    }, []);

    return (
        <div
            ref={navRef}
            className="fixed top-0 left-0 right-0 z-999 origin-top will-change-transform px-3 sm:px-6"
            style={{ paddingTop: "20px" }}
        >
            <Navbar>
                <NavBody>
                    <NavbarLogo />
                    <NavItems items={navItems} />
                    <div className="flex items-center gap-4">
                        <InteractiveHoverButton href={DASHBOARD_HREF}>Open app</InteractiveHoverButton>
                    </div>
                </NavBody>

                <MobileNav>
                    <MobileNavHeader>
                        <NavbarLogo />
                        <MobileNavToggle
                            isOpen={open}
                            onClick={() => setOpen(!open)}
                        />
                    </MobileNavHeader>

                    <MobileNavMenu isOpen={open} onClose={() => setOpen(false)}>
                        {navItems.map((item, i) => (
                            <a key={i} href={item.link}>
                                {item.name}
                            </a>
                        ))}
                        <Link href={DASHBOARD_HREF}>Open app</Link>
                    </MobileNavMenu>
                </MobileNav>
            </Navbar>
        </div>
    );
}
