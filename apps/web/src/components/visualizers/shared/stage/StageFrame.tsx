"use client";
import type { ReactNode, RefObject } from "react";
import { cn } from "@/lib/utils";

export interface StatItem {
  label: string;
  value: string;
  mono?: boolean;
}

interface StageFrameProps {
  hostRef: RefObject<HTMLElement | null>;
  label: string;
  stats: StatItem[];
  badge?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}

/** The one frame around every lab's canvas: stat row, canvas, footer. */
export function StageFrame({ hostRef, label, stats, badge, children, footer }: StageFrameProps) {
  return (
    <section ref={hostRef as RefObject<HTMLElement>} data-stage aria-label={label} className="relative overflow-hidden rounded-2xl border border-primary-foreground/10 bg-card/30">
      <div className="flex flex-col gap-5 py-6">
        <div data-chrome className="flex flex-wrap items-end gap-x-10 gap-y-3 px-6">
          {stats.map((s) => (
            <div key={s.label} className="flex min-w-0 flex-col gap-1">
              <span className={cn("max-w-[260px] truncate text-xl font-semibold leading-none tabular-nums", (s.mono ?? true) && "font-mono")}>{s.value}</span>
              <span className="text-[11px] leading-none text-muted-foreground">{s.label}</span>
            </div>
          ))}
          {badge}
        </div>
        {children}
        {footer ? <div data-chrome className="contents">{footer}</div> : null}
      </div>
    </section>
  );
}
