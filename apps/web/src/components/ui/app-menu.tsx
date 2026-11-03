"use client";

import { Menu } from "@base-ui/react/menu";
import { cn } from "@/lib/utils";

export const AppMenu = Menu.Root;
export const AppMenuTrigger = Menu.Trigger;

export function AppMenuContent({ children, label, className }: { children: React.ReactNode; label?: string; className?: string }) {
    return (
        <Menu.Portal>
            <Menu.Positioner side="bottom" align="end" sideOffset={8} className="z-50">
                <Menu.Popup
                    aria-label={label}
                    className={cn(
                        "w-52 overflow-hidden rounded-xl border border-primary-foreground/10! bg-primary-background shadow-2xl outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0",
                        className,
                    )}
                >
                    {children}
                </Menu.Popup>
            </Menu.Positioner>
        </Menu.Portal>
    );
}

export const AppMenuItem = ({ className, ...props }: React.ComponentProps<typeof Menu.Item>) => (
    <Menu.Item
        className={cn(
            "flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-primary-foreground/70 outline-none transition-colors data-disabled:cursor-not-allowed data-disabled:opacity-60 data-highlighted:bg-primary-foreground/15 data-highlighted:text-primary-foreground",
            className as string,
        )}
        {...props}
    />
);
