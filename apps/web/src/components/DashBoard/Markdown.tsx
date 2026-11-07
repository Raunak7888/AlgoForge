"use client";

import { Check, Copy, FileInput } from "lucide-react";
import { useState, type ReactNode } from "react";
import { normalizeLang, parseBlocks, type Inline } from "@/lib/markdown/markdown";

function inline(nodes: Inline[]): ReactNode[] {
  return nodes.map((n, i) => {
    switch (n.t) {
      case "text":
        return n.v;
      case "code":
        return (
          <code key={i} className="rounded bg-primary-foreground/10 px-1 py-0.5 font-mono text-[0.9em]">
            {n.v}
          </code>
        );
      case "strong":
        return <strong key={i}>{inline(n.c)}</strong>;
      case "em":
        return <em key={i}>{inline(n.c)}</em>;
      case "link":
        return (
          <a key={i} href={n.href} target="_blank" rel="noopener noreferrer nofollow" className="text-accent underline underline-offset-2">
            {inline(n.c)}
          </a>
        );
    }
  });
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function CodeBlock({ lang, code, onInsert }: { lang: string; code: string; onInsert?: (code: string, lang: "javascript" | "python") => void }) {
  const [copied, setCopied] = useState(false);
  const insertLang = normalizeLang(lang);
  const btn = "flex h-6 cursor-pointer items-center gap-1 rounded-md px-1.5 text-[11px] text-primary-foreground/70 transition hover:bg-primary-foreground/10 hover:text-primary-foreground";
  return (
    <div className="my-2 overflow-hidden rounded-lg border border-primary-foreground/10 bg-black/30">
      <div className="flex items-center justify-between border-b border-primary-foreground/10 px-2 py-1">
        <span className="font-mono text-[10px] uppercase tracking-wide text-primary-foreground/50">{lang || "code"}</span>
        <span className="flex items-center gap-0.5">
          <button
            type="button"
            className={btn}
            onClick={async () => {
              if (await copyText(code)) {
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }
            }}
          >
            {copied ? <Check size={11} aria-hidden /> : <Copy size={11} aria-hidden />}
            {copied ? "Copied" : "Copy"}
          </button>
          {onInsert && insertLang && (
            <button type="button" className={btn} onClick={() => onInsert(code, insertLang)}>
              <FileInput size={11} aria-hidden />
              Insert into editor
            </button>
          )}
        </span>
      </div>
      <pre className="scrollbar-thin overflow-x-auto p-3 font-mono text-[12px] leading-5 text-primary-foreground/90">
        <code>{code}</code>
      </pre>
    </div>
  );
}

/** Renders assistant Markdown as React elements. No HTML string is ever created. */
export function Markdown({ source, onInsert }: { source: string; onInsert?: (code: string, lang: "javascript" | "python") => void }) {
  return (
    <div className="flex flex-col gap-2 break-words">
      {parseBlocks(source).map((b, i) => {
        switch (b.t) {
          case "p":
            return <p key={i}>{inline(b.c)}</p>;
          case "h":
            return (
              <p key={i} className="font-semibold text-primary-foreground">
                {inline(b.c)}
              </p>
            );
          case "ul":
            return (
              <ul key={i} className="list-disc pl-5">
                {b.items.map((it, j) => (
                  <li key={j}>{inline(it)}</li>
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol key={i} className="list-decimal pl-5">
                {b.items.map((it, j) => (
                  <li key={j}>{inline(it)}</li>
                ))}
              </ol>
            );
          case "code":
            return <CodeBlock key={i} lang={b.lang} code={b.v} onInsert={onInsert} />;
        }
      })}
    </div>
  );
}
