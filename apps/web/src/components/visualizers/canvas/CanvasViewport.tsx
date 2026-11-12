"use client";
import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type KeyboardEvent,
    type PointerEvent as RPointerEvent,
    type ReactNode,
} from "react";
import { useReducedMotion } from "../shared/animationSettings";
import {
    centered,
    fit,
    panBy,
    zoomAt,
    ZOOM_STEP,
    type Size,
    type Transform,
} from "./viewport";

interface Props {
    /** Bounding box of everything on the canvas, in canvas units. */
    content: Size;
    children: ReactNode;
    className?: string;
}

const btn =
    "inline-flex h-7 min-w-7 items-center justify-center rounded-md border border-primary-foreground/15 bg-card/90 px-2 text-xs text-foreground shadow-sm backdrop-blur transition-colors hover:bg-primary-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground/30";
/**
 * Pan and zoom around one big canvas. By default it keeps everything in view ("auto-fit") and glides
 * as structures grow. Dragging, Ctrl/Cmd + wheel, the buttons or the keys take manual control;
 * Fit (button, F, double-click) hands it back.
 */
export function Viewport({ content, children, className }: Props) {
    const outer = useRef<HTMLDivElement>(null);
    const [view, setView] = useState<Size>({ w: 0, h: 0 });
    const [manual, setManual] = useState<Transform | null>(null);
    const [dragging, setDragging] = useState(false);
    const reduced = useReducedMotion();
    const drag = useRef<{ x: number; y: number; t: Transform } | null>(null);

    const auto = useMemo(() => fit(content, view), [content, view]);
    const t = manual ?? auto;
    const tRef = useRef(t);
    const viewRef = useRef(view);
    useEffect(() => {
        tRef.current = t;
        viewRef.current = view;
    });

    useEffect(() => {
        const el = outer.current;
        if (!el) return;
        const measure = () =>
            setView((v) =>
                v.w === el.clientWidth && v.h === el.clientHeight
                    ? v
                    : { w: el.clientWidth, h: el.clientHeight },
            );
        measure();
        if (typeof ResizeObserver === "undefined") return;
        const ro = new ResizeObserver(measure);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    const zoomBy = useCallback(
        (factor: number, around?: { x: number; y: number }) => {
            const v = viewRef.current;
            setManual(
                zoomAt(
                    tRef.current,
                    factor,
                    around ?? { x: v.w / 2, y: v.h / 2 },
                ),
            );
        },
        [],
    );
    const fitAll = useCallback(() => setManual(null), []);
    const actualSize = useCallback(
        () => setManual(centered(content, viewRef.current, 1)),
        [content],
    );

    // Ctrl/Cmd + wheel (and trackpad pinch) zooms around the pointer. A plain wheel keeps scrolling the page.
    useEffect(() => {
        const el = outer.current;
        if (!el) return;
        const onWheel = (e: WheelEvent) => {
            if (!e.ctrlKey && !e.metaKey) return;
            e.preventDefault();
            const r = el.getBoundingClientRect();
            zoomBy(Math.exp(-e.deltaY * 0.01), {
                x: e.clientX - r.left,
                y: e.clientY - r.top,
            });
        };
        el.addEventListener("wheel", onWheel, { passive: false });
        return () => el.removeEventListener("wheel", onWheel);
    }, [zoomBy]);

    const onPointerDown = (e: RPointerEvent<HTMLDivElement>) => {
        if (e.button !== 0) return;
        drag.current = { x: e.clientX, y: e.clientY, t: tRef.current };
        setDragging(true);
        e.currentTarget.setPointerCapture?.(e.pointerId);
    };
    const onPointerMove = (e: RPointerEvent<HTMLDivElement>) => {
        const d = drag.current;
        if (!d) return;
        setManual(panBy(d.t, e.clientX - d.x, e.clientY - d.y));
    };
    const endDrag = (e: RPointerEvent<HTMLDivElement>) => {
        if (!drag.current) return;
        drag.current = null;
        setDragging(false);
        e.currentTarget.releasePointerCapture?.(e.pointerId);
    };

    const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        const k = e.key.toLowerCase();
        if (k === "+" || k === "=") zoomBy(ZOOM_STEP);
        else if (k === "-" || k === "_") zoomBy(1 / ZOOM_STEP);
        else if (k === "0") actualSize();
        else if (k === "f") fitAll();
        else return;
        e.preventDefault();
    };

    const empty = content.w <= 0 || content.h <= 0;
    const glide = !manual && !dragging && !reduced;

    return (
        <div
            ref={outer}
            data-canvas
            role="region"
            aria-label="Visualizer canvas. Drag to pan, Ctrl or Command with the wheel to zoom, F to fit."
            tabIndex={0}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onDoubleClick={fitAll}
            onKeyDown={onKeyDown}
            className={
                className ??
                "relative h-full min-h-[360px] w-full touch-none select-none overflow-hidden rounded-2xl border border-neutral-500/25 bg-neutral-500/5 outline-none focus-visible:ring-2 focus-visible:ring-neutral-500/40"
            }
            style={{
                cursor: dragging ? "grabbing" : "grab",
                backgroundImage:
                    "radial-gradient(circle, rgba(128,128,128,0.35) 1px, transparent 1.5px)",
                backgroundSize: `${24 * t.k}px ${24 * t.k}px`,
                backgroundPosition: `${t.x}px ${t.y}px`,
            }}
        >
            <div
                data-canvas-content
                style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    width: content.w,
                    height: content.h,
                    transformOrigin: "0 0",
                    transform: `translate(${t.x}px, ${t.y}px) scale(${t.k})`,
                    transition: glide
                        ? "transform 280ms cubic-bezier(.2,.8,.2,1)"
                        : "none",
                    willChange: "transform",
                }}
            >
                {children}
            </div>
            {empty ? (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <p className="rounded-lg border border-neutral-500/25 bg-neutral-500/10 px-4 py-2 text-sm text-neutral-400">
                        Nothing here yet. Press Visualize then Play or Forward to begin.
                    </p>
                </div>
            ) : null}

            <div
                className="absolute bottom-3 right-3 flex items-center gap-1"
                onPointerDown={(e) => e.stopPropagation()}
                onDoubleClick={(e) => e.stopPropagation()}
            >
                <button
                    type="button"
                    className={btn}
                    aria-label="Zoom out"
                    onClick={() => zoomBy(1 / ZOOM_STEP)}
                >
                    −
                </button>
                <button
                    type="button"
                    className={`${btn} tabular-nums`}
                    aria-label="Zoom to 100%"
                    title="Zoom to 100%"
                    onClick={actualSize}
                >
                    {Math.round(t.k * 100)}%
                </button>
                <button
                    type="button"
                    className={btn}
                    aria-label="Zoom in"
                    onClick={() => zoomBy(ZOOM_STEP)}
                >
                    +
                </button>
                <button
                    type="button"
                    className={btn}
                    aria-label="Fit everything in view"
                    aria-pressed={manual === null}
                    onClick={fitAll}
                >
                    Fit
                </button>
            </div>
        </div>
    );
}
