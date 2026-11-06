// filepath: src/components/CodeEditor/lib/formatters.ts
//
// IMPORTANT: This module is a FORMATTER ONLY — it does NOT compile, execute,
// or evaluate any code. Prettier standalone runs entirely in-browser via AST
// parse → re-print; the Python formatter is pure string manipulation.
// No subprocess, no eval(), no Function(), no Worker with user code.
//
import type { Language } from '../types';

// ─── JavaScript Formatter (Prettier Standalone, browser-only) ────────────────
// Uses `prettier/standalone` which is a self-contained browser build with no
// Node.js APIs, no fs access, and no code execution — it only parses to an
// AST and reprints it.

async function formatJavaScript(code: string): Promise<string> {
  // Explicit plugin list prevents Prettier from loading any auto-detected
  // plugins that could involve native binaries or network access.
  const [prettier, babelPlugin, estreePlugin] = await Promise.all([
    import('prettier/standalone'),
    import('prettier/plugins/babel'),
    import('prettier/plugins/estree'),
  ]);

  return prettier.format(code, {
    parser: 'babel',                 // AST-only parse, no execution
    plugins: [
      babelPlugin.default  ?? babelPlugin,
      estreePlugin.default ?? estreePlugin,
    ],
    semi: true,
    singleQuote: true,
    jsxSingleQuote: false,
    trailingComma: 'all',
    printWidth: 80,
    tabWidth: 2,
    useTabs: false,
    bracketSpacing: true,
    bracketSameLine: false,
    arrowParens: 'always',
    endOfLine: 'lf',
  });
}

// ─── Python Formatter (in-browser, whitespace only) ──────────────────────────
// Python's indentation is syntax, so only text-safe edits are made:
//   1. leading tabs -> 4 spaces
//   2. trailing whitespace removed
//   3. more than 2 consecutive blank lines collapsed to 2
//   4. leading blank lines removed, exactly one final newline, CRLF -> LF
// Lines inside triple-quoted strings are never touched (their whitespace is data).
// Anything else (spacing around operators, blank lines before def) needs a real parser.

const INDENT = '    ';

/** Which triple-quote delimiter (if any) is still open at the end of `line`. */
function scanTripleQuotes(line: string, open: string | null): string | null {
  let delim = open;
  let i = 0;
  while (i < line.length) {
    if (delim) {
      const end = line.indexOf(delim, i);
      if (end < 0) return delim;
      i = end + 3;
      delim = null;
    } else {
      const d = line.indexOf('"""', i);
      const s = line.indexOf("'''", i);
      if (d < 0 && s < 0) return null;
      const useDouble = s < 0 || (d >= 0 && d < s);
      delim = useDouble ? '"""' : "'''";
      i = (useDouble ? d : s) + 3;
    }
  }
  return delim;
}

function formatPython(code: string): string {
  const out: { text: string; verbatim: boolean }[] = [];
  let open: string | null = null;

  for (const line of code.split(/\r?\n/)) {
    const startsInside = open !== null;
    open = scanTripleQuotes(line, open);
    if (startsInside || open !== null) {
      out.push({ text: line, verbatim: true });
    } else {
      out.push({ text: line.replace(/^\t+/, (t) => INDENT.repeat(t.length)).trimEnd(), verbatim: false });
    }
  }
  if (open !== null) return code; // unterminated string: do not guess

  const kept: string[] = [];
  let blanks = 0;
  for (const { text, verbatim } of out) {
    if (!verbatim && text === '') {
      if (++blanks > 2) continue;
    } else {
      blanks = 0;
    }
    kept.push(text);
  }
  const body = kept.join('\n').replace(/^\n+/, '').replace(/\n+$/, '');
  return body ? `${body}\n` : '';
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function formatCode(code: string, language: Language): Promise<string> {
  switch (language) {
    case 'javascript':
      return formatJavaScript(code);
    case 'python':
      return formatPython(code);
    default:
      return code;
  }
}