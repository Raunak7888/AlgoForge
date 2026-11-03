// filepath: src/components/CodeEditor/types.ts
export type Language = 'javascript' | 'python';

export interface CodeEditorProps {
  value?: string;
  defaultValue?: Record<Language, string>;
  language?: Language;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  height?: string | number;
  className?: string;
}

export interface EditorToolbarProps {
  language: Language;
  onLanguageChange: (lang: Language) => void;
  onFormat: () => void;
  onCopy: () => void;
  isFormatting: boolean;
  isCopied: boolean;
  readOnly: boolean;
  isReady: boolean;
}