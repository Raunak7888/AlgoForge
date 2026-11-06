"use client";

export interface CaptionData {
  n: number;
  ok: boolean;
  call: string;
  text: string;
}
const CSS = `
@keyframes lab-pop{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@keyframes lab-shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-6px)}40%{transform:translateX(5px)}60%{transform:translateX(-3px)}80%{transform:translateX(2px)}}
.lab-pop{animation:lab-pop 220ms ease-out}
.lab-pop.lab-bad{animation:lab-pop 220ms ease-out,lab-shake 360ms ease-out 120ms}
@media (prefers-reduced-motion: reduce){.lab-pop,.lab-pop.lab-bad{animation:none}}
`;

/** What just happened, in one sentence, on the canvas itself. Accepted and rejected operations both show up. */
export function Caption({ data }: { data: CaptionData | null }) {
  if (!data) return null;
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 z-10 max-w-[min(540px,calc(100%-1.5rem))]" aria-hidden>
      <style>{CSS}</style>
      <div key={data.n} className={`lab-pop ${data.ok ? "" : "lab-bad"} rounded-xl border bg-card/95 px-3 py-2 shadow-lg backdrop-blur ${data.ok ? "border-primary-foreground/15" : "border-destructive/60"}`}>
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 shrink-0 rounded-full ${data.ok ? "bg-emerald-500" : "bg-destructive"}`} />
          <code className="min-w-0 truncate font-mono text-[11px] font-semibold">{data.call}</code>
        </div>
        <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">{data.text}</p>
      </div>
    </div>
  );
}
