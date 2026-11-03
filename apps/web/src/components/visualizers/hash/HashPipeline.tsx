"use client";
import { fmt } from "./hashEngine";
import type { Trace } from "./types";

const ACCENT = "#FF430F";

function Token({
  value,
  label,
  color,
  attr,
}: {
  value: string;
  label: string;
  color?: string;
  attr?: Record<string, string>;
}) {
  return (
    <div {...attr} className="flex shrink-0 flex-col gap-1">
      <span
        className="max-w-[200px] truncate font-mono text-[13px] font-semibold leading-none"
        style={color ? { color } : undefined}
        title={value}
      >
        {value}
      </span>
      <span className="text-[11px] leading-none text-muted-foreground">{label}</span>
    </div>
  );
}

const Chevron = () => (
  <svg
    data-pipe-arrow
    width="12"
    height="12"
    viewBox="0 0 12 12"
    aria-hidden
    className="mb-3 shrink-0 text-muted-foreground/50"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M4 2.5 7.5 6 4 9.5" />
  </svg>
);

/**
 * One quiet line that reads like a formula:  input › text › hash › bucket › result.
 * Presentational only; the stage reveals the tokens left to right.
 */
export default function HashPipeline({ trace }: { trace: Trace | null }) {
  if (!trace)
    return (
      <p className="px-6 text-xs text-muted-foreground">
        Run an operation to watch a key become a hash, a bucket and a result.
      </p>
    );
  const miss = /not found|rejected/i.test(trace.outcome);
  const collision = /collision/i.test(trace.outcome);
  const result = miss ? "#E5484D" : collision ? "#D97706" : "#17A34A";
  const name = trace.label === "key" ? "key" : "value";

  return (
    <div className="px-6" aria-label="Hash pipeline" aria-live="polite">
      <div className="flex items-end gap-3 overflow-x-auto pb-3">
        <Token
          attr={{ "data-pipe": "" }}
          value={trace.pair !== undefined ? `${fmt(trace.subject)} → ${fmt(trace.pair)}` : fmt(trace.subject)}
          label={`${name} · ${trace.type}`}
        />
        <Chevron />
        <Token attr={{ "data-pipe": "" }} value={trace.canonical} label="type-tagged text" />
        <Chevron />
        <Token attr={{ "data-pipe": "" }} value={trace.hex} label={`hash · ${trace.hash}`} />
        <Chevron />
        <Token
          attr={{ "data-pipe": "" }}
          value={`${trace.hash} mod ${trace.capacity} = ${trace.bucket}`}
          label="bucket"
          color={ACCENT}
        />
        <Chevron />
        <Token attr={{ "data-pipe": "" }} value={trace.outcome} label="result" color={result} />
        {trace.resize && (
          <>
            <Chevron />
            <Token
              attr={{ "data-pipe-resize": "" }}
              value={`${trace.resize.from} → ${trace.resize.to} buckets`}
              label="resize and rehash"
              color="#D97706"
            />
          </>
        )}
      </div>
      <div aria-hidden className="relative h-px bg-primary-foreground/10">
        <span data-pipe-progress className="absolute inset-0 origin-left opacity-60" style={{ background: ACCENT }} />
      </div>
    </div>
  );
}
