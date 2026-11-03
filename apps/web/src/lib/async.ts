/** Resolves true after `ms`, or false right away (timer cleared) when `signal` aborts. */
export function wait(ms: number, signal?: AbortSignal): Promise<boolean> {
    return new Promise((resolve) => {
        if (signal?.aborted) return resolve(false);
        const id = setTimeout(() => {
            signal?.removeEventListener("abort", onAbort);
            resolve(true);
        }, ms);
        const onAbort = () => {
            clearTimeout(id);
            resolve(false);
        };
        signal?.addEventListener("abort", onAbort, { once: true });
    });
}
