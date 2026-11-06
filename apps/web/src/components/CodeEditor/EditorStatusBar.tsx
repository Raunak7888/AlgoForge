import styles from "./CodeEditor.module.css";
import { LANGUAGE_LABELS } from "./constants";
import type { Language } from "./types";

export function EditorStatusBar({ language, readOnly }: { language: Language; readOnly: boolean }) {
    return (
        <div className={styles.statusBar} role="status" aria-live="polite">
            <div className={styles.statusBarLeft}>
                <span className={styles.statusItem}>{LANGUAGE_LABELS[language]}</span>
                <span className={styles.statusDivider} aria-hidden>·</span>
                <span className={styles.statusItem}>UTF-8</span>
                <span className={styles.statusDivider} aria-hidden>·</span>
                <span className={styles.statusItem}>{language === "python" ? "Spaces: 4" : "Spaces: 2"}</span>
            </div>
            <div className={styles.statusBarRight}>
                {readOnly ? <span className={styles.statusReadOnly}>READ ONLY</span> : <span className={styles.statusEditable}>EDITABLE</span>}
            </div>
        </div>
    );
}
