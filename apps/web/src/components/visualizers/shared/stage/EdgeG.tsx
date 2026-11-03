"use client";
import { COLOR_FADE } from "./tokens";
import type { EdgeGeo } from "./geometry";

export interface EdgeGProps {
  eid: string; // unique key of the edge (tree: "p>c:left", graph: "e1"); written to data-key
  from: string;
  to: string;
  geo: EdgeGeo;
  directed: boolean;
  bend?: number;
  self?: boolean;
  label?: string;
  labelOffset?: [number, number];
  kind?: string;
  ghost?: boolean;
  emphasis?: "none" | "path" | "hot" | "selected";
  onSelect?: (eid: string) => void;
  title?: string;
}

/**
 * Children order matters (the animator re-paths them): shaft, head, label, click target.
 * The same component draws tree edges and graph edges.
 */
export function EdgeG(p: EdgeGProps) {
  const { eid, from, to, geo, directed, bend = 0, self = false, label = "", labelOffset = [0, 0], kind, ghost, emphasis = "none", onSelect, title } = p;
  const attr = ghost ? { "data-edge-ghost": "" } : { "data-edge": "" };
  const strong = emphasis !== "none";
  return (
    <g
      {...attr}
      data-key={eid}
      data-from={from}
      data-to={to}
      data-kind={kind}
      data-directed={directed ? "1" : "0"}
      data-bend={bend}
      data-self={self ? "1" : "0"}
      data-lox={labelOffset[0]}
      data-loy={labelOffset[1]}
      data-label={label}
      className={strong ? "text-[#0070F3]" : "text-primary-foreground/55"}
      stroke="currentColor"
      strokeWidth={emphasis === "selected" ? 3.2 : emphasis === "hot" ? 2.6 : emphasis === "path" ? 2.4 : 1.75}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ transition: COLOR_FADE }}
    >
      <path data-draw="shaft" pathLength={1} d={geo.shaft} />
      <path data-draw="head" pathLength={1} d={geo.head} />
      <text x={geo.label[0] + labelOffset[0]} y={geo.label[1] + labelOffset[1]} textAnchor="middle" dominantBaseline="middle" fill="currentColor" className="stroke-card" strokeWidth={4} paintOrder="stroke" fontSize="10.5" fontWeight={600} fontFamily="ui-monospace, monospace">
        {label}
      </text>
      <path d={geo.shaft} stroke="transparent" strokeWidth={14} style={{ pointerEvents: ghost || !onSelect ? "none" : "stroke", cursor: "pointer" }} onClick={ghost || !onSelect ? undefined : (e) => (e.stopPropagation(), onSelect(eid))}>
        {title && <title>{title}</title>}
      </path>
    </g>
  );
}
