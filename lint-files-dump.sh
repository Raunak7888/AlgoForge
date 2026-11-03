#!/usr/bin/env bash
set -Eeuo pipefail

echo "Restoring AlgoForge lint files..."

mkdir -p apps/web/src/components/CodeEditor
cat > apps/web/src/components/CodeEditor/EditorToolbar.tsx <<'__ALGOFORGE_FILE_550547249a53d501__'
// filepath: src/components/CodeEditor/EditorToolbar.tsx
"use client";

import React, { useId } from "react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import type { EditorToolbarProps, Language } from "./types";
import { LANGUAGE_LABELS } from "./constants";
import styles from "./CodeEditor.module.css";

// ─── Icons ───────────────────────────────────────────────────────────────────

const JSIcon: React.FC = () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
        <rect width="16" height="16" rx="3" fill="#F7DF1E" />
        <text
            x="3"
            y="13"
            fontSize="9"
            fontWeight="700"
            fill="#000"
            fontFamily="monospace"
        >
            JS
        </text>
    </svg>
);

const PyIcon: React.FC = () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
        <rect width="16" height="16" rx="3" fill="#3776AB" />
        <text
            x="3"
            y="13"
            fontSize="9"
            fontWeight="700"
            fill="#FFD43B"
            fontFamily="monospace"
        >
            Py
        </text>
    </svg>
);

const FormatIcon: React.FC = () => (
    <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
    >
        <path d="M21 10H7M16 6H3M21 14H7M16 18H3" />
    </svg>
);

const SpinnerIcon: React.FC = () => (
    <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden
    >
        <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
    </svg>
);

const ReadOnlyIcon: React.FC = () => (
    <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
    >
        <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
);

const CopyIcon: React.FC = () => (
    <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
    >
        <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
        <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
);

const CheckIcon: React.FC = () => (
    <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
    >
        <path d="M20 6L9 17l-5-5" />
    </svg>
);

// ─── Animation helpers ────────────────────────────────────────────────────────

const spring = { type: "spring" as const, stiffness: 420, damping: 22 };
const iconSwap = { duration: 0.18, ease: [0.22, 1, 0.36, 1] as const };

const LANGUAGE_OPTIONS: Language[] = ["javascript", "python"];

// ─── Component ────────────────────────────────────────────────────────────────

export const EditorToolbar: React.FC<EditorToolbarProps> = ({
    language,
    onLanguageChange,
    onFormat,
    onCopy,
    isFormatting,
    isCopied,
    readOnly,
    isReady,
}) => {

    return (
        <div
            className={styles.toolbar}
            role="toolbar"
            aria-label="Editor toolbar"
        >
            {/* ── Left: language controls ────────────────────────────────── */}
            <div className={styles.toolbarLeft}>
                {/* Dropdown (hidden on narrow viewports if desired) */}
                {/* <div className={styles.languageSelector}>
                    <label htmlFor={selectId} className={styles.srOnly}>
                        Select language
                    </label>
                    <div className={styles.langIcon} aria-hidden>
                        {language === "javascript" ? <JSIcon /> : <PyIcon />}
                    </div>
                    <select
                        id={selectId}
                        value={language}
                        onChange={(e) =>
                            onLanguageChange(e.target.value as Language)
                        }
                        className={styles.langSelect}
                        disabled={!isReady}
                        aria-label="Programming language"
                    >
                        {LANGUAGE_OPTIONS.map((lang) => (
                            <option key={lang} value={lang} className={"w-full rounded-2xl m-2 p-2 font-mono bg-accent"} >
                                {LANGUAGE_LABELS[lang]}
                            </option>
                        ))}
                    </select>
                    <div className={styles.selectChevron} aria-hidden>
                        <svg
                            width="10"
                            height="10"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                        >
                            <path d="M6 9l6 6 6-6" />
                        </svg>
                    </div>
                </div>   */}

                {/* Pill switcher — framer-motion layoutId slides the background */}
                <LayoutGroup id="lang-pills">
                    <div
                        className={styles.langPills}
                        role="group"
                        aria-label="Language switcher"
                    >
                        {LANGUAGE_OPTIONS.map((lang) => (
                            <motion.button
                                key={lang}
                                type="button"
                                className={`${styles.langPill} ${language === lang ? styles.langPillActive : ""}`}
                                onClick={() => onLanguageChange(lang)}
                                disabled={!isReady}
                                aria-pressed={language === lang}
                                whileHover={isReady ? { scale: 1.05 } : {}}
                                whileTap={isReady ? { scale: 0.94 } : {}}
                                transition={spring}
                            >
                                {language === lang && (
                                    <motion.div
                                        layoutId="pill-bg"
                                        className={styles.langPillBg}
                                        transition={{
                                            type: "spring",
                                            stiffness: 360,
                                            damping: 32,
                                        }}
                                    />
                                )}
                                <span className={styles.langPillContent}>
                                    {lang === "javascript" ? (
                                        <JSIcon />
                                    ) : (
                                        <PyIcon />
                                    )}
                                    <span>{LANGUAGE_LABELS[lang]}</span>
                                </span>
                            </motion.button>
                        ))}
                    </div>
                </LayoutGroup>
            </div>

            {/* ── Right: actions ─────────────────────────────────────────── */}
            <div className={styles.toolbarRight}>
                {/* Read-only badge — animates in when readOnly becomes true */}
                <AnimatePresence>
                    {readOnly && (
                        <motion.div
                            className={styles.readOnlyBadge}
                            aria-label="Read-only mode"
                            initial={{ opacity: 0, x: 10, scale: 0.9 }}
                            animate={{ opacity: 1, x: 0, scale: 1 }}
                            exit={{ opacity: 0, x: 10, scale: 0.9 }}
                            transition={spring}
                        >
                            <ReadOnlyIcon />
                            <span>Read-only</span>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Copy button */}
                <motion.button
                    type="button"
                    className={`${styles.iconBtn} ${isCopied ? styles.iconBtnSuccess : ""}`}
                    onClick={onCopy}
                    disabled={!isReady}
                    title="Copy code"
                    aria-label={isCopied ? "Copied!" : "Copy code"}
                    whileHover={isReady ? { scale: 1.08 } : {}}
                    whileTap={isReady ? { scale: 0.9 } : {}}
                    transition={spring}
                >
                    <AnimatePresence mode="wait" initial={false}>
                        <motion.span
                            key={isCopied ? "check" : "copy"}
                            initial={{
                                opacity: 0,
                                scale: 0.45,
                                rotate: isCopied ? -90 : 90,
                            }}
                            animate={{ opacity: 1, scale: 1, rotate: 0 }}
                            exit={{ opacity: 0, scale: 0.45 }}
                            transition={iconSwap}
                            style={{ display: "flex", alignItems: "center" }}
                        >
                            {isCopied ? <CheckIcon /> : <CopyIcon />}
                        </motion.span>
                    </AnimatePresence>
                </motion.button>

                {/* Format button — hidden in readOnly */}
                <AnimatePresence>
                    {!readOnly && (
                        <motion.button
                            type="button"
                            className={`${styles.iconBtn} ${isFormatting ? styles.iconBtnLoading : ""}`}
                            onClick={onFormat}
                            disabled={!isReady || isFormatting}
                            title="Format code (Alt+Shift+F)"
                            aria-label="Format code"
                            initial={{ opacity: 0, scale: 0.85 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.85 }}
                            whileHover={
                                isReady && !isFormatting ? { scale: 1.08 } : {}
                            }
                            whileTap={
                                isReady && !isFormatting ? { scale: 0.9 } : {}
                            }
                            transition={spring}
                        >
                            <AnimatePresence mode="wait" initial={false}>
                                {isFormatting ? (
                                    <motion.span
                                        key="spinner"
                                        className={styles.spinnerWrapper}
                                        initial={{ opacity: 0, scale: 0.5 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.5 }}
                                        transition={{ duration: 0.14 }}
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                        }}
                                    >
                                        <SpinnerIcon />
                                    </motion.span>
                                ) : (
                                    <motion.span
                                        key="format-icon"
                                        initial={{ opacity: 0, scale: 0.5 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.5 }}
                                        transition={{ duration: 0.14 }}
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                        }}
                                    >
                                        <FormatIcon />
                                    </motion.span>
                                )}
                            </AnimatePresence>
                        </motion.button>
                    )}
                </AnimatePresence>

                {/* Editor-ready dot: pops when the editor finishes loading */}
                <motion.div
                    className={`${styles.statusDot} ${isReady ? styles.statusDotReady : styles.statusDotLoading}`}
                    title={isReady ? "Editor ready" : "Loading editor…"}
                    role="status"
                    aria-label={isReady ? "Editor ready" : "Loading editor"}
                    animate={isReady ? { scale: [1, 1.45, 1] } : { scale: 1 }}
                    transition={{ duration: 0.48, ease: "easeOut" }}
                />
            </div>
        </div>
    );
};

__ALGOFORGE_FILE_550547249a53d501__

mkdir -p apps/web/src/components/DashBoard
cat > apps/web/src/components/DashBoard/DashBoard.tsx <<'__ALGOFORGE_FILE_b9b0389528fa43a2__'
"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import TopNav from "./TitleBar";
import ResizeHandle from "./Resize";
import { TooltipProvider } from "../ui/tooltip";
import { CodeEditor } from "../CodeEditor";
import AIChatDrawer from "./AiChatDrawer";
import FeaturePanel from "./FeaturePanel";
import Toolbar from "./Toolbar";
import ShareModal from "./ShareModal";
import { SPLIT, loadSplit, saveSplit } from "@/lib/split";

export type FeatureType = "analysis" | "visualizer" | "history";
const FEATURE_LABEL: Record<FeatureType, string> = { analysis: "Analysis", visualizer: "Visualizer", history: "History" };

export default function AlgoforgeDashboard() {
    const [splitPct, setSplitPct] = useState<number>(SPLIT.default);
    const [hydrated, setHydrated] = useState(false);
    const [activeFeature, setActiveFeature] = useState<FeatureType>("analysis");
    const [isExplainerOpen, setExplainerOpen] = useState(false);
    const [isShareOpen, setShareOpen] = useState(false);

    const containerRef = useRef<HTMLElement | null>(null);

    // Read after mount (the server cannot know the saved value), write only once that read is done.
    useEffect(() => {
        const saved = loadSplit();
        if (saved !== null) setSplitPct(saved);
        setHydrated(true);
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
                        <CodeEditor height="100%" />
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

__ALGOFORGE_FILE_b9b0389528fa43a2__

mkdir -p apps/web/src/components/DashBoard
cat > apps/web/src/components/DashBoard/DashboardGate.tsx <<'__ALGOFORGE_FILE_379df719966b3abb__'
"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { readUserCookie, writeUserCookie } from "@/lib/auth-cookie";
import { signInWithGoogle } from "@/lib/auth";
import { isMobileDevice } from "@/lib/device";
import { GoogleLoginModal } from "@/components/auth/GoogleLoginModal"; // adjust to your real path
import { DesktopOnlyScreen } from "./DesktopOnlyScreen";

type Status = "checking" | "mobile" | "login" | "ready";

export function DashboardGate({ children }: { children: ReactNode }) {
    const [status, setStatus] = useState<Status>("checking");

    useEffect(() => {
        // Lock 2 first (device), then lock 1 (auth)
        if (isMobileDevice()) setStatus("mobile");
        else setStatus(readUserCookie() ? "ready" : "login");
    }, []);

    const handleLogin = useCallback(async () => {
        const user = await signInWithGoogle();
        writeUserCookie(user);
        setStatus("ready");
    }, []);

    if (status === "checking") return <div className="min-h-dvh bg-black" />;
    if (status === "mobile") return <DesktopOnlyScreen />;

    if (status === "login") {
        return (
            <div className="min-h-dvh bg-black">
                <GoogleLoginModal isOpen onGoogleLogin={handleLogin} onClose={() => {}}/>
            </div>
        );
    }

    return <>{children}</>;
}
__ALGOFORGE_FILE_379df719966b3abb__

mkdir -p apps/web/src/components/DashBoard
cat > apps/web/src/components/DashBoard/DesktopOnlyScreen.tsx <<'__ALGOFORGE_FILE_28d0ad096d048720__'
"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

export function DesktopOnlyScreen() {
    const [url, setUrl] = useState("");
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        setUrl(window.location.href);
    }, []);

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(url);
        } catch {
            // fallback for browsers/contexts without the Clipboard API
            const ta = document.createElement("textarea");
            ta.value = url;
            ta.style.position = "fixed";
            ta.style.opacity = "0";
            document.body.appendChild(ta);
            ta.select();
            document.execCommand("copy");
            ta.remove();
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <main className="flex min-h-dvh items-center justify-center bg-black p-6">
            <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-8 text-center backdrop-blur-xl">
                <h1 className="font-display text-xl font-semibold text-white">
                    Open this on a desktop
                </h1>
                <p className="mt-2 text-sm text-white/50">
                    The dashboard needs a larger screen. Scan the code or copy
                    the link and open it on your laptop.
                </p>

                {url && (
                    <div className="mx-auto mt-6 w-fit rounded-xl bg-white p-3">
                        <QRCodeSVG
                            value={url}
                            size={176}
                            level="M"
                            bgColor="#ffffff"
                            fgColor="#000000"
                        />
                    </div>
                )}

                <p className="mt-4 break-all text-xs text-white/40">{url}</p>

                <button
                    type="button"
                    onClick={copy}
                    disabled={!url}
                    className="mt-5 w-full rounded-lg bg-[#ff4d00] px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                    {copied ? "Copied!" : "Copy link"}
                </button>
            </div>
        </main>
    );
}
__ALGOFORGE_FILE_28d0ad096d048720__

mkdir -p apps/web/src/components/DashBoard
cat > apps/web/src/components/DashBoard/Setting.tsx <<'__ALGOFORGE_FILE_6c5cfc82ed6239ad__'
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
    CircleQuestionMark,
    LogOut,
    Settings,
    SunMoon,
    User,
    type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Item = {
    icon: LucideIcon;
    label: string;
    isComming?: boolean;
    danger?: boolean;
    onSelect?: () => void;
};
export interface AccountUser {
    name: string;
    email: string;
}
export interface AccountMenuItem {
    id: string;
    label: string;
    icon: LucideIcon;
    href?: string;
    onSelect?: () => void;
}


const groups: Item[][] = [
    [
        { icon: User, label: "Profile" },
        { icon: Settings, label: "Settings" },
        { icon: SunMoon, label: "Appearance", isComming: true },
    ],
    [{ icon: CircleQuestionMark, label: "Help" }],
    [{ icon: LogOut, label: "Sign out", danger: true }],
];

const flat = groups.flat();

export default function SettingsDropdown({
    open,
    onClose,
}: {
    open: boolean;
    onClose: VoidFunction;
}) {
    const reduce = useReducedMotion();
    const [hovered, setHovered] = useState<string | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    // Reset hover + move focus into the menu when it opens.
    useEffect(() => {
        if (open) {
            setHovered(null);
            requestAnimationFrame(() => menuRef.current?.focus());
        }
    }, [open]);

    const onKeyDown = (e: React.KeyboardEvent) => {
        const buttons = Array.from(
            menuRef.current?.querySelectorAll<HTMLButtonElement>(
                "button:not(:disabled)",
            ) ?? [],
        );
        if (!buttons.length) return;
        const i = buttons.indexOf(document.activeElement as HTMLButtonElement);

        const move = (next: number) => {
            e.preventDefault();
            buttons[(next + buttons.length) % buttons.length].focus();
        };

        if (e.key === "ArrowDown") move(i + 1);
        else if (e.key === "ArrowUp") move(i === -1 ? buttons.length - 1 : i - 1);
        else if (e.key === "Home") move(0);
        else if (e.key === "End") move(buttons.length - 1);
        else if (e.key === "Tab") onClose();
    };

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    ref={menuRef}
                    role="menu"
                    aria-label="Account menu"
                    tabIndex={-1}
                    onKeyDown={onKeyDown}
                    onMouseLeave={() => setHovered(null)}
                    initial={
                        reduce
                            ? { opacity: 0 }
                            : { opacity: 0, scale: 0.96, y: -4, filter: "blur(4px)" }
                    }
                    animate={{ opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }}
                    exit={
                        reduce
                            ? { opacity: 0 }
                            : { opacity: 0, scale: 0.97, y: -2, filter: "blur(2px)" }
                    }
                    transition={
                        reduce
                            ? { duration: 0 }
                            : { type: "spring", stiffness: 520, damping: 34, mass: 0.7 }
                    }
                    style={{ transformOrigin: "top right" }}
                    className="absolute right-0 top-full z-50 mt-2 w-60 overflow-hidden rounded-xl border border-primary-foreground/20! bg-primary-background shadow-2xl shadow-black/40 outline-none"
                >
                    {/* Account header */}
                    <div className="flex items-center gap-2.5 border-b border-primary-foreground/20! p-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-primary-foreground/20! bg-accent/30 text-xs font-semibold text-primary-foreground">
                            R
                        </div>
                        <div className="min-w-0">
                            <p className="truncate text-[13px] font-medium text-primary-foreground">
                                Raunak Yadav
                            </p>
                            <p className="truncate text-[11px] text-primary-foreground/50">
                                raunakyadav7888@gmail.com
                            </p>
                        </div>
                    </div>

                    {/* Items */}
                    <div className="p-1.5">
                        {groups.map((group, gi) => (
                            <div key={gi}>
                                {gi > 0 && (
                                    <div className="-mx-1.5 my-1.5 h-px bg-primary-foreground/20" />
                                )}
                                {group.map((item) => {
                                    const idx = flat.indexOf(item);
                                    const disabled = !!item.isComming;
                                    const active = hovered === item.label && !disabled;

                                    return (
                                        <motion.button
                                            key={item.label}
                                            role="menuitem"
                                            type="button"
                                            disabled={disabled}
                                            onMouseEnter={() => setHovered(item.label)}
                                            onFocus={() => setHovered(item.label)}
                                            onClick={() => {
                                                item.onSelect?.();
                                                onClose();
                                            }}
                                            initial={reduce ? false : { opacity: 0, x: 6 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{
                                                delay: reduce ? 0 : 0.03 + idx * 0.025,
                                                duration: 0.18,
                                                ease: "easeOut",
                                            }}
                                            className={`relative flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-[13px] outline-none transition-colors duration-100 ${
                                                disabled
                                                    ? "cursor-not-allowed text-primary-foreground/40"
                                                    : item.danger
                                                      ? "text-red-400/80 hover:text-red-400 focus-visible:text-red-400"
                                                      : "text-primary-foreground/60 hover:text-primary-foreground focus-visible:text-primary-foreground"
                                            }`}
                                        >
                                            {/* Sliding highlight shared between items */}
                                            {active && (
                                                <motion.span
                                                    layoutId="settings-menu-highlight"
                                                    className={`absolute inset-0 rounded-lg ${
                                                        item.danger
                                                            ? "bg-red-500/10"
                                                            : "bg-primary-foreground/10"
                                                    }`}
                                                    transition={
                                                        reduce
                                                            ? { duration: 0 }
                                                            : {
                                                                  type: "spring",
                                                                  stiffness: 600,
                                                                  damping: 40,
                                                              }
                                                    }
                                                />
                                            )}

                                            <span className="relative flex items-center gap-2.5">
                                                <item.icon size={15} />
                                                {item.label}
                                            </span>

                                            {item.isComming && (
                                                <span className="relative rounded-full border border-primary-foreground/20! px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground/60">
                                                    Soon
                                                </span>
                                            )}
                                        </motion.button>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
__ALGOFORGE_FILE_6c5cfc82ed6239ad__

mkdir -p apps/web/src/components/DashBoard
cat > apps/web/src/components/DashBoard/ShareModal.tsx <<'__ALGOFORGE_FILE_7fc35aca14e47892__'
"use client";

import { Dialog } from "@base-ui/react/dialog";
import { motion, type Variants } from "framer-motion";
import { Check, Copy, ExternalLink, Globe, Link2, Lock, Share2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

interface ShareModalProps {
    isOpen: boolean;
    onClose: VoidFunction;
    /** Public URL of the shared item. Without one, sharing is shown as unavailable (no backend yet). */
    link?: string | null;
    title?: string;
}

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];
const list: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.05, delayChildren: 0.1 } } };
const rise: Variants = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: EASE } } };

async function copyText(text: string): Promise<boolean> {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        try {
            const ta = document.createElement("textarea");
            ta.value = text;
            ta.setAttribute("readonly", "");
            ta.style.position = "fixed";
            ta.style.opacity = "0";
            document.body.appendChild(ta);
            ta.select();
            const ok = document.execCommand("copy");
            document.body.removeChild(ta);
            return ok;
        } catch {
            return false;
        }
    }
}

const SECONDARY =
    "flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-primary-foreground/10! bg-primary-foreground/3 py-2.5 text-[12px] font-medium text-primary-foreground/70 transition hover:bg-primary-foreground/8 hover:text-primary-foreground";

const ShareModal = ({ isOpen, onClose, link = null, title = "Share analysis" }: ShareModalProps) => {
    const canShare = !!link;
    const [copied, setCopied] = useState(false);
    const [failed, setFailed] = useState(false);
    const [isPublic, setIsPublic] = useState(true);
    const [canNativeShare, setCanNativeShare] = useState(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        setCanNativeShare(typeof navigator !== "undefined" && !!navigator.share);
    }, []);
    useEffect(
        () => () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        },
        [],
    );

    const handleCopy = useCallback(async () => {
        if (!link || !isPublic) return;
        const ok = await copyText(link);
        setCopied(ok);
        setFailed(!ok);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
            setCopied(false);
            setFailed(false);
        }, 2000);
    }, [isPublic, link]);

    const handleNativeShare = async () => {
        if (!link || !isPublic) return;
        try {
            await navigator.share({ title, url: link });
        } catch {
            /* user cancelled */
        }
    };

    return (
        <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <Dialog.Portal>
                <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0" />
                <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4">
                    <Dialog.Popup className="pointer-events-auto relative w-full max-w-120 overflow-hidden rounded-2xl border border-primary-foreground/10! bg-primary-background shadow-2xl outline-none transition-[opacity,transform] duration-200 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
                        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-linear-to-b from-accent/10 to-transparent" />

                        <motion.div variants={list} initial="hidden" animate="show" className="relative">
                            <motion.div variants={rise} className="flex items-center justify-between px-5 pb-4 pt-5">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary-foreground/10! bg-primary-foreground/5">
                                        <Share2 size={16} className="text-primary-foreground/80" strokeWidth={1.75} aria-hidden />
                                    </div>
                                    <div className="flex flex-col leading-tight">
                                        <Dialog.Title className="text-[15px] font-semibold tracking-tight text-primary-foreground">{title}</Dialog.Title>
                                        <Dialog.Description className="text-[12px] text-primary-foreground/60">
                                            {canShare ? "Send this report to anyone" : "Not available yet"}
                                        </Dialog.Description>
                                    </div>
                                </div>
                                <Dialog.Close aria-label="Close" className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-primary-foreground/60 transition hover:bg-primary-foreground/8 hover:text-primary-foreground">
                                    <X size={15} aria-hidden />
                                </Dialog.Close>
                            </motion.div>

                            {!canShare ? (
                                <motion.div variants={rise} className="px-5 pb-5">
                                    <div role="status" className="rounded-xl border border-primary-foreground/8! bg-primary-foreground/3 p-4 text-[13px] leading-relaxed">
                                        <p className="font-medium text-primary-foreground">Sharing isn&apos;t available yet</p>
                                        <p className="mt-1 text-primary-foreground/60">
                                            Links need saved visualizations, which need a backend. Until then there is nothing to share, so no link is shown.
                                        </p>
                                    </div>
                                    <div className="mt-4 flex justify-end">
                                        <Dialog.Close className="cursor-pointer rounded-lg border border-primary-foreground/10! px-3 py-1.5 text-[12px] text-primary-foreground/70 transition hover:bg-primary-foreground/8 hover:text-primary-foreground">
                                            Got it
                                        </Dialog.Close>
                                    </div>
                                </motion.div>
                            ) : (
                                <div className="space-y-4 px-5 pb-5">
                                    <motion.div variants={rise} className="flex items-center justify-between gap-4 rounded-xl border border-primary-foreground/8! bg-primary-foreground/3 p-3.5">
                                        <div className="flex items-center gap-3">
                                            <div className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${isPublic ? "bg-emerald-400/10 text-emerald-400" : "bg-primary-foreground/6 text-primary-foreground/60"}`}>
                                                {isPublic ? <Globe size={16} strokeWidth={1.75} aria-hidden /> : <Lock size={16} strokeWidth={1.75} aria-hidden />}
                                            </div>
                                            <div>
                                                <p className="text-[13px] font-medium text-primary-foreground">Public link</p>
                                                <p className="mt-0.5 text-[12px] text-primary-foreground/60">{isPublic ? "Anyone with the link can view" : "Link sharing is turned off"}</p>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            role="switch"
                                            aria-checked={isPublic}
                                            aria-label="Public link"
                                            onClick={() => setIsPublic((p) => !p)}
                                            className={`relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ${isPublic ? "bg-emerald-400" : "bg-primary-foreground/25"}`}
                                        >
                                            <motion.span layout transition={{ type: "spring", stiffness: 500, damping: 32 }} className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow" style={{ left: isPublic ? "22px" : "2px" }} />
                                        </button>
                                    </motion.div>

                                    <motion.div variants={rise} className="space-y-2">
                                        <div className={`flex items-center gap-2 rounded-xl border border-primary-foreground/10! bg-primary-foreground/3 p-1.5 pl-3 transition focus-within:border-accent/50! ${!isPublic ? "pointer-events-none opacity-60" : ""}`}>
                                            <Link2 size={14} className="shrink-0 text-primary-foreground/60" aria-hidden />
                                            <input
                                                readOnly
                                                disabled={!isPublic}
                                                value={link ?? ""}
                                                onFocus={(e) => e.currentTarget.select()}
                                                aria-label="Share link"
                                                className="min-w-0 flex-1 truncate bg-transparent font-mono text-[12px] text-primary-foreground/80 outline-none"
                                            />
                                            <button
                                                type="button"
                                                onClick={handleCopy}
                                                disabled={!isPublic}
                                                className={`flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-[12px] font-medium transition ${copied ? "bg-emerald-400/15 text-emerald-300" : failed ? "bg-red-400/15 text-red-300" : "bg-primary-foreground text-primary-background hover:opacity-90"}`}
                                            >
                                                {copied ? (
                                                    <>
                                                        <Check size={13} aria-hidden /> Copied
                                                    </>
                                                ) : failed ? (
                                                    "Failed"
                                                ) : (
                                                    <>
                                                        <Copy size={13} aria-hidden /> Copy
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                        <span role="status" className="sr-only">
                                            {copied ? "Link copied" : failed ? "Copy failed" : ""}
                                        </span>
                                        {!isPublic && <p className="px-1 text-[11px] text-primary-foreground/60">Turn on the public link to copy or share it.</p>}
                                    </motion.div>

                                    <motion.div variants={rise} className="flex gap-2">
                                        <a
                                            href={isPublic ? (link ?? undefined) : undefined}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            aria-disabled={!isPublic}
                                            tabIndex={isPublic ? 0 : -1}
                                            className={`${SECONDARY} ${!isPublic ? "pointer-events-none opacity-60" : ""}`}
                                        >
                                            <ExternalLink size={13} aria-hidden />
                                            Open
                                        </a>
                                        {canNativeShare && (
                                            <button type="button" onClick={handleNativeShare} disabled={!isPublic} className={`${SECONDARY} disabled:cursor-not-allowed disabled:opacity-60`}>
                                                <Share2 size={13} aria-hidden />
                                                Share…
                                            </button>
                                        )}
                                    </motion.div>
                                </div>
                            )}
                        </motion.div>
                    </Dialog.Popup>
                </div>
            </Dialog.Portal>
        </Dialog.Root>
    );
};

export default ShareModal;

__ALGOFORGE_FILE_7fc35aca14e47892__

mkdir -p apps/web/src/components/DashBoard
cat > apps/web/src/components/DashBoard/TitleBar.tsx <<'__ALGOFORGE_FILE_55b710dda591d77e__'
"use client";

import { UserCircleFreeIcons } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowDown, ArrowUp, CornerDownLeft, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import type { AccountMenuItem, AccountUser } from "./Setting";
import SettingsDropdown from "./Setting";

import NotificationsPopover, {
    type AppNotification,
} from "./NotificationsPopover";

import AlgoForgeLogo from "../Logo";

/* -------------------------------------------------------------------------- */
/* Keyboard Shortcut                                                          */
/* -------------------------------------------------------------------------- */

function Kbd({ children }: { children: React.ReactNode }) {
    return (
        <kbd
            className="
         inline-flex h-5 min-w-5 items-center justify-center
         rounded border border-primary-foreground/20!
         bg-primary-foreground/5 px-1
         font-sans text-[10px] font-medium
         text-primary-foreground/50
     "
        >
            {children}
        </kbd>
    );
}

/* -------------------------------------------------------------------------- */
/* Search                                                                     */
/* -------------------------------------------------------------------------- */

export interface SearchResultItem {
    id: string;
    title: string;
    category: "Algorithm" | "Data Structure" | "Guide" | "Utility";
    href: string;
    description: string;
}

export const searchData: SearchResultItem[] = [
    {
        id: "1",
        title: "Dijkstra's Shortest Path",
        category: "Algorithm",
        href: "/algorithms/dijkstra",
        description: "Find the shortest path between nodes in a graph.",
    },
    {
        id: "2",
        title: "A* Pathfinding Search",
        category: "Algorithm",
        href: "/algorithms/astar",
        description: "Heuristic-based graph traversal and path planning.",
    },
    {
        id: "3",
        title: "Red-Black Tree Visualizer",
        category: "Data Structure",
        href: "/data-structures/red-black-tree",
        description: "Self-balancing binary search tree operations.",
    },
    {
        id: "4",
        title: "Dynamic Programming Guide",
        category: "Guide",
        href: "/guides/dynamic-programming",
        description: "Master overlapping subproblems and optimal substructure.",
    },
    {
        id: "5",
        title: "Asymptotic Complexity Analyzer",
        category: "Utility",
        href: "/tools/complexity-analyzer",
        description: "Analyze Big-O time and space complexity automatically.",
    },
    {
        id: "6",
        title: "Breadth-First Search (BFS)",
        category: "Algorithm",
        href: "/algorithms/bfs",
        description: "Level-order traversal for trees and graphs.",
    },
];

const MAX_RESULTS = 6;

function escapeRegExp(s: string) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Bolds the matching part of a string. */
function Highlight({ text, query }: { text: string; query: string }) {
    const q = query.trim();
    if (!q) return <>{text}</>;
    const parts = text.split(new RegExp(`(${escapeRegExp(q)})`, "ig"));
    return (
        <>
            {parts.map((part, i) =>
                part.toLowerCase() === q.toLowerCase() ? (
                    <span key={i} className="font-semibold text-primary-foreground">
                        {part}
                    </span>
                ) : (
                    <span key={i}>{part}</span>
                ),
            )}
        </>
    );
}

function SearchBox({
    onSearch,
    onSelect,
    items = searchData,
}: {
    onSearch?: (query: string) => void;
    onSelect?: (item: SearchResultItem) => void;
    items?: SearchResultItem[];
}) {
    const reduce = useReducedMotion();
    const router = useRouter();
    const listId = useId();
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLUListElement>(null);

    const [focused, setFocused] = useState(false);
    const [value, setValue] = useState("");
    const [active, setActive] = useState(-1);
    const [isMac, setIsMac] = useState(false);

    const query = value.trim();

    /* Filter by title, description, or category. Empty query shows suggestions. */
    const results = useMemo(() => {
        if (!query) return items.slice(0, MAX_RESULTS);
        const q = query.toLowerCase();
        return items
            .filter(
                (i) =>
                    i.title.toLowerCase().includes(q) ||
                    i.description.toLowerCase().includes(q) ||
                    i.category.toLowerCase().includes(q),
            )
            .sort((a, b) => {
                // Title matches first
                const at = a.title.toLowerCase().includes(q) ? 0 : 1;
                const bt = b.title.toLowerCase().includes(q) ? 0 : 1;
                return at - bt;
            })
            .slice(0, MAX_RESULTS);
    }, [items, query]);

    const open = focused;

    /* Reset the highlighted row when the results change */
    useEffect(() => {
        setActive(query && results.length ? 0 : -1);
    }, [query, results.length]);

    /* Keep the active row in view */
    useEffect(() => {
        if (active < 0) return;
        listRef.current
            ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
            ?.scrollIntoView({ block: "nearest" });
    }, [active]);

    useEffect(() => {
        setIsMac(/mac|iphone|ipad/i.test(navigator.platform));

        const handleShortcut = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;

            const isTyping =
                target.tagName === "INPUT" ||
                target.tagName === "TEXTAREA" ||
                target.isContentEditable;

            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
                e.preventDefault();
                inputRef.current?.focus();
            }

            if (e.key === "/" && !isTyping) {
                e.preventDefault();
                inputRef.current?.focus();
            }
        };

        window.addEventListener("keydown", handleShortcut);
        return () => window.removeEventListener("keydown", handleShortcut);
    }, []);

    const choose = (item: SearchResultItem) => {
        setValue("");
        inputRef.current?.blur();
        onSelect?.(item);
        router.push(item.href);
    };

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (active >= 0 && results[active]) return choose(results[active]);
        if (query) onSearch?.(query);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Escape") {
            if (value) setValue("");
            else inputRef.current?.blur();
            return;
        }
        if (!results.length) return;
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => (i + 1) % results.length);
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => (i <= 0 ? results.length - 1 : i - 1));
        }
    };

    return (
        <motion.form
            role="search"
            onSubmit={handleSubmit}
            animate={{ width: focused ? 340 : 240 }}
            transition={
                reduce
                    ? { duration: 0 }
                    : { type: "spring", stiffness: 420, damping: 34 }
            }
            className="
            group relative hidden h-8 items-center
            rounded-lg border border-primary-foreground/20!
            bg-primary-background text-primary-foreground
            transition-[border-color] duration-200
            hover:border-primary-foreground/40!
            focus-within:border-primary-foreground/60!
            sm:flex
        "
        >
            <Search
                size={14}
                className={`
                pointer-events-none absolute left-2.5
                transition-colors duration-200
                ${focused ? "text-accent" : "text-primary-foreground/40"}
            `}
            />

            <input
                ref={inputRef}
                type="text"
                role="combobox"
                aria-expanded={open}
                aria-controls={listId}
                aria-autocomplete="list"
                aria-activedescendant={
                    active >= 0 ? `${listId}-${active}` : undefined
                }
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                onKeyDown={handleKeyDown}
                placeholder="Search algorithms..."
                aria-label="Search algorithms"
                autoComplete="off"
                spellCheck={false}
                className="
                h-full w-full bg-transparent
                pl-8 pr-16 text-[13px]
                outline-none
                placeholder:text-primary-foreground/40
            "
            />

            <div className="absolute right-1.5 flex items-center gap-1">
                {value ? (
                    <>
                        <button
                            type="button"
                            aria-label="Clear search"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                                setValue("");
                                inputRef.current?.focus();
                            }}
                            className="
                            flex h-5 w-5 items-center justify-center
                            rounded text-primary-foreground/40
                            transition-colors
                            hover:bg-primary-foreground/10
                            hover:text-primary-foreground
                        "
                        >
                            <X size={12} />
                        </button>

                        <Kbd>
                            <CornerDownLeft size={10} />
                        </Kbd>
                    </>
                ) : (
                    !focused && (
                        <>
                            <Kbd>{isMac ? "⌘" : "Ctrl"}</Kbd>
                            <Kbd>K</Kbd>
                        </>
                    )
                )}
            </div>

            {/* Results */}

            <AnimatePresence>
                {open && (
                    <motion.div
                        key="results"
                        initial={reduce ? false : { opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={reduce ? undefined : { opacity: 0, y: -4 }}
                        transition={{ duration: 0.14, ease: "easeOut" }}
                        onMouseDown={(e) => e.preventDefault()} /* keep input focused */
                        className="
                        absolute left-0 top-full z-40 mt-1.5 w-full
                        overflow-hidden rounded-lg scrollbar-thin
                        border border-primary-foreground/20!
                        bg-primary-background shadow-lg
                    "
                    >
                        {results.length > 0 ? (
                            <>
                                {!query && (
                                    <p className="px-3 pb-1 pt-2 text-[11px] text-primary-foreground/40">
                                        Suggested
                                    </p>
                                )}
                                <ul
                                    ref={listRef}
                                    id={listId}
                                    role="listbox"
                                    className="max-h-72 overflow-y-auto p-1"
                                >
                                    {results.map((item, i) => (
                                        <li
                                            key={item.id}
                                            id={`${listId}-${i}`}
                                            data-index={i}
                                            role="option"
                                            aria-selected={i === active}
                                            onMouseEnter={() => setActive(i)}
                                            onClick={() => choose(item)}
                                            className={`
                                            flex cursor-pointer items-start justify-between gap-3
                                            rounded-md px-2.5 py-2
                                            transition-colors duration-100
                                            ${i === active ? "bg-primary-foreground/10" : ""}
                                        `}
                                        >
                                            <span className="min-w-0">
                                                <span className="block truncate text-[13px] text-primary-foreground/90">
                                                    <Highlight text={item.title} query={query} />
                                                </span>
                                                <span className="block truncate text-[11px] text-primary-foreground/45">
                                                    <Highlight
                                                        text={item.description}
                                                        query={query}
                                                    />
                                                </span>
                                            </span>
                                            <span className="mt-0.5 shrink-0 text-[11px] text-primary-foreground/40">
                                                {item.category}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </>
                        ) : (
                            <div className="px-3 py-6 text-center">
                                <p className="text-[13px] text-primary-foreground/80">
                                    No results for “{query}”
                                </p>
                                <p className="mt-0.5 text-[11px] text-primary-foreground/40">
                                    Try an algorithm, data structure, or guide name.
                                </p>
                            </div>
                        )}

                        <div className="flex items-center gap-3 border-t border-primary-foreground/15 px-3 py-1.5 text-[11px] text-primary-foreground/40">
                            <span className="flex items-center gap-1">
                                <Kbd><ArrowUp size={10} /></Kbd>
                                <Kbd><ArrowDown size={10} /></Kbd>
                                navigate
                            </span>
                            <span className="flex items-center gap-1">
                                <Kbd><CornerDownLeft size={10} /></Kbd>
                                open
                            </span>
                            <span className="ml-auto flex items-center gap-1">
                                <Kbd>Esc</Kbd>
                                close
                            </span>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.form>
    );
}

/* -------------------------------------------------------------------------- */
/* Top Navigation                                                             */
/* -------------------------------------------------------------------------- */

export interface TopNavProps {
    user?: AccountUser | null;
    menuItems?: AccountMenuItem[];
    notifications?: AppNotification[];
    onSearch?: (query: string) => void;
    /** Called when a result is opened. Navigation to its href happens automatically. */
    onSelectResult?: (item: SearchResultItem) => void;
    /** Override the searchable items. Defaults to the built-in list. */
    searchItems?: SearchResultItem[];
}

export default function TopNav({
    notifications = [],
    onSearch,
    onSelectResult,
    searchItems,
}: TopNavProps) {
    const reduce = useReducedMotion();

    const [settingsOpen, setSettingsOpen] = useState(false);

    const menuRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);

    /* Close dropdown on outside click or Escape */

    useEffect(() => {
        if (!settingsOpen) return;

        const handlePointerDown = (e: PointerEvent) => {
            if (!menuRef.current?.contains(e.target as Node)) {
                setSettingsOpen(false);
            }
        };

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                setSettingsOpen(false);
                triggerRef.current?.focus();
            }
        };

        document.addEventListener("pointerdown", handlePointerDown);
        document.addEventListener("keydown", handleKeyDown);

        return () => {
            document.removeEventListener("pointerdown", handlePointerDown);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [settingsOpen]);

    return (
        <header
            className="
        relative z-30 flex h-12 shrink-0
        items-center justify-between
        rounded-b-2xl
        border-b border-primary-foreground/20!
        bg-primary-background/80
        px-4 backdrop-blur-md
        supports-backdrop-filter:bg-primary-background/70
    "
        >
            {/* Brand */}

            <motion.a
                href="/"
                whileTap={reduce ? undefined : { scale: 0.97 }}
                aria-label="AlgoForge home"
                className="
                flex items-center rounded-md
                outline-none
                focus-visible:ring-2
                focus-visible:ring-accent/60
            "
            >
                <AlgoForgeLogo size={19} />

                <span
                    className="
                font-chango text-lg
                tracking-tight text-primary-foreground
            "
                >
                    lgo<span className="text-accent">Forge</span>
                </span>
            </motion.a>

            {/* Right Actions */}

            <div className="flex items-center gap-2">
                {/* Search */}

                <SearchBox
                    onSearch={onSearch}
                    onSelect={onSelectResult}
                    items={searchItems}
                />

                {/* Notifications */}

                <motion.div
                    whileTap={reduce ? undefined : { scale: 0.92 }}
                    className="
                    flex h-8 w-8 items-center
                    justify-center rounded-full
                    text-primary-foreground
                    transition-colors duration-150
                    hover:bg-accent/20
                "
                >
                    <NotificationsPopover notifications={notifications} />
                </motion.div>

                {/* Divider */}

                <div
                    aria-hidden="true"
                    className="h-5 w-px bg-primary-foreground/15"
                />

                {/* Account & Settings */}

                <div ref={menuRef} className="relative">
                    <motion.button
                        ref={triggerRef}
                        type="button"
                        onClick={() => setSettingsOpen((open) => !open)}
                        whileTap={reduce ? undefined : { scale: 0.94 }}
                        aria-label="Account and settings"
                        aria-haspopup="menu"
                        aria-expanded={settingsOpen}
                        className={`
                        flex h-8 w-8 items-center justify-center
                        rounded-full border
                        text-primary-foreground outline-none
                        transition-all duration-200
                        focus-visible:ring-2
                        focus-visible:ring-accent/60
                        ${
                            settingsOpen
                                ? "border-primary-foreground/50! bg-accent/30"
                                : "border-primary-foreground/20! hover:border-primary-foreground/40! hover:bg-accent/20"
                        }
                    `}
                    >
                        <HugeiconsIcon icon={UserCircleFreeIcons} size={25} />
                    </motion.button>

                    <SettingsDropdown
                        open={settingsOpen}
                        onClose={() => {
                            setSettingsOpen(false);
                            triggerRef.current?.focus();
                        }}
                    />
                </div>
            </div>
        </header>
    );
}
__ALGOFORGE_FILE_55b710dda591d77e__

mkdir -p apps/web/src/components/DashBoard
cat > apps/web/src/components/DashBoard/analysis-history.tsx <<'__ALGOFORGE_FILE_ee1ae29875b388d6__'
"use client";

import React, {
    memo,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    BulbIcon,
    Chart01Icon,
    Clock01Icon,
    JavaScriptFreeIcons,
    PythonFreeIcons,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { SampleChip } from "@/components/ui/SampleChip";

// ─── Types ────────────────────────────────────────────────────────────────────

type Language = "javascript" | "python";
type LanguageFilter = "all" | Language;
type SortOrder = "newest" | "oldest";
type Tone = "good" | "warn" | "bad" | "none";

export interface AnalysisHistoryItem {
    id: string;
    language: Language;
    complexity: string | null;
    suggestion: string | null;
    createdAt: string;
}

export interface AnalysisHistoryMeta {
    nextCursor: string | null;
    hasMore: boolean;
}

interface AnalysisHistoryProps {
    items: AnalysisHistoryItem[];
    meta: AnalysisHistoryMeta;
    /** Fetch the next batch from the server. Called when paging past the loaded rows. */
    onLoadMore: () => void;
    /** Initial load: shows skeleton rows. */
    loading?: boolean;
    /** Fetching the next batch: disables Next and shows skeleton rows. */
    loadingMore?: boolean;
    /** Shown with a retry action when a fetch failed. */
    error?: string | null;
    onRetry?: () => void;
    /** Called with the selected item, or null when the selection is cleared. */
    onSelect?: (item: AnalysisHistoryItem | null) => void;
    /** Optional. When provided, an expanded row shows a Delete action. */
    onDelete?: (item: AnalysisHistoryItem) => void;
    /** Rows per page. Default 8. */
    pageSize?: number;
    /** Builds the dashboard URL for an analysis. Default: `/dashboard/${id}`. */
    getDashboardHref?: (item: AnalysisHistoryItem) => string;
    /** The rows are fixed sample content. */
    sample?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const EASE = [0.22, 1, 0.36, 1] as const;

function formatRelativeTime(iso: string, now: number): string {
    const s = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000));
    if (s < 45) return "just now";
    const m = Math.floor(s / 60);
    if (m < 60) return `${Math.max(m, 1)}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d < 30) return `${d}d ago`;
    return new Date(iso).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
    });
}

function formatExact(iso: string): string {
    return new Date(iso).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
    });
}

function groupLabel(iso: string, now: number): string {
    const startOfDay = (t: number) => {
        const d = new Date(t);
        d.setHours(0, 0, 0, 0);
        return d.getTime();
    };
    const days = Math.round(
        (startOfDay(now) - startOfDay(new Date(iso).getTime())) / 86_400_000,
    );
    if (days <= 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return "This week";
    return "Earlier";
}

function complexityTone(complexity: string | null): Tone {
    if (!complexity) return "none";
    const c = complexity.toLowerCase();
    if (c.includes("low") || c.includes("o(1)") || c.includes("o(log"))
        return "good";
    if (c.includes("medium") || c.includes("o(n)")) return "warn";
    return "bad";
}

const TONE_DOT: Record<Tone, string> = {
    good: "bg-emerald-400",
    warn: "bg-amber-400",
    bad: "bg-rose-400",
    none: "bg-zinc-600",
};

/** 1 … 4 5 6 … 12 style page list. */
function pageWindow(current: number, total: number): (number | "gap")[] {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages = new Set([1, total, current, current - 1, current + 1]);
    const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
    const out: (number | "gap")[] = [];
    sorted.forEach((p, i) => {
        if (i > 0 && p - sorted[i - 1] > 1) out.push("gap");
        out.push(p);
    });
    return out;
}

function useNow(intervalMs = 30_000) {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), intervalMs);
        return () => clearInterval(id);
    }, [intervalMs]);
    return now;
}

// ─── Small pieces ─────────────────────────────────────────────────────────────

const Svg = ({ children, size = 14 }: { children: React.ReactNode; size?: number }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
    >
        {children}
    </svg>
);

const SearchIcon = () => (
    <Svg>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
    </Svg>
);
const CopyIcon = () => (
    <Svg>
        <rect x="9" y="9" width="11" height="11" rx="2" />
        <path d="M5 15V6a2 2 0 0 1 2-2h9" />
    </Svg>
);
const CheckIcon = () => (
    <Svg>
        <path d="m5 12 5 5L20 7" />
    </Svg>
);
const CloseIcon = () => (
    <Svg>
        <path d="M6 6l12 12M18 6 6 18" />
    </Svg>
);
const TrashIcon = () => (
    <Svg>
        <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
    </Svg>
);
const ChevronLeft = () => (
    <Svg>
        <path d="m15 18-6-6 6-6" />
    </Svg>
);
const ChevronRight = () => (
    <Svg>
        <path d="m9 18 6-6-6-6" />
    </Svg>
);
const ArrowUpRight = () => (
    <Svg size={12}>
        <path d="M7 17 17 7M8 7h9v9" />
    </Svg>
);

const SkeletonRow = memo(({ index }: { index: number }) => (
    <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: index * 0.04, duration: 0.25 }}
        className="flex items-start gap-3 rounded-lg px-3 py-3"
        aria-hidden
    >
        <div className="h-8 w-8 shrink-0 animate-pulse rounded-md bg-primary-background/80" />
        <div className="flex-1 space-y-2 py-0.5">
            <div className="h-3 w-24 animate-pulse rounded bg-primary-background/80" />
            <div className="h-3 w-full animate-pulse rounded bg-primary-background/60" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-primary-background/40" />
        </div>
        <div className="h-3 w-10 shrink-0 animate-pulse rounded bg-primary-background/80" />
    </motion.div>
));
SkeletonRow.displayName = "SkeletonRow";

const StateMessage = ({
    title,
    body,
    action,
}: {
    title: string;
    body: string;
    action?: { label: string; onClick: () => void };
}) => (
    <div className="flex flex-col items-center justify-center p-8 text-center">
        <p className="text-xs font-semibold text-zinc-200">{title}</p>
        <p className="mt-1 text-xs text-zinc-500">{body}</p>
        {action && (
            <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={action.onClick}
                className="mt-3 h-7 text-[11px]"
            >
                {action.label}
            </Button>
        )}
    </div>
);

const Segmented = memo(
    <T extends string>({
        value,
        options,
        onChange,
        label,
        id,
    }: {
        value: T;
        options: { value: T; label: string }[];
        onChange: (v: T) => void;
        label: string;
        id: string;
    }) => (
        <div
            role="radiogroup"
            aria-label={label}
            className="relative flex items-center rounded-md border border-primary-foreground/20 p-0.5"
        >
            {options.map((o) => {
                const active = o.value === value;
                return (
                    <button
                        key={o.value}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => onChange(o.value)}
                        className={`relative rounded px-2 py-1 text-[11px] font-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-primary-foreground/30 ${
                            active
                                ? "text-zinc-100"
                                : "text-zinc-500 hover:text-zinc-300"
                        }`}
                    >
                        {active && (
                            <motion.span
                                layoutId={`seg-${id}`}
                                className="absolute inset-0 rounded bg-zinc-800"
                                transition={{
                                    type: "spring",
                                    stiffness: 500,
                                    damping: 38,
                                }}
                            />
                        )}
                        <span className="relative">{o.label}</span>
                    </button>
                );
            })}
        </div>
    ),
) as <T extends string>(p: {
    value: T;
    options: { value: T; label: string }[];
    onChange: (v: T) => void;
    label: string;
    id: string;
}) => React.ReactElement;

// ─── History Item ─────────────────────────────────────────────────────────────

interface HistoryItemProps {
    item: AnalysisHistoryItem;
    index: number;
    now: number;
    isSelected: boolean;
    reduce: boolean;
    href: string;
    onSelect: (id: string) => void;
    onDelete?: (item: AnalysisHistoryItem) => void;
}

const HistoryItem = memo(
    ({
        item,
        index,
        now,
        isSelected,
        reduce,
        href,
        onSelect,
        onDelete,
    }: HistoryItemProps) => {
        const [copied, setCopied] = useState(false);
        const tone = complexityTone(item.complexity);

        useEffect(() => {
            if (!copied) return;
            const t = setTimeout(() => setCopied(false), 1400);
            return () => clearTimeout(t);
        }, [copied]);

        const copy = useCallback(async () => {
            if (!item.suggestion) return;
            try {
                await navigator.clipboard.writeText(item.suggestion);
                setCopied(true);
            } catch {
                /* clipboard unavailable */
            }
        }, [item.suggestion]);

        return (
            <motion.div
                initial={reduce ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                    duration: 0.24,
                    ease: EASE,
                    delay: Math.min(index, 8) * 0.03,
                }}
                className={`rounded-lg border transition-colors duration-150 ${
                    isSelected
                        ? "border-zinc-700 bg-primary-background/80"
                        : "border-transparent hover:bg-primary-background/50"
                }`}
            >
                <div className="flex items-start">
                    <button
                        data-testid="history-row"
                        type="button"
                        aria-expanded={isSelected}
                        onClick={() => onSelect(item.id)}
                        className="group flex min-w-0 flex-1 items-start gap-3 rounded-lg px-3 py-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground/30"
                    >
                        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-primary-foreground/20 bg-primary-background text-primary-foreground">
                            <HugeiconsIcon
                                icon={
                                    item.language === "javascript"
                                        ? JavaScriptFreeIcons
                                        : PythonFreeIcons
                                }
                                className="h-4 w-4"
                            />
                        </span>

                        <span className="flex min-w-0 flex-1 flex-col gap-1">
                            <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                                <span className="text-[13px] font-medium text-zinc-100">
                                    {item.language === "javascript"
                                        ? "JavaScript"
                                        : "Python"}
                                </span>
                                {item.complexity && (
                                    <span className="inline-flex items-center gap-1.5 text-xs text-zinc-300">
                                        <span
                                            className={`h-1.5 w-1.5 rounded-full ${TONE_DOT[tone]}`}
                                        />
                                        {item.complexity}
                                    </span>
                                )}
                                <time
                                    dateTime={item.createdAt}
                                    title={formatExact(item.createdAt)}
                                    className="whitespace-nowrap text-[11px] tabular-nums text-zinc-500"
                                >
                                    {formatRelativeTime(item.createdAt, now)}
                                </time>
                            </span>
                            {!isSelected && (
                                <span
                                    className={`text-xs leading-relaxed ${
                                        item.suggestion
                                            ? "line-clamp-2 text-zinc-400"
                                            : "italic text-zinc-500"
                                    }`}
                                >
                                    {item.suggestion ?? "No suggestion available"}
                                </span>
                            )}
                        </span>
                    </button>

                    <Link
                        href={href}
                        aria-label={`Open ${item.language} analysis in dashboard`}
                        className="mr-2 mt-2.5 inline-flex h-7 shrink-0 items-center gap-1 rounded-md border border-primary-foreground/20 px-2 text-[11px] font-medium text-zinc-300 outline-none transition-colors duration-150 hover:border-zinc-600 hover:bg-zinc-800/60 hover:text-zinc-100 focus-visible:ring-2 focus-visible:ring-primary-foreground/30"
                    >
                        Open
                        <ArrowUpRight />
                    </Link>
                </div>

                <AnimatePresence initial={false}>
                    {isSelected && (
                        <motion.div
                            key="detail"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: reduce ? 0 : 0.22, ease: EASE }}
                            className="overflow-hidden"
                        >
                            <div className="mx-3 mb-3 ml-15 space-y-3 border-t border-primary-foreground/20 pt-3">
                                <div className="flex gap-2 text-xs leading-relaxed text-zinc-300">
                                    <HugeiconsIcon
                                        icon={BulbIcon}
                                        className="mt-0.5 h-4 w-4 shrink-0 text-primary-foreground"
                                    />
                                    <p>
                                        {item.suggestion ??
                                            "No suggestion was generated for this analysis."}
                                    </p>
                                </div>

                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <span className="flex items-center gap-1.5 text-[11px] text-zinc-500">
                                        <HugeiconsIcon
                                            icon={Clock01Icon}
                                            className="h-3.5 w-3.5"
                                        />
                                        {formatExact(item.createdAt)}
                                    </span>
                                    <span className="flex items-center gap-1">
                                        {item.suggestion && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={copy}
                                                className="h-7 gap-1.5 px-2 text-[11px] text-zinc-400 hover:text-zinc-100"
                                            >
                                                {copied ? <CheckIcon /> : <CopyIcon />}
                                                {copied ? "Copied" : "Copy"}
                                            </Button>
                                        )}
                                        {onDelete && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => onDelete(item)}
                                                className="h-7 gap-1.5 px-2 text-[11px] text-zinc-400 hover:text-rose-400"
                                            >
                                                <TrashIcon />
                                                Delete
                                            </Button>
                                        )}
                                    </span>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        );
    },
);
HistoryItem.displayName = "HistoryItem";

// ─── Pagination ───────────────────────────────────────────────────────────────

const PageButton = ({
    children,
    active,
    disabled,
    label,
    onClick,
}: {
    children: React.ReactNode;
    active?: boolean;
    disabled?: boolean;
    label: string;
    onClick: () => void;
}) => (
    <button
        type="button"
        aria-label={label}
        aria-current={active ? "page" : undefined}
        disabled={disabled}
        onClick={onClick}
        className={`relative flex h-7 min-w-7 items-center justify-center rounded-md px-1.5 text-[11px] font-medium tabular-nums outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-primary-foreground/30 disabled:pointer-events-none disabled:opacity-35 ${
            active ? "text-zinc-100" : "text-zinc-500 hover:text-zinc-200"
        }`}
    >
        {active && (
            <motion.span
                layoutId="page-pill"
                className="absolute inset-0 rounded-md bg-zinc-800"
                transition={{ type: "spring", stiffness: 500, damping: 38 }}
            />
        )}
        <span className="relative flex items-center">{children}</span>
    </button>
);

// ─── Main Component ───────────────────────────────────────────────────────────

const SKELETON_COUNT = 5;

const LANGUAGE_OPTIONS: { value: LanguageFilter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "javascript", label: "JS" },
    { value: "python", label: "Python" },
];

const SORT_OPTIONS: { value: SortOrder; label: string }[] = [
    { value: "newest", label: "Newest" },
    { value: "oldest", label: "Oldest" },
];

export default function AnalysisHistory({
    items,
    meta,
    onLoadMore,
    loading = false,
    loadingMore = false,
    error = null,
    onRetry,
    onSelect,
    onDelete,
    pageSize = 8,
    getDashboardHref = (item) => `/dashboard/${item.id}`,
    sample = false,
}: AnalysisHistoryProps) {
    const reduce = !!useReducedMotion();
    const now = useNow();

    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [query, setQuery] = useState("");
    const [language, setLanguage] = useState<LanguageFilter>("all");
    const [sort, setSort] = useState<SortOrder>("newest");
    const [page, setPage] = useState(1);
    const [awaitingMore, setAwaitingMore] = useState(false);

    const listRef = useRef<HTMLDivElement>(null);

    // Filter (suggestion search + language) and sort
    const visible = useMemo(() => {
        const q = query.trim().toLowerCase();
        const filtered = items.filter((i) => {
            if (language !== "all" && i.language !== language) return false;
            if (!q) return true;
            return (i.suggestion ?? "").toLowerCase().includes(q);
        });
        return filtered.sort((a, b) => {
            const diff =
                new Date(b.createdAt).getTime() -
                new Date(a.createdAt).getTime();
            return sort === "newest" ? diff : -diff;
        });
    }, [items, query, language, sort]);

    const isFiltering = query.trim() !== "" || language !== "all";

    // Pagination over the loaded rows
    const totalPages = Math.max(1, Math.ceil(visible.length / pageSize));
    const canFetchMore = meta.hasMore && !isFiltering;
    const currentPage = Math.min(page, totalPages);
    const start = (currentPage - 1) * pageSize;
    const pageItems = visible.slice(start, start + pageSize);
    const onLastLoadedPage = currentPage >= totalPages;
    const nextDisabled = loadingMore || (onLastLoadedPage && !canFetchMore);

    const groups = useMemo(() => {
        const map = new Map<string, AnalysisHistoryItem[]>();
        for (const item of pageItems) {
            const label = groupLabel(item.createdAt, now);
            map.set(label, [...(map.get(label) ?? []), item]);
        }
        return Array.from(map.entries());
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible, currentPage, pageSize, now]);

    const scrollTop = () =>
        listRef.current
            ?.closest("[data-radix-scroll-area-viewport]")
            ?.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });

    const goTo = useCallback(
        (p: number) => {
            setPage(Math.max(1, Math.min(p, totalPages)));
            scrollTop();
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [totalPages],
    );

    const goNext = useCallback(() => {
        if (!onLastLoadedPage) return goTo(currentPage + 1);
        if (canFetchMore && !loadingMore) {
            setAwaitingMore(true);
            onLoadMore();
        }
    }, [onLastLoadedPage, goTo, currentPage, canFetchMore, loadingMore, onLoadMore]);

    // Once the requested batch arrives, move to the first new page
    const prevCount = useRef(items.length);
    useEffect(() => {
        if (awaitingMore && items.length > prevCount.current) {
            setAwaitingMore(false);
            setPage(currentPage + 1);
            scrollTop();
        }
        if (awaitingMore && error) setAwaitingMore(false);
        prevCount.current = items.length;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [items.length, error]);

    // Reset to page 1 when filters change
    useEffect(() => {
        setPage(1);
    }, [query, language, sort]);

    // Selection
    const handleSelect = useCallback(
        (id: string) => {
            const next = selectedId === id ? null : id;
            setSelectedId(next);
            onSelect?.(next ? (items.find((i) => i.id === next) ?? null) : null);
        },
        [selectedId, items, onSelect],
    );

    const clearSelection = useCallback(() => {
        setSelectedId(null);
        onSelect?.(null);
    }, [onSelect]);

    // Drop the selection when its row is no longer on the visible page
    useEffect(() => {
        if (selectedId && !pageItems.some((i) => i.id === selectedId)) {
            setSelectedId(null);
            onSelect?.(null);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pageItems, selectedId]);

    // Keyboard: ↑/↓ rows, ←/→ pages, Esc clears
    const onKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLDivElement>) => {
            const typing = (e.target as HTMLElement).tagName === "INPUT";

            if (e.key === "Escape") {
                if (typing && query) setQuery("");
                else if (selectedId) clearSelection();
                return;
            }
            if (typing) return;

            if (e.key === "ArrowLeft" && currentPage > 1) {
                e.preventDefault();
                goTo(currentPage - 1);
                return;
            }
            if (e.key === "ArrowRight" && !nextDisabled) {
                e.preventDefault();
                goNext();
                return;
            }
            if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;

            const rows = Array.from(
                listRef.current?.querySelectorAll<HTMLButtonElement>(
                    '[data-testid="history-row"]',
                ) ?? [],
            );
            if (!rows.length) return;
            const i = rows.indexOf(document.activeElement as HTMLButtonElement);
            e.preventDefault();
            (e.key === "ArrowDown"
                ? rows[Math.min(i + 1, rows.length - 1)]
                : rows[Math.max(i - 1, 0)]
            )?.focus();
        },
        [query, selectedId, clearSelection, currentPage, goTo, goNext, nextDisabled],
    );

    let runningIndex = 0;
    const rangeEnd = start + pageItems.length;
    const pages = pageWindow(currentPage, totalPages);

    return (
        <div
            onKeyDown={onKeyDown}
            className="flex h-full w-full flex-col overflow-hidden rounded-2xl border border-primary-foreground/20 bg-primary-background"
        >
            {/* Header */}
            <div className="shrink-0 space-y-3 border-b border-primary-foreground/20 px-4 pb-3 pt-3.5">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <HugeiconsIcon
                            icon={Chart01Icon}
                            className="h-4 w-4 text-zinc-400"
                        />
                        <h2 className="text-sm font-semibold tracking-tight text-zinc-100">
                            Analysis history
                        </h2>
                        
                        {sample && <SampleChip />}
                    </div>
                    <AnimatePresence>
                        {selectedId && (
                            <motion.button
                                key="clear"
                                type="button"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.15 }}
                                onClick={clearSelection}
                                className="rounded px-1.5 py-0.5 text-[11px] text-zinc-400 outline-none transition-colors hover:text-zinc-100 focus-visible:ring-2 focus-visible:ring-primary-foreground/30"
                            >
                                Clear selection
                            </motion.button>
                        )}
                    </AnimatePresence>
                </div>

                {/* Search by suggestion */}
                <div className="relative">
                    <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500">
                        <SearchIcon />
                    </span>
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search by suggestion"
                        aria-label="Search by suggestion"
                        className="h-8 w-full rounded-md border border-primary-foreground/20 bg-transparent pl-8 pr-8 text-xs text-zinc-100 outline-none transition-colors placeholder:text-zinc-500 focus:border-zinc-500"
                    />
                    <AnimatePresence>
                        {query && (
                            <motion.button
                                key="x"
                                type="button"
                                aria-label="Clear search"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.12 }}
                                onClick={() => setQuery("")}
                                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-zinc-500 outline-none hover:text-zinc-100 focus-visible:ring-2 focus-visible:ring-primary-foreground/30"
                            >
                                <CloseIcon />
                            </motion.button>
                        )}
                    </AnimatePresence>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <Segmented
                        id="lang"
                        label="Filter by language"
                        value={language}
                        options={LANGUAGE_OPTIONS}
                        onChange={setLanguage}
                    />
                    <Segmented
                        id="sort"
                        label="Sort order"
                        value={sort}
                        options={SORT_OPTIONS}
                        onChange={setSort}
                    />
                </div>
            </div>

            {/* List */}
            <ScrollArea className="min-h-0 flex-1">
                <div ref={listRef} className="px-2 py-2" aria-busy={loading || loadingMore}>
                    {loading ? (
                        Array.from({ length: SKELETON_COUNT }).map((_, i) => (
                            <SkeletonRow key={i} index={i} />
                        ))
                    ) : error && items.length === 0 ? (
                        <StateMessage
                            title="Couldn't load your history"
                            body={error}
                            action={onRetry ? { label: "Try again", onClick: onRetry } : undefined}
                        />
                    ) : items.length === 0 ? (
                        <StateMessage
                            title="No analyses yet"
                            body="Run an analysis and it will show up here."
                        />
                    ) : visible.length === 0 ? (
                        <StateMessage
                            title="No matches"
                            body="No loaded suggestion fits these filters."
                        />
                    ) : (
                        <div className="space-y-4">
                            {groups.map(([groupTitle, groupItems]) => (
                                <div key={groupTitle} className="space-y-1">
                                    <div className="px-3 py-1 text-[11px] font-semibold text-zinc-500">
                                        {groupTitle}
                                    </div>
                                    <div className="space-y-1">
                                        {groupItems.map((item) => {
                                            const index = runningIndex++;
                                            return (
                                                <HistoryItem
                                                    key={item.id}
                                                    item={item}
                                                    index={index}
                                                    now={now}
                                                    isSelected={selectedId === item.id}
                                                    reduce={reduce}
                                                    href={getDashboardHref(item)}
                                                    onSelect={handleSelect}
                                                    onDelete={onDelete}
                                                />
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                            {loadingMore &&
                                Array.from({ length: 2 }).map((_, i) => (
                                    <SkeletonRow key={`more-${i}`} index={i} />
                                ))}
                        </div>
                    )}
                </div>
            </ScrollArea>

            {/* Footer / Pagination */}
            {!loading && visible.length > 0 && (
                <div className="flex shrink-0 items-center justify-center border-t border-primary-foreground/20 px-4 py-2 text-xs text-zinc-400">
                    
                    <div className="flex items-center gap-1">
                        <PageButton
                            label="Previous page"
                            disabled={currentPage === 1}
                            onClick={() => goTo(currentPage - 1)}
                        >
                            <ChevronLeft />
                        </PageButton>
                        {pages.map((p, idx) =>
                            p === "gap" ? (
                                <span key={`gap-${idx}`} className="px-1 text-zinc-600">
                                    …
                                </span>
                            ) : (
                                <PageButton
                                    key={p}
                                    label={`Page ${p}`}
                                    active={p === currentPage}
                                    onClick={() => goTo(p)}
                                >
                                    {p}
                                </PageButton>
                            ),
                        )}
                        <PageButton
                            label="Next page"
                            disabled={nextDisabled}
                            onClick={goNext}
                        >
                            <ChevronRight />
                        </PageButton>
                    </div>
                </div>
            )}
        </div>
    );
} 
__ALGOFORGE_FILE_ee1ae29875b388d6__

mkdir -p apps/web/src/components/LandingPage
cat > apps/web/src/components/LandingPage/WhatYouGet.tsx <<'__ALGOFORGE_FILE_71b74be9d7b135af__'
"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { AiBrain01Icon, MessageMultiple01Icon, PlayIcon, TrendingUp } from "@hugeicons/core-free-icons";
import { IconSvgObject } from "@/lib/types";
import { StatusChip } from "@/components/ui/StatusChip";
import type { FeatureStatus } from "@/lib/featureStatus";
import { Eyebrow, IconBubble, LandingStyles, Reveal, SpotCard } from "./shared";

type Feature = {
    id: string;
    icon: IconSvgObject;
    title: string;
    short: string;
    description: string;
    tag: string;
    index: string;
    status: FeatureStatus;
};

const features: Feature[] = [
    {
        id: "visualizer", icon: PlayIcon, title: "Algorithm Visualizer", short: "See every step", tag: "Visual", index: "01", status: "available",
        description: "Step through array, stack, queue, linked list, tree, hash and graph operations with frame-by-frame animation. Pause, scrub, replay and change the speed.",
    },
    {
        id: "ai-analysis", icon: AiBrain01Icon, title: "AI Analysis", short: "Complexity and bottlenecks", tag: "Core", index: "02", status: "preview",
        description: "A report with complexity, bottlenecks and edge cases. The report screen is built; the analysis engine is not connected yet, so it shows a fixed sample.",
    },
    {
        id: "explainer", icon: MessageMultiple01Icon, title: "AI Explainer", short: "Plain-English breakdowns", tag: "Learn", index: "03", status: "planned",
        description: "Plain-language walkthroughs of an algorithm. Not built yet.",
    },
    {
        id: "optimization", icon: TrendingUp, title: "Optimization Hints", short: "Suggested rewrites", tag: "Optimize", index: "04", status: "planned",
        description: "Ranked rewrite suggestions with the expected change in Big-O. Not built yet.",
    },
];

const availableCount = features.filter((f) => f.status === "available").length;

const STRUCTURES = ["Array", "Stack", "Queue", "Linked list", "Binary tree", "Hash map", "Graph"];
const OPS = ["insert()", "push()", "enqueue()", "delete()", "rotate()", "hash()", "bfs()", "swap()"];

// Big animation #4: two counter-moving marquee rows (CSS only, pause on hover)
function MarqueeRow({ items, reverse = false }: { items: string[]; reverse?: boolean }) {
    const half = [...items, ...items, ...items];
    const full = [...half, ...half];
    return (
        <div className="overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_12%,#000_88%,transparent)]">
            <div className={`af-marquee-track flex w-max gap-3 ${reverse ? "af-marquee-rev" : "af-marquee"}`}>
                {full.map((t, i) => (
                    <span
                        key={i}
                        className="inline-flex items-center gap-2 rounded-full border border-foreground/10 bg-foreground/[.03] px-4 py-1.5 font-mono text-xs text-foreground/70 sm:px-5 sm:py-2 sm:text-sm"
                    >
                        <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                        {t}
                    </span>
                ))}
            </div>
        </div>
    );
}

export default function WhatYouGet() {
    return (
        <section id="products" className="relative w-full overflow-x-clip px-4 py-16 md:py-28">
            <LandingStyles />
            <div className="relative z-10 mx-auto max-w-6xl">
                <Reveal className="mb-14 text-center">
                    <Eyebrow>Platform capabilities</Eyebrow>
                    <h2 className="mt-6 text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
                        What you <span className="text-accent">get</span>
                    </h2>
                    <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-foreground/60">
                        What the visualizer does today, and what is still on the way.
                    </p>
                </Reveal>

                <div className="mb-14 space-y-3">
                    <MarqueeRow items={STRUCTURES} />
                    <MarqueeRow items={OPS} reverse />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {features.map((f, i) => (
                        <Reveal key={f.id} delay={i * 0.07}>
                            <SpotCard className="h-full">
                                <div className="flex h-full flex-col gap-5 p-6">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono text-xs font-bold tracking-widest text-foreground/50 transition-colors group-hover:text-accent">
                                                {f.index}
                                            </span>
                                            <StatusChip status={f.status} />
                                        </div>
                                        <span className="font-mono text-[11px] font-semibold uppercase tracking-widest text-foreground/50">
                                            {f.tag}
                                        </span>
                                    </div>
                                    <IconBubble icon={f.icon} />
                                    <div className="flex flex-1 flex-col gap-2">
                                        <h3 className="text-sm font-bold tracking-tight">{f.title}</h3>
                                        <p className="text-xs font-medium text-accent">{f.short}</p>
                                        <p className="mt-1 text-xs leading-relaxed text-foreground/60">{f.description}</p>
                                    </div>
                                </div>
                            </SpotCard>
                        </Reveal>
                    ))}
                </div>

                <div className="mt-8 flex flex-wrap items-center justify-between gap-2 px-1">
                    <span className="font-mono text-[11px] uppercase tracking-widest text-foreground/60">
                        {availableCount} available · {features.length - availableCount} not yet
                    </span>
                    <span className="font-mono text-[11px] uppercase tracking-widest text-accent">Preview</span>
                </div>
            </div>
        </section>
    );
}

__ALGOFORGE_FILE_71b74be9d7b135af__

mkdir -p apps/web/src/components/LandingPage
cat > apps/web/src/components/LandingPage/shared.tsx <<'__ALGOFORGE_FILE_73efc1022825cc57__'
"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { motion, useReducedMotion, useScroll, useSpring } from "framer-motion";
import { HugeiconsIcon } from "@hugeicons/react";
import type { IconSvgObject } from "@/lib/types";
import { prefersReducedMotion } from "@/lib/reducedMotion";

/** Tiny keyframe sheet shared by every landing section (CSS only, cheap). */
export function LandingStyles() {
    return (
        <style>{`
@keyframes af-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
@keyframes af-wiggle{0%,100%{transform:rotate(0)}25%{transform:rotate(-8deg)}75%{transform:rotate(8deg)}}
@keyframes af-ping{0%{transform:scale(1);opacity:.5}100%{transform:scale(2.4);opacity:0}}
@keyframes af-marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}
@keyframes af-marquee-rev{from{transform:translateX(-50%)}to{transform:translateX(0)}}
@keyframes af-eye{0%,92%,100%{transform:scaleY(1)}96%{transform:scaleY(.1)}}
@keyframes af-spin{to{transform:rotate(360deg)}}
@keyframes af-scroll{0%{transform:translateY(0);opacity:1}100%{transform:translateY(12px);opacity:0}}
.af-float{animation:af-float 5s ease-in-out infinite}
.af-ping{animation:af-ping 2.4s ease-out infinite}
.af-marquee{animation:af-marquee 38s linear infinite}
.af-marquee-rev{animation:af-marquee-rev 44s linear infinite}
.af-marquee-track:hover{animation-play-state:paused}
.af-eye{animation:af-eye 5s ease-in-out infinite}
.af-orbit{animation:af-spin 26s linear infinite}
.af-orbit-item{animation:af-spin 26s linear infinite reverse}
.af-scroll-dot{animation:af-scroll 1.6s ease-in-out infinite}
.af-reveal{opacity:0;transform:translateY(14px);transition:opacity .5s ease,transform .5s ease}
.af-in{opacity:1;transform:none}
@media (prefers-reduced-motion: reduce){
  .af-float,.af-ping,.af-marquee,.af-marquee-rev,.af-eye,.af-orbit,.af-orbit-item,.af-scroll-dot{animation:none!important}
  .af-reveal{opacity:1;transform:none;transition:none}
}
`}</style>
    );
}

/** Thin accent progress line pinned to the top of the viewport. */
export function ScrollProgress() {
    const { scrollYProgress } = useScroll();
    const scaleX = useSpring(scrollYProgress, { stiffness: 140, damping: 30, mass: 0.3 });
    return <motion.div aria-hidden style={{ scaleX }} className="fixed inset-x-0 top-0 z-[1000] h-[2px] origin-left bg-accent" />;
}

export function Eyebrow({ children }: { children: ReactNode }) {
    return (
        <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-foreground/10 bg-foreground/[.04] px-3 py-1.5 sm:px-4">
            <span className="relative flex h-2 w-2">
                <span className="af-ping absolute inline-flex h-full w-full rounded-full bg-accent" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
            </span>
            <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-foreground/60 sm:text-[11px] sm:tracking-widest">{children}</span>
        </div>
    );
}

export function Reveal({ children, delay = 0, y = 22, className = "" }: { children: ReactNode; delay?: number; y?: number; className?: string }) {
    const reduce = useReducedMotion();
    return (
        <motion.div
            className={className}
            initial={reduce ? false : { opacity: 0, y, filter: "blur(4px)" }}
            whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}
        >
            {children}
        </motion.div>
    );
}

/** Card with a faint cursor-following highlight and a lift on hover. */
export function SpotCard({ children, className = "" }: { children: ReactNode; className?: string }) {
    return (
        <div
            onMouseMove={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
                e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
            }}
            className={`group relative overflow-hidden rounded-3xl border border-foreground/10 bg-foreground/[.03] transition-all duration-300 hover:-translate-y-1 hover:border-accent/30 ${className}`}
        >
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                style={{ background: "radial-gradient(240px circle at var(--mx,50%) var(--my,50%), color-mix(in srgb, var(--accent) 7%, transparent), transparent 70%)" }}
            />
            <div className="relative h-full">{children}</div>
        </div>
    );
}

export function IconBubble({ icon, size = 20 }: { icon: IconSvgObject; size?: number }) {
    return (
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-foreground/10 bg-foreground/[.04] text-foreground/70 transition-colors duration-300 group-hover:border-accent/40 group-hover:bg-accent/10 group-hover:text-accent group-hover:[animation:af-wiggle_.6s_ease-in-out]">
            <HugeiconsIcon icon={icon} size={size} color="currentColor" strokeWidth={1.5} />
        </span>
    );
}

/** Orange mascot. Eyes follow the cursor (desktop), blink, float. */
export function Buddy({ size = 72, track = true }: { size?: number; track?: boolean }) {
    const left = useRef<HTMLSpanElement>(null);
    const right = useRef<HTMLSpanElement>(null);

    useEffect(() => {
        if (!track || prefersReducedMotion()) return;
        const on = (e: MouseEvent) => {
            [left.current, right.current].forEach((p) => {
                const eye = p?.parentElement;
                if (!p || !eye) return;
                const b = eye.getBoundingClientRect();
                const dx = e.clientX - (b.left + b.width / 2);
                const dy = e.clientY - (b.top + b.height / 2);
                const d = Math.hypot(dx, dy) || 1;
                const m = Math.min(size * 0.06, d / 25);
                p.style.transform = `translate(${(dx / d) * m}px,${(dy / d) * m}px)`;
            });
        };
        window.addEventListener("mousemove", on, { passive: true });
        return () => window.removeEventListener("mousemove", on);
    }, [track, size]);

    const eye = size * 0.24;
    return (
        <div className="af-float relative shrink-0" style={{ width: size, height: size }} aria-hidden>
            <div className="absolute inset-0 rounded-[30%] bg-accent shadow-[0_8px_16px_-10px_rgba(0,0,0,0.7)]" />
            <div className="absolute left-1/2 top-[34%] flex -translate-x-1/2" style={{ gap: size * 0.16 }}>
                {[left, right].map((r, i) => (
                    <span key={i} className="af-eye flex items-center justify-center rounded-full bg-white" style={{ width: eye, height: eye }}>
                        <span ref={r} className="block rounded-full bg-black" style={{ width: eye * 0.5, height: eye * 0.5 }} />
                    </span>
                ))}
            </div>
            <span className="absolute left-1/2 -translate-x-1/2 rounded-b-full border-b-[3px] border-black" style={{ top: "62%", width: size * 0.22, height: size * 0.11 }} />
            <span className="absolute rounded-full bg-white/30" style={{ left: "14%", top: "58%", width: size * 0.13, height: size * 0.08 }} />
            <span className="absolute rounded-full bg-white/30" style={{ right: "14%", top: "58%", width: size * 0.13, height: size * 0.08 }} />
        </div>
    );
}

__ALGOFORGE_FILE_73efc1022825cc57__

mkdir -p apps/web/src/components/auth
cat > apps/web/src/components/auth/GoogleLoginModal.tsx <<'__ALGOFORGE_FILE_68cf041092278655__'
// PARKED since Phase 3: not mounted anywhere. Before remounting, rebuild the shell on
// @base-ui/react/dialog like DashBoard/ShareModal.tsx (focus trap, Escape, focus return, aria-modal).
"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useIsClient } from "@/hooks/useIsClient";
import { AnimatePresence, motion, Variants } from "framer-motion";
import { X } from "lucide-react";
import { GlassCard } from "@/components/auth/GlassCard";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { ModalBackdrop } from "@/components/auth/ModalBackdrop";
import { useModalAnimations } from "@/components/auth/useModalAnimations";
import AlgoForgeLogo from "../Logo";
import Link from "next/link";

const MotionLink = motion.create(Link);
interface GoogleLoginModalProps {
    isOpen: boolean;
    onClose: () => void;
    onGoogleLogin?: () => Promise<void>;
}

// Replaces SOC2 badges — live activity strip
const ACTIVITY_ITEMS = [
    {
        user: "M",
        name: "marcos_k",
        action: "deployed main",
        ago: "2m ago",
        dot: "#22c55e",
    },
    {
        user: "A",
        name: "aiko.dev",
        action: "opened PR #318",
        ago: "8m ago",
        dot: "#ff4d00",
    },
    {
        user: "R",
        name: "r_santos",
        action: "merged to prod",
        ago: "14m ago",
        dot: "#facc15",
    },
];

const cardVariants: Variants = {
    hidden: { opacity: 0, scale: 0.88, y: 32, rotateX: 6 },
    visible: {
        opacity: 1,
        scale: 1,
        y: 0,
        rotateX: 0,
        transition: { type: "spring", stiffness: 220, damping: 22, mass: 0.9 },
    },
    exit: {
        opacity: 0,
        scale: 0.92,
        y: 20,
        filter: "blur(8px)",
        transition: { duration: 0.22, ease: "easeIn" },
    },
};

export function GoogleLoginModal({
    isOpen,
    onClose,
    onGoogleLogin,
}: GoogleLoginModalProps) {
    const { cardRef, logoRef, contentRef } = useModalAnimations(isOpen);
    const isClient = useIsClient();

    useEffect(() => {
        document.body.style.overflow = isOpen ? "hidden" : "";
        return () => {
            document.body.style.overflow = "";
        };
    }, [isOpen]);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [onClose]);

    const handleLogin = async () => {
        await onGoogleLogin?.();
        onClose();
    };

    if (!isClient) return null; // all hooks are above this line

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <>
                    <ModalBackdrop onClose={onClose} />

                    <div
                        className="fixed inset-0 z-9999 flex items-center justify-center p-4 backdrop-blur-2xl sm:p-6"
                        onMouseDown={(e) => {
                            if (e.target === e.currentTarget) onClose(); // this layer now covers the backdrop
                        }}
                    >
                        <motion.div
                            className="relative w-full max-w-97.5"
                            style={{ perspective: "1200px" }}
                            variants={cardVariants}
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                        >
                            <GlassCard
                                ref={cardRef}
                                className="px-8 py-8 sm:px-9 sm:py-9"
                            >
                                {/* ── Close button — subtle slide + fade, no spin ── */}
                                <motion.button
                                    className="absolute right-4 top-4 z-10 flex h-7 w-7 items-center justify-center rounded-md text-white/60"
                                    onClick={onClose}
                                    initial={false}
                                    whileHover={{
                                        color: "rgba(255,255,255,0.75)",
                                        backgroundColor:
                                            "rgba(255,255,255,0.06)",
                                        borderColor: "rgba(255,255,255,0.12)",
                                    }}
                                    whileTap={{ scale: 0.92 }}
                                    style={{
                                        border: "1px solid rgba(255,255,255,0.05)",
                                        transition:
                                            "background 0.2s, color 0.2s, border-color 0.2s",
                                    }}
                                >
                                    <motion.span
                                        whileHover={{ x: 0.5, y: -0.5 }}
                                        transition={{
                                            type: "spring",
                                            stiffness: 500,
                                            damping: 18,
                                        }}
                                    >
                                        <X
                                            className="h-3.5 w-3.5"
                                            strokeWidth={2}
                                        />
                                    </motion.span>
                                </motion.button>

                                {/* ── Logo / brand ── */}
                                <div
                                    ref={logoRef}
                                    className="mb-8 flex flex-col items-center"
                                >
                                    <div className="relative mb-4">
                                        {/* Orange pulse rings */}
                                        {[0, 0.55].map((delay, i) => (
                                            <motion.div
                                                key={i}
                                                className="absolute inset-0 rounded-2xl"
                                                style={{
                                                    border: "1px solid rgba(255,77,0,0.3)",
                                                }}
                                                animate={{
                                                    scale: [1, 1.55],
                                                    opacity: [0.4, 0],
                                                }}
                                                transition={{
                                                    duration: 2,
                                                    repeat: Infinity,
                                                    delay,
                                                    ease: "easeOut",
                                                }}
                                            />
                                        ))}

                                        <div
                                            className="relative flex h-14 w-14 items-center p-2 justify-center rounded-2xl"
                                            style={{
                                                background:
                                                    "linear-gradient(135deg, rgba(255,77,0,0.18) 0%, rgba(255,255,255,0.05) 100%)",
                                                border: "1px solid rgba(255,77,0,0.25)",
                                                boxShadow:
                                                    "inset 0 1px 0 rgba(255,255,255,0.12), 0 8px 32px rgba(255,77,0,0.12)",
                                            }}
                                        >
                                            <AlgoForgeLogo />
                                        </div>
                                    </div>

                                    <h1 className="font-display text-xl font-semibold tracking-tight text-white">
                                        Welcome back
                                    </h1>
                                    <p
                                        className="mt-1 text-center text-sm"
                                        style={{
                                            color: "rgba(255,255,255,0.38)",
                                        }}
                                    >
                                        Sign in to continue to your workspace
                                    </p>
                                </div>

                                {/* ── Content ── */}
                                <div ref={contentRef} className="space-y-4">
                                    <GoogleButton onLogin={handleLogin} />
                                </div>

                                {/* Footer */}
                                <p
                                    className="mt-5 text-center text-[11px] leading-relaxed font-body"
                                    style={{ color: "rgba(255,255,255,0.18)" }}
                                >
                                    By continuing, you agree to our{" "}
                                    <MotionLink
                                        href="/terms"
                                        className="underline-offset-2 hover:underline"
                                        style={{
                                            color: "rgba(255,255,255,0.38)",
                                        }}
                                        whileHover={{
                                            color: "rgba(255,255,255,0.6)",
                                        }}
                                    >
                                        Terms
                                    </MotionLink>{" "}
                                    and{" "}
                                    <MotionLink
                                        href="/privacy"
                                        className="underline-offset-2 hover:underline"
                                        style={{
                                            color: "rgba(255,255,255,0.38)",
                                        }}
                                        whileHover={{
                                            color: "rgba(255,255,255,0.6)",
                                        }}
                                    >
                                        Privacy Policy
                                    </MotionLink>
                                </p>
                            </GlassCard>
                        </motion.div>
                    </div>
                </>
            )}
        </AnimatePresence>,
        document.body,
    );
}

__ALGOFORGE_FILE_68cf041092278655__

mkdir -p apps/web/src/components/ui
cat > apps/web/src/components/ui/FeaturePanel.tsx <<'__ALGOFORGE_FILE_051862497c843c2b__'
// FeaturePanel.tsx
"use client";

import { useRef } from "react";
import { motion, Variants } from "framer-motion";
import FeatureCard from "@/components/ui/FeatureCard";
import { StatusChip } from "@/components/ui/StatusChip";
import type { FeatureStatus } from "@/lib/featureStatus";

export type Feature = {
    id: string;
    tag: string;
    index: string;
    status: FeatureStatus;
    title: string;
    description: string;
    points: string[];
};

const containerVariants: Variants = {
    hidden: {},
    visible: {
        transition: { staggerChildren: 0.09, delayChildren: 0.05 },
    },
};

const itemVariants: Variants = {
    hidden: { opacity: 0, y: 18 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] },
    },
};

export default function FeaturePanel({ feature }: { feature: Feature }) {
    return (
        <div className="grid w-full max-w-6xl grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-24 items-center">
            {/* ── Left: text ── */}
            <motion.div
                variants={containerVariants}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: false, margin: "-80px" }}
                className="flex flex-col gap-6"
            >
                {/* Eyebrow */}
                <motion.div
                    variants={itemVariants}
                    className="inline-flex items-center gap-2 rounded-2xl w-fit border border-foreground/15 bg-foreground/[.04] px-3 py-1"
                >
                    <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                    <span className="font-mono text-[11px]  uppercase tracking-widest font-bold text-foreground/60">
                        {feature.tag}
                    </span>
                    <StatusChip status={feature.status} />
                </motion.div>

                {/* Index + Title */}
                <motion.div variants={itemVariants} className="flex items-start gap-4">
                    <span className="font-mono text-xs text-foreground/60 tracking-widest mt-2 select-none">
                        {feature.index}
                    </span>
                    <h2 className="text-4xl font-black leading-tight tracking-tight text-foreground md:text-5xl xl:text-6xl">
                        {feature.title}
                    </h2>
                </motion.div>

                {/* Description */}
                <motion.p
                    variants={itemVariants}
                    className="max-w-md text-sm leading-relaxed text-foreground/60"
                >
                    {feature.description}
                </motion.p>

                {/* Decorative rule */}
                <motion.div
                    variants={itemVariants}
                    className="flex items-center gap-3"
                >
                    <div className="h-px w-8 bg-foreground/10" />
                    <div className="h-px w-16 bg-accent" />
                    <div className="h-px w-8 bg-foreground/10" />
                </motion.div>
            </motion.div>

            {/* ── Right: card ── */}
            <motion.div
                variants={containerVariants}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: false, margin: "-80px" }}
            >
                <FeatureCard points={feature.points} />
            </motion.div>
        </div>
    );
}
__ALGOFORGE_FILE_051862497c843c2b__

mkdir -p apps/web/src/components/ui
cat > apps/web/src/components/ui/card-hover-effect.tsx <<'__ALGOFORGE_FILE_cd47dfc63aeda9a0__'
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "motion/react";

import { useState } from "react";

export const HoverEffect = ({
  items,
  className,
}: {
  items: {
    title: string;
    description: string;
    link: string;
  }[];
  className?: string;
}) => {
  let [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  return (
    <div
      className={cn(
        "grid grid-cols-1 md:grid-cols-2  lg:grid-cols-3  py-10",
        className
      )}
    >
      {items.map((item, idx) => (
        <a
          href={item?.link}
          key={item?.link}
          className="relative group  block p-2 h-full w-full"
          onMouseEnter={() => setHoveredIndex(idx)}
          onMouseLeave={() => setHoveredIndex(null)}
        >
          <AnimatePresence>
            {hoveredIndex === idx && (
              <motion.span
                className="absolute inset-0 h-full w-full bg-neutral-200 dark:bg-slate-800/[0.8] block  rounded-3xl"
                layoutId="hoverBackground"
                initial={{ opacity: 0 }}
                animate={{
                  opacity: 1,
                  transition: { duration: 0.15 },
                }}
                exit={{
                  opacity: 0,
                  transition: { duration: 0.15, delay: 0.2 },
                }}
              />
            )}
          </AnimatePresence>
          <Card>
            <CardTitle>{item.title}</CardTitle>
            <CardDescription>{item.description}</CardDescription>
          </Card>
        </a>
      ))}
    </div>
  );
};

export const Card = ({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) => {
  return (
    <div
      className={cn(
        "rounded-2xl h-full w-full p-4 overflow-hidden bg-black border border-transparent dark:border-white/[0.2] group-hover:border-slate-700 relative z-20",
        className
      )}
    >
      <div className="relative z-50">
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
};
export const CardTitle = ({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) => {
  return (
    <h4 className={cn("text-zinc-100 font-bold tracking-wide mt-4", className)}>
      {children}
    </h4>
  );
};
export const CardDescription = ({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) => {
  return (
    <p
      className={cn(
        "mt-8 text-zinc-400 tracking-wide leading-relaxed text-sm",
        className
      )}
    >
      {children}
    </p>
  );
};

__ALGOFORGE_FILE_cd47dfc63aeda9a0__

mkdir -p apps/web/src/components/ui
cat > apps/web/src/components/ui/glowing-effect.tsx <<'__ALGOFORGE_FILE_107e80f05e681878__'
"use client";

import { memo, useCallback, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { animate } from "motion/react";

interface GlowingEffectProps {
  blur?: number;
  inactiveZone?: number;
  proximity?: number;
  spread?: number;
  variant?: "default" | "white";
  glow?: boolean;
  className?: string;
  disabled?: boolean;
  movementDuration?: number;
  borderWidth?: number;
}
const GlowingEffect = memo(
  ({
    blur = 0,
    inactiveZone = 0.7,
    proximity = 0,
    spread = 20,
    variant = "default",
    glow = false,
    className,
    movementDuration = 2,
    borderWidth = 1,
    disabled = true,
  }: GlowingEffectProps) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const lastPosition = useRef({ x: 0, y: 0 });
    const animationFrameRef = useRef<number>(0);

    const handleMove = useCallback(
      (e?: MouseEvent | { x: number; y: number }) => {
        if (!containerRef.current) return;

        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }

        animationFrameRef.current = requestAnimationFrame(() => {
          const element = containerRef.current;
          if (!element) return;

          const { left, top, width, height } = element.getBoundingClientRect();
          const mouseX = e?.x ?? lastPosition.current.x;
          const mouseY = e?.y ?? lastPosition.current.y;

          if (e) {
            lastPosition.current = { x: mouseX, y: mouseY };
          }

          const center = [left + width * 0.5, top + height * 0.5];
          const distanceFromCenter = Math.hypot(
            mouseX - center[0],
            mouseY - center[1]
          );
          const inactiveRadius = 0.5 * Math.min(width, height) * inactiveZone;

          if (distanceFromCenter < inactiveRadius) {
            element.style.setProperty("--active", "0");
            return;
          }

          const isActive =
            mouseX > left - proximity &&
            mouseX < left + width + proximity &&
            mouseY > top - proximity &&
            mouseY < top + height + proximity;

          element.style.setProperty("--active", isActive ? "1" : "0");

          if (!isActive) return;

          const currentAngle =
            parseFloat(element.style.getPropertyValue("--start")) || 0;
          let targetAngle =
            (180 * Math.atan2(mouseY - center[1], mouseX - center[0])) /
              Math.PI +
            90;

          const angleDiff = ((targetAngle - currentAngle + 180) % 360) - 180;
          const newAngle = currentAngle + angleDiff;

          animate(currentAngle, newAngle, {
            duration: movementDuration,
            ease: [0.16, 1, 0.3, 1],
            onUpdate: (value) => {
              element.style.setProperty("--start", String(value));
            },
          });
        });
      },
      [inactiveZone, proximity, movementDuration]
    );

    useEffect(() => {
      if (disabled) return;

      const handleScroll = () => handleMove();
      const handlePointerMove = (e: PointerEvent) => handleMove(e);

      window.addEventListener("scroll", handleScroll, { passive: true });
      document.body.addEventListener("pointermove", handlePointerMove, {
        passive: true,
      });

      return () => {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
        window.removeEventListener("scroll", handleScroll);
        document.body.removeEventListener("pointermove", handlePointerMove);
      };
    }, [handleMove, disabled]);

    return (
      <>
        <div
          className={cn(
            "pointer-events-none absolute -inset-px hidden rounded-[inherit] border opacity-0 transition-opacity",
            glow && "opacity-100",
            variant === "white" && "border-white",
            disabled && "!block"
          )}
        />
        <div
          ref={containerRef}
          style={
            {
              "--blur": `${blur}px`,
              "--spread": spread,
              "--start": "0",
              "--active": "0",
              "--glowingeffect-border-width": `${borderWidth}px`,
              "--repeating-conic-gradient-times": "5",
              "--gradient":
                variant === "white"
                  ? `repeating-conic-gradient(
                  from 236.84deg at 50% 50%,
                  var(--black),
                  var(--black) calc(25% / var(--repeating-conic-gradient-times))
                )`
                  : `radial-gradient(circle, #dd7bbb 10%, #dd7bbb00 20%),
                radial-gradient(circle at 40% 40%, #d79f1e 5%, #d79f1e00 15%),
                radial-gradient(circle at 60% 60%, #5a922c 10%, #5a922c00 20%), 
                radial-gradient(circle at 40% 60%, #4c7894 10%, #4c789400 20%),
                repeating-conic-gradient(
                  from 236.84deg at 50% 50%,
                  #dd7bbb 0%,
                  #d79f1e calc(25% / var(--repeating-conic-gradient-times)),
                  #5a922c calc(50% / var(--repeating-conic-gradient-times)), 
                  #4c7894 calc(75% / var(--repeating-conic-gradient-times)),
                  #dd7bbb calc(100% / var(--repeating-conic-gradient-times))
                )`,
            } as React.CSSProperties
          }
          className={cn(
            "pointer-events-none absolute inset-0 rounded-[inherit] opacity-100 transition-opacity",
            glow && "opacity-100",
            blur > 0 && "blur-[var(--blur)] ",
            className,
            disabled && "!hidden"
          )}
        >
          <div
            className={cn(
              "glow",
              "rounded-[inherit]",
              'after:content-[""] after:rounded-[inherit] after:absolute after:inset-[calc(-1*var(--glowingeffect-border-width))]',
              "after:[border:var(--glowingeffect-border-width)_solid_transparent]",
              "after:[background:var(--gradient)] after:[background-attachment:fixed]",
              "after:opacity-[var(--active)] after:transition-opacity after:duration-300",
              "after:[mask-clip:padding-box,border-box]",
              "after:[mask-composite:intersect]",
              "after:[mask-image:linear-gradient(#0000,#0000),conic-gradient(from_calc((var(--start)-var(--spread))*1deg),#00000000_0deg,#fff,#00000000_calc(var(--spread)*2deg))]"
            )}
          />
        </div>
      </>
    );
  }
);

GlowingEffect.displayName = "GlowingEffect";

export { GlowingEffect };

__ALGOFORGE_FILE_107e80f05e681878__

mkdir -p apps/web/src/components/ui
cat > apps/web/src/components/ui/hover-border-gradient.tsx <<'__ALGOFORGE_FILE_be5c8c65d18d7dc8__'
"use client";
import React, { useState, useEffect } from "react";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";

type Direction = "TOP" | "LEFT" | "BOTTOM" | "RIGHT";

export function HoverBorderGradient({
  children,
  containerClassName,
  className,
  as: Tag = "button",
  duration = 1,
  clockwise = true,
  ...props
}: React.PropsWithChildren<
  {
    as?: React.ElementType;
    containerClassName?: string;
    className?: string;
    duration?: number;
    clockwise?: boolean;
  } & React.HTMLAttributes<HTMLElement>
>) {
  const [hovered, setHovered] = useState<boolean>(false);
  const [direction, setDirection] = useState<Direction>("TOP");

  const rotateDirection = (currentDirection: Direction): Direction => {
    const directions: Direction[] = ["TOP", "LEFT", "BOTTOM", "RIGHT"];
    const currentIndex = directions.indexOf(currentDirection);
    const nextIndex = clockwise
      ? (currentIndex - 1 + directions.length) % directions.length
      : (currentIndex + 1) % directions.length;
    return directions[nextIndex];
  };

  const movingMap: Record<Direction, string> = {
    TOP: "radial-gradient(20.7% 50% at 50% 0%, hsl(0, 0%, 100%) 0%, rgba(255, 255, 255, 0) 100%)",
    LEFT: "radial-gradient(16.6% 43.1% at 0% 50%, hsl(0, 0%, 100%) 0%, rgba(255, 255, 255, 0) 100%)",
    BOTTOM:
      "radial-gradient(20.7% 50% at 50% 100%, hsl(0, 0%, 100%) 0%, rgba(255, 255, 255, 0) 100%)",
    RIGHT:
      "radial-gradient(16.2% 41.199999999999996% at 100% 50%, hsl(0, 0%, 100%) 0%, rgba(255, 255, 255, 0) 100%)",
  };

  const highlight =
    "radial-gradient(75% 181.15942028985506% at 50% 50%, #3275F8 0%, rgba(255, 255, 255, 0) 100%)";

  useEffect(() => {
    if (!hovered) {
      const interval = setInterval(() => {
        setDirection((prevState) => rotateDirection(prevState));
      }, duration * 1000);
      return () => clearInterval(interval);
    }
  }, [hovered]);
  return (
    <Tag
      onMouseEnter={(event: React.MouseEvent<HTMLDivElement>) => {
        setHovered(true);
      }}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        "relative flex rounded-full border  content-center bg-black/20 hover:bg-black/10 transition duration-500 dark:bg-white/20 items-center flex-col flex-nowrap gap-10 h-min justify-center overflow-visible p-px decoration-clone w-fit",
        containerClassName
      )}
      {...props}
    >
      <div
        className={cn(
          "w-auto text-white z-10 bg-black px-4 py-2 rounded-[inherit]",
          className
        )}
      >
        {children}
      </div>
      <motion.div
        className={cn(
          "flex-none inset-0 overflow-hidden absolute z-0 rounded-[inherit]"
        )}
        style={{
          filter: "blur(2px)",
          position: "absolute",
          width: "100%",
          height: "100%",
        }}
        initial={{ background: movingMap[direction] }}
        animate={{
          background: hovered
            ? [movingMap[direction], highlight]
            : movingMap[direction],
        }}
        transition={{ ease: "linear", duration: duration ?? 1 }}
      />
      <div className="bg-black absolute z-1 flex-none inset-[2px] rounded-[100px]" />
    </Tag>
  );
}

__ALGOFORGE_FILE_be5c8c65d18d7dc8__

mkdir -p apps/web/src/components/ui
cat > apps/web/src/components/ui/resizable-navbar.tsx <<'__ALGOFORGE_FILE_1a15966fb4c916c5__'
"use client";
import { cn } from "@/lib/utils";
import { IconMenu2, IconX } from "@tabler/icons-react";
import {
    motion,
    AnimatePresence,
    useScroll,
    useMotionValueEvent,
} from "motion/react";
import Image from "next/image";
import Link from "next/link";

import React, { useRef, useState } from "react";
import AlgoForgeLogo from "../Logo";

interface NavbarProps {
    children: React.ReactNode;
    className?: string;
}

interface NavBodyProps {
    children: React.ReactNode;
    className?: string;
    visible?: boolean;
}

interface NavItemsProps {
    items: {
        name: string;
        link: string;
    }[];
    className?: string;
    onItemClick?: () => void;
}

interface MobileNavProps {
    children: React.ReactNode;
    className?: string;
    visible?: boolean;
}

interface MobileNavHeaderProps {
    children: React.ReactNode;
    className?: string;
}

interface MobileNavMenuProps {
    children: React.ReactNode;
    className?: string;
    isOpen: boolean;
    onClose: () => void;
}

export const Navbar = ({ children, className }: NavbarProps) => {
    const ref = useRef<HTMLDivElement>(null);
    const { scrollY } = useScroll({
        target: ref,
        offset: ["start start", "end start"],
    });
    const [visible, setVisible] = useState<boolean>(false);

    useMotionValueEvent(scrollY, "change", (latest) => {
        if (latest > 100) {
            setVisible(true);
        } else {
            setVisible(false);
        }
    });

    return (
        <motion.div
            ref={ref}
            // IMPORTANT: Change this to class of `fixed` if you want the navbar to be fixed
            className={cn("sticky inset-x-0 top-20 z-40 w-full", className)}
        >
            {React.Children.map(children, (child) =>
                React.isValidElement(child)
                    ? React.cloneElement(
                          child as React.ReactElement<{ visible?: boolean }>,
                          { visible },
                      )
                    : child,
            )}
        </motion.div>
    );
};

export const NavBody = ({ children, className, visible }: NavBodyProps) => {
    return (
        <motion.div
            animate={{
                backdropFilter: visible ? "blur(10px)" : "none",
                boxShadow: visible
                    ? "0 0 24px rgba(34, 42, 53, 0.06), 0 1px 1px rgba(0, 0, 0, 0.05), 0 0 0 1px rgba(34, 42, 53, 0.04), 0 0 4px rgba(34, 42, 53, 0.08), 0 16px 68px rgba(47, 48, 55, 0.05), 0 1px 0 rgba(255, 255, 255, 0.1) inset"
                    : "none",
                width: visible ? "40%" : "100%",
                y: visible ? 20 : 0,
            }}
            transition={{
                type: "spring",
                stiffness: 200,
                damping: 50,
            }}
            style={{
                minWidth: "800px",
            }}
            className={cn(
                "relative z-60 mx-auto hidden w-full max-w-7xl flex-row items-center justify-between self-start rounded-full bg-transparent px-4 py-2 lg:flex dark:bg-transparent",
                visible && "bg-white/80 dark:bg-neutral-950/80",
                className,
            )}
        >
            {children}
        </motion.div>
    );
};

export const NavItems = ({ items, className, onItemClick }: NavItemsProps) => {
    const [hovered, setHovered] = useState<number | null>(null);

    return (
        <motion.div
            onMouseLeave={() => setHovered(null)}
            className={cn(
                "absolute inset-0 hidden pl-5 flex-1 flex-row items-center justify-center space-x-2 text-sm font-medium text-zinc-400 transition duration-200 hover:text-zinc-800 lg:flex lg:space-x-2",
                className,
            )}
        >
            {items.map((item, idx) => (
                <a
                    onMouseEnter={() => setHovered(idx)}
                    onClick={onItemClick}
                    className="relative px-4 py-2 text-neutral-400 dark:text-neutral-300"
                    key={`link-${idx}`}
                    href={item.link}
                >
                    {hovered === idx && (
                        <motion.div
                            layoutId="hovered"
                            className="absolute inset-0 h-full w-full rounded-full bg-gray-100 dark:bg-neutral-800"
                        />
                    )}
                    <span className="relative z-20">{item.name}</span>
                </a>
            ))}
        </motion.div>
    );
};

export const MobileNav = ({ children, className, visible }: MobileNavProps) => {
    return (
        <motion.div
            animate={{
                backdropFilter: visible ? "blur(10px)" : "none",
                boxShadow: visible
                    ? "0 0 24px rgba(34, 42, 53, 0.06), 0 1px 1px rgba(0, 0, 0, 0.05), 0 0 0 1px rgba(34, 42, 53, 0.04), 0 0 4px rgba(34, 42, 53, 0.08), 0 16px 68px rgba(47, 48, 55, 0.05), 0 1px 0 rgba(255, 255, 255, 0.1) inset"
                    : "none",
                width: visible ? "90%" : "100%",
                paddingRight: visible ? "12px" : "0px",
                paddingLeft: visible ? "12px" : "0px",
                borderRadius: visible ? "4px" : "2rem",
                y: visible ? 20 : 0,
            }}
            transition={{
                type: "spring",
                stiffness: 200,
                damping: 50,
            }}
            className={cn(
                "relative z-50 mx-auto flex w-full max-w-[calc(100vw-2rem)] flex-col items-center justify-between bg-transparent px-0 py-2 lg:hidden",
                visible && "bg-white/80 dark:bg-neutral-950/80",
                className,
            )}
        >
            {children}
        </motion.div>
    );
};

export const MobileNavHeader = ({
    children,
    className,
}: MobileNavHeaderProps) => {
    return (
        <div
            className={cn(
                "flex w-full flex-row items-center justify-between",
                className,
            )}
        >
            {children}
        </div>
    );
};

export const MobileNavMenu = ({
    children,
    className,
    isOpen,
    onClose,
}: MobileNavMenuProps) => {
    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={(e) => {
                        if ((e.target as HTMLElement).closest("a[href]"))
                            onClose();
                    }}
                    className={cn(
                        "absolute inset-x-0 top-16 z-50 flex w-full flex-col items-start justify-start gap-4 rounded-lg border border-white/10 bg-neutral-950 px-4 py-8 text-neutral-200 shadow-2xl",
                        className,
                    )}
                >
                    {children}
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export const MobileNavToggle = ({
    isOpen,
    onClick,
}: {
    isOpen: boolean;
    onClick: () => void;
}) => {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={isOpen ? "Close menu" : "Open menu"}
            aria-expanded={isOpen}
            className="rounded-md p-1 text-black dark:text-white"
        >
            {isOpen ? <IconX aria-hidden /> : <IconMenu2 aria-hidden />}
        </button>
    );
};

export const NavbarLogo = () => {
    return (
        <Link
            href="/"
            className="relative z-20 mr-4 flex items-center px-2 py-1 text-sm font-normal text-black"
        >
            <AlgoForgeLogo size={20} />
            <span className="sr-only">A</span>
            <span className="font-medium font-chango text-xl text-black dark:text-white">
                lgo<span className="text-accent">Forge</span>
            </span>
        </Link>
    );
};

export const NavbarButton = ({
    href,
    as: Tag = "a",
    children,
    className,
    variant = "primary",
    ...props
}: {
    href?: string;
    as?: React.ElementType;
    children: React.ReactNode;
    className?: string;
    variant?: "primary" | "secondary" | "dark" | "gradient";
} & (
    | React.ComponentPropsWithoutRef<"a">
    | React.ComponentPropsWithoutRef<"button">
)) => {
    const baseStyles =
        "px-4 py-2 rounded-md bg-white button bg-white text-black text-sm font-bold relative cursor-pointer hover:-translate-y-0.5 transition duration-200 inline-block text-center";

    const variantStyles = {
        primary:
            "shadow-[0_0_24px_rgba(34,_42,_53,_0.06),_0_1px_1px_rgba(0,_0,_0,_0.05),_0_0_0_1px_rgba(34,_42,_53,_0.04),_0_0_4px_rgba(34,_42,_53,_0.08),_0_16px_68px_rgba(47,_48,_55,_0.05),_0_1px_0_rgba(255,_255,_255,_0.1)_inset]",
        secondary: "bg-transparent shadow-none dark:text-white",
        dark: "bg-black text-white shadow-[0_0_24px_rgba(34,_42,_53,_0.06),_0_1px_1px_rgba(0,_0,_0,_0.05),_0_0_0_1px_rgba(34,_42,_53,_0.04),_0_0_4px_rgba(34,_42,_53,_0.08),_0_16px_68px_rgba(47,_48,_55,_0.05),_0_1px_0_rgba(255,_255,_255,_0.1)_inset]",
        gradient:
            "bg-gradient-to-b from-blue-500 to-blue-700 text-white shadow-[0px_2px_0px_0px_rgba(255,255,255,0.3)_inset]",
    };

    return (
        <Tag
            href={href || undefined}
            className={cn(baseStyles, variantStyles[variant], className)}
            {...props}
        >
            {children}
        </Tag>
    );
};

__ALGOFORGE_FILE_1a15966fb4c916c5__

mkdir -p apps/web/src/components/visualizers/canvas
cat > apps/web/src/components/visualizers/canvas/CanvasViewport.tsx <<'__ALGOFORGE_FILE_f7699633f2f862f7__'
"use client";
import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type KeyboardEvent,
    type PointerEvent as RPointerEvent,
    type ReactNode,
} from "react";
import { useReducedMotion } from "../shared/animationSettings";
import {
    centered,
    fit,
    panBy,
    zoomAt,
    ZOOM_STEP,
    type Size,
    type Transform,
} from "./viewport";

interface Props {
    /** Bounding box of everything on the canvas, in canvas units. */
    content: Size;
    children: ReactNode;
    className?: string;
}

const btn =
    "inline-flex h-7 min-w-7 items-center justify-center rounded-md border border-primary-foreground/15 bg-card/90 px-2 text-xs text-foreground shadow-sm backdrop-blur transition-colors hover:bg-primary-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground/30";
/**
 * Pan and zoom around one big canvas. By default it keeps everything in view ("auto-fit") and glides
 * as structures grow. Dragging, Ctrl/Cmd + wheel, the buttons or the keys take manual control;
 * Fit (button, F, double-click) hands it back.
 */
export function Viewport({ content, children, className }: Props) {
    const outer = useRef<HTMLDivElement>(null);
    const [view, setView] = useState<Size>({ w: 0, h: 0 });
    const [manual, setManual] = useState<Transform | null>(null);
    const [dragging, setDragging] = useState(false);
    const reduced = useReducedMotion();
    const drag = useRef<{ x: number; y: number; t: Transform } | null>(null);

    const auto = useMemo(() => fit(content, view), [content, view]);
    const t = manual ?? auto;
    const tRef = useRef(t);
    tRef.current = t;
    const viewRef = useRef(view);
    viewRef.current = view;

    useEffect(() => {
        const el = outer.current;
        if (!el) return;
        const measure = () =>
            setView((v) =>
                v.w === el.clientWidth && v.h === el.clientHeight
                    ? v
                    : { w: el.clientWidth, h: el.clientHeight },
            );
        measure();
        if (typeof ResizeObserver === "undefined") return;
        const ro = new ResizeObserver(measure);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    const zoomBy = useCallback(
        (factor: number, around?: { x: number; y: number }) => {
            const v = viewRef.current;
            setManual(
                zoomAt(
                    tRef.current,
                    factor,
                    around ?? { x: v.w / 2, y: v.h / 2 },
                ),
            );
        },
        [],
    );
    const fitAll = useCallback(() => setManual(null), []);
    const actualSize = useCallback(
        () => setManual(centered(content, viewRef.current, 1)),
        [content],
    );

    // Ctrl/Cmd + wheel (and trackpad pinch) zooms around the pointer. A plain wheel keeps scrolling the page.
    useEffect(() => {
        const el = outer.current;
        if (!el) return;
        const onWheel = (e: WheelEvent) => {
            if (!e.ctrlKey && !e.metaKey) return;
            e.preventDefault();
            const r = el.getBoundingClientRect();
            zoomBy(Math.exp(-e.deltaY * 0.01), {
                x: e.clientX - r.left,
                y: e.clientY - r.top,
            });
        };
        el.addEventListener("wheel", onWheel, { passive: false });
        return () => el.removeEventListener("wheel", onWheel);
    }, [zoomBy]);

    const onPointerDown = (e: RPointerEvent<HTMLDivElement>) => {
        if (e.button !== 0) return;
        drag.current = { x: e.clientX, y: e.clientY, t: tRef.current };
        setDragging(true);
        e.currentTarget.setPointerCapture?.(e.pointerId);
    };
    const onPointerMove = (e: RPointerEvent<HTMLDivElement>) => {
        const d = drag.current;
        if (!d) return;
        setManual(panBy(d.t, e.clientX - d.x, e.clientY - d.y));
    };
    const endDrag = (e: RPointerEvent<HTMLDivElement>) => {
        if (!drag.current) return;
        drag.current = null;
        setDragging(false);
        e.currentTarget.releasePointerCapture?.(e.pointerId);
    };

    const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        const k = e.key.toLowerCase();
        if (k === "+" || k === "=") zoomBy(ZOOM_STEP);
        else if (k === "-" || k === "_") zoomBy(1 / ZOOM_STEP);
        else if (k === "0") actualSize();
        else if (k === "f") fitAll();
        else return;
        e.preventDefault();
    };

    const empty = content.w <= 0 || content.h <= 0;
    const glide = !manual && !dragging && !reduced;

    return (
        <div
            ref={outer}
            data-canvas
            role="region"
            aria-label="Visualizer canvas. Drag to pan, Ctrl or Command with the wheel to zoom, F to fit."
            tabIndex={0}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onDoubleClick={fitAll}
            onKeyDown={onKeyDown}
            className={
                className ??
                "relative h-full min-h-[360px] w-full touch-none select-none overflow-hidden rounded-2xl border border-neutral-500/25 bg-neutral-500/5 outline-none focus-visible:ring-2 focus-visible:ring-neutral-500/40"
            }
            style={{
                cursor: dragging ? "grabbing" : "grab",
                backgroundImage:
                    "radial-gradient(circle, rgba(128,128,128,0.35) 1px, transparent 1.5px)",
                backgroundSize: `${24 * t.k}px ${24 * t.k}px`,
                backgroundPosition: `${t.x}px ${t.y}px`,
            }}
        >
            <div
                data-canvas-content
                style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    width: content.w,
                    height: content.h,
                    transformOrigin: "0 0",
                    transform: `translate(${t.x}px, ${t.y}px) scale(${t.k})`,
                    transition: glide
                        ? "transform 280ms cubic-bezier(.2,.8,.2,1)"
                        : "none",
                    willChange: "transform",
                }}
            >
                {children}
            </div>
            {empty ? (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <p className="rounded-lg border border-neutral-500/25 bg-neutral-500/10 px-4 py-2 text-sm text-neutral-400">
                        Nothing here yet. Press Play or Forward to begin.
                    </p>
                </div>
            ) : null}

            <div
                className="absolute bottom-3 right-3 flex items-center gap-1"
                onPointerDown={(e) => e.stopPropagation()}
                onDoubleClick={(e) => e.stopPropagation()}
            >
                <button
                    type="button"
                    className={btn}
                    aria-label="Zoom out"
                    onClick={() => zoomBy(1 / ZOOM_STEP)}
                >
                    −
                </button>
                <button
                    type="button"
                    className={`${btn} tabular-nums`}
                    aria-label="Zoom to 100%"
                    title="Zoom to 100%"
                    onClick={actualSize}
                >
                    {Math.round(t.k * 100)}%
                </button>
                <button
                    type="button"
                    className={btn}
                    aria-label="Zoom in"
                    onClick={() => zoomBy(ZOOM_STEP)}
                >
                    +
                </button>
                <button
                    type="button"
                    className={btn}
                    aria-label="Fit everything in view"
                    aria-pressed={manual === null}
                    onClick={fitAll}
                >
                    Fit
                </button>
            </div>
        </div>
    );
}

__ALGOFORGE_FILE_f7699633f2f862f7__

mkdir -p apps/web/src/components/visualizers/canvas
cat > apps/web/src/components/visualizers/canvas/Group.tsx <<'__ALGOFORGE_FILE_3159fc81efab3a70__'
"use client";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { StoreApi } from "zustand/vanilla";
import type { VisualizerStore } from "../engine/store";
import type { InstanceMeta } from "../script/compile";
import { TimelineSinkProvider } from "../shared/stage/StageEnv";
import { renderStage } from "./renderers";
import { EMPTY_VIEW, GroupRuntime, type GroupView } from "./runtime";
import type { Size } from "./viewport";

interface Props {
    meta: InstanceMeta;
    store: StoreApi<VisualizerStore>;
    x: number;
    y: number;
    /** Slide to the new position instead of jumping (lanes above grew or shrank). */
    glide: boolean;
    onSize: (id: string, size: Size) => void;
}

/** One structure on the canvas: a title, and the existing stage for its family. */
export function Group({ meta, store, x, y, glide, onSize }: Props) {
    const [view, setView] = useState<GroupView>(EMPTY_VIEW);
    const runtime = useMemo(() => new GroupRuntime(setView), []);
    const box = useRef<HTMLDivElement>(null);

    // Announce this structure to the playback engine. It is brought up to date straight away.
    useEffect(() => store.getState().registerRunner(meta.id, runtime), [store, meta.id, runtime]);

    // Report the real size so lanes can be stacked without gaps or overlaps.
    useLayoutEffect(() => {
        const el = box.current;
        if (!el) return;
        const report = () => onSize(meta.id, { w: el.offsetWidth, h: el.offsetHeight });
        report();
        if (typeof ResizeObserver === "undefined") return;
        const ro = new ResizeObserver(report);
        ro.observe(el);
        return () => ro.disconnect();
    }, [meta.id, onSize, view.state === null]);

    const hidden = view.state === null;
    return (
        <div
            data-canvas-group={meta.id}
            style={{
                position: "absolute",
                left: 0,
                top: 0,
                width: "max-content",
                transform: `translate(${x}px, ${y}px)`,
                transition: glide ? "transform 260ms cubic-bezier(.2,.8,.2,1)" : "none",
            }}
        >
            <div ref={box} role="group" aria-label={`${meta.id}: ${meta.label}`} aria-hidden={hidden} style={{ display: hidden ? "none" : "block" }}>
                <div className="mb-2 flex items-center gap-2 px-1">
                    <span className="inline-flex h-6 items-center rounded-md border border-primary-foreground/15 bg-primary-background px-2 font-mono text-xs font-semibold">{meta.id}</span>
                    <span className="text-xs text-muted-foreground">{meta.label}</span>
                </div>
                {/* Read-only: panning works from anywhere, and a structure can never be dragged out of step with the script. */}
                <div style={{ pointerEvents: "none" }}>
                    <TimelineSinkProvider value={runtime.sink}>{renderStage(meta, view, runtime.finish)}</TimelineSinkProvider>
                </div>
            </div>
        </div>
    );
}

__ALGOFORGE_FILE_3159fc81efab3a70__

mkdir -p apps/web/src/components/visualizers/canvas
cat > apps/web/src/components/visualizers/canvas/VisualizerCanvas.tsx <<'__ALGOFORGE_FILE_994eef88c3313cf6__'
"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "zustand";
import type { StoreApi } from "zustand/vanilla";
import { visualizer } from "../engine/instance";
import type { VisualizerStore } from "../engine/store";
import { useReducedMotion } from "../shared/animationSettings";
import { CANVAS_CSS } from "./canvasStyles";
import { Group } from "./Group";
import { stackLanes } from "./layout";
import { Viewport } from "./CanvasViewport";
import type { Size } from "./viewport";

const NONE: Size = { w: 0, h: 0 };

/**
 * The one canvas. Every structure of the loaded script lives on it, and one playback (the store's
 * transport) drives all of them together.
 */
export function VisualizerCanvas({ store = visualizer, className }: { store?: StoreApi<VisualizerStore>; className?: string }) {
    const compiled = useStore(store, (s) => s.compiled);
    const instances = compiled?.instances;
    const [sizes, setSizes] = useState<Record<string, Size>>({});
    const reduced = useReducedMotion();

    useEffect(() => store.getState().setReduced(reduced), [store, reduced]);

    const onSize = useCallback((id: string, size: Size) => setSizes((prev) => (prev[id]?.w === size.w && prev[id]?.h === size.h ? prev : { ...prev, [id]: size })), []);

    const layout = useMemo(() => stackLanes((instances ?? []).map((i) => ({ id: i.id, size: sizes[i.id] ?? NONE, at: i.at }))), [instances, sizes]);

    // Do not slide groups into their very first position: only animate moves after the first layout.
    const laidOut = useRef(false);
    useEffect(() => {
        laidOut.current = layout.size.w > 0;
    }, [layout]);

    return (
        <Viewport content={layout.size} className={className}>
            <style>{CANVAS_CSS}</style>
            {(instances ?? []).map((inst) => {
                const p = layout.placed[inst.id] ?? { x: 0, y: 0, w: 0, h: 0 };
                return <Group key={inst.id} meta={inst} store={store} x={p.x} y={p.y} glide={laidOut.current && !reduced} onSize={onSize} />;
            })}
        </Viewport>
    );
}

__ALGOFORGE_FILE_994eef88c3313cf6__

mkdir -p apps/web/src/components/visualizers/graph
cat > apps/web/src/components/visualizers/graph/GraphStage.tsx <<'__ALGOFORGE_FILE_2a5cf0cc4abde1c2__'
"use client";
import { useRef, useState, type PointerEvent as RPointerEvent } from "react";
import { stagger, utils } from "animejs";
import { useReducedMotion } from "../shared/animationSettings";
import { annotationArc, type Box } from "../shared/edges";
import { Caption } from "../shared/stage/Caption";
import { StageBoard, type BoardApi } from "../shared/stage/StageBoard";
import { EdgeG } from "../shared/stage/EdgeG";
import { NodeDisc } from "../shared/stage/NodeDisc";
import { StageFrame } from "../shared/stage/StageFrame";
import { COLOR_FADE, INK } from "../shared/stage/tokens";
import { playRestore, useStageAnimator } from "../shared/stage/useStageAnimator";
import { btn } from "../shared/styles";
import { fmt } from "./engine";
import { G, boxAt, clampPos, edgeGeo } from "./layout";
import { connectivityOfState, edgeCount, edgeList, findReverse, propsText, vertexCount, vertexIds } from "./model";
import type * as LabT from "./types";
import type { Edge, GraphState, Pos } from "./types";

/** What a stage needs to draw one structure. The old labs feed it from their store; the shared canvas feeds it directly. */
export interface GraphStageViewProps {
  data: LabT.GraphState;
  selV: string | null;
  selE: string | null;
  anim: { token: number; plan: LabT.Anim } | null;
  status: "ready" | "animating" | "paused";
  showIds: boolean;
  caption: import("../shared/stage/Caption").CaptionData | null;
  tool: "move" | "connect";
  connectFrom: string | null;
  selectVertex: (id: string | null) => void;
  selectEdge: (id: string | null) => void;
  setConnectFrom: (id: string | null) => void;
  run: (op: LabT.GraphOp) => void;
  finishAnimation: (token: number) => void;
}

export function GraphStageView({ data, selV, selE, anim, status, showIds, caption, tool, connectFrom, selectVertex, selectEdge, setConnectFrom, run, finishAnimation }: GraphStageViewProps) {
  const reduced = useReducedMotion();

  const host = useRef<HTMLElement>(null);
  const api = useRef<BoardApi | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [cursor, setCursor] = useState<Pos | null>(null);
  const [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(null);
  const dragRef = useRef<{ id: string; dx: number; dy: number; sx: number; sy: number; lx: number; ly: number; moved: boolean } | null>(null);

  const plan = anim?.plan ?? null;
  const prev = plan && "prev" in plan ? plan.prev : null;
  const posOf = (st: GraphState, id: string): Pos | undefined => (drag && drag.id === id && st === data ? { x: drag.x, y: drag.y } : st.positions[id]);

  const ghostIds: string[] = plan?.kind === "deleteVertex" ? [plan.id] : plan?.kind === "reset" || plan?.kind === "clear" ? Object.keys(plan.prev.vertices) : plan?.kind === "restore" ? Object.keys(plan.prev.vertices).filter((id) => !data.vertices[id]) : [];
  const ghostEdges: Edge[] = prev ? (plan?.kind === "reset" || plan?.kind === "clear" ? edgeList(prev) : edgeList(prev).filter((e) => !data.edges[e.id])) : [];
  const dismissed = plan?.kind === "dismiss" ? plan.prev.arrows.filter((a) => a.fromId !== null) : [];
  const ghostMark = plan?.kind === "markOut" ? { vertexId: plan.vertexId, markId: plan.markId } : plan?.kind === "markMove" ? { vertexId: plan.fromId, markId: plan.markId } : null;
  const conn = connectivityOfState(data);
  const connText = vertexCount(data) <= 1 ? "trivially connected" : data.props.directed ? (conn.strong ? "strongly connected" : conn.weak ? "weakly connected only" : `${conn.components} components`) : conn.weak ? "connected" : `${conn.components} components`;

  // hovering a vertex: its edges light up and everything not next to it dims
  const calm = status === "ready" && !drag;
  const hv = calm && hover && data.vertices[hover] ? hover : null;
  const hotEdges = new Set<string>();
  const near = new Set<string>();
  if (hv) {
    near.add(hv);
    for (const e of edgeList(data))
      if (e.source === hv || e.target === hv) {
        hotEdges.add(e.id);
        near.add(e.source);
        near.add(e.target);
      }
  }

  /* ── pointer: drag to move, edge tool to connect. The live position is UI state; one logged moveVertex is committed on release. ── */
  const toBoard = (e: { clientX: number; clientY: number }) => api.current?.toBoard(e.clientX, e.clientY) ?? { x: 0, y: 0 };
  const connectClick = (id: string) => {
    if (!connectFrom) return setConnectFrom(id);
    if (connectFrom === id) return setConnectFrom(null);
    run({ type: "addEdge", sourceId: connectFrom, targetId: id });
    setConnectFrom(null);
  };
  const pointer = {
    down: (e: RPointerEvent<HTMLDivElement>, id: string) => {
      e.stopPropagation();
      if (tool === "connect") return connectClick(id);
      if (status !== "ready") return selectVertex(id);
      const p = data.positions[id];
      const b = toBoard(e);
      e.currentTarget.setPointerCapture(e.pointerId);
      dragRef.current = { id, dx: p.x - b.x, dy: p.y - b.y, sx: p.x, sy: p.y, lx: p.x, ly: p.y, moved: false };
    },
    move: (e: RPointerEvent<HTMLDivElement>) => {
      const d = dragRef.current;
      if (!d) return;
      const b = toBoard(e);
      const c = clampPos(b.x + d.dx, b.y + d.dy);
      if (!d.moved && Math.hypot(c.x - d.sx, c.y - d.sy) < 4) return;
      d.moved = true;
      d.lx = c.x;
      d.ly = c.y;
      setDrag({ id: d.id, x: c.x, y: c.y });
    },
    up: (e: RPointerEvent<HTMLDivElement>) => {
      const d = dragRef.current;
      dragRef.current = null;
      if (e.currentTarget.hasPointerCapture?.(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
      if (!d) return;
      if (d.moved) run({ type: "moveVertex", vertexId: d.id, x: d.lx, y: d.ly, dragged: true });
      else selectVertex(d.id);
      setDrag(null);
    },
  };

  /** Double-click empty canvas: add a vertex right there. A Connected graph attaches it to the nearest vertex. */
  const addAt = (pt: { x: number; y: number }) => {
    const at = clampPos(pt.x, pt.y);
    let attachTo: string | undefined;
    if (data.props.connected && vertexCount(data) > 0) {
      let best = Infinity;
      for (const id of vertexIds(data)) {
        const p = data.positions[id];
        const d = Math.hypot(p.x - at.x, p.y - at.y);
        if (d < best) (best = d), (attachTo = id);
      }
    }
    run({ type: "addVertex", value: String.fromCharCode(65 + (vertexCount(data) % 26)), attachTo, at });
  };

  useStageAnimator({
    host,
    anim,
    reduced,
    finish: finishAnimation,
    deps: [data, drag],
    reveal: (cx, cy) => api.current?.reveal(cx, cy),
    build: (c) => {
      const { m, D, plan: p, byId, edgeEls, ghostEdgeEls, ghostItems, live, moved } = c;
      const { add, call, pulse, bump, soft, snap } = m;
      const shaftOf = (g: SVGGElement | undefined) => g?.children[0] as SVGPathElement | undefined;

      switch (p.kind) {
        case "addVertex": {
          const t = byId.get(p.id);
          m.spawn(t, 0);
          pulse(t, INK.green, D * 0.8);
          p.edgeIds.forEach((eid, i) => {
            const g = c.edge(eid, false);
            if (!g) return;
            utils.set(g, { opacity: 0 });
            m.draw(g, D * 0.7 + i * D * 0.3);
          });
          c.reveal(p.id);
          break;
        }
        case "deleteVertex": {
          m.tint(ghostItems, INK.red);
          pulse(ghostItems[0], INK.red, 0);
          ghostItems.forEach((g) => m.shake(g, 0));
          ghostEdgeEls.forEach((g, j) => m.drop(g, D * 0.3 + j * 50));
          m.vanish(ghostItems, D * 0.9);
          break;
        }
        case "addEdge": {
          const g = c.edge(p.id, false);
          if (g) {
            utils.set(g, { opacity: 0 });
            m.draw(g, 0);
            m.travel(shaftOf(g), c.dot, INK.green, 0, D * 0.7);
            pulse(byId.get(g.dataset.from!), INK.green, D * 0.1);
            pulse(byId.get(g.dataset.to!), INK.green, D * 0.7);
          }
          break;
        }
        case "removeEdge": {
          ghostEdgeEls.forEach((g) => {
            pulse(byId.get(g.dataset.from!), INK.red, 0);
            pulse(byId.get(g.dataset.to!), INK.red, 0);
            m.drop(g, 0);
          });
          break;
        }
        case "weight": {
          const g = c.edge(p.id, false);
          const lab = g?.children[2] as SVGTextElement | undefined;
          if (g && lab) {
            const next = g.dataset.label ?? "";
            lab.textContent = p.oldWeight === null ? "" : String(p.oldWeight);
            m.flash(g, INK.accent, 0);
            add(lab, { opacity: [1, 0], duration: D * 0.3, ease: "inCubic" }, 0);
            call(() => {
              lab.textContent = next;
            }, D * 0.3);
            add(lab, { opacity: [0, 1], duration: D * 0.6, ease: soft }, D * 0.3);
            pulse(byId.get(g.dataset.from!), INK.accent, D * 0.2);
            pulse(byId.get(g.dataset.to!), INK.accent, D * 0.2);
          }
          break;
        }
        case "updateVertex": {
          const t = byId.get(p.id);
          if (t) {
            m.swapText(t.querySelector<HTMLElement>("[data-value]"), fmt(p.oldValue), t.dataset.text ?? "", 0);
            bump(t, D * 0.3);
            pulse(t, INK.accent, D * 0.3);
          }
          break;
        }
        case "move":
          add(moved, { x: c.toX, y: c.toY, ease: snap, duration: D * 1.1 }, 0);
          pulse(byId.get(p.id), INK.blue, D);
          break;
        case "read": {
          p.vertexIds.forEach((id, i) => {
            const t = byId.get(id);
            pulse(t, INK.blue, i * D * 0.15);
            bump(t, i * D * 0.15);
          });
          p.edgeIds.forEach((id) => m.flash(c.edge(id, false), INK.blue, D * 0.1));
          if (p.edgeIds.length === 1 && p.vertexIds.length === 2) m.travel(shaftOf(c.edge(p.edgeIds[0], false)), c.dot, INK.blue, D * 0.1, D * 0.8);
          if (p.vertexIds[0]) c.reveal(p.vertexIds[0]);
          break;
        }
        case "props":
          live.forEach((t, i) => pulse(t, INK.green, i * D * 0.08));
          edgeEls.forEach((g) => m.flash(g, INK.green, 0));
          break;
        case "clear": {
          m.tint(ghostItems, INK.red);
          ghostEdgeEls.forEach((g, j) => m.drop(g, j * 30));
          add(ghostItems, { opacity: 0, scale: 0.7, y: (t: unknown) => c.ty(t as HTMLElement) - 16, duration: D * 0.7, ease: "inCubic", delay: stagger(45) }, D * 0.1);
          break;
        }
        case "reset": {
          ghostEdgeEls.forEach((g, j) => m.drop(g, j * 25));
          add(ghostItems, { opacity: 0, scale: 0.8, duration: D * 0.6, ease: "inCubic", delay: stagger(30) }, D * 0.1);
          const start = D * 0.5;
          for (const t of live) utils.set(t, { x: c.tx(t), y: c.ty(t) - 30, opacity: 0, scale: 0.7 });
          add(live, { opacity: 1, duration: D * 0.4, delay: stagger(55), ease: "outQuad" }, start);
          add(live, { y: c.toY, scale: 1, duration: D * 1.1, delay: stagger(55), ease: soft }, start);
          const edgesAt = start + live.length * 55 + D * 0.7;
          for (const g of edgeEls) utils.set(g, { opacity: 0 });
          edgeEls.forEach((g, j) => m.draw(g, edgesAt + j * 60, D * 0.5));
          break;
        }
        case "restore":
          playRestore(c);
          break;
        case "highlight": {
          p.ids.forEach((id, i) => {
            const t = byId.get(id);
            const tint = t?.querySelector<HTMLElement>("[data-tint]");
            if (tint) {
              utils.set(tint, { scaleX: 0 });
              add(tint, { scaleX: [0, 1], duration: D * 0.9, ease: "outCubic" }, i * D * 0.08);
            }
            bump(t, i * D * 0.08);
          });
          break;
        }
        case "markIn": {
          const mk = c.el.querySelector<HTMLElement>(`[data-mark="${p.markId}"]`);
          if (mk) {
            utils.set(mk, { scale: 0.4, opacity: 0, y: -8 });
            add(mk, { opacity: 1, duration: D * 0.3, ease: "outQuad" }, 0);
            add(mk, { scale: 1, y: 0, duration: D, ease: soft }, 0);
          }
          break;
        }
        case "markOut":
          add(c.el.querySelector<HTMLElement>("[data-mark-ghost]"), { scale: 0.4, opacity: 0, y: -8, duration: D * 0.6, ease: "inCubic" }, 0);
          break;
        case "markMove": {
          const ghost = c.el.querySelector<HTMLElement>("[data-mark-ghost]");
          const real = c.el.querySelector<HTMLElement>(`[data-mark="${p.markId}"]`);
          const from = byId.get(p.fromId);
          const to = real?.closest<HTMLElement>("[data-node]");
          if (ghost && from && to) {
            add(ghost, { x: c.cur(to, "x") - c.cur(from, "x"), y: c.cur(to, "y") - c.cur(from, "y"), duration: D * 0.9, ease: snap }, 0);
            add(ghost, { opacity: 0, duration: D * 0.3, ease: "inQuad" }, D * 0.65);
          }
          if (real) {
            utils.set(real, { scale: 0.4, opacity: 0 });
            add(real, { opacity: 1, scale: 1, duration: D * 0.8, ease: soft }, D * 0.6);
          }
          pulse(to, INK.green, D * 0.7);
          break;
        }
        case "arrow": {
          const scope = c.el.querySelector(`[data-aedge][data-id="${p.id}"]`) ?? c.el.querySelector(`[data-arrow-for="${p.id}"]`);
          if (scope) {
            const body = Array.from(scope.querySelectorAll<SVGElement>('[data-draw="shaft"]'));
            const tips = Array.from(scope.querySelectorAll<SVGElement>('[data-draw="head"]'));
            [...body, ...tips].forEach((e) => {
              e.style.strokeDasharray = "1";
              e.style.strokeDashoffset = "1";
            });
            add(body, { strokeDashoffset: [1, 0], duration: D, ease: "outQuad" }, 0);
            add(tips, { strokeDashoffset: [1, 0], duration: D * 0.25, ease: "outQuad" }, D * 0.85);
          }
          break;
        }
        case "dismiss":
          add(Array.from(c.el.querySelectorAll<SVGElement>("[data-aedge-ghost]")), { opacity: 0, duration: D * 0.5, ease: "outQuad" }, 0);
          break;
        case "none":
          break;
      }
    },
  });

  /* ───────────── render ───────────── */
  const boxesOf = (st: GraphState, e: Edge): [Box, Box] | null => {
    const a = posOf(st, e.source);
    const b = posOf(st, e.target);
    return a && b ? [boxAt(a), boxAt(b)] : null;
  };
  const arc = (st: GraphState, fromId: string, toId: string) => {
    const a = posOf(st, fromId);
    const b = posOf(st, toId);
    return a && b ? annotationArc(boxAt(a), boxAt(b)) : null;
  };
  const edgeNode = (st: GraphState, e: Edge, ghost: boolean) => {
    const b = boxesOf(st, e);
    if (!b) return null;
    const bend = findReverse(st, e) ? 1 : 0;
    const self = e.source === e.target;
    const emphasis = ghost ? "none" : selE === e.id ? "selected" : hotEdges.has(e.id) ? "hot" : "none";
    return (
      <EdgeG
        key={`${ghost ? "g-" : ""}${e.id}`}
        eid={e.id}
        from={e.source}
        to={e.target}
        directed={st.props.directed}
        bend={bend}
        self={self}
        geo={edgeGeo(b[0], b[1], { directed: st.props.directed, bend, self })}
        label={e.weight === null ? "" : String(e.weight)}
        ghost={ghost}
        emphasis={emphasis}
        onSelect={ghost ? undefined : selectEdge}
        title={`${e.id}: ${e.source} ${st.props.directed ? "→" : "—"} ${e.target}${e.weight !== null ? `, weight ${e.weight}` : ""}. Click to select.`}
      />
    );
  };
  const from = connectFrom ? posOf(data, connectFrom) : undefined;

  return (
    <StageFrame
      hostRef={host}
      label="Graph stage"
      stats={[
        { label: "vertices", value: String(vertexCount(data)) },
        { label: "edges", value: String(edgeCount(data)) },
        { label: "kind", value: propsText(data.props), mono: false },
        { label: "connectivity", value: connText, mono: false },
      ]}
      badge={
        tool === "connect" ? (
          <span className="mb-0.5 inline-flex h-6 items-center gap-1.5 rounded-full border px-2.5 text-[11px]" style={{ borderColor: `${INK.accent}66`, color: INK.accent }}>
            Edge tool: {connectFrom ? `click the second vertex (from ${connectFrom})` : "click the first vertex"} · Esc cancels
          </span>
        ) : undefined
      }
      footer={
        <p className="flex flex-wrap items-center gap-x-5 gap-y-1 px-6 text-[11px] text-muted-foreground">
          <span>{data.props.directed ? "Arrowhead = direction (source → target)." : "No arrowheads: edges work both ways."}</span>
          {data.props.weighted && <span>Number on an edge = its weight.</span>}
          <span><span style={{ color: INK.green }}>⚑ P</span> default mark, <span style={{ color: INK.purple }}>⚑</span> named mark</span>
          <span>Solid blue ring + “selected” = selected vertex; thicker blue line = selected edge.</span>
          <span>Dashed ring + tint = highlighted.</span>
          <span>Dashed arrow = annotation, not an edge.</span>
          <span>Drag a vertex to move it (layout only). Double-click empty canvas to add a vertex. Hover a vertex to see its edges.</span>
        </p>
      }
    >
      <StageBoard
        label="Graph board"
        apiRef={api}
        cursor={tool === "connect" ? "crosshair" : undefined}
        overlay={<Caption data={caption} />}
        onBackgroundClick={() => (selV || selE) && selectVertex(null)}
        onBackgroundDoubleClick={addAt}
        onPointerMoveBoard={(pt) => tool === "connect" && connectFrom && setCursor(pt)}
      >
        <div className="relative" style={{ width: G.W, height: G.H }}>
          <svg aria-hidden className="pointer-events-none absolute inset-0 overflow-visible" width={G.W} height={G.H}>
            {edgeList(data).map((e) => edgeNode(data, e, false))}
            {prev && ghostEdges.map((e) => edgeNode(prev, e, true))}
            {data.arrows
              .filter((a) => a.fromId !== null)
              .map((a) => {
                const g = arc(data, a.fromId!, a.toId);
                return (
                  <g key={a.id} data-aedge data-id={a.id} data-from={a.fromId!} data-to={a.toId} style={{ stroke: a.color, transition: COLOR_FADE }} strokeWidth={1.75} fill="none" strokeLinecap="round" strokeDasharray="5 4">
                    <path data-draw="shaft" pathLength={1} d={g?.shaft ?? ""} />
                    <path data-draw="head" pathLength={1} d={g?.wings[0] ?? ""} />
                    <path data-draw="head" pathLength={1} d={g?.wings[1] ?? ""} />
                  </g>
                );
              })}
            {dismissed.map((a) => {
              const g = prev ? arc(prev, a.fromId!, a.toId) : null;
              return (
                <g key={`d-${a.id}`} data-aedge-ghost style={{ stroke: a.color }} strokeWidth={1.75} fill="none" strokeLinecap="round" strokeDasharray="5 4">
                  <path d={g?.shaft ?? ""} />
                </g>
              );
            })}
            {tool === "connect" && from && cursor && <line x1={from.x} y1={from.y} x2={cursor.x} y2={cursor.y} stroke={INK.accent} strokeWidth={1.75} strokeDasharray="5 4" strokeLinecap="round" />}
            <circle data-fx-dot r={5} cx={0} cy={0} opacity={0} style={{ filter: "drop-shadow(0 0 4px currentColor)" }} />
          </svg>

          {vertexCount(data) === 0 && (
            <div className="absolute left-1/2 top-1/2 flex max-w-[320px] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-3 text-center text-xs leading-relaxed text-muted-foreground">
              <p>
                The graph is empty. Double-click the canvas to add a vertex, run <code className="font-mono text-primary-foreground">addVertex</code>, or start from an example.
              </p>
              <button type="button" className={btn} onClick={() => run({ type: "reset" })}>Load starter graph</button>
            </div>
          )}

          {Object.keys(data.vertices).map((id) => {
            const arrow = data.arrows.find((a) => a.fromId === null && a.toId === id);
            return (
              <NodeDisc
                key={id}
                id={id}
                kind="vertex"
                text={fmt(data.vertices[id].value)}
                box={boxAt(posOf(data, id)!)}
                showIds={showIds}
                hl={data.highlights[id]}
                selected={selV === id || connectFrom === id}
                dim={!!hv && !near.has(id)}
                hot={hover === id}
                marks={data.markers.filter((mk) => mk.vertexId === id).map((mk) => mk.id)}
                ghostMarkId={ghostMark?.vertexId === id ? ghostMark.markId : undefined}
                arrow={arrow ? { id: arrow.id, color: arrow.color } : undefined}
                onSelect={selectVertex}
                onHover={setHover}
                pointer={pointer}
              />
            );
          })}
          {prev &&
            ghostIds.map((id) => <NodeDisc key={`ghost-${id}`} id={id} kind="vertex" text={fmt(prev.vertices[id].value)} box={boxAt(prev.positions[id])} showIds={showIds} hl={prev.highlights[id]} marks={prev.markers.filter((mk) => mk.vertexId === id).map((mk) => mk.id)} ghost />)}
        </div>
      </StageBoard>
    </StageFrame>
  );
}

__ALGOFORGE_FILE_2a5cf0cc4abde1c2__

mkdir -p apps/web/src/components/visualizers/graph
cat > apps/web/src/components/visualizers/graph/model.ts <<'__ALGOFORGE_FILE_667645d1b81008ce__'
import { circlePositions } from "./layout";
import type { Edge, GraphProps, GraphState, InitSpec } from "./types";

/**
 * Pure data model: no DOM, no React, no animation.
 *
 * RULES (checked by checkInvariants, and tested after every operation):
 *  - every edge joins two existing vertices; ids match their keys.
 *  - NO parallel edges. Undirected: one edge per unordered pair. Directed: one edge per ordered pair
 *    (A→B and B→A are two different edges and may both exist).
 *  - SELF-LOOPS are allowed (at most one per vertex).
 *      Degree: undirected loop counts 2; directed loop counts 1 in + 1 out (total 2).
 *  - Unweighted graphs store weight null; weighted graphs store a finite number on every edge.
 *  - CONNECTED property:
 *      undirected → every vertex is reachable from every other (ordinary connectivity);
 *      directed   → STRONGLY connected: every vertex reaches every other following edge directions.
 *      The empty graph and a single vertex are connected.
 *  - markers, highlights, arrows and positions only refer to existing vertices.
 */
export const MAX_VERTICES = 12;
export const MAX_EDGES = 40;
export const GRAPH_ID = "G";
export const DEFAULT_MARK = "P";
export const ARROW_DEFAULT_COLOR = "#0070F3";
export const DEFAULT_PROPS: GraphProps = { weighted: false, directed: false, connected: false };

const num = (id: string) => parseInt(id.replace(/\D/g, ""), 10) || 0;
export const byId = (a: string, b: string) => num(a) - num(b) || a.localeCompare(b);
export const vertexIds = (s: Pick<GraphState, "vertices">) => Object.keys(s.vertices).sort(byId);
export const edgeIds = (s: Pick<GraphState, "edges">) => Object.keys(s.edges).sort(byId);
export const edgeList = (s: Pick<GraphState, "edges">): Edge[] => edgeIds(s).map((id) => s.edges[id]);
export const vertexCount = (s: Pick<GraphState, "vertices">) => Object.keys(s.vertices).length;
export const edgeCount = (s: Pick<GraphState, "edges">) => Object.keys(s.edges).length;

export const emptyGraph = (props: GraphProps): GraphState => ({ props, vertices: {}, edges: {}, markers: [], highlights: {}, arrows: [], positions: {} });

export const propsText = (p: GraphProps) => `${p.weighted ? "Weighted" : "Unweighted"} · ${p.directed ? "Directed" : "Undirected"} · ${p.connected ? "Connected" : "Open"}`;

/** Does this edge join a and b the way the graph's direction rules say? */
export const sameEnds = (props: GraphProps, e: Edge, a: string, b: string) =>
    props.directed ? e.source === a && e.target === b : (e.source === a && e.target === b) || (e.source === b && e.target === a);
export const findEdge = (s: Pick<GraphState, "edges" | "props">, a: string, b: string): Edge | undefined => edgeList(s).find((e) => sameEnds(s.props, e, a, b));
/** In a directed graph: the edge running the other way, if any (used to curve the pair apart). */
export const findReverse = (s: Pick<GraphState, "edges" | "props">, e: Edge): Edge | undefined =>
    s.props.directed && e.source !== e.target ? edgeList(s).find((x) => x.source === e.target && x.target === e.source) : undefined;

export function degreeInfo(s: Pick<GraphState, "edges" | "props">, id: string): { in: number; out: number; total: number } {
    let inn = 0;
    let out = 0;
    let total = 0;
    for (const e of Object.values(s.edges)) {
        if (s.props.directed) {
            if (e.target === id) inn++;
            if (e.source === id) out++;
        } else {
            if (e.source === id) total++;
            if (e.target === id) total++;
        }
    }
    return s.props.directed ? { in: inn, out, total: inn + out } : { in: 0, out: 0, total };
}
const adj = (s: Pick<GraphState, "edges" | "props">, id: string, dir: "out" | "in"): string[] => {
    const r = new Set<string>();
    for (const e of Object.values(s.edges)) {
        if (!s.props.directed) {
            if (e.source === id) r.add(e.target);
            if (e.target === id) r.add(e.source);
        } else if (dir === "out") {
            if (e.source === id) r.add(e.target);
        } else if (e.target === id) r.add(e.source);
    }
    return [...r].sort(byId);
};
export const outNeighbors = (s: Pick<GraphState, "edges" | "props">, id: string) => adj(s, id, "out");
export const inNeighbors = (s: Pick<GraphState, "edges" | "props">, id: string) => adj(s, id, "in");
export const incidentEdges = (s: Pick<GraphState, "edges">, id: string) => edgeList(s).filter((e) => e.source === id || e.target === id).map((e) => e.id);

/* ───────────── connectivity ───────────── */

export interface Conn {
    weak: boolean; // ignoring directions
    strong: boolean; // following directions both ways
    components: number; // weakly connected components
}
export function connectivityOf(ids: string[], edges: Edge[]): Conn {
    if (ids.length <= 1) return { weak: true, strong: true, components: ids.length };
    const und = new Map<string, string[]>();
    const fwd = new Map<string, string[]>();
    const rev = new Map<string, string[]>();
    for (const id of ids) {
        und.set(id, []);
        fwd.set(id, []);
        rev.set(id, []);
    }
    for (const e of edges) {
        und.get(e.source)?.push(e.target);
        und.get(e.target)?.push(e.source);
        fwd.get(e.source)?.push(e.target);
        rev.get(e.target)?.push(e.source);
    }
    const reach = (start: string, g: Map<string, string[]>) => {
        const seen = new Set([start]);
        const stack = [start];
        while (stack.length) {
            const c = stack.pop()!;
            for (const n of g.get(c) ?? []) if (!seen.has(n)) (seen.add(n), stack.push(n));
        }
        return seen;
    };
    let components = 0;
    const done = new Set<string>();
    for (const id of ids)
        if (!done.has(id)) {
            components++;
            reach(id, und).forEach((x) => done.add(x));
        }
    const strong = reach(ids[0], fwd).size === ids.length && reach(ids[0], rev).size === ids.length;
    return { weak: components === 1, strong, components };
}
export const connectivityOfState = (s: Pick<GraphState, "vertices" | "edges">) => connectivityOf(Object.keys(s.vertices), Object.values(s.edges));
export function satisfiesConnected(s: Pick<GraphState, "vertices" | "edges">, directed: boolean): boolean {
    const c = connectivityOfState(s);
    return directed ? c.strong : c.weak;
}

/* ───────────── building ───────────── */

export function withDefaultMark(s: GraphState): GraphState {
    const first = vertexIds(s)[0];
    return first && !s.markers.some((m) => m.id === DEFAULT_MARK) ? { ...s, markers: [...s.markers, { id: DEFAULT_MARK, vertexId: first }] } : s;
}

/** Starter graph: a 4-cycle with one chord. Valid (and connected) for every combination of properties. */
export const starterSpec = (weighted: boolean): InitSpec => {
    const raw: [number, number, number][] = [[0, 1, 4], [1, 2, 2], [2, 3, 7], [3, 0, 1], [0, 2, 3]];
    return { vertices: ["A", "B", "C", "D"], edges: raw.map(([from, to, w]) => (weighted ? { from, to, weight: w } : { from, to })) };
};

/** Builds a whole graph from scratch: vertices v1, v2, …; edges e1, e2, … in the order given. */
export function buildGraph(props: GraphProps, spec: InitSpec): { state: GraphState; error?: string } {
    const s = emptyGraph(props);
    if (spec.vertices.length > MAX_VERTICES) return { state: s, error: `At most ${MAX_VERTICES} vertices are supported.` };
    if (spec.edges.length > MAX_EDGES) return { state: s, error: `At most ${MAX_EDGES} edges are supported.` };
    const pos = circlePositions(spec.vertices.length);
    spec.vertices.forEach((value, i) => {
        const id = `v${i + 1}`;
        s.vertices[id] = { id, value };
        s.positions[id] = pos[i];
    });
    const n = spec.vertices.length;
    for (let i = 0; i < spec.edges.length; i++) {
        const e = spec.edges[i];
        const a = `v${e.from + 1}`;
        const b = `v${e.to + 1}`;
        if (!s.vertices[a] || !s.vertices[b]) return { state: s, error: `edge ${i} uses vertex index ${!s.vertices[a] ? e.from : e.to}, but there are only ${n} vertices (valid indexes: 0 to ${Math.max(n - 1, 0)}).` };
        if (!props.weighted && e.weight !== undefined) return { state: s, error: `edge ${i} has a weight, but this graph is unweighted. Switch to Weighted or remove the weight.` };
        if (props.weighted && e.weight !== undefined && !Number.isFinite(e.weight)) return { state: s, error: `edge ${i} has a weight that is not a finite number.` };
        const dup = Object.values(s.edges).find((x) => sameEnds(props, x, a, b));
        if (dup) return { state: s, error: `edge ${i} (${a} ${props.directed ? "→" : "—"} ${b}) duplicates ${dup.id}: parallel edges are not enabled.` };
        const id = `e${i + 1}`;
        s.edges[id] = { id, source: a, target: b, weight: props.weighted ? (e.weight ?? 1) : null };
    }
    if (props.connected && !satisfiesConnected(s, props.directed))
        return { state: s, error: `this graph is set to Connected, but the data is not ${props.directed ? "strongly connected" : "connected"}.` };
    return { state: withDefaultMark(s) };
}
export const createGraph = (props: GraphProps): GraphState => buildGraph(props, starterSpec(props.weighted)).state;

/* ───────────── invariants ───────────── */

export function checkInvariants(s: GraphState): string[] {
    const bad: string[] = [];
    const vids = Object.keys(s.vertices);
    const seen = new Map<string, string>();
    for (const id of vids) {
        const v = s.vertices[id];
        if (v.id !== id) bad.push(`vertex key ${id} does not match its id`);
        const t = typeof v.value;
        if (!(v.value === null || t === "string" || t === "number" || t === "boolean")) bad.push(`${id} holds an unsupported value`);
        const p = s.positions[id];
        if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) bad.push(`${id} has no valid position`);
    }
    for (const id of Object.keys(s.positions)) if (!s.vertices[id]) bad.push(`position for missing vertex ${id}`);
    for (const id of Object.keys(s.edges)) {
        const e = s.edges[id];
        if (e.id !== id) bad.push(`edge key ${id} does not match its id`);
        if (!s.vertices[e.source] || !s.vertices[e.target]) {
            bad.push(`${id} joins a missing vertex`);
            continue;
        }
        const key = s.props.directed || e.source === e.target ? `${e.source}>${e.target}` : [e.source, e.target].sort().join("-");
        if (seen.has(key)) bad.push(`${id} duplicates ${seen.get(key)} (parallel edges are not enabled)`);
        seen.set(key, id);
        if (s.props.weighted) {
            if (e.weight === null || !Number.isFinite(e.weight)) bad.push(`${id} needs a finite weight`);
        } else if (e.weight !== null) bad.push(`${id} has a weight in an unweighted graph`);
    }
    if (s.props.connected && !satisfiesConnected(s, s.props.directed)) bad.push(`graph is set to Connected but is not ${s.props.directed ? "strongly connected" : "connected"}`);
    for (const m of s.markers) if (!s.vertices[m.vertexId]) bad.push(`marker ${m.id} points at a missing vertex`);
    if (new Set(s.markers.map((m) => m.id)).size !== s.markers.length) bad.push("two markers share a name");
    for (const id of Object.keys(s.highlights)) if (!s.vertices[id]) bad.push(`highlight on missing vertex ${id}`);
    for (const a of s.arrows) if (!s.vertices[a.toId] || (a.fromId !== null && !s.vertices[a.fromId])) bad.push(`arrow ${a.id} points at a missing vertex`);
    return bad;
}

/** Multi-line Before / After summary (topology only, never positions). */
export function summaryOf(s: GraphState): string {
    const vs = vertexIds(s).map((id) => `${id}=${JSON.stringify(s.vertices[id].value)}`).join(", ") || "(none)";
    const es = edgeList(s).map((e) => `${e.source}${s.props.directed ? "→" : "—"}${e.target}${e.weight !== null ? `(${e.weight})` : ""}`).join(", ") || "(none)";
    return `${propsText(s.props)} · ${vertexCount(s)} V, ${edgeCount(s)} E\nvertices: ${vs}\nedges: ${es}`;
}

__ALGOFORGE_FILE_667645d1b81008ce__

mkdir -p apps/web/src/components/visualizers/linear
cat > apps/web/src/components/visualizers/linear/engine.ts <<'__ALGOFORGE_FILE_d947843f054c7318__'
import { HEX_RE, isPrimitive } from "../core/validate";
import {
    ARROW_DEFAULT_COLOR,
    MAX_ITEMS,
    createState,
    describe,
    hasAnnotations,
    inWord,
    peekIndex,
    peekWord,
    positionName,
    removeAt,
} from "./model";
import type { Anim, Explain, Kind, LinearOp, LinearState, Outcome, Primitive } from "./types";
import { MARK_ID_HELP, MARK_ID_RE } from "./validate";

const NONE: Anim = { kind: "none" };
const COLOR_HELP = "Color must look like #RRGGBB, e.g. #FF430F.";
const READ_ONLY = "Nothing. This is a read-only operation, so the contents did not change.";
const ALL_SAME = "Every element, its order, marks, highlights and arrows.";

export const fmt = (v: unknown) => JSON.stringify(v);

export function callText(op: LinearOp, kind: Kind): string {
    void kind;
    const { type, ...rest } = op;
    if (type === "initialize") {
        const n = (op as Extract<LinearOp, { type: "initialize" }>).values.length;
        return `initialize(${n} ${n === 1 ? "element" : "elements"})`;
    }
    const args = Object.values(rest)
        .filter((v) => v !== undefined)
        .map((v) => JSON.stringify(v))
        .join(", ");
    return `${type}(${args})`;
}

const ex = (ran: string, affected: string, changed: string, unchanged: string): Explain => ({
    ran,
    affected,
    changed,
    unchanged,
});

function reject(s: LinearState, ran: string, error: string, anim: Anim = NONE): Outcome {
    return {
        ok: false,
        state: s,
        anim,
        error,
        explain: ex(`${ran} (rejected)`, "Nothing.", error, "Everything: elements, order, marks, highlights and arrows are exactly as before."),
    };
}

function accept(state: LinearState, explain: Explain, anim: Anim = NONE, result?: Outcome["result"]): Outcome {
    return { ok: true, state, explain, anim, result };
}

const STACK_ONLY = new Set(["push", "pop"]);
const QUEUE_ONLY = new Set(["enqueue", "dequeue"]);
function wrongKind(s: LinearState, ran: string, type: string): Outcome {
    const need = STACK_ONLY.has(type) ? "Stack" : "Queue";
    return reject(s, ran, `${type}() is a ${need} operation. Switch to ${need} to use it.`);
}

const emptyMsg = (s: LinearState, what: string) =>
    s.kind === "stack"
        ? `Stack underflow: the stack is empty, so there is no top to ${what}.`
        : `Queue underflow: the queue is empty, so there is no front to ${what}.`;

/** Resolves an optional position to an element; blank means the peek end. */
function target(s: LinearState, ran: string, index: number | undefined): { index: number; id: string } | Outcome {
    const n = s.items.length;
    if (n === 0) return reject(s, ran, `The ${s.kind} is empty, so there is no element to use.`, { kind: "underflow" });
    const i = index ?? peekIndex(s);
    if (!Number.isInteger(i) || i < 0 || i >= n)
        return reject(s, ran, `Position ${i} is invalid: valid positions are 0..${n - 1} (0 = ${s.kind === "stack" ? "bottom" : "front"}).`);
    return { index: i, id: s.items[i].id };
}
const isOutcome = (x: unknown): x is Outcome => typeof x === "object" && x !== null && "explain" in x;

/* ───────────── add / remove ───────────── */

function addOne(s: LinearState, ran: string, value: Primitive): Outcome {
    if (!isPrimitive(value)) return reject(s, ran, "Only strings, numbers, booleans and null are supported.");
    const n = s.items.length;
    if (n >= MAX_ITEMS)
        return reject(
            s,
            ran,
            `${s.kind === "stack" ? "Stack overflow" : "Queue overflow"}: the lab limits it to ${MAX_ITEMS} elements so it stays readable.`,
            { kind: "overflow" },
        );
    const item = { id: `e${s.counters.item}`, value };
    const next: LinearState = { ...s, items: [...s.items, item], counters: { ...s.counters, item: s.counters.item + 1 } };
    const stack = s.kind === "stack";
    const nullNote = value === null ? " (null is a real value, not an empty slot)" : "";
    return accept(
        next,
        ex(
            ran,
            stack
                ? `${fmt(value)} is placed on the top (index ${n}).${nullNote}`
                : `${fmt(value)} joins at the rear (index ${n}).${nullNote}`,
            stack
                ? `Size ${n} → ${n + 1}. ${fmt(value)} is now the top.`
                : `Size ${n} → ${n + 1}. ${fmt(value)} is now the rear${n === 0 ? " and also the front" : `; the front is still ${fmt(s.items[0].value)}`}.`,
            n === 0
                ? "Nothing else existed, so nothing else could change."
                : stack
                  ? `All ${n} elements below keep their ids, order and marks; nothing moved.`
                  : `All ${n} elements already waiting keep their ids, order and marks; nothing moved.`,
        ),
        { kind: "enter", id: item.id },
        { label: stack ? "Pushed" : "Enqueued", value },
    );
}

function removeOne(s: LinearState, ran: string): Outcome {
    const n = s.items.length;
    const stack = s.kind === "stack";
    if (n === 0) return reject(s, ran, emptyMsg(s, stack ? "pop" : "dequeue"), { kind: "underflow" });
    const index = stack ? n - 1 : 0;
    const gone = s.items[index];
    const next = removeAt(s, index);
    const lostMarks = s.marks.filter((m) => m.itemId === gone.id).length;
    const lostArrows = s.arrows.filter((a) => a.itemId === gone.id).length;
    const tail = (lostMarks ? ` ${lostMarks} mark(s) on it were removed.` : "") + (lostArrows ? ` ${lostArrows} arrow(s) on it were removed.` : "");
    return accept(
        next,
        ex(
            ran,
            stack ? `The top element (index ${index}) holds ${fmt(gone.value)}.` : `The front element (index 0) holds ${fmt(gone.value)}.`,
            stack
                ? `Size ${n} → ${n - 1}. ${fmt(gone.value)} was removed and returned. ${n > 1 ? `The new top is ${fmt(next.items[n - 2].value)}.` : "The stack is now empty."}${tail}`
                : `Size ${n} → ${n - 1}. ${fmt(gone.value)} was removed and returned. ${n > 1 ? `The new front is ${fmt(next.items[0].value)}; every remaining element moved one place toward the front (marks followed them).` : "The queue is now empty."}${tail}`,
            stack
                ? "Elements below the top keep their ids, order, indices and marks."
                : "Order is preserved: the remaining elements keep their ids and relative order.",
        ),
        { kind: "exit", ghost: { item: gone, index }, prev: s },
        { label: stack ? "Popped" : "Dequeued", value: gone.value },
    );
}

/* ───────────── dispatcher ───────────── */

export function applyOp(s: LinearState, op: LinearOp): Outcome {
    const ran = callText(op, s.kind);
    const n = s.items.length;
    const stack = s.kind === "stack";

    switch (op.type) {
        case "push":
            return stack ? addOne(s, ran, op.value) : wrongKind(s, ran, op.type);
        case "enqueue":
            return stack ? wrongKind(s, ran, op.type) : addOne(s, ran, op.value);
        case "pop":
            return stack ? removeOne(s, ran) : wrongKind(s, ran, op.type);
        case "dequeue":
            return stack ? wrongKind(s, ran, op.type) : removeOne(s, ran);

        case "peek": {
            if (n === 0) return reject(s, ran, emptyMsg(s, "peek at"), { kind: "underflow" });
            const i = peekIndex(s);
            const it = s.items[i];
            return accept(
                s,
                ex(ran, `The ${peekWord(s.kind)} element (index ${i}) holds ${fmt(it.value)}.`, READ_ONLY, ALL_SAME),
                { kind: "peek", id: it.id },
                { label: stack ? "Top" : "Front", value: it.value },
            );
        }
        case "isEmpty":
            return accept(s, ex(ran, `The whole ${s.kind}.`, READ_ONLY, ALL_SAME), NONE, { label: "Is empty?", value: n === 0 });
        case "getSize":
            return accept(s, ex(ran, `The whole ${s.kind}.`, READ_ONLY, ALL_SAME), NONE, { label: "Size", value: n });

        case "clear": {
            if (n === 0 && !hasAnnotations(s)) return reject(s, ran, `The ${s.kind} is already empty.`);
            return accept(
                { ...s, items: [], marks: [], highlights: {}, arrows: [] },
                ex(
                    ran,
                    `All ${n} element${n === 1 ? "" : "s"}.`,
                    `Size ${n} → 0. ${s.marks.length} mark(s), ${s.arrows.length} arrow(s) and ${Object.keys(s.highlights).length} highlight(s) were removed with the elements.`,
                    "The operation log.",
                ),
                { kind: "clear", prev: s },
            );
        }
        case "initialize": {
            if (!Array.isArray(op.values) || op.values.length > MAX_ITEMS || !op.values.every(isPrimitive))
                return reject(s, ran, `Provide a JSON array of at most ${MAX_ITEMS} strings, numbers, booleans or null.`);
            const next = createState(s.kind, op.values, s);
            return accept(
                next,
                ex(
                    ran,
                    `${op.values.length} element${op.values.length === 1 ? "" : "s"}, oldest first.`,
                    stack
                        ? `Contents replaced (size ${n} → ${op.values.length}). The first value is the bottom and the last value is the top. Marks, highlights and arrows were cleared.`
                        : `Contents replaced (size ${n} → ${op.values.length}). The first value is the front and the last value is the rear. Marks, highlights and arrows were cleared.`,
                    "The operation log.",
                ),
                { kind: "reset", prev: s },
                { label: "Size", value: op.values.length },
            );
        }
        case "reset": {
            const next = createState(s.kind, undefined, s);
            return accept(
                next,
                ex(ran, `The whole ${s.kind}.`, `Restored the starter ${s.kind} (size ${next.items.length}). Marks, highlights and arrows were cleared.`, "The operation log."),
                { kind: "reset", prev: s },
            );
        }

        /* ── marks ── */
        case "createMark": {
            if (!MARK_ID_RE.test(op.markId)) return reject(s, ran, MARK_ID_HELP);
            if (s.marks.some((m) => m.id === op.markId)) return reject(s, ran, `A mark named ${op.markId} already exists.`);
            const t = target(s, ran, op.index);
            if (isOutcome(t)) return t;
            return accept(
                { ...s, marks: [...s.marks, { id: op.markId, itemId: t.id }] },
                ex(
                    ran,
                    `Index ${t.index} (${fmt(s.items[t.index].value)}), ${positionName(s, t.index)}.`,
                    `Mark ${op.markId} now sticks to this element. It follows it when others are added or removed, and disappears if the element is removed.`,
                    "Contents, order and size.",
                ),
                { kind: "markIn", markId: op.markId },
                { label: "Created mark", value: op.markId },
            );
        }
        case "deleteMark": {
            const m = s.marks.find((x) => x.id === op.markId);
            if (!m) return reject(s, ran, `No mark named "${op.markId}".`);
            return accept(
                { ...s, marks: s.marks.filter((x) => x !== m) },
                ex(ran, `Mark ${m.id}.`, `Mark ${m.id} was removed.`, "The element it pointed at and all contents."),
                { kind: "markOut", itemId: m.itemId, markId: m.id },
            );
        }
        case "readMark": {
            const m = s.marks.find((x) => x.id === op.markId);
            if (!m) return reject(s, ran, `No mark named "${op.markId}".`);
            const index = s.items.findIndex((i) => i.id === m.itemId);
            if (index < 0) return reject(s, ran, `Mark ${m.id} no longer has an element.`);
            return accept(
                s,
                ex(ran, `Mark ${m.id} is on index ${index}, ${positionName(s, index)}.`, READ_ONLY, ALL_SAME),
                { kind: "peek", id: m.itemId },
                { label: `Mark ${m.id}`, value: { index, value: s.items[index].value, position: positionName(s, index) } },
            );
        }

        /* ── annotations ── */
        case "highlight": {
            if (!HEX_RE.test(op.color)) return reject(s, ran, COLOR_HELP);
            const t = target(s, ran, op.index);
            if (isOutcome(t)) return t;
            return accept(
                { ...s, highlights: { ...s.highlights, [t.id]: op.color.toUpperCase() } },
                ex(ran, `Index ${t.index}, ${positionName(s, t.index)}.`, `Element filled with ${op.color.toUpperCase()}. It stays until cleared or the element is removed.`, "Contents, order and size."),
                { kind: "highlight", id: t.id },
            );
        }
        case "pointArrow": {
            const color = (op.color ?? ARROW_DEFAULT_COLOR).toUpperCase();
            if (!HEX_RE.test(color)) return reject(s, ran, COLOR_HELP);
            const t = target(s, ran, op.index);
            if (isOutcome(t)) return t;
            const existing = s.arrows.find((a) => a.itemId === t.id);
            const id = existing?.id ?? `a${s.counters.arrow}`;
            return accept(
                existing
                    ? { ...s, arrows: s.arrows.map((a) => (a === existing ? { ...a, color } : a)) }
                    : { ...s, arrows: [...s.arrows, { id, itemId: t.id, color }], counters: { ...s.counters, arrow: s.counters.arrow + 1 } },
                ex(
                    ran,
                    `Index ${t.index}, ${positionName(s, t.index)}.`,
                    existing ? `The arrow on this element was recolored to ${color}.` : `A ${color} arrow now points at this element.`,
                    "Contents, order and size.",
                ),
                { kind: "arrow", id },
            );
        }
        case "clearHighlights": {
            const c = Object.keys(s.highlights).length;
            if (!c) return reject(s, ran, "There is no highlight to clear.");
            return accept({ ...s, highlights: {} }, ex(ran, "All elements.", `${c} highlight(s) removed.`, "Contents, marks and arrows."));
        }
        case "clearArrows": {
            if (!s.arrows.length) return reject(s, ran, "There are no arrows to clear.");
            return accept(
                { ...s, arrows: [] },
                ex(ran, "All arrows.", `${s.arrows.length} arrow(s) removed.`, "Contents, marks and highlights."),
                { kind: "dismiss", prev: s },
            );
        }
    }
}

export { describe, inWord };

__ALGOFORGE_FILE_d947843f054c7318__

mkdir -p apps/web/src/components/visualizers/linkedlist
cat > apps/web/src/components/visualizers/linkedlist/engine.ts <<'__ALGOFORGE_FILE_67e3bd6f4666e9b5__'
import { HEX_RE, isPrimitive } from "../core/validate";
import {
    ARROW_DEFAULT_COLOR,
    LIST_ID,
    MAX_NODES,
    TYPE_LABEL,
    createList,
    describe,
    hasAnnotations,
    lengthOf,
    orderOf,
    relink,
} from "./model";
import { lowestFreeId } from "../shared/ids";
import { buildSteps, type StepHint } from "./steps";
import type { Anim, Explain, ListOp, ListState, ListType, Outcome, Primitive, Step } from "./types";
import { MARKER_HELP, NAME_RE, NODE_ID_HELP } from "./validate";

const NONE: Anim = { kind: "none" };
const COLOR_HELP = "Color must look like #RRGGBB, e.g. #FF430F.";
const READ_ONLY = "Nothing. This is a read-only operation, so the list did not change.";
const ALL_SAME = "Every node, every pointer, HEAD, TAIL, marks, highlights and arrows.";

export const fmt = (v: unknown) => JSON.stringify(v);

export function callText(op: ListOp): string {
    const { type, ...rest } = op;
    if (type === "initialize") {
        const n = (op as Extract<ListOp, { type: "initialize" }>).values.length;
        return `initialize(${n} ${n === 1 ? "value" : "values"})`;
    }
    const args = Object.values(rest)
        .filter((v) => v !== undefined)
        .map((v) => JSON.stringify(v))
        .join(", ");
    return `${type}(${args})`;
}

const ex = (ran: string, affected: string, changed: string, unchanged: string): Explain => ({ ran, affected, changed, unchanged });

function reject(s: ListState, ran: string, error: string): Outcome {
    return {
        ok: false,
        state: s,
        anim: NONE,
        steps: [],
        error,
        explain: ex(`${ran} (rejected)`, "Nothing.", error, "Everything: nodes, pointers, HEAD, TAIL, marks and arrows are exactly as before."),
    };
}

function accept(state: ListState, explain: Explain, anim: Anim = NONE, steps: Step[] = [], result?: Outcome["result"], select?: string | null): Outcome {
    return { ok: true, state, explain, anim, steps, result, select };
}

const stepsText = (steps: Step[]) => (steps.length ? steps.map((x) => x.text).join("; ") + "." : "No pointer changed.");
const badIndex = (i: unknown, n: number, allowEnd = false) =>
    !Number.isInteger(i)
        ? "Index must be a whole number."
        : n === 0 && !allowEnd
          ? `Index ${i} is invalid: the list is empty, so there is no valid index.`
          : `Index ${i} is invalid: valid indices are 0..${allowEnd ? n : n - 1}.`;
const inRange = (i: unknown, n: number, allowEnd = false): i is number =>
    Number.isInteger(i) && (i as number) >= 0 && (i as number) < n + (allowEnd ? 1 : 0);

const where = (order: string[], index: number, s: ListState) => {
    const n = order.length;
    if (n === 0) return "into the empty list";
    if (index === 0) return `at the head, before ${order[0]}`;
    if (index === n) return `at the tail, after ${order[n - 1]}`;
    return `between ${order[index - 1]} and ${order[index]}`;
};
const nodeNotFound = (s: ListState, id: string) => {
    const ids = orderOf(s);
    return ids.length
        ? `No node has the id "${id}". Existing ids: ${ids.join(", ")}.`
        : `No node has the id "${id}": the list is empty.`;
};

/* ───────────── shared primitives: every convenience operation calls these ───────────── */

function insertAtPrimitive(s: ListState, ran: string, index: number, value: Primitive | undefined, label: string): Outcome {
    const order = orderOf(s);
    const n = order.length;
    const v = value === undefined ? null : value;
    if (!isPrimitive(v)) return reject(s, ran, "Only strings, numbers, booleans and null are supported.");
    if (!inRange(index, n, true)) return reject(s, ran, badIndex(index, n, true));
    if (n >= MAX_NODES) return reject(s, ran, `The lab limits the list to ${MAX_NODES} nodes so it stays readable.`);

    const id = lowestFreeId(Object.keys(s.nodes)); // the lowest free number: delete n6 and the next node is n6 again
    const nodes = { ...s.nodes, [id]: { id, value: v, next: null, prev: null } };
    const newOrder = [...order.slice(0, index), id, ...order.slice(index)];
    const next = relink(s, newOrder, s.type, nodes);
    const steps = buildSteps(s, next, { mode: "insert", id });
    return accept(
        next,
        ex(
            ran,
            `New node ${id} (${fmt(v)}${v === null ? ", null is a real value" : ""}) was created and placed at index ${index}, ${where(order, index, s)}.`,
            `Length ${n} → ${n + 1}. Pointer changes: ${stepsText(steps)}`,
            n === 0
                ? "Nothing else existed."
                : `No existing node was copied or moved in memory: only pointers changed. All ${n} existing nodes keep their ids, values and marks.`,
        ),
        { kind: "insert", id, index, steps },
        steps,
        { label, value: { id, index, value: v } },
    );
}

function deleteAtPrimitive(s: ListState, ran: string, index: number, label: string): Outcome {
    const order = orderOf(s);
    const n = order.length;
    if (n === 0) return reject(s, ran, "The list is empty, so there is nothing to delete.");
    if (!inRange(index, n)) return reject(s, ran, badIndex(index, n));
    const id = order[index];
    const gone = s.nodes[id];
    const newOrder = order.filter((x) => x !== id);
    const highlights = { ...s.highlights };
    delete highlights[id];
    const base: ListState = {
        ...s,
        markers: s.markers.filter((m) => m.nodeId !== id),
        highlights,
        arrows: s.arrows.filter((a) => a.toId !== id && a.fromId !== id),
    };
    const next = relink(base, newOrder);
    const steps = buildSteps(s, next, { mode: "delete", id });
    const lostMarks = s.markers.filter((m) => m.nodeId === id).length;
    return accept(
        next,
        ex(
            ran,
            `Node ${id} (${fmt(gone.value)}) at index ${index}${index === 0 ? ", the head" : index === n - 1 ? ", the tail" : ""}.`,
            `Length ${n} → ${n - 1}. The deleted node was ${id} holding ${fmt(gone.value)}. Pointer changes: ${stepsText(steps)}` +
                (lostMarks ? ` ${lostMarks} marker(s) on it were removed.` : ""),
            n === 1 ? "The list is now empty." : `The other ${n - 1} nodes keep their ids, values and marks; none was copied or moved in memory.`,
        ),
        { kind: "delete", ghost: { id, index }, prev: s, steps },
        steps,
        { label, value: { deleted: { id, value: gone.value, index }, length: n - 1 } },
        null,
    );
}

/** Reverse / swap / type change: a new order (or type) and the pointer steps that get there. */
function rewirePrimitive(
    s: ListState,
    ran: string,
    what: "reverse" | "swap" | "retype",
    order: string[],
    type: ListType,
    ids: string[],
    affected: string,
    unchanged: string,
): Outcome {
    const next = relink(s, order, type);
    const hint: StepHint = { mode: "generic" };
    const steps = buildSteps(s, next, hint);
    return accept(
        next,
        ex(ran, affected, `Pointer changes: ${stepsText(steps)}`, unchanged),
        { kind: "rewire", what, ids, steps, prev: s },
        steps,
    );
}

/* ───────────── lookups ───────────── */

function nodeAt(s: ListState, index: number) {
    const id = orderOf(s)[index];
    return { id, node: s.nodes[id] };
}
const view = (s: ListState, index: number) => {
    const { id, node } = nodeAt(s, index);
    return { index, id, value: node.value, next: node.next ?? "NULL", prev: s.type === "dll" ? (node.prev ?? "NULL") : "(none: this list has no prev pointer)" };
};

function target(s: ListState, ran: string, index: number | undefined): { index: number; id: string } | Outcome {
    const n = lengthOf(s);
    if (n === 0) return reject(s, ran, "The list is empty, so there is no node to use.");
    const i = index ?? 0;
    if (!inRange(i, n)) return reject(s, ran, badIndex(i, n));
    return { index: i, id: orderOf(s)[i] };
}
const isOutcome = (x: unknown): x is Outcome => typeof x === "object" && x !== null && "explain" in x;

/* ───────────── dispatcher ───────────── */

export function applyOp(s: ListState, op: ListOp, self: string = LIST_ID): Outcome {
    const ran = callText(op);
    const order = orderOf(s);
    const n = order.length;

    switch (op.type) {
        /* convenience operations: thin wrappers over the shared primitives */
        case "append":
            return insertAtPrimitive(s, ran, n, op.value, "Appended");
        case "prepend":
            return insertAtPrimitive(s, ran, 0, op.value, "Prepended");
        case "insertAt":
            return insertAtPrimitive(s, ran, op.index, op.value, "Inserted");
        case "insertAfter": {
            const i = order.indexOf(op.nodeId);
            if (i < 0) return reject(s, ran, nodeNotFound(s, op.nodeId));
            return insertAtPrimitive(s, ran, i + 1, op.value, "Inserted after");
        }
        case "insertBefore": {
            const i = order.indexOf(op.nodeId);
            if (i < 0) return reject(s, ran, nodeNotFound(s, op.nodeId));
            return insertAtPrimitive(s, ran, i, op.value, "Inserted before");
        }
        case "delete":
            return deleteAtPrimitive(s, ran, op.index, "Deleted");
        case "deleteHead":
            return n === 0 ? reject(s, ran, "The list is empty, so there is no head to delete.") : deleteAtPrimitive(s, ran, 0, "Deleted head");
        case "deleteTail":
            return n === 0 ? reject(s, ran, "The list is empty, so there is no tail to delete.") : deleteAtPrimitive(s, ran, n - 1, "Deleted tail");
        case "deleteById": {
            const i = order.indexOf(op.nodeId);
            if (i < 0) return reject(s, ran, nodeNotFound(s, op.nodeId));
            return deleteAtPrimitive(s, ran, i, "Deleted");
        }

        case "update": {
            if (!inRange(op.index, n)) return reject(s, ran, badIndex(op.index, n));
            if (!isPrimitive(op.value)) return reject(s, ran, "Only strings, numbers, booleans and null are supported.");
            const { id, node } = nodeAt(s, op.index);
            return accept(
                { ...s, nodes: { ...s.nodes, [id]: { ...node, value: op.value } } },
                ex(ran, `Node ${id} at index ${op.index}.`, `Value ${fmt(node.value)} → ${fmt(op.value)}. No pointer changed.`, "Length, every pointer, HEAD, TAIL, node ids, marks, highlights and arrows."),
                { kind: "update", id, oldValue: node.value },
                [],
                { label: "Replaced value", value: { id, index: op.index, old: node.value, new: op.value } },
            );
        }
        case "read": {
            if (!inRange(op.index, n)) return reject(s, ran, badIndex(op.index, n));
            const v = view(s, op.index);
            return accept(
                s,
                ex(ran, `Node ${v.id} at index ${op.index}: value ${fmt(v.value)}, next → ${v.next}.`, READ_ONLY, ALL_SAME),
                { kind: "read", id: v.id },
                [],
                { label: `Node at index ${op.index}`, value: v },
                v.id,
            );
        }
        case "findById": {
            const i = order.indexOf(op.nodeId);
            if (i < 0) return reject(s, ran, nodeNotFound(s, op.nodeId));
            const v = view(s, i);
            return accept(
                s,
                ex(ran, `Node ${v.id} was found by id at index ${i}: value ${fmt(v.value)}.`, READ_ONLY, ALL_SAME),
                { kind: "read", id: v.id },
                [],
                { label: `Node ${op.nodeId}`, value: { found: true, ...v } },
                v.id,
            );
        }
        case "getLength":
            return accept(s, ex(ran, "The whole list.", READ_ONLY, ALL_SAME), NONE, [], { label: "Length", value: n });
        case "isEmpty":
            return accept(s, ex(ran, "The whole list.", READ_ONLY, ALL_SAME), NONE, [], { label: "Is empty?", value: n === 0 });

        case "reverse": {
            if (n < 2)
                return accept(s, ex(ran, n === 0 ? "The list is empty." : "The list has a single node.", "Nothing: reversing fewer than 2 nodes changes no pointer.", ALL_SAME), NONE, [], { label: "Reversed", value: false });
            return rewirePrimitive(
                s,
                ran,
                "reverse",
                [...order].reverse(),
                s.type,
                order,
                `All ${n} nodes: every pointer is redirected the other way, and HEAD and TAIL trade places.`,
                "Every node's id and value, the marks (they stay on their nodes), and the length.",
            );
        }
        case "swap": {
            if (!inRange(op.indexA, n)) return reject(s, ran, badIndex(op.indexA, n));
            if (!inRange(op.indexB, n)) return reject(s, ran, badIndex(op.indexB, n));
            if (op.indexA === op.indexB) return reject(s, ran, "Both indices are the same, so swapping would change nothing.");
            const o = [...order];
            [o[op.indexA], o[op.indexB]] = [o[op.indexB], o[op.indexA]];
            return rewirePrimitive(
                s,
                ran,
                "swap",
                o,
                s.type,
                [order[op.indexA], order[op.indexB]],
                `Nodes ${order[op.indexA]} (index ${op.indexA}) and ${order[op.indexB]} (index ${op.indexB}) trade places by rewiring their neighbours' pointers.`,
                "Every node's id and value, the marks (they travel with their nodes), and the length.",
            );
        }
        case "setType": {
            if (op.to === s.type) return reject(s, ran, `The list is already a ${TYPE_LABEL[s.type].toLowerCase()}.`);
            const what: Record<ListType, string> = {
                sll: "Every prev pointer is dropped and the last node points to NULL.",
                dll: "Every node gains a prev pointer and the last node points to NULL.",
                cll: "The last node's next pointer is redirected from NULL to the head. Any prev pointers are dropped.",
            };
            return rewirePrimitive(
                s,
                ran,
                "retype",
                order,
                op.to,
                [],
                `The list becomes a ${TYPE_LABEL[op.to].toLowerCase()}. ${what[op.to]}`,
                "Node ids, values and order; marks, highlights and arrows.",
            );
        }
        case "clear": {
            if (n === 0) return reject(s, ran, "The list is already empty.");
            return accept(
                { ...s, nodes: {}, head: null, tail: null, markers: [], highlights: {}, arrows: [], cursor: 0 },
                ex(
                    ran,
                    `All ${n} node${n === 1 ? "" : "s"}.`,
                    `Length ${n} → 0. HEAD and TAIL now point to NULL. ${s.markers.length} marker(s), ${s.arrows.length} arrow(s) and ${Object.keys(s.highlights).length} highlight(s) were removed with their nodes; Mark P returned to index 0.`,
                    "The list type and the operation log.",
                ),
                { kind: "clear", prev: s },
                [],
                undefined,
                null,
            );
        }
        case "initialize": {
            if (!Array.isArray(op.values) || op.values.length > MAX_NODES || !op.values.every(isPrimitive))
                return reject(s, ran, `Provide a JSON array of at most ${MAX_NODES} strings, numbers, booleans or null.`);
            const next = createList(s.type, op.values);
            return accept(
                next,
                ex(
                    ran,
                    `${op.values.length} new node${op.values.length === 1 ? "" : "s"}, linked in order as a ${TYPE_LABEL[s.type].toLowerCase()}.`,
                    `List replaced: length ${n} → ${op.values.length}. Markers, highlights and arrows were cleared; Mark P returned to index 0.`,
                    "The list type and the operation log.",
                ),
                { kind: "reset", prev: s },
                [],
                { label: "Length", value: op.values.length },
                null,
            );
        }
        case "reset": {
            const next = createList(s.type);
            return accept(
                next,
                ex(ran, "The whole list.", `Restored the starter list (length ${lengthOf(next)}) as a ${TYPE_LABEL[s.type].toLowerCase()}. Markers, highlights and arrows were cleared.`, "The list type and the operation log."),
                { kind: "reset", prev: s },
                [],
                undefined,
                null,
            );
        }

        /* ── markers (follow nodes) ── */
        case "mark":
        case "createMark": {
            if (!inRange(op.index, n)) return reject(s, ran, badIndex(op.index, n));
            let id: string;
            if (op.type === "createMark") {
                if (!NAME_RE.test(op.markId)) return reject(s, ran, MARKER_HELP);
                if (s.markers.some((m) => m.id === op.markId)) return reject(s, ran, `A marker named ${op.markId} already exists.`);
                id = op.markId;
            } else id = lowestFreeId(s.markers.map((m) => m.id), "m");
            const nodeId = order[op.index];
            return accept(
                { ...s, markers: [...s.markers, { id, nodeId }] },
                ex(ran, `Node ${nodeId} at index ${op.index}.`, `Marker ${id} now sticks to this node and follows it if pointer changes move it.`, "Every node, pointer, HEAD and TAIL."),
                { kind: "markIn", markId: id },
                [],
                { label: "Created marker", value: id },
            );
        }
        case "deleteMark": {
            const m = op.markId ? s.markers.find((x) => x.id === op.markId) : s.markers[s.markers.length - 1];
            if (!m) return reject(s, ran, op.markId ? `No marker "${op.markId}".` : "There are no markers to delete.");
            return accept(
                { ...s, markers: s.markers.filter((x) => x !== m) },
                ex(ran, `Marker ${m.id}.`, `Marker ${m.id} was removed. Node ${m.nodeId} is untouched.`, "Every node, pointer, HEAD and TAIL."),
                { kind: "markOut", nodeId: m.nodeId, markId: m.id },
            );
        }
        case "readMark": {
            const m = op.markId ? s.markers.find((x) => x.id === op.markId) : s.markers[s.markers.length - 1];
            if (!m) return reject(s, ran, op.markId ? `No marker "${op.markId}".` : "There are no markers to read.");
            const i = order.indexOf(m.nodeId);
            if (i < 0) return reject(s, ran, `Marker ${m.id} no longer has a node.`);
            const v = view(s, i);
            return accept(
                s,
                ex(ran, `Marker ${m.id} is on node ${v.id} at index ${i} (value ${fmt(v.value)}).`, READ_ONLY, ALL_SAME),
                { kind: "read", id: v.id },
                [],
                { label: `Marker ${m.id}`, value: v },
                v.id,
            );
        }
        case "moveMarkToIndex": {
            const m = s.markers.find((x) => x.id === op.markId);
            if (!m) return reject(s, ran, `No marker "${op.markId}".`);
            if (!inRange(op.index, n)) return reject(s, ran, badIndex(op.index, n));
            const nodeId = order[op.index];
            return accept(
                { ...s, markers: s.markers.map((x) => (x === m ? { ...x, nodeId } : x)) },
                ex(ran, `Marker ${m.id} → node ${nodeId} at index ${op.index}.`, `Marker ${m.id} is attached to a different node.`, "Every node, pointer, HEAD and TAIL."),
                { kind: "markIn", markId: m.id },
            );
        }

        /* ── Mark P: an index cursor that keeps its index when nodes shift (no wrap, no clamp) ── */
        case "moveMarkOne":
        case "moveMarkBy":
        case "moveMarkTo": {
            if (n === 0) return reject(s, ran, "The list is empty, so Mark P has nowhere to move.");
            const to =
                op.type === "moveMarkOne"
                    ? s.cursor + (op.direction === "left" ? -1 : 1)
                    : op.type === "moveMarkBy"
                      ? s.cursor + op.steps
                      : op.index;
            if (op.type === "moveMarkBy" && (!Number.isInteger(op.steps) || op.steps === 0)) return reject(s, ran, "steps must be a non-zero whole number.");
            if (!inRange(to, n))
                return reject(s, ran, `Mark P cannot move to ${to}: valid indices are 0..${n - 1}. Marks never wrap around, which also keeps circular lists from looping forever.`);
            return accept(
                { ...s, cursor: to },
                ex(ran, `Mark P, now on node ${order[to]} at index ${to} (${fmt(s.nodes[order[to]].value)}).`, `Mark P: index ${s.cursor} → ${to}.`, "Every node, pointer, HEAD and TAIL."),
                { kind: "cursor", from: s.cursor, to },
                [],
                { label: "Mark P index", value: to },
            );
        }

        /* ── annotations ── */
        case "highlight": {
            if (!HEX_RE.test(op.color)) return reject(s, ran, COLOR_HELP);
            const t = target(s, ran, op.index);
            if (isOutcome(t)) return t;
            return accept(
                { ...s, highlights: { ...s.highlights, [t.id]: op.color.toUpperCase() } },
                ex(ran, `Node ${t.id} at index ${t.index}${op.index === undefined ? " (the head, because no index was given)" : ""}.`, `Node filled with ${op.color.toUpperCase()}. It stays until cleared or the node is deleted.`, "Every node, pointer, HEAD and TAIL."),
                { kind: "highlight", id: t.id },
            );
        }
        case "clearHighlights": {
            const c = Object.keys(s.highlights).length;
            if (!c) return reject(s, ran, "There is no highlight to clear.");
            return accept({ ...s, highlights: {} }, ex(ran, "All nodes.", `${c} highlight(s) removed.`, "Nodes, pointers, markers and arrows."));
        }
        case "pointArrow": {
            if (op.list !== self) return reject(s, ran, `List "${op.list}" does not exist. This list is "${self}".`);
            const color = (op.color ?? ARROW_DEFAULT_COLOR).toUpperCase();
            if (!HEX_RE.test(color)) return reject(s, ran, COLOR_HELP);
            const t = target(s, ran, op.index);
            if (isOutcome(t)) return t;
            const id = lowestFreeId(s.arrows.map((a) => a.id), "a");
            return accept(
                { ...s, arrows: [...s.arrows, { id, fromId: null, toId: t.id, color }] },
                ex(ran, `Node ${t.id} at index ${t.index}.`, `A ${color} annotation arrow now points at this node. It is not a list pointer.`, "Every node, pointer, HEAD and TAIL."),
                { kind: "arrow", id },
            );
        }
        case "pointArrowFromTo": {
            if (op.list1 !== self) return reject(s, ran, `List "${op.list1}" does not exist. This list is "${self}".`);
            if (op.list2 !== self) return reject(s, ran, `List "${op.list2}" does not exist. This list is "${self}".`);
            if (!inRange(op.index1, n)) return reject(s, ran, badIndex(op.index1, n));
            if (!inRange(op.index2, n)) return reject(s, ran, badIndex(op.index2, n));
            if (op.index1 === op.index2) return reject(s, ran, "The arrow's start and end are the same node.");
            const color = (op.color ?? "#17A34A").toUpperCase();
            if (!HEX_RE.test(color)) return reject(s, ran, COLOR_HELP);
            const id = lowestFreeId(s.arrows.map((a) => a.id), "a");
            return accept(
                { ...s, arrows: [...s.arrows, { id, fromId: order[op.index1], toId: order[op.index2], color }] },
                ex(ran, `Nodes ${order[op.index1]} → ${order[op.index2]}.`, `A ${color} annotation arrow now runs between them. It is not a list pointer.`, "Every node, pointer, HEAD and TAIL."),
                { kind: "arrow", id },
            );
        }
        case "clearArrows": {
            if (!s.arrows.length) return reject(s, ran, "There are no arrows to clear.");
            return accept(
                { ...s, arrows: [] },
                ex(ran, "All annotation arrows.", `${s.arrows.length} arrow(s) removed. List pointers are not arrows you drew, so they stay.`, "Nodes, pointers, markers and highlights."),
                { kind: "dismiss", prev: s },
            );
        }
    }
}

export { describe, hasAnnotations };

__ALGOFORGE_FILE_67e3bd6f4666e9b5__

mkdir -p apps/web/src/components/visualizers/shared
cat > apps/web/src/components/visualizers/shared/animationSettings.ts <<'__ALGOFORGE_FILE_17fb098e22be57c2__'
"use client";
import { useEffect, useState } from "react";
import { create } from "zustand";

export interface AnimationSettings {
  /** Playback-rate multiplier. 2 = twice as fast. Authored durations are untouched. */
  speed: number;
  /** Base duration (ms) of one animation step at speed 1. */
  duration: number;
  /** Max frames/second the Anime.js engine renders. Smoothness only, never tempo. */
  fps: number;
  /** null = follow OS prefers-reduced-motion; true/false = user override. */
  reducedMotion: boolean | null;
}

export const DEFAULT_DURATION = 750;

export const ANIMATION_DEFAULTS: AnimationSettings = {
  speed: 1,
  duration: DEFAULT_DURATION,
  fps: 60,
  reducedMotion: null,
};

export const ANIMATION_LIMITS = {
  speed: { min: 0.25, max: 4, step: 0.25 },
  duration: { min: 150, max: 2250, step: 50 },
  fps: { min: 10, max: 120, step: 10 },
} as const;

interface SettingsStore extends AnimationSettings {
  update: (patch: Partial<AnimationSettings>) => void;
}

export const useAnimationSettings = create<SettingsStore>((set) => ({
  ...ANIMATION_DEFAULTS,
  update: (patch) => set(patch),
}));

export function useReducedMotion(): boolean {
  const override = useAnimationSettings((s) => s.reducedMotion);
  const [system, setSystem] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setSystem(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setSystem(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return override ?? system;
}

__ALGOFORGE_FILE_17fb098e22be57c2__

mkdir -p apps/web/src/components/visualizers/shared/stage
cat > apps/web/src/components/visualizers/shared/stage/StageFrame.tsx <<'__ALGOFORGE_FILE_1a2e6720c9a5bc80__'
"use client";
import type { ReactNode, RefObject } from "react";
import { cn } from "@/lib/utils";

export interface StatItem {
  label: string;
  value: string;
  mono?: boolean;
}

/** The one frame around every lab's canvas: stat row, canvas, footer. */
export function StageFrame(p: { hostRef: RefObject<HTMLElement | null>; label: string; stats: StatItem[]; badge?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <section ref={p.hostRef as RefObject<HTMLElement>} data-stage aria-label={p.label} className="relative overflow-hidden rounded-2xl border border-primary-foreground/10 bg-card/30">
      <div className="flex flex-col gap-5 py-6">
        <div data-chrome className="flex flex-wrap items-end gap-x-10 gap-y-3 px-6">
          {p.stats.map((s) => (
            <div key={s.label} className="flex min-w-0 flex-col gap-1">
              <span className={cn("max-w-[260px] truncate text-xl font-semibold leading-none tabular-nums", (s.mono ?? true) && "font-mono")}>{s.value}</span>
              <span className="text-[11px] leading-none text-muted-foreground">{s.label}</span>
            </div>
          ))}
          {p.badge}
        </div>
        {p.children}
        {p.footer ? <div data-chrome className="contents">{p.footer}</div> : null}
      </div>
    </section>
  );
}

__ALGOFORGE_FILE_1a2e6720c9a5bc80__

mkdir -p apps/web/src/components/visualizers/tree
cat > apps/web/src/components/visualizers/tree/TreeStage.tsx <<'__ALGOFORGE_FILE_d01ef7be188537e5__'
"use client";
import { useRef, useState } from "react";
import { spring, stagger, utils } from "animejs";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "../shared/animationSettings";
import { annotationArc } from "../shared/edges";
import { Caption } from "../shared/stage/Caption";
import { StageBoard, type BoardApi } from "../shared/stage/StageBoard";
import { EdgeG } from "../shared/stage/EdgeG";
import { edgeCurve } from "../shared/stage/geometry";
import { NodeDisc } from "../shared/stage/NodeDisc";
import { StageFrame } from "../shared/stage/StageFrame";
import { COLOR_FADE, INK } from "../shared/stage/tokens";
import { playRestore, useStageAnimator } from "../shared/stage/useStageAnimator";
import { btn } from "../shared/styles";
import { fmt } from "./engine";
import { T, boxOf, colX, layoutOf, rootPillPos, rowY } from "./layout";
import { TYPE_LABEL, activeIds, edgesOf, heightOf, lengthOf, parseEdgeKey, type Edge } from "./model";
import type * as LabT from "./types";
import type { Step } from "./types";

function Pill({ name, x, y, label, color }: { name: string; x: number; y: number; label: string; color: string }) {
  return (
    <div data-ptr={name} data-x={x} data-y={y} className="pointer-events-none absolute left-0 top-0" style={{ width: T.PILL_W }}>
      <span data-ptr-pill className="inline-flex h-5 items-center justify-center rounded-full border px-2 font-mono text-[10px] font-semibold tracking-wide" style={{ color, borderColor: `${color}66`, background: `${color}14`, minWidth: T.PILL_W, transformOrigin: "50% 100%" }}>
        {label}
      </span>
    </div>
  );
}

/** What a stage needs to draw one structure. The old labs feed it from their store; the shared canvas feeds it directly. */
export interface TreeStageViewProps {
  data: LabT.TreeState;
  last: Pick<LabT.LogEntry, "seq" | "outcome"> | null;
  selectedId: string | null;
  anim: { token: number; plan: LabT.Anim } | null;
  status: "ready" | "animating" | "paused";
  showIds: boolean;
  caption: import("../shared/stage/Caption").CaptionData | null;
  selectNode: (id: string | null) => void;
  finishAnimation: (token: number) => void;
  run: (op: LabT.TreeOp) => void;
}

export function TreeStageView({ data, last, selectedId, anim, status, showIds, caption, selectNode, finishAnimation, run }: TreeStageViewProps) {
  const reduced = useReducedMotion();

  const host = useRef<HTMLElement>(null);
  const api = useRef<BoardApi | null>(null);
  const [hover, setHover] = useState<string | null>(null);

  const plan = anim?.plan ?? null;
  const before = plan && "prev" in plan ? plan.prev : null;
  const lay = layoutOf(data);
  const prevLay = before ? layoutOf(before) : null;
  const n = lengthOf(data);
  const liveKeys = new Set(edgesOf(data).map((e) => e.key));

  /* Everything that is leaving is drawn from the state before the operation so it can fade out. */
  const ghostIds: string[] =
    plan?.kind === "delete" ? plan.ghostIds : plan?.kind === "clear" || plan?.kind === "reset" ? Object.keys(plan.prev.nodes) : plan?.kind === "restore" ? Object.keys(plan.prev.nodes).filter((id) => !data.nodes[id]) : [];
  const ghostMark = plan?.kind === "markOut" ? { nodeId: plan.nodeId, markId: plan.markId } : plan?.kind === "markMove" ? { nodeId: plan.fromId, markId: plan.markId } : null;
  const planSteps: Step[] = plan && "steps" in plan ? plan.steps : [];
  const ghostEdgeKeys: string[] =
    plan?.kind === "clear" || plan?.kind === "reset"
      ? edgesOf(plan.prev).map((e) => e.key)
      : plan?.kind === "restore"
        ? edgesOf(plan.prev).map((e) => e.key).filter((k) => !liveKeys.has(k))
        : Array.from(new Set(planSteps.flatMap((s) => s.removes)));
  const dismissed = plan?.kind === "dismiss" ? plan.prev.arrows.filter((a) => a.fromId !== null) : [];
  const rootPill = rootPillPos(data, lay);
  const width = Math.max(lay.width, prevLay?.width ?? 0);
  const height = Math.max(lay.height, prevLay?.height ?? 0);
  const steps: Step[] = last?.outcome.ok ? last.outcome.steps : [];
  const stepsKey = last ? `${last.seq}` : "none";

  // The root-to-node path is drawn a little stronger: hover a node to see its depth, or select it to keep it.
  const calm = status === "ready";
  const focus = calm && hover && data.nodes[hover] ? hover : selectedId;
  const pathSet = new Set<string>();
  if (focus && data.nodes[focus]) {
    let c: string | null = focus;
    for (let g = 0; c && g <= n; g++) {
      pathSet.add(c);
      c = data.nodes[c].parent;
    }
  }
  const dimOthers = calm && !!hover && !!data.nodes[hover];

  useStageAnimator({
    host,
    anim,
    reduced,
    finish: finishAnimation,
    deps: [data],
    reveal: (cx, cy) => api.current?.reveal(cx, cy),
    build: (c) => {
      const { m, D, plan: p, byId, edgeEls, ghostEdgeEls, ghostItems, live, chips, moved, movedPtrs } = c;
      const { add, call, pulse, bump, soft, snap } = m;
      const glidePtrs = (at: number) => add(movedPtrs, { x: c.toX, y: c.toY, ease: snap, duration: D * 0.9 }, at);
      const bumpPtr = (name: string, at: number) => {
        const pill = c.el.querySelector<HTMLElement>(`[data-ptr="${name}"] [data-ptr-pill]`);
        add(pill, { scale: 1.25, duration: D * 0.2, ease: "outQuad" }, at);
        add(pill, { scale: 1, duration: D * 0.7, ease: soft }, at + D * 0.2);
      };
      const shaftOf = (g: SVGGElement | undefined) => g?.children[0] as SVGPathElement | undefined;

      // Lines that a step will draw start hidden, so they appear exactly when their step is explained.
      for (const k of new Set(planSteps.flatMap((s) => s.adds))) {
        const g = c.edge(k, false);
        if (g) utils.set(g, { opacity: 0 });
      }
      if (chips.length) utils.set(chips, { opacity: 0.3 });

      /** Plays the pointer steps one after another and returns when the last one ends. */
      const playSteps = (list: Step[], at: number) => {
        list.forEach((st, i) => {
          const t = at + i * D;
          add(chips[i], { opacity: 1, scale: 1.04, duration: D * 0.25, ease: "outQuad" }, t);
          add(chips[i], { scale: 1, duration: D * 0.5, ease: soft }, t + D * 0.25);
          st.removes.forEach((k, j) => {
            const g = c.edge(k, true);
            if (g) m.drop(g, t + j * 50);
          });
          st.adds.forEach((k, j) => {
            const g = c.edge(k, false);
            if (g) m.draw(g, t + j * 50);
          });
          if (st.root) bumpPtr("root", t);
        });
        return at + list.length * D;
      };

      switch (p.kind) {
        case "insert": {
          // the nodes make room, the new node swings out of its parent and lands, the parent pulses as the line is drawn
          const fresh = byId.get(p.id);
          const parentId = data.nodes[p.id]?.parent ?? null;
          const parentEl = parentId ? byId.get(parentId) : null;
          if (fresh) utils.set(fresh, { x: parentEl ? c.tx(parentEl) : c.tx(fresh), y: parentEl ? c.ty(parentEl) : c.ty(fresh), scale: 0.3, opacity: 0 });
          add(moved, { x: c.toX, y: c.toY, ease: snap, duration: D, delay: stagger(30) }, 0);
          glidePtrs(D * 0.2);
          const emerge = D * 0.5;
          add(fresh, { opacity: 1, duration: D * 0.25, ease: "outQuad" }, emerge);
          add(fresh, { x: c.toX, y: c.toY, duration: D, ease: spring({ bounce: 0.38, duration: D }) }, emerge);
          add(fresh, { scale: 1.12, duration: D * 0.5, ease: "outQuad" }, emerge);
          add(fresh, { scale: 1, duration: D * 0.7, ease: soft }, emerge + D * 0.5);
          bump(parentEl, emerge);
          pulse(fresh, INK.green, emerge + D * 0.9);
          playSteps(p.steps, emerge + D * 0.6);
          c.reveal(p.id);
          break;
        }
        case "delete": {
          // the doomed node shakes and hovers, pointers are re-linked around it, it collapses, neighbours settle
          m.tint(ghostItems, INK.red);
          pulse(ghostItems[0], INK.red, 0);
          ghostItems.forEach((g) => m.shake(g, 0));
          add(ghostItems, { scale: 1.08, duration: D * 0.3, ease: "outQuad" }, 0);
          add(ghostItems, { y: (t: unknown) => c.ty(t as HTMLElement) - 20, opacity: 0.6, duration: D * 0.5, ease: soft }, D * 0.3);
          const end = playSteps(p.steps, D * 0.4);
          m.vanish(ghostItems, end);
          add(moved, { x: c.toX, y: c.toY, ease: snap, duration: D * 1.1, delay: stagger(30) }, end + D * 0.3);
          moved.forEach((t) => pulse(t, INK.green, end + D * 1.1));
          glidePtrs(end + D * 0.3);
          break;
        }
        case "rewire": {
          // the subtree lifts off, the pointers change, then it glides to where the new pointers put it
          const moving = p.ids.map((id) => byId.get(id)).filter((e): e is HTMLElement => !!e);
          if (p.what === "detach") m.tint(moving.slice(0, 1), INK.amber);
          add(moving, { scale: 1.1, y: (t: unknown) => c.ty(t as HTMLElement) - 10, duration: D * 0.35, ease: "outQuad" }, 0);
          const end = playSteps(p.steps, D * 0.3);
          if (p.what === "swap") {
            const right = moved.filter((t) => c.tx(t) > (c.before.get(t.dataset.id!)?.[0] ?? c.tx(t)));
            const left = moved.filter((t) => !right.includes(t));
            add(right, { y: (t: unknown) => c.ty(t as HTMLElement) - 30, duration: D * 0.3, ease: "outQuad" }, end);
            add(left, { y: (t: unknown) => c.ty(t as HTMLElement) + 22, duration: D * 0.3, ease: "outQuad" }, end);
            add(moved, { x: c.toX, y: c.toY, ease: snap, duration: D * 1.1, delay: stagger(20) }, end + D * 0.25);
          } else add(moved, { x: c.toX, y: c.toY, ease: snap, duration: D * 1.2, delay: stagger(25) }, end + D * 0.1);
          add(moving, { scale: 1, y: c.toY, duration: D * 0.7, ease: soft }, end + D * 1.2);
          glidePtrs(end + D * 0.1);
          pulse(moving[0], p.what === "detach" ? INK.amber : INK.green, end + D * 1.3);
          break;
        }
        case "update": {
          const t = byId.get(p.id);
          if (t) {
            m.swapText(t.querySelector<HTMLElement>("[data-value]"), fmt(p.oldValue), t.dataset.text ?? "", 0);
            bump(t, D * 0.3);
            pulse(t, INK.accent, D * 0.3);
          }
          break;
        }
        case "read": {
          const t = byId.get(p.id);
          pulse(t, INK.blue, 0);
          pulse(t, INK.blue, D * 0.5);
          bump(t, 0);
          const sel = t?.querySelector<HTMLElement>("[data-sel]");
          if (sel) {
            utils.set(sel, { scale: 1.3, opacity: 0 });
            add(sel, { opacity: 1, scale: 1, duration: D * 0.7, ease: soft }, D * 0.1);
          }
          c.reveal(p.id);
          break;
        }
        case "path": {
          // follows the path you typed from the root, one edge at a time, with a dot running along each line
          const step = D * 0.5;
          p.ids.forEach((id, k) => {
            const t = byId.get(id);
            pulse(t, INK.blue, k * step);
            bump(t, k * step);
            if (k > 0) {
              const g = edgeEls.find((e) => e.dataset.to === id && e.dataset.from === p.ids[k - 1]);
              m.flash(g, INK.blue, k * step - D * 0.3);
              m.travel(g?.children[0] as SVGPathElement | undefined, c.dot, INK.blue, k * step - D * 0.3, step);
            }
          });
          const sel = byId.get(p.ids[p.ids.length - 1])?.querySelector<HTMLElement>("[data-sel]");
          if (sel) {
            utils.set(sel, { scale: 1.3, opacity: 0 });
            add(sel, { opacity: 1, scale: 1, duration: D * 0.7, ease: soft }, (p.ids.length - 1) * step);
          }
          c.reveal(p.ids[p.ids.length - 1]);
          break;
        }
        case "relate": {
          const a = byId.get(p.from);
          pulse(a, INK.blue, 0);
          if (p.to) {
            const b = byId.get(p.to);
            const g = edgeEls.find((e) => (e.dataset.from === p.from && e.dataset.to === p.to) || (e.dataset.from === p.to && e.dataset.to === p.from));
            m.flash(g, INK.blue, D * 0.2);
            m.travel(shaftOf(g), c.dot, INK.blue, D * 0.2, D * 0.6, g?.dataset.from === p.to);
            pulse(b, INK.blue, D * 0.7);
            bump(b, D * 0.7);
          } else m.shake(a, D * 0.2); // NULL: nothing there, so the node shakes "no"
          break;
        }
        case "retype":
          p.ids.forEach((id, i) => pulse(byId.get(id), INK.green, i * D * 0.12));
          break;
        case "clear": {
          m.tint(ghostItems, INK.red);
          ghostEdgeEls.forEach((g, j) => m.drop(g, j * 30));
          add(ghostItems, { opacity: 0, scale: 0.7, y: (t: unknown) => c.ty(t as HTMLElement) - 16, duration: D * 0.7, ease: "inCubic", delay: stagger(45) }, D * 0.1);
          glidePtrs(D * 0.3);
          break;
        }
        case "reset": {
          // the old tree fades out; the new nodes grow in from the top, then every line is drawn
          ghostEdgeEls.forEach((g, j) => m.drop(g, j * 25));
          add(ghostItems, { opacity: 0, scale: 0.8, duration: D * 0.6, ease: "inCubic", delay: stagger(30) }, D * 0.1);
          const start = D * 0.5;
          for (const t of live) utils.set(t, { x: c.tx(t), y: c.ty(t) - 30, opacity: 0, scale: 0.7 });
          add(live, { opacity: 1, duration: D * 0.4, delay: stagger(55), ease: "outQuad" }, start);
          add(live, { y: c.toY, scale: 1, duration: D * 1.1, delay: stagger(55), ease: spring({ bounce: 0.45, duration: D * 1.1 }) }, start);
          const edgesAt = start + live.length * 55 + D * 0.7;
          for (const g of edgeEls) utils.set(g, { opacity: 0 });
          edgeEls.forEach((g, j) => m.draw(g, edgesAt + j * 60, D * 0.5));
          glidePtrs(start);
          break;
        }
        case "restore":
          playRestore(c);
          glidePtrs(0);
          break;
        case "highlight": {
          const t = byId.get(p.id);
          const tint = t?.querySelector<HTMLElement>("[data-tint]");
          if (tint) {
            utils.set(tint, { scaleX: 0 });
            add(tint, { scaleX: [0, 1], duration: D * 0.9, ease: "outCubic" }, 0);
          }
          bump(t, 0);
          break;
        }
        case "markIn": {
          const mk = c.el.querySelector<HTMLElement>(`[data-mark="${p.markId}"]`);
          if (mk) {
            utils.set(mk, { scale: 0.4, opacity: 0, y: -8 });
            add(mk, { opacity: 1, duration: D * 0.3, ease: "outQuad" }, 0);
            add(mk, { scale: 1, y: 0, duration: D, ease: soft }, 0);
          }
          break;
        }
        case "markOut":
          add(c.el.querySelector<HTMLElement>("[data-mark-ghost]"), { scale: 0.4, opacity: 0, y: -8, duration: D * 0.6, ease: "inCubic" }, 0);
          break;
        case "markMove": {
          // the marker flies from the old node to the new one, then settles there
          const ghost = c.el.querySelector<HTMLElement>("[data-mark-ghost]");
          const real = c.el.querySelector<HTMLElement>(`[data-mark="${p.markId}"]`);
          const from = byId.get(p.fromId);
          const to = real?.closest<HTMLElement>("[data-node]");
          if (ghost && from && to) {
            add(ghost, { x: c.cur(to, "x") - c.cur(from, "x"), y: c.cur(to, "y") - c.cur(from, "y"), duration: D * 0.9, ease: snap }, 0);
            add(ghost, { opacity: 0, duration: D * 0.3, ease: "inQuad" }, D * 0.65);
          }
          if (real) {
            utils.set(real, { scale: 0.4, opacity: 0 });
            add(real, { opacity: 1, scale: 1, duration: D * 0.8, ease: soft }, D * 0.6);
          }
          pulse(to, INK.green, D * 0.7);
          break;
        }
        case "arrow": {
          const scope = c.el.querySelector(`[data-aedge][data-id="${p.id}"]`) ?? c.el.querySelector(`[data-arrow-for="${p.id}"]`);
          if (scope) {
            const body = Array.from(scope.querySelectorAll<SVGElement>('[data-draw="shaft"]'));
            const tips = Array.from(scope.querySelectorAll<SVGElement>('[data-draw="head"]'));
            [...body, ...tips].forEach((e) => {
              e.style.strokeDasharray = "1";
              e.style.strokeDashoffset = "1";
            });
            add(body, { strokeDashoffset: [1, 0], duration: D, ease: "outQuad" }, 0);
            add(tips, { strokeDashoffset: [1, 0], duration: D * 0.25, ease: "outQuad" }, D * 0.85);
          }
          break;
        }
        case "dismiss":
          add(Array.from(c.el.querySelectorAll<SVGElement>("[data-aedge-ghost]")), { opacity: 0, duration: D * 0.5, ease: "outQuad" }, 0);
          break;
        case "none":
          break;
      }
    },
  });

  /* ───────────── render ───────────── */
  const edgeG = (e: Edge, l: ReturnType<typeof layoutOf>, ghost: boolean) => {
    const a = boxOf(l, e.from);
    const b = boxOf(l, e.to);
    if (!a || !b) return null;
    return (
      <EdgeG key={`${ghost ? "g-" : ""}${e.key}`} eid={e.key} from={e.from} to={e.to} kind={e.kind} directed geo={edgeCurve(a, b, { directed: true })} label={e.kind === "left" ? "L" : "R"} labelOffset={[e.kind === "left" ? -10 : 10, 0]} ghost={ghost} emphasis={!ghost && pathSet.has(e.from) && pathSet.has(e.to) ? "path" : "none"} />
    );
  };
  const rootNode = data.root ? data.nodes[data.root] : null;
  const empty = data.root === null && data.detached.length === 0;

  return (
    <StageFrame
      hostRef={host}
      label="Tree stage"
      stats={[
        { label: "nodes in the tree", value: String(activeIds(data).length) },
        { label: "height", value: data.root ? String(heightOf(data, data.root)) : "-1" },
        { label: "root", value: rootNode ? `${data.root} · ${fmt(rootNode.value)}` : "NULL", mono: !!rootNode },
        { label: "type", value: TYPE_LABEL[data.type], mono: false },
      ]}
      badge={
        <span className="mb-0.5 inline-flex h-6 items-center gap-1.5 rounded-full border border-primary-foreground/15 px-2.5 text-[11px] text-muted-foreground" title={data.type === "bst" ? "Every node is larger than everything in its left subtree and smaller than everything in its right subtree." : "A binary tree accepts any shape and any values."}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: data.type === "bst" ? INK.green : "#9CA3AF" }} />
          {data.type === "bst" ? "left < node < right holds" : "any shape allowed"}
        </span>
      }
      footer={
        <>
          {/* what the pointers did, one chip per step, lit up as the animation reaches it */}
          <div key={stepsKey} className="flex flex-wrap gap-2 px-6" aria-label="Pointer steps">
            {steps.length === 0 ? (
              <p className="text-xs text-muted-foreground">{last ? "No pointers changed in the last operation." : "Run an operation to see exactly which pointers change."}</p>
            ) : (
              steps.map((st, i) => (
                <span key={i} data-step={i} className="inline-flex items-center gap-1.5 rounded-full border border-primary-foreground/15 px-2.5 py-1 font-mono text-[11px]">
                  <span className="text-muted-foreground">{i + 1}</span>
                  <span>{st.text}</span>
                </span>
              ))
            )}
          </div>
          <p className="flex flex-wrap items-center gap-x-5 gap-y-1 px-6 text-[11px] text-muted-foreground">
            <span>{data.type === "bst" ? "Smaller values go left, larger go right." : "Each node has up to two children: left and right."}</span>
            <span><span style={{ color: INK.accent }}>ROOT</span> top of the tree</span>
            <span><span style={{ color: INK.green }}>⚑ P</span> default mark, <span style={{ color: INK.purple }}>⚑</span> named mark</span>
            <span>Solid blue ring + “selected” = selected node.</span>
            <span>Hover or select a node: its path to the root is drawn in blue and the rest dims.</span>
            <span>L / R: which child.</span>
          </p>
        </>
      }
    >
      <StageBoard label="Tree board" apiRef={api} overlay={<Caption data={caption} />} onBackgroundClick={() => selectedId && selectNode(null)}>
        <div className="relative" style={{ width, height }}>
          {/* depth guides: one faint line per level, so "depth" is visible without a single click */}
          {Array.from({ length: (data.root ? lay.maxDepth : 0) + 1 }, (_, d) => (
            <div key={`lvl${d}`} aria-hidden className="pointer-events-none absolute inset-x-0 border-t border-dashed border-primary-foreground/[0.07]" style={{ top: rowY(d) + T.D / 2 }}>
              <span className="absolute left-1.5 -top-2.5 font-mono text-[9px] text-muted-foreground/70">{`depth ${d}`}</span>
            </div>
          ))}
          {lay.detachedX !== null && <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 bg-primary-foreground/[0.035]" style={{ left: lay.detachedX }} />}
          <svg aria-hidden className="pointer-events-none absolute inset-0 overflow-visible" width={width} height={height}>
            {edgesOf(data).map((e) => edgeG(e, lay, false))}
            {before && prevLay && ghostEdgeKeys.map((k) => edgeG(parseEdgeKey(k), prevLay, true))}
            {data.arrows
              .filter((a) => a.fromId !== null)
              .map((a) => {
                const f = boxOf(lay, a.fromId!);
                const t = boxOf(lay, a.toId);
                const g = f && t ? annotationArc(f, t) : null;
                return (
                  <g key={a.id} data-aedge data-id={a.id} data-from={a.fromId!} data-to={a.toId} style={{ stroke: a.color, transition: COLOR_FADE }} strokeWidth={1.75} fill="none" strokeLinecap="round" strokeDasharray="5 4">
                    <path data-draw="shaft" pathLength={1} d={g?.shaft ?? ""} />
                    <path data-draw="head" pathLength={1} d={g?.wings[0] ?? ""} />
                    <path data-draw="head" pathLength={1} d={g?.wings[1] ?? ""} />
                  </g>
                );
              })}
            {dismissed.map((a) => {
              const l = prevLay ?? lay;
              const f = boxOf(l, a.fromId!);
              const t = boxOf(l, a.toId);
              const g = f && t ? annotationArc(f, t) : null;
              return (
                <g key={`d-${a.id}`} data-aedge-ghost style={{ stroke: a.color }} strokeWidth={1.75} fill="none" strokeLinecap="round" strokeDasharray="5 4">
                  <path d={g?.shaft ?? ""} />
                </g>
              );
            })}
            <circle data-fx-dot r={5} cx={0} cy={0} opacity={0} style={{ filter: "drop-shadow(0 0 4px currentColor)" }} />
          </svg>

          {lay.detachedX !== null && (
            <div aria-hidden className="pointer-events-none absolute bottom-3 top-3 border-l border-dashed border-primary-foreground/25" style={{ left: lay.detachedX }}>
              <span className="absolute left-2 top-0 whitespace-nowrap text-[10px] text-muted-foreground">detached: not part of the tree</span>
            </div>
          )}

          {empty && (
            <>
              <div className="absolute flex items-center justify-center rounded-full border border-dashed border-primary-foreground/25 text-[11px] text-muted-foreground" style={{ left: colX(0), top: rowY(0), width: T.D, height: T.D }}>
                empty
              </div>
              <div className="absolute flex max-w-[280px] flex-col items-start gap-2 text-xs leading-relaxed text-muted-foreground" style={{ left: colX(0) + T.D + 16, top: rowY(0) - 4 }}>
                <p>
                  The tree is empty: the root is NULL. Run <code className="font-mono text-primary-foreground">{data.type === "bst" ? "insert" : "createRoot"}</code> to add the first node.
                </p>
                <button type="button" className={btn} onClick={() => run({ type: "reset" })}>Load starter tree</button>
              </div>
            </>
          )}

          {Object.keys(data.nodes).map((id) => {
            const node = data.nodes[id];
            const box = boxOf(lay, id)!;
            const arrow = data.arrows.find((a) => a.fromId === null && a.toId === id);
            return (
              <NodeDisc
                key={id}
                id={id}
                kind="node"
                text={fmt(node.value)}
                box={box}
                showIds={showIds}
                hl={data.highlights[id]}
                selected={selectedId === id}
                dim={dimOthers && !pathSet.has(id)}
                hot={hover === id}
                marks={data.markers.filter((mk) => mk.nodeId === id).map((mk) => mk.id)}
                ghostMarkId={ghostMark?.nodeId === id ? ghostMark.markId : undefined}
                arrow={arrow ? { id: arrow.id, color: arrow.color } : undefined}
                badge={data.detached.includes(id) ? "detached" : undefined}
                onSelect={selectNode}
                onHover={setHover}
              />
            );
          })}
          {before &&
            prevLay &&
            ghostIds.map((id) => (
              <NodeDisc key={`ghost-${id}`} id={id} kind="node" text={fmt(before.nodes[id].value)} box={boxOf(prevLay, id)!} showIds={showIds} hl={before.highlights[id]} marks={before.markers.filter((mk) => mk.nodeId === id).map((mk) => mk.id)} ghost />
            ))}

          <Pill name="root" x={rootPill[0]} y={rootPill[1]} label="ROOT" color={INK.accent} />
        </div>
      </StageBoard>
    </StageFrame>
  );
}
void cn;

__ALGOFORGE_FILE_d01ef7be188537e5__

mkdir -p apps/web/src/components/visualizers/tree
cat > apps/web/src/components/visualizers/tree/model.ts <<'__ALGOFORGE_FILE_43c695ef7d8e4bc3__'
import type { InitSpec, Primitive, Shape, TNode, TreeState, TreeType } from "./types";
import { bstViolations, placeBst } from "./bst";

/**
 * Pure data model: no DOM, no React, no animation.
 *
 * INVARIANTS (checked by checkInvariants, and tested after every operation):
 *   - every pointer refers to an existing node; child.parent === its parent (parent pointers agree).
 *   - every node has AT MOST ONE parent; no node is its own ancestor (no cycles).
 *   - the root has no parent; detached roots have no parent and are not the root.
 *   - every node belongs to exactly one tree: the active tree or one detached subtree (no orphans).
 *   - BST type: strict ordering, one key type, no duplicates (see bst.ts).
 *   - markers, highlights and arrows only refer to existing nodes.
 */
export const MAX_NODES = 15;
export const MAX_PATH = 12;
export const TREE_ID = "T";
export const ARROW_DEFAULT_COLOR = "#0070F3";
/** Exact shape, valid as a Binary Tree AND as a BST, so switching type works out of the box. */
export const STARTER_SHAPE: Shape = {
    value: 10,
    left: { value: 5, left: { value: 3, left: null, right: null }, right: { value: 7, left: null, right: null } },
    right: { value: 15, left: null, right: { value: 20, left: null, right: null } },
};
export const STARTER_VALUES: readonly Primitive[] = [10, 5, 15, 3, 7, 20];
export const TYPE_LABEL: Record<TreeType, string> = { binary: "Binary tree", bst: "Binary search tree" };
export const DEFAULT_MARK = "P";

export const lengthOf = (s: TreeState) => Object.keys(s.nodes).length;

/** Preorder ids of the subtree under `id`. Bounded by the node count, so a corrupt tree cannot loop forever. */
export function subtreeIds(s: Pick<TreeState, "nodes">, id: string): string[] {
    const out: string[] = [];
    const seen = new Set<string>();
    const stack = [id];
    const cap = Object.keys(s.nodes).length;
    while (stack.length && out.length < cap) {
        const cur = stack.pop()!;
        if (seen.has(cur) || !s.nodes[cur]) continue;
        seen.add(cur);
        out.push(cur);
        const n = s.nodes[cur];
        if (n.right) stack.push(n.right);
        if (n.left) stack.push(n.left);
    }
    return out;
}
export const activeIds = (s: TreeState) => (s.root ? subtreeIds(s, s.root) : []);

/** Root of the (active or detached) tree that contains this node. */
export function treeRootOf(s: Pick<TreeState, "nodes">, id: string): string {
    let cur = id;
    for (let guard = 0; s.nodes[cur]?.parent && guard <= Object.keys(s.nodes).length; guard++) cur = s.nodes[cur].parent!;
    return cur;
}
export const isActive = (s: TreeState, id: string) => s.root !== null && treeRootOf(s, id) === s.root;

/** Edges from the root of its own tree down to the node. */
export function depthOf(s: Pick<TreeState, "nodes">, id: string): number {
    let d = 0;
    let cur = id;
    for (let guard = 0; s.nodes[cur]?.parent && guard <= Object.keys(s.nodes).length; guard++) {
        cur = s.nodes[cur].parent!;
        d++;
    }
    return d;
}
/** Height in edges: a leaf is 0 and an empty tree is -1. */
export function heightOf(s: Pick<TreeState, "nodes">, id: string | null, guard = 0): number {
    if (id === null || !s.nodes[id] || guard > Object.keys(s.nodes).length) return -1;
    const n = s.nodes[id];
    return 1 + Math.max(heightOf(s, n.left, guard + 1), heightOf(s, n.right, guard + 1));
}
export const degreeOf = (s: Pick<TreeState, "nodes">, id: string) => (s.nodes[id].left ? 1 : 0) + (s.nodes[id].right ? 1 : 0);
/** True when `a` is `b` or one of b's ancestors. */
export function isAncestorOrSelf(s: Pick<TreeState, "nodes">, a: string, b: string): boolean {
    let cur: string | null = b;
    for (let guard = 0; cur !== null && guard <= Object.keys(s.nodes).length; guard++) {
        if (cur === a) return true;
        cur = s.nodes[cur]?.parent ?? null;
    }
    return false;
}

export function emptyTree(type: TreeType): TreeState {
    return { type, nodes: {}, root: null, detached: [], markers: [], highlights: {}, arrows: [] };
}

/** The default Mark P sits on the root. */
export function withDefaultMark(s: TreeState): TreeState {
    return s.root && !s.markers.some((m) => m.id === DEFAULT_MARK) ? { ...s, markers: [...s.markers, { id: DEFAULT_MARK, nodeId: s.root }] } : s;
}

/** Builds a whole tree from scratch, so its ids are n1, n2, … (the old tree is gone entirely). */
function fromShape(type: TreeType, shape: Shape | null): TreeState {
    const s = emptyTree(type);
    let counter = 1;
    const build = (sh: Shape | null, parent: string | null): string | null => {
        if (!sh) return null;
        const id = `n${counter++}`;
        s.nodes[id] = { id, value: sh.value, left: null, right: null, parent };
        s.nodes[id].left = build(sh.left, id);
        s.nodes[id].right = build(sh.right, id);
        return id;
    };
    s.root = build(shape, null);
    return s;
}

/** Binary tree: values fill the tree level by level, left to right. BST: each value is inserted by the ordering rule. */
function fromValues(type: TreeType, values: readonly Primitive[]): { state: TreeState; error?: string } {
    if (type === "binary") {
        const shapeAt = (i: number): Shape | null => (i < values.length ? { value: values[i], left: shapeAt(2 * i + 1), right: shapeAt(2 * i + 2) } : null);
        return { state: fromShape(type, shapeAt(0)) };
    }
    const s = emptyTree(type);
    for (let i = 0; i < values.length; i++) {
        const v = values[i];
        const id = `n${i + 1}`;
        if (s.root === null) {
            if (bstViolations({ nodes: { [id]: { id, value: v, left: null, right: null, parent: null } }, root: id, detached: [] }).length)
                return { state: s, error: `value ${i} (${JSON.stringify(v)}) cannot be placed in a BST: only numbers or strings can be ordered` };
            s.nodes[id] = { id, value: v, left: null, right: null, parent: null };
            s.root = id;
        } else {
            const p = placeBst(s.nodes, s.root, v);
            if ("error" in p) return { state: s, error: `value ${i}: ${p.error}` };
            if ("duplicate" in p) return { state: s, error: `value ${i} (${JSON.stringify(v)}) is a duplicate of ${p.duplicate}: a BST stores each value once` };
            s.nodes[id] = { id, value: v, left: null, right: null, parent: p.parent };
            s.nodes[p.parent] = { ...s.nodes[p.parent], [p.side]: id };
        }
    }
    return { state: s };
}

export function buildTree(type: TreeType, spec: InitSpec): { state: TreeState; error?: string } {
    const built = spec.kind === "shape" ? { state: fromShape(type, spec.root) } : fromValues(type, spec.values);
    if (built.error) return built;
    if (type === "bst") {
        const bad = bstViolations(built.state);
        if (bad.length) return { state: built.state, error: `that shape is not a valid BST: ${bad[0]}` };
    }
    return { state: withDefaultMark(built.state) };
}

/** With no values, builds the starter tree. With values: a Binary Tree is filled level by level, a BST is inserted one by one. */
export const createTree = (type: TreeType, values?: readonly Primitive[]): TreeState =>
    buildTree(type, values ? { kind: "values", values: [...values] } : { kind: "shape", root: STARTER_SHAPE }).state;

/* ───────────── invariants ───────────── */

export function checkInvariants(s: TreeState): string[] {
    const bad: string[] = [];
    const ids = Object.keys(s.nodes);
    const parentCount: Record<string, number> = {};
    for (const id of ids) {
        const n = s.nodes[id];
        if (n.id !== id) bad.push(`node key ${id} does not match its id`);
        for (const side of ["left", "right"] as const) {
            const c = n[side];
            if (c === null) continue;
            if (!s.nodes[c]) bad.push(`${id}.${side} points at missing node ${c}`);
            else {
                parentCount[c] = (parentCount[c] ?? 0) + 1;
                if (s.nodes[c].parent !== id) bad.push(`${c}.parent is ${s.nodes[c].parent}, expected ${id}`);
            }
            if (c === id) bad.push(`${id} is its own ${side} child`);
        }
        if (n.left !== null && n.left === n.right) bad.push(`${id} has the same node as left and right child`);
        if (n.parent !== null && !s.nodes[n.parent]) bad.push(`${id}.parent points at missing node ${n.parent}`);
    }
    for (const id of ids) {
        if ((parentCount[id] ?? 0) > 1) bad.push(`${id} has ${parentCount[id]} parents`);
        if ((parentCount[id] ?? 0) === 0 && s.nodes[id].parent !== null) bad.push(`${id}.parent is set but no node points down to it`);
    }
    if (s.root !== null) {
        if (!s.nodes[s.root]) bad.push("root is not a node");
        else if (s.nodes[s.root].parent !== null) bad.push("root must not have a parent");
    }
    const roots = [...(s.root !== null ? [s.root] : []), ...s.detached];
    if (new Set(roots).size !== roots.length) bad.push("a tree root is listed twice");
    for (const d of s.detached) {
        if (!s.nodes[d]) bad.push(`detached root ${d} is not a node`);
        else if (s.nodes[d].parent !== null) bad.push(`detached root ${d} still has a parent`);
    }
    // every node belongs to exactly one tree, and no tree contains a cycle
    const owner = new Map<string, string>();
    for (const r of roots) {
        if (!s.nodes[r]) continue;
        const seen = new Set<string>();
        const stack = [r];
        while (stack.length) {
            const cur = stack.pop()!;
            if (seen.has(cur)) {
                bad.push(`cycle: ${cur} is reached twice from ${r}`);
                break;
            }
            seen.add(cur);
            if (owner.has(cur)) bad.push(`${cur} is in two trees`);
            owner.set(cur, r);
            const n = s.nodes[cur];
            if (!n) continue;
            if (n.left) stack.push(n.left);
            if (n.right) stack.push(n.right);
        }
    }
    for (const id of ids) if (!owner.has(id)) bad.push(`${id} is orphaned: it is in no tree`);
    if (s.type === "bst") bad.push(...bstViolations(s));
    for (const m of s.markers) if (!s.nodes[m.nodeId]) bad.push(`marker ${m.id} points at a missing node`);
    if (new Set(s.markers.map((m) => m.id)).size !== s.markers.length) bad.push("two markers share a name");
    for (const id of Object.keys(s.highlights)) if (!s.nodes[id]) bad.push(`highlight on missing node ${id}`);
    for (const a of s.arrows) if (!s.nodes[a.toId] || (a.fromId !== null && !s.nodes[a.fromId])) bad.push(`arrow ${a.id} points at a missing node`);
    return bad;
}

/* ───────────── edges: the lines the stage draws ───────────── */

export interface Edge {
    key: string; // "parent>child:left"
    from: string;
    to: string;
    kind: "left" | "right";
}
export const edgeKey = (from: string, to: string, kind: "left" | "right") => `${from}>${to}:${kind}`;
export function parseEdgeKey(key: string): Edge {
    const [pair, kind] = key.split(":");
    const [from, to] = pair.split(">");
    return { key, from, to, kind: kind as "left" | "right" };
}
/** Every child pointer that is set. A missing child has no line. */
export function edgesOf(s: Pick<TreeState, "nodes">): Edge[] {
    const out: Edge[] = [];
    for (const id of Object.keys(s.nodes)) {
        const n = s.nodes[id];
        if (n.left) out.push({ key: edgeKey(id, n.left, "left"), from: id, to: n.left, kind: "left" });
        if (n.right) out.push({ key: edgeKey(id, n.right, "right"), from: id, to: n.right, kind: "right" });
    }
    return out;
}

const fmt = (v: Primitive) => JSON.stringify(v);
function nest(s: TreeState, id: string | null, guard = 0): string {
    if (id === null || !s.nodes[id] || guard > 40) return "·";
    const n = s.nodes[id];
    return !n.left && !n.right ? fmt(n.value) : `${fmt(n.value)} (${nest(s, n.left, guard + 1)}, ${nest(s, n.right, guard + 1)})`;
}
/** One-line description used by the Before / After summaries. */
export function describe(s: TreeState): string {
    const count = activeIds(s).length;
    const head = `nodes ${count}${s.detached.length ? ` + ${lengthOf(s) - count} detached` : ""} · ${s.root ? `root ${fmt(s.nodes[s.root].value)}` : "empty"}`;
    const body = s.root ? nest(s, s.root) : "(empty tree)";
    const det = s.detached.map((d) => `detached: ${nest(s, d)}`).join("\n");
    return `${head}\n${body}${det ? `\n${det}` : ""}`;
}

/** Follow an L/R path from the root. Returns the ids visited (root first) and how far it got. */
export function walkPath(s: TreeState, path: string): { ids: string[]; missingAt: number | null } {
    const ids: string[] = [];
    let cur = s.root;
    if (cur === null) return { ids, missingAt: 0 };
    ids.push(cur);
    for (let i = 0; i < path.length; i++) {
        const next: string | null = s.nodes[cur!][path[i] === "L" ? "left" : "right"];
        if (next === null) return { ids, missingAt: i };
        ids.push(next);
        cur = next;
    }
    return { ids, missingAt: null };
}
export const pathOf = (s: TreeState, id: string): string => {
    let out = "";
    let cur = id;
    for (let guard = 0; s.nodes[cur]?.parent && guard <= lengthOf(s); guard++) {
        const p = s.nodes[s.nodes[cur].parent!];
        out = (p.left === cur ? "L" : "R") + out;
        cur = p.id;
    }
    return out;
};

__ALGOFORGE_FILE_43c695ef7d8e4bc3__

mkdir -p apps/web/src/components/visualizers/ui
cat > apps/web/src/components/visualizers/ui/ScriptDrawer.tsx <<'__ALGOFORGE_FILE_67fbbf270125b9a9__'
"use client";
import { useCallback, useEffect, useRef, useState, type ComponentType } from "react";
import type { StoreApi } from "zustand/vanilla";
import { cn } from "@/lib/utils";
import type { Diagnostic } from "../core/types";
import { visualizer } from "../engine/instance";
import type { VisualizerStore } from "../engine/store";
import { compileScript } from "../script/compile";
import { EXAMPLES } from "../script/examples";
import { applyFix } from "../script/fixes";
import { countBySeverity } from "../script/markers";
import { loadScript, saveScript } from "../script/storage";
import { btn, btnPrimary, inputCls } from "../shared/styles";
import type { EditorHandle, ScriptEditorProps } from "./ScriptEditor";

interface Props {
    /** Pass LazyScriptEditor in the app. Tests pass a plain textarea. */
    editor: ComponentType<ScriptEditorProps>;
    store?: StoreApi<VisualizerStore>;
    dark?: boolean;
    defaultOpen?: boolean;
}

const LINT_MS = 300;
const SAVE_MS = 400;
const dot: Record<Diagnostic["severity"], string> = { error: "bg-destructive", warning: "bg-amber-500", info: "bg-sky-500" };

/**
 * Script drawer: a JSON editor with problems, quick fixes, examples and Run.
 * Typing only lints (the canvas does not rebuild); Run (button or Ctrl/Cmd+Enter) loads the script into the one visualizer store.
 */
export function ScriptDrawer({ editor: Editor, store = visualizer, dark = true, defaultOpen = false }: Props) {
    const [open, setOpen] = useState(defaultOpen);
    const [text, setText] = useState("");
    const [diagnostics, setDiagnostics] = useState<Diagnostic[]>([]);
    const [ran, setRan] = useState<{ ok: boolean; steps: number } | null>(null);
    const textRef = useRef(text);
    textRef.current = text;
    const handle = useRef<EditorHandle | null>(null);
    const hydrated = useRef(false);
    const onReady = useCallback((h: EditorHandle) => {
        handle.current = h;
    }, []);

    const runText = useCallback(
        (t: string) => {
            const c = compileScript(t);
            store.getState().load(c);
            setDiagnostics(c.diagnostics);
            setRan({ ok: c.ok, steps: c.frames.length });
        },
        [store],
    );
    const run = useCallback(() => runText(textRef.current), [runText]);

    // Restore the last script. If nothing is loaded yet, show it on the canvas straight away.
    useEffect(() => {
        const saved = loadScript();
        if (saved && saved.trim() !== "") {
            setText(saved);
            if (store.getState().compiled === null) runText(saved);
        }
        hydrated.current = true;
    }, [store, runText]);

    useEffect(() => {
        if (!hydrated.current) return;
        const id = setTimeout(() => saveScript(text), SAVE_MS);
        return () => clearTimeout(id);
    }, [text]);

    // Live validation only lints; it never rebuilds the canvas.
    useEffect(() => {
        const id = setTimeout(() => setDiagnostics(text.trim() === "" ? [] : compileScript(text).diagnostics), LINT_MS);
        return () => clearTimeout(id);
    }, [text]);

    // Ctrl/Cmd+Enter outside the editor (inside it, the editor's own command handles it).
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== "Enter" || !(e.ctrlKey || e.metaKey)) return;
            if ((e.target as HTMLElement | null)?.closest?.(".monaco-editor")) return;
            e.preventDefault();
            run();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, run]);

    const loadExample = (id: string) => {
        const ex = EXAMPLES.find((x) => x.id === id);
        if (!ex) return;
        setText(ex.script);
        runText(ex.script);
    };
    const fix = (d: Diagnostic) => {
        const next = applyFix(textRef.current, d);
        if (next !== null) setText(next);
    };

    const { errors, warnings } = countBySeverity(diagnostics);
    const blank = text.trim() === "";

    return (
        <section aria-label="Script" className="flex flex-col gap-3 rounded-2xl border border-primary-foreground/10 bg-card/50 p-3">
            <div className="flex flex-wrap items-center gap-2">
                <button type="button" className={cn(btn, "font-semibold")} aria-expanded={open} aria-controls="script-body" onClick={() => setOpen((o) => !o)}>
                    Script {open ? "▾" : "▸"}
                </button>
                <label className="sr-only" htmlFor="script-examples">
                    Examples
                </label>
                <select id="script-examples" className={cn(inputCls, "h-8 w-auto py-0")} value="" onChange={(e) => loadExample(e.target.value)}>
                    <option value="">Examples…</option>
                    {EXAMPLES.map((x) => (
                        <option key={x.id} value={x.id} title={x.description}>
                            {x.title}
                        </option>
                    ))}
                </select>
                <button type="button" className={btnPrimary} onClick={run} aria-keyshortcuts="Control+Enter Meta+Enter" title="Run (Ctrl/Cmd+Enter)">
                    Run
                </button>
                <span role="status" aria-live="polite" className={cn("ml-auto text-xs", errors > 0 || (ran && !ran.ok) ? "text-destructive" : "text-muted-foreground")}>
                    {errors > 0 ? `${errors} error${errors === 1 ? "" : "s"}` : ran?.ok ? `Ready · ${ran.steps} step${ran.steps === 1 ? "" : "s"}` : ""}
                    {warnings > 0 ? `${errors > 0 ? " · " : ""}${warnings} warning${warnings === 1 ? "" : "s"}` : ""}
                </span>
            </div>

            {open && (
                <div id="script-body" className="flex flex-col gap-3">
                    {blank && (
                        <div data-empty className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-primary-foreground/20 p-3 text-sm text-muted-foreground">
                            <span>No script yet. Pick an example, or start from a sample.</span>
                            <button type="button" className={btn} onClick={() => loadExample(EXAMPLES[0].id)}>
                                Load sample
                            </button>
                        </div>
                    )}
                    <div className="h-72 overflow-hidden rounded-xl border border-primary-foreground/10">
                        <Editor value={text} onChange={setText} onRun={run} diagnostics={diagnostics} dark={dark} onReady={onReady} />
                    </div>

                    <div aria-label="Problems" className="flex flex-col gap-1">
                        <h3 className="text-xs font-semibold">Problems {diagnostics.length > 0 ? `(${diagnostics.length})` : ""}</h3>
                        {diagnostics.length === 0 ? (
                            <p className="text-xs text-muted-foreground">No problems.</p>
                        ) : (
                            <ul className="flex max-h-40 flex-col overflow-y-auto">
                                {diagnostics.map((d, i) => (
                                    <li key={i} data-problem={d.severity} className="flex items-start gap-2 border-b border-primary-foreground/10 py-1.5 text-xs last:border-0">
                                        <span aria-label={d.severity} className={cn("mt-1 h-1.5 w-1.5 shrink-0 rounded-full", dot[d.severity])} />
                                        <button type="button" className="min-w-0 flex-1 text-left outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary-foreground/20" onClick={() => handle.current?.reveal(d.line, d.column)}>
                                            <span className="font-mono text-muted-foreground">
                                                {d.line}:{d.column}
                                            </span>{" "}
                                            {d.message}
                                        </button>
                                        {d.fix && (
                                            <button type="button" className={cn(btn, "h-6 shrink-0 px-2 text-xs")} onClick={() => fix(d)}>
                                                {d.fix.label}
                                            </button>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            )}
        </section>
    );
}

__ALGOFORGE_FILE_67fbbf270125b9a9__

mkdir -p apps/web/src/components/visualizers/ui
cat > apps/web/src/components/visualizers/ui/ScriptEditor.tsx <<'__ALGOFORGE_FILE_0407aecdc95960cc__'
"use client";
import Editor, { type BeforeMount, type OnMount } from "@monaco-editor/react";
import type * as Monaco from "monaco-editor";
import { useCallback, useEffect, useRef } from "react";
import { registerCustomTheme } from "@/components/CodeEditor/lib/monacoTheme";
import type { Diagnostic } from "../core/types";
import { toMarkers } from "../script/markers";
import { buildScriptSchema } from "../script/schema";

export interface EditorHandle {
    /** Scroll to a position, put the cursor there and focus the editor. */
    reveal(line: number, column: number): void;
}

export interface ScriptEditorProps {
    value: string;
    onChange(value: string): void;
    onRun(): void;
    diagnostics: readonly Diagnostic[];
    dark: boolean;
    onReady(handle: EditorHandle): void;
}

const MODEL_URI = "inmemory://algoforge/script.json";
const SCHEMA_URI = "inmemory://algoforge/script.schema.json";
const OWNER = "algoforge";

/** The JSON language API moved between Monaco versions, so it is reached through a minimal shape. */
interface JsonDefaults {
    setDiagnosticsOptions(o: {
        validate: boolean;
        allowComments: boolean;
        enableSchemaRequest: boolean;
        schemas: { uri: string; fileMatch: string[]; schema: object }[];
    }): void;
}
interface JsonApi {
    jsonDefaults?: JsonDefaults;
}
function jsonApi(monaco: typeof Monaco): JsonApi | undefined {
    const m = monaco as unknown as {
        json?: JsonApi;
        languages: { json?: JsonApi };
    };
    return m.languages.json ?? m.json;
}

/** Monaco in JSON mode: autocomplete and hover from the generated schema, markers and quick fixes from the compiler. */
export function ScriptEditor({
    value,
    onChange,
    onRun,
    diagnostics,
    dark,
    onReady,
}: ScriptEditorProps) {
    const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
    const monacoRef = useRef<typeof Monaco | null>(null);
    const diagRef = useRef(diagnostics);
    diagRef.current = diagnostics;
    const runRef = useRef(onRun);
    runRef.current = onRun;
    const disposables = useRef<Monaco.IDisposable[]>([]);

    const applyMarkers = useCallback(() => {
        const monaco = monacoRef.current;
        const model = editorRef.current?.getModel();
        if (monaco && model)
            monaco.editor.setModelMarkers(
                model,
                OWNER,
                toMarkers(diagRef.current),
            );
    }, []);

    const beforeMount: BeforeMount = useCallback((monaco) => {
        registerCustomTheme(monaco);
        // validate:false keeps autocomplete and hover but leaves error reporting to our compiler, so nothing is flagged twice.
        jsonApi(monaco)?.jsonDefaults?.setDiagnosticsOptions({
            validate: false,
            allowComments: false,
            enableSchemaRequest: false,
            schemas: [
                {
                    uri: SCHEMA_URI,
                    fileMatch: [MODEL_URI],
                    schema: buildScriptSchema(),
                },
            ],
        });
    }, []);

    const onMount: OnMount = useCallback(
        (editor, monaco) => {
            editorRef.current = editor;
            monacoRef.current = monaco;
            editor.addCommand(
                monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter,
                () => runRef.current(),
            );
            disposables.current.push(
                monaco.languages.registerCodeActionProvider("json", {
                    provideCodeActions(
                        model: Monaco.editor.ITextModel,
                        range: Monaco.Range,
                    ): Monaco.languages.CodeActionList {
                        if (
                            model.uri.toString() !==
                            monaco.Uri.parse(MODEL_URI).toString()
                        )
                            return { actions: [], dispose: () => {} };
                        const actions: Monaco.languages.CodeAction[] =
                            diagRef.current
                                .filter(
                                    (d) =>
                                        d.fix &&
                                        d.line <= range.endLineNumber &&
                                        d.endLine >= range.startLineNumber,
                                )
                                .map((d) => ({
                                    title: d.fix!.label,
                                    kind: "quickfix",
                                    isPreferred: true,
                                    edit: {
                                        edits: [
                                            {
                                                resource: model.uri,
                                                versionId: model.getVersionId(),
                                                textEdit: {
                                                    range: {
                                                        startLineNumber: d.line,
                                                        startColumn: d.column,
                                                        endLineNumber:
                                                            d.endLine,
                                                        endColumn: d.endColumn,
                                                    },
                                                    text: d.fix!.replacement,
                                                },
                                            },
                                        ],
                                    },
                                }));
                        return { actions, dispose: () => {} };
                    },
                }),
            );
            onReady({
                reveal(line, column) {
                    editor.revealLineInCenter(line);
                    editor.setPosition({ lineNumber: line, column });
                    editor.focus();
                },
            });
            applyMarkers();
        },
        [applyMarkers, onReady],
    );

    useEffect(applyMarkers, [diagnostics, applyMarkers]);
    useEffect(() => {
        const ds = disposables.current;
        return () => ds.forEach((d) => d.dispose());
    }, []);

    return (
        <Editor
            height="100%"
            language="json"
            path={MODEL_URI}
            value={value}
            theme={dark ? "warm-dark" : "vs"}
            beforeMount={beforeMount}
            onMount={onMount}
            onChange={(v) => onChange(v ?? "")}
            options={{
                minimap: { enabled: false },
                fontSize: 13,
                tabSize: 2,
                insertSpaces: true,
                automaticLayout: true,
                scrollBeyondLastLine: false,
                wordWrap: "on",
                lineNumbersMinChars: 3,
                renderLineHighlight: "gutter",
                padding: { top: 10, bottom: 10 },
            }}
            loading={null}
        />
    );
}

__ALGOFORGE_FILE_0407aecdc95960cc__

echo "All AlgoForge lint files restored successfully."
