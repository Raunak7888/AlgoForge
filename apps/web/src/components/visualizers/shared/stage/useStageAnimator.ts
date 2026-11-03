"use client";
import { useLayoutEffect, useRef, type RefObject } from "react";
import { createTimeline, stagger, utils } from "animejs";
import { useAnimationSettings } from "../animationSettings";
import { annotationArc, type Box } from "../edges";
import { useTimelineSink } from "./StageEnv";
import { edgeCurve } from "./geometry";
import { createMotion, type Motion } from "./motion";
import { INK } from "./tokens";

type El = HTMLElement | SVGElement;

export interface Ctx<Plan> {
  el: HTMLElement;
  plan: Plan;
  D: number;
  m: Motion;
  soft: Motion["soft"];
  snap: Motion["snap"];
  live: HTMLElement[];
  ghostItems: HTMLElement[];
  byId: Map<string, HTMLElement>;
  edgeEls: SVGGElement[];
  ghostEdgeEls: SVGGElement[];
  aEdges: SVGGElement[];
  chips: HTMLElement[];
  moved: HTMLElement[];
  movedPtrs: HTMLElement[];
  /** Positions / edge keys BEFORE this animation (what the user was looking at). */
  before: Map<string, [number, number]>;
  beforeEdges: Set<string>;
  dot: SVGCircleElement | null;
  tx: (e: HTMLElement) => number;
  ty: (e: HTMLElement) => number;
  toX: (t: unknown) => number;
  toY: (t: unknown) => number;
  cur: (e: HTMLElement, prop: "x" | "y") => number;
  edge: (key: string, ghost: boolean) => SVGGElement | undefined;
  reveal: (id: string) => void;
  rePath: () => void;
}

interface Opts<Plan> {
  host: RefObject<HTMLElement | null>;
  anim: { token: number; plan: Plan } | null;
  reduced: boolean;
  finish: (token: number) => void;
  /** Anything else the render depends on (constant length). */
  deps: unknown[];
  reveal?: (cx: number, cy: number) => void;
  /** Lab-specific: describe what each kind of operation looks like. */
  build: (c: Ctx<Plan>) => void;
}

/**
 * Everything every stage needs and used to copy: collect the elements, keep edges glued to their nodes,
 * start each element where it was, run one timeline, and snap to the data model when done.
 * A lab only supplies `build` (what each operation looks like).
 */
export function useStageAnimator<Plan>(o: Opts<Plan>) {
  const sink = useTimelineSink();
  const prevPos = useRef(new Map<string, [number, number]>());
  const prevPtr = useRef(new Map<string, [number, number]>());
  const prevEdges = useRef(new Set<string>());

  useLayoutEffect(() => {
    const { host, anim, reduced, finish, build, reveal } = o;
    const el = host.current;
    if (!el) return;
    const qa = <T extends Element>(sel: string) => Array.from(el.querySelectorAll<T>(sel));
    const items = qa<HTMLElement>("[data-item]");
    const live = items.filter((t) => t.dataset.ghost !== "true");
    const ghostItems = items.filter((t) => t.dataset.ghost === "true");
    const byId = new Map(items.map((t) => [t.dataset.id!, t]));
    const ptrEls = qa<HTMLElement>("[data-ptr]");
    const edgeEls = qa<SVGGElement>("[data-edge]");
    const ghostEdgeEls = qa<SVGGElement>("[data-edge-ghost]");
    const aEdges = qa<SVGGElement>("[data-aedge]");
    const chips = qa<HTMLElement>("[data-step]");
    const dot = el.querySelector<SVGCircleElement>("[data-fx-dot]");

    const tx = (e: HTMLElement) => Number(e.dataset.x);
    const ty = (e: HTMLElement) => Number(e.dataset.y);
    const toX = (t: unknown) => tx(t as HTMLElement);
    const toY = (t: unknown) => ty(t as HTMLElement);
    const cur = (e: HTMLElement, prop: "x" | "y") => {
      const v = parseFloat(String(utils.get(e, prop)));
      return Number.isFinite(v) ? v : prop === "x" ? tx(e) : ty(e);
    };
    /** Where a node is right now. Leaving lines prefer the fading-out copy, live lines prefer the live one. */
    const boxNow = (id: string, preferGhost = false): Box | null => {
      const e = byId.get(preferGhost ? `g:${id}` : id) ?? byId.get(preferGhost ? id : `g:${id}`);
      return e ? { x: cur(e, "x"), y: cur(e, "y"), w: Number(e.dataset.w), h: Number(e.dataset.h) } : null;
    };
    const edge = (key: string, ghost: boolean) => (ghost ? ghostEdgeEls : edgeEls).find((g) => g.dataset.key === key);

    /** Re-draw every line so it stays glued to its two nodes, wherever they are right now. */
    const rePath = () => {
      for (const g of [...edgeEls, ...ghostEdgeEls]) {
        const ghostEdge = g.hasAttribute("data-edge-ghost");
        const a = boxNow(g.dataset.from!, ghostEdge);
        const b = boxNow(g.dataset.to!, ghostEdge);
        if (!a || !b) continue;
        const geo = edgeCurve(a, b, { directed: g.dataset.directed === "1", bend: Number(g.dataset.bend) || 0, self: g.dataset.self === "1" });
        const [shaft, head, label, hit] = Array.from(g.children) as SVGElement[];
        shaft.setAttribute("d", geo.shaft);
        head.setAttribute("d", geo.head);
        hit?.setAttribute("d", geo.shaft);
        label.setAttribute("x", String(geo.label[0] + (Number(g.dataset.lox) || 0)));
        label.setAttribute("y", String(geo.label[1] + (Number(g.dataset.loy) || 0)));
      }
      for (const g of aEdges) {
        const a = boxNow(g.dataset.from!);
        const b = boxNow(g.dataset.to!);
        if (!a || !b) continue;
        const geo = annotationArc(a, b);
        const [shaft, w1, w2] = Array.from(g.children) as SVGPathElement[];
        shaft.setAttribute("d", geo.shaft);
        w1.setAttribute("d", geo.wings[0]);
        w2.setAttribute("d", geo.wings[1]);
      }
    };
    const clearDash = () =>
      el.querySelectorAll<SVGElement>("[data-draw]").forEach((e) => {
        e.style.strokeDasharray = "";
        e.style.strokeDashoffset = "";
      });

    /** Snap everything to the data model and remember where things are. */
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
        const sel = t.querySelector<HTMLElement>("[data-sel]");
        if (sel) utils.set(sel, { scale: 1, opacity: 1 });
        const box = t.querySelector<HTMLElement>("[data-box]");
        if (box) box.style.borderColor = box.dataset.border ?? "";
      }
      for (const p of ptrEls) utils.set(p, { x: tx(p), y: ty(p), scale: 1, opacity: 1 });
      el.querySelectorAll("[data-ptr-pill]").forEach((e) => utils.set(e, { scale: 1 }));
      for (const g of edgeEls) {
        utils.set(g, { opacity: 1 });
        g.style.stroke = "";
        const lab = g.children[2];
        if (lab) lab.textContent = g.dataset.label ?? "";
      }
      for (const g of aEdges) utils.set(g, { opacity: 1 });
      if (chips.length) utils.set(chips, { opacity: 1, scale: 1 });
      const marks = el.querySelectorAll("[data-mark],[data-mark-ghost]");
      if (marks.length) utils.set(marks, { scale: 1, opacity: 1, x: 0, y: 0 });
      const arrows = el.querySelectorAll("[data-arrow]");
      if (arrows.length) utils.set(arrows, { opacity: 1 });
      if (dot) utils.set(dot, { opacity: 0 });
      clearDash();
      prevPos.current = new Map(live.map((t) => [t.dataset.id!, [tx(t), ty(t)] as [number, number]]));
      prevPtr.current = new Map(ptrEls.map((p) => [p.dataset.ptr!, [tx(p), ty(p)] as [number, number]]));
      prevEdges.current = new Set(edgeEls.map((g) => g.dataset.key!));
      rePath();
    };

    if (!anim) {
      settle();
      return;
    }
    const { plan, token } = anim;
    const { duration: D, speed } = useAnimationSettings.getState();
    if (reduced || D <= 0) {
      settle();
      queueMicrotask(() => finish(token));
      return;
    }

    const before = prevPos.current;
    const beforeEdges = prevEdges.current;
    for (const t of live) {
      const [sx, sy] = before.get(t.dataset.id!) ?? [tx(t), ty(t)];
      utils.set(t, { x: sx, y: sy });
    }
    for (const g of ghostItems) utils.set(g, { x: tx(g), y: ty(g) });
    for (const p of ptrEls) {
      const [sx, sy] = prevPtr.current.get(p.dataset.ptr!) ?? [tx(p), ty(p)];
      utils.set(p, { x: sx, y: sy });
    }
    const moved = live.filter((t) => {
      const q = before.get(t.dataset.id!);
      return !!q && (q[0] !== tx(t) || q[1] !== ty(t));
    });
    const movedPtrs = ptrEls.filter((p) => {
      const q = prevPtr.current.get(p.dataset.ptr!);
      return !!q && (q[0] !== tx(p) || q[1] !== ty(p));
    });
    rePath();

    const tl = createTimeline({
      defaults: { duration: D, ease: "outQuart" },
      playbackRate: speed,
      onUpdate: rePath,
      onComplete: () => {
        settle();
        sink.clear(tl);
        finish(token);
      },
    });
    const m = createMotion(tl, D);
    build({
      el, plan, D, m, soft: m.soft, snap: m.snap, live, ghostItems, byId, edgeEls, ghostEdgeEls, aEdges, chips, moved, movedPtrs, before, beforeEdges, dot,
      tx, ty, toX, toY, cur, edge, rePath,
      reveal: (id) => {
        const t = byId.get(id);
        if (t && reveal) reveal(tx(t) + Number(t.dataset.w) / 2, ty(t) + Number(t.dataset.h) / 2);
      },
    });
    if (m.count() === 0) {
      tl.pause();
      settle();
      queueMicrotask(() => finish(token));
      return;
    }
    sink.set(tl);
    return () => {
      sink.clear(tl);
      tl.pause();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [o.anim, o.reduced, o.finish, ...o.deps]);
}

/**
 * Undo / redo: nodes that exist in both glide to their old spots, new ones grow in,
 * removed ones shrink away, and lines are drawn or dropped. Same for every lab.
 */
export function playRestore(c: Ctx<unknown>) {
  const { m, D, live, ghostItems, ghostEdgeEls, edgeEls, moved, before, beforeEdges } = c;
  live.filter((t) => !before.has(t.dataset.id!)).forEach((t) => m.spawn(t, D * 0.3));
  m.add(moved, { x: c.toX, y: c.toY, ease: c.snap, duration: D * 1.1, delay: stagger(25) }, 0);
  m.tint(ghostItems, INK.red);
  m.vanish(ghostItems, 0);
  ghostEdgeEls.forEach((g, j) => m.drop(g, j * 30));
  edgeEls
    .filter((g) => !beforeEdges.has(g.dataset.key!))
    .forEach((g, j) => {
      utils.set(g, { opacity: 0 });
      m.draw(g, D * 0.5 + j * 60, D * 0.5);
    });
}
export type { El };
