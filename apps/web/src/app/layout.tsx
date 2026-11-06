import type { Metadata } from "next";
import "./globals.css";
import {
    Alan_Sans,
    JetBrains_Mono,
    Playfair_Display,
    Chango,
    Inter,
} from "next/font/google";
import { cn } from "@/lib/utils";
import MotionProvider from "@/components/MotionProvider";
import { QueryProvider } from "@/lib/query/QueryProvider";
import { AuthProvider } from "@/lib/auth/AuthProvider";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

const alan = Alan_Sans({
    subsets: ["latin"],
    variable: "--font-alan",
    weight: ["300", "400", "500", "600", "700", "800", "900"],
});

const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" });

const playfair = Playfair_Display({
    subsets: ["latin"],
    variable: "--font-playfair",
});

const chango = Chango({
    subsets: ["latin"],
    weight: "400", // Chango only has one weight
    variable: "--font-chango",
});

export const metadata: Metadata = {
    title: "AlgoForge — Visualize Data Structures Step by Step",
    description:
        "Write a short script and watch arrays, stacks, queues, linked lists, trees, hash maps and graphs change one operation at a time.",
    keywords: ["algorithms", "DSA", "data structures", "visualization"],
    openGraph: {
        title: "AlgoForge",
        description: "See your data structures run, one step at a time.",
        type: "website",
    },
    icons: {
        icon: "/Algoforgelogo.png",
    },
};

// All font variables live on <html>, so :root can reference them.
const fontVars = [inter, alan, mono, playfair, chango].map((f) => f.variable).join(" ");

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en" className={cn("dark", "font-sans", fontVars)}>
            <head>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link
                    rel="preconnect"
                    href="https://fonts.gstatic.com"
                    crossOrigin="anonymous"
                />
            </head>
            <body className="bg-background text-white antialiased">
                <MotionProvider>
                    <QueryProvider>
                        <AuthProvider>{children}</AuthProvider>
                    </QueryProvider>
                </MotionProvider>
            </body>
        </html>
    );
}
