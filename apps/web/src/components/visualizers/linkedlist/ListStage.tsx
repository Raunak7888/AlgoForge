"use client";
import { useLayoutEffect, useRef } from "react";
import { animate, createTimeline, spring, stagger, utils } from "animejs";
import { cn } from "@/lib/utils";
import { useAnimationSettings, useReducedMotion } from "../shared/animationSettings";
import { annotationArc, type Box, type EdgeGeometry } from "../shared/edges";
import { useTimelineSink } from "../shared/stage/StageEnv";
import { fmt } from "./engine";
import { L, boxesOf, edgeGeometry, laneOf, ptrPositions, showLeft, showRight, stageWidth } from "./layout";
import { TYPE_LABEL, edgesOf, lengthOf, orderOf, parseEdgeKey, type Edge } from "./model";
import type * as LabT from "./types";
import type { ListState, ListType, Step } from "./types";

const INK = { accent: "#FF430F", blue: "#0070F3", green: "#17A34A", purple: "#7928CA", red: "#E5484D", amber: "#D97706" };
const COLOR_FADE = "stroke 320ms ease";

type Params = Parameters<typeof animate>[1];
type El = HTMLElement | SVGElement;
type Tgt = El | El[] | null | undefined;

/* ───────────── pieces ───────────── */

function MarkPill({ id, ghost }: { id: string; ghost?: boolean }) {
  const attr = ghost ? { "data-mark-ghost": "" } : { "data-mark": id };
  return (
    <span
      {...attr}
      className="inline-flex h-[17px] items-center gap-1 rounded-full border bg-primary-background px-1.5 font-mono text-[10px] font-semibold"
      style={{ color: INK.purple, borderColor: `${INK.purple}55`, transformOrigin: "50% 100%" }}
      aria-label={`marker ${id}`}
    >
      <span aria-hidden>⚑</span>
      {/* ONE string child: the animator may swap textContent, React stays consistent. */}
      <span>{id}</span>
    </span>
  );
}

function NodeTile(props: {
  id: string;
  state: ListState;
  index: number;
  box: Box;
  showIndex: boolean;
  selected: boolean;
  ghost?: boolean;
  ghostMarkId?: string;
}) {
  const { id, state, index, box, showIndex, selected, ghost, ghostMarkId } = props;
  const node = state.nodes[id];
  if (!node) return null;
  const hl = state.highlights[id];
  const markers = state.markers.filter((m) => m.nodeId === id);
  const arrow = state.arrows.find((a) => a.fromId === null && a.toId === id);
  const text = fmt(node.value);
  const fs = text.length > 9 ? 12 : text.length > 6 ? 14 : 17;
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
      className="absolute left-0 top-0"
      style={{ width: box.w, height: box.h }}
      title={`${id} = ${text}`}
    >
      <div
        data-box
        data-border={hl ? `${hl}99` : ""}
        className="absolute inset-0 overflow-hidden rounded-xl border border-primary-foreground/[0.14] bg-card shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-[border-color,box-shadow] duration-200 hover:border-primary-foreground/35 hover:shadow-[0_4px_14px_rgba(0,0,0,0.08)]"
        style={hl ? { borderColor: `${hl}99` } : undefined}
      >
        {hl && <div data-tint className="absolute inset-0 origin-left" style={{ background: `linear-gradient(90deg, ${hl}38, ${hl}14)` }} />}
        <span aria-hidden={!showIndex} className={cn("absolute left-2 top-1.5 font-mono text-[10px] leading-none text-muted-foreground transition-opacity duration-200", showIndex ? "opacity-100" : "opacity-0")}>
          {index}
        </span>
        <div className="absolute inset-0 flex items-center justify-center px-2 pt-1">
          <span data-value className="block max-w-full truncate font-mono font-semibold tabular-nums" style={{ fontSize: fs }}>
            {text}
          </span>
        </div>
      </div>
      <div data-ring aria-hidden className="pointer-events-none absolute -inset-px rounded-xl border-2 opacity-0" />
      {selected && !ghost && (
        <div data-sel aria-label="selected node" className="pointer-events-none absolute -inset-1 rounded-[14px] border-2" style={{ borderColor: INK.blue }} />
      )}
      {/* the node's stable id, independent of its value */}
      <div className="pointer-events-none absolute left-0 right-0 text-center font-mono text-[10px] text-muted-foreground" style={{ top: box.h + 4 }}>
        {id}
      </div>

      {(markers.length > 0 || ghostMarkId) && (
        <div className="absolute -top-2.5 right-1.5 z-10 flex gap-1">
          {markers.map((m) => (
            <MarkPill key={m.id} id={m.id} />
          ))}
          {ghostMarkId && <MarkPill id={ghostMarkId} ghost />}
        </div>
      )}

      {arrow && (
        <svg
          data-arrow
          data-arrow-for={arrow.id}
          width={28}
          height={34}
          viewBox="0 0 28 34"
          className="pointer-events-none absolute overflow-visible"
          style={{ left: (box.w - 28) / 2, top: -66 }}
          role="img"
          aria-label="annotation arrow pointing at this node"
        >
          <g style={{ stroke: arrow.color, transition: COLOR_FADE }} strokeWidth={1.75} fill="none" strokeLinecap="round" strokeLinejoin="round">
            <path data-draw="shaft" pathLength={1} d="M14 3V28" />
            <path data-draw="head" pathLength={1} d="M9 23L14 30L19 23" />
          </g>
        </svg>
      )}
    </div>
  );
}

function Terminal({ side, box }: { side: "R" | "L"; box: Box }) {
  return (
    <div
      data-item
      data-term={side}
      data-id={`NULL:${side}`}
      data-x={box.x}
      data-y={box.y}
      data-w={box.w}
      data-h={box.h}
      className="absolute left-0 top-0 flex items-center justify-center rounded-lg border border-dashed border-primary-foreground/30 font-mono text-[11px] font-semibold text-muted-foreground"
      style={{ width: box.w, height: box.h }}
    >
      NULL
    </div>
  );
}

function Pill({ name, x, y, label, color, width, out }: { name: string; x: number; y: number; label: string; color: string; width?: number; out?: boolean }) {
  return (
    <div data-ptr={name} data-x={x} data-y={y} className="pointer-events-none absolute left-0 top-0" style={{ width: width ?? L.PILL_W }}>
      <span
        data-ptr-pill
        className="inline-flex h-5 items-center justify-center rounded-full border px-2 font-mono text-[10px] font-semibold tracking-wide"
        style={{ color, borderColor: `${color}66`, background: `${color}14`, borderStyle: out ? "dashed" : "solid", minWidth: L.PILL_W, transformOrigin: "50% 100%" }}
      >
        {label}
      </span>
    </div>
  );
}

/** One pointer arrow. Its path is recomputed every animation frame from where its two nodes currently are. */
function EdgeG(props: { edge: Edge; geo: EdgeGeometry | null; type: ListType; ghost?: boolean }) {
  const { edge, geo, type, ghost } = props;
  const attr = ghost ? { "data-edge-ghost": "" } : { "data-edge": "" };
  return (
    <g
      {...attr}
      data-key={edge.key}
      data-from={edge.from}
      data-to={edge.to}
      data-kind={edge.kind}
      data-lane={laneOf(edge.kind, type)}
      className="text-primary-foreground/55"
      stroke="currentColor"
      strokeWidth={1.75}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ transition: COLOR_FADE }}
    >
      <path data-draw="shaft" pathLength={1} d={geo?.shaft ?? ""} />
      <path data-draw="head" pathLength={1} d={geo?.wings[0] ?? ""} />
      <path data-draw="head" pathLength={1} d={geo?.wings[1] ?? ""} />
    </g>
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

/* ───────────── stage ───────────── */

/** What a stage needs to draw one structure. The old labs feed it from their store; the shared canvas feeds it directly. */
export interface ListStageViewProps {
  data: LabT.ListState;
  last: Pick<LabT.LogEntry, "seq" | "outcome"> | null;
  selectedId: string | null;
  anim: { token: number; plan: LabT.Anim } | null;
  showIndex: boolean;
  finishAnimation: (token: number) => void;
}

export function ListStageView({ data, last, selectedId, anim, showIndex, finishAnimation }: ListStageViewProps) {
  const sink = useTimelineSink();
  const reduced = useReducedMotion();

  const host = useRef<HTMLElement>(null);
  const prevPos = useRef(new Map<string, [number, number]>());
  const prevPtr = useRef(new Map<string, [number, number]>());

  const plan = anim?.plan ?? null;
  const before = plan && "prev" in plan ? plan.prev : null;
  const order = orderOf(data);
  const n = order.length;

  /* Everything that is leaving is drawn from the state before the operation so it can fade out. */
  const ghostIds: string[] = plan?.kind === "delete" ? [plan.ghost.id] : plan?.kind === "clear" || plan?.kind === "reset" ? orderOf(plan.prev) : [];
  const ghostMark = plan?.kind === "markOut" ? plan : null;
  const planSteps: Step[] = plan && "steps" in plan ? plan.steps : [];
  const ghostEdgeKeys: string[] =
    plan?.kind === "clear" || plan?.kind === "reset"
      ? edgesOf(plan.prev).map((e) => e.key)
      : Array.from(new Set(planSteps.flatMap((s) => s.removes)));
  const dismissed = plan?.kind === "dismiss" ? plan.prev.arrows.filter((a) => a.fromId !== null) : [];

  // Terminals stay mounted while the previous type still needs them, so leaving arrows can fade out cleanly.
  const showR = showRight(data.type) || (!!before && showRight(before.type));
  const showL = showLeft(data.type) || (!!before && showLeft(before.type));
  const boxes = boxesOf(data, showR, showL);
  const prevBoxes = before ? boxesOf(before, showR, showL) : null;
  const liveEdges = edgesOf(data);
  const ptr = ptrPositions(data);
  const width = stageWidth(data, before ? lengthOf(before) : 0);
  const steps: Step[] = last?.outcome.ok ? last.outcome.steps : [];
  const stepsKey = last ? `${last.seq}` : "none";

  useLayoutEffect(() => {
    const el = host.current;
    if (!el) return;

    const items = Array.from(el.querySelectorAll<HTMLElement>("[data-item]"));
    const live = items.filter((t) => t.dataset.ghost !== "true");
    const ghostItems = items.filter((t) => t.dataset.ghost === "true");
    const byId = new Map(items.map((t) => [t.dataset.id!, t]));
    const nodesLive = live.filter((t) => t.dataset.node !== undefined);
    const ptrEls = Array.from(el.querySelectorAll<HTMLElement>("[data-ptr]"));
    const edgeEls = Array.from(el.querySelectorAll<SVGGElement>("[data-edge]"));
    const ghostEdgeEls = Array.from(el.querySelectorAll<SVGGElement>("[data-edge-ghost]"));
    const aEdges = Array.from(el.querySelectorAll<SVGGElement>("[data-aedge]"));
    const chips = Array.from(el.querySelectorAll<HTMLElement>("[data-step]"));
    const tx = (e: HTMLElement) => Number(e.dataset.x);
    const ty = (e: HTMLElement) => Number(e.dataset.y);
    const toX = (t: unknown) => tx(t as HTMLElement);
    const toY = (t: unknown) => ty(t as HTMLElement);
    const cur = (e: HTMLElement, prop: "x" | "y") => {
      const v = parseFloat(String(utils.get(e, prop)));
      return Number.isFinite(v) ? v : prop === "x" ? tx(e) : ty(e);
    };
    /** Where a node is right now. Arrows that are leaving prefer the fading-out copy of a node, live arrows prefer the live one. */
    const boxOf = (id: string, preferGhost = false): Box | null => {
      const e = byId.get(preferGhost ? `g:${id}` : id) ?? byId.get(preferGhost ? id : `g:${id}`);
      return e ? { x: cur(e, "x"), y: cur(e, "y"), w: Number(e.dataset.w), h: Number(e.dataset.h) } : null;
    };

    /** Re-draw every arrow so it stays glued to its nodes, wherever they are right now. */
    const rePath = () => {
      for (const g of [...edgeEls, ...ghostEdgeEls]) {
        const kind = g.dataset.kind as "next" | "prev";
        const ghostEdge = g.hasAttribute("data-edge-ghost");
        const from = boxOf(g.dataset.from!, ghostEdge);
        const toId = g.dataset.to === "NULL" ? (kind === "prev" ? "NULL:L" : "NULL:R") : g.dataset.to!;
        const to = boxOf(toId, ghostEdge);
        if (!from || !to) continue;
        const lane = Number(g.dataset.lane);
        const geo = edgeGeometryFor(kind, from, to, lane, g.dataset.from === g.dataset.to);
        const [shaft, w1, w2] = Array.from(g.children) as SVGPathElement[];
        shaft.setAttribute("d", geo.shaft);
        w1.setAttribute("d", geo.wings[0]);
        w2.setAttribute("d", geo.wings[1]);
      }
      for (const g of aEdges) {
        const a = boxOf(g.dataset.from!);
        const b = boxOf(g.dataset.to!);
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
      }
      for (const g of aEdges) utils.set(g, { opacity: 1 });
      if (chips.length) utils.set(chips, { opacity: 1, scale: 1 });
      const marks = el.querySelectorAll("[data-mark],[data-mark-ghost]");
      if (marks.length) utils.set(marks, { scale: 1, opacity: 1, y: 0 });
      const arrows = el.querySelectorAll("[data-arrow]");
      if (arrows.length) utils.set(arrows, { opacity: 1 });
      clearDash();
      prevPos.current = new Map(live.map((t) => [t.dataset.id!, [tx(t), ty(t)] as [number, number]]));
      prevPtr.current = new Map(ptrEls.map((p) => [p.dataset.ptr!, [tx(p), ty(p)] as [number, number]]));
      rePath();
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

    /* Start every element where it was; new ones start at their target. */
    for (const t of live) {
      const [sx, sy] = prevPos.current.get(t.dataset.id!) ?? [tx(t), ty(t)];
      utils.set(t, { x: sx, y: sy });
    }
    for (const g of ghostItems) utils.set(g, { x: tx(g), y: ty(g) });
    for (const pe of ptrEls) {
      const [sx, sy] = prevPtr.current.get(pe.dataset.ptr!) ?? [tx(pe), ty(pe)];
      utils.set(pe, { x: sx, y: sy });
    }
    const moved = live.filter((t) => {
      const q = prevPos.current.get(t.dataset.id!);
      return !!q && (q[0] !== tx(t) || q[1] !== ty(t));
    });
    const movedPtrs = ptrEls.filter((pe) => {
      const q = prevPtr.current.get(pe.dataset.ptr!);
      return !!q && (q[0] !== tx(pe) || q[1] !== ty(pe));
    });
    const newTerms = live.filter((t) => t.dataset.term !== undefined && !prevPos.current.has(t.dataset.id!));
    rePath();

    const soft = spring({ bounce: 0.28, duration: D });
    const snap = spring({ bounce: 0.1, duration: D * 0.9 });
    const STEP = D * 1.0; // time given to each pointer step so a beginner can follow it

    let added = 0;
    const tl = createTimeline({
      defaults: { duration: D, ease: "outQuart" },
      playbackRate: speed,
      onUpdate: rePath,
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
    const pulse = (t: HTMLElement | null | undefined, color: string, at: number) => {
      const ring = t?.querySelector<HTMLElement>("[data-ring]");
      if (!ring) return;
      ring.style.borderColor = color;
      add(ring, { scale: [1, 1.25], opacity: [0.7, 0], duration: D * 1.2, ease: "outQuad" }, at);
    };
    const tintBox = (ts: HTMLElement[], color: string) =>
      ts.forEach((g) => {
        const b = g.querySelector<HTMLElement>("[data-box]");
        if (b) b.style.borderColor = color;
      });
    const slide = (ts: HTMLElement[], at: number, dur = D * 1.0) => add(ts, { x: toX, y: toY, ease: snap, duration: dur, delay: stagger(35) }, at);
    const glidePtrs = (at: number) => add(movedPtrs, { x: toX, y: toY, ease: snap, duration: D * 0.9 }, at);
    const bumpPtr = (name: string, at: number) => {
      const pill = el.querySelector<HTMLElement>(`[data-ptr="${name}"] [data-ptr-pill]`);
      add(pill, { scale: 1.25, duration: D * 0.2, ease: "outQuad" }, at);
      add(pill, { scale: 1, duration: D * 0.7, ease: soft }, at + D * 0.2);
    };
    const drawEdge = (g: SVGGElement, at: number, span = D * 0.7, color = INK.green) => {
      const body = Array.from(g.querySelectorAll<SVGElement>('[data-draw="shaft"]'));
      const tips = Array.from(g.querySelectorAll<SVGElement>('[data-draw="head"]'));
      [...body, ...tips].forEach(prep);
      call(() => (g.style.stroke = color), at);
      add(g, { opacity: 1, duration: 1 }, at);
      add(body, { strokeDashoffset: [1, 0], duration: span, ease: "outQuad" }, at);
      add(tips, { strokeDashoffset: [1, 0], duration: D * 0.25, ease: "outQuad" }, at + span * 0.85);
      call(() => (g.style.stroke = ""), at + span + D * 0.9); // fades back to the normal arrow color
    };
    const dropEdge = (g: SVGGElement, at: number) => {
      call(() => (g.style.stroke = INK.red), at);
      add(g, { opacity: 0, duration: D * 0.55, ease: "inQuad" }, at + D * 0.4);
    };
    const edgeEl = (key: string, ghost: boolean) => (ghost ? ghostEdgeEls : edgeEls).find((g) => g.dataset.key === key);

    // Arrows that a step will draw start hidden, so they appear exactly when their step is explained.
    const addedKeys = new Set(planSteps.flatMap((s) => s.adds));
    for (const k of addedKeys) {
      const g = edgeEl(k, false);
      if (g) utils.set(g, { opacity: 0 });
    }
    if (chips.length) utils.set(chips, { opacity: 0.3 });

    /** Plays the pointer steps one after another. Returns when the last one ends. */
    const playSteps = (steps: Step[], at: number) => {
      steps.forEach((st, i) => {
        const t = at + i * STEP;
        add(chips[i], { opacity: 1, scale: 1.04, duration: D * 0.25, ease: "outQuad" }, t);
        add(chips[i], { scale: 1, duration: D * 0.5, ease: soft }, t + D * 0.25);
        st.removes.forEach((k, j) => {
          const g = edgeEl(k, true);
          if (g) dropEdge(g, t + j * 50);
        });
        st.adds.forEach((k, j) => {
          const g = edgeEl(k, false);
          if (g) drawEdge(g, t + j * 50);
        });
        if (st.ptr) bumpPtr(st.ptr, t);
      });
      return at + steps.length * STEP;
    };

    switch (p.kind) {
      case "insert": {
        // 1) make room, 2) the new node drops into the gap, 3) the pointers are rewired one by one.
        const fresh = byId.get(p.id);
        if (fresh) utils.set(fresh, { x: tx(fresh), y: ty(fresh) - 58, scale: 0.85, opacity: 0 });
        slide(moved, 0);
        glidePtrs(D * 0.2);
        const land = D * 0.55;
        add(fresh, { opacity: 1, duration: D * 0.35, ease: "outQuad" }, land);
        add(fresh, { y: toY, scale: 1, duration: D * 1.0, ease: soft }, land);
        const end = playSteps(p.steps, land + D * 1.1);
        pulse(fresh, INK.green, end);
        break;
      }
      case "delete": {
        // 1) the doomed node lifts out of line, 2) the pointers bypass it, 3) it fades, 4) the gap closes.
        const ghost = byId.get(`g:${p.ghost.id}`);
        tintBox(ghost ? [ghost] : [], INK.red);
        add(ghost, { y: (t: unknown) => ty(t as HTMLElement) - 58, duration: D * 0.55, ease: soft }, 0);
        const t0 = D * 0.6;
        const end = playSteps(p.steps, t0);
        add(ghost, { opacity: 0, scale: 0.8, duration: D * 0.5, ease: "inCubic" }, end);
        slide(moved, end + D * 0.2);
        glidePtrs(end + D * 0.2);
        break;
      }
      case "rewire": {
        // The pointers change first, then the nodes glide to where the new pointers say they belong.
        if (newTerms.length) {
          utils.set(newTerms, { opacity: 0 });
          add(newTerms, { opacity: 1, duration: D * 0.5, ease: "outQuad" }, 0);
        }
        const end = playSteps(p.steps, p.what === "retype" ? D * 0.3 : 0);
        if (p.what === "swap") {
          const [a, b] = p.ids.map((id) => byId.get(id));
          if (a && b) {
            const t = end + D * 0.1;
            add(a, { y: ty(a) - 36, rotate: -4, duration: D * 0.3, ease: "outQuad" }, t);
            add(b, { y: ty(b) + 36, rotate: 4, duration: D * 0.3, ease: "outQuad" }, t);
            add([a, b], { x: toX, duration: D * 0.8, ease: snap }, t + D * 0.15);
            add([a, b], { y: toY, rotate: 0, duration: D * 0.7, ease: soft }, t + D * 0.55);
          }
        } else if (p.what === "reverse") {
          slide(moved, end + D * 0.1, D * 1.2);
        }
        // terminals that only the old type needed fade away at the end
        const leaving = Array.from(el.querySelectorAll<HTMLElement>("[data-term]")).filter(
          (t) => (t.dataset.term === "R" && !showRight(data.type)) || (t.dataset.term === "L" && !showLeft(data.type)),
        );
        add(leaving, { opacity: 0, duration: D * 0.5, ease: "inQuad" }, end);
        glidePtrs(end + D * 0.1);
        break;
      }
      case "update": {
        const t = byId.get(p.id);
        const span = t?.querySelector<HTMLElement>("[data-value]");
        if (t && span) {
          const next = t.dataset.text ?? "";
          span.textContent = fmt(p.oldValue);
          add(span, { y: [0, -16], opacity: [1, 0], duration: D * 0.35, ease: "inCubic" }, 0);
          call(() => {
            span.textContent = next;
          }, D * 0.35);
          add(span, { y: [16, 0], opacity: [0, 1], duration: D * 0.65, ease: soft }, D * 0.35);
          add(t, { scale: 1.06, duration: D * 0.2, ease: "outQuad" }, D * 0.3);
          add(t, { scale: 1, duration: D * 0.7, ease: soft }, D * 0.5);
          pulse(t, INK.accent, D * 0.3);
        }
        break;
      }
      case "read": {
        // Walk from HEAD to the node, one pointer at a time, so "read is O(n)" is visible.
        const target = byId.get(p.id);
        const i = order.indexOf(p.id);
        for (let k = 0; k <= i; k++) {
          const t = byId.get(order[k]);
          pulse(t, INK.blue, k * D * 0.28);
          add(t, { y: ty(t!) - 5, duration: D * 0.16, ease: "outQuad" }, k * D * 0.28);
          add(t, { y: ty(t!), duration: D * 0.5, ease: soft }, k * D * 0.28 + D * 0.16);
        }
        const sel = target?.querySelector<HTMLElement>("[data-sel]");
        if (sel) {
          utils.set(sel, { scale: 1.25, opacity: 0 });
          add(sel, { opacity: 1, scale: 1, duration: D * 0.7, ease: soft }, Math.max(0, i) * D * 0.28 + D * 0.1);
        }
        break;
      }
      case "clear": {
        tintBox(ghostItems, INK.red);
        ghostEdgeEls.forEach((g, j) => dropEdge(g, j * 30));
        add(ghostItems, { opacity: 0, scale: 0.8, y: (t: unknown) => ty(t as HTMLElement) - 20, duration: D * 0.7, ease: "inCubic", delay: stagger(50) }, D * 0.1);
        glidePtrs(D * 0.3);
        break;
      }
      case "reset": {
        // The old list fades out, the new nodes drop in one by one, then every pointer is drawn.
        ghostEdgeEls.forEach((g, j) => dropEdge(g, j * 25));
        add(ghostItems, { opacity: 0, scale: 0.85, duration: D * 0.6, ease: "inCubic", delay: stagger(40) }, D * 0.1);
        const start = D * 0.5;
        for (const t of nodesLive) utils.set(t, { x: tx(t), y: ty(t) - 40, opacity: 0, scale: 0.85 });
        add(nodesLive, { opacity: 1, duration: D * 0.4, delay: stagger(70), ease: "outQuad" }, start);
        add(nodesLive, { y: toY, scale: 1, duration: D * 1.0, delay: stagger(70), ease: soft }, start);
        const edgesAt = start + nodesLive.length * 70 + D * 0.8;
        for (const g of edgeEls) utils.set(g, { opacity: 0 });
        edgeEls.forEach((g, j) => drawEdge(g, edgesAt + j * 70, D * 0.5));
        glidePtrs(start);
        break;
      }
      case "highlight": {
        const t = byId.get(p.id);
        const tint = t?.querySelector<HTMLElement>("[data-tint]");
        if (tint) {
          utils.set(tint, { scaleX: 0 });
          add(tint, { scaleX: [0, 1], duration: D * 0.9, ease: "outCubic" }, 0);
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
      case "markOut":
        add(el.querySelector<HTMLElement>("[data-mark-ghost]"), { scale: 0.4, opacity: 0, y: -8, duration: D * 0.6, ease: "inCubic" }, 0);
        break;
      case "cursor": {
        glidePtrs(0);
        const target = byId.get(order[p.to]);
        pulse(target, INK.accent, D * 0.7);
        add(target, { y: ty(target!) - 6, duration: D * 0.2, ease: "outQuad" }, D * 0.7);
        add(target, { y: ty(target!), duration: D * 0.7, ease: soft }, D * 0.9);
        break;
      }
      case "arrow": {
        const g = el.querySelector<SVGGElement>(`[data-aedge][data-id="${p.id}"]`);
        const scope = g ?? el.querySelector(`[data-arrow-for="${p.id}"]`);
        if (scope) {
          const body = Array.from(scope.querySelectorAll<SVGElement>('[data-draw="shaft"]'));
          const tips = Array.from(scope.querySelectorAll<SVGElement>('[data-draw="head"]'));
          [...body, ...tips].forEach(prep);
          add(body, { strokeDashoffset: [1, 0], duration: D * 1.0, ease: "outQuad" }, 0);
          add(tips, { strokeDashoffset: [1, 0], duration: D * 0.25, ease: "outQuad" }, D * 0.85);
        }
        break;
      }
      case "dismiss":
        add(Array.from(el.querySelectorAll<SVGElement>("[data-aedge-ghost]")), { opacity: 0, duration: D * 0.5, ease: "outQuad" }, 0);
        break;
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
  const headNode = data.head ? data.nodes[data.head] : null;
  const edgeG = (e: Edge, b: Map<string, Box>, type: ListType, ghost: boolean) => (
    <EdgeG key={`${ghost ? "g-" : ""}${e.key}`} edge={e} geo={edgeGeometry(e, b, type)} type={type} ghost={ghost} />
  );

  return (
    <section ref={host} data-stage aria-label="Linked list stage" className="relative overflow-hidden rounded-2xl border border-primary-foreground/10 bg-card/30">
      <div className="flex flex-col gap-5 py-6">
        <div data-chrome className="flex flex-wrap items-end gap-x-10 gap-y-3 px-6">
          <Stat label="nodes" value={String(n)} />
          <Stat label="head" value={headNode ? `${data.head} · ${fmt(headNode.value)}` : "NULL"} mono={!!headNode} />
          <Stat label="type" value={TYPE_LABEL[data.type]} mono={false} />
        </div>

        <div className="overflow-x-auto px-6 pb-1">
          <div className="relative" style={{ width, minWidth: width, height: L.STAGE_H }}>
            {/* pointer arrows: drawn under the nodes, re-pathed every frame while animating */}
            <svg aria-hidden className="pointer-events-none absolute inset-0 overflow-visible" width={width} height={L.STAGE_H}>
              {liveEdges.map((e) => edgeG(e, boxes, data.type, false))}
              {before && prevBoxes && ghostEdgeKeys.map((k) => edgeG(parseEdgeKey(k), prevBoxes, before.type, true))}
              {data.arrows
                .filter((a) => a.fromId !== null)
                .map((a) => {
                  const f = boxes.get(a.fromId!);
                  const t = boxes.get(a.toId);
                  const g = f && t ? annotationArc(f, t) : null;
                  return (
                    <g key={a.id} data-aedge data-id={a.id} data-from={a.fromId!} data-to={a.toId} style={{ stroke: a.color, transition: COLOR_FADE }} strokeWidth={1.75} fill="none" strokeLinecap="round" strokeDasharray="5 4">
                      <path data-draw="shaft" pathLength={1} d={g?.shaft ?? ""} />
                      <path data-draw="head" pathLength={1} d={g?.wings[0] ?? ""} />
                      <path data-draw="head" pathLength={1} d={g?.wings[1] ?? ""} />
                    </g>
                  );
                })}
              {dismissed.map((a) => {
                const f = (prevBoxes ?? boxes).get(a.fromId!);
                const t = (prevBoxes ?? boxes).get(a.toId);
                const g = f && t ? annotationArc(f, t) : null;
                return (
                  <g key={`d-${a.id}`} data-aedge-ghost style={{ stroke: a.color }} strokeWidth={1.75} fill="none" strokeLinecap="round" strokeDasharray="5 4">
                    <path d={g?.shaft ?? ""} />
                  </g>
                );
              })}
            </svg>

            {showL && <Terminal side="L" box={boxes.get("NULL:L")!} />}
            {showR && <Terminal side="R" box={boxes.get("NULL:R")!} />}
            {n === 0 && data.type === "cll" && (
              <div className="absolute flex items-center justify-center rounded-xl border border-dashed border-primary-foreground/25 text-xs text-muted-foreground" style={{ left: L.PAD_L + L.LS, top: L.NODE_Y, width: L.W, height: L.H }}>
                empty
              </div>
            )}
            {data.cursor >= n && n > 0 && (
              <div aria-hidden className="absolute flex items-center justify-center rounded-xl border border-dashed border-primary-foreground/25 font-mono text-lg text-muted-foreground" style={{ left: ptr.cursor[0] + 16 - L.W / 2, top: L.NODE_Y, width: L.W, height: L.H }}>
                ?
              </div>
            )}

            {order.map((id, i) => (
              <NodeTile key={id} id={id} state={data} index={i} box={boxes.get(id)!} showIndex={showIndex} selected={selectedId === id} ghostMarkId={ghostMark?.nodeId === id ? ghostMark.markId : undefined} />
            ))}
            {before &&
              prevBoxes &&
              ghostIds.map((id) => <NodeTile key={`ghost-${id}`} id={id} state={before} index={orderOf(before).indexOf(id)} box={prevBoxes.get(id)!} showIndex={showIndex} selected={false} ghost />)}

            <Pill name="head" x={ptr.head[0]} y={ptr.head[1]} label="HEAD" color={INK.accent} />
            <Pill name="tail" x={ptr.tail[0]} y={ptr.tail[1]} label="TAIL" color={INK.blue} />
            {n > 0 && <Pill name="cursor" x={ptr.cursor[0]} y={ptr.cursor[1]} label={ptr.cursorOut ? `P${data.cursor}?` : "P"} color={INK.green} width={32} out={ptr.cursorOut} />}
          </div>
        </div>

        {/* what the pointers did, one line per step, lit up as the animation reaches it */}
        <div data-chrome key={stepsKey} className="flex flex-wrap gap-2 px-6" aria-label="Pointer steps">
          {steps.length === 0 ? (
            <p className="text-xs text-muted-foreground">{last ? "No pointers changed in the last operation." : "Run an operation to see exactly which pointers change."}</p>
          ) : (
            steps.map((st, i) => (
              <span key={i} data-step={i} className="inline-flex items-center gap-1.5 rounded-full border border-primary-foreground/15 px-2.5 py-1 font-mono text-[11px]">
                <span className="text-muted-foreground">{i + 1}</span>
                <span>{st.text}</span>
              </span>
            ))
          )}
        </div>

        <p data-chrome className="flex flex-wrap items-center gap-x-5 gap-y-1 px-6 text-[11px] text-muted-foreground">
          <span>{data.type === "sll" ? "Each node points to the next one; the last points to NULL." : data.type === "dll" ? "Each node points both ways; the ends point to NULL." : "The last node points back to the head, so the list never ends."}</span>
          <span><span style={{ color: INK.accent }}>HEAD</span> / <span style={{ color: INK.blue }}>TAIL</span></span>
          <span><span style={{ color: INK.purple }}>⚑</span> marker</span>
          <span><span style={{ color: INK.green }}>P</span> index cursor</span>
          <span><span style={{ color: INK.blue }}>▢</span> selected</span>
        </p>
      </div>
    </section>
  );
}

import { linkEdge } from "../shared/edges";
function edgeGeometryFor(kind: "next" | "prev", from: Box, to: Box, lane: number, self: boolean): EdgeGeometry {
  return linkEdge(from, to, { dir: kind === "next" ? "fwd" : "back", lane, self });
}
