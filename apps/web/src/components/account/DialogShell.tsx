"use client";

import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";

interface DialogShellProps {
    open: boolean;
    onClose: () => void;
    title: string;
    description: string;
    children: ReactNode;
}

/** The one dialog frame for the account dialogs. Focus trap, Escape and focus return come from Base UI. */
export function DialogShell({ open, onClose, title, description, children }: DialogShellProps) {
    return (
        <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
            <Dialog.Portal>
                <Dialog.Backdrop className="fixed inset-0 z-60 bg-black/60 backdrop-blur-sm transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0" />
                <div className="pointer-events-none fixed inset-0 z-60 flex items-center justify-center p-4">
                    <Dialog.Popup className="pointer-events-auto relative max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl border border-primary-foreground/10! bg-primary-background p-5 shadow-2xl outline-none transition-[opacity,transform] duration-200 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
                        <div className="mb-4 flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <Dialog.Title className="text-[15px] font-semibold tracking-tight text-primary-foreground">{title}</Dialog.Title>
                                <Dialog.Description className="mt-0.5 text-[12px] leading-relaxed text-primary-foreground/60">{description}</Dialog.Description>
                            </div>
                            <Dialog.Close aria-label="Close" className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-primary-foreground/60 transition hover:bg-primary-foreground/8 hover:text-primary-foreground">
                                <X size={15} aria-hidden />
                            </Dialog.Close>
                        </div>
                        {children}
                    </Dialog.Popup>
                </div>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
