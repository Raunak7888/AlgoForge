"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Laptop, LogIn, LogOut, Settings, User, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import ProfileDialog from "@/components/account/ProfileDialog";
import SettingsDialog from "@/components/account/SettingsDialog";
import { errorMessage } from "@/lib/api/errors";
import { useAuth } from "@/lib/auth";
import AccountAvatar from "./AccountAvatar";

export interface AccountUser {
    name: string;
    email: string;
}
export interface AccountMenuItem {
    id: string;
    label: string;
    icon: LucideIcon;
    href?: string;
    onSelect?: () => void;
}

interface Entry {
    id: string;
    label: string;
    icon: LucideIcon;
    danger?: boolean;
    run: () => void | Promise<void>;
}

/**
 * The account menu. Everything shown here is real: the name, email and picture come from the server,
 * Profile and Settings open dialogs backed by the new endpoints, and the sign-out items end sessions on the server.
 * There is deliberately no theme switch: the app is dark only.
 */
export default function SettingsDropdown({
    open,
    onClose,
}: {
    open: boolean;
    onClose: VoidFunction;
}) {
    const reduce = useReducedMotion();
    const { user, status, logout, logoutAll, openLoginModal } = useAuth();
    const [hovered, setHovered] = useState<string | null>(null);
    const [profileOpen, setProfileOpen] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [notice, setNotice] = useState<string | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    // Reset hover when the menu opens (adjusted during render, not in an effect).
    const [prevOpen, setPrevOpen] = useState(open);
    if (prevOpen !== open) {
        setPrevOpen(open);
        if (open) setHovered(null);
    }

    // Move focus into the menu when it opens.
    useEffect(() => {
        if (open) requestAnimationFrame(() => menuRef.current?.focus());
    }, [open]);

    useEffect(() => {
        if (!notice) return;
        const id = setTimeout(() => setNotice(null), 6000);
        return () => clearTimeout(id);
    }, [notice]);

    const signIn: Entry = {
        id: "sign-in",
        label: "Sign in with Google",
        icon: LogIn,
        run: () => openLoginModal({ message: "Sign in to unlock analysis, the AI assistant, history and sharing." }),
    };
    const profile: Entry = { id: "profile", label: "Profile", icon: User, run: () => setProfileOpen(true) };
    const settings: Entry = { id: "settings", label: "Settings", icon: Settings, run: () => setSettingsOpen(true) };
    const signOut: Entry = { id: "sign-out", label: "Sign out", icon: LogOut, danger: true, run: () => logout() };
    const signOutAll: Entry = { id: "sign-out-all", label: "Sign out of all devices", icon: Laptop, danger: true, run: () => logoutAll() };

    const groups: Entry[][] =
        status === "authed" ? [[profile, settings], [signOut, signOutAll]] : status === "guest" ? [[signIn]] : [];
    const flat = groups.flat();

    const choose = (entry: Entry) => {
        onClose();
        void Promise.resolve()
            .then(entry.run)
            .catch((error: unknown) => setNotice(errorMessage(error)));
    };

    const onKeyDown = (e: React.KeyboardEvent) => {
        const buttons = Array.from(
            menuRef.current?.querySelectorAll<HTMLButtonElement>(
                "button:not(:disabled)",
            ) ?? [],
        );
        if (!buttons.length) return;
        const i = buttons.indexOf(document.activeElement as HTMLButtonElement);

        const move = (next: number) => {
            e.preventDefault();
            buttons[(next + buttons.length) % buttons.length].focus();
        };

        if (e.key === "ArrowDown") move(i + 1);
        else if (e.key === "ArrowUp") move(i === -1 ? buttons.length - 1 : i - 1);
        else if (e.key === "Home") move(0);
        else if (e.key === "End") move(buttons.length - 1);
        else if (e.key === "Tab") onClose();
    };

    const displayName = user?.name ?? user?.username ?? "Account";

    return (
        <>
            <AnimatePresence>
                {open && (
                    <motion.div
                        ref={menuRef}
                        role="menu"
                        aria-label="Account menu"
                        tabIndex={-1}
                        onKeyDown={onKeyDown}
                        onMouseLeave={() => setHovered(null)}
                        initial={
                            reduce
                                ? { opacity: 0 }
                                : { opacity: 0, scale: 0.96, y: -4, filter: "blur(4px)" }
                        }
                        animate={{ opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }}
                        exit={
                            reduce
                                ? { opacity: 0 }
                                : { opacity: 0, scale: 0.97, y: -2, filter: "blur(2px)" }
                        }
                        transition={
                            reduce
                                ? { duration: 0 }
                                : { type: "spring", stiffness: 520, damping: 34, mass: 0.7 }
                        }
                        style={{ transformOrigin: "top right" }}
                        className="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-xl border border-primary-foreground/20! bg-primary-background shadow-2xl shadow-black/40 outline-none"
                    >
                        {/* Account header */}
                        <div className="flex items-center gap-2.5 border-b border-primary-foreground/20! p-3">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-primary-foreground/20! text-primary-foreground">
                                <AccountAvatar size={32} />
                            </div>
                            <div className="min-w-0">
                                {status === "authed" && user ? (
                                    <>
                                        <p className="truncate text-[13px] font-medium text-primary-foreground">{displayName}</p>
                                        {user.email && <p className="truncate text-[11px] text-primary-foreground/50">{user.email}</p>}
                                    </>
                                ) : (
                                    <>
                                        <p className="truncate text-[13px] font-medium text-primary-foreground">{status === "loading" ? "Checking your session…" : "Guest"}</p>
                                        {status === "guest" && <p className="truncate text-[11px] text-primary-foreground/50">Sign in to unlock analysis and sharing</p>}
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Items */}
                        <div className="p-1.5">
                            {groups.map((group, gi) => (
                                <div key={gi}>
                                    {gi > 0 && (
                                        <div className="-mx-1.5 my-1.5 h-px bg-primary-foreground/20" />
                                    )}
                                    {group.map((item) => {
                                        const idx = flat.indexOf(item);
                                        const active = hovered === item.id;

                                        return (
                                            <motion.button
                                                key={item.id}
                                                role="menuitem"
                                                type="button"
                                                onMouseEnter={() => setHovered(item.id)}
                                                onFocus={() => setHovered(item.id)}
                                                onClick={() => choose(item)}
                                                initial={reduce ? false : { opacity: 0, x: 6 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{
                                                    delay: reduce ? 0 : 0.03 + idx * 0.025,
                                                    duration: 0.18,
                                                    ease: "easeOut",
                                                }}
                                                className={`relative flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-[13px] outline-none transition-colors duration-100 ${
                                                    item.danger
                                                        ? "text-red-400/80 hover:text-red-400 focus-visible:text-red-400"
                                                        : "text-primary-foreground/60 hover:text-primary-foreground focus-visible:text-primary-foreground"
                                                }`}
                                            >
                                                {/* Sliding highlight shared between items */}
                                                {active && (
                                                    <motion.span
                                                        layoutId="settings-menu-highlight"
                                                        className={`absolute inset-0 rounded-lg ${
                                                            item.danger
                                                                ? "bg-red-500/10"
                                                                : "bg-primary-foreground/10"
                                                        }`}
                                                        transition={
                                                            reduce
                                                                ? { duration: 0 }
                                                                : {
                                                                      type: "spring",
                                                                      stiffness: 600,
                                                                      damping: 40,
                                                                  }
                                                        }
                                                    />
                                                )}

                                                <span className="relative flex items-center gap-2.5">
                                                    <item.icon size={15} />
                                                    {item.label}
                                                </span>
                                            </motion.button>
                                        );
                                    })}
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <ProfileDialog open={profileOpen} onClose={() => setProfileOpen(false)} />
            <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />

            {notice && (
                <div role="alert" className="fixed right-4 top-16 z-60 max-w-xs rounded-lg border border-red-400/30 bg-primary-background px-3 py-2 text-xs text-red-300 shadow-xl">
                    {notice}
                </div>
            )}
        </>
    );
}
