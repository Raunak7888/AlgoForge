export const SITE = { name: "AlgoForge", year: new Date().getFullYear() } as const;
export const DASHBOARD_HREF = "/dashboard";

export type SocialLabel = "GitHub" | "LinkedIn" | "Twitter" | "Facebook" | "Instagram";
export interface SocialLink {
    label: SocialLabel;
    href: string;
}
/** Add real profile URLs here. The footer renders only what is listed. */
export const SOCIAL_LINKS: readonly SocialLink[] = [];
