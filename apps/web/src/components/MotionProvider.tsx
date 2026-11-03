"use client";

import { MotionConfig as FramerMotionConfig } from "framer-motion";
import { MotionConfig } from "motion/react";

/** "user": transform and layout animations switch off when the OS asks for reduced motion; opacity fades stay. */
export default function MotionProvider({ children }: { children: React.ReactNode }) {
    return (
        <FramerMotionConfig reducedMotion="user">
            <MotionConfig reducedMotion="user">{children}</MotionConfig>
        </FramerMotionConfig>
    );
}
