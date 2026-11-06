import type { Config } from "tailwindcss";
import tailwindAnimate from "tailwindcss-animate";

const config: Config = {
    // Fix: changed from ["class"] to "class"
    darkMode: "class",
    content: [
        "./pages/**/*.{ts,tsx}",
        "./components/**/*.{ts,tsx}",
        "./app/**/*.{ts,tsx}",
        "./src/**/*.{ts,tsx}", // Added src/ to ensure your components are scanned
    ],
    theme: {
        extend: {
            colors: {
                background: "hsl(var(--background))",
                foreground: "hsl(var(--foreground))",
                accent: "#FF5800",
                border: "hsl(var(--border))",
                input: "hsl(var(--input))",
                ring: "hsl(var(--ring))",
                primary: {
                    DEFAULT: "hsl(var(--primary))",
                    foreground: "hsl(var(--primary-foreground))",
                },
                muted: {
                    DEFAULT: "hsl(var(--muted))",
                    foreground: "hsl(var(--muted-foreground))",
                },
                glass: {
                    border: "rgba(255,255,255,0.08)",
                    surface: "rgba(255,255,255,0.04)",
                    highlight: "rgba(255,255,255,0.12)",
                },
                vercel: {
                    bg: "#0a0a0a",
                    card: "#111111",
                    border: "#1a1a1a",
                    muted: "#888888",
                    accent: "#ffffff",
                },
            },
            fontFamily: {
                sans: ["var(--font-alan)"],
                mono: ["var(--font-mono)"],
                playfair: ["var(--font-playfair)"],
                chango: ["var(--font-chango)"],
            },
            animation: {
                shimmer: "shimmer 2.5s linear infinite",
                "cursor-blink": "cursor-blink 1s step-end infinite",
                "glow-pulse": "glow-pulse 2s ease-in-out infinite",
                "border-glow": "border-glow 2s ease-in-out infinite",
                typewriter: "typewriter 3s steps(40) forwards",
                "fade-in-up": "fade-in-up 0.6s ease-out forwards",
            },
            keyframes: {
                shimmer: {
                    "0%": { backgroundPosition: "-200% center" },
                    "100%": { backgroundPosition: "200% center" },
                },
                "cursor-blink": {
                    "0%, 100%": { opacity: "1" },
                    "50%": { opacity: "0" },
                },
                "pulse-ring": {
                    "0%": {
                        transform: "scale(1)",
                        opacity: "0.35",
                        borderColor: "rgba(255,77,0,0.4)",
                    },
                    "100%": {
                        transform: "scale(1.7)",
                        opacity: "0",
                        borderColor: "rgba(255,77,0,0)",
                    },
                },
                "glow-pulse": {
                    "0%, 100%": {
                        boxShadow: "0 0 20px rgba(6, 182, 212, 0.3)",
                    },
                    "50%": { boxShadow: "0 0 40px rgba(6, 182, 212, 0.6)" },
                },
                "border-glow": {
                    "0%, 100%": { borderColor: "rgba(6, 182, 212, 0.3)" },
                    "50%": { borderColor: "rgba(6, 182, 212, 0.8)" },
                },
                "fade-in-up": {
                    "0%": { opacity: "0", transform: "translateY(20px)" },
                    "100%": { opacity: "1", transform: "translateY(0)" },
                },
            },
            backdropBlur: {
                xs: "2px",
            },
        },
    },
    // Fix: Use imported variable instead of require()
    plugins: [tailwindAnimate],
};

export default config;
