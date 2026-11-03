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
