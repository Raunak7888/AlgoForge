"use client";
import { useCallback, useEffect, useRef, type MutableRefObject, type ReactNode } from "react";

export interface BoardApi {
  /** Screen coordinates → board coordinates (what the nodes' x / y use). */
  toBoard: (clientX: number, clientY: number) => { x: number; y: number };
  /** Scrolls a board point into view if it is outside the box. */
  reveal: (cx: number, cy: number) => void;
}

interface Props {
  label: string;
  apiRef: MutableRefObject<BoardApi | null>;
  children: ReactNode;
  /** Drawn over the box (not inside the scrolling area), e.g. the caption. */
  overlay?: ReactNode;
  cursor?: string;
  onBackgroundClick?: () => void;
  onBackgroundDoubleClick?: (p: { x: number; y: number }) => void;
  onPointerMoveBoard?: (p: { x: number; y: number }) => void;
}

/**
 * A plain box around a lab's board: no zoom, no pan, no grid. If the board is bigger than the box it scrolls.
 * Stages only rely on `BoardApi`, so a global canvas can replace this file later.
 */
export function StageBoard(p: Props) {
  const { label, apiRef, children, overlay, cursor, onBackgroundClick, onBackgroundDoubleClick, onPointerMoveBoard } = p;
  const scroller = useRef<HTMLDivElement>(null);
  const board = useRef<HTMLDivElement>(null);

  const toBoard = useCallback((cx: number, cy: number) => {
    const r = board.current?.getBoundingClientRect();
    return r ? { x: cx - r.left, y: cy - r.top } : { x: 0, y: 0 };
  }, []);

  useEffect(() => {
    apiRef.current = {
      toBoard,
      reveal: (cx, cy) => {
        const el = scroller.current;
        if (!el || typeof el.scrollTo !== "function") return;
        const inX = cx > el.scrollLeft + 40 && cx < el.scrollLeft + el.clientWidth - 40;
        const inY = cy > el.scrollTop + 40 && cy < el.scrollTop + el.clientHeight - 40;
        if (inX && inY) return;
        el.scrollTo({ left: Math.max(0, cx - el.clientWidth / 2), top: Math.max(0, cy - el.clientHeight / 2), behavior: "smooth" });
      },
    };
    return () => {
      apiRef.current = null;
    };
  }, [apiRef, toBoard]);

  return (
    <div data-board-wrap className="relative mx-6">
      <div
        ref={scroller}
        data-stage-board
        role="group"
        aria-label={`${label} (scrolls if it is larger than the box)`}
        tabIndex={0}
        className="max-h-[min(62vh,580px)] min-h-[300px] overflow-auto rounded-xl border border-primary-foreground/10 outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground/20"
        style={{ cursor: cursor ?? "default" }}
      >
        <div
          ref={board}
          data-board
          className="relative mx-auto w-max"
          onClick={() => onBackgroundClick?.()}
          onDoubleClick={(e) => {
            if ((e.target as Element).closest("[data-item],[data-edge]")) return;
            onBackgroundDoubleClick?.(toBoard(e.clientX, e.clientY));
          }}
          onPointerMove={onPointerMoveBoard ? (e) => onPointerMoveBoard(toBoard(e.clientX, e.clientY)) : undefined}
        >
          {children}
        </div>
      </div>
      {overlay}
    </div>
  );
}
