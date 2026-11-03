"use client";

import { Dialog } from "@base-ui/react/dialog";
import { motion, type Variants } from "framer-motion";
import { Check, Copy, ExternalLink, Globe, Link2, Lock, Share2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

interface ShareModalProps {
    isOpen: boolean;
    onClose: VoidFunction;
    /** Public URL of the shared item. Without one, sharing is shown as unavailable (no backend yet). */
    link?: string | null;
    title?: string;
}

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];
const list: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.05, delayChildren: 0.1 } } };
const rise: Variants = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: EASE } } };

async function copyText(text: string): Promise<boolean> {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        try {
            const ta = document.createElement("textarea");
            ta.value = text;
            ta.setAttribute("readonly", "");
            ta.style.position = "fixed";
            ta.style.opacity = "0";
            document.body.appendChild(ta);
            ta.select();
            const ok = document.execCommand("copy");
            document.body.removeChild(ta);
            return ok;
        } catch {
            return false;
        }
    }
}

const SECONDARY =
    "flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-primary-foreground/10! bg-primary-foreground/3 py-2.5 text-[12px] font-medium text-primary-foreground/70 transition hover:bg-primary-foreground/8 hover:text-primary-foreground";

const ShareModal = ({ isOpen, onClose, link = null, title = "Share analysis" }: ShareModalProps) => {
    const canShare = !!link;
    const [copied, setCopied] = useState(false);
    const [failed, setFailed] = useState(false);
    const [isPublic, setIsPublic] = useState(true);
    const [canNativeShare, setCanNativeShare] = useState(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        setCanNativeShare(typeof navigator !== "undefined" && !!navigator.share);
    }, []);
    useEffect(
        () => () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        },
        [],
    );

    const handleCopy = useCallback(async () => {
        if (!link || !isPublic) return;
        const ok = await copyText(link);
        setCopied(ok);
        setFailed(!ok);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
            setCopied(false);
            setFailed(false);
        }, 2000);
    }, [isPublic, link]);

    const handleNativeShare = async () => {
        if (!link || !isPublic) return;
        try {
            await navigator.share({ title, url: link });
        } catch {
            /* user cancelled */
        }
    };

    return (
        <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <Dialog.Portal>
                <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0" />
                <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4">
                    <Dialog.Popup className="pointer-events-auto relative w-full max-w-120 overflow-hidden rounded-2xl border border-primary-foreground/10! bg-primary-background shadow-2xl outline-none transition-[opacity,transform] duration-200 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
                        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-linear-to-b from-accent/10 to-transparent" />

                        <motion.div variants={list} initial="hidden" animate="show" className="relative">
                            <motion.div variants={rise} className="flex items-center justify-between px-5 pb-4 pt-5">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary-foreground/10! bg-primary-foreground/5">
                                        <Share2 size={16} className="text-primary-foreground/80" strokeWidth={1.75} aria-hidden />
                                    </div>
                                    <div className="flex flex-col leading-tight">
                                        <Dialog.Title className="text-[15px] font-semibold tracking-tight text-primary-foreground">{title}</Dialog.Title>
                                        <Dialog.Description className="text-[12px] text-primary-foreground/60">
                                            {canShare ? "Send this report to anyone" : "Not available yet"}
                                        </Dialog.Description>
                                    </div>
                                </div>
                                <Dialog.Close aria-label="Close" className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-primary-foreground/60 transition hover:bg-primary-foreground/8 hover:text-primary-foreground">
                                    <X size={15} aria-hidden />
                                </Dialog.Close>
                            </motion.div>

                            {!canShare ? (
                                <motion.div variants={rise} className="px-5 pb-5">
                                    <div role="status" className="rounded-xl border border-primary-foreground/8! bg-primary-foreground/3 p-4 text-[13px] leading-relaxed">
                                        <p className="font-medium text-primary-foreground">Sharing isn&apos;t available yet</p>
                                        <p className="mt-1 text-primary-foreground/60">
                                            Links need saved visualizations, which need a backend. Until then there is nothing to share, so no link is shown.
                                        </p>
                                    </div>
                                    <div className="mt-4 flex justify-end">
                                        <Dialog.Close className="cursor-pointer rounded-lg border border-primary-foreground/10! px-3 py-1.5 text-[12px] text-primary-foreground/70 transition hover:bg-primary-foreground/8 hover:text-primary-foreground">
                                            Got it
                                        </Dialog.Close>
                                    </div>
                                </motion.div>
                            ) : (
                                <div className="space-y-4 px-5 pb-5">
                                    <motion.div variants={rise} className="flex items-center justify-between gap-4 rounded-xl border border-primary-foreground/8! bg-primary-foreground/3 p-3.5">
                                        <div className="flex items-center gap-3">
                                            <div className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${isPublic ? "bg-emerald-400/10 text-emerald-400" : "bg-primary-foreground/6 text-primary-foreground/60"}`}>
                                                {isPublic ? <Globe size={16} strokeWidth={1.75} aria-hidden /> : <Lock size={16} strokeWidth={1.75} aria-hidden />}
                                            </div>
                                            <div>
                                                <p className="text-[13px] font-medium text-primary-foreground">Public link</p>
                                                <p className="mt-0.5 text-[12px] text-primary-foreground/60">{isPublic ? "Anyone with the link can view" : "Link sharing is turned off"}</p>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            role="switch"
                                            aria-checked={isPublic}
                                            aria-label="Public link"
                                            onClick={() => setIsPublic((p) => !p)}
                                            className={`relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ${isPublic ? "bg-emerald-400" : "bg-primary-foreground/25"}`}
                                        >
                                            <motion.span layout transition={{ type: "spring", stiffness: 500, damping: 32 }} className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow" style={{ left: isPublic ? "22px" : "2px" }} />
                                        </button>
                                    </motion.div>

                                    <motion.div variants={rise} className="space-y-2">
                                        <div className={`flex items-center gap-2 rounded-xl border border-primary-foreground/10! bg-primary-foreground/3 p-1.5 pl-3 transition focus-within:border-accent/50! ${!isPublic ? "pointer-events-none opacity-60" : ""}`}>
                                            <Link2 size={14} className="shrink-0 text-primary-foreground/60" aria-hidden />
                                            <input
                                                readOnly
                                                disabled={!isPublic}
                                                value={link ?? ""}
                                                onFocus={(e) => e.currentTarget.select()}
                                                aria-label="Share link"
                                                className="min-w-0 flex-1 truncate bg-transparent font-mono text-[12px] text-primary-foreground/80 outline-none"
                                            />
                                            <button
                                                type="button"
                                                onClick={handleCopy}
                                                disabled={!isPublic}
                                                className={`flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-[12px] font-medium transition ${copied ? "bg-emerald-400/15 text-emerald-300" : failed ? "bg-red-400/15 text-red-300" : "bg-primary-foreground text-primary-background hover:opacity-90"}`}
                                            >
                                                {copied ? (
                                                    <>
                                                        <Check size={13} aria-hidden /> Copied
                                                    </>
                                                ) : failed ? (
                                                    "Failed"
                                                ) : (
                                                    <>
                                                        <Copy size={13} aria-hidden /> Copy
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                        <span role="status" className="sr-only">
                                            {copied ? "Link copied" : failed ? "Copy failed" : ""}
                                        </span>
                                        {!isPublic && <p className="px-1 text-[11px] text-primary-foreground/60">Turn on the public link to copy or share it.</p>}
                                    </motion.div>

                                    <motion.div variants={rise} className="flex gap-2">
                                        <a
                                            href={isPublic ? (link ?? undefined) : undefined}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            aria-disabled={!isPublic}
                                            tabIndex={isPublic ? 0 : -1}
                                            className={`${SECONDARY} ${!isPublic ? "pointer-events-none opacity-60" : ""}`}
                                        >
                                            <ExternalLink size={13} aria-hidden />
                                            Open
                                        </a>
                                        {canNativeShare && (
                                            <button type="button" onClick={handleNativeShare} disabled={!isPublic} className={`${SECONDARY} disabled:cursor-not-allowed disabled:opacity-60`}>
                                                <Share2 size={13} aria-hidden />
                                                Share…
                                            </button>
                                        )}
                                    </motion.div>
                                </div>
                            )}
                        </motion.div>
                    </Dialog.Popup>
                </div>
            </Dialog.Portal>
        </Dialog.Root>
    );
};

export default ShareModal;
