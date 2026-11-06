"use client";

import { useState, type FormEvent } from "react";
import { UpdateProfileRequestSchema, type UpdateProfileRequest } from "@algoforge/contracts";
import AccountAvatar from "@/components/DashBoard/AccountAvatar";
import { btnPrimary, inputCls } from "@/components/visualizers/shared/styles";
import { endpoints } from "@/lib/api/endpoints";
import { errorMessage } from "@/lib/api/errors";
import { useAuth } from "@/lib/auth";
import { DialogShell } from "./DialogShell";

/** Mounted only while the dialog is open, so the form always starts from the current profile. */
function ProfileForm() {
    const { user, setUser } = useAuth();
    const [name, setName] = useState(user?.name ?? "");
    const [username, setUsername] = useState(user?.username ?? "");
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!user) return <p className="text-sm text-primary-foreground/60">Sign in to edit your profile.</p>;

    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setSaved(false);

        const patch: UpdateProfileRequest = {};
        const nextName = name.trim();
        const nextUsername = username.trim().toLowerCase();
        if (nextName !== (user.name ?? "")) patch.name = nextName;
        if (nextUsername !== "" && nextUsername !== (user.username ?? "")) patch.username = nextUsername;

        if (patch.name === undefined && patch.username === undefined) {
            setError("Nothing to save: change your name or username first.");
            return;
        }
        const parsed = UpdateProfileRequestSchema.safeParse(patch);
        if (!parsed.success) {
            setError(parsed.error.issues[0]?.message ?? "Please check your input.");
            return;
        }

        setSaving(true);
        setError(null);
        try {
            const response = await endpoints.updateProfile(parsed.data);
            setUser(response.user);
            setName(response.user.name ?? "");
            setUsername(response.user.username ?? "");
            setSaved(true);
        } catch (caught) {
            setError(errorMessage(caught));
        } finally {
            setSaving(false);
        }
    };

    return (
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
            <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-primary-foreground/20! text-primary-foreground">
                    <AccountAvatar size={48} />
                </div>
                <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-primary-foreground">{user.email ?? "No email on file"}</p>
                    <p className="text-[11px] text-primary-foreground/50">Your email and picture come from Google.</p>
                </div>
            </div>

            <label className="flex flex-col gap-1.5 text-[12px] text-primary-foreground/70">
                Name
                <input className={inputCls} value={name} maxLength={100} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            </label>

            <label className="flex flex-col gap-1.5 text-[12px] text-primary-foreground/70">
                Username
                <input className={inputCls} value={username} maxLength={30} onChange={(e) => setUsername(e.target.value)} autoComplete="username" spellCheck={false} />
                <span className="text-[11px] text-primary-foreground/50">3-30 characters: lowercase letters, digits or underscores.</span>
            </label>

            {error && (
                <p role="alert" className="rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-xs text-red-200">
                    {error}
                </p>
            )}
            {saved && (
                <p role="status" className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-200">
                    Profile saved.
                </p>
            )}

            <div className="flex justify-end">
                <button type="submit" className={btnPrimary} disabled={saving}>
                    {saving ? "Saving…" : "Save changes"}
                </button>
            </div>
        </form>
    );
}

export default function ProfileDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
    return (
        <DialogShell open={open} onClose={onClose} title="Profile" description="How you appear in AlgoForge. Changes are saved to your account.">
            <ProfileForm />
        </DialogShell>
    );
}
