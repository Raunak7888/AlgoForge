"use client";
import { useLayoutEffect, useRef } from "react";
import { animate, createTimeline, spring, stagger, utils } from "animejs";
import { cn } from "@/lib/utils";
import { useAnimationSettings, useReducedMotion } from "../shared/animationSettings";
import { useTimelineSink } from "../shared/stage/StageEnv";
import { fmt } from "./engine";
import { Q, Q_PTR_Y, Q_RAIL_B, S, STACK_FLOOR_Y, stageHeight, stageWidth, tilePos, tileSize } from "./geometry";
import type * as LabT from "./types";
import type { Anim, Item, ItemArrow, Kind, LinearState, LogEntry } from "./types";

/* Stack: VERTICAL, anchored to a fixed floor. Queue: HORIZONTAL, FRONT left, REAR right.
 * The stage never changes size when elements come and go (see geometry.ts), so only tiles move. */

const INK = { accent: "#FF430F", blue: "#0070F3", green: "#17A34A", purple: "#7928CA", red: "#E5484D" };
const COLOR_FADE = "stroke 320ms ease";

type Params = Parameters<typeof animate>[1];
type El = HTMLElement | SVGElement;
type Tgt = El | El[] | null | undefined;
type Box = [number, number, number]; // x, y, height

/* ───────────── pieces ───────────── */

function MarkPill({ id, ghost }: { id: string; ghost?: boolean }) {
  const attr = ghost ? { "data-mark-ghost": "" } : { "data-mark": id };
  return (
    <span
      {...attr}
      className="inline-flex h-[17px] items-center gap-1 rounded-full border bg-primary-background px-1.5 font-mono text-[10px] font-semibold"
      style={{ color: INK.purple, borderColor: `${INK.purple}55`, transformOrigin: "50% 100%" }}
      aria-label={`mark ${id}`}
    >
      <span aria-hidden>⚑</span>
      {/* ONE string child: the animator may swap textContent, React stays consistent. */}
      <span>{id}</span>
    </span>
  );
}

function Tile(props: {
  kind: Kind;
  item: Item;
  index: number;
  x: number;
  y: number;
  w: number;
  h: number;
  data: LinearState;
  showIndex: boolean;
  ghost?: boolean;
  ghostMarkId?: string;
  ghostArrow?: ItemArrow;
}) {
  const { kind, item, index, x, y, w, h, data, showIndex, ghost, ghostMarkId, ghostArrow } = props;
  const hl = data.highlights[item.id];
  const marks = data.marks.filter((m) => m.itemId === item.id);
  const arrow = data.arrows.find((a) => a.itemId === item.id);
  const text = fmt(item.value);
  const stack = kind === "stack";
  const fs = h < 30 ? 12 : text.length > 14 ? 12 : text.length > 9 ? 14 : text.length > 5 && !stack ? 14 : 16;

  return (
    <div
      data-tile
      data-id={item.id}
      data-x={x}
      data-y={y}
      data-h={h}
      data-text={text}
      data-ghost={ghost ? "true" : undefined}
      className="absolute left-0 top-0"
      // bottom-centre origin so landings squash against the floor / the tile below
      style={{ width: w, height: h, transformOrigin: "50% 100%" }}
      title={text}
    >
      <div
        data-box
        data-border={hl ? `${hl}99` : ""}
        className={cn(
          "absolute inset-0 overflow-hidden border border-primary-foreground/[0.14] bg-card shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-[border-color,box-shadow] duration-200 hover:border-primary-foreground/35 hover:shadow-[0_4px_14px_rgba(0,0,0,0.08)]",
          stack ? "rounded-lg" : "rounded-xl",
        )}
        style={hl ? { borderColor: `${hl}99` } : undefined}
      >
        {hl && <div data-tint className="absolute inset-0 origin-left" style={{ background: `linear-gradient(90deg, ${hl}38, ${hl}14)` }} />}
        <div
          data-sheen
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 w-full opacity-0"
          style={{ background: `linear-gradient(100deg, transparent 32%, ${INK.blue}33 50%, transparent 68%)` }}
        />
        <span
          aria-hidden={!showIndex}
          className={cn("absolute left-2 top-1/2 -translate-y-1/2 font-mono text-[10px] leading-none text-muted-foreground transition-opacity duration-200", stack ? "" : "top-1.5 translate-y-0", showIndex ? "opacity-100" : "opacity-0")}
        >
          {index}
        </span>
        <div className="absolute inset-0 flex items-center justify-center px-6">
          <span data-value className="block max-w-full truncate font-mono font-semibold tabular-nums" style={{ fontSize: fs }}>
            {text}
          </span>
        </div>
      </div>
      <div data-ring aria-hidden className={cn("pointer-events-none absolute -inset-px border-2 opacity-0", stack ? "rounded-lg" : "rounded-xl")} />

      {(marks.length > 0 || ghostMarkId) && (
        <div className="absolute -top-2.5 right-2 z-10 flex gap-1">
          {marks.map((m) => (
            <MarkPill key={m.id} id={m.id} />
          ))}
          {ghostMarkId && <MarkPill id={ghostMarkId} ghost />}
        </div>
      )}

      {(arrow || ghostArrow) && (
        <svg
          {...(arrow ? { "data-arrow": "", "data-arrow-for": arrow.id } : { "data-arrow-ghost": "" })}
          width={stack ? S.GUT : 28}
          height={stack ? h : 30}
          viewBox={stack ? `0 0 ${S.GUT} ${h}` : "0 0 28 30"}
          className="pointer-events-none absolute overflow-visible"
          style={stack ? { left: w + 2, top: 0 } : { left: (w - 28) / 2, top: -32 }}
          role="img"
          aria-label="arrow pointing at this element"
        >
          <g style={{ stroke: (arrow ?? ghostArrow)!.color, transition: COLOR_FADE }} strokeWidth={1.75} fill="none" strokeLinecap="round" strokeLinejoin="round">
            {stack ? (
              <>
                <path data-draw="shaft" pathLength={1} d={`M${S.GUT - 4} ${h / 2}H4`} />
                <path data-draw="head" pathLength={1} d={`M10 ${h / 2 - 4.5}L3 ${h / 2}L10 ${h / 2 + 4.5}`} />
              </>
            ) : (
              <>
                <path data-draw="shaft" pathLength={1} d="M14 3V25" />
                <path data-draw="head" pathLength={1} d="M9 20L14 27L19 20" />
              </>
            )}
          </g>
        </svg>
      )}
    </div>
  );
}

/** TOP / FRONT / REAR labels. They travel with the element at that end. */
function Pointer({ name, kind, x, y, h, color }: { name: "top" | "front" | "rear"; kind: Kind; x: number; y: number; h: number; color: string }) {
  const stack = kind === "stack";
  return (
    <div
      data-ptr={name}
      data-x={x}
      data-y={y}
      className={cn("pointer-events-none absolute left-0 top-0 flex", stack ? "items-center justify-end gap-1" : "flex-col items-center gap-1")}
      style={stack ? { width: S.LEFT - 12, height: h } : { width: Q.TW }}
    >
      {!stack && (
        <svg width="10" height="6" viewBox="0 0 10 6" aria-hidden fill={color}>
          <path d="M5 0 10 6H0Z" />
        </svg>
      )}
      <span
        data-ptr-pill
        className="inline-flex h-[22px] items-center rounded-full border px-2.5 font-mono text-[11px] font-semibold tracking-wide"
        style={{ color, borderColor: `${color}66`, background: `${color}14` }}
      >
        {name.toUpperCase()}
      </span>
      {stack && (
        <svg width="6" height="10" viewBox="0 0 6 10" aria-hidden fill={color}>
          <path d="M0 0 6 5 0 10Z" />
        </svg>
      )}
    </div>
  );
}

function Stat({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className={cn("max-w-[220px] truncate text-xl font-semibold leading-none tabular-nums", mono && "font-mono")}>{value}</span>
      <span className="text-[11px] leading-none text-muted-foreground">{label}</span>
    </div>
  );
}

/** The short "returned value" chip that appears at the open end while an operation plays. */
function chipFor(plan: Anim | null, last: Pick<LogEntry, "outcome"> | null): { text: string; color: string; side: "in" | "out" } | null {
  if (!plan || !last) return null;
  const r = last.outcome.result;
  const val = r && typeof r.value !== "object" ? ` ${fmt(r.value)}` : "";
  switch (plan.kind) {
    case "enter":
      return r ? { text: `${r.label}${val}`, color: INK.green, side: "in" } : null;
    case "exit":
      return r ? { text: `${r.label}${val}`, color: INK.accent, side: "out" } : null;
    case "peek":
      return r ? { text: `${r.label}${val}`, color: INK.blue, side: "out" } : null;
    case "underflow":
      return { text: "underflow", color: INK.red, side: "out" };
    case "overflow":
      return { text: "overflow", color: INK.red, side: "in" };
    default:
      return null;
  }
}

/* ───────────── stage ───────────── */

/** What a stage needs to draw one structure. The old labs feed it from their store; the shared canvas feeds it directly. */
export interface LinearStageViewProps {
  kind: LabT.Kind;
  data: LabT.LinearState;
  last: Pick<LabT.LogEntry, "outcome"> | null;
  anim: { token: number; plan: LabT.Anim } | null;
  showIndex: boolean;
  finishAnimation: (token: number) => void;
}

export function LinearStageView({ kind, data, last, anim, showIndex, finishAnimation }: LinearStageViewProps) {
  const sink = useTimelineSink();
  const reduced = useReducedMotion();

  const host = useRef<HTMLElement>(null);
  const prevPos = useRef(new Map<string, Box>());
  const prevPtr = useRef(new Map<string, [number, number]>());

  const plan = anim?.plan ?? null;
  const before = plan && "prev" in plan ? plan.prev : null;
  const stack = kind === "stack";
  const n = data.items.length;
  const prevN = before?.items.length ?? n;

  /* Everything that is leaving is drawn from the state before the op so it can fade out. */
  const ghosts: { item: Item; index: number }[] =
    plan?.kind === "exit"
      ? [plan.ghost]
      : plan?.kind === "clear"
        ? plan.prev.items.map((item, index) => ({ item, index })).sort((a, b) => (stack ? b.index - a.index : a.index - b.index))
        : [];
  const ghostMark = plan?.kind === "markOut" ? plan : null;
  const dismissedArrows = plan?.kind === "dismiss" ? plan.prev.arrows : [];

  const sz = tileSize(kind, n);
  const endIdx = Math.max(n - 1, 0);
  const [ex0, ey0] = tilePos(kind, endIdx, n);
  const [fx0] = tilePos(kind, 0, n);
  const ptrs: { name: "top" | "front" | "rear"; x: number; y: number; color: string }[] = stack
    ? [{ name: "top", x: 0, y: ey0, color: INK.accent }]
    : [
        { name: "front", x: fx0, y: Q_PTR_Y, color: INK.accent },
        { name: "rear", x: ex0, y: Q_PTR_Y + (n <= 1 ? 30 : 0), color: INK.blue },
      ];

  const width = stageWidth(kind, n, prevN);
  const height = stageHeight(kind);
  const chip = chipFor(plan, last);

  useLayoutEffect(() => {
    const el = host.current;
    if (!el) return;

    const tiles = Array.from(el.querySelectorAll<HTMLElement>("[data-tile]"));
    const live = tiles.filter((t) => t.dataset.ghost !== "true");
    const ghostTiles = tiles.filter((t) => t.dataset.ghost === "true");
    const ptrEls = Array.from(el.querySelectorAll<HTMLElement>("[data-ptr]"));
    const emptyEl = el.querySelector<HTMLElement>("[data-empty]");
    const chipEl = el.querySelector<HTMLElement>("[data-chip]");
    const tx = (e: HTMLElement) => Number(e.dataset.x);
    const ty = (e: HTMLElement) => Number(e.dataset.y);
    const th = (e: HTMLElement) => Number(e.dataset.h);
    const toX = (t: unknown) => tx(t as HTMLElement);
    const toY = (t: unknown) => ty(t as HTMLElement);
    const toH = (t: unknown) => th(t as HTMLElement);
    const byId = (id: string) => live.find((t) => t.dataset.id === id);

    const clearDash = () =>
      el.querySelectorAll<SVGElement>("[data-draw]").forEach((e) => {
        e.style.strokeDasharray = "";
        e.style.strokeDashoffset = "";
      });
    const prep = (e: SVGElement) => {
      e.style.strokeDasharray = "1";
      e.style.strokeDashoffset = "1";
    };

    /** Snap everything to the data model's layout and remember positions. */
    const settle = () => {
      for (const t of live) {
        utils.set(t, { x: tx(t), y: ty(t), height: th(t), scale: 1, scaleX: 1, scaleY: 1, opacity: 1, rotate: 0 });
        const v = t.querySelector<HTMLElement>("[data-value]");
        if (v) {
          v.textContent = t.dataset.text ?? "";
          utils.set(v, { opacity: 1, y: 0 });
        }
        const ring = t.querySelector<HTMLElement>("[data-ring]");
        if (ring) utils.set(ring, { opacity: 0, scale: 1 });
        const sheen = t.querySelector<HTMLElement>("[data-sheen]");
        if (sheen) utils.set(sheen, { opacity: 0, x: 0 });
        const tint = t.querySelector<HTMLElement>("[data-tint]");
        if (tint) utils.set(tint, { scaleX: 1, opacity: 1 });
        const box = t.querySelector<HTMLElement>("[data-box]");
        if (box) box.style.borderColor = box.dataset.border ?? "";
      }
      for (const p of ptrEls) utils.set(p, { x: tx(p), y: ty(p), scale: 1, opacity: 1 });
      el.querySelectorAll("[data-ptr-pill]").forEach((e) => utils.set(e, { scale: 1 }));
      if (emptyEl) {
        utils.set(emptyEl, { x: 0, opacity: 1 });
        const ring = emptyEl.querySelector<HTMLElement>("[data-ring]");
        if (ring) utils.set(ring, { opacity: 0, scale: 1 });
      }
      if (chipEl) utils.set(chipEl, { opacity: 0 });
      const marks = el.querySelectorAll("[data-mark],[data-mark-ghost]");
      if (marks.length) utils.set(marks, { scale: 1, opacity: 1, y: 0 });
      const arrows = el.querySelectorAll("[data-arrow]");
      if (arrows.length) utils.set(arrows, { opacity: 1 });
      clearDash();
      prevPos.current = new Map(live.map((t) => [t.dataset.id!, [tx(t), ty(t), th(t)] as Box]));
      prevPtr.current = new Map(ptrEls.map((p) => [p.dataset.ptr!, [tx(p), ty(p)] as [number, number]]));
    };

    if (!anim) {
      settle();
      return;
    }

    const { plan: p, token } = anim;
    const { duration: D, speed } = useAnimationSettings.getState();
    if (reduced || D <= 0) {
      settle();
      queueMicrotask(() => finishAnimation(token));
      return;
    }

    /* Directions are fixed per structure: a stack moves vertically, a queue moves horizontally. */
    const IN = stack ? { x: 0, y: -76 } : { x: 112, y: 0 }; // new element arrives from the open end
    const OUT = stack ? { x: 0, y: -64 } : { x: -112, y: 0 }; // removed element leaves through the open end

    const startOf = (t: HTMLElement): Box => prevPos.current.get(t.dataset.id!) ?? [tx(t), ty(t), th(t)];
    for (const t of live) {
      const [sx, sy, sh] = startOf(t);
      utils.set(t, { x: sx, y: sy, height: sh });
    }
    for (const g of ghostTiles) utils.set(g, { x: tx(g), y: ty(g), height: th(g) });
    for (const pe of ptrEls) {
      const [sx, sy] = prevPtr.current.get(pe.dataset.ptr!) ?? [tx(pe), ty(pe)];
      utils.set(pe, { x: sx, y: sy });
    }
    const moved = live.filter((t) => {
      const [sx, sy, sh] = startOf(t);
      return sx !== tx(t) || sy !== ty(t) || sh !== th(t);
    });
    const movedPtrs = ptrEls.filter((pe) => {
      const [sx, sy] = prevPtr.current.get(pe.dataset.ptr!) ?? [tx(pe), ty(pe)];
      return sx !== tx(pe) || sy !== ty(pe);
    });

    const soft = spring({ bounce: 0.28, duration: D });
    const snap = spring({ bounce: 0.1, duration: D * 0.9 });

    let added = 0;
    const tl = createTimeline({
      defaults: { duration: D, ease: "outQuart" },
      playbackRate: speed,
      onComplete: () => {
        settle();
        sink.clear(tl);
        finishAnimation(token);
      },
    });
    const add = (targets: Tgt, params: Params, at: number) => {
      if (!targets || (Array.isArray(targets) && targets.length === 0)) return;
      tl.add(targets, params, at);
      added++;
    };
    const call = (fn: () => void, at: number) => {
      tl.call(fn, at);
      added++;
    };
    void call;
    const pulse = (t: HTMLElement | null | undefined, color: string, at: number) => {
      const ring = t?.querySelector<HTMLElement>("[data-ring]");
      if (!ring) return;
      ring.style.borderColor = color;
      add(ring, { scale: [1, 1.22], opacity: [0.7, 0], duration: D * 1.2, ease: "outQuad" }, at);
    };
    const draw = (scope: Element | null, at: number, span = D * 0.8) => {
      if (!scope) return;
      const body = Array.from(scope.querySelectorAll<SVGElement>('[data-draw="shaft"]'));
      const tips = Array.from(scope.querySelectorAll<SVGElement>('[data-draw="head"]'));
      [...body, ...tips].forEach(prep);
      add(body, { strokeDashoffset: [1, 0], duration: span, ease: "outQuad" }, at);
      add(tips, { strokeDashoffset: [1, 0], duration: D * 0.25, ease: "outQuad" }, at + span * 0.85);
    };
    const tint = (ts: HTMLElement[], color: string) =>
      ts.forEach((g) => {
        const b = g.querySelector<HTMLElement>("[data-box]");
        if (b) b.style.borderColor = color;
      });
    /** Tiles glide to their new spot. A stack compresses all rows together, so no stagger there. */
    const slide = (ts: HTMLElement[], at: number, dur = D * 1.0) =>
      add(ts, { x: toX, y: toY, height: toH, ease: snap, duration: dur, delay: stagger(stack ? 0 : 40) }, at);
    const glidePtrs = (at: number) => add(movedPtrs, { x: toX, y: toY, ease: snap, duration: D * 0.9 }, at);
    /** A short shake along the x axis, for rejected operations. */
    const shake = (t: HTMLElement | null | undefined, at: number) => {
      if (!t) return;
      const x0 = Number(t.dataset.x ?? 0) || 0;
      add(t, { x: x0 - 6, duration: D * 0.1, ease: "outQuad" }, at);
      add(t, { x: x0 + 6, duration: D * 0.14, ease: "inOutQuad" }, at + D * 0.1);
      add(t, { x: x0, duration: D * 0.3, ease: soft }, at + D * 0.24);
    };
    const bumpPtr = (name: string, at: number) => {
      const pill = el.querySelector<HTMLElement>(`[data-ptr="${name}"] [data-ptr-pill]`);
      add(pill, { scale: 1.18, duration: D * 0.2, ease: "outQuad" }, at);
      add(pill, { scale: 1, duration: D * 0.7, ease: soft }, at + D * 0.2);
    };
    /** A soft light sweeps across a tile: "this was looked at". */
    const sheen = (t: HTMLElement | null | undefined, at: number) => {
      const s = t?.querySelector<HTMLElement>("[data-sheen]");
      if (!t || !s) return;
      const w = stack ? S.TW : Q.TW;
      utils.set(s, { x: -w, opacity: 1 });
      add(s, { x: w, duration: D * 0.9, ease: "inOutQuad" }, at);
      add(s, { opacity: 0, duration: D * 0.2, ease: "outQuad" }, at + D * 0.8);
    };
    /** The returned value pops in at the open end, holds briefly, then fades. */
    const showChip = (at: number) => {
      if (!chipEl) return;
      utils.set(chipEl, { opacity: 0, y: 8, scale: 0.9 });
      add(chipEl, { opacity: 1, y: 0, scale: 1, duration: D * 0.45, ease: soft }, at);
      add(chipEl, { opacity: 0, y: -4, duration: D * 0.4, ease: "inQuad" }, at + D * 1.1);
    };
    const showEmptyAfter = (at: number) => {
      if (!emptyEl) return;
      utils.set(emptyEl, { opacity: 0 });
      add(emptyEl, { opacity: 1, duration: D * 0.5, ease: "outQuad" }, at);
    };

    switch (p.kind) {
      case "enter": {
        const fresh = byId(p.id);
        if (stack) {
          // Gravity: accelerates down, squashes against the stack, springs back. The tile below dips under the weight.
          if (fresh) utils.set(fresh, { x: tx(fresh), y: ty(fresh) + IN.y, opacity: 0, scaleY: 1.12, scaleX: 0.96 });
          const fall = D * 0.72;
          add(fresh, { opacity: 1, duration: D * 0.25, ease: "outQuad" }, 0);
          add(fresh, { y: toY, duration: fall, ease: "inQuad" }, 0);
          add(fresh, { scaleY: 0.86, scaleX: 1.07, duration: D * 0.12, ease: "outQuad" }, fall);
          add(fresh, { scaleY: 1, scaleX: 1, duration: D * 0.75, ease: soft }, fall + D * 0.12);
          pulse(fresh, INK.green, fall);
          const below = live[live.length - 2];
          if (below) {
            add(below, { y: ty(below) + 4, duration: D * 0.1, ease: "outQuad" }, fall);
            add(below, { y: ty(below), duration: D * 0.7, ease: soft }, fall + D * 0.1);
          }
          slide(moved, 0);
          glidePtrs(D * 0.35);
          bumpPtr("top", fall);
          showChip(fall);
        } else {
          // Slides in from the rear end, settles with a tiny squash.
          if (fresh) utils.set(fresh, { x: tx(fresh) + IN.x, y: ty(fresh), opacity: 0, rotate: 4 });
          const run = D * 0.95;
          add(fresh, { opacity: 1, duration: D * 0.3, ease: "outQuad" }, 0);
          add(fresh, { x: toX, rotate: 0, duration: run, ease: "outExpo" }, 0);
          add(fresh, { scaleX: 0.93, duration: D * 0.1, ease: "outQuad" }, run * 0.85);
          add(fresh, { scaleX: 1, duration: D * 0.7, ease: soft }, run * 0.85 + D * 0.1);
          pulse(fresh, INK.green, run * 0.6);
          slide(moved, 0);
          glidePtrs(D * 0.3);
          bumpPtr("rear", run * 0.8);
          showChip(run * 0.5);
        }
        break;
      }
      case "exit": {
        tint(ghostTiles, INK.accent);
        pulse(ghostTiles[0], INK.accent, 0);
        showChip(D * 0.15);
        if (stack) {
          // Lifts a little, then flies up and out with a small tilt.
          add(ghostTiles, { y: (t: unknown) => ty(t as HTMLElement) - 10, scale: 1.05, duration: D * 0.25, ease: "outQuad" }, 0);
          add(ghostTiles, { y: (t: unknown) => ty(t as HTMLElement) + OUT.y, rotate: 4, opacity: 0, duration: D * 0.75, ease: "inCubic" }, D * 0.25);
        } else {
          // Swells slightly, then slides out through the front. The line closes up behind it.
          add(ghostTiles, { scale: 1.07, duration: D * 0.2, ease: "outQuad" }, 0);
          add(ghostTiles, { x: (t: unknown) => tx(t as HTMLElement) + OUT.x, opacity: 0, duration: D * 0.8, ease: "inCubic" }, D * 0.2);
        }
        slide(moved, stack ? D * 0.5 : D * 0.6);
        glidePtrs(stack ? D * 0.5 : D * 0.6);
        bumpPtr(stack ? "top" : "front", D * 1.0);
        if (n === 0) showEmptyAfter(D * 1.0);
        break;
      }
      case "peek": {
        const t = byId(p.id);
        if (t) {
          const bump = stack ? { x: tx(t) + 10, y: ty(t) } : { x: tx(t), y: ty(t) - 8 };
          add(t, { ...bump, duration: D * 0.3, ease: "outQuad" }, 0);
          add(t, { x: tx(t), y: ty(t), duration: D * 0.9, ease: soft }, D * 0.35);
          pulse(t, INK.blue, 0);
          sheen(t, D * 0.1);
          bumpPtr(stack ? "top" : "front", 0);
          showChip(D * 0.2);
        }
        break;
      }
      case "underflow": {
        pulse(emptyEl, INK.red, 0);
        shake(emptyEl, 0);
        for (const pe of ptrEls) shake(pe, D * 0.05);
        showChip(0);
        break;
      }
      case "overflow": {
        const edge = live[live.length - 1];
        pulse(edge, INK.red, 0);
        shake(edge, 0);
        showChip(0);
        break;
      }
      case "clear": {
        tint(ghostTiles, INK.accent);
        add(
          ghostTiles,
          {
            x: (t: unknown) => tx(t as HTMLElement) + OUT.x * 0.6,
            y: (t: unknown) => ty(t as HTMLElement) + OUT.y * 0.6,
            opacity: 0,
            scale: 0.9,
            rotate: stack ? 3 : 0,
            duration: D * 0.7,
            ease: "inCubic",
            delay: stagger(55),
          },
          0,
        );
        glidePtrs(D * 0.4);
        showEmptyAfter(D * 0.5 + ghostTiles.length * 55);
        break;
      }
      case "highlight": {
        const t = byId(p.id);
        const tintEl = t?.querySelector<HTMLElement>("[data-tint]");
        if (tintEl) {
          utils.set(tintEl, { scaleX: 0 });
          add(tintEl, { scaleX: [0, 1], duration: D * 0.9, ease: "outCubic" }, 0);
        }
        add(t, { scale: 1.06, duration: D * 0.25, ease: "outQuad" }, 0);
        add(t, { scale: 1, duration: D * 0.7, ease: soft }, D * 0.25);
        break;
      }
      case "markIn": {
        const m = el.querySelector<HTMLElement>(`[data-mark="${p.markId}"]`);
        if (m) {
          utils.set(m, { scale: 0.4, opacity: 0, y: -8 });
          add(m, { opacity: 1, duration: D * 0.3, ease: "outQuad" }, 0);
          add(m, { scale: 1, y: 0, duration: D * 1.0, ease: soft }, 0);
        }
        break;
      }
      case "markOut": {
        add(el.querySelector<HTMLElement>("[data-mark-ghost]"), { scale: 0.4, opacity: 0, y: -8, duration: D * 0.6, ease: "inCubic" }, 0);
        break;
      }
      case "arrow": {
        draw(el.querySelector(`[data-arrow-for="${p.id}"]`), 0, D * 1.0);
        break;
      }
      case "dismiss": {
        add(Array.from(el.querySelectorAll<SVGElement>("[data-arrow-ghost]")), { opacity: 0, duration: D * 0.5, ease: "outQuad" }, 0);
        break;
      }
      case "reset": {
        // Elements arrive one by one, oldest first, the same way a push / enqueue would bring them.
        for (const t of live) utils.set(t, { x: tx(t) + IN.x * 0.5, y: ty(t) + IN.y * 0.5, opacity: 0, scale: 0.92 });
        add(live, { opacity: 1, duration: D * 0.4, delay: stagger(60), ease: "outQuad" }, 0);
        add(live, { x: toX, y: toY, scale: 1, duration: D * 1.0, delay: stagger(60), ease: soft }, 0);
        glidePtrs(D * 0.3);
        break;
      }
      case "none":
        break;
    }

    if (added === 0) {
      tl.pause();
      settle();
      queueMicrotask(() => finishAnimation(token));
      return;
    }

    sink.set(tl);
    return () => {
      sink.clear(tl);
      tl.pause();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, anim, reduced, finishAnimation]);

  /* ───────────── render ───────────── */
  const peekItem = n === 0 ? null : stack ? data.items[n - 1] : data.items[0];
  const [emx, emy] = tilePos(kind, 0, 0);
  const e0 = tileSize(kind, 0);
  const chipLeft = stack ? S.LEFT + S.TW / 2 - 80 : chip?.side === "in" ? width - 170 : 6;

  return (
    <section
      ref={host}
      data-stage aria-label={stack ? "Stack stage" : "Queue stage"}
      className="relative overflow-hidden rounded-2xl border border-primary-foreground/10 bg-card/30"
    >
      <div className="flex flex-col gap-5 py-6">
        <div data-chrome className="flex flex-wrap items-end gap-x-10 gap-y-3 px-6">
          <Stat label="elements" value={String(n)} />
          <Stat label={stack ? "top" : "front"} value={peekItem ? fmt(peekItem.value) : "none"} mono={!!peekItem} />
          <Stat label={stack ? "LIFO · last in, first out" : "FIFO · first in, first out"} value={stack ? "Stack" : "Queue"} mono={false} />
        </div>

        <div className="overflow-x-auto px-6 pb-1">
          <div data-stage-root className={cn("relative", stack && "mx-auto")} style={{ width, minWidth: width, height }}>
            {stack ? (
              <>
                <div aria-hidden className="absolute top-0 text-center text-[11px] text-muted-foreground" style={{ left: S.LEFT - 8, width: S.TW + S.GUT + 9 }}>
                  push ↓ &nbsp; pop ↑
                </div>
                {/* open-topped container: two rails and a floor */}
                <div aria-hidden className="absolute w-px bg-primary-foreground/25" style={{ left: S.LEFT - 8, top: S.TOP_PAD - 12, height: STACK_FLOOR_Y - (S.TOP_PAD - 12) }} />
                <div aria-hidden className="absolute w-px bg-primary-foreground/25" style={{ left: S.LEFT + S.TW + S.GUT, top: S.TOP_PAD - 12, height: STACK_FLOOR_Y - (S.TOP_PAD - 12) }} />
                <div aria-hidden className="absolute h-px bg-primary-foreground/40" style={{ left: S.LEFT - 8, width: S.TW + S.GUT + 9, top: STACK_FLOOR_Y }} />
                <div aria-hidden className="absolute text-center font-mono text-[11px] font-semibold tracking-wide text-muted-foreground" style={{ left: S.LEFT - 8, width: S.TW + S.GUT + 9, top: STACK_FLOOR_Y + 10 }}>
                  BOTTOM
                </div>
              </>
            ) : (
              <>
                <div aria-hidden className="absolute inset-x-0 h-px bg-primary-foreground/25" style={{ top: Q.RAIL_T }} />
                <div aria-hidden className="absolute inset-x-0 h-px bg-primary-foreground/25" style={{ top: Q_RAIL_B }} />
                <div aria-hidden className="absolute left-0 top-0 text-[11px] text-muted-foreground">← dequeue</div>
                <div aria-hidden className="absolute right-0 top-0 text-[11px] text-muted-foreground">enqueue ←</div>
              </>
            )}

            {n === 0 && (
              <div
                data-empty
                className={cn("absolute flex items-center justify-center border border-dashed border-primary-foreground/25 text-xs text-muted-foreground", stack ? "rounded-lg" : "rounded-xl")}
                style={{ width: e0.w, height: e0.h, left: emx, top: emy }}
              >
                empty
                <div data-ring aria-hidden className={cn("pointer-events-none absolute -inset-px border-2 opacity-0", stack ? "rounded-lg" : "rounded-xl")} />
              </div>
            )}

            {data.items.map((item, i) => {
              const [x, y] = tilePos(kind, i, n);
              return (
                <Tile
                  key={item.id}
                  kind={kind}
                  item={item}
                  index={i}
                  x={x}
                  y={y}
                  w={sz.w}
                  h={sz.h}
                  data={data}
                  showIndex={showIndex}
                  ghostMarkId={ghostMark?.itemId === item.id ? ghostMark.markId : undefined}
                  ghostArrow={dismissedArrows.find((a) => a.itemId === item.id)}
                />
              );
            })}
            {before &&
              ghosts.map(({ item, index }) => {
                const [x, y] = tilePos(kind, index, prevN);
                const gs = tileSize(kind, prevN);
                return <Tile key={`ghost-${item.id}`} kind={kind} item={item} index={index} x={x} y={y} w={gs.w} h={gs.h} data={before} showIndex={showIndex} ghost />;
              })}

            {ptrs.map((pt) => (
              <Pointer key={pt.name} name={pt.name} kind={kind} x={pt.x} y={pt.y} h={sz.h} color={pt.color} />
            ))}

            {chip && (
              <div className="pointer-events-none absolute z-20 flex justify-center" style={{ left: chipLeft, top: -4, width: 164 }}>
                <span
                  data-chip
                  className="inline-flex h-6 items-center rounded-full border bg-primary-background px-3 font-mono text-[11px] font-semibold opacity-0"
                  style={{ color: chip.color, borderColor: `${chip.color}66` }}
                >
                  {chip.text}
                </span>
              </div>
            )}
          </div>
        </div>

        <p data-chrome className="flex flex-wrap items-center gap-x-5 gap-y-1 px-6 text-[11px] text-muted-foreground">
          <span>{stack ? "Elements sit on top of each other; only the TOP can be added or removed." : "Elements wait in line; add at the REAR, remove from the FRONT."}</span>
          <span className="inline-flex items-center gap-1.5">
            <span style={{ color: INK.purple }}>⚑</span> mark
          </span>
          <span>arrows and fills are annotations</span>
        </p>
      </div>
    </section>
  );
}
