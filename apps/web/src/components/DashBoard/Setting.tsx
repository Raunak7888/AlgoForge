import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
    CircleQuestionMark,
    LogOut,
    Settings,
    SunMoon,
    User,
    type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Item = {
    icon: LucideIcon;
    label: string;
    isComming?: boolean;
    danger?: boolean;
    onSelect?: () => void;
};
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


const groups: Item[][] = [
    [
        { icon: User, label: "Profile" },
        { icon: Settings, label: "Settings" },
        { icon: SunMoon, label: "Appearance", isComming: true },
    ],
    [{ icon: CircleQuestionMark, label: "Help" }],
    [{ icon: LogOut, label: "Sign out", danger: true }],
];

const flat = groups.flat();

export default function SettingsDropdown({
    open,
    onClose,
}: {
    open: boolean;
    onClose: VoidFunction;
}) {
    const reduce = useReducedMotion();
    const [hovered, setHovered] = useState<string | null>(null);
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

    return (
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
                    className="absolute right-0 top-full z-50 mt-2 w-60 overflow-hidden rounded-xl border border-primary-foreground/20! bg-primary-background shadow-2xl shadow-black/40 outline-none"
                >
                    {/* Account header */}
                    <div className="flex items-center gap-2.5 border-b border-primary-foreground/20! p-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-primary-foreground/20! bg-accent/30 text-xs font-semibold text-primary-foreground">
                            R
                        </div>
                        <div className="min-w-0">
                            <p className="truncate text-[13px] font-medium text-primary-foreground">
                                Raunak Yadav
                            </p>
                            <p className="truncate text-[11px] text-primary-foreground/50">
                                raunakyadav7888@gmail.com
                            </p>
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
                                    const disabled = !!item.isComming;
                                    const active = hovered === item.label && !disabled;

                                    return (
                                        <motion.button
                                            key={item.label}
                                            role="menuitem"
                                            type="button"
                                            disabled={disabled}
                                            onMouseEnter={() => setHovered(item.label)}
                                            onFocus={() => setHovered(item.label)}
                                            onClick={() => {
                                                item.onSelect?.();
                                                onClose();
                                            }}
                                            initial={reduce ? false : { opacity: 0, x: 6 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{
                                                delay: reduce ? 0 : 0.03 + idx * 0.025,
                                                duration: 0.18,
                                                ease: "easeOut",
                                            }}
                                            className={`relative flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-[13px] outline-none transition-colors duration-100 ${
                                                disabled
                                                    ? "cursor-not-allowed text-primary-foreground/40"
                                                    : item.danger
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

                                            {item.isComming && (
                                                <span className="relative rounded-full border border-primary-foreground/20! px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground/60">
                                                    Soon
                                                </span>
                                            )}
                                        </motion.button>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}