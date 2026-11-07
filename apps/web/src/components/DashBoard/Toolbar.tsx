"use client";

import type { CSSProperties } from "react";
import { Button } from "@base-ui/react";
import { HugeiconsIcon } from "@hugeicons/react";
import { AiBrain, Chart01FreeIcons, Eye, History, Share01Icon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import type { IconSvgObject } from "@/lib/types";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import type { FeatureType } from "./DashBoard";

/* The sliding indicator is positioned from these two values. */
const ITEM_SIZE = 40; // px
const ITEM_GAP = 6; // px

/*
 * Animations live in plain CSS keyframes (not Tailwind utilities) so they always run,
 * whatever your Tailwind setup. Reduced-motion users keep a short slide + color fades
 * but lose the pops, ripples, pulses and entrance.
 */
const TOOLBAR_CSS = `
.tb-btn { transition: color .2s ease, background-color .2s ease, box-shadow .25s ease, transform .15s ease; }
.tb-btn:active { transform: scale(.88); }
.tb-btn:focus-visible { outline: 2px solid rgba(168,85,247,.8); outline-offset: 2px; }
.tb-icon { transition: transform .25s cubic-bezier(.34,1.56,.64,1); }
.tb-btn:hover .tb-icon { transform: translateY(-1px) scale(1.15); }
.tb-ai:hover .tb-icon { transform: rotate(-12deg) scale(1.2); }
.tb-share:hover .tb-icon { transform: translate(2px,-2px) scale(1.15); }

.tb-btn[aria-pressed="true"] .tb-icon { animation: tb-pop .5s cubic-bezier(.34,1.56,.64,1); }

.tb-enter { animation: tb-enter .55s cubic-bezier(.34,1.56,.64,1) backwards; animation-delay: calc(var(--i, 0) * 70ms); }

.tb-indicator {
  transition: transform .45s cubic-bezier(.34,1.45,.64,1), opacity .2s ease;
  box-shadow: 0 0 24px -4px rgba(255,255,255,.45);
}
.tb-ripple { animation: tb-ripple .6s ease-out forwards; }

.tb-breathe { animation: tb-breathe 2.6s ease-out infinite; }
.tb-breathe:hover { animation: none; }

.tb-divider { animation: tb-grow .6s ease-out .25s backwards; transform-origin: center; }

@keyframes tb-enter { from { opacity: 0; transform: translateX(14px) scale(.8); } to { opacity: 1; transform: none; } }
@keyframes tb-pop { 0% { transform: scale(.5) rotate(-25deg); } 60% { transform: scale(1.3) rotate(6deg); } 100% { transform: scale(1) rotate(0); } }
@keyframes tb-ripple { from { opacity: .7; transform: scale(.85); } to { opacity: 0; transform: scale(1.8); } }
@keyframes tb-breathe { 0% { box-shadow: 0 0 0 0 rgba(168,85,247,.5); } 70%, 100% { box-shadow: 0 0 0 10px rgba(168,85,247,0); } }
@keyframes tb-grow { from { transform: scaleX(0); opacity: 0; } to { transform: scaleX(1); opacity: 1; } }

@media (prefers-reduced-motion: reduce) {
  .tb-enter, .tb-ripple, .tb-breathe, .tb-divider,
  .tb-btn[aria-pressed="true"] .tb-icon { animation: none; }
  .tb-btn:hover .tb-icon, .tb-ai:hover .tb-icon, .tb-share:hover .tb-icon { transform: none; }
  .tb-btn:active { transform: none; }
  .tb-indicator { transition: transform .18s linear, opacity .15s linear; }
}
`;

function ToolButton({
    label,
    icon,
    onClick,
    pressed,
    className,
    index,
}: {
    label: string;
    icon: IconSvgObject;
    onClick: () => void;
    pressed?: boolean;
    className?: string;
    index: number;
}) {
    return (
        <Tooltip>
            <TooltipTrigger
                render={
                    <Button
                        type="button"
                        aria-label={label}
                        aria-pressed={pressed}
                        onClick={onClick}
                        style={{ width: ITEM_SIZE, height: ITEM_SIZE, "--i": index } as CSSProperties}
                        className={cn(
                            "tb-btn tb-enter relative z-10 flex shrink-0 cursor-pointer items-center justify-center rounded-xl",
                            className,
                        )}
                    />
                }
            >
                <HugeiconsIcon icon={icon} size={19} aria-hidden="true" className="tb-icon" />
            </TooltipTrigger>
            <TooltipContent side="left">{label}</TooltipContent>
        </Tooltip>
    );
}

const TOOLS: { id: FeatureType; label: string; icon: IconSvgObject }[] = [
    { id: "analysis", label: "Analysis", icon: Chart01FreeIcons },
    { id: "visualizer", label: "Visualizer", icon: Eye },
    { id: "history", label: "History", icon: History },
];

export default function Toolbar({
    activeFeature,
    setActiveFeature,
    openAI,
    openShare,
}: {
    activeFeature: FeatureType;
    setActiveFeature: (f: FeatureType) => void;
    openAI: () => void;
    openShare: () => void;
}) {
    const activeIndex = TOOLS.findIndex((tool) => tool.id === activeFeature);
    const hasActive = activeIndex >= 0;

    return (
        <div role="group" aria-label="Tools" className="flex w-15 justify-center">
            <style>{TOOLBAR_CSS}</style>

            {/* Transparent on purpose: the parent's bg-primary-background shows through. */}
            <div className="flex flex-col items-center gap-2 rounded-t-2xl border border-white/10 p-2">
                <div className="relative flex flex-col items-center" style={{ gap: ITEM_GAP }}>
                    <span
                        aria-hidden="true"
                        className={cn(
                            "tb-indicator pointer-events-none absolute left-0 top-0 rounded-xl bg-white",
                            hasActive ? "opacity-100" : "opacity-0",
                        )}
                        style={{
                            width: ITEM_SIZE,
                            height: ITEM_SIZE,
                            transform: `translateY(${Math.max(activeIndex, 0) * (ITEM_SIZE + ITEM_GAP)}px)`,
                        }}
                    >
                        {/* Remounts on every change so the ripple replays. */}
                        <span key={activeFeature} className="tb-ripple absolute inset-0 rounded-xl border border-white" />
                    </span>

                    {TOOLS.map((tool, i) => {
                        const active = tool.id === activeFeature;
                        return (
                            <ToolButton
                                key={tool.id}
                                index={i}
                                label={tool.label}
                                icon={tool.icon}
                                pressed={active}
                                onClick={() => setActiveFeature(tool.id)}
                                className={active ? "text-black" : "text-gray-400 hover:bg-white/10 hover:text-white"}
                            />
                        );
                    })}
                </div>

                <div aria-hidden="true" className="tb-divider h-px w-6 bg-white/20" />

                <ToolButton
                    index={TOOLS.length}
                    label="AI assistant"
                    icon={AiBrain}
                    onClick={openAI}
                    className="tb-ai tb-breathe bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 hover:text-purple-200"
                />
                <ToolButton
                    index={TOOLS.length + 1}
                    label="Share"
                    icon={Share01Icon}
                    onClick={openShare}
                    className="tb-share text-purple-300 hover:bg-purple-500/15 hover:text-purple-200"
                />
            </div>
        </div>
    );
}