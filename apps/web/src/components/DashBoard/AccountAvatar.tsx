"use client";

import { UserCircleFreeIcons } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState } from "react";
import { useAuth } from "@/lib/auth";

/** The signed-in person's picture, their initial if there is no picture (or it fails to load), or a generic icon for guests. */
export default function AccountAvatar({ size = 25 }: { size?: number }) {
    const { user } = useAuth();
    const [failedUrl, setFailedUrl] = useState<string | null>(null);

    if (!user) return <HugeiconsIcon icon={UserCircleFreeIcons} size={size} />;

    const image = user.image;
    if (image && failedUrl !== image) {
        return (
            // eslint-disable-next-line @next/next/no-img-element -- remote Google avatar; no Next image domain config needed
            <img
                src={image}
                alt=""
                width={size}
                height={size}
                referrerPolicy="no-referrer"
                onError={() => setFailedUrl(image)}
                className="rounded-full object-cover"
                style={{ width: size, height: size }}
            />
        );
    }

    const initial = (user.name ?? user.username ?? user.email ?? "?").trim().charAt(0).toUpperCase() || "?";
    return (
        <span
            aria-hidden
            className="flex items-center justify-center rounded-full bg-accent/30 font-semibold text-primary-foreground"
            style={{ width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.45)) }}
        >
            {initial}
        </span>
    );
}
