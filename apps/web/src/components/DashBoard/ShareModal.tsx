"use client";

import { Dialog } from "@base-ui/react/dialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, type Variants } from "framer-motion";
import { Check, Copy, ExternalLink, Globe, Link2, Lock, LogIn, Share2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import type { Share } from "@algoforge/contracts";
import { endpoints } from "@/lib/api/endpoints";
import { errorMessage } from "@/lib/api/errors";
import { useAuth, useFeatureState } from "@/lib/auth";
import { useTargetShares } from "@/lib/query";
import { queryKeys } from "@/lib/query/keys";
import type { ShareTarget } from "@/lib/share/target";

interface ShareModalProps {
    isOpen: boolean;
    onClose: VoidFunction;
    /** What is being shared. Null = nothing saved yet (the hint explains what to do). */
    target: ShareTarget | null;
    emptyHint?: string;
}

const TITLES = { analysis: "Share analysis", explain: "Share chat", visualization: "Share visualization" } as const;
const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];
const list: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.05, delayChildren: 0.1 } } };
const rise: Variants = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: EASE } } };
const noopSubscribe = () => () => {};

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

function Notice({ title, body, children }: { title: string; body: string; children?: ReactNode }) {
    return (
        <motion.div variants={rise} className="px-5 pb-5">
            <div role="status" className="rounded-xl border border-primary-foreground/8! bg-primary-foreground/3 p-4 text-[13px] leading-relaxed">
                <p className="font-medium text-primary-foreground">{title}</p>
                <p className="mt-1 text-primary-foreground/60">{body}</p>
            </div>
            <div className="mt-4 flex justify-end">{children}</div>
        </motion.div>
    );
}

export default function ShareModal({ isOpen, onClose, target, emptyHint }: ShareModalProps) {
    const { openLoginModal } = useAuth();
    const feature = useFeatureState("sharing", { uiReady: true });
    const queryClient = useQueryClient();
    const shares = useTargetShares(target, isOpen && feature === "ready");
    const active: Share | null = shares.data?.data[0] ?? null;

    const [copied, setCopied] = useState(false);
    const [copyFailed, setCopyFailed] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const canNativeShare = useSyncExternalStore(noopSubscribe, () => typeof navigator !== "undefined" && !!navigator.share, () => false);

    useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

    /** One place that keeps every view of "is this shared?" in step with the server. */
    const sync = (next: Share[]) => {
        if (target) queryClient.setQueryData(queryKeys.shares(target.type, target.id), { data: next });
        void queryClient.invalidateQueries({ queryKey: ["analysis"] });
        void queryClient.invalidateQueries({ queryKey: ["explain", "sessions"] });
    };

    const create = useMutation({
        mutationFn: () => endpoints.createShare({ type: target!.type, targetId: target!.id }),
        onSuccess: (share) => { setError(null); sync([share]); },
        onError: (e: unknown) => setError(errorMessage(e)),
    });
    const revoke = useMutation({
        mutationFn: (shareId: string) => endpoints.revokeShare(shareId),
        onSuccess: () => { setError(null); sync([]); },
        onError: (e: unknown) => setError(errorMessage(e)),
    });
    const busy = create.isPending || revoke.isPending;
    const link = active?.url ?? null;

    const handleCopy = useCallback(async () => {
        if (!link) return;
        const ok = await copyText(link);
        setCopied(ok);
        setCopyFailed(!ok);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => { setCopied(false); setCopyFailed(false); }, 2000);
    }, [link]);

    const handleNativeShare = async () => {
        if (!link || !target) return;
        try {
            await navigator.share({ title: target.title, url: link });
        } catch {
            /* cancelled */
        }
    };

    const handleSignIn = () => {
        onClose();
        openLoginModal({ message: "Sign in to share your work with a link." });
    };

    const title = target ? TITLES[target.type] : "Share";
    const subtitle =
        feature === "needs-account" ? "Sign in to share" : feature !== "ready" ? "Not available" : !target ? "Nothing to share yet" : active ? "Anyone with the link can view" : "Link sharing is turned off";

    let body: ReactNode;
    if (feature === "needs-account") {
        body = (
            <Notice title="Sharing needs an account" body="Links belong to the person who made them, so you need to sign in first. The editor and the visualizer keep working without an account.">
                <button type="button" onClick={handleSignIn} className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-primary-foreground px-3 py-1.5 text-[12px] font-medium text-primary-background transition hover:opacity-90">
                    <LogIn size={13} aria-hidden /> Sign in with Google
                </button>
            </Notice>
        );
    } else if (feature !== "ready") {
        body = (
            <Notice title={feature === "loading" ? "Checking availability…" : "Sharing isn't available on this server"} body="Nothing was shared and no link exists.">
                <Dialog.Close className="cursor-pointer rounded-lg border border-primary-foreground/10! px-3 py-1.5 text-[12px] text-primary-foreground/70 transition hover:bg-primary-foreground/8 hover:text-primary-foreground">Got it</Dialog.Close>
            </Notice>
        );
    } else if (!target) {
        body = (
            <Notice title="Nothing to share yet" body={emptyHint ?? "Save your work first, then share it."}>
                <Dialog.Close className="cursor-pointer rounded-lg border border-primary-foreground/10! px-3 py-1.5 text-[12px] text-primary-foreground/70 transition hover:bg-primary-foreground/8 hover:text-primary-foreground">Got it</Dialog.Close>
            </Notice>
        );
    } else {
        body = (
            <div className="space-y-4 px-5 pb-5">
                <motion.div variants={rise} className="flex items-center justify-between gap-4 rounded-xl border border-primary-foreground/8! bg-primary-foreground/3 p-3.5">
                    <div className="flex items-center gap-3">
                        <div className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${active ? "bg-emerald-400/10 text-emerald-400" : "bg-primary-foreground/6 text-primary-foreground/60"}`}>
                            {active ? <Globe size={16} strokeWidth={1.75} aria-hidden /> : <Lock size={16} strokeWidth={1.75} aria-hidden />}
                        </div>
                        <div>
                            <p className="text-[13px] font-medium text-primary-foreground">Public link</p>
                            <p className="mt-0.5 text-[12px] text-primary-foreground/60">{active ? "Turn off to revoke it immediately" : "Turn on to create a link"}</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        role="switch"
                        aria-checked={!!active}
                        aria-label="Public link"
                        disabled={busy || shares.isPending}
                        onClick={() => (active ? revoke.mutate(active.shareId) : create.mutate())}
                        className={`relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 disabled:cursor-wait disabled:opacity-60 ${active ? "bg-emerald-400" : "bg-primary-foreground/25"}`}
                    >
                        <motion.span layout transition={{ type: "spring", stiffness: 500, damping: 32 }} className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow" style={{ left: active ? "22px" : "2px" }} />
                    </button>
                </motion.div>

                {shares.isError && <p role="alert" className="text-[12px] text-red-300">{errorMessage(shares.error)}</p>}
                {error && <p role="alert" className="rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-xs text-red-200">{error}</p>}

                {link && (
                    <>
                        <motion.div variants={rise} className="space-y-2">
                            <div className="flex items-center gap-2 rounded-xl border border-primary-foreground/10! bg-primary-foreground/3 p-1.5 pl-3 transition focus-within:border-accent/50!">
                                <Link2 size={14} className="shrink-0 text-primary-foreground/60" aria-hidden />
                                <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} aria-label="Share link" className="min-w-0 flex-1 truncate bg-transparent font-mono text-[12px] text-primary-foreground/80 outline-none" />
                                <button
                                    type="button"
                                    onClick={handleCopy}
                                    className={`flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-[12px] font-medium transition ${copied ? "bg-emerald-400/15 text-emerald-300" : copyFailed ? "bg-red-400/15 text-red-300" : "bg-primary-foreground text-primary-background hover:opacity-90"}`}
                                >
                                    {copied ? (<><Check size={13} aria-hidden /> Copied</>) : copyFailed ? "Failed" : (<><Copy size={13} aria-hidden /> Copy</>)}
                                </button>
                            </div>
                            <span role="status" className="sr-only">{copied ? "Link copied" : copyFailed ? "Copy failed" : ""}</span>
                            <p className="px-1 text-[11px] text-primary-foreground/60">{active!.viewCount} {active!.viewCount === 1 ? "view" : "views"}</p>
                        </motion.div>
                        <motion.div variants={rise} className="flex gap-2">
                            <a href={link} target="_blank" rel="noopener noreferrer" className={SECONDARY}>
                                <ExternalLink size={13} aria-hidden /> Open
                            </a>
                            {canNativeShare && (
                                <button type="button" onClick={handleNativeShare} className={SECONDARY}>
                                    <Share2 size={13} aria-hidden /> Share…
                                </button>
                            )}
                        </motion.div>
                    </>
                )}
            </div>
        );
    }

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
                                        <Dialog.Description className="text-[12px] text-primary-foreground/60">{subtitle}</Dialog.Description>
                                    </div>
                                </div>
                                <Dialog.Close aria-label="Close" className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-primary-foreground/60 transition hover:bg-primary-foreground/8 hover:text-primary-foreground">
                                    <X size={15} aria-hidden />
                                </Dialog.Close>
                            </motion.div>
                            {body}
                        </motion.div>
                    </Dialog.Popup>
                </div>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
