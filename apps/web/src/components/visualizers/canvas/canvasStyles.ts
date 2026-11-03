/**
 * On the shared canvas each structure is drawn bare. The stages mark their own chrome (stat rows,
 * legends, footers, frames) with `data-chrome` / `data-stage`; this hides it without touching any stage code.
 *
 * Colors come from the global theme tokens (--card, --foreground ...), so dark and light both work.
 * --viz-node-mix is the one knob for how solid a node's fill is (40% to 50% looks right).
 */
export const CANVAS_CSS = `
[data-canvas]{color:var(--foreground)}
[data-canvas-group]{--viz-node-mix:45%;--viz-node:color-mix(in oklab,var(--card) var(--viz-node-mix),transparent)}
[data-canvas-group] [data-box]{background:var(--viz-node) !important}
[data-canvas-group] [data-chrome]{display:none !important}
[data-canvas-group] section[data-stage]{border:0 !important;border-radius:0 !important;background:transparent !important;overflow:visible !important}
[data-canvas-group] section[data-stage] > [aria-hidden]{display:none !important}
[data-canvas-group] section[data-stage] > div{padding-top:0 !important;padding-bottom:0 !important;gap:0 !important}
[data-canvas-group] [data-board-wrap]{margin:0 !important}
[data-canvas-group] [data-stage-board]{max-height:none !important;min-height:0 !important;overflow:visible !important;border:0 !important;border-radius:0 !important}
`;
