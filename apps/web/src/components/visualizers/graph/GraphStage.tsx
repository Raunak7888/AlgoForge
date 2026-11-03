"use client";
import { useRef, useState, type PointerEvent as RPointerEvent } from "react";
import { stagger, utils } from "animejs";
import { useReducedMotion } from "../shared/animationSettings";
import { annotationArc, type Box } from "../shared/edges";
import { Caption } from "../shared/stage/Caption";
import { StageBoard, type BoardApi } from "../shared/stage/StageBoard";
import { EdgeG } from "../shared/stage/EdgeG";
import { NodeDisc } from "../shared/stage/NodeDisc";
import { StageFrame } from "../shared/stage/StageFrame";
import { COLOR_FADE, INK } from "../shared/stage/tokens";
import { playRestore, useStageAnimator } from "../shared/stage/useStageAnimator";
import { btn } from "../shared/styles";
import { fmt } from "./engine";
import { G, boxAt, clampPos, edgeGeo } from "./layout";
import { connectivityOfState, edgeCount, edgeList, findReverse, propsText, vertexCount, vertexIds } from "./model";
import type * as LabT from "./types";
import type { Edge, GraphState, Pos } from "./types";

/** What a stage needs to draw one structure. The old labs feed it from their store; the shared canvas feeds it directly. */
export interface GraphStageViewProps {
  data: LabT.GraphState;
  selV: string | null;
  selE: string | null;
  anim: { token: number; plan: LabT.Anim } | null;
  status: "ready" | "animating" | "paused";
  showIds: boolean;
  caption: import("../shared/stage/Caption").CaptionData | null;
  tool: "move" | "connect";
  connectFrom: string | null;
  selectVertex: (id: string | null) => void;
  selectEdge: (id: string | null) => void;
  setConnectFrom: (id: string | null) => void;
  run: (op: LabT.GraphOp) => void;
  finishAnimation: (token: number) => void;
}

export function GraphStageView({ data, selV, selE, anim, status, showIds, caption, tool, connectFrom, selectVertex, selectEdge, setConnectFrom, run, finishAnimation }: GraphStageViewProps) {
  const reduced = useReducedMotion();

  const host = useRef<HTMLElement>(null);
  const api = useRef<BoardApi | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [cursor, setCursor] = useState<Pos | null>(null);
  const [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(null);
  const dragRef = useRef<{ id: string; dx: number; dy: number; sx: number; sy: number; lx: number; ly: number; moved: boolean } | null>(null);

  const plan = anim?.plan ?? null;
  const prev = plan && "prev" in plan ? plan.prev : null;
  const posOf = (st: GraphState, id: string): Pos | undefined => (drag && drag.id === id && st === data ? { x: drag.x, y: drag.y } : st.positions[id]);

  const ghostIds: string[] = plan?.kind === "deleteVertex" ? [plan.id] : plan?.kind === "reset" || plan?.kind === "clear" ? Object.keys(plan.prev.vertices) : plan?.kind === "restore" ? Object.keys(plan.prev.vertices).filter((id) => !data.vertices[id]) : [];
  const ghostEdges: Edge[] = prev ? (plan?.kind === "reset" || plan?.kind === "clear" ? edgeList(prev) : edgeList(prev).filter((e) => !data.edges[e.id])) : [];
  const dismissed = plan?.kind === "dismiss" ? plan.prev.arrows.filter((a) => a.fromId !== null) : [];
  const ghostMark = plan?.kind === "markOut" ? { vertexId: plan.vertexId, markId: plan.markId } : plan?.kind === "markMove" ? { vertexId: plan.fromId, markId: plan.markId } : null;
  const conn = connectivityOfState(data);
  const connText = vertexCount(data) <= 1 ? "trivially connected" : data.props.directed ? (conn.strong ? "strongly connected" : conn.weak ? "weakly connected only" : `${conn.components} components`) : conn.weak ? "connected" : `${conn.components} components`;

  // hovering a vertex: its edges light up and everything not next to it dims
  const calm = status === "ready" && !drag;
  const hv = calm && hover && data.vertices[hover] ? hover : null;
  const hotEdges = new Set<string>();
  const near = new Set<string>();
  if (hv) {
    near.add(hv);
    for (const e of edgeList(data))
      if (e.source === hv || e.target === hv) {
        hotEdges.add(e.id);
        near.add(e.source);
        near.add(e.target);
      }
  }

  /* ── pointer: drag to move, edge tool to connect. The live position is UI state; one logged moveVertex is committed on release. ── */
  const toBoard = (e: { clientX: number; clientY: number }) => api.current?.toBoard(e.clientX, e.clientY) ?? { x: 0, y: 0 };
  const connectClick = (id: string) => {
    if (!connectFrom) return setConnectFrom(id);
    if (connectFrom === id) return setConnectFrom(null);
    run({ type: "addEdge", sourceId: connectFrom, targetId: id });
    setConnectFrom(null);
  };
  const pointer = {
    down: (e: RPointerEvent<HTMLDivElement>, id: string) => {
      e.stopPropagation();
      if (tool === "connect") return connectClick(id);
      if (status !== "ready") return selectVertex(id);
      const p = data.positions[id];
      const b = toBoard(e);
      e.currentTarget.setPointerCapture(e.pointerId);
      dragRef.current = { id, dx: p.x - b.x, dy: p.y - b.y, sx: p.x, sy: p.y, lx: p.x, ly: p.y, moved: false };
    },
    move: (e: RPointerEvent<HTMLDivElement>) => {
      const d = dragRef.current;
      if (!d) return;
      const b = toBoard(e);
      const c = clampPos(b.x + d.dx, b.y + d.dy);
      if (!d.moved && Math.hypot(c.x - d.sx, c.y - d.sy) < 4) return;
      d.moved = true;
      d.lx = c.x;
      d.ly = c.y;
      setDrag({ id: d.id, x: c.x, y: c.y });
    },
    up: (e: RPointerEvent<HTMLDivElement>) => {
      const d = dragRef.current;
      dragRef.current = null;
      if (e.currentTarget.hasPointerCapture?.(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
      if (!d) return;
      if (d.moved) run({ type: "moveVertex", vertexId: d.id, x: d.lx, y: d.ly, dragged: true });
      else selectVertex(d.id);
      setDrag(null);
    },
  };

  /** Double-click empty canvas: add a vertex right there. A Connected graph attaches it to the nearest vertex. */
  const addAt = (pt: { x: number; y: number }) => {
    const at = clampPos(pt.x, pt.y);
    let attachTo: string | undefined;
    if (data.props.connected && vertexCount(data) > 0) {
      let best = Infinity;
      for (const id of vertexIds(data)) {
        const p = data.positions[id];
        const d = Math.hypot(p.x - at.x, p.y - at.y);
        if (d < best) (best = d), (attachTo = id);
      }
    }
    run({ type: "addVertex", value: String.fromCharCode(65 + (vertexCount(data) % 26)), attachTo, at });
  };

  useStageAnimator({
    host,
    anim,
    reduced,
    finish: finishAnimation,
    deps: [data, drag],
    reveal: (cx, cy) => api.current?.reveal(cx, cy),
    build: (c) => {
      const { m, D, plan: p, byId, edgeEls, ghostEdgeEls, ghostItems, live, moved } = c;
      const { add, call, pulse, bump, soft, snap } = m;
      const shaftOf = (g: SVGGElement | undefined) => g?.children[0] as SVGPathElement | undefined;

      switch (p.kind) {
        case "addVertex": {
          const t = byId.get(p.id);
          m.spawn(t, 0);
          pulse(t, INK.green, D * 0.8);
          p.edgeIds.forEach((eid, i) => {
            const g = c.edge(eid, false);
            if (!g) return;
            utils.set(g, { opacity: 0 });
            m.draw(g, D * 0.7 + i * D * 0.3);
          });
          c.reveal(p.id);
          break;
        }
        case "deleteVertex": {
          m.tint(ghostItems, INK.red);
          pulse(ghostItems[0], INK.red, 0);
          ghostItems.forEach((g) => m.shake(g, 0));
          ghostEdgeEls.forEach((g, j) => m.drop(g, D * 0.3 + j * 50));
          m.vanish(ghostItems, D * 0.9);
          break;
        }
        case "addEdge": {
          const g = c.edge(p.id, false);
          if (g) {
            utils.set(g, { opacity: 0 });
            m.draw(g, 0);
            m.travel(shaftOf(g), c.dot, INK.green, 0, D * 0.7);
            pulse(byId.get(g.dataset.from!), INK.green, D * 0.1);
            pulse(byId.get(g.dataset.to!), INK.green, D * 0.7);
          }
          break;
        }
        case "removeEdge": {
          ghostEdgeEls.forEach((g) => {
            pulse(byId.get(g.dataset.from!), INK.red, 0);
            pulse(byId.get(g.dataset.to!), INK.red, 0);
            m.drop(g, 0);
          });
          break;
        }
        case "weight": {
          const g = c.edge(p.id, false);
          const lab = g?.children[2] as SVGTextElement | undefined;
          if (g && lab) {
            const next = g.dataset.label ?? "";
            lab.textContent = p.oldWeight === null ? "" : String(p.oldWeight);
            m.flash(g, INK.accent, 0);
            add(lab, { opacity: [1, 0], duration: D * 0.3, ease: "inCubic" }, 0);
            call(() => {
              lab.textContent = next;
            }, D * 0.3);
            add(lab, { opacity: [0, 1], duration: D * 0.6, ease: soft }, D * 0.3);
            pulse(byId.get(g.dataset.from!), INK.accent, D * 0.2);
            pulse(byId.get(g.dataset.to!), INK.accent, D * 0.2);
          }
          break;
        }
        case "updateVertex": {
          const t = byId.get(p.id);
          if (t) {
            m.swapText(t.querySelector<HTMLElement>("[data-value]"), fmt(p.oldValue), t.dataset.text ?? "", 0);
            bump(t, D * 0.3);
            pulse(t, INK.accent, D * 0.3);
          }
          break;
        }
        case "move":
          add(moved, { x: c.toX, y: c.toY, ease: snap, duration: D * 1.1 }, 0);
          pulse(byId.get(p.id), INK.blue, D);
          break;
        case "read": {
          p.vertexIds.forEach((id, i) => {
            const t = byId.get(id);
            pulse(t, INK.blue, i * D * 0.15);
            bump(t, i * D * 0.15);
          });
          p.edgeIds.forEach((id) => m.flash(c.edge(id, false), INK.blue, D * 0.1));
          if (p.edgeIds.length === 1 && p.vertexIds.length === 2) m.travel(shaftOf(c.edge(p.edgeIds[0], false)), c.dot, INK.blue, D * 0.1, D * 0.8);
          if (p.vertexIds[0]) c.reveal(p.vertexIds[0]);
          break;
        }
        case "props":
          live.forEach((t, i) => pulse(t, INK.green, i * D * 0.08));
          edgeEls.forEach((g) => m.flash(g, INK.green, 0));
          break;
        case "clear": {
          m.tint(ghostItems, INK.red);
          ghostEdgeEls.forEach((g, j) => m.drop(g, j * 30));
          add(ghostItems, { opacity: 0, scale: 0.7, y: (t: unknown) => c.ty(t as HTMLElement) - 16, duration: D * 0.7, ease: "inCubic", delay: stagger(45) }, D * 0.1);
          break;
        }
        case "reset": {
          ghostEdgeEls.forEach((g, j) => m.drop(g, j * 25));
          add(ghostItems, { opacity: 0, scale: 0.8, duration: D * 0.6, ease: "inCubic", delay: stagger(30) }, D * 0.1);
          const start = D * 0.5;
          for (const t of live) utils.set(t, { x: c.tx(t), y: c.ty(t) - 30, opacity: 0, scale: 0.7 });
          add(live, { opacity: 1, duration: D * 0.4, delay: stagger(55), ease: "outQuad" }, start);
          add(live, { y: c.toY, scale: 1, duration: D * 1.1, delay: stagger(55), ease: soft }, start);
          const edgesAt = start + live.length * 55 + D * 0.7;
          for (const g of edgeEls) utils.set(g, { opacity: 0 });
          edgeEls.forEach((g, j) => m.draw(g, edgesAt + j * 60, D * 0.5));
          break;
        }
        case "restore":
          playRestore(c);
          break;
        case "highlight": {
          p.ids.forEach((id, i) => {
            const t = byId.get(id);
            const tint = t?.querySelector<HTMLElement>("[data-tint]");
            if (tint) {
              utils.set(tint, { scaleX: 0 });
              add(tint, { scaleX: [0, 1], duration: D * 0.9, ease: "outCubic" }, i * D * 0.08);
            }
            bump(t, i * D * 0.08);
          });
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
  const boxesOf = (st: GraphState, e: Edge): [Box, Box] | null => {
    const a = posOf(st, e.source);
    const b = posOf(st, e.target);
    return a && b ? [boxAt(a), boxAt(b)] : null;
  };
  const arc = (st: GraphState, fromId: string, toId: string) => {
    const a = posOf(st, fromId);
    const b = posOf(st, toId);
    return a && b ? annotationArc(boxAt(a), boxAt(b)) : null;
  };
  const edgeNode = (st: GraphState, e: Edge, ghost: boolean) => {
    const b = boxesOf(st, e);
    if (!b) return null;
    const bend = findReverse(st, e) ? 1 : 0;
    const self = e.source === e.target;
    const emphasis = ghost ? "none" : selE === e.id ? "selected" : hotEdges.has(e.id) ? "hot" : "none";
    return (
      <EdgeG
        key={`${ghost ? "g-" : ""}${e.id}`}
        eid={e.id}
        from={e.source}
        to={e.target}
        directed={st.props.directed}
        bend={bend}
        self={self}
        geo={edgeGeo(b[0], b[1], { directed: st.props.directed, bend, self })}
        label={e.weight === null ? "" : String(e.weight)}
        ghost={ghost}
        emphasis={emphasis}
        onSelect={ghost ? undefined : selectEdge}
        title={`${e.id}: ${e.source} ${st.props.directed ? "→" : "—"} ${e.target}${e.weight !== null ? `, weight ${e.weight}` : ""}. Click to select.`}
      />
    );
  };
  const from = connectFrom ? posOf(data, connectFrom) : undefined;

  return (
    <StageFrame
      hostRef={host}
      label="Graph stage"
      stats={[
        { label: "vertices", value: String(vertexCount(data)) },
        { label: "edges", value: String(edgeCount(data)) },
        { label: "kind", value: propsText(data.props), mono: false },
        { label: "connectivity", value: connText, mono: false },
      ]}
      badge={
        tool === "connect" ? (
          <span className="mb-0.5 inline-flex h-6 items-center gap-1.5 rounded-full border px-2.5 text-[11px]" style={{ borderColor: `${INK.accent}66`, color: INK.accent }}>
            Edge tool: {connectFrom ? `click the second vertex (from ${connectFrom})` : "click the first vertex"} · Esc cancels
          </span>
        ) : undefined
      }
      footer={
        <p className="flex flex-wrap items-center gap-x-5 gap-y-1 px-6 text-[11px] text-muted-foreground">
          <span>{data.props.directed ? "Arrowhead = direction (source → target)." : "No arrowheads: edges work both ways."}</span>
          {data.props.weighted && <span>Number on an edge = its weight.</span>}
          <span><span style={{ color: INK.green }}>⚑ P</span> default mark, <span style={{ color: INK.purple }}>⚑</span> named mark</span>
          <span>Solid blue ring + “selected” = selected vertex; thicker blue line = selected edge.</span>
          <span>Dashed ring + tint = highlighted.</span>
          <span>Dashed arrow = annotation, not an edge.</span>
          <span>Drag a vertex to move it (layout only). Double-click empty canvas to add a vertex. Hover a vertex to see its edges.</span>
        </p>
      }
    >
      <StageBoard
        label="Graph board"
        apiRef={api}
        cursor={tool === "connect" ? "crosshair" : undefined}
        overlay={<Caption data={caption} />}
        onBackgroundClick={() => (selV || selE) && selectVertex(null)}
        onBackgroundDoubleClick={addAt}
        onPointerMoveBoard={(pt) => tool === "connect" && connectFrom && setCursor(pt)}
      >
        <div className="relative" style={{ width: G.W, height: G.H }}>
          <svg aria-hidden className="pointer-events-none absolute inset-0 overflow-visible" width={G.W} height={G.H}>
            {edgeList(data).map((e) => edgeNode(data, e, false))}
            {prev && ghostEdges.map((e) => edgeNode(prev, e, true))}
            {data.arrows
              .filter((a) => a.fromId !== null)
              .map((a) => {
                const g = arc(data, a.fromId!, a.toId);
                return (
                  <g key={a.id} data-aedge data-id={a.id} data-from={a.fromId!} data-to={a.toId} style={{ stroke: a.color, transition: COLOR_FADE }} strokeWidth={1.75} fill="none" strokeLinecap="round" strokeDasharray="5 4">
                    <path data-draw="shaft" pathLength={1} d={g?.shaft ?? ""} />
                    <path data-draw="head" pathLength={1} d={g?.wings[0] ?? ""} />
                    <path data-draw="head" pathLength={1} d={g?.wings[1] ?? ""} />
                  </g>
                );
              })}
            {dismissed.map((a) => {
              const g = prev ? arc(prev, a.fromId!, a.toId) : null;
              return (
                <g key={`d-${a.id}`} data-aedge-ghost style={{ stroke: a.color }} strokeWidth={1.75} fill="none" strokeLinecap="round" strokeDasharray="5 4">
                  <path d={g?.shaft ?? ""} />
                </g>
              );
            })}
            {tool === "connect" && from && cursor && <line x1={from.x} y1={from.y} x2={cursor.x} y2={cursor.y} stroke={INK.accent} strokeWidth={1.75} strokeDasharray="5 4" strokeLinecap="round" />}
            <circle data-fx-dot r={5} cx={0} cy={0} opacity={0} style={{ filter: "drop-shadow(0 0 4px currentColor)" }} />
          </svg>

          {vertexCount(data) === 0 && (
            <div className="absolute left-1/2 top-1/2 flex max-w-[320px] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-3 text-center text-xs leading-relaxed text-muted-foreground">
              <p>
                The graph is empty. Double-click the canvas to add a vertex, run <code className="font-mono text-primary-foreground">addVertex</code>, or start from an example.
              </p>
              <button type="button" className={btn} onClick={() => run({ type: "reset" })}>Load starter graph</button>
            </div>
          )}

          {Object.keys(data.vertices).map((id) => {
            const arrow = data.arrows.find((a) => a.fromId === null && a.toId === id);
            return (
              <NodeDisc
                key={id}
                id={id}
                kind="vertex"
                text={fmt(data.vertices[id].value)}
                box={boxAt(posOf(data, id)!)}
                showIds={showIds}
                hl={data.highlights[id]}
                selected={selV === id || connectFrom === id}
                dim={!!hv && !near.has(id)}
                hot={hover === id}
                marks={data.markers.filter((mk) => mk.vertexId === id).map((mk) => mk.id)}
                ghostMarkId={ghostMark?.vertexId === id ? ghostMark.markId : undefined}
                arrow={arrow ? { id: arrow.id, color: arrow.color } : undefined}
                onSelect={selectVertex}
                onHover={setHover}
                pointer={pointer}
              />
            );
          })}
          {prev &&
            ghostIds.map((id) => <NodeDisc key={`ghost-${id}`} id={id} kind="vertex" text={fmt(prev.vertices[id].value)} box={boxAt(prev.positions[id])} showIds={showIds} hl={prev.highlights[id]} marks={prev.markers.filter((mk) => mk.vertexId === id).map((mk) => mk.id)} ghost />)}
        </div>
      </StageBoard>
    </StageFrame>
  );
}
