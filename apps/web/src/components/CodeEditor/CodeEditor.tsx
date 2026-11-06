// filepath: src/components/CodeEditor/CodeEditor.tsx
"use client";

import React, {
    useCallback,
    useEffect,
    useRef,
    useState,
    useMemo,
} from "react";
import { motion } from "framer-motion";
import { gsap } from "gsap";
import type { OnMount, BeforeMount } from "@monaco-editor/react";
import type * as Monaco from "monaco-editor";
import dynamic from "next/dynamic";
import { CodeEditorProps, Language } from "./types";
import { EditorToolbar } from "./EditorToolbar";
import { EditorStatusBar } from "./EditorStatusBar";
import { registerCustomTheme } from "./lib/monacoTheme";
import { registerPythonProvider } from "./lib/pythonProvider";
import { formatCode } from "./lib/formatters";
import { resolveMonoFontFamily } from "@/lib/fonts";
import { prefersReducedMotion } from "@/lib/reducedMotion";
import styles from "./CodeEditor.module.css";

const MonacoEditor = dynamic(
    async () => {
        const { default: Editor } = await import("@monaco-editor/react");
        return { default: Editor };
    },
    {
        ssr: false,
        loading: () => (
            <div
                className={styles.editorSkeleton}
                aria-busy
                aria-label="Loading editor"
            >
                <div className={styles.skeletonLine} style={{ width: "60%" }} />
                <div className={styles.skeletonLine} style={{ width: "82%" }} />
                <div className={styles.skeletonLine} style={{ width: "43%" }} />
                <div className={styles.skeletonLine} style={{ width: "71%" }} />
                <div className={styles.skeletonLine} style={{ width: "55%" }} />
                <div className={styles.skeletonLine} style={{ width: "91%" }} />
                <div className={styles.skeletonLine} style={{ width: "66%" }} />
            </div>
        ),
    },
);

let pythonProviderRegistered = false;

export const CodeEditor: React.FC<CodeEditorProps> = ({
    value,
    defaultValue,
    language: initialLanguage = "javascript",
    onChange,
    onLanguageChange,
    readOnly = false,
    // Default '100%' → fills parent via CSS flex; pass an explicit px/number
    // value to override (e.g. height={520} or height="400px").
    height = "100%",
    className,
}: {
    value?: string;
    defaultValue?: Record<Language, string>;
    language?: Language;
    onChange?: (value: string) => void;
    onLanguageChange?: (language: Language) => void;
    readOnly?: boolean;
    height?: number | string;
    className?: string;
}) => {
    const [internalLanguage, setInternalLanguage] = useState<Language>(initialLanguage);
    // Controlled by the parent when it passes onLanguageChange; otherwise the editor owns it.
    const language: Language = onLanguageChange ? initialLanguage : internalLanguage;
    const setLanguage = onLanguageChange ?? setInternalLanguage;
    const [isFormatting, setIsFormatting] = useState(false);
    const [isCopied, setIsCopied] = useState(false);
    const [isEditorReady, setIsEditorReady] = useState(false);
    const monoFont = useMemo(() => resolveMonoFontFamily(), []);

    const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
    const monacoRef = useRef<typeof Monaco | null>(null);
    const disposables = useRef<Monaco.IDisposable[]>([]);
    const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    // Stable ref so handleEditorMount (empty-dep) always calls latest handleFormat.
    const handleFormatRef = useRef<() => Promise<void>>(async () => {});

    // Refs for GSAP-animated orbs
    const orb1Ref = useRef<HTMLDivElement>(null);
    const orb2Ref = useRef<HTMLDivElement>(null);

    const isControlled = value !== undefined;
    const [internalValue, setInternalValue] = useState<string>(
        () => defaultValue?.[initialLanguage] ?? "",
    );
    const currentValue = isControlled ? value : internalValue;

    // ─── GSAP: floating ambient orbs ─────────────────────────────────
    useEffect(() => {
        const o1 = orb1Ref.current;
        const o2 = orb2Ref.current;
        if (!o1 || !o2 || prefersReducedMotion()) return;

        const t1 = gsap.to(o1, {
            x: 28,
            y: -22,
            duration: 5.5,
            repeat: -1,
            yoyo: true,
            ease: "sine.inOut",
        });
        const t2 = gsap.to(o2, {
            x: -24,
            y: 28,
            duration: 7,
            repeat: -1,
            yoyo: true,
            ease: "sine.inOut",
            delay: 1.8,
        });

        return () => {
            t1.kill();
            t2.kill();
        };
    }, []);

    // Sync readOnly changes without re-mounting
    useEffect(() => {
        editorRef.current?.updateOptions({ readOnly });
    }, [readOnly]);

    // Sync language changes
    useEffect(() => {
        if (!editorRef.current || !monacoRef.current) return;
        const model = editorRef.current.getModel();
        if (model) {
            monacoRef.current.editor.setModelLanguage(
                model,
                language === "javascript" ? "javascript" : "python",
            );
        }
    }, [language]);

    const handleBeforeMount: BeforeMount = useCallback((monaco) => {
        registerCustomTheme(monaco);

        if (!pythonProviderRegistered) {
            registerPythonProvider(monaco);
            pythonProviderRegistered = true;
        }

        monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
            noSemanticValidation: true,
            noSyntaxValidation: false,
            noSuggestionDiagnostics: true,
        });
        monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
            target: monaco.languages.typescript.ScriptTarget.ESNext,
            allowNonTsExtensions: true,
            allowJs: true,
            checkJs: false,
            noEmit: true,
            noResolve: true,
        });
    }, []);

    const handleEditorMount: OnMount = useCallback((editor, monaco) => {
        editorRef.current = editor;
        monacoRef.current = monaco;
        setIsEditorReady(true);
        // Re-measure once the web font has really loaded, so cursor and selection line up.
        void document.fonts?.ready.then(() => monaco.editor.remeasureFonts());

        editor.addCommand(
            monaco.KeyMod.Alt | monaco.KeyMod.Shift | monaco.KeyCode.KeyF,
            () => void handleFormatRef.current(),
        );

        editor.onDidChangeCursorSelection(() => {
            const sel = editor.getSelection();
            const hasSelection =
                sel !== null &&
                (sel.startLineNumber !== sel.endLineNumber ||
                    sel.startColumn !== sel.endColumn);
            editor
                .getDomNode()
                ?.classList.toggle("has-selection", hasSelection);
        });

        const ro = new ResizeObserver(() => editor.layout());
        const container = editor.getDomNode()?.parentElement;
        if (container) ro.observe(container);
        disposables.current.push({ dispose: () => ro.disconnect() });
    }, []);

    const handleFormat = useCallback(async () => {
        const editor = editorRef.current;
        if (!editor) return;
        setIsFormatting(true);
        try {
            const raw = editor.getValue();
            const formatted = await formatCode(raw, language);
            const position = editor.getPosition();
            editor.setValue(formatted);
            if (position) editor.setPosition(position);
            editor.revealPositionInCenter(editor.getPosition()!);
            if (!isControlled) setInternalValue(formatted);
            onChange?.(formatted);
        } catch (err) {
            console.error("[CodeEditor] Format error:", err);
        } finally {
            setIsFormatting(false);
        }
    }, [isControlled, language, onChange]);

    useEffect(() => {
        handleFormatRef.current = handleFormat;
    }, [handleFormat]);

    const handleCopy = useCallback(async () => {
        const text = editorRef.current?.getValue() ?? currentValue ?? "";
        try {
            await navigator.clipboard.writeText(text);
        } catch {
            const ta = document.createElement("textarea");
            ta.value = text;
            ta.style.cssText = "position:fixed;opacity:0;";
            document.body.appendChild(ta);
            ta.focus();
            ta.select();
            document.execCommand("copy");
            document.body.removeChild(ta);
        }
        setIsCopied(true);
        if (copyTimer.current) clearTimeout(copyTimer.current);
        copyTimer.current = setTimeout(() => setIsCopied(false), 2000);
    }, [currentValue]);

    const handleLanguageChange = useCallback(
        (lang: Language) => {
            setLanguage(lang);
            if (!isControlled) setInternalValue(defaultValue?.[lang] ?? "");
        },
        [defaultValue, isControlled, setLanguage],
    );

    const handleChange = useCallback(
        (val: string | undefined) => {
            const v = val ?? "";
            if (!isControlled) setInternalValue(v);
            onChange?.(v);
        },
        [isControlled, onChange],
    );

    // Cleanup
    useEffect(() => {
        const ds = disposables.current;
        return () => {
            ds.forEach((d) => d.dispose());
            if (copyTimer.current) clearTimeout(copyTimer.current);
        };
    }, []);

    const editorOptions =
        useMemo<Monaco.editor.IStandaloneEditorConstructionOptions>(
            () => ({
                readOnly,
                fontSize: 13.5,
                fontFamily: monoFont,
                fontLigatures: true,
                lineHeight: 22,
                letterSpacing: 0.3,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                padding: { top: 20, bottom: 20 },
                lineNumbers: "on",
                lineNumbersMinChars: 3,
                glyphMargin: true,
                folding: true,
                foldingHighlight: true,
                lineDecorationsWidth: 6,
                renderLineHighlight: "gutter",
                cursorBlinking: "phase",
                cursorSmoothCaretAnimation: "on",
                cursorStyle: "line",
                cursorWidth: 2,
                smoothScrolling: true,
                contextmenu: true,
                suggestOnTriggerCharacters: true,
                quickSuggestions: {
                    other: true,
                    comments: false,
                    strings: true,
                },
                quickSuggestionsDelay: 100,
                wordBasedSuggestions: "allDocuments",
                parameterHints: { enabled: true, cycle: true },
                formatOnPaste: false,
                formatOnType: false,
                autoClosingBrackets: "languageDefined",
                autoClosingQuotes: "languageDefined",
                autoSurround: "languageDefined",
                autoIndent: "full",
                tabSize: language === "python" ? 4 : 2,
                insertSpaces: true,
                detectIndentation: false,
                wordWrap: "on",
                wordWrapColumn: 100,
                wrappingIndent: "indent",
                bracketPairColorization: { enabled: true },
                guides: {
                    bracketPairs: "active",
                    bracketPairsHorizontal: "active",
                    indentation: true,
                    highlightActiveBracketPair: true,
                },
                inlayHints: { enabled: "on", fontSize: 11 },
                hover: { enabled: "on", delay: 300 },
                occurrencesHighlight: "singleFile",
                selectionHighlight: true,
                renderWhitespace: "selection",
                renderControlCharacters: false,
                scrollbar: {
                    vertical: "auto",
                    horizontal: "auto",
                    useShadows: false,
                    verticalScrollbarSize: 5,
                    horizontalScrollbarSize: 5,
                    arrowSize: 0,
                },
                overviewRulerBorder: false,
                overviewRulerLanes: 2,
                hideCursorInOverviewRuler: false,
                suggest: {
                    showKeywords: true,
                    showSnippets: true,
                    showFunctions: true,
                    showVariables: true,
                    showModules: true,
                    showClasses: true,
                    showProperties: true,
                    preview: true,
                    previewMode: "subwordSmart",
                    insertMode: "insert",
                    filterGraceful: true,
                    shareSuggestSelections: false,
                },
                acceptSuggestionOnCommitCharacter: true,
                acceptSuggestionOnEnter: "smart",
            }),
            [readOnly, language, monoFont],
        );

    // Only set explicit inline height when the caller passes a specific value.
    // With the default '100%', CSS flex: 1 fills the parent — no inline style needed.
    const wrapperStyle =
        height !== "100%"
            ? { height: typeof height === "number" ? `${height}px` : height }
            : undefined;

    return (
        <motion.div
            className={`${styles.container} font-mono ${className ?? ""}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
        >
            {/* GSAP-animated ambient orbs */}
            <div ref={orb1Ref} className={styles.glowOrb1} aria-hidden />
            <div ref={orb2Ref} className={styles.glowOrb2} aria-hidden />

            <div className={styles.editorFrame}>
                {/* Traffic-light chrome */}
                <div className={styles.windowChrome} aria-hidden>
                    <span
                        className={`${styles.chromeDot} ${styles.chromeDotRed}`}
                    />
                    <span
                        className={`${styles.chromeDot} ${styles.chromeDotYellow}`}
                    />
                    <span
                        className={`${styles.chromeDot} ${styles.chromeDotGreen}`}
                    />
                    <span className={styles.chromeTitle}>
                        {language === "javascript" ? "index.js" : "main.py"}
                    </span>
                </div>

                <EditorToolbar
                    language={language}
                    onLanguageChange={handleLanguageChange}
                    onFormat={handleFormat}
                    onCopy={handleCopy}
                    isFormatting={isFormatting}
                    isCopied={isCopied}
                    readOnly={readOnly}
                    isReady={isEditorReady}
                />

                {/* editorWrapper grows to fill available flex space */}
                <div className={styles.editorWrapper} style={wrapperStyle}>
                    <MonacoEditor
                        height="100%"
                        language={
                            language === "javascript" ? "javascript" : "python"
                        }
                        value={currentValue}
                        theme="warm-dark"
                        beforeMount={handleBeforeMount}
                        onMount={handleEditorMount}
                        onChange={handleChange}
                        options={editorOptions}
                        loading={null}
                    />
                </div>

                {/* Status bar */}
                <EditorStatusBar language={language} readOnly={readOnly} />
            </div>
        </motion.div>
    );
};
