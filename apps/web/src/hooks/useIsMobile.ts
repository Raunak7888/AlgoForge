"use client";

import { useEffect, useState } from "react";

/** true below `breakpoint` (matches Tailwind md = 768px). null until the browser has answered. */
export function useIsMobile(breakpoint = 768) {
    const [isMobile, setIsMobile] = useState<boolean | null>(null);

    useEffect(() => {
        const media = window.matchMedia(`(max-width: ${breakpoint - 0.02}px)`);
        const update = () => setIsMobile(media.matches);
        update();
        media.addEventListener("change", update);
        return () => media.removeEventListener("change", update);
    }, [breakpoint]);

    return isMobile;
}
