export const AUTH_COOKIE = "af_user";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

export interface AuthUser {
    id: string;
    name: string;
    email: string;
    picture?: string;
}

export function readUserCookie(): AuthUser | null {
    if (typeof document === "undefined") return null;

    const entry = document.cookie
        .split("; ")
        .find((row) => row.startsWith(`${AUTH_COOKIE}=`));
    if (!entry) return null;

    try {
        const parsed = JSON.parse(
            decodeURIComponent(entry.slice(AUTH_COOKIE.length + 1)),
        );
        if (
            parsed &&
            typeof parsed.id === "string" &&
            typeof parsed.email === "string"
        ) {
            return parsed as AuthUser;
        }
        return null;
    } catch {
        return null; // malformed JSON counts as logged out
    }
}

export function writeUserCookie(user: AuthUser): void {
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie =
        `${AUTH_COOKIE}=${encodeURIComponent(JSON.stringify(user))}` +
        `; Path=/; Max-Age=${MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
}

export function clearUserCookie(): void {
    document.cookie = `${AUTH_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}