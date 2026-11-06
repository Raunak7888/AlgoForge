"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import TopNav from "./TitleBar";
import ResizeHandle from "./Resize";
import { TooltipProvider } from "../ui/tooltip";
import WorkspaceEditor from "./WorkspaceEditor";
import AIChatDrawer from "./AiChatDrawer";
import FeaturePanel from "./FeaturePanel";
import Toolbar from "./Toolbar";
import ShareModal from "./ShareModal";
import { SPLIT, loadSplit, saveSplit } from "@/lib/split";
import { NAV_EVENT, readDashboardParams } from "@/lib/navEvents";

export type FeatureType = "analysis" | "visualizer" | "history";
const FEATURE_LABEL: Record<FeatureType, string> = { analysis: "Analysis", visualizer: "Visualizer", history: "History" };

export default function AlgoforgeDashboard() {
    const [splitPct, setSplitPct] = useState<number>(SPLIT.default);
    const [hydrated, setHydrated] = useState(false);
    const [activeFeature, setActiveFeature] = useState<FeatureType>("analysis");
    const [isExplainerOpen, setExplainerOpen] = useState(false);
    const [isShareOpen, setShareOpen] = useState(false);

    const containerRef = useRef<HTMLElement | null>(null);

    // ?tab=visualizer opens that tool; search results and the catalog use it.
    useEffect(() => {
        const sync = () => {
            const { tab } = readDashboardParams();
            if (tab) setActiveFeature(tab);
        };
        // eslint-disable-next-line react-hooks/set-state-in-effect -- the address only exists in the browser
        sync();
        window.addEventListener(NAV_EVENT, sync);
        window.addEventListener("popstate", sync);
        return () => {
            window.removeEventListener(NAV_EVENT, sync);
            window.removeEventListener("popstate", sync);
        };
    }, []);

    // Read after mount (the server cannot know the saved value), write only once that read is done.
    useEffect(() => {
        /* eslint-disable react-hooks/set-state-in-effect -- the saved value only exists in the browser, so it can only be read after mount */
        const saved = loadSplit();
        if (saved !== null) setSplitPct(saved);
        setHydrated(true);
        /* eslint-enable react-hooks/set-state-in-effect */
    }, []);
    useEffect(() => {
        if (hydrated) saveSplit(splitPct);
    }, [splitPct, hydrated]);

    return (
        <div className="flex flex-col h-screen w-screen p-1 bg-primary-background text-primary-foreground">
            <TooltipProvider>
                <TopNav />

                <main id="main-content" tabIndex={-1} ref={containerRef} className="flex flex-1 pt-1 gap-px overflow-hidden outline-none">
                    <motion.section
                        aria-label="Code editor"
                        style={{ width: `${splitPct}%` }}
                        className="flex flex-col overflow-hidden"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                    >
                        <WorkspaceEditor />
                    </motion.section>

                    <ResizeHandle containerRef={containerRef} value={splitPct} min={SPLIT.min} max={SPLIT.max} defaultValue={SPLIT.default} onChange={setSplitPct} label="Resize panels" />

                    <motion.section
                        aria-label={FEATURE_LABEL[activeFeature]}
                        style={{ width: `${100 - splitPct - 5}%` }}
                        className="flex flex-col  overflow-hidden border-primary-foreground/30! border rounded-2xl "
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                    >
                        <FeaturePanel activeFeature={activeFeature} />
                    </motion.section>

                    <motion.div className="flex flex-col ml-1 overflow-hidden border-primary-foreground/30! border rounded-2xl " initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                        <Toolbar activeFeature={activeFeature} setActiveFeature={setActiveFeature} openAI={() => setExplainerOpen(true)} openShare={() => setShareOpen(true)} />
                    </motion.div>
                </main>

                {/* Outside <main>: it is a side panel, not part of the main content. */}
                <AIChatDrawer open={isExplainerOpen} onClose={() => setExplainerOpen(false)} />
                <ShareModal isOpen={isShareOpen} onClose={() => setShareOpen(false)} />
            </TooltipProvider>
        </div>
    );
}
