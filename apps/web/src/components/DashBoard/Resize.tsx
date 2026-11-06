"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent as RPointerEvent, type RefObject } from "react";
import { nextPctForKey, pctFromPointer } from "@/lib/split";

export interface ResizeHandleProps {
    /** The element whose width the percentage refers to. */
    containerRef: RefObject<HTMLElement | null>;
    value: number;
    min: number;
    max: number;
    defaultValue: number;
    onChange: (pct: number) => void;
    label?: string;
}

export default function ResizeHandle({ containerRef, value, min, max, defaultValue, onChange, label = "Resize panels" }: ResizeHandleProps) {
    const [dragging, setDragging] = useState(false);
    const drag = useRef(false);

    useEffect(() => {
        if (!dragging) return;
        const prev = { cursor: document.body.style.cursor, select: document.body.style.userSelect };
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
        return () => {
            document.body.style.cursor = prev.cursor;
            document.body.style.userSelect = prev.select;
        };
    }, [dragging]);

    const update = (clientX: number) => {
        const el = containerRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        if (rect.width > 0) onChange(pctFromPointer(clientX, rect, min, max));
    };

    const onPointerDown = (e: RPointerEvent<HTMLDivElement>) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.currentTarget.setPointerCapture?.(e.pointerId);
        drag.current = true;
        setDragging(true);
    };
    const onPointerMove = (e: RPointerEvent<HTMLDivElement>) => {
        if (drag.current) update(e.clientX);
    };
    const end = (e: RPointerEvent<HTMLDivElement>) => {
        if (!drag.current) return;
        drag.current = false;
        setDragging(false);
        if (e.currentTarget.hasPointerCapture?.(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    };
    const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
        const next = nextPctForKey(e.key, e.shiftKey, value, min, max);
        if (next === null) return;
        e.preventDefault();
        if (next !== value) onChange(next);
    };

    return (
        <div className="relative z-10 w-0.75 shrink-0">
            <div
                role="separator"
                aria-orientation="vertical"
                aria-label={label}
                aria-valuenow={Math.round(value)}
                aria-valuemin={min}
                aria-valuemax={max}
                tabIndex={0}
                data-dragging={dragging ? "true" : "false"}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={end}
                onPointerCancel={end}
                onDoubleClick={() => onChange(defaultValue)}
                onKeyDown={onKeyDown}
                className="group absolute inset-y-0 -inset-x-2 flex cursor-col-resize touch-none select-none items-center justify-center outline-none"
            >
                <span aria-hidden className="absolute h-12 w-0.75 rounded-full bg-accent/30 opacity-0 blur-md transition-opacity group-data-[dragging=true]:opacity-60" />
                <span
                    aria-hidden
                    className="h-8 w-px rounded-full bg-white/40 transition-all group-hover:h-10 group-hover:bg-white/70 group-focus-visible:h-12 group-focus-visible:w-0.5 group-focus-visible:bg-accent group-data-[dragging=true]:bg-accent"
                />
            </div>
        </div>
    );
}
