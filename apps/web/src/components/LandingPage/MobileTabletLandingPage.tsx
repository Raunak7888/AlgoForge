"use client";

import {
    useEffect,
    useRef,
    useState,
    type CSSProperties,
    type MouseEvent,
    type PointerEvent as RPointerEvent,
    type ReactNode,
} from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { Tick02Icon, ZapIcon, Fire, LineChart, Target } from "@hugeicons/core-free-icons";
import { StatusChip } from "@/components/ui/StatusChip";
import { ANALYSIS_LIVE_COPY, useAnalysisAvailable } from "@/lib/analysisStatus";
import type { FeatureStatus } from "@/lib/featureStatus";
import { DASHBOARD_HREF, SITE } from "@/lib/site";
import { PRODUCT_FACTS } from "@/lib/productFacts";
import { Buddy, LandingStyles } from "./shared";

const DemoVideo = dynamic(() => import("./DemoVideo"), { ssr: false });

/** true = full motion even if the OS has "reduce motion" on (for testing). */
const FORCE_MOTION = false;

const reduced = () =>
    !FORCE_MOTION && typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const vib = (ms = 8) => {
    try {
        navigator.vibrate?.(ms);
    } catch {
        /* unsupported (iOS) */
    }
};

const cv = (o: Record<string, string | number>) => o as CSSProperties;
const clamp = (n: number, a = 0, b = 1) => Math.min(b, Math.max(a, n));

/* -------------------------------------------------------------------------- */
/*  Styles                                                                     */
/* -------------------------------------------------------------------------- */
function MobileStyles() {
    return (
        <style>{`
:root{--ease:cubic-bezier(.16,1,.3,1)}
html{scroll-behavior:smooth}
.m-root{-webkit-tap-highlight-color:transparent}

/* ---------- arrival (fill-mode backwards so :active transforms still work) ---------- */
@keyframes m-fade{from{opacity:0}to{opacity:1}}
@keyframes m-rise{from{opacity:0;transform:translate3d(0,18px,0)}to{opacity:1;transform:none}}
@keyframes m-word{from{transform:translate3d(0,110%,0) rotate(3deg)}to{transform:none}}
@keyframes m-drop{from{opacity:0;transform:translate3d(0,-100%,0)}to{opacity:1;transform:none}}
@keyframes m-pop{from{opacity:0;transform:scale(.6) rotate(-8deg)}to{opacity:1;transform:none}}
.m-rise{animation:m-rise .8s var(--ease) backwards;animation-delay:calc(var(--i,0)*90ms + 250ms)}
.m-word{display:block;animation:m-word .9s var(--ease) backwards;animation-delay:calc(var(--i,0)*80ms + 120ms)}
.m-drop{animation:m-drop .6s var(--ease) backwards}
.m-pop{animation:m-pop .7s var(--ease) .1s backwards}

/* ---------- word cycler: 5 words + 1 duplicate = 6 rows ---------- */
.m-cyc{display:block;height:1.12em;overflow:hidden}
.m-cyc-col{display:block;animation:m-cyc 10s cubic-bezier(.7,0,.3,1) infinite;will-change:transform}
.m-cyc-col>span{display:block;height:1.12em;line-height:1.12}
@keyframes m-cyc{
  0%,16%{transform:translate3d(0,0,0)}
  20%,36%{transform:translate3d(0,-16.667%,0)}
  40%,56%{transform:translate3d(0,-33.333%,0)}
  60%,76%{transform:translate3d(0,-50%,0)}
  80%,96%{transform:translate3d(0,-66.667%,0)}
  100%{transform:translate3d(0,-83.333%,0)}
}

/* ---------- scroll reveal + exit ---------- */
.m-armed [data-rv]{opacity:0;transform:translate3d(0,16px,0);
  transition:opacity .6s var(--ease),transform .6s var(--ease)}
.m-armed [data-rv="left"]{transform:translate3d(-18px,0,0)}
.m-armed [data-rv="zoom"]{transform:translate3d(0,26px,0) scale(.95)}
.m-armed [data-rv].m-in{opacity:1;transform:none;transition-delay:var(--d,0ms)}
.m-armed [data-rv].m-in.m-past{opacity:.5;transform:translate3d(0,-8px,0) scale(.985);transition-delay:0ms}

.m-draw{transform:scaleX(0);transform-origin:left;transition:transform .8s var(--ease) .2s}
.m-in .m-draw{transform:scaleX(1)}

/* ---------- touch / click ---------- */
.m-press{transition:transform .18s var(--ease),border-color .25s ease,background-color .25s ease}
.m-press:active{transform:scale(.97)}
.m-press .m-ico{transition:transform .25s var(--ease)}
.m-press:active .m-ico{transform:rotate(-8deg) scale(1.12)}
.m-press .m-arrow{transition:transform .25s var(--ease)}
.m-press:active .m-arrow{transform:translate3d(6px,0,0)}
@keyframes m-rp{to{transform:scale(1);opacity:0}}
.m-ripple{position:absolute;border-radius:9999px;background:currentColor;opacity:.2;
  transform:scale(0);animation:m-rp .6s ease-out forwards;pointer-events:none}
.m-tilt{transition:transform .35s var(--ease);will-change:transform}
.m-spot{position:absolute;inset:0;pointer-events:none;opacity:0;transition:opacity .4s ease;
  background:radial-gradient(220px circle at var(--sx,50%) var(--sy,30%),color-mix(in srgb,var(--accent) 16%,transparent),transparent 70%)}

/* ---------- ambient: only while on screen ---------- */
@keyframes m-mq{to{transform:translate3d(-50%,0,0)}}
.m-marquee{animation:m-mq 30s linear infinite;animation-play-state:paused}
.m-marquee-r{animation-direction:reverse;animation-duration:38s}
.m-live .m-marquee{animation-play-state:running}
@keyframes m-ring{0%{transform:scale(1);opacity:.55}100%{transform:scale(1.1,1.5);opacity:0}}
.m-ring{animation:m-ring 2.4s ease-out infinite;animation-play-state:paused}
.m-live .m-ring{animation-play-state:running}
@keyframes m-nudge{0%,100%{transform:translate3d(0,0,0)}50%{transform:translate3d(8px,0,0)}}
.m-nudge{animation:m-nudge 1.6s ease-in-out infinite}

/* ---------- chrome ---------- */
.m-nav{border-color:transparent;transition:border-color .3s ease}
.m-nav.m-nav-on{border-color:rgba(255,255,255,.1)}
.m-bar{transform:translateY(110%);transition:transform .35s var(--ease)}
.m-bar-on{transform:none}
.m-scroller{scrollbar-width:none}
.m-scroller::-webkit-scrollbar{display:none}

/* burger -> X */
.m-burger i{position:absolute;left:11px;right:11px;height:2px;border-radius:2px;background:#fff;
  transition:transform .35s var(--ease)}
.m-burger i:nth-child(1){top:17px;transform:translateY(-3.5px)}
.m-burger i:nth-child(2){top:17px;transform:translateY(3.5px)}
.m-burger.m-x i:nth-child(1){transform:rotate(45deg)}
.m-burger.m-x i:nth-child(2){transform:rotate(-45deg)}

/* menu sheet (exit animation = same transition reversed) */
.m-menu{opacity:0;visibility:hidden;transition:opacity .3s ease,visibility 0s linear .3s}
.m-menu.m-menu-on{opacity:1;visibility:visible;transition:opacity .3s ease}
.m-menu li{opacity:0;transform:translate3d(0,18px,0);transition:opacity .35s var(--ease),transform .35s var(--ease)}
.m-menu-on li{opacity:1;transform:none;transition-delay:calc(var(--i,0)*60ms + 90ms)}

/* ---------- page exit on navigation ---------- */
.m-page{transition:opacity .2s ease,transform .2s ease}
html.m-leaving .m-page{opacity:0;transform:scale(.985) translate3d(0,-6px,0)}
html.m-leaving .m-bar{transform:translateY(110%)}

/* ---------- reduced motion: keep soft fades, drop movement ---------- */
@media (prefers-reduced-motion: reduce){
  html{scroll-behavior:auto}
  .m-root:not(.m-force) :is(.m-rise,.m-word,.m-drop,.m-pop){animation-name:m-fade;animation-duration:.5s}
  .m-root:not(.m-force) :is(.m-marquee,.m-ring,.m-cyc-col,.m-ripple,.m-nudge){animation:none}
  .m-root.m-armed:not(.m-force) [data-rv]{transform:none!important}
  .m-root:not(.m-force) .m-draw{transform:none;transition:none}
  .m-root:not(.m-force) .m-page{transition:none}
  .m-root:not(.m-force) .m-menu li{transform:none}
  html.m-leaving .m-page{transform:none}
}
`}</style>
    );
}

/* -------------------------------------------------------------------------- */
/*  Building blocks                                                            */
/* -------------------------------------------------------------------------- */
function R({ children, d = 0, v = "", className = "" }: { children: ReactNode; d?: number; v?: "" | "left" | "zoom"; className?: string }) {
    return (
        <div data-rv={v} style={cv({ "--d": `${Math.min(d, 150)}ms` })} className={className}>
            {children}
        </div>
    );
}

function Head({ label, title }: { label: string; title?: ReactNode }) {
    return (
        <R className="mb-7">
            <p className="mb-3 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-white/50">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                {label}
            </p>
            {title && <h2 className="text-[1.75rem] font-extrabold leading-[1.1] tracking-tight">{title}</h2>}
            <span className="m-draw mt-4 block h-[2px] w-12 rounded-full bg-accent" />
        </R>
    );
}

function Collapse({ open, children }: { open: boolean; children: ReactNode }) {
    return (
        <div
            aria-hidden={!open}
            className="grid transition-[grid-template-rows,opacity] duration-300 ease-out"
            style={{ gridTemplateRows: open ? "1fr" : "0fr", opacity: open ? 1 : 0 }}
        >
            <div className="overflow-hidden">{children}</div>
        </div>
    );
}

/** Tilts toward the finger / pointer. Resets on release. */
function Tilt({ children, className = "", max = 7 }: { children: ReactNode; className?: string; max?: number }) {
    const ref = useRef<HTMLDivElement>(null);
    const move = (e: RPointerEvent<HTMLDivElement>) => {
        const el = ref.current;
        if (!el || reduced()) return;
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        el.style.transform = `perspective(700px) rotateX(${(-y * max).toFixed(2)}deg) rotateY(${(x * max).toFixed(2)}deg)`;
    };
    const reset = () => {
        if (ref.current) ref.current.style.transform = "";
    };
    return (
        <div ref={ref} onPointerMove={move} onPointerLeave={reset} onPointerUp={reset} onPointerCancel={reset} className={`m-tilt ${className}`}>
            {children}
        </div>
    );
}

type Variant = "primary" | "ghost" | "small" | "dark" | "darkGhost";

function Cta({ href, children, variant = "primary", id, tabIndex }: { href: string; children: ReactNode; variant?: Variant; id?: string; tabIndex?: number }) {
    const router = useRouter();
    const isHash = href.startsWith("#");

    const look: Record<Variant, string> = {
        primary: "min-h-[50px] w-full bg-accent px-6 text-sm font-bold text-black",
        ghost: "min-h-[50px] w-full border border-white/20 px-6 text-sm text-white/80",
        small: "min-h-[40px] border border-white/20 px-4 font-mono text-xs text-white/80",
        dark: "min-h-[52px] w-full bg-black px-6 text-sm font-bold text-white",
        darkGhost: "min-h-[50px] w-full border border-black/30 px-6 text-sm font-semibold text-black",
    };

    const ripple = (e: RPointerEvent<HTMLElement>) => {
        const el = e.currentTarget;
        const r = el.getBoundingClientRect();
        const size = Math.max(r.width, r.height) * 1.2;
        const s = document.createElement("span");
        s.className = "m-ripple";
        s.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`;
        s.addEventListener("animationend", () => s.remove(), { once: true });
        el.appendChild(s);
    };

    const click = (e: MouseEvent<HTMLAnchorElement>) => {
        vib(8);
        if (isHash || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        document.documentElement.classList.add("m-leaving");
        window.setTimeout(() => router.push(href), 200);
    };

    const props = {
        "data-cta": id,
        className: `m-press relative inline-flex select-none items-center justify-center overflow-hidden rounded-full text-center font-semibold ${look[variant]}`,
        onPointerDown: ripple,
        onClick: click,
        tabIndex,
    };

    return isHash ? (
        <a href={href} {...props}>{children}</a>
    ) : (
        <Link href={href} {...props}>{children}</Link>
    );
}

/** Counts up once when visible (writes to the DOM, no re-renders). */
function Stat({ value, label, i }: { value: string | number; label: string; i: number }) {
    const box = useRef<HTMLDivElement>(null);
    const num = useRef<HTMLSpanElement>(null);

    useEffect(() => {
        const el = num.current;
        const wrap = box.current;
        if (typeof value !== "number" || !el || !wrap || reduced()) return;
        el.textContent = "0";
        let raf = 0;
        const io = new IntersectionObserver(([e]) => {
            if (!e.isIntersecting) return;
            io.disconnect();
            const t0 = performance.now();
            const tick = (now: number) => {
                const p = Math.min((now - t0) / 1000, 1);
                el.textContent = String(Math.round(value * (1 - Math.pow(1 - p, 3))));
                if (p < 1) raf = requestAnimationFrame(tick);
            };
            raf = requestAnimationFrame(tick);
        });
        io.observe(wrap);
        return () => {
            io.disconnect();
            cancelAnimationFrame(raf);
        };
    }, [value]);

    return (
        <div ref={box} className="m-rise m-press rounded-2xl border border-white/10 bg-white/[.03] px-2 py-3.5 text-center" style={cv({ "--i": 5 + i })}>
            <div className="text-lg font-extrabold tracking-tight">
                <span ref={num}>{value}</span>
            </div>
            <div className="font-mono text-[9px] uppercase tracking-widest text-white/50">{label}</div>
        </div>
    );
}

function LazyDemo() {
    const ref = useRef<HTMLDivElement>(null);
    const [mount, setMount] = useState(false);
    const [saver, setSaver] = useState(false);

    useEffect(() => {
        const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
        if (conn?.saveData) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setSaver(true);
            return;
        }
        const el = ref.current;
        if (!el) return;
        const io = new IntersectionObserver(
            ([e]) => {
                if (e.isIntersecting) {
                    setMount(true);
                    io.disconnect();
                }
            },
            { rootMargin: "300px 0px" },
        );
        io.observe(el);
        return () => io.disconnect();
    }, []);

    if (mount) return <DemoVideo lite />;

    return (
        <div ref={ref} className="relative aspect-video overflow-hidden rounded-2xl border border-white/10 bg-white/[.03]">
            {saver && (
                <button
                    type="button"
                    onClick={() => {
                        setSaver(false);
                        setMount(true);
                    }}
                    className="absolute inset-0 grid place-items-center font-mono text-xs text-white/70 active:bg-white/5"
                >
                    Tap to load the tour
                </button>
            )}
        </div>
    );
}

/* -------------------------------------------------------------------------- */
/*  Content                                                                    */
/* -------------------------------------------------------------------------- */
const WORDS = ["array", "tree", "graph", "hash map", "stack"];
const STRUCTS = ["Array", "Stack", "Queue", "Linked list", "Binary tree", "Hash map", "Graph", "Step back", "0.25×–4× speed"];
const OPS = ["insert()", "push()", "enqueue()", "delete()", "rotate()", "hash()", "bfs()", "swap()"];

const NAV = [
    { label: "Product tour", href: "#tour" },
    { label: "Features", href: "#features" },
    { label: "How it works", href: "#how-it-works" },
    { label: "Who it's for", href: "#who" },
    { label: "FAQ", href: "#faq" },
];

const FEATURES: { tag: string; status: FeatureStatus; headline: string; points: string[] }[] = [
    { tag: "Algorithm Visualizer", status: "available", headline: "See operations run.", points: ["Step-by-step execution", "Arrays, stacks, queues, lists, trees, hash maps, graphs", "Play, pause, step back and replay", "Narration you write into the script"] },
    { tag: "AI Code Analysis", status: "preview", headline: "Complexity and bottlenecks.", points: ["Time and space complexity", "Bottlenecks and edge cases", "Needs an account. Today it shows a fixed sample, not based on your code"] },
    { tag: "AI Explainer", status: "planned", headline: "Ask what a step means.", points: ["Plain-language explanations", "Follow-up questions", "Needs an account"] },
    { tag: "Shareable Links", status: "planned", headline: "Send a visualization.", points: ["One link per saved visualization", "Needs an account and saved work, not built yet"] },
];

const STEPS = [
    { title: "Write a script", desc: "Or pick an example. It is plain JSON." },
    { title: "Press play", desc: "Every operation animates, one step at a time." },
    { title: "Step, scrub, replay", desc: "Go back, jump ahead, change the speed." },
    { title: "Edit and run again", desc: "Errors point at the line and suggest a fix." },
];

const PERKS = [
    { icon: ZapIcon, label: "Playback speed", desc: "From 0.25× to 4×, so you can slow a tricky step right down." },
    { icon: LineChart, label: "Narrated steps", desc: "Each step can explain itself." },
    { icon: Fire, label: "Step back", desc: "Rewind one step and rewatch." },
    { icon: Target, label: "Keyboard control", desc: "Space, arrows and R." },
];

const USE_CASES = [
    { who: "Students", line: "Learn data structures", desc: "Watch arrays, trees, graphs and hash tables change one operation at a time. Pause, step back and replay until it makes sense." },
    { who: "Developers", line: "Check a structure before you build on it", desc: "Insert, delete and swap, and see exactly which pointers and buckets change. Rejected operations are shown, not hidden." },
    { who: "Interview candidates", line: "Rehearse the walkthrough", desc: "Practise explaining how a hash map handles a collision or how a BST deletes a node, with the steps on screen as you talk." },
    { who: "Educators", line: "Narrate once, replay in class", desc: "Each step can carry a message. Write the walkthrough once and replay it at any speed, as often as you need." },
];

const FAQ = [
    { q: "Do I need an account?", a: "Not to visualize. The editor and the visualizer run in your browser without one. Signing in with Google is for the features that belong to you: analysis, the AI assistant, history and sharing." },
    { q: "Is the AI analysis real?", a: "Not yet. The report screen is built, but it shows a fixed sample that is not based on your code." },
    { q: "Which structures can I visualize?", a: "Arrays, stacks, queues, linked lists, trees, hash maps and graphs." },
    { q: "Can I go backwards?", a: "Yes. Step back one operation, scrub the timeline, or replay from the start." },
];

/* -------------------------------------------------------------------------- */
/*  Sections with state                                                        */
/* -------------------------------------------------------------------------- */
function FeatureCarousel() {
    const track = useRef<HTMLDivElement>(null);
    const [idx, setIdx] = useState(0);
    const analysisLive = useAnalysisAvailable();

    useEffect(() => {
        const el = track.current;
        if (!el) return;
        let raf = 0;
        const on = () => {
            cancelAnimationFrame(raf);
            raf = requestAnimationFrame(() => {
                const card = el.firstElementChild as HTMLElement | null;
                if (!card) return;
                const i = Math.round(el.scrollLeft / (card.offsetWidth + 12));
                const n = Math.max(0, Math.min(i, FEATURES.length - 1));
                setIdx((p) => (p === n ? p : n));
            });
        };
        el.addEventListener("scroll", on, { passive: true });
        return () => {
            el.removeEventListener("scroll", on);
            cancelAnimationFrame(raf);
        };
    }, []);

    const go = (i: number) => {
        const el = track.current;
        const card = el?.firstElementChild as HTMLElement | null;
        if (!el || !card) return;
        vib(6);
        el.scrollTo({ left: i * (card.offsetWidth + 12), behavior: "smooth" });
    };

    return (
        <R>
            <div ref={track} className="m-scroller -mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain px-[9%] pb-2">
                {FEATURES.map((f, i) => (
                    <div key={f.tag} className="w-[82%] shrink-0 snap-center">
                        <div
                            className={`h-full rounded-3xl border p-5 transition-[transform,opacity,border-color,background-color] duration-300 active:scale-[.98] ${
                                i === idx ? "scale-100 border-accent/30 bg-white/[.05] opacity-100" : "scale-[.95] border-white/10 bg-white/[.03] opacity-60"
                            }`}
                        >
                            <div className="mb-4 flex items-start justify-between gap-3">
                                <span className="text-5xl font-black leading-none text-transparent" style={{ WebkitTextStroke: "1px var(--accent)" }}>
                                    {String(i + 1).padStart(2, "0")}
                                </span>
                                <StatusChip status={f.tag === "AI Code Analysis" && analysisLive ? "available" : f.status} />
                            </div>
                            <p className="mb-1 font-mono text-[11px] uppercase tracking-widest text-white/50">{f.tag}</p>
                            <h3 className="mb-3 text-lg font-bold">{f.headline}</h3>
                            <ul className="space-y-2">
                                {(f.tag === "AI Code Analysis" && analysisLive ? ANALYSIS_LIVE_COPY.points : f.points).map((p) => (
                                    <li key={p} className="flex items-start gap-2.5 text-sm leading-snug text-white/65">
                                        <HugeiconsIcon icon={Tick02Icon} size={13} color="currentColor" strokeWidth={2} className="mt-0.5 shrink-0 text-accent" />
                                        {p}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-4 flex items-center justify-between">
                <div className="flex gap-1.5">
                    {FEATURES.map((f, i) => (
                        <button key={f.tag} type="button" aria-label={`Show ${f.tag}`} onClick={() => go(i)} className="flex h-6 items-center">
                            <span className={`block h-1.5 rounded-full transition-all duration-300 ${i === idx ? "w-6 bg-accent" : "w-1.5 bg-white/25"}`} />
                        </button>
                    ))}
                </div>
                <span className={`font-mono text-[11px] uppercase tracking-widest text-white/40 transition-opacity duration-300 ${idx === 0 ? "opacity-100" : "opacity-0"}`}>
                    Swipe <span className="m-nudge inline-block">→</span>
                </span>
            </div>
        </R>
    );
}

function UseCases() {
    const [open, setOpen] = useState<number | null>(0);
    return (
        <div>
            {USE_CASES.map((u, i) => {
                const on = open === i;
                return (
                    <R key={u.who} d={i * 40} v="left">
                        <div className="border-b border-white/10 first:border-t">
                            <button
                                type="button"
                                aria-expanded={on}
                                onClick={() => {
                                    vib(6);
                                    setOpen(on ? null : i);
                                }}
                                className="m-press flex min-h-[64px] w-full items-center gap-4 py-4 text-left"
                            >
                                <span className="w-7 font-mono text-xs text-accent">{String(i + 1).padStart(2, "0")}</span>
                                <span className="flex-1">
                                    <span className="block font-mono text-[10px] uppercase tracking-widest text-accent">For {u.who}</span>
                                    <span className="mt-1 block text-[15px] font-semibold leading-snug text-white/90">{u.line}</span>
                                </span>
                                <span className={`font-mono text-xl leading-none text-accent transition-transform duration-300 ${on ? "rotate-45" : ""}`}>+</span>
                            </button>
                            <Collapse open={on}>
                                <p className="pb-5 pl-11 pr-2 text-sm leading-relaxed text-white/60">{u.desc}</p>
                            </Collapse>
                        </div>
                    </R>
                );
            })}
        </div>
    );
}

function Faq() {
    const [open, setOpen] = useState<number | null>(null);
    const analysisLive = useAnalysisAvailable();
    return (
        <div className="space-y-2">
            {FAQ.map((f, i) => {
                const on = open === i;
                return (
                    <R key={f.q} d={i * 50}>
                        <div className={`rounded-2xl border transition-colors duration-300 ${on ? "border-accent/30 bg-white/[.05]" : "border-white/10 bg-white/[.03]"}`}>
                            <button
                                type="button"
                                aria-expanded={on}
                                onClick={() => {
                                    vib(6);
                                    setOpen(on ? null : i);
                                }}
                                className="m-press flex min-h-[54px] w-full items-center justify-between gap-4 rounded-2xl px-4 text-left text-sm font-semibold"
                            >
                                {f.q}
                                <span className={`font-mono text-xl leading-none text-accent transition-transform duration-300 ${on ? "rotate-45" : ""}`}>+</span>
                            </button>
                            <Collapse open={on}>
                                <p className="px-4 pb-4 text-sm leading-relaxed text-white/60">{f.q === "Is the AI analysis real?" && analysisLive ? ANALYSIS_LIVE_COPY.faq : f.a}</p>
                            </Collapse>
                        </div>
                    </R>
                );
            })}
        </div>
    );
}

function Marquee({ items, reverse = false }: { items: string[]; reverse?: boolean }) {
    return (
        <div data-live className="overflow-hidden py-1.5 [mask-image:linear-gradient(90deg,transparent,#000_12%,#000_88%,transparent)]">
            <div className={`m-marquee ${reverse ? "m-marquee-r" : ""} flex w-max gap-2.5`}>
                {[...items, ...items].map((c, i) => (
                    <span
                        key={i}
                        aria-hidden={i >= items.length}
                        className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[.03] px-4 py-1.5 font-mono text-xs text-white/65"
                    >
                        <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                        {c}
                    </span>
                ))}
            </div>
        </div>
    );
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                       */
/* -------------------------------------------------------------------------- */
export default function AlgoForgeLanding() {
    const root = useRef<HTMLDivElement>(null);
    const nav = useRef<HTMLElement>(null);
    const progress = useRef<HTMLDivElement>(null);
    const heroSec = useRef<HTMLElement>(null);
    const heroIn = useRef<HTMLDivElement>(null);
    const spot = useRef<HTMLDivElement>(null);
    const heroEnd = useRef<HTMLDivElement>(null);
    const tourWrap = useRef<HTMLDivElement>(null);
    const tourIn = useRef<HTMLDivElement>(null);
    const finalCta = useRef<HTMLElement>(null);
    const scroller = useRef<HTMLElement | null>(null); // null = window
    const [bar, setBar] = useState(false);
    const analysisLive = useAnalysisAvailable();
    const [menu, setMenu] = useState(false);

    /* Observers + one rAF-throttled scroll handler */
    useEffect(() => {
        const el = root.current;
        if (!el) return;
        const rm = reduced();

        const hasIO = "IntersectionObserver" in window;
        if (hasIO) el.classList.add("m-armed");

        const rv = new IntersectionObserver(
            (entries) => {
                for (const e of entries) {
                    const t = e.target;
                    if (e.isIntersecting) {
                        t.classList.add("m-in");
                        t.classList.remove("m-past");
                    } else if (t.classList.contains("m-in") && e.boundingClientRect.top < 0) {
                        t.classList.add("m-past");
                    }
                }
            },
            { rootMargin: "-4% 0px -8% 0px" },
        );
        const live = new IntersectionObserver((entries) => {
            for (const e of entries) e.target.classList.toggle("m-live", e.isIntersecting);
        });
        el.querySelectorAll("[data-rv]").forEach((n) => rv.observe(n));
        el.querySelectorAll("[data-live]").forEach((n) => live.observe(n));

        let ticking = false;
        const frame = () => {
            ticking = false;
            const s = scroller.current;
            const y = s ? s.scrollTop : window.scrollY;
            const vh = s ? s.clientHeight : window.innerHeight;
            const max = (s ? s.scrollHeight : document.documentElement.scrollHeight) - vh;

            if (progress.current) progress.current.style.transform = `scaleX(${max > 0 ? clamp(y / max) : 0})`;
            nav.current?.classList.toggle("m-nav-on", y > 8);

            if (heroSec.current && heroIn.current) {
                const r = heroSec.current.getBoundingClientRect();
                const k = clamp(-r.top / (r.height * 0.8));
                heroIn.current.style.opacity = String(1 - k * 0.7);
                if (!rm) heroIn.current.style.transform = `translate3d(0,${(k * 36).toFixed(1)}px,0)`;
            }
            if (tourWrap.current && tourIn.current && !rm) {
                const r = tourWrap.current.getBoundingClientRect();
                const p = clamp((vh - r.top) / (vh * 0.75));
                tourIn.current.style.transform = `translate3d(0,${((1 - p) * 28).toFixed(1)}px,0) scale(${(0.92 + 0.08 * p).toFixed(3)})`;
            }
        };
        const onScroll = (e: Event) => {
            const t = e.target;
            if (t === document) scroller.current = null;
            else if (t instanceof HTMLElement && t.contains(el)) scroller.current = t;
            else return; // ignore the horizontal carousel
            if (ticking) return;
            ticking = true;
            requestAnimationFrame(frame);
        };
        frame();
        window.addEventListener("scroll", onScroll, { passive: true, capture: true });

        const reset = () => document.documentElement.classList.remove("m-leaving");
        window.addEventListener("pageshow", reset);

        return () => {
            rv.disconnect();
            live.disconnect();
            window.removeEventListener("scroll", onScroll, true);
            window.removeEventListener("pageshow", reset);
        };
    }, []);

    /* Sticky CTA: after the hero, hidden at the final CTA */
    useEffect(() => {
        const a = heroEnd.current;
        const b = finalCta.current;
        if (!a || !b) return;
        let heroGone = false;
        let finalSeen = false;
        const io = new IntersectionObserver((entries) => {
            for (const e of entries) {
                if (e.target === a) heroGone = !e.isIntersecting;
                if (e.target === b) finalSeen = e.isIntersecting;
            }
            setBar(heroGone && !finalSeen);
        });
        io.observe(a);
        io.observe(b);
        return () => io.disconnect();
    }, []);

    /* Menu: lock body scroll, close on Escape */
    useEffect(() => {
        const html = document.documentElement;
        html.style.overflow = menu ? "hidden" : "";
        const key = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
        window.addEventListener("keydown", key);
        return () => {
            html.style.overflow = "";
            window.removeEventListener("keydown", key);
        };
    }, [menu]);

    /* Hero spotlight follows the finger */
    const spotRaf = useRef(0);
    const spotMove = (e: RPointerEvent<HTMLElement>) => {
        const sp = spot.current;
        const sec = heroSec.current;
        if (!sp || !sec || reduced()) return;
        const x = e.clientX;
        const y = e.clientY;
        cancelAnimationFrame(spotRaf.current);
        spotRaf.current = requestAnimationFrame(() => {
            const r = sec.getBoundingClientRect();
            sp.style.setProperty("--sx", `${x - r.left}px`);
            sp.style.setProperty("--sy", `${y - r.top}px`);
            sp.style.opacity = "1";
        });
    };
    const spotOff = () => {
        cancelAnimationFrame(spotRaf.current);
        if (spot.current) spot.current.style.opacity = "0";
    };

    const toTop = () => {
        vib(8);
        const s = scroller.current;
        if (s) s.scrollTo({ top: 0, behavior: "smooth" });
        else window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const closeMenuForLink = () => {
        vib(6);
        document.documentElement.style.overflow = "";
        setMenu(false);
    };

    const sc = Number(PRODUCT_FACTS.structures);

    return (
        <div ref={root} className={`m-root min-h-dvh w-full overflow-x-clip bg-black text-white ${FORCE_MOTION ? "m-force" : ""}`}>
            <LandingStyles />
            <MobileStyles />

            <div ref={progress} aria-hidden className="fixed inset-x-0 top-0 z-[70] h-[2px] origin-left bg-accent" style={{ transform: "scaleX(0)" }} />

            {/* Nav */}
            <nav
                ref={nav}
                className="m-nav m-drop sticky top-0 z-[60] flex items-center justify-between border-b bg-black/95 px-5 pb-3 sm:px-8"
                style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
            >
                <span className="text-sm font-bold tracking-tight">
                    Algo<span className="text-accent">Forge</span>
                </span>
                <div className="flex items-center gap-2">
                    <Cta href={DASHBOARD_HREF} variant="small" id="nav">Open app</Cta>
                    <button
                        type="button"
                        aria-label={menu ? "Close menu" : "Open menu"}
                        aria-expanded={menu}
                        onClick={() => {
                            vib(8);
                            setMenu((m) => !m);
                        }}
                        className={`m-burger relative h-10 w-10 rounded-full border border-white/20 active:bg-white/10 ${menu ? "m-x" : ""}`}
                    >
                        <i />
                        <i />
                    </button>
                </div>
            </nav>

            {/* Menu sheet */}
            <div
                aria-hidden={!menu}
                className={`m-menu fixed inset-0 z-[55] flex flex-col bg-black px-6 pb-8 ${menu ? "m-menu-on" : "pointer-events-none"}`}
                style={{ paddingTop: "calc(env(safe-area-inset-top) + 5.5rem)" }}
            >
                <ul className="mx-auto w-full max-w-2xl flex-1">
                    {NAV.map((n, i) => (
                        <li key={n.href} style={cv({ "--i": i })}>
                            <a
                                href={n.href}
                                tabIndex={menu ? 0 : -1}
                                onClick={closeMenuForLink}
                                className="flex items-baseline gap-4 border-b border-white/10 py-5 active:bg-white/[.04]"
                            >
                                <span className="font-mono text-xs text-accent">{String(i + 1).padStart(2, "0")}</span>
                                <span className="text-3xl font-extrabold tracking-tight">{n.label}</span>
                            </a>
                        </li>
                    ))}
                </ul>
                <div style={cv({ "--i": NAV.length })} className="m-menu-cta">
                    <Cta href={DASHBOARD_HREF} id="menu" tabIndex={menu ? 0 : -1}>Open the visualizer</Cta>
                </div>
            </div>

            <div className="m-page mx-auto w-full max-w-2xl">
                {/* Hero */}
                <section
                    ref={heroSec}
                    onPointerMove={spotMove}
                    onPointerDown={spotMove}
                    onPointerUp={spotOff}
                    onPointerLeave={spotOff}
                    onPointerCancel={spotOff}
                    className="relative overflow-hidden px-5 pb-10 pt-12"
                >
                    <div
                        aria-hidden
                        className="pointer-events-none absolute inset-0 opacity-[0.07]"
                        style={{
                            backgroundImage: "radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)",
                            backgroundSize: "24px 24px",
                            maskImage: "radial-gradient(ellipse at 50% 30%, #000 20%, transparent 70%)",
                            WebkitMaskImage: "radial-gradient(ellipse at 50% 30%, #000 20%, transparent 70%)",
                        }}
                    />
                    <div ref={spot} aria-hidden className="m-spot" />

                    <div ref={heroIn} className="relative will-change-transform">
                        <div className="mb-7 flex items-center gap-3">
                            <div className="m-pop">
                                <Buddy size={52} track={false} />
                            </div>
                            <span
                                className="m-rise inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest text-white/60"
                                style={cv({ "--i": 0 })}
                            >
                                <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                                Step-by-step
                            </span>
                        </div>

                        <h1 className="mb-5 text-[clamp(2.25rem,11.5vw,3.5rem)] font-extrabold leading-[1.02] tracking-tight">
                            <span className="block overflow-hidden pb-[.06em]">
                                <span className="m-word" style={cv({ "--i": 0 })}>See your</span>
                            </span>
                            <span className="m-rise block text-accent" style={cv({ "--i": 1 })}>
                                <span className="m-cyc">
                                    <span className="m-cyc-col">
                                        {[...WORDS, WORDS[0]].map((w, i) => (
                                            <span key={i} aria-hidden={i > 0}>{w}</span>
                                        ))}
                                    </span>
                                </span>
                            </span>
                            <span className="block overflow-hidden pb-[.06em]">
                                <span className="m-word" style={cv({ "--i": 2 })}>actually work.</span>
                            </span>
                        </h1>

                        <p className="m-rise mb-8 text-[15px] leading-relaxed text-white/60" style={cv({ "--i": 3 })}>
                            Write a short script, press play, and step through arrays, trees, graphs and hash maps. {analysisLive ? "Sign in to run AI code analysis on your own code." : "AI code analysis is still a preview."}
                        </p>

                        <div className="m-rise flex flex-col gap-3" style={cv({ "--i": 4 })}>
                            <Cta href={DASHBOARD_HREF} id="hero">Open the visualizer</Cta>
                            <Cta href="#tour" variant="ghost" id="hero-tour">Watch the tour</Cta>
                        </div>

                        <div className="mt-8 grid grid-cols-3 gap-2">
                            <Stat value={Number.isFinite(sc) ? sc : String(PRODUCT_FACTS.structures)} label="Structures" i={0} />
                            <Stat value={String(PRODUCT_FACTS.speedRange)} label="Speed" i={1} />
                            <Stat value="Browser" label="No install" i={2} />
                        </div>
                    </div>

                    <div ref={heroEnd} aria-hidden className="h-px" />
                </section>

                {/* Two opposite marquees */}
                <div className="border-y border-white/10 py-2">
                    <Marquee items={STRUCTS} />
                    <Marquee items={OPS} reverse />
                </div>

                {/* Tour */}
                <section id="tour" ref={tourWrap} className="scroll-mt-16 px-5 py-14">
                    <Head label="Product tour" title={<>See it in <span className="text-accent">action.</span></>} />
                    <div ref={tourIn} className="will-change-transform">
                        <LazyDemo />
                    </div>
                    <p className="mt-3 text-center font-mono text-[11px] uppercase tracking-widest text-white/40">Tap the video to pause</p>
                </section>

                {/* Features */}
                <section id="features" className="scroll-mt-16 border-t border-white/10 px-5 py-14">
                    <Head label="Core features" title={<>Swipe through <span className="text-accent">what&apos;s inside.</span></>} />
                    <FeatureCarousel />
                </section>

                {/* How it works: sticky stacked cards (ancestors must not use overflow hidden/auto) */}
                <section id="how-it-works" className="scroll-mt-16 border-t border-white/10 px-5 py-14">
                    <Head label="How it works" title={<>Four steps. <span className="text-accent">That&apos;s it.</span></>} />
                    <div className="pb-6">
                        {STEPS.map((s, i) => (
                            <div key={s.title} className="sticky mb-5" style={{ top: `calc(4.75rem + ${i * 14}px)` }}>
                                <div data-rv="zoom" className="rounded-3xl border border-white/10 bg-[#0d0d0d] p-6">
                                    <div className="mb-8 flex items-start justify-between">
                                        <span className="text-6xl font-black leading-none text-transparent" style={{ WebkitTextStroke: "1px var(--accent)" }}>
                                            {String(i + 1).padStart(2, "0")}
                                        </span>
                                        <span className="font-mono text-[11px] uppercase tracking-widest text-white/40">
                                            Step {i + 1} / {STEPS.length}
                                        </span>
                                    </div>
                                    <h3 className="mb-1.5 text-xl font-bold">{s.title}</h3>
                                    <p className="text-sm leading-relaxed text-white/60">{s.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Perks: bento with tilt */}
                <section className="border-t border-white/10 px-5 py-14">
                    <Head label="Little details" title={<>Built for <span className="text-accent">poking at.</span></>} />
                    <div className="grid grid-cols-2 gap-3">
                        {PERKS.map((p, i) => (
                            <R key={p.label} d={i * 40} v="zoom" className={i === 0 ? "col-span-2" : ""}>
                                <Tilt className="h-full">
                                    <div
                                        className={`m-press h-full rounded-3xl border border-white/10 bg-white/[.03] p-4 active:border-accent/40 ${
                                            i === 0 ? "flex items-center gap-4" : ""
                                        }`}
                                    >
                                        <span
                                            className={`m-ico flex shrink-0 items-center justify-center rounded-2xl bg-accent/10 text-accent ${
                                                i === 0 ? "h-14 w-14" : "mb-3 h-9 w-9"
                                            }`}
                                        >
                                            <HugeiconsIcon icon={p.icon} size={i === 0 ? 26 : 18} color="currentColor" strokeWidth={1.6} />
                                        </span>
                                        <div>
                                            <p className={`mb-1 font-bold ${i === 0 ? "text-sm" : "text-xs"}`}>{p.label}</p>
                                            <p className="text-[11px] leading-relaxed text-white/55">{p.desc}</p>
                                        </div>
                                    </div>
                                </Tilt>
                            </R>
                        ))}
                    </div>
                </section>

                {/* Use cases: accordion */}
                <section id="who" className="scroll-mt-16 border-t border-white/10 px-5 py-14">
                    <Head label="Who it's for" title={<>Made for <span className="text-accent">learners.</span></>} />
                    <UseCases />
                </section>

                {/* FAQ */}
                <section id="faq" className="scroll-mt-16 border-t border-white/10 px-5 py-14">
                    <Head label="Quick answers" />
                    <Faq />
                </section>

                {/* Final CTA */}
                <section ref={finalCta} data-live className="px-5 pb-12 pt-6">
                    <R>
                        <div className="mb-3 flex justify-end pr-4">
                            <Buddy size={56} track={false} />
                        </div>
                        <div className="rounded-[2rem] bg-accent p-7 text-black">
                            <p className="mb-3 font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-black/60">Try it now</p>
                            <h2 className="mb-3 text-[2.1rem] font-black leading-[1.05] tracking-tight">Stop guessing. Start visualizing.</h2>
                            <p className="mb-7 text-sm font-medium text-black/65">No account to visualize. Nothing to install.</p>
                            <div className="flex flex-col gap-3">
                                <div className="relative">
                                    <span aria-hidden className="m-ring pointer-events-none absolute inset-0 rounded-full border-2 border-black" />
                                    <Cta href={DASHBOARD_HREF} variant="dark" id="final">Open the visualizer</Cta>
                                </div>
                                <Cta href="#how-it-works" variant="darkGhost" id="final-how">How it works</Cta>
                            </div>
                        </div>
                    </R>
                </section>

                {/* Footer */}
                <footer className="border-t border-white/10 pt-6" style={{ paddingBottom: "calc(5.5rem + env(safe-area-inset-bottom))" }}>
                    <div className="flex items-center justify-between px-5">
                        <span className="font-mono text-xs text-white/50">AlgoForge © {SITE.year}</span>
                        <button
                            type="button"
                            onClick={toTop}
                            className="m-press rounded-full border border-white/15 px-4 py-1.5 font-mono text-[11px] uppercase tracking-widest text-white/70"
                        >
                            Back to top ↑
                        </button>
                    </div>
                    <R>
                        <div
                            aria-hidden
                            className="mt-6 select-none overflow-hidden text-center font-black leading-[.8] tracking-tighter text-transparent"
                            style={{ fontSize: "min(16vw, 6.5rem)", WebkitTextStroke: "1px rgba(255,255,255,.16)" }}
                        >
                            AlgoForge
                        </div>
                    </R>
                </footer>
            </div>

            {/* Sticky CTA (solid background, no backdrop blur: blur is costly on mobile GPUs) */}
            <div
                aria-hidden={!bar}
                className={`m-bar fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-black/95 px-5 pt-3 ${bar && !menu ? "m-bar-on" : "pointer-events-none"}`}
                style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
            >
                <div className="mx-auto max-w-2xl"><Cta href={DASHBOARD_HREF} id="sticky" tabIndex={bar ? 0 : -1}>Open the visualizer</Cta></div>
            </div>
        </div>
    );
}