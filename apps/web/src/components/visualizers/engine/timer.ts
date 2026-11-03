/**
 * A pausable timer whose length is in "authored" milliseconds: at 2x speed it fires in half the time.
 * Used to keep a frame on screen long enough to read its message.
 */
export class Timer {
    readonly done: Promise<void>;
    private resolve!: () => void;
    private remaining: number;
    private speed: number;
    private startedAt = 0;
    private handle: ReturnType<typeof setTimeout> | null = null;
    private paused = false;
    private finished = false;

    constructor(ms: number, speed = 1) {
        this.remaining = Math.max(0, ms);
        this.speed = speed > 0 ? speed : 1;
        this.done = new Promise<void>((r) => (this.resolve = r));
    }

    start(): void {
        if (!this.paused) this.arm();
    }

    pause(): void {
        if (this.finished || this.paused) return;
        this.paused = true;
        this.settleElapsed();
    }

    resume(): void {
        if (this.finished || !this.paused) return;
        this.paused = false;
        this.arm();
    }

    setSpeed(x: number): void {
        if (!(x > 0) || x === this.speed) return;
        const running = !this.paused && this.handle !== null;
        if (running) this.settleElapsed();
        this.speed = x;
        if (running) this.arm();
    }

    cancel(): void {
        this.finished = true;
        this.clear();
        this.resolve();
    }

    private arm(): void {
        if (this.finished) return;
        this.clear();
        if (this.remaining <= 0) return this.finish();
        this.startedAt = Date.now();
        this.handle = setTimeout(() => this.finish(), this.remaining / this.speed);
    }

    /** Fold the time already spent into `remaining` and stop the clock. */
    private settleElapsed(): void {
        if (this.handle === null) return;
        this.remaining = Math.max(0, this.remaining - (Date.now() - this.startedAt) * this.speed);
        this.clear();
    }

    private clear(): void {
        if (this.handle !== null) clearTimeout(this.handle);
        this.handle = null;
    }

    private finish(): void {
        if (this.finished) return;
        this.finished = true;
        this.clear();
        this.resolve();
    }
}
