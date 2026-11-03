"use client";

import { Popover } from "@base-ui/react/popover";
import { Bell, X } from "lucide-react";

export type AppNotification = { id: string; title: string; description: string; time: string };

export default function NotificationsPopover({ notifications = [] }: { notifications?: AppNotification[] }) {
    const unread = notifications.length;
    return (
        <Popover.Root>
            <Popover.Trigger
                aria-label={unread ? `Notifications (${unread} unread)` : "Notifications"}
                className="relative flex h-8 w-8 items-center justify-center rounded-full hover:bg-accent/30"
            >
                <Bell size={20} aria-hidden />
                {unread > 0 && <span aria-hidden className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-accent" />}
            </Popover.Trigger>
            <Popover.Portal>
                <Popover.Positioner side="bottom" align="end" sideOffset={8} className="z-50">
                    <Popover.Popup className="w-60 overflow-hidden rounded-2xl border border-primary-foreground/20! bg-primary-background scrollbar-thin text-sm shadow-xl outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0">
                        <div className="flex items-center justify-between border-b border-primary-foreground/10! px-4 py-3">
                            <Popover.Title className="flex items-center gap-2 font-medium">
                                <Bell size={16} aria-hidden />
                                Notifications
                            </Popover.Title>
                            <Popover.Close aria-label="Close notifications" className="rounded-md p-0.5 hover:bg-primary-foreground/10">
                                <X size={16} aria-hidden />
                            </Popover.Close>
                        </div>
                        {notifications.length === 0 ? (
                            <p className="p-6 text-center text-xs text-muted-foreground">You have no notifications.</p>
                        ) : (
                            <ul tabIndex={0} aria-label="Notification list" className="max-h-80 overflow-y-auto">
                                {notifications.map((n) => (
                                    <li key={n.id} className="px-4 py-3">
                                        <p className="text-sm font-medium">{n.title}</p>
                                        <p className="text-xs text-muted-foreground">{n.description}</p>
                                        <p className="mt-1 text-[11px] text-muted-foreground">{n.time}</p>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Popover.Popup>
                </Popover.Positioner>
            </Popover.Portal>
        </Popover.Root>
    );
}
