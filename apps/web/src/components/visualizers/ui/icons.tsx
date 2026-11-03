export type IconName = "play" | "pause" | "back" | "forward" | "restart" | "end" | "replay" | "loop";

const ICONS: Record<IconName, { d: string; stroke?: boolean }> = {
    play: { d: "M4 2.5v11l9-5.5z" },
    pause: { d: "M3.5 2.5h3v11h-3zM9.5 2.5h3v11h-3z" },
    back: { d: "M11 3L4 8l7 5z" },
    forward: { d: "M5 3l7 5-7 5z" },
    restart: { d: "M3 3v10h1.5V3zM13 3L6 8l7 5z" },
    end: { d: "M13 3v10h-1.5V3zM3 3l7 5-7 5z" },
    replay: { d: "M13 8a5 5 0 1 1-1.6-3.7M13 2.5v3h-3", stroke: true },
    loop: { d: "M2 7V6a2 2 0 0 1 2-2h8l-2-2M14 9v1a2 2 0 0 1-2 2H4l2 2", stroke: true },
};

export function Icon({ name }: { name: IconName }) {
    const i = ICONS[name];
    return (
        <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden focusable="false" fill={i.stroke ? "none" : "currentColor"} stroke={i.stroke ? "currentColor" : "none"} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d={i.d} />
        </svg>
    );
}
