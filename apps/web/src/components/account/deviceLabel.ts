/** A short, human label for a browser user-agent: "Chrome on Windows". Best effort, never throws. */
export function describeDevice(userAgent: string | null): string {
    if (!userAgent) return "Unknown device";
    const ua = userAgent;
    const browser = /Edg\//.test(ua)
        ? "Edge"
        : /OPR\/|Opera/.test(ua)
          ? "Opera"
          : /Firefox\/|FxiOS\//.test(ua)
            ? "Firefox"
            : /Chrome\/|CriOS\//.test(ua)
              ? "Chrome"
              : /Safari\//.test(ua)
                ? "Safari"
                : null;
    // Order matters: Android reports "Linux", iPhone reports "like Mac OS X".
    const os = /Windows/.test(ua)
        ? "Windows"
        : /Android/.test(ua)
          ? "Android"
          : /iPhone|iPad|iPod/.test(ua)
            ? "iOS"
            : /CrOS/.test(ua)
              ? "ChromeOS"
              : /Mac OS X|Macintosh/.test(ua)
                ? "macOS"
                : /Linux/.test(ua)
                  ? "Linux"
                  : null;
    if (browser && os) return `${browser} on ${os}`;
    return browser ?? os ?? "Unknown device";
}
