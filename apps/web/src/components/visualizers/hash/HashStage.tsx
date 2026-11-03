"use client";
import { useLayoutEffect, useRef } from "react";
import { animate, createTimeline, spring, stagger, utils } from "animejs";
import { cn } from "@/lib/utils";
import { useAnimationSettings, useReducedMotion } from "../shared/animationSettings";
import { useTimelineSink } from "../shared/stage/StageEnv";
import { fmt } from "./hashEngine";
import { MAX_LOAD_FACTOR, fmtLoad, hashOf, hex, loadFactor } from "./hashing";
import HashPipeline from "./HashPipeline";
import type * as LabT from "./types";
import { sizeOf } from "./tableModel";
import type { Entry, EntryArrow, TableState } from "./types";

/* ───────────── layout ───────────── */
export const COL = 112; // pitch of one bucket column
const GUTTER = 20; // room for an arrow to the left of a tile
const TILE_W = 80;
const TILE_H = 52;
const ROW = 64;
const HEAD = 44; // index labels + rail
const RAIL_Y = 32;
const MIN_ROWS = 2;

export const bx = (bucket: number) => bucket * COL + GUTTER;
export const pos = (bucket: number, slot: number): [number, number] => [bx(bucket), HEAD + 6 + slot * ROW];

const INK = {
  accent: "#FF430F",
  blue: "#0070F3",
  green: "#17A34A",
  purple: "#7928CA",
  red: "#E5484D",
  amber: "#D97706",
};
const COLOR_FADE = "stroke 320ms ease";

type Params = Parameters<typeof animate>[1];
type El = HTMLElement | SVGElement;
type Tgt = El | El[] | null | undefined;

const maxLen = (s: TableState) => Math.max(0, ...s.buckets.map((b) => b.length));

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
  entry: Entry;
  x: number;
  y: number;
  data: TableState;
  ghost?: boolean;
  ghostMarkId?: string;
  ghostArrow?: EntryArrow;
}) {
  const { entry, x, y, data, ghost, ghostMarkId, ghostArrow } = props;
  const isMap = data.kind === "map";
  const hl = data.highlights[entry.id];
  const marks = data.marks.filter((m) => m.entryId === entry.id);
  const arrow = data.arrows.find((a) => a.entryId === entry.id);
  const keyText = fmt(entry.key);
  const valText = isMap ? fmt(entry.value) : keyText;
  const fs = valText.length > 9 ? 12 : valText.length > 6 ? 14 : 16;
  const h = hashOf(entry.key);

  return (
    <div
      data-tile
      data-id={entry.id}
      data-x={x}
      data-y={y}
      data-text={valText}
      data-ghost={ghost ? "true" : undefined}
      className="absolute left-0 top-0"
      style={{ width: TILE_W, height: TILE_H }}
      title={`${keyText}${isMap ? ` → ${valText}` : ""}\nhash ${hex(h)}`}
    >
      <div
        data-box
        data-border={hl ? `${hl}99` : ""}
        className="absolute inset-0 overflow-hidden rounded-[11px] border border-primary-foreground/[0.14] bg-card shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-[border-color,box-shadow] duration-200 hover:border-primary-foreground/35 hover:shadow-[0_4px_14px_rgba(0,0,0,0.08)]"
        style={hl ? { borderColor: `${hl}99` } : undefined}
      >
        {hl && (
          <div
            data-tint
            className="absolute inset-0 origin-left"
            style={{ background: `linear-gradient(90deg, ${hl}38, ${hl}14)` }}
          />
        )}
        <div className={cn("absolute inset-0 flex flex-col justify-center px-2.5", isMap ? "items-start gap-0.5" : "items-center")}>
          {isMap && (
            <span className="block w-full truncate font-mono text-[10px] leading-3 text-muted-foreground">{keyText}</span>
          )}
          <span
            data-value
            className={cn("block w-full truncate font-mono font-semibold tabular-nums leading-5", isMap ? "text-left" : "text-center")}
            style={{ fontSize: fs }}
          >
            {valText}
          </span>
        </div>
      </div>
      <div data-ring aria-hidden className="pointer-events-none absolute -inset-px rounded-xl border-2 opacity-0" />

      {(marks.length > 0 || ghostMarkId) && (
        <div className="absolute -top-2.5 right-1.5 z-10 flex gap-1">
          {marks.map((m) => (
            <MarkPill key={m.id} id={m.id} />
          ))}
          {ghostMarkId && <MarkPill id={ghostMarkId} ghost />}
        </div>
      )}

      {(arrow || ghostArrow) && (
        <svg
          {...(arrow ? { "data-arrow": "", "data-arrow-for": arrow.id } : { "data-arrow-ghost": "" })}
          width={GUTTER}
          height={TILE_H}
          viewBox={`0 0 ${GUTTER} ${TILE_H}`}
          className="pointer-events-none absolute overflow-visible"
          style={{ left: -GUTTER, top: 0 }}
          role="img"
          aria-label="arrow pointing at this entry"
        >
          <g
            style={{ stroke: (arrow ?? ghostArrow)!.color, transition: COLOR_FADE }}
            strokeWidth={1.75}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path data-draw="shaft" pathLength={1} d={`M1 ${TILE_H / 2}H${GUTTER - 4}`} />
            <path data-draw="head" pathLength={1} d={`M${GUTTER - 10} ${TILE_H / 2 - 4.5}L${GUTTER - 3} ${TILE_H / 2}L${GUTTER - 10} ${TILE_H / 2 + 4.5}`} />
          </g>
        </svg>
      )}
    </div>
  );
}

function Stat({ label, value, children }: { label: string; value: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-mono text-xl font-semibold leading-none tabular-nums">{value}</span>
      <span className="flex items-center gap-2 text-[11px] leading-none text-muted-foreground">
        {label}
        {children}
      </span>
    </div>
  );
}

/* ───────────── stage ───────────── */

/** What a stage needs to draw one structure. The old labs feed it from their store; the shared canvas feeds it directly. */
export interface HashStageViewProps {
  kind: LabT.Kind;
  data: LabT.TableState;
  trace: LabT.Trace | null;
  anim: { token: number; plan: LabT.Anim } | null;
  showIndex: boolean;
  finishAnimation: (token: number) => void;
}

export function HashStageView({ kind, data, trace, anim, showIndex, finishAnimation }: HashStageViewProps) {
  const sink = useTimelineSink();
  const reduced = useReducedMotion();

  const host = useRef<HTMLElement>(null);
  const prevPos = useRef(new Map<string, [number, number]>());
  const lastCursor = useRef<number | null>(null);

  const plan = anim?.plan ?? null;
  const before = plan && "prev" in plan ? plan.prev : null;

  /* Everything that is leaving is drawn from the state before the op so it can fade out. */
  const ghosts: { entry: Entry; bucket: number; slot: number }[] =
    plan?.kind === "remove"
      ? [plan.ghost]
      : plan?.kind === "clear"
        ? plan.prev.buckets.flatMap((b, bucket) => b.map((entry, slot) => ({ entry, bucket, slot })))
        : [];
  const ghostMark = plan?.kind === "markOut" ? plan : null;
  const dismissedArrows = plan?.kind === "dismiss" ? plan.prev.arrows : [];

  useLayoutEffect(() => {
    const el = host.current;
    if (!el) return;

    const tiles = Array.from(el.querySelectorAll<HTMLElement>("[data-tile]"));
    const live = tiles.filter((t) => t.dataset.ghost !== "true");
    const ghostTiles = tiles.filter((t) => t.dataset.ghost === "true");
    const cols = Array.from(el.querySelectorAll<HTMLElement>("[data-col]"));
    const idxs = Array.from(el.querySelectorAll<HTMLElement>("[data-idx]"));
    const brackets = Array.from(el.querySelectorAll<HTMLElement>("[data-bracket]"));
    const cursor = el.querySelector<HTMLElement>("[data-cursor]");
    const pipes = Array.from(el.querySelectorAll<SVGElement | HTMLElement>("[data-pipe],[data-pipe-arrow]"));
    const progress = el.querySelector<HTMLElement>("[data-pipe-progress]");
    const resizeChip = el.querySelector<HTMLElement>("[data-pipe-resize]");
    const tx = (n: HTMLElement) => Number(n.dataset.x);
    const ty = (n: HTMLElement) => Number(n.dataset.y);
    const toX = (t: unknown) => tx(t as HTMLElement);
    const toY = (t: unknown) => ty(t as HTMLElement);
    const byId = (id: string) => live.find((t) => t.dataset.id === id);
    const bucketOfTile = (t: HTMLElement) => Math.round((tx(t) - GUTTER) / COL);

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
        utils.set(t, { x: tx(t), y: ty(t), scale: 1, opacity: 1, rotate: 0 });
        const v = t.querySelector<HTMLElement>("[data-value]");
        if (v) {
          v.textContent = t.dataset.text ?? "";
          utils.set(v, { opacity: 1, y: 0 });
        }
        const ring = t.querySelector<HTMLElement>("[data-ring]");
        if (ring) utils.set(ring, { opacity: 0, scale: 1 });
        const tint = t.querySelector<HTMLElement>("[data-tint]");
        if (tint) utils.set(tint, { scaleX: 1, opacity: 1 });
        const box = t.querySelector<HTMLElement>("[data-box]");
        if (box) box.style.borderColor = box.dataset.border ?? "";
      }
      if (cols.length) utils.set(cols, { scale: 1, opacity: 1 });
      if (idxs.length) utils.set(idxs, { opacity: 1, y: 0 });
      if (brackets.length) utils.set(brackets, { scaleY: 1, opacity: 1 });
      el.querySelectorAll<HTMLElement>("[data-glow]").forEach((g) => utils.set(g, { opacity: 0 }));
      if (cursor) utils.set(cursor, { opacity: 0 });
      if (pipes.length) utils.set(pipes, { opacity: 1, y: 0 });
      if (progress) utils.set(progress, { scaleX: 1 });
      if (resizeChip) utils.set(resizeChip, { opacity: 1, scale: 1 });
      const marks = el.querySelectorAll("[data-mark],[data-mark-ghost]");
      if (marks.length) utils.set(marks, { scale: 1, opacity: 1, y: 0 });
      const arrows = el.querySelectorAll("[data-arrow]");
      if (arrows.length) utils.set(arrows, { opacity: 1 });
      clearDash();
      prevPos.current = new Map(live.map((t) => [t.dataset.id!, [tx(t), ty(t)] as [number, number]]));
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

    /* Start every tile where it was; new ones start at their target. */
    const startOf = (t: HTMLElement): [number, number] => prevPos.current.get(t.dataset.id!) ?? [tx(t), ty(t)];
    for (const t of live) {
      const [sx, sy] = startOf(t);
      utils.set(t, { x: sx, y: sy });
    }
    for (const g of ghostTiles) utils.set(g, { x: tx(g), y: ty(g) });
    const moved = live.filter((t) => {
      const [sx, sy] = startOf(t);
      return sx !== tx(t) || sy !== ty(t);
    });

    const soft = spring({ bounce: 0.28, duration: D });
    const snap = spring({ bounce: 0.1, duration: D * 0.9 });

    /* The hashing formula plays first (input › hash › bucket › result), then the table reacts. */
    const pipeStep = D * 0.07;
    const pipeTotal = D * 0.4 + pipeStep * Math.max(0, pipes.length - 1);
    const base = trace && pipes.length ? pipeTotal * 0.8 : 0;

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
    const addRaw = (targets: Tgt, params: Params, at: number) => {
      if (!targets || (Array.isArray(targets) && targets.length === 0)) return;
      tl.add(targets, params, at);
      added++;
    };
    const add = (targets: Tgt, params: Params, at: number) => addRaw(targets, params, base + at);
    const call = (fn: () => void, at: number) => {
      tl.call(fn, base + at);
      added++;
    };

    if (trace && pipes.length) {
      utils.set(pipes, { opacity: 0, y: 6 });
      addRaw(pipes, { opacity: 1, y: 0, duration: D * 0.4, ease: "outQuad", delay: stagger(pipeStep) }, 0);
      if (progress) {
        utils.set(progress, { scaleX: 0 });
        addRaw(progress, { scaleX: [0, 1], duration: pipeTotal, ease: "inOutQuad" }, 0);
      }
    }
    if (resizeChip) utils.set(resizeChip, { opacity: 0, scale: 0.9 });

    const pulse = (t: HTMLElement | undefined, color: string, at: number) => {
      const ring = t?.querySelector<HTMLElement>("[data-ring]");
      if (!ring) return;
      ring.style.borderColor = color;
      add(ring, { scale: [1, 1.28], opacity: [0.7, 0], duration: D * 1.2, ease: "outQuad" }, at);
    };
    /** Soft vertical wash down a bucket column. */
    const glow = (bucket: number, color: string, at: number) => {
      const g = el.querySelector<HTMLElement>(`[data-glow="${bucket}"]`);
      if (!g) return;
      g.style.background = `linear-gradient(to bottom, ${color}38, ${color}00 80%)`;
      add(g, { opacity: 1, duration: D * 0.3, ease: "outQuad" }, at);
      add(g, { opacity: 0, duration: D * 1.1, ease: "inOutQuad" }, at + D * 0.4);
    };
    /**
     * The bucket cursor: a thin accent bar on the rail that travels from the
     * last bucket it visited to the target, so "hash mod capacity" is visible as a move.
     */
    let cursorOn = false;
    const moveCursor = (to: number, at: number, color = INK.accent, dur = D * 0.9) => {
      if (!cursor) return;
      const from = lastCursor.current ?? to;
      cursor.style.background = color;
      if (!cursorOn) {
        utils.set(cursor, { x: bx(from), opacity: 0 });
        add(cursor, { opacity: 1, duration: D * 0.2, ease: "outQuad" }, at);
        cursorOn = true;
      }
      add(cursor, { x: [bx(from), bx(to)], duration: dur, ease: "outExpo" }, at);
      lastCursor.current = to;
    };
    const cursorOut = (at: number) => cursor && cursorOn && add(cursor, { opacity: 0, duration: D * 0.5, ease: "inQuad" }, at);
    const shake = (at: number) => {
      if (!cursor) return;
      add(cursor, { y: -3, duration: D * 0.1, ease: "outQuad" }, at);
      add(cursor, { y: 3, duration: D * 0.14, ease: "inOutQuad" }, at + D * 0.1);
      add(cursor, { y: 0, duration: D * 0.3, ease: soft }, at + D * 0.24);
    };
    const draw = (scope: Element | null, at: number, span = D * 0.8) => {
      if (!scope) return;
      const body = Array.from(scope.querySelectorAll<SVGElement>('[data-draw="shaft"]'));
      const tips = Array.from(scope.querySelectorAll<SVGElement>('[data-draw="head"]'));
      [...body, ...tips].forEach(prep);
      add(body, { strokeDashoffset: [1, 0], duration: span, ease: "outQuad" }, at);
      add(tips, { strokeDashoffset: [1, 0], duration: D * 0.25, ease: "outQuad" }, at + span * 0.85);
    };
    const reddenBox = (ts: HTMLElement[]) =>
      ts.forEach((g) => {
        const b = g.querySelector<HTMLElement>("[data-box]");
        if (b) b.style.borderColor = INK.red;
      });
    /** Tiles glide to their new spot with a small lift, so they read as travelling, not teleporting. */
    const slide = (ts: HTMLElement[], at: number, dur = D * 1.0) => {
      add(ts, { x: toX, y: toY, ease: snap, duration: dur, delay: stagger(35) }, at);
      add(ts, { scale: 1.05, duration: dur * 0.3, ease: "outQuad", delay: stagger(35) }, at);
      add(ts, { scale: 1, duration: dur * 0.6, ease: soft, delay: stagger(35) }, at + dur * 0.3);
    };
    const growBracket = (bucket: number, n: number, at: number) => {
      const b = el.querySelector<HTMLElement>(`[data-bracket="${bucket}"]`);
      if (!b) return;
      utils.set(b, { scaleY: n > 2 ? (n - 1) / n : 0 });
      add(b, { scaleY: 1, duration: D * 0.7, ease: soft }, at);
    };

    switch (p.kind) {
      case "insert": {
        const fresh = byId(p.id);
        const [fx, fy] = pos(p.placed.bucket, p.placed.slot); // where it lands before any resize
        moveCursor(p.placed.bucket, 0, p.collided ? INK.amber : INK.accent);
        glow(p.placed.bucket, p.collided ? INK.amber : INK.green, D * 0.5);
        if (fresh) utils.set(fresh, { x: fx, y: fy - 30, scale: 0.85, opacity: 0 });
        const land = D * 0.75;
        add(fresh, { opacity: 1, duration: D * 0.35, ease: "outQuad" }, land);
        add(fresh, { y: fy, scale: 1, duration: D * 1.1, ease: soft }, land);
        pulse(fresh, p.collided ? INK.amber : INK.green, land + D * 0.35);
        if (p.collided) {
          // Neighbours in the same bucket nudge aside: that is the collision.
          const crowd = live.filter((t) => t !== fresh && tx(t) === fx && startOf(t)[0] === fx);
          crowd.forEach((t, i) => {
            pulse(t, INK.amber, land + D * 0.2 + i * 50);
            add(t, { x: tx(t) + 5, duration: D * 0.15, ease: "outQuad" }, land + D * 0.3);
            add(t, { x: tx(t), duration: D * 0.5, ease: soft }, land + D * 0.45);
          });
          growBracket(p.placed.bucket, p.placed.slot + 1, land + D * 0.4);
        }
        let end = land + D * 1.2;

        if (p.resize) {
          // Phase 2: capacity doubles, new buckets appear, every entry glides to hash mod new capacity.
          const at = end + D * 0.2;
          const newCols = cols.filter((c) => Number(c.dataset.col) >= p.resize!.from);
          const newIdx = idxs.filter((c) => Number(c.dataset.idx) >= p.resize!.from);
          if (newCols.length) utils.set(newCols, { opacity: 0 });
          if (newIdx.length) utils.set(newIdx, { opacity: 0, y: -6 });
          if (brackets.length) utils.set(brackets, { scaleY: 0 });
          add(newCols, { opacity: 1, duration: D * 0.6, ease: "outQuad", delay: stagger(40) }, at);
          add(newIdx, { opacity: 1, y: 0, duration: D * 0.6, ease: soft, delay: stagger(40) }, at);
          if (resizeChip) add(resizeChip, { opacity: 1, scale: 1, duration: D * 0.5, ease: soft }, at);
          const mv = live.filter((t) => {
            const s0: [number, number] = t === fresh ? [fx, fy] : startOf(t);
            return s0[0] !== tx(t) || s0[1] !== ty(t);
          });
          slide(mv, at + D * 0.6, D * 1.2);
          add(brackets, { scaleY: 1, duration: D * 0.7, ease: soft, delay: stagger(40) }, at + D * 1.5);
          if (fresh) moveCursor(bucketOfTile(fresh), at + D * 0.6, INK.accent, D * 1.0);
          end = at + D * 2.2;
        }
        cursorOut(end - D * 0.3);
        break;
      }
      case "update": {
        const t = byId(p.id);
        const span = t?.querySelector<HTMLElement>("[data-value]");
        if (t && span) {
          const next = t.dataset.text ?? "";
          span.textContent = fmt(p.oldValue);
          moveCursor(bucketOfTile(t), 0);
          glow(bucketOfTile(t), INK.accent, D * 0.6);
          add(span, { y: [0, -16], opacity: [1, 0], duration: D * 0.35, ease: "inCubic" }, D * 0.8);
          call(() => {
            span.textContent = next;
          }, D * 1.15);
          add(span, { y: [16, 0], opacity: [0, 1], duration: D * 0.65, ease: soft }, D * 1.15);
          add(t, { scale: 1.06, duration: D * 0.2, ease: "outQuad" }, D * 1.1);
          add(t, { scale: 1, duration: D * 0.7, ease: soft }, D * 1.3);
          pulse(t, INK.accent, D * 1.1);
          cursorOut(D * 1.6);
        }
        break;
      }
      case "read": {
        const t = byId(p.id);
        moveCursor(p.bucket, 0, INK.blue);
        glow(p.bucket, INK.blue, D * 0.5);
        if (t) {
          add(t, { y: ty(t) - 7, duration: D * 0.3, ease: "outQuad" }, D * 0.8);
          add(t, { y: ty(t), duration: D * 0.9, ease: soft }, D * 1.1);
          pulse(t, INK.blue, D * 0.8);
        }
        cursorOut(D * 1.5);
        break;
      }
      case "miss": {
        moveCursor(p.bucket, 0, INK.red);
        glow(p.bucket, INK.red, D * 0.5);
        shake(D * 0.9);
        cursorOut(D * 1.5);
        break;
      }
      case "scan": {
        const step = Math.min(D * 0.3, (D * 3.5) / Math.max(1, p.ids.length));
        p.ids.forEach((id, i) => {
          const t = byId(id);
          if (!t) return;
          const at = i * step;
          moveCursor(bucketOfTile(t), at, INK.blue, step * 0.9);
          pulse(t, INK.blue, at + step * 0.3);
          add(t, { y: ty(t) - 5, duration: D * 0.18, ease: "outQuad" }, at + step * 0.3);
          add(t, { y: ty(t), duration: D * 0.5, ease: soft }, at + step * 0.3 + D * 0.18);
        });
        cursorOut(p.ids.length * step + D * 0.3);
        break;
      }
      case "remove": {
        moveCursor(p.ghost.bucket, 0, INK.red);
        reddenBox(ghostTiles);
        glow(p.ghost.bucket, INK.red, D * 0.5);
        pulse(ghostTiles[0], INK.red, D * 0.8);
        add(ghostTiles, { opacity: 0, scale: 0.75, y: ty(ghostTiles[0]) - 14, duration: D * 0.7, ease: "inCubic" }, D * 0.9);
        slide(moved, D * 1.5);
        cursorOut(D * 1.6);
        break;
      }
      case "clear": {
        reddenBox(ghostTiles);
        add(ghostTiles, { opacity: 0, scale: 0.75, duration: D * 0.75, ease: "inCubic", delay: stagger(40) }, 0);
        break;
      }
      case "highlight": {
        const t = byId(p.id);
        const tint = t?.querySelector<HTMLElement>("[data-tint]");
        if (t) moveCursor(bucketOfTile(t), 0);
        if (tint) {
          utils.set(tint, { scaleX: 0 });
          add(tint, { scaleX: [0, 1], duration: D * 0.9, ease: "outCubic" }, D * 0.7);
        }
        add(t, { scale: 1.08, duration: D * 0.25, ease: "outQuad" }, D * 0.7);
        add(t, { scale: 1, duration: D * 0.7, ease: soft }, D * 0.95);
        cursorOut(D * 1.3);
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
        const g = el.querySelector<HTMLElement>("[data-mark-ghost]");
        add(g, { scale: 0.4, opacity: 0, y: -8, duration: D * 0.6, ease: "inCubic" }, 0);
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
        for (const t of live) utils.set(t, { x: tx(t), y: ty(t) + 16, opacity: 0, scale: 0.85 });
        add(live, { opacity: 1, duration: D * 0.4, delay: stagger(45), ease: "outQuad" }, 0);
        add(live, { y: toY, scale: 1, duration: D * 1.0, delay: stagger(45), ease: soft }, 0);
        const fresh = cols.filter((c) => Number(c.dataset.col) >= p.prev.capacity);
        const freshIdx = idxs.filter((c) => Number(c.dataset.idx) >= p.prev.capacity);
        if (fresh.length) utils.set(fresh, { opacity: 0 });
        if (freshIdx.length) utils.set(freshIdx, { opacity: 0 });
        add(fresh, { opacity: 1, duration: D * 0.6, ease: "outQuad", delay: stagger(40) }, 0);
        add(freshIdx, { opacity: 1, duration: D * 0.6, ease: "outQuad", delay: stagger(40) }, 0);
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
  }, [data, anim, reduced, finishAnimation, trace]);

  const size = sizeOf(data);
  const lf = loadFactor(size, data.capacity);
  const slots = Math.max(data.capacity, before?.capacity ?? 0);
  const width = slots * COL;
  const rows = Math.max(MIN_ROWS, maxLen(data), before ? maxLen(before) : 0);
  const height = HEAD + 6 + rows * ROW + 12;
  const loadColor = lf > MAX_LOAD_FACTOR ? INK.red : lf === MAX_LOAD_FACTOR ? INK.amber : INK.green;

  return (
    <section
      ref={host}
      data-stage aria-label={kind === "map" ? "HashMap stage" : "HashSet stage"}
      className="relative overflow-hidden rounded-2xl border border-primary-foreground/10 bg-card/30"
    >
      <div className="flex flex-col gap-5 py-6">
        {/* quiet numbers */}
        <div data-chrome className="flex flex-wrap items-end gap-x-10 gap-y-3 px-6">
          <Stat label="entries" value={String(size)} />
          <Stat label="buckets" value={String(data.capacity)} />
          <Stat label="load factor" value={fmtLoad(size, data.capacity)}>
            <span
              className="relative h-1 w-16 overflow-hidden rounded-full bg-primary-foreground/10"
              role="meter"
              aria-valuemin={0}
              aria-valuemax={1}
              aria-valuenow={lf}
              aria-label="Load factor"
            >
              <span
                className="absolute inset-y-0 left-0 rounded-full transition-[width,background-color] duration-500"
                style={{ width: `${Math.min(100, lf * 100)}%`, background: loadColor }}
              />
              <span aria-hidden className="absolute inset-y-0 w-px bg-primary-foreground/60" style={{ left: `${MAX_LOAD_FACTOR * 100}%` }} />
            </span>
            <span>max {MAX_LOAD_FACTOR}</span>
          </Stat>
        </div>

        <HashPipeline trace={trace} />

        <div className="overflow-x-auto px-6 pb-1">
          <div className="relative" style={{ width, minWidth: width, height }}>
            {/* rail */}
            <div aria-hidden className="absolute inset-x-0 bg-primary-foreground/10" style={{ top: RAIL_Y, height: 1 }} />

            {Array.from({ length: slots }, (_, i) => {
              const live = i < data.capacity;
              return (
                <div key={i} data-col={i} className={cn("absolute top-0", !live && "invisible")} style={{ left: i * COL, width: COL, height }}>
                  {/* hairline between buckets */}
                  {i > 0 && <div aria-hidden className="absolute inset-y-0 left-0 w-px bg-primary-foreground/[0.06]" />}
                  <div data-glow={i} aria-hidden className="pointer-events-none absolute inset-x-1 top-0 bottom-0 rounded-xl opacity-0" />
                </div>
              );
            })}

            {Array.from({ length: slots }, (_, i) => {
              const n = data.buckets[i]?.length ?? 0;
              return (
                <div
                  key={`i${i}`}
                  data-idx={i}
                  className={cn("absolute flex items-center justify-center gap-1.5", i >= data.capacity && "invisible")}
                  style={{ left: bx(i), width: TILE_W, top: 0, height: RAIL_Y }}
                >
                  <span
                    className={cn(
                      "font-mono text-xs transition-all duration-200",
                      showIndex ? "opacity-100" : "opacity-0",
                      n > 0 ? "font-semibold text-primary-foreground" : "text-muted-foreground/60",
                    )}
                    aria-hidden={!showIndex}
                  >
                    {i}
                  </span>
                  {n > 1 && (
                    <span className="font-mono text-[10px] font-semibold" style={{ color: INK.amber }}>
                      {`×${n}`}
                    </span>
                  )}
                </div>
              );
            })}

            {/* amber brackets mark buckets that hold more than one entry */}
            {data.buckets.map((b, i) =>
              b.length > 1 ? (
                <div
                  key={`b${i}`}
                  data-bracket={i}
                  aria-hidden
                  className="absolute w-0.5 rounded-full"
                  style={{
                    left: bx(i) + TILE_W + 5,
                    top: HEAD + 6 + 6,
                    height: (b.length - 1) * ROW + TILE_H - 12,
                    background: INK.amber,
                    transformOrigin: "50% 0",
                    opacity: 0.8,
                  }}
                />
              ) : null,
            )}

            {data.buckets.flatMap((b, bucket) =>
              b.map((entry, slot) => {
                const [x, y] = pos(bucket, slot);
                return (
                  <Tile
                    key={entry.id}
                    entry={entry}
                    x={x}
                    y={y}
                    data={data}
                    ghostMarkId={ghostMark?.entryId === entry.id ? ghostMark.markId : undefined}
                    ghostArrow={dismissedArrows.find((a) => a.entryId === entry.id)}
                  />
                );
              }),
            )}
            {before &&
              ghosts.map(({ entry, bucket, slot }) => {
                const [x, y] = pos(bucket, slot);
                return <Tile key={`ghost-${entry.id}`} entry={entry} x={x} y={y} data={before} ghost />;
              })}

            {/* bucket cursor */}
            <div
              data-cursor
              aria-hidden
              className="pointer-events-none absolute left-0 rounded-full opacity-0"
              style={{ top: RAIL_Y - 1, width: TILE_W, height: 3, background: INK.accent }}
            />
          </div>
        </div>

        {size === 0 && (
          <p data-chrome className="px-6 text-sm text-muted-foreground">
            Empty. Run <code className="font-mono text-primary-foreground">{kind === "map" ? "set" : "add"}</code> or{" "}
            <code className="font-mono text-primary-foreground">initialize</code> to add entries.
          </p>
        )}

        <p data-chrome className="flex flex-wrap items-center gap-x-5 gap-y-1 px-6 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-0.5 rounded-full" style={{ background: INK.amber }} />
            same bucket, a collision
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span style={{ color: INK.purple }}>⚑</span> mark
          </span>
          <span>arrows and fills are annotations</span>
        </p>
      </div>
    </section>
  );
}
