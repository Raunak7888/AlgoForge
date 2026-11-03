"use client";

import { Button } from "@base-ui/react";
import { HugeiconsIcon } from "@hugeicons/react";
import { AiBrain, Chart01FreeIcons, Eye, History, Share01Icon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import type { IconSvgObject } from "@/lib/types";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import type { FeatureType } from "./DashBoard";

function ToolButton({ label, icon, onClick, pressed, className }: { label: string; icon: IconSvgObject; onClick: () => void; pressed?: boolean; className?: string }) {
    return (
        <Tooltip>
            <TooltipTrigger
                render={<Button type="button" aria-label={label} aria-pressed={pressed} onClick={onClick} className={cn("flex h-10 w-10 items-center justify-center rounded-lg", className)} />}
            >
                <HugeiconsIcon icon={icon} size={18} aria-hidden="true" />
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
    return (
        <div role="group" aria-label="Tools" className="flex w-15 flex-col items-center gap-4 p-2">
            {TOOLS.map((tool) => {
                const active = tool.id === activeFeature;
                return (
                    <ToolButton
                        key={tool.id}
                        label={tool.label}
                        icon={tool.icon}
                        pressed={active}
                        onClick={() => setActiveFeature(tool.id)}
                        className={active ? "bg-white text-black" : "text-gray-400 hover:bg-[#1a1a1a] hover:text-white"}
                    />
                );
            })}
            <ToolButton label="AI assistant" icon={AiBrain} onClick={openAI} className="text-purple-400 hover:bg-purple-500/10" />
            <ToolButton label="Share" icon={Share01Icon} onClick={openShare} className="text-purple-400 hover:bg-purple-500/10" />
        </div>
    );
}
