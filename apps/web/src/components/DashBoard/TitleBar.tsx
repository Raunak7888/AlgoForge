"use client";

import AccountAvatar from "./AccountAvatar";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowDown, ArrowUp, CornerDownLeft, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { NAV_EVENT } from "@/lib/navEvents";
import { useSearch } from "@/lib/search/useSearch";
import type { SearchResultItem } from "@/lib/search/items";
import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";

import type { AccountMenuItem, AccountUser } from "./Setting";
import SettingsDropdown from "./Setting";

import NotificationsPopover, {
    type AppNotification,
} from "./NotificationsPopover";

import AlgoForgeLogo from "../Logo";

/* -------------------------------------------------------------------------- */
/* Keyboard Shortcut                                                          */
/* -------------------------------------------------------------------------- */

function Kbd({ children }: { children: React.ReactNode }) {
    return (
        <kbd
            className="
         inline-flex h-5 min-w-5 items-center justify-center
         rounded border border-primary-foreground/20!
         bg-primary-foreground/5 px-1
         font-sans text-[10px] font-medium
         text-primary-foreground/50
     "
        >
            {children}
        </kbd>
    );
}

/* -------------------------------------------------------------------------- */
/* Search                                                                     */
/* -------------------------------------------------------------------------- */

export type { SearchResultItem };


const MAX_RESULTS = 6;

const noopSubscribe = () => () => {};

function escapeRegExp(s: string) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Bolds the matching part of a string. */
function Highlight({ text, query }: { text: string; query: string }) {
    const q = query.trim();
    if (!q) return <>{text}</>;
    const parts = text.split(new RegExp(`(${escapeRegExp(q)})`, "ig"));
    return (
        <>
            {parts.map((part, i) =>
                part.toLowerCase() === q.toLowerCase() ? (
                    <span key={i} className="font-semibold text-primary-foreground">
                        {part}
                    </span>
                ) : (
                    <span key={i}>{part}</span>
                ),
            )}
        </>
    );
}

function SearchBox({
    onSearch,
    onSelect,
    items,
}: {
    onSearch?: (query: string) => void;
    onSelect?: (item: SearchResultItem) => void;
    items?: SearchResultItem[];
}) {
    const reduce = useReducedMotion();
    const router = useRouter();
    const listId = useId();
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLUListElement>(null);

    const [focused, setFocused] = useState(false);
    const [value, setValue] = useState("");
    const [active, setActive] = useState(-1);
    const isMac = useSyncExternalStore(
        noopSubscribe,
        () => /mac|iphone|ipad/i.test(navigator.platform),
        () => false,
    );

    const query = value.trim();

    /* Filter by title, description, or category. Empty query shows suggestions. */
    const remote = useSearch(query, items === undefined); const results = useMemo(() => (items ?? remote.items).slice(0, MAX_RESULTS), [items, remote.items]);

    const open = focused;

    /* Reset the highlighted row when the results change */
    const activeKey = `${query}|${results.length}`;
    const [prevActiveKey, setPrevActiveKey] = useState(activeKey);
    if (prevActiveKey !== activeKey) {
        setPrevActiveKey(activeKey);
        setActive(query && results.length ? 0 : -1);
    }

    /* Keep the active row in view */
    useEffect(() => {
        if (active < 0) return;
        listRef.current
            ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
            ?.scrollIntoView({ block: "nearest" });
    }, [active]);

    useEffect(() => {
        const handleShortcut = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;

            const isTyping =
                target.tagName === "INPUT" ||
                target.tagName === "TEXTAREA" ||
                target.isContentEditable;

            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
                e.preventDefault();
                inputRef.current?.focus();
            }

            if (e.key === "/" && !isTyping) {
                e.preventDefault();
                inputRef.current?.focus();
            }
        };

        window.addEventListener("keydown", handleShortcut);
        return () => window.removeEventListener("keydown", handleShortcut);
    }, []);

    const choose = (item: SearchResultItem) => {
        setValue("");
        inputRef.current?.blur();
        onSelect?.(item);
        if (item.href.startsWith("/dashboard") && window.location.pathname === "/dashboard") { window.history.pushState(null, "", item.href); window.dispatchEvent(new Event(NAV_EVENT)); } else router.push(item.href);
    };

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (active >= 0 && results[active]) return choose(results[active]);
        if (query) onSearch?.(query);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Escape") {
            if (value) setValue("");
            else inputRef.current?.blur();
            return;
        }
        if (!results.length) return;
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => (i + 1) % results.length);
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => (i <= 0 ? results.length - 1 : i - 1));
        }
    };

    return (
        <motion.form
            role="search"
            onSubmit={handleSubmit}
            animate={{ width: focused ? 340 : 240 }}
            transition={
                reduce
                    ? { duration: 0 }
                    : { type: "spring", stiffness: 420, damping: 34 }
            }
            className="
            group relative hidden h-8 items-center
            rounded-lg border border-primary-foreground/20!
            bg-primary-background text-primary-foreground
            transition-[border-color] duration-200
            hover:border-primary-foreground/40!
            focus-within:border-primary-foreground/60!
            sm:flex
        "
        >
            <Search
                size={14}
                className={`
                pointer-events-none absolute left-2.5
                transition-colors duration-200
                ${focused ? "text-accent" : "text-primary-foreground/40"}
            `}
            />

            <input
                ref={inputRef}
                type="text"
                role="combobox"
                aria-expanded={open}
                aria-controls={listId}
                aria-autocomplete="list"
                aria-activedescendant={
                    active >= 0 ? `${listId}-${active}` : undefined
                }
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                onKeyDown={handleKeyDown}
                placeholder="Search algorithms..."
                aria-label="Search algorithms"
                autoComplete="off"
                spellCheck={false}
                className="
                h-full w-full bg-transparent
                pl-8 pr-16 text-[13px]
                outline-none
                placeholder:text-primary-foreground/40
            "
            />

            <div className="absolute right-1.5 flex items-center gap-1">
                {value ? (
                    <>
                        <button
                            type="button"
                            aria-label="Clear search"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                                setValue("");
                                inputRef.current?.focus();
                            }}
                            className="
                            flex h-5 w-5 items-center justify-center
                            rounded text-primary-foreground/40
                            transition-colors
                            hover:bg-primary-foreground/10
                            hover:text-primary-foreground
                        "
                        >
                            <X size={12} />
                        </button>

                        <Kbd>
                            <CornerDownLeft size={10} />
                        </Kbd>
                    </>
                ) : (
                    !focused && (
                        <>
                            <Kbd>{isMac ? "⌘" : "Ctrl"}</Kbd>
                            <Kbd>K</Kbd>
                        </>
                    )
                )}
            </div>

            {/* Results */}

            <AnimatePresence>
                {open && (
                    <motion.div
                        key="results"
                        initial={reduce ? false : { opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={reduce ? undefined : { opacity: 0, y: -4 }}
                        transition={{ duration: 0.14, ease: "easeOut" }}
                        onMouseDown={(e) => e.preventDefault()} /* keep input focused */
                        className="
                        absolute left-0 top-full z-40 mt-1.5 w-full
                        overflow-hidden rounded-lg scrollbar-thin
                        border border-primary-foreground/20!
                        bg-primary-background shadow-lg
                    "
                    >
                        {results.length > 0 ? (
                            <>
                                {!query && (
                                    <p className="px-3 pb-1 pt-2 text-[11px] text-primary-foreground/40">
                                        Suggested
                                    </p>
                                )}
                                <ul
                                    ref={listRef}
                                    id={listId}
                                    role="listbox"
                                    className="max-h-72 overflow-y-auto p-1"
                                >
                                    {results.map((item, i) => (
                                        <li
                                            key={item.id}
                                            id={`${listId}-${i}`}
                                            data-index={i}
                                            role="option"
                                            aria-selected={i === active}
                                            onMouseEnter={() => setActive(i)}
                                            onClick={() => choose(item)}
                                            className={`
                                            flex cursor-pointer items-start justify-between gap-3
                                            rounded-md px-2.5 py-2
                                            transition-colors duration-100
                                            ${i === active ? "bg-primary-foreground/10" : ""}
                                        `}
                                        >
                                            <span className="min-w-0">
                                                <span className="block truncate text-[13px] text-primary-foreground/90">
                                                    <Highlight text={item.title} query={query} />
                                                </span>
                                                <span className="block truncate text-[11px] text-primary-foreground/45">
                                                    <Highlight
                                                        text={item.description}
                                                        query={query}
                                                    />
                                                </span>
                                            </span>
                                            <span className="mt-0.5 shrink-0 text-[11px] text-primary-foreground/40">
                                                {item.category}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </>
                        ) : (
                            <div className="px-3 py-6 text-center">
                                <p className="text-[13px] text-primary-foreground/80">
                                    {query ? (remote.loading ? "Searching…" : "No results for “" + query + "”") : "Type to search algorithms"}
                                </p>
                                <p className="mt-0.5 text-[11px] text-primary-foreground/40">
                                    Try an algorithm, data structure, or guide name.
                                </p>
                            </div>
                        )}

                        <div className="flex items-center gap-3 border-t border-primary-foreground/15 px-3 py-1.5 text-[11px] text-primary-foreground/40">
                            <span className="flex items-center gap-1">
                                <Kbd><ArrowUp size={10} /></Kbd>
                                <Kbd><ArrowDown size={10} /></Kbd>
                                navigate
                            </span>
                            <span className="flex items-center gap-1">
                                <Kbd><CornerDownLeft size={10} /></Kbd>
                                open
                            </span>
                            <span className="ml-auto flex items-center gap-1">
                                <Kbd>Esc</Kbd>
                                close
                            </span>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.form>
    );
}

/* -------------------------------------------------------------------------- */
/* Top Navigation                                                             */
/* -------------------------------------------------------------------------- */

export interface TopNavProps {
    user?: AccountUser | null;
    menuItems?: AccountMenuItem[];
    notifications?: AppNotification[];
    onSearch?: (query: string) => void;
    /** Called when a result is opened. Navigation to its href happens automatically. */
    onSelectResult?: (item: SearchResultItem) => void;
    /** Override the searchable items. Defaults to the built-in list. */
    searchItems?: SearchResultItem[];
}

export default function TopNav({
    notifications = [],
    onSearch,
    onSelectResult,
    searchItems,
}: TopNavProps) {
    const reduce = useReducedMotion();

    const [settingsOpen, setSettingsOpen] = useState(false);

    const menuRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);

    /* Close dropdown on outside click or Escape */

    useEffect(() => {
        if (!settingsOpen) return;

        const handlePointerDown = (e: PointerEvent) => {
            if (!menuRef.current?.contains(e.target as Node)) {
                setSettingsOpen(false);
            }
        };

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                setSettingsOpen(false);
                triggerRef.current?.focus();
            }
        };

        document.addEventListener("pointerdown", handlePointerDown);
        document.addEventListener("keydown", handleKeyDown);

        return () => {
            document.removeEventListener("pointerdown", handlePointerDown);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [settingsOpen]);

    return (
        <header
            className="
        relative z-30 flex h-12 shrink-0
        items-center justify-between
        rounded-b-2xl
        border-b border-primary-foreground/20!
        bg-primary-background/80
        px-4 backdrop-blur-md
        supports-backdrop-filter:bg-primary-background/70
    "
        >
            {/* Brand */}

            <motion.a
                href="/"
                whileTap={reduce ? undefined : { scale: 0.97 }}
                aria-label="AlgoForge home"
                className="
                flex items-center rounded-md
                outline-none
                focus-visible:ring-2
                focus-visible:ring-accent/60
            "
            >
                <AlgoForgeLogo size={19} />

                <span
                    className="
                font-chango text-lg
                tracking-tight text-primary-foreground
            "
                >
                    lgo<span className="text-accent">Forge</span>
                </span>
            </motion.a>

            {/* Right Actions */}

            <div className="flex items-center gap-2">
                {/* Search */}

                <SearchBox
                    onSearch={onSearch}
                    onSelect={onSelectResult}
                    items={searchItems}
                />

                {/* Notifications */}

                <motion.div
                    whileTap={reduce ? undefined : { scale: 0.92 }}
                    className="
                    flex h-8 w-8 items-center
                    justify-center rounded-full
                    text-primary-foreground
                    transition-colors duration-150
                    hover:bg-accent/20
                "
                >
                    <NotificationsPopover notifications={notifications} />
                </motion.div>

                {/* Divider */}

                <div
                    aria-hidden="true"
                    className="h-5 w-px bg-primary-foreground/15"
                />

                {/* Account & Settings */}

                <div ref={menuRef} className="relative">
                    <motion.button
                        ref={triggerRef}
                        type="button"
                        onClick={() => setSettingsOpen((open) => !open)}
                        whileTap={reduce ? undefined : { scale: 0.94 }}
                        aria-label="Account and settings"
                        aria-haspopup="menu"
                        aria-expanded={settingsOpen}
                        className={`
                        flex h-8 w-8 items-center justify-center
                        rounded-full border
                        text-primary-foreground outline-none
                        transition-all duration-200
                        focus-visible:ring-2
                        focus-visible:ring-accent/60
                        ${
                            settingsOpen
                                ? "border-primary-foreground/50! bg-accent/30"
                                : "border-primary-foreground/20! hover:border-primary-foreground/40! hover:bg-accent/20"
                        }
                    `}
                    >
                        <AccountAvatar size={25} />
                    </motion.button>

                    <SettingsDropdown
                        open={settingsOpen}
                        onClose={() => {
                            setSettingsOpen(false);
                            triggerRef.current?.focus();
                        }}
                    />
                </div>
            </div>
        </header>
    );
}