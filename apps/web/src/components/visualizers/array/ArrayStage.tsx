"use client";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { animate, createTimeline, spring, stagger, utils } from "animejs";
import { cn } from "@/lib/utils";
import { useAnimationSettings, useReducedMotion } from "../shared/animationSettings";
import { useTimelineSink } from "../shared/stage/StageEnv";
import { fmt } from "./arrayEngine";
import type * as LabT from "./types";
import type { ArrayState, Arrow, Item, MarkPointer } from "./types";

/* ───────────── layout ───────────── */
export const CELL = 72;
export const GAP = 12;
export const STEP = CELL + GAP;
const LANE_TOP = 64; // pointer lane above the cells
const PILL_H = 22;
const STAGE_H = 290;

/* ───────────── palette ───────────── */
export const INK = {
  accent: "#FF430F",
  blue: "#0070F3",
  green: "#17A34A",
  purple: "#7928CA",
  red: "#E5484D",
};
const PALETTE = [INK.blue, INK.green, INK.purple, "#0891B2", INK.red, "#D97706"];
export function pointerColor(name: string) {
  if (name === "P") return INK.accent;
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}
export const labelW = (name: string) => Math.max(52, 48 + name.length * 8);

type Params = Parameters<typeof animate>[1];
type El = HTMLElement | SVGElement;
type Tgt = El | El[] | null | undefined;
type Pt = [number, number];

/** Arrow color changes glide instead of snapping. */
const COLOR_FADE = "stroke 320ms ease";

/* ───────────── drawing pieces ───────────── */

function arcGeo(a: Pt, b: Pt, ctrl: Pt, head = 8) {
  const ang = Math.atan2(b[1] - ctrl[1], b[0] - ctrl[0]);
  const s = Math.PI / 7;
  const wings = [ang + Math.PI - s, ang + Math.PI + s].map(
    (t) => `M${b[0]} ${b[1]}L${b[0] + Math.cos(t) * head} ${b[1] + Math.sin(t) * head}`,
  );
  return { shaft: `M${a[0]} ${a[1]}Q${ctrl[0]} ${ctrl[1]} ${b[0]} ${b[1]}`, wings };
}

function ArcArrow({ a, b, ctrl, color }: { a: Pt; b: Pt; ctrl: Pt; color: string }) {
  const g = arcGeo(a, b, ctrl);
  return (
    <g
      style={{ stroke: color, transition: COLOR_FADE }}
      strokeWidth={1.75}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path data-draw="shaft" pathLength={1} d={g.shaft} />
      {g.wings.map((d, i) => (
        <path key={i} data-draw="head" pathLength={1} d={d} />
      ))}
    </g>
  );
}

/** Curved from→to arrows. `ghost` arcs are the ones that are leaving. */
function Arcs({ arrows, items, ghost }: { arrows: Arrow[]; items: Item[]; ghost?: boolean }) {
  return (
    <>
      {arrows
        .filter((a) => a.fromItemId)
        .map((a) => {
          const i1 = items.findIndex((i) => i.id === a.fromItemId);
          const i2 = items.findIndex((i) => i.id === a.toItemId);
          if (i1 < 0 || i2 < 0) return null;
          const x1 = i1 * STEP + CELL / 2;
          const x2 = i2 * STEP + CELL / 2;
          const dir = Math.sign(x2 - x1) || 1;
          const yb = LANE_TOP + CELL + 6;
          const from: Pt = [x1 + dir * 14, yb];
          const to: Pt = [x2 - dir * 14, yb + 2];
          const depth = Math.min(70, 26 + Math.abs(x2 - x1) / 5);
          const ctrl: Pt = [(from[0] + to[0]) / 2, yb + depth * 2];
          const attrs = ghost
            ? { "data-arc-ghost": "" }
            : { "data-arrow": "", "data-arrow-for": a.id };
          return (
            <g key={a.id} {...attrs}>
              <ArcArrow a={from} b={to} ctrl={ctrl} color={a.color} />
            </g>
          );
        })}
    </>
  );
}

function MarkerTag({ id, name, ghost }: { id: string; name: string; ghost?: boolean }) {
  const attr = ghost ? { "data-marker-ghost": "" } : { "data-marker": id };
  return (
    <div {...attr} className="flex flex-col items-center" style={{ transformOrigin: "50% 0" }}>
      <span className="h-2 w-px" style={{ background: INK.purple, opacity: 0.6 }} />
      <span
        data-marker-pill
        className="inline-flex h-[22px] items-center gap-1 rounded-full border px-2 font-mono text-[11px] font-semibold"
        style={{ color: INK.purple, borderColor: `${INK.purple}55`, background: `${INK.purple}14` }}
        aria-label={`marker ${name}`}
      >
        <span aria-hidden>⚑</span>
        {/* Exactly ONE string child: the animator swaps textContent, and React
            can only reconcile that safely when it owns a single text node. */}
        <span data-marker-name data-label={name}>
          {name}
        </span>
      </span>
    </div>
  );
}

function Cell(props: {
  item: Item;
  index: number;
  /** State to read annotations from. Ghost cells read the state from *before* the op. */
  data: ArrayState;
  showIndex: boolean;
  ghost?: boolean;
  ghostMarker?: { id: string; name: string };
}) {
  const { item, index, data, showIndex, ghost, ghostMarker } = props;
  const hl = data.highlights[item.id];
  const markers = data.markers.filter((m) => m.itemId === item.id);
  const arrowsTo = data.arrows.filter((a) => !a.fromItemId && a.toItemId === item.id);
  const text = fmt(item.value);
  const fs = text.length > 8 ? 12 : text.length > 5 ? 15 : 20;

  return (
    <div
      data-cell
      data-id={item.id}
      data-index={index}
      data-x={index * STEP}
      data-text={text}
      data-ghost={ghost ? "true" : undefined}
      className="absolute left-0 flex flex-col items-center gap-1.5"
      style={{ width: CELL, top: LANE_TOP }}
    >
      <div className="relative" style={{ width: CELL, height: CELL }} title={text}>
        <div
          data-box
          data-border={hl ? `${hl}99` : ""}
          className="absolute inset-0 overflow-hidden rounded-xl border border-primary-foreground/15 bg-card transition-colors duration-200 hover:border-primary-foreground/35"
          style={hl ? { borderColor: `${hl}99` } : undefined}
        >
          {hl && (
            <div
              data-tint
              className="absolute inset-0 origin-left"
              style={{ background: `linear-gradient(90deg, ${hl}38, ${hl}16)` }}
            />
          )}
          <div className="absolute inset-0 flex items-center justify-center px-2">
            <span
              data-value
              className="block max-w-full truncate font-mono font-semibold tabular-nums"
              style={{ fontSize: fs }}
            >
              {text}
            </span>
          </div>
        </div>
        <div data-ring aria-hidden className="pointer-events-none absolute -inset-px rounded-xl border-2 opacity-0" />
        {hl && (
          <span
            aria-label={`highlighted ${hl}`}
            role="img"
            className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full"
            style={{ background: hl }}
          />
        )}
      </div>

      <div
        aria-hidden={!showIndex}
        className={cn(
          "h-4 font-mono text-[11px] leading-4 text-muted-foreground transition-opacity duration-200",
          showIndex ? "opacity-100" : "opacity-0",
        )}
      >
        {index}
      </div>

      {arrowsTo.length > 0 && (
        <div className="flex gap-1">
          {arrowsTo.map((a) => (
            <svg
              key={a.id}
              data-arrow
              data-arrow-for={a.id}
              width={24}
              height={34}
              className="overflow-visible"
              role="img"
              aria-label="arrow pointing at this cell"
            >
              <g
                style={{ stroke: a.color, transition: COLOR_FADE }}
                strokeWidth={1.75}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path data-draw="shaft" pathLength={1} d="M12 33V6" />
                <path data-draw="head" pathLength={1} d="M6 12L12 5L18 12" />
              </g>
            </svg>
          ))}
        </div>
      )}

      {(markers.length > 0 || ghostMarker) && (
        <div className="flex flex-col items-center gap-0.5">
          {markers.map((m) => (
            <MarkerTag key={m.id} id={m.id} name={m.name} />
          ))}
          {ghostMarker && <MarkerTag id={ghostMarker.id} name={ghostMarker.name} ghost />}
        </div>
      )}
    </div>
  );
}

/** A Mark (index pointer): name pill + stem. Stacked Marks lean toward the cell centre. */
function PointerSprite({
  p,
  off,
  out,
  ghost,
}: {
  p: MarkPointer;
  off: number;
  out: boolean;
  ghost?: boolean;
}) {
  const color = pointerColor(p.name);
  const tipX = CELL / 2 - off * 0.4;
  const stemTop = PILL_H + 2;
  const tipY = LANE_TOP - 3;
  const label = `${p.name}${out ? "?" : ""}`; // ONE string, see MarkerTag
  const attr = ghost ? { "data-pointer-ghost": "" } : { "data-pointer": "" };
  return (
    <div
      {...attr}
      data-name={p.name}
      data-index={p.index}
      data-x={p.index * STEP + off}
      className="absolute left-0 top-0"
      style={{ width: CELL, height: LANE_TOP, transformOrigin: "50% 100%", zIndex: 5 }}
      title={out ? `Mark ${p.name} = ${p.index} (outside the array)` : `Mark ${p.name} = ${p.index}`}
    >
      <div data-bob style={{ height: LANE_TOP }} className="relative">
        <div className="flex justify-center">
          <span
            data-pointer-pill
            className="inline-flex items-center gap-1.5 rounded-full border px-2.5 font-mono text-xs font-semibold"
            style={{
              height: PILL_H,
              color,
              borderColor: `${color}66`,
              background: `${color}14`,
              borderStyle: out ? "dashed" : "solid",
            }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
            <span data-pointer-name data-label={label}>
              {label}
            </span>
            <span className="font-medium opacity-60">{p.index}</span>
          </span>
        </div>
        <svg width={CELL} height={LANE_TOP} className="pointer-events-none absolute inset-0 overflow-visible" aria-hidden>
          <g data-pointer-arrow stroke={color} strokeWidth={1.75} fill="none" strokeLinecap="round" strokeLinejoin="round">
            <path data-draw="shaft" pathLength={1} d={`M${CELL / 2} ${stemTop}L${tipX} ${tipY - 5}`} />
            <path data-draw="head" pathLength={1} d={`M${tipX - 4.5} ${tipY - 5}L${tipX} ${tipY}L${tipX + 4.5} ${tipY - 5}`} />
          </g>
        </svg>
      </div>
    </div>
  );
}

/** Dashed empty slot shown where an out-of-range Mark points. */
function GhostSlot({ index }: { index: number }) {
  return (
    <div
      className="pointer-events-none absolute flex items-center justify-center rounded-xl border border-dashed border-primary-foreground/25 font-mono text-lg text-muted-foreground"
      style={{ left: index * STEP, top: LANE_TOP, width: CELL, height: CELL }}
    >
      ?
    </div>
  );
}

/** Marks that share an index sit side by side instead of overlapping. */
function offsetsFor(pointers: MarkPointer[]) {
  const groups = new Map<number, MarkPointer[]>();
  for (const p of pointers) groups.set(p.index, [...(groups.get(p.index) ?? []), p]);
  const out = new Map<string, number>();
  groups.forEach((list) => {
    const step = Math.max(...list.map((p) => labelW(p.name))) + 8;
    list.forEach((p, i) => out.set(p.name, (i - (list.length - 1) / 2) * step));
  });
  return out;
}

/* ───────────── stage ───────────── */

/** Plans during which the curved arrows hide, because cells are travelling. */
const MOVING = new Set(["insert", "remove", "clear", "swap", "reset"]);

/** What a stage needs to draw one structure. The old labs feed it from their store; the shared canvas feeds it directly. */
export interface ArrayStageViewProps {
  data: LabT.ArrayState;
  anim: { token: number; plan: LabT.Anim } | null;
  status: "ready" | "animating" | "paused";
  showIndex: boolean;
  finishAnimation: (token: number) => void;
}

export function ArrayStageView({ data, anim, status, showIndex, finishAnimation }: ArrayStageViewProps) {
  const sink = useTimelineSink();
  const reduced = useReducedMotion();

  const root = useRef<HTMLDivElement>(null);
  const prevX = useRef(new Map<string, number>());
  const prevP = useRef(new Map<string, number>());

  const plan = anim?.plan ?? null;
  /** State from before the op, present only for plans that make things leave. */
  const before = plan && "prev" in plan ? plan.prev : null;

  const ptrOffsets = useMemo(() => offsetsFor(data.pointers), [data.pointers]);
  const ghostOffsets = useMemo(() => (before ? offsetsFor(before.pointers) : new Map<string, number>()), [before]);

  /* Everything that is leaving, drawn from the *previous* state so it can fade out. */
  const ghostItems: { item: Item; index: number }[] =
    plan?.kind === "remove"
      ? [plan.ghost]
      : plan?.kind === "clear"
        ? plan.prev.items.map((item, index) => ({ item, index }))
        : [];
  const ghostPointers = before
    ? before.pointers.filter((p) => !data.pointers.some((x) => x.name === p.name))
    : [];
  const ghostArcs = before
    ? before.arrows.filter((a) => a.fromItemId && !data.arrows.some((x) => x.id === a.id))
    : [];

  useLayoutEffect(() => {
    const host = root.current;
    if (!host) return;

    const all = Array.from(host.querySelectorAll<HTMLElement>("[data-cell]"));
    const live = all.filter((c) => c.dataset.ghost !== "true");
    const ghostCells = all.filter((c) => c.dataset.ghost === "true");
    const ptrs = Array.from(host.querySelectorAll<HTMLElement>("[data-pointer]"));
    const ghostPtrs = Array.from(host.querySelectorAll<HTMLElement>("[data-pointer-ghost]"));
    const ghostArcEls = Array.from(host.querySelectorAll<SVGElement>("[data-arc-ghost]"));
    const tx = (n: HTMLElement) => Number(n.dataset.x);
    const toX = (t: unknown) => tx(t as HTMLElement);
    const byId = (id: string) => live.find((c) => c.dataset.id === id);
    const cellAt = (i: string | undefined) => live.find((c) => c.dataset.index === i);

    const clearDash = () =>
      host.querySelectorAll<SVGElement>("[data-draw]").forEach((e) => {
        e.style.strokeDasharray = "";
        e.style.strokeDashoffset = "";
      });
    /** Hide a stroke so it can be drawn on (pathLength is normalised to 1). */
    const prep = (e: SVGElement) => {
      e.style.strokeDasharray = "1";
      e.style.strokeDashoffset = "1";
    };

    /** Snap everything to the data model's layout and remember positions. */
    const settle = () => {
      for (const c of live) {
        utils.set(c, { x: tx(c), y: 0, scale: 1, opacity: 1, rotate: 0 });
        const v = c.querySelector<HTMLElement>("[data-value]");
        if (v) {
          v.textContent = c.dataset.text ?? "";
          utils.set(v, { opacity: 1, y: 0 });
        }
        const ring = c.querySelector<HTMLElement>("[data-ring]");
        if (ring) utils.set(ring, { opacity: 0, scale: 1 });
        const tint = c.querySelector<HTMLElement>("[data-tint]");
        if (tint) utils.set(tint, { scaleX: 1, opacity: 1 });
        // Restore the highlight border (or none) that React rendered.
        const box = c.querySelector<HTMLElement>("[data-box]");
        if (box) box.style.borderColor = box.dataset.border ?? "";
      }
      for (const p of ptrs) utils.set(p, { x: tx(p), scale: 1, opacity: 1, rotate: 0 });
      host.querySelectorAll<HTMLElement>("[data-marker-name],[data-pointer-name]").forEach((l) => {
        l.textContent = l.dataset.label ?? "";
        utils.set(l, { opacity: 1, y: 0 });
      });
      host.querySelectorAll("[data-marker-pill],[data-pointer-pill]").forEach((e) => utils.set(e, { scale: 1 }));
      const marks = host.querySelectorAll("[data-marker],[data-marker-ghost]");
      if (marks.length) utils.set(marks, { scale: 1, opacity: 1, y: 0, rotate: 0 });
      const arrows = host.querySelectorAll("[data-arrow]");
      if (arrows.length) utils.set(arrows, { opacity: 1 });
      clearDash();
      prevX.current = new Map(live.map((c) => [c.dataset.id!, tx(c)]));
      prevP.current = new Map(ptrs.map((p) => [p.dataset.name!, tx(p)]));
    };

    if (!anim) {
      settle();
      return;
    }

    const { plan, token } = anim;
    const { duration: D, speed } = useAnimationSettings.getState();
    if (reduced || D <= 0) {
      settle();
      queueMicrotask(() => finishAnimation(token));
      return;
    }

    // A renamed Mark keeps its on-screen position instead of re-entering as a new one.
    if (plan.kind === "pointerRename") {
      const px = prevP.current.get(plan.from);
      if (px !== undefined) prevP.current.set(plan.to, px);
    }

    // Start every element at its previous position; new ones start at their target.
    for (const c of live) utils.set(c, { x: prevX.current.get(c.dataset.id!) ?? tx(c) });
    for (const g of ghostCells) utils.set(g, { x: tx(g) });
    for (const g of ghostPtrs) utils.set(g, { x: tx(g) });
    for (const p of ptrs) utils.set(p, { x: prevP.current.get(p.dataset.name!) ?? tx(p) });

    const moved = live.filter((c) => {
      const p = prevX.current.get(c.dataset.id!);
      return p !== undefined && p !== tx(c);
    });
    const newPtrs = ptrs.filter((p) => !prevP.current.has(p.dataset.name!));
    const movedPtrs = ptrs.filter((p) => {
      const q = prevP.current.get(p.dataset.name!);
      return q !== undefined && q !== tx(p);
    });

    const soft = spring({ bounce: 0.3, duration: D });
    const snap = spring({ bounce: 0.12, duration: D * 0.9 });

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
    /** Expanding ring pulse around a cell. */
    const pulse = (cell: HTMLElement | undefined, color: string, at: number) => {
      const ring = cell?.querySelector<HTMLElement>("[data-ring]");
      if (!ring) return;
      ring.style.borderColor = color;
      add(ring, { scale: [1, 1.3], opacity: [0.75, 0], duration: D * 1.3, ease: "outQuad" }, at);
    };
    /** Slot-machine text swap: old text leaves upward, new text rises in. */
    const swapText = (el: HTMLElement, from: string, at: number, dir = 1) => {
      el.textContent = from;
      add(el, { y: [0, -10 * dir], opacity: [1, 0], duration: D * 0.3, ease: "inCubic" }, at);
      call(() => {
        el.textContent = el.dataset.label ?? el.textContent;
      }, at + D * 0.3);
      add(el, { y: [10 * dir, 0], opacity: [0, 1], duration: D * 0.55, ease: soft }, at + D * 0.3);
    };
    /** Pen-draw every stroke under `scope`: shafts first, arrowheads last. */
    const draw = (scope: Element | null, at: number, span = D * 0.8) => {
      if (!scope) return;
      const body = Array.from(scope.querySelectorAll<SVGElement>('[data-draw="shaft"]'));
      const tips = Array.from(scope.querySelectorAll<SVGElement>('[data-draw="head"]'));
      [...body, ...tips].forEach(prep);
      add(body, { strokeDashoffset: [1, 0], duration: span, ease: "outQuad" }, at);
      add(tips, { strokeDashoffset: [1, 0], duration: D * 0.25, ease: "outQuad" }, at + span * 0.85);
    };
    const reddenBox = (cells: HTMLElement[]) =>
      cells.forEach((g) => {
        const b = g.querySelector<HTMLElement>("[data-box]");
        if (b) b.style.borderColor = INK.red;
      });

    switch (plan.kind) {
      case "insert": {
        const fresh = byId(plan.id);
        if (fresh) utils.set(fresh, { scale: 0.6, opacity: 0, y: -24 });
        add(moved, { x: toX, ease: snap, delay: stagger(30) }, 0);
        const at = moved.length ? D * 0.15 : 0;
        add(fresh, { opacity: 1, duration: D * 0.35, ease: "outQuad" }, at);
        add(fresh, { y: 0, scale: 1, duration: D * 1.1, ease: soft }, at);
        pulse(fresh, INK.green, at + D * 0.25);
        break;
      }
      case "remove": {
        reddenBox(ghostCells);
        pulse(ghostCells[0], INK.red, 0);
        add(ghostCells, { opacity: 0, scale: 0.7, y: -14, duration: D * 0.7, ease: "inCubic" }, D * 0.15);
        add(moved, { x: toX, ease: snap, delay: stagger(30) }, ghostCells.length ? D * 0.4 : 0);
        break;
      }
      case "clear": {
        // Everything leaves together: cells, and with them their markers, arrows and highlights.
        reddenBox(ghostCells);
        add(
          ghostCells,
          { opacity: 0, scale: 0.7, y: -18, duration: D * 0.75, ease: "inCubic", delay: stagger(45) },
          D * 0.1,
        );
        break;
      }
      case "update": {
        const c = byId(plan.id);
        const span = c?.querySelector<HTMLElement>("[data-value]");
        if (c && span) {
          const next = c.dataset.text ?? "";
          span.textContent = fmt(plan.oldValue);
          add(span, { y: [0, -22], opacity: [1, 0], duration: D * 0.35, ease: "inCubic" }, 0);
          call(() => {
            span.textContent = next;
          }, D * 0.35);
          add(span, { y: [22, 0], opacity: [0, 1], duration: D * 0.65, ease: soft }, D * 0.35);
          add(c, { scale: 1.06, duration: D * 0.2, ease: "outQuad" }, D * 0.3);
          add(c, { scale: 1, duration: D * 0.7, ease: soft }, D * 0.5);
          pulse(c, INK.accent, D * 0.3);
        }
        break;
      }
      case "read": {
        const c = byId(plan.id);
        if (c) {
          add(c, { y: -6, duration: D * 0.3, ease: "outQuad" }, 0);
          add(c, { y: 0, duration: D * 0.8, ease: soft }, D * 0.35);
          pulse(c, INK.blue, 0);
          pulse(c, INK.blue, D * 0.4);
        }
        break;
      }
      case "highlight": {
        const c = byId(plan.id);
        const tint = c?.querySelector<HTMLElement>("[data-tint]");
        if (tint) {
          utils.set(tint, { scaleX: 0 });
          add(tint, { scaleX: [0, 1], duration: D * 0.9, ease: "outCubic" }, 0);
        }
        add(c, { scale: 1.08, duration: D * 0.25, ease: "outQuad" }, 0);
        add(c, { scale: 1, duration: D * 0.7, ease: soft }, D * 0.25);
        pulse(c, data.highlights[plan.id] ?? INK.accent, 0);
        break;
      }
      case "swap": {
        const a = byId(plan.a);
        const b = byId(plan.b);
        if (a && b) {
          // a arcs over the top, b ducks underneath
          add(a, { y: -34, rotate: -5, duration: D * 0.3, ease: "outQuad" }, 0);
          add(b, { y: 34, rotate: 5, duration: D * 0.3, ease: "outQuad" }, 0);
          add([a, b], { x: toX, duration: D * 0.7, ease: snap }, D * 0.15);
          add([a, b], { y: 0, rotate: 0, duration: D * 0.7, ease: soft }, D * 0.5);
          pulse(a, INK.blue, D * 0.6);
          pulse(b, INK.blue, D * 0.6);
        }
        break;
      }
      case "markerIn": {
        const m = host.querySelector<HTMLElement>(`[data-marker="${plan.id}"]`);
        if (m) {
          utils.set(m, { scale: 0.4, opacity: 0, y: -16 });
          add(m, { opacity: 1, duration: D * 0.3, ease: "outQuad" }, 0);
          add(m, { scale: 1, y: 0, duration: D * 1.1, ease: soft }, 0);
        }
        break;
      }
      case "markerOut": {
        const g = host.querySelector<HTMLElement>("[data-marker-ghost]");
        add(g, { scale: 0.4, opacity: 0, y: -10, duration: D * 0.6, ease: "inCubic" }, 0);
        break;
      }
      case "markerRename": {
        const m = host.querySelector<HTMLElement>(`[data-marker="${plan.id}"]`);
        const label = m?.querySelector<HTMLElement>("[data-marker-name]");
        const pill = m?.querySelector<HTMLElement>("[data-marker-pill]");
        if (label && pill) {
          swapText(label, plan.from, 0);
          add(pill, { scale: 1.12, duration: D * 0.25, ease: "outQuad" }, D * 0.2);
          add(pill, { scale: 1, duration: D * 0.7, ease: soft }, D * 0.45);
        }
        break;
      }
      case "pointerRename": {
        const p = ptrs.find((x) => x.dataset.name === plan.to);
        const label = p?.querySelector<HTMLElement>("[data-pointer-name]");
        const pill = p?.querySelector<HTMLElement>("[data-pointer-pill]");
        if (label && pill) {
          swapText(label, plan.from, 0);
          add(pill, { scale: 1.12, duration: D * 0.25, ease: "outQuad" }, D * 0.2);
          add(pill, { scale: 1, duration: D * 0.7, ease: soft }, D * 0.45);
        }
        break;
      }
      case "arrow": {
        draw(host.querySelector(`[data-arrow-for="${plan.id}"]`), 0, D * 1.0);
        break;
      }
      case "reset": {
        for (const c of live) utils.set(c, { x: tx(c), opacity: 0, scale: 0.8, y: 16 });
        add(live, { opacity: 1, duration: D * 0.4, delay: stagger(45), ease: "outQuad" }, 0);
        add(live, { scale: 1, y: 0, duration: D * 1.0, delay: stagger(45), ease: soft }, 0);
        break;
      }
      case "pointer":
      case "dismiss":
      case "none":
        break;
    }

    /* Marks (index pointers): glide with spring, lean into the move, ping the target cell. */
    if (plan.kind === "reset") {
      for (const p of ptrs) utils.set(p, { x: tx(p), scale: 0, opacity: 0 });
      add(ptrs, { scale: 1, opacity: 1, duration: D * 0.9, ease: soft, delay: stagger(80) }, D * 0.4);
    } else {
      for (const p of movedPtrs) {
        const dir = Math.sign(tx(p) - (prevP.current.get(p.dataset.name!) ?? tx(p)));
        add(p, { x: tx(p), duration: D * 1.0, ease: snap }, 0);
        if (plan.kind === "pointer") {
          add(p, { rotate: -dir * 8, duration: D * 0.35, ease: "outQuad" }, 0);
          add(p, { rotate: 0, duration: D * 0.8, ease: soft }, D * 0.35);
          const target = cellAt(p.dataset.index);
          add(target, { y: -6, duration: D * 0.2, ease: "outQuad" }, D * 0.75);
          add(target, { y: 0, duration: D * 0.7, ease: soft }, D * 0.95);
          pulse(target, pointerColor(p.dataset.name ?? ""), D * 0.8);
        }
      }
      if (plan.kind === "pointer" && newPtrs.length) {
        utils.set(newPtrs, { scale: 0.4, opacity: 0 });
        add(newPtrs, { opacity: 1, duration: D * 0.3, ease: "outQuad" }, 0);
        add(newPtrs, { scale: 1, duration: D * 1.0, ease: soft }, 0);
        for (const p of newPtrs) draw(p.querySelector("[data-pointer-arrow]"), D * 0.2, D * 0.6);
      }
    }

    /* Leaving Marks and curved arrows (from clear, removeMark, clearArrows, delete). */
    add(ghostPtrs, { opacity: 0, scale: 0.6, y: -10, duration: D * 0.6, ease: "inCubic" }, 0);
    add(ghostArcEls, { opacity: 0, duration: D * 0.5, ease: "outQuad" }, 0);

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

  /* Idle life: Marks gently float while nothing else is animating. */
  useEffect(() => {
    const host = root.current;
    if (!host || reduced || status !== "ready") return;
    const bobs = Array.from(host.querySelectorAll<HTMLElement>("[data-bob]"));
    if (!bobs.length) return;
    const anims = bobs.map((b, i) =>
      animate(b, { y: [0, -3], duration: 2100, delay: i * 360, alternate: true, loop: true, ease: "inOutSine" }),
    );
    return () => anims.forEach((a) => a.revert());
  }, [reduced, status, data.pointers]);

  const len = data.items.length;
  const maxPtr = Math.max(-1, ...data.pointers.map((p) => p.index));
  // Keep the stage as wide as the previous layout while things are leaving, so nothing is clipped.
  const prevSlots = before ? Math.max(before.items.length, ...before.pointers.map((p) => p.index + 1)) : 0;
  const slots = Math.max(len, maxPtr + 1, prevSlots, 1);
  const width = slots * STEP - GAP;
  const ghostMarker = plan?.kind === "markerOut" ? plan : null;
  const overlayHidden = plan ? MOVING.has(plan.kind) : false;
  const emptySlots = Array.from(new Set(data.pointers.filter((p) => p.index >= len).map((p) => p.index)));

  return (
    <section
      data-stage aria-label="Array stage"
      className="relative overflow-hidden rounded-2xl border border-primary-foreground/10 bg-card/40"
    >
      {/* quiet dot grid */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            "radial-gradient(color-mix(in oklab, currentColor 16%, transparent) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
          maskImage: "radial-gradient(ellipse at 30% 40%, black 30%, transparent 85%)",
          WebkitMaskImage: "radial-gradient(ellipse at 30% 40%, black 30%, transparent 85%)",
        }}
      />
      <div className="relative">
        <div data-chrome className="flex items-center gap-2 px-5 pt-4">
          <span className="inline-flex h-6 items-center rounded-md border border-primary-foreground/15 bg-primary-background px-2 font-mono text-xs font-semibold">
            A
          </span>
          <span className="font-mono text-xs text-muted-foreground">
            {len === 0 ? "empty" : `${len} ${len === 1 ? "element" : "elements"}`}
          </span>
        </div>

        <div className="overflow-x-auto px-6 pb-2">
          {/* Left-aligned on purpose: a centred stage re-centres every time the length changes,
              which made every cell jump sideways at the start of each animation. */}
          <div ref={root} className="relative" style={{ width, minWidth: width, height: STAGE_H }}>
            {emptySlots.map((i) => (
              <GhostSlot key={i} index={i} />
            ))}

            {data.items.map((item, i) => (
              <Cell
                key={item.id}
                item={item}
                index={i}
                data={data}
                showIndex={showIndex}
                ghostMarker={
                  ghostMarker?.itemId === item.id ? { id: ghostMarker.markerId, name: ghostMarker.name } : undefined
                }
              />
            ))}

            {before &&
              ghostItems.map(({ item, index }) => (
                <Cell key={`ghost-${item.id}`} item={item} index={index} data={before} showIndex={showIndex} ghost />
              ))}

            {/* curved from→to arrows, under the cells */}
            <svg
              aria-hidden
              className="pointer-events-none absolute inset-0 overflow-visible transition-opacity duration-300"
              style={{ opacity: overlayHidden ? 0 : 1 }}
              width={width}
              height={STAGE_H}
            >
              <Arcs arrows={data.arrows} items={data.items} />
            </svg>
            {before && ghostArcs.length > 0 && (
              <svg aria-hidden className="pointer-events-none absolute inset-0 overflow-visible" width={width} height={STAGE_H}>
                <Arcs arrows={ghostArcs} items={before.items} ghost />
              </svg>
            )}

            {data.pointers.map((p) => (
              <PointerSprite key={p.name} p={p} off={ptrOffsets.get(p.name) ?? 0} out={p.index >= len} />
            ))}
            {before &&
              ghostPointers.map((p) => (
                <PointerSprite
                  key={`ghost-${p.name}`}
                  p={p}
                  off={ghostOffsets.get(p.name) ?? 0}
                  out={p.index >= before.items.length}
                  ghost
                />
              ))}
          </div>
        </div>

        {len === 0 && (
          <p data-chrome className="px-5 pb-1 text-sm text-muted-foreground">
            Nothing here yet. Run <code className="font-mono text-primary-foreground">append</code> or{" "}
            <code className="font-mono text-primary-foreground">initialize</code> to add elements.
          </p>
        )}

      </div>
    </section>
  );
}