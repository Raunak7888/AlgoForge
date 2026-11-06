"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { DeviceSession } from "@algoforge/contracts";
import { btn } from "@/components/visualizers/shared/styles";
import { endpoints } from "@/lib/api/endpoints";
import { errorMessage } from "@/lib/api/errors";
import { useAuth } from "@/lib/auth";
import { QueryBoundary } from "@/lib/query";
import { queryKeys } from "@/lib/query/keys";
import { describeDevice } from "./deviceLabel";
import { DialogShell } from "./DialogShell";

const DANGER_BTN =
    "inline-flex h-8 items-center justify-center rounded-lg border border-red-400/40 px-3 text-xs font-medium text-red-300 transition hover:bg-red-400/10 disabled:cursor-not-allowed disabled:opacity-50";

function formatWhen(iso: string): string {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function DeviceList() {
    const queryClient = useQueryClient();
    const { status, clearSession } = useAuth();
    const [error, setError] = useState<string | null>(null);

    const sessions = useQuery({
        queryKey: queryKeys.deviceSessions(),
        queryFn: ({ signal }) => endpoints.sessions(signal),
        enabled: status === "authed",
    });

    const revoke = useMutation({
        mutationFn: async (row: DeviceSession) => {
            await endpoints.revokeSession(row.id);
            return row;
        },
        onSuccess: (row) => {
            setError(null);
            // Signing out this very browser: the server already cleared the cookies.
            if (row.current) clearSession();
            else void queryClient.invalidateQueries({ queryKey: queryKeys.deviceSessions() });
        },
        onError: (caught: unknown) => setError(errorMessage(caught)),
    });

    return (
        <section aria-labelledby="devices-heading" className="flex flex-col gap-2">
            <h3 id="devices-heading" className="text-[13px] font-semibold text-primary-foreground">
                Signed-in devices
            </h3>
            <QueryBoundary query={sessions} loadingLabel="Loading devices…">
                <ul className="flex flex-col divide-y divide-primary-foreground/10 rounded-xl border border-primary-foreground/10">
                    {(sessions.data?.data ?? []).map((row) => (
                        <li key={row.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                            <div className="min-w-0">
                                <p className="truncate text-[13px] text-primary-foreground">
                                    {describeDevice(row.userAgent)}
                                    {row.current && <span className="ml-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-1.5 py-0.5 text-[10px] text-emerald-300">This device</span>}
                                </p>
                                <p className="truncate text-[11px] text-primary-foreground/50">Last active {formatWhen(row.lastUsedAt)}</p>
                            </div>
                            <button type="button" className={btn} onClick={() => revoke.mutate(row)} disabled={revoke.isPending}>
                                Sign out
                            </button>
                        </li>
                    ))}
                    {sessions.data && sessions.data.data.length === 0 && <li className="px-3 py-3 text-xs text-primary-foreground/60">No active devices.</li>}
                </ul>
            </QueryBoundary>
            {error && (
                <p role="alert" className="text-xs text-red-300">
                    {error}
                </p>
            )}
        </section>
    );
}

function DangerZone({ onDeleted }: { onDeleted: () => void }) {
    const { clearSession } = useAuth();
    const [confirming, setConfirming] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const remove = async () => {
        setBusy(true);
        setError(null);
        try {
            await endpoints.deleteAccount();
            clearSession();
            onDeleted();
        } catch (caught) {
            setError(errorMessage(caught));
            setBusy(false);
        }
    };

    return (
        <section aria-labelledby="danger-heading" className="flex flex-col gap-2 rounded-xl border border-red-400/25 p-3">
            <h3 id="danger-heading" className="text-[13px] font-semibold text-red-300">
                Delete account
            </h3>
            <p className="text-[12px] leading-relaxed text-primary-foreground/60">
                This permanently deletes your account, your analyses, your chats and every device session. Shared links stop working. It cannot be undone.
            </p>
            {error && (
                <p role="alert" className="text-xs text-red-300">
                    {error}
                </p>
            )}
            {confirming ? (
                <div className="flex items-center gap-2">
                    <button type="button" className={DANGER_BTN} onClick={remove} disabled={busy}>
                        {busy ? "Deleting…" : "Yes, delete everything"}
                    </button>
                    <button type="button" className={btn} onClick={() => setConfirming(false)} disabled={busy}>
                        Cancel
                    </button>
                </div>
            ) : (
                <div>
                    <button type="button" className={DANGER_BTN} onClick={() => setConfirming(true)}>
                        Delete my account…
                    </button>
                </div>
            )}
        </section>
    );
}

/** Only what exists: devices and account deletion. There is no theme switch (the app is dark only). */
export default function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
    return (
        <DialogShell open={open} onClose={onClose} title="Settings" description="Manage where you are signed in, and your account.">
            <div className="flex flex-col gap-5">
                <DeviceList />
                <DangerZone onDeleted={onClose} />
            </div>
        </DialogShell>
    );
}
