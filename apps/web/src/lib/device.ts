export function isMobileDevice(): boolean {
    if (typeof navigator === "undefined") return false;

    const nav = navigator as Navigator & {
        userAgentData?: { mobile?: boolean };
    };

    if (nav.userAgentData?.mobile) return true;
    if (/Android|iPhone|iPad|iPod|Mobile|IEMobile|Opera Mini/i.test(nav.userAgent))
        return true;

    // iPadOS 13+ reports itself as a Mac
    return nav.platform === "MacIntel" && nav.maxTouchPoints > 1;
}