"use client";

import { useEffect, useRef } from "react";
import { prefersReducedMotion } from "@/lib/reducedMotion";

type RGB = [number, number, number];
type P = { x: number; y: number; vx: number; vy: number; r: number; z: number; hot: boolean; ph: number; pulse: number; rx: number; ry: number };
type Star = { x: number; y: number; vx: number; vy: number; len: number; t: number; max: number; accent: boolean };
type Packet = { a: number; b: number; t: number; spd: number };

const rand = (a: number, b: number) => a + Math.random() * (b - a);

/** Normalises any CSS colour (hex, rgb, oklch, color-mix) to rgb via a 1px canvas. */
function parseColor(css: string, fallback: RGB): RGB {
    try {
        const cv = document.createElement("canvas");
        cv.width = cv.height = 1;
        const x = cv.getContext("2d", { willReadFrequently: true });
        if (!x) return fallback;
        x.fillStyle = "#010203";
        x.fillStyle = css;
        if (x.fillStyle === "#010203") return fallback;
        x.fillRect(0, 0, 1, 1);
        const d = x.getImageData(0, 0, 1, 1).data;
        return [d[0], d[1], d[2]];
    } catch {
        return fallback;
    }
}

/**
 * A quiet living graph, on theme for a DSA product:
 *  - depth-layered nodes with parallax, twinkle and slow drift
 *  - edges between near nodes; nodes near the cursor link to it and get nudged away
 *  - data "packets" travel along edges and make the destination node pulse
 *  - occasional shooting stars streak across at random
 * No glow or blur. Pauses off-screen, static when reduced motion is on.
 * Colour comes from CSS `color` (use text-foreground) and the --accent variable.
 */
export default function ParticleField({
    className = "",
    density = 1,
    link = 120,
    stars = true,
    packets = true,
    starEvery = [3, 8],
}: {
    className?: string;
    density?: number;
    link?: number;
    stars?: boolean;
    packets?: boolean;
    /** min / max seconds between shooting stars */
    starEvery?: [number, number];
}) {
    const ref = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const c = ref.current;
        const ctx = c?.getContext("2d");
        if (!c || !ctx) return;

        const reduce = prefersReducedMotion();
        let w = 0, h = 0, raf = 0, visible = true;
        let last = performance.now();
        let pts: P[] = [];
        let shooting: Star[] = [];
        let packs: Packet[] = [];
        let fg: RGB = [255, 255, 255];
        let ac: RGB = [255, 77, 26];
        let nextStar = last + rand(starEvery[0], starEvery[1]) * 1000;
        let nextPacket = last + 700;
        const mouse = { x: 0, y: 0, on: false };
        const rgba = (col: RGB, a: number) => `rgba(${col[0]},${col[1]},${col[2]},${a})`;

        const colors = () => {
            fg = parseColor(getComputedStyle(c).color, fg);
            ac = parseColor(getComputedStyle(document.documentElement).getPropertyValue("--accent").trim(), ac);
        };

        const spawnStar = () => {
            const dir = Math.random() < 0.5 ? 1 : -1;
            const ang = rand(0.3, 0.6);
            const sp = rand(9, 14);
            shooting.push({
                x: dir > 0 ? rand(-0.05 * w, 0.55 * w) : rand(0.45 * w, 1.05 * w),
                y: rand(-0.05 * h, 0.5 * h),
                vx: dir * Math.cos(ang) * sp,
                vy: Math.sin(ang) * sp,
                len: rand(90, 160),
                t: 0,
                max: rand(45, 80),
                accent: Math.random() < 0.3,
            });
        };

        const spawnPacket = () => {
            for (let tries = 0; tries < 8; tries++) {
                const a = Math.floor(Math.random() * pts.length);
                const near: number[] = [];
                for (let j = 0; j < pts.length; j++) {
                    if (j !== a && Math.hypot(pts[a].rx - pts[j].rx, pts[a].ry - pts[j].ry) < link * 0.9) near.push(j);
                }
                if (near.length) {
                    packs.push({ a, b: near[Math.floor(Math.random() * near.length)], t: 0, spd: rand(0.012, 0.025) });
                    return;
                }
            }
        };

        const step = (now: number, still = false) => {
            const dt = still ? 0 : Math.min(3, (now - last) / 16.667);
            last = now;
            const mx = mouse.on ? mouse.x - w / 2 : 0;
            const my = mouse.on ? mouse.y - h / 2 : 0;

            // update nodes
            for (const p of pts) {
                if (!still) {
                    if (mouse.on) {
                        const dx = p.x - mouse.x;
                        const dy = p.y - mouse.y;
                        const d = Math.hypot(dx, dy);
                        if (d < 110 && d > 0) {
                            p.vx += (dx / d) * 0.02 * dt;
                            p.vy += (dy / d) * 0.02 * dt;
                        }
                    }
                    const damp = Math.pow(0.99, dt);
                    p.vx *= damp;
                    p.vy *= damp;
                    if (Math.abs(p.vx) < 0.05) p.vx += (Math.random() - 0.5) * 0.01;
                    if (Math.abs(p.vy) < 0.05) p.vy += (Math.random() - 0.5) * 0.01;
                    p.x += p.vx * dt * p.z;
                    p.y += p.vy * dt * p.z;
                    if (p.x < -10) p.x = w + 10;
                    if (p.x > w + 10) p.x = -10;
                    if (p.y < -10) p.y = h + 10;
                    if (p.y > h + 10) p.y = -10;
                    p.pulse *= Math.pow(0.94, dt);
                }
                p.rx = p.x + mx * (p.z - 0.7) * 0.05;
                p.ry = p.y + my * (p.z - 0.7) * 0.05;
            }

            // spawn
            if (!still && visible) {
                if (stars && now >= nextStar) {
                    spawnStar();
                    if (Math.random() < 0.2) spawnStar();
                    nextStar = now + rand(starEvery[0], starEvery[1]) * 1000;
                }
                if (packets && now >= nextPacket && packs.length < 4 && pts.length > 4) {
                    spawnPacket();
                    nextPacket = now + rand(500, 1300);
                }
            }

            ctx.clearRect(0, 0, w, h);
            ctx.lineWidth = 1;

            // edges
            ctx.strokeStyle = rgba(fg, 1);
            for (let i = 0; i < pts.length; i++) {
                for (let j = i + 1; j < pts.length; j++) {
                    const d = Math.hypot(pts[i].rx - pts[j].rx, pts[i].ry - pts[j].ry);
                    if (d < link) {
                        ctx.globalAlpha = (1 - d / link) * 0.16 * (0.6 + 0.2 * (pts[i].z + pts[j].z));
                        ctx.beginPath();
                        ctx.moveTo(pts[i].rx, pts[i].ry);
                        ctx.lineTo(pts[j].rx, pts[j].ry);
                        ctx.stroke();
                    }
                }
            }

            // cursor links
            if (mouse.on) {
                ctx.strokeStyle = rgba(ac, 1);
                for (const p of pts) {
                    const d = Math.hypot(p.rx - mouse.x, p.ry - mouse.y);
                    if (d < 150) {
                        ctx.globalAlpha = (1 - d / 150) * 0.45;
                        ctx.beginPath();
                        ctx.moveTo(p.rx, p.ry);
                        ctx.lineTo(mouse.x, mouse.y);
                        ctx.stroke();
                    }
                }
            }

            // packets travelling along edges
            ctx.strokeStyle = rgba(ac, 1);
            ctx.fillStyle = rgba(ac, 1);
            packs = packs.filter((k) => {
                const A = pts[k.a];
                const B = pts[k.b];
                if (!A || !B) return false;
                if (Math.hypot(A.rx - B.rx, A.ry - B.ry) > link * 1.2) return false;
                k.t += k.spd * dt;
                if (k.t >= 1) {
                    B.pulse = 1;
                    return false;
                }
                const hx = A.rx + (B.rx - A.rx) * k.t;
                const hy = A.ry + (B.ry - A.ry) * k.t;
                const t0 = Math.max(0, k.t - 0.2);
                ctx.globalAlpha = 0.7;
                ctx.beginPath();
                ctx.moveTo(A.rx + (B.rx - A.rx) * t0, A.ry + (B.ry - A.ry) * t0);
                ctx.lineTo(hx, hy);
                ctx.stroke();
                ctx.globalAlpha = 1;
                ctx.beginPath();
                ctx.arc(hx, hy, 2, 0, Math.PI * 2);
                ctx.fill();
                return true;
            });

            // nodes
            for (const p of pts) {
                const tw = 0.75 + 0.25 * Math.sin(now / 1000 * 1.3 + p.ph);
                ctx.globalAlpha = (p.hot ? 0.9 : 0.25 + 0.3 * p.z) * tw;
                ctx.fillStyle = rgba(p.hot ? ac : fg, 1);
                ctx.beginPath();
                ctx.arc(p.rx, p.ry, (p.hot ? p.r + 0.6 : p.r) * (0.7 + 0.3 * p.z), 0, Math.PI * 2);
                ctx.fill();
                if (p.pulse > 0.02) {
                    ctx.globalAlpha = p.pulse * 0.6;
                    ctx.strokeStyle = rgba(ac, 1);
                    ctx.beginPath();
                    ctx.arc(p.rx, p.ry, p.r + (1 - p.pulse) * 10, 0, Math.PI * 2);
                    ctx.stroke();
                }
            }

            // shooting stars
            shooting = shooting.filter((s) => {
                s.x += s.vx * dt;
                s.y += s.vy * dt;
                s.t += dt;
                if (s.t > s.max) return false;
                const sp = Math.hypot(s.vx, s.vy) || 1;
                const tx = s.x - (s.vx / sp) * s.len;
                const ty = s.y - (s.vy / sp) * s.len;
                const col = s.accent ? ac : fg;
                const g = ctx.createLinearGradient(tx, ty, s.x, s.y);
                g.addColorStop(0, rgba(col, 0));
                g.addColorStop(1, rgba(col, 1));
                ctx.globalAlpha = Math.max(0, Math.min(1, s.t / 8, (s.max - s.t) / 25)) * 0.85;
                ctx.strokeStyle = g;
                ctx.lineWidth = 1.4;
                ctx.beginPath();
                ctx.moveTo(tx, ty);
                ctx.lineTo(s.x, s.y);
                ctx.stroke();
                ctx.fillStyle = rgba(col, 1);
                ctx.beginPath();
                ctx.arc(s.x, s.y, 1.5, 0, Math.PI * 2);
                ctx.fill();
                ctx.lineWidth = 1;
                return true;
            });
            ctx.globalAlpha = 1;
        };

        const resize = () => {
            const r = c.getBoundingClientRect();
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            w = r.width;
            h = r.height;
            c.width = Math.round(w * dpr);
            c.height = Math.round(h * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            const n = Math.min(100, Math.round(((w * h) / 16000) * density));
            pts = Array.from({ length: n }, (_, i) => {
                const x = Math.random() * w;
                const y = Math.random() * h;
                return {
                    x, y, rx: x, ry: y,
                    vx: (Math.random() - 0.5) * 0.25,
                    vy: (Math.random() - 0.5) * 0.25,
                    r: Math.random() * 1.2 + 0.8,
                    z: rand(0.4, 1),
                    hot: i % 9 === 0,
                    ph: Math.random() * Math.PI * 2,
                    pulse: 0,
                };
            });
            packs = [];
            colors();
            step(performance.now(), true);
        };

        const loop = (now: number) => {
            if (visible) step(now);
            else last = now;
            raf = requestAnimationFrame(loop);
        };

        const onMove = (e: MouseEvent) => {
            const r = c.getBoundingClientRect();
            mouse.x = e.clientX - r.left;
            mouse.y = e.clientY - r.top;
            mouse.on = mouse.x > -60 && mouse.y > -60 && mouse.x < r.width + 60 && mouse.y < r.height + 60;
        };
        const onLeave = () => { mouse.on = false; };

        resize();
        const ro = new ResizeObserver(resize);
        ro.observe(c);
        const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; });
        io.observe(c);
        if (!reduce) {
            window.addEventListener("mousemove", onMove, { passive: true });
            document.addEventListener("mouseleave", onLeave);
            raf = requestAnimationFrame(loop);
        }
        return () => {
            cancelAnimationFrame(raf);
            ro.disconnect();
            io.disconnect();
            window.removeEventListener("mousemove", onMove);
            document.removeEventListener("mouseleave", onLeave);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [density, link, stars, packets, starEvery[0], starEvery[1]]);

    return <canvas ref={ref} aria-hidden className={`pointer-events-none h-full w-full ${className}`} />;
}
