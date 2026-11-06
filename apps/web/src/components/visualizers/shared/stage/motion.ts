import { animate, createTimeline, spring, stagger, utils } from "animejs";
import { INK } from "./tokens";

type TL = ReturnType<typeof createTimeline>;
export type Params = Parameters<typeof animate>[1];
export type El = HTMLElement | SVGElement;
type Tgt = El | El[] | null | undefined;

/**
 * One animation language for every lab. Every helper takes a start time `at` (ms on the timeline)
 * and is built from the single base duration D, so speed / duration settings change all labs equally.
 */
export function createMotion(tl: TL, D: number) {
  let added = 0;
  const soft = spring({ bounce: 0.26, duration: D });
  const snap = spring({ bounce: 0.1, duration: D * 0.9 });

  const add = (targets: Tgt, params: Params, at: number) => {
    if (!targets || (Array.isArray(targets) && targets.length === 0)) return;
    tl.add(targets, params, at);
    added++;
  };
  const call = (fn: () => void, at: number) => {
    tl.call(fn, at);
    added++;
  };

  /** A ring that expands and fades around a node. */
  const pulse = (t: El | null | undefined, color: string, at: number) => {
    const ring = t?.querySelector<HTMLElement>("[data-ring]");
    if (!ring) return;
    ring.style.borderColor = color;
    add(ring, { scale: [1, 1.3], opacity: [0.7, 0], duration: D * 1.2, ease: "outQuad" }, at);
  };
  /** A quick squash-and-settle. */
  const bump = (t: El | null | undefined, at: number) => {
    add(t, { scale: 1.12, duration: D * 0.2, ease: "outQuad" }, at);
    add(t, { scale: 1, duration: D * 0.7, ease: soft }, at + D * 0.2);
  };
  /** A "no" shake, around the node's own position. */
  const shake = (t: HTMLElement | null | undefined, at: number) => {
    if (!t) return;
    const x0 = Number(t.dataset.x);
    add(t, { x: x0 - 6, duration: D * 0.1, ease: "outQuad" }, at);
    add(t, { x: x0 + 6, duration: D * 0.14, ease: "inOutQuad" }, at + D * 0.1);
    add(t, { x: x0, duration: D * 0.3, ease: soft }, at + D * 0.24);
  };
  /** A new node grows in where it is. */
  const spawn = (t: El | null | undefined, at: number) => {
    if (!t) return;
    utils.set(t, { scale: 0.3, opacity: 0 });
    add(t, { opacity: 1, duration: D * 0.3, ease: "outQuad" }, at);
    add(t, { scale: 1, duration: D * 1.1, ease: spring({ bounce: 0.4, duration: D * 1.1 }) }, at);
  };
  /** Removed nodes shrink and fade. */
  const vanish = (ts: El[], at: number) => add(ts, { scale: 0.15, opacity: 0, duration: D * 0.6, ease: "inBack", delay: stagger(40) }, at);
  const tint = (ts: HTMLElement[], color: string) =>
    ts.forEach((g) => {
      const b = g.querySelector<HTMLElement>("[data-box]");
      if (b) b.style.borderColor = color;
    });

  /** Draws an edge from nothing, in green, then fades it back to normal. */
  const draw = (g: SVGGElement, at: number, span = D * 0.7, color: string = INK.green) => {
    const body = Array.from(g.querySelectorAll<SVGElement>('[data-draw="shaft"]'));
    const tips = Array.from(g.querySelectorAll<SVGElement>('[data-draw="head"]'));
    [...body, ...tips].forEach((e) => {
      e.style.strokeDasharray = "1";
      e.style.strokeDashoffset = "1";
    });
    call(() => (g.style.stroke = color), at);
    add(g, { opacity: 1, duration: 1 }, at);
    add(body, { strokeDashoffset: [1, 0], duration: span, ease: "outQuad" }, at);
    add(tips, { strokeDashoffset: [1, 0], duration: D * 0.25, ease: "outQuad" }, at + span * 0.85);
    call(() => (g.style.stroke = ""), at + span + D * 0.9);
  };
  /** Turns an edge red and fades it out. */
  const drop = (g: SVGGElement, at: number) => {
    call(() => (g.style.stroke = "#E5484D"), at);
    add(g, { opacity: 0, duration: D * 0.55, ease: "inQuad" }, at + D * 0.4);
  };
  /** Colors an edge for a moment. */
  const flash = (g: SVGGElement | undefined, color: string, at: number) => {
    if (!g) return;
    call(() => (g.style.stroke = color), at);
    call(() => (g.style.stroke = ""), at + D * 1.3);
  };
  /** A glowing dot that travels along an edge's line (reverse = from its end back to its start). */
  const travel = (path: SVGPathElement | undefined, dot: SVGCircleElement | null, color: string, at: number, dur: number, reverse = false) => {
    if (!path || !dot || typeof path.getTotalLength !== "function") return;
    const proxy = { p: reverse ? 1 : 0 };
    const place = () => {
      const pt = path.getPointAtLength(path.getTotalLength() * proxy.p);
      dot.setAttribute("cx", String(pt.x));
      dot.setAttribute("cy", String(pt.y));
    };
    call(() => {
      dot.style.fill = color;
      place();
      utils.set(dot, { opacity: 1 });
    }, at);
    add(proxy as unknown as El, { p: reverse ? [1, 0] : [0, 1], duration: dur, ease: "inOutSine", onUpdate: place } as Params, at);
    call(() => utils.set(dot, { opacity: 0 }), at + dur);
  };
  /** Old text slides out upward, new text slides in from below. */
  const swapText = (span: HTMLElement | null | undefined, from: string, to: string, at: number) => {
    if (!span) return;
    span.textContent = from;
    add(span, { y: [0, -14], opacity: [1, 0], duration: D * 0.35, ease: "inCubic" }, at);
    call(() => {
      span.textContent = to;
    }, at + D * 0.35);
    add(span, { y: [14, 0], opacity: [0, 1], duration: D * 0.65, ease: soft }, at + D * 0.35);
  };

  return { soft, snap, add, call, pulse, bump, shake, spawn, vanish, tint, draw, drop, flash, travel, swapText, count: () => added };
}
export type Motion = ReturnType<typeof createMotion>;
