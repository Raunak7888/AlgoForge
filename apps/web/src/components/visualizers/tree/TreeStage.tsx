"use client";
import { useRef, useState } from "react";
import { spring, stagger, utils } from "animejs";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "../shared/animationSettings";
import { annotationArc } from "../shared/edges";
import { Caption } from "../shared/stage/Caption";
import { StageBoard, type BoardApi } from "../shared/stage/StageBoard";
import { EdgeG } from "../shared/stage/EdgeG";
import { edgeCurve } from "../shared/stage/geometry";
import { NodeDisc } from "../shared/stage/NodeDisc";
import { StageFrame } from "../shared/stage/StageFrame";
import { COLOR_FADE, INK } from "../shared/stage/tokens";
import { playRestore, useStageAnimator } from "../shared/stage/useStageAnimator";
import { btn } from "../shared/styles";
import { fmt } from "./engine";
import { T, boxOf, colX, layoutOf, rootPillPos, rowY } from "./layout";
import { TYPE_LABEL, activeIds, edgesOf, heightOf, lengthOf, parseEdgeKey, type Edge } from "./model";
import type * as LabT from "./types";
import type { Step } from "./types";

function Pill({ name, x, y, label, color }: { name: string; x: number; y: number; label: string; color: string }) {
  return (
    <div data-ptr={name} data-x={x} data-y={y} className="pointer-events-none absolute left-0 top-0" style={{ width: T.PILL_W }}>
      <span data-ptr-pill className="inline-flex h-5 items-center justify-center rounded-full border px-2 font-mono text-[10px] font-semibold tracking-wide" style={{ color, borderColor: `${color}66`, background: `${color}14`, minWidth: T.PILL_W, transformOrigin: "50% 100%" }}>
        {label}
      </span>
    </div>
  );
}

/** What a stage needs to draw one structure. The old labs feed it from their store; the shared canvas feeds it directly. */
export interface TreeStageViewProps {
  data: LabT.TreeState;
  last: Pick<LabT.LogEntry, "seq" | "outcome"> | null;
  selectedId: string | null;
  anim: { token: number; plan: LabT.Anim } | null;
  status: "ready" | "animating" | "paused";
  showIds: boolean;
  caption: import("../shared/stage/Caption").CaptionData | null;
  selectNode: (id: string | null) => void;
  finishAnimation: (token: number) => void;
  run: (op: LabT.TreeOp) => void;
}

export function TreeStageView({ data, last, selectedId, anim, status, showIds, caption, selectNode, finishAnimation, run }: TreeStageViewProps) {
  const reduced = useReducedMotion();

  const host = useRef<HTMLElement>(null);
  const api = useRef<BoardApi | null>(null);
  const [hover, setHover] = useState<string | null>(null);

  const plan = anim?.plan ?? null;
  const before = plan && "prev" in plan ? plan.prev : null;
  const lay = layoutOf(data);
  const prevLay = before ? layoutOf(before) : null;
  const n = lengthOf(data);
  const liveKeys = new Set(edgesOf(data).map((e) => e.key));

  /* Everything that is leaving is drawn from the state before the operation so it can fade out. */
  const ghostIds: string[] =
    plan?.kind === "delete" ? plan.ghostIds : plan?.kind === "clear" || plan?.kind === "reset" ? Object.keys(plan.prev.nodes) : plan?.kind === "restore" ? Object.keys(plan.prev.nodes).filter((id) => !data.nodes[id]) : [];
  const ghostMark = plan?.kind === "markOut" ? { nodeId: plan.nodeId, markId: plan.markId } : plan?.kind === "markMove" ? { nodeId: plan.fromId, markId: plan.markId } : null;
  const planSteps: Step[] = plan && "steps" in plan ? plan.steps : [];
  const ghostEdgeKeys: string[] =
    plan?.kind === "clear" || plan?.kind === "reset"
      ? edgesOf(plan.prev).map((e) => e.key)
      : plan?.kind === "restore"
        ? edgesOf(plan.prev).map((e) => e.key).filter((k) => !liveKeys.has(k))
        : Array.from(new Set(planSteps.flatMap((s) => s.removes)));
  const dismissed = plan?.kind === "dismiss" ? plan.prev.arrows.filter((a) => a.fromId !== null) : [];
  const rootPill = rootPillPos(data, lay);
  const width = Math.max(lay.width, prevLay?.width ?? 0);
  const height = Math.max(lay.height, prevLay?.height ?? 0);
  const steps: Step[] = last?.outcome.ok ? last.outcome.steps : [];
  const stepsKey = last ? `${last.seq}` : "none";

  // The root-to-node path is drawn a little stronger: hover a node to see its depth, or select it to keep it.
  const calm = status === "ready";
  const focus = calm && hover && data.nodes[hover] ? hover : selectedId;
  const pathSet = new Set<string>();
  if (focus && data.nodes[focus]) {
    let c: string | null = focus;
    for (let g = 0; c && g <= n; g++) {
      pathSet.add(c);
      c = data.nodes[c].parent;
    }
  }
  const dimOthers = calm && !!hover && !!data.nodes[hover];

  useStageAnimator({
    host,
    anim,
    reduced,
    finish: finishAnimation,
    deps: [data],
    reveal: (cx, cy) => api.current?.reveal(cx, cy),
    build: (c) => {
      const { m, D, plan: p, byId, edgeEls, ghostEdgeEls, ghostItems, live, chips, moved, movedPtrs } = c;
      const { add, pulse, bump, soft, snap } = m;
      const glidePtrs = (at: number) => add(movedPtrs, { x: c.toX, y: c.toY, ease: snap, duration: D * 0.9 }, at);
      const bumpPtr = (name: string, at: number) => {
        const pill = c.el.querySelector<HTMLElement>(`[data-ptr="${name}"] [data-ptr-pill]`);
        add(pill, { scale: 1.25, duration: D * 0.2, ease: "outQuad" }, at);
        add(pill, { scale: 1, duration: D * 0.7, ease: soft }, at + D * 0.2);
      };
      const shaftOf = (g: SVGGElement | undefined) => g?.children[0] as SVGPathElement | undefined;

      // Lines that a step will draw start hidden, so they appear exactly when their step is explained.
      for (const k of new Set(planSteps.flatMap((s) => s.adds))) {
        const g = c.edge(k, false);
        if (g) utils.set(g, { opacity: 0 });
      }
      if (chips.length) utils.set(chips, { opacity: 0.3 });

      /** Plays the pointer steps one after another and returns when the last one ends. */
      const playSteps = (list: Step[], at: number) => {
        list.forEach((st, i) => {
          const t = at + i * D;
          add(chips[i], { opacity: 1, scale: 1.04, duration: D * 0.25, ease: "outQuad" }, t);
          add(chips[i], { scale: 1, duration: D * 0.5, ease: soft }, t + D * 0.25);
          st.removes.forEach((k, j) => {
            const g = c.edge(k, true);
            if (g) m.drop(g, t + j * 50);
          });
          st.adds.forEach((k, j) => {
            const g = c.edge(k, false);
            if (g) m.draw(g, t + j * 50);
          });
          if (st.root) bumpPtr("root", t);
        });
        return at + list.length * D;
      };

      switch (p.kind) {
        case "insert": {
          // the nodes make room, the new node swings out of its parent and lands, the parent pulses as the line is drawn
          const fresh = byId.get(p.id);
          const parentId = data.nodes[p.id]?.parent ?? null;
          const parentEl = parentId ? byId.get(parentId) : null;
          if (fresh) utils.set(fresh, { x: parentEl ? c.tx(parentEl) : c.tx(fresh), y: parentEl ? c.ty(parentEl) : c.ty(fresh), scale: 0.3, opacity: 0 });
          add(moved, { x: c.toX, y: c.toY, ease: snap, duration: D, delay: stagger(30) }, 0);
          glidePtrs(D * 0.2);
          const emerge = D * 0.5;
          add(fresh, { opacity: 1, duration: D * 0.25, ease: "outQuad" }, emerge);
          add(fresh, { x: c.toX, y: c.toY, duration: D, ease: spring({ bounce: 0.38, duration: D }) }, emerge);
          add(fresh, { scale: 1.12, duration: D * 0.5, ease: "outQuad" }, emerge);
          add(fresh, { scale: 1, duration: D * 0.7, ease: soft }, emerge + D * 0.5);
          bump(parentEl, emerge);
          pulse(fresh, INK.green, emerge + D * 0.9);
          playSteps(p.steps, emerge + D * 0.6);
          c.reveal(p.id);
          break;
        }
        case "delete": {
          // the doomed node shakes and hovers, pointers are re-linked around it, it collapses, neighbours settle
          m.tint(ghostItems, INK.red);
          pulse(ghostItems[0], INK.red, 0);
          ghostItems.forEach((g) => m.shake(g, 0));
          add(ghostItems, { scale: 1.08, duration: D * 0.3, ease: "outQuad" }, 0);
          add(ghostItems, { y: (t: unknown) => c.ty(t as HTMLElement) - 20, opacity: 0.6, duration: D * 0.5, ease: soft }, D * 0.3);
          const end = playSteps(p.steps, D * 0.4);
          m.vanish(ghostItems, end);
          add(moved, { x: c.toX, y: c.toY, ease: snap, duration: D * 1.1, delay: stagger(30) }, end + D * 0.3);
          moved.forEach((t) => pulse(t, INK.green, end + D * 1.1));
          glidePtrs(end + D * 0.3);
          break;
        }
        case "rewire": {
          // the subtree lifts off, the pointers change, then it glides to where the new pointers put it
          const moving = p.ids.map((id) => byId.get(id)).filter((e): e is HTMLElement => !!e);
          if (p.what === "detach") m.tint(moving.slice(0, 1), INK.amber);
          add(moving, { scale: 1.1, y: (t: unknown) => c.ty(t as HTMLElement) - 10, duration: D * 0.35, ease: "outQuad" }, 0);
          const end = playSteps(p.steps, D * 0.3);
          if (p.what === "swap") {
            const right = moved.filter((t) => c.tx(t) > (c.before.get(t.dataset.id!)?.[0] ?? c.tx(t)));
            const left = moved.filter((t) => !right.includes(t));
            add(right, { y: (t: unknown) => c.ty(t as HTMLElement) - 30, duration: D * 0.3, ease: "outQuad" }, end);
            add(left, { y: (t: unknown) => c.ty(t as HTMLElement) + 22, duration: D * 0.3, ease: "outQuad" }, end);
            add(moved, { x: c.toX, y: c.toY, ease: snap, duration: D * 1.1, delay: stagger(20) }, end + D * 0.25);
          } else add(moved, { x: c.toX, y: c.toY, ease: snap, duration: D * 1.2, delay: stagger(25) }, end + D * 0.1);
          add(moving, { scale: 1, y: c.toY, duration: D * 0.7, ease: soft }, end + D * 1.2);
          glidePtrs(end + D * 0.1);
          pulse(moving[0], p.what === "detach" ? INK.amber : INK.green, end + D * 1.3);
          break;
        }
        case "update": {
          const t = byId.get(p.id);
          if (t) {
            m.swapText(t.querySelector<HTMLElement>("[data-value]"), fmt(p.oldValue), t.dataset.text ?? "", 0);
            bump(t, D * 0.3);
            pulse(t, INK.accent, D * 0.3);
          }
          break;
        }
        case "read": {
          const t = byId.get(p.id);
          pulse(t, INK.blue, 0);
          pulse(t, INK.blue, D * 0.5);
          bump(t, 0);
          const sel = t?.querySelector<HTMLElement>("[data-sel]");
          if (sel) {
            utils.set(sel, { scale: 1.3, opacity: 0 });
            add(sel, { opacity: 1, scale: 1, duration: D * 0.7, ease: soft }, D * 0.1);
          }
          c.reveal(p.id);
          break;
        }
        case "path": {
          // follows the path you typed from the root, one edge at a time, with a dot running along each line
          const step = D * 0.5;
          p.ids.forEach((id, k) => {
            const t = byId.get(id);
            pulse(t, INK.blue, k * step);
            bump(t, k * step);
            if (k > 0) {
              const g = edgeEls.find((e) => e.dataset.to === id && e.dataset.from === p.ids[k - 1]);
              m.flash(g, INK.blue, k * step - D * 0.3);
              m.travel(g?.children[0] as SVGPathElement | undefined, c.dot, INK.blue, k * step - D * 0.3, step);
            }
          });
          const sel = byId.get(p.ids[p.ids.length - 1])?.querySelector<HTMLElement>("[data-sel]");
          if (sel) {
            utils.set(sel, { scale: 1.3, opacity: 0 });
            add(sel, { opacity: 1, scale: 1, duration: D * 0.7, ease: soft }, (p.ids.length - 1) * step);
          }
          c.reveal(p.ids[p.ids.length - 1]);
          break;
        }
        case "relate": {
          const a = byId.get(p.from);
          pulse(a, INK.blue, 0);
          if (p.to) {
            const b = byId.get(p.to);
            const g = edgeEls.find((e) => (e.dataset.from === p.from && e.dataset.to === p.to) || (e.dataset.from === p.to && e.dataset.to === p.from));
            m.flash(g, INK.blue, D * 0.2);
            m.travel(shaftOf(g), c.dot, INK.blue, D * 0.2, D * 0.6, g?.dataset.from === p.to);
            pulse(b, INK.blue, D * 0.7);
            bump(b, D * 0.7);
          } else m.shake(a, D * 0.2); // NULL: nothing there, so the node shakes "no"
          break;
        }
        case "retype":
          p.ids.forEach((id, i) => pulse(byId.get(id), INK.green, i * D * 0.12));
          break;
        case "clear": {
          m.tint(ghostItems, INK.red);
          ghostEdgeEls.forEach((g, j) => m.drop(g, j * 30));
          add(ghostItems, { opacity: 0, scale: 0.7, y: (t: unknown) => c.ty(t as HTMLElement) - 16, duration: D * 0.7, ease: "inCubic", delay: stagger(45) }, D * 0.1);
          glidePtrs(D * 0.3);
          break;
        }
        case "reset": {
          // the old tree fades out; the new nodes grow in from the top, then every line is drawn
          ghostEdgeEls.forEach((g, j) => m.drop(g, j * 25));
          add(ghostItems, { opacity: 0, scale: 0.8, duration: D * 0.6, ease: "inCubic", delay: stagger(30) }, D * 0.1);
          const start = D * 0.5;
          for (const t of live) utils.set(t, { x: c.tx(t), y: c.ty(t) - 30, opacity: 0, scale: 0.7 });
          add(live, { opacity: 1, duration: D * 0.4, delay: stagger(55), ease: "outQuad" }, start);
          add(live, { y: c.toY, scale: 1, duration: D * 1.1, delay: stagger(55), ease: spring({ bounce: 0.45, duration: D * 1.1 }) }, start);
          const edgesAt = start + live.length * 55 + D * 0.7;
          for (const g of edgeEls) utils.set(g, { opacity: 0 });
          edgeEls.forEach((g, j) => m.draw(g, edgesAt + j * 60, D * 0.5));
          glidePtrs(start);
          break;
        }
        case "restore":
          playRestore(c);
          glidePtrs(0);
          break;
        case "highlight": {
          const t = byId.get(p.id);
          const tint = t?.querySelector<HTMLElement>("[data-tint]");
          if (tint) {
            utils.set(tint, { scaleX: 0 });
            add(tint, { scaleX: [0, 1], duration: D * 0.9, ease: "outCubic" }, 0);
          }
          bump(t, 0);
          break;
        }
        case "markIn": {
          const mk = c.el.querySelector<HTMLElement>(`[data-mark="${p.markId}"]`);
          if (mk) {
            utils.set(mk, { scale: 0.4, opacity: 0, y: -8 });
            add(mk, { opacity: 1, duration: D * 0.3, ease: "outQuad" }, 0);
            add(mk, { scale: 1, y: 0, duration: D, ease: soft }, 0);
          }
          break;
        }
        case "markOut":
          add(c.el.querySelector<HTMLElement>("[data-mark-ghost]"), { scale: 0.4, opacity: 0, y: -8, duration: D * 0.6, ease: "inCubic" }, 0);
          break;
        case "markMove": {
          // the marker flies from the old node to the new one, then settles there
          const ghost = c.el.querySelector<HTMLElement>("[data-mark-ghost]");
          const real = c.el.querySelector<HTMLElement>(`[data-mark="${p.markId}"]`);
          const from = byId.get(p.fromId);
          const to = real?.closest<HTMLElement>("[data-node]");
          if (ghost && from && to) {
            add(ghost, { x: c.cur(to, "x") - c.cur(from, "x"), y: c.cur(to, "y") - c.cur(from, "y"), duration: D * 0.9, ease: snap }, 0);
            add(ghost, { opacity: 0, duration: D * 0.3, ease: "inQuad" }, D * 0.65);
          }
          if (real) {
            utils.set(real, { scale: 0.4, opacity: 0 });
            add(real, { opacity: 1, scale: 1, duration: D * 0.8, ease: soft }, D * 0.6);
          }
          pulse(to, INK.green, D * 0.7);
          break;
        }
        case "arrow": {
          const scope = c.el.querySelector(`[data-aedge][data-id="${p.id}"]`) ?? c.el.querySelector(`[data-arrow-for="${p.id}"]`);
          if (scope) {
            const body = Array.from(scope.querySelectorAll<SVGElement>('[data-draw="shaft"]'));
            const tips = Array.from(scope.querySelectorAll<SVGElement>('[data-draw="head"]'));
            [...body, ...tips].forEach((e) => {
              e.style.strokeDasharray = "1";
              e.style.strokeDashoffset = "1";
            });
            add(body, { strokeDashoffset: [1, 0], duration: D, ease: "outQuad" }, 0);
            add(tips, { strokeDashoffset: [1, 0], duration: D * 0.25, ease: "outQuad" }, D * 0.85);
          }
          break;
        }
        case "dismiss":
          add(Array.from(c.el.querySelectorAll<SVGElement>("[data-aedge-ghost]")), { opacity: 0, duration: D * 0.5, ease: "outQuad" }, 0);
          break;
        case "none":
          break;
      }
    },
  });

  /* ───────────── render ───────────── */
  const edgeG = (e: Edge, l: ReturnType<typeof layoutOf>, ghost: boolean) => {
    const a = boxOf(l, e.from);
    const b = boxOf(l, e.to);
    if (!a || !b) return null;
    return (
      <EdgeG key={`${ghost ? "g-" : ""}${e.key}`} eid={e.key} from={e.from} to={e.to} kind={e.kind} directed geo={edgeCurve(a, b, { directed: true })} label={e.kind === "left" ? "L" : "R"} labelOffset={[e.kind === "left" ? -10 : 10, 0]} ghost={ghost} emphasis={!ghost && pathSet.has(e.from) && pathSet.has(e.to) ? "path" : "none"} />
    );
  };
  const rootNode = data.root ? data.nodes[data.root] : null;
  const empty = data.root === null && data.detached.length === 0;

  return (
    <StageFrame
      hostRef={host}
      label="Tree stage"
      stats={[
        { label: "nodes in the tree", value: String(activeIds(data).length) },
        { label: "height", value: data.root ? String(heightOf(data, data.root)) : "-1" },
        { label: "root", value: rootNode ? `${data.root} · ${fmt(rootNode.value)}` : "NULL", mono: !!rootNode },
        { label: "type", value: TYPE_LABEL[data.type], mono: false },
      ]}
      badge={
        <span className="mb-0.5 inline-flex h-6 items-center gap-1.5 rounded-full border border-primary-foreground/15 px-2.5 text-[11px] text-muted-foreground" title={data.type === "bst" ? "Every node is larger than everything in its left subtree and smaller than everything in its right subtree." : "A binary tree accepts any shape and any values."}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: data.type === "bst" ? INK.green : "#9CA3AF" }} />
          {data.type === "bst" ? "left < node < right holds" : "any shape allowed"}
        </span>
      }
      footer={
        <>
          {/* what the pointers did, one chip per step, lit up as the animation reaches it */}
          <div key={stepsKey} className="flex flex-wrap gap-2 px-6" aria-label="Pointer steps">
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
          <p className="flex flex-wrap items-center gap-x-5 gap-y-1 px-6 text-[11px] text-muted-foreground">
            <span>{data.type === "bst" ? "Smaller values go left, larger go right." : "Each node has up to two children: left and right."}</span>
            <span><span style={{ color: INK.accent }}>ROOT</span> top of the tree</span>
            <span><span style={{ color: INK.green }}>⚑ P</span> default mark, <span style={{ color: INK.purple }}>⚑</span> named mark</span>
            <span>Solid blue ring + “selected” = selected node.</span>
            <span>Hover or select a node: its path to the root is drawn in blue and the rest dims.</span>
            <span>L / R: which child.</span>
          </p>
        </>
      }
    >
      <StageBoard label="Tree board" apiRef={api} overlay={<Caption data={caption} />} onBackgroundClick={() => selectedId && selectNode(null)}>
        <div className="relative" style={{ width, height }}>
          {/* depth guides: one faint line per level, so "depth" is visible without a single click */}
          {Array.from({ length: (data.root ? lay.maxDepth : 0) + 1 }, (_, d) => (
            <div key={`lvl${d}`} aria-hidden className="pointer-events-none absolute inset-x-0 border-t border-dashed border-primary-foreground/[0.07]" style={{ top: rowY(d) + T.D / 2 }}>
              <span className="absolute left-1.5 -top-2.5 font-mono text-[9px] text-muted-foreground/70">{`depth ${d}`}</span>
            </div>
          ))}
          {lay.detachedX !== null && <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 bg-primary-foreground/[0.035]" style={{ left: lay.detachedX }} />}
          <svg aria-hidden className="pointer-events-none absolute inset-0 overflow-visible" width={width} height={height}>
            {edgesOf(data).map((e) => edgeG(e, lay, false))}
            {before && prevLay && ghostEdgeKeys.map((k) => edgeG(parseEdgeKey(k), prevLay, true))}
            {data.arrows
              .filter((a) => a.fromId !== null)
              .map((a) => {
                const f = boxOf(lay, a.fromId!);
                const t = boxOf(lay, a.toId);
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
              const l = prevLay ?? lay;
              const f = boxOf(l, a.fromId!);
              const t = boxOf(l, a.toId);
              const g = f && t ? annotationArc(f, t) : null;
              return (
                <g key={`d-${a.id}`} data-aedge-ghost style={{ stroke: a.color }} strokeWidth={1.75} fill="none" strokeLinecap="round" strokeDasharray="5 4">
                  <path d={g?.shaft ?? ""} />
                </g>
              );
            })}
            <circle data-fx-dot r={5} cx={0} cy={0} opacity={0} style={{ filter: "drop-shadow(0 0 4px currentColor)" }} />
          </svg>

          {lay.detachedX !== null && (
            <div aria-hidden className="pointer-events-none absolute bottom-3 top-3 border-l border-dashed border-primary-foreground/25" style={{ left: lay.detachedX }}>
              <span className="absolute left-2 top-0 whitespace-nowrap text-[10px] text-muted-foreground">detached: not part of the tree</span>
            </div>
          )}

          {empty && (
            <>
              <div className="absolute flex items-center justify-center rounded-full border border-dashed border-primary-foreground/25 text-[11px] text-muted-foreground" style={{ left: colX(0), top: rowY(0), width: T.D, height: T.D }}>
                empty
              </div>
              <div className="absolute flex max-w-[280px] flex-col items-start gap-2 text-xs leading-relaxed text-muted-foreground" style={{ left: colX(0) + T.D + 16, top: rowY(0) - 4 }}>
                <p>
                  The tree is empty: the root is NULL. Run <code className="font-mono text-primary-foreground">{data.type === "bst" ? "insert" : "createRoot"}</code> to add the first node.
                </p>
                <button type="button" className={btn} onClick={() => run({ type: "reset" })}>Load starter tree</button>
              </div>
            </>
          )}

          {Object.keys(data.nodes).map((id) => {
            const node = data.nodes[id];
            const box = boxOf(lay, id)!;
            const arrow = data.arrows.find((a) => a.fromId === null && a.toId === id);
            return (
              <NodeDisc
                key={id}
                id={id}
                kind="node"
                text={fmt(node.value)}
                box={box}
                showIds={showIds}
                hl={data.highlights[id]}
                selected={selectedId === id}
                dim={dimOthers && !pathSet.has(id)}
                hot={hover === id}
                marks={data.markers.filter((mk) => mk.nodeId === id).map((mk) => mk.id)}
                ghostMarkId={ghostMark?.nodeId === id ? ghostMark.markId : undefined}
                arrow={arrow ? { id: arrow.id, color: arrow.color } : undefined}
                badge={data.detached.includes(id) ? "detached" : undefined}
                onSelect={selectNode}
                onHover={setHover}
              />
            );
          })}
          {before &&
            prevLay &&
            ghostIds.map((id) => (
              <NodeDisc key={`ghost-${id}`} id={id} kind="node" text={fmt(before.nodes[id].value)} box={boxOf(prevLay, id)!} showIds={showIds} hl={before.highlights[id]} marks={before.markers.filter((mk) => mk.nodeId === id).map((mk) => mk.id)} ghost />
            ))}

          <Pill name="root" x={rootPill[0]} y={rootPill[1]} label="ROOT" color={INK.accent} />
        </div>
      </StageBoard>
    </StageFrame>
  );
}
void cn;
