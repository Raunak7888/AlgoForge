"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

export function DesktopOnlyScreen() {
    const [url, setUrl] = useState("");
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        setUrl(window.location.href);
    }, []);

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(url);
        } catch {
            // fallback for browsers/contexts without the Clipboard API
            const ta = document.createElement("textarea");
            ta.value = url;
            ta.style.position = "fixed";
            ta.style.opacity = "0";
            document.body.appendChild(ta);
            ta.select();
            document.execCommand("copy");
            ta.remove();
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <main className="flex min-h-dvh items-center justify-center bg-black p-6">
            <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-8 text-center backdrop-blur-xl">
                <h1 className="font-display text-xl font-semibold text-white">
                    Open this on a desktop
                </h1>
                <p className="mt-2 text-sm text-white/50">
                    The dashboard needs a larger screen. Scan the code or copy
                    the link and open it on your laptop.
                </p>

                {url && (
                    <div className="mx-auto mt-6 w-fit rounded-xl bg-white p-3">
                        <QRCodeSVG
                            value={url}
                            size={176}
                            level="M"
                            bgColor="#ffffff"
                            fgColor="#000000"
                        />
                    </div>
                )}

                <p className="mt-4 break-all text-xs text-white/40">{url}</p>

                <button
                    type="button"
                    onClick={copy}
                    disabled={!url}
                    className="mt-5 w-full rounded-lg bg-[#ff4d00] px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                    {copied ? "Copied!" : "Copy link"}
                </button>
            </div>
        </main>
    );
}