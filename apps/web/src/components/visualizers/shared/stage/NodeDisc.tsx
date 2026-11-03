"use client";
import type { PointerEvent as RPointerEvent } from "react";
import { cn } from "@/lib/utils";
import type { Box } from "../edges";
import { COLOR_FADE, INK } from "./tokens";

export function MarkPill({ id, ghost }: { id: string; ghost?: boolean }) {
  const attr = ghost ? { "data-mark-ghost": "" } : { "data-mark": id };
  const color = id === "P" ? INK.green : INK.purple;
  return (
    <span {...attr} className="inline-flex h-[17px] items-center gap-1 rounded-full border bg-primary-background px-1.5 font-mono text-[10px] font-semibold" style={{ color, borderColor: `${color}55`, transformOrigin: "50% 100%" }} aria-label={`mark ${id}`}>
      <span aria-hidden>⚑</span>
      {/* ONE string child: the animator may swap textContent, React stays consistent. */}
      <span>{id}</span>
    </span>
  );
}

export interface NodeDiscProps {
  id: string;
  text: string;
  box: Box;
  showIds: boolean;
  kind: "node" | "vertex";
  hl?: string;
  selected?: boolean;
  dim?: boolean;
  hot?: boolean;
  marks?: string[];
  ghostMarkId?: string;
  arrow?: { id: string; color: string };
  badge?: string;
  ghost?: boolean;
  onSelect?: (id: string) => void;
  onHover?: (id: string | null) => void;
  /** When given, the disc is draggable and the lab handles select itself. */
  pointer?: { down: (e: RPointerEvent<HTMLDivElement>, id: string) => void; move: (e: RPointerEvent<HTMLDivElement>) => void; up: (e: RPointerEvent<HTMLDivElement>) => void };
}

/** The one circle every lab draws. The data-* attributes are what the shared animator reads. */
export function NodeDisc(p: NodeDiscProps) {
  const { id, text, box, showIds, kind, hl, selected, dim, hot, marks = [], ghostMarkId, arrow, badge, ghost, onSelect, onHover, pointer } = p;
  const live = !ghost;
  const fs = text.length > 6 ? 10.5 : text.length > 3 ? 13 : 16;
  return (
    <div
      data-item
      data-node
      data-id={ghost ? `g:${id}` : id} /* a fading-out copy never shares an element id with a live node that reuses the same number */
      data-x={box.x}
      data-y={box.y}
      data-w={box.w}
      data-h={box.h}
      data-text={text}
      data-ghost={ghost ? "true" : undefined}
      className={cn("absolute left-0 top-0 touch-none select-none rounded-full outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground/30", live && (pointer ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"))}
      style={{ width: box.w, height: box.h }}
      title={ghost ? undefined : `${id} = ${text}. Click to select${pointer ? ", drag to move" : ""}.`}
      role={live ? "button" : undefined}
      tabIndex={live ? 0 : undefined}
      aria-label={live ? `${kind} ${id}, value ${text}` : undefined}
      onPointerDown={live && pointer ? (e) => pointer.down(e, id) : undefined}
      onPointerMove={live && pointer ? pointer.move : undefined}
      onPointerUp={live && pointer ? pointer.up : undefined}
      onClick={live ? (e) => (e.stopPropagation(), !pointer && onSelect?.(id)) : undefined}
      onKeyDown={live ? (e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onSelect?.(id)) : undefined}
      onMouseEnter={live ? () => onHover?.(id) : undefined}
      onMouseLeave={live ? () => onHover?.(null) : undefined}
    >
      <div
        data-box
        data-border={hl ? `${hl}99` : ""}
        className={cn(
          "absolute inset-0 overflow-hidden rounded-full border bg-card shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-[border-color,box-shadow,opacity] duration-200",
          hl ? "border-2 border-dashed" : "border-primary-foreground/[0.25]",
          hot && "shadow-[0_6px_18px_rgba(0,0,0,0.14)]",
          dim && "opacity-35",
        )}
        style={hl ? { borderColor: `${hl}99` } : undefined}
      >
        {hl && <div data-tint className="absolute inset-0 origin-left" style={{ background: `linear-gradient(90deg, ${hl}44, ${hl}18)` }} />}
        <div className={cn("absolute inset-0 flex items-center justify-center px-1 transition-[padding] duration-200", showIds ? "pb-3" : "pb-0")}>
          <span data-value className="block max-w-full truncate font-mono font-semibold tabular-nums" style={{ fontSize: fs }}>
            {text}
          </span>
        </div>
        <span aria-hidden={!showIds} className={cn("absolute inset-x-0 bottom-1.5 text-center font-mono text-[9px] leading-none text-muted-foreground transition-opacity duration-200", showIds ? "opacity-100" : "opacity-0")}>
          {id}
        </span>
      </div>
      <div data-ring aria-hidden className="pointer-events-none absolute -inset-px rounded-full border-2 opacity-0" />
      {selected && live && (
        <>
          <div data-sel aria-label={`selected ${kind}`} className="pointer-events-none absolute -inset-1.5 rounded-full border-[3px]" style={{ borderColor: INK.blue }} />
          <div className="pointer-events-none absolute left-1/2 top-full mt-2 -translate-x-1/2 whitespace-nowrap text-[10px] font-medium" style={{ color: INK.blue }}>
            selected
          </div>
        </>
      )}
      {badge && live && <div className="pointer-events-none absolute left-1/2 -top-5 -translate-x-1/2 whitespace-nowrap text-[10px] text-muted-foreground">{badge}</div>}
      {(marks.length > 0 || ghostMarkId) && (
        <div className="absolute -top-3 left-[62%] z-10 flex gap-1">
          {marks.map((m) => (
            <MarkPill key={m} id={m} />
          ))}
          {ghostMarkId && <MarkPill id={ghostMarkId} ghost />}
        </div>
      )}
      {arrow && live && (
        <svg data-arrow data-arrow-for={arrow.id} width={28} height={34} viewBox="0 0 28 34" className="pointer-events-none absolute overflow-visible" style={{ left: (box.w - 28) / 2, top: -56 }} role="img" aria-label={`annotation arrow pointing at this ${kind}`}>
          <g style={{ stroke: arrow.color, transition: COLOR_FADE }} strokeWidth={1.75} fill="none" strokeLinecap="round" strokeLinejoin="round">
            <path data-draw="shaft" pathLength={1} d="M14 3V28" />
            <path data-draw="head" pathLength={1} d="M9 23L14 30L19 23" />
          </g>
        </svg>
      )}
    </div>
  );
}
