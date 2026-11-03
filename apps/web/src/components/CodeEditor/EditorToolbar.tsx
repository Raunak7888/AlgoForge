// filepath: src/components/CodeEditor/EditorToolbar.tsx
"use client";

import React from "react";
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
