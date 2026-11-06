"use client";

import { CodeEditor } from "../CodeEditor";
import { useWorkspace } from "@/lib/workspace/store";

/** The dashboard editor, bound to the shared workspace state (code and language). */
export default function WorkspaceEditor() {
    const language = useWorkspace((s) => s.language);
    const code = useWorkspace((s) => s.codes[s.language]);
    const setCode = useWorkspace((s) => s.setCode);
    const setLanguage = useWorkspace((s) => s.setLanguage);

    return <CodeEditor height="100%" language={language} value={code} onChange={setCode} onLanguageChange={setLanguage} />;
}
