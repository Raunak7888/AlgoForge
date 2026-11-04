import type { Diagnostic } from "../core/types";

/**
 * A strict JSON parser that remembers where everything is, so errors can point at the exact
 * line and column. Hand-written on purpose: it never evaluates anything and never throws.
 */

export interface Span {
    start: number;
    end: number;
}
export interface JProp {
    key: string;
    keySpan: Span;
    value: JNode;
}
export type JObject = { kind: "object"; span: Span; props: JProp[] };
export type JArray = { kind: "array"; span: Span; items: JNode[] };
export type JNode =
    | JObject
    | JArray
    | { kind: "string"; span: Span; value: string }
    | { kind: "number"; span: Span; value: number }
    | { kind: "boolean"; span: Span; value: boolean }
    | { kind: "null"; span: Span };

export type ParseResult = { ok: true; root: JNode } | { ok: false; message: string; span: Span };

const MAX_DEPTH = 64;
const WS = new Set([" ", "\t", "\n", "\r"]);

/** Defines an own property. Unlike `o[key] = v`, a key such as "__proto__" cannot change the prototype. */
export function setOwn(o: object, key: string, value: unknown): void {
    Object.defineProperty(o, key, { value, enumerable: true, writable: true, configurable: true });
}

/** Plain JS value of a node (same shape JSON.parse would give). */
export function toValue(n: JNode): unknown {
    switch (n.kind) {
        case "object": {
            const o: Record<string, unknown> = {};
            for (const p of n.props) setOwn(o, p.key, toValue(p.value));
            return o;
        }
        case "array":
            return n.items.map(toValue);
        case "null":
            return null;
        default:
            return n.value;
    }
}

class Fail extends Error {
    constructor(
        message: string,
        readonly span: Span,
    ) {
        super(message);
    }
}

class Parser {
    private i = 0;
    constructor(private readonly t: string) {}

    run(): JNode {
        this.ws();
        if (this.i >= this.t.length) this.fail("The script is empty. Expected a JSON array of steps.");
        const v = this.value(0);
        this.ws();
        if (this.i < this.t.length) this.fail("Unexpected content after the end of the script.");
        return v;
    }

    private fail(message: string, at = this.i, len = 1): never {
        const start = Math.min(at, this.t.length);
        throw new Fail(message, { start, end: Math.min(this.t.length, start + Math.max(1, len)) });
    }
    private ws() {
        while (this.i < this.t.length && WS.has(this.t[this.i])) this.i++;
    }
    private peek(): string {
        return this.t[this.i] ?? "";
    }

    private value(depth: number): JNode {
        if (depth > MAX_DEPTH) this.fail("This is nested too deeply.");
        const c = this.peek();
        if (c === "{") return this.object(depth);
        if (c === "[") return this.array(depth);
        if (c === '"') {
            const start = this.i;
            const value = this.string();
            return { kind: "string", span: { start, end: this.i }, value };
        }
        if (c === "-" || (c >= "0" && c <= "9")) return this.number();
        for (const [word, node] of [
            ["true", true],
            ["false", false],
            ["null", null],
        ] as const) {
            if (this.t.startsWith(word, this.i)) {
                const start = this.i;
                this.i += word.length;
                const span = { start, end: this.i };
                return node === null ? { kind: "null", span } : { kind: "boolean", span, value: node };
            }
        }
        return this.fail(c === "" ? "Unexpected end of the script. A value is missing." : `Unexpected "${c}". Expected a value.`);
    }

    private object(depth: number): JNode {
        const start = this.i++;
        const props: JProp[] = [];
        this.ws();
        if (this.peek() === "}") {
            this.i++;
            return { kind: "object", span: { start, end: this.i }, props };
        }
        for (;;) {
            this.ws();
            if (this.peek() !== '"') this.fail(this.peek() === "}" ? "A trailing comma is not allowed in JSON." : "Expected a property name in double quotes.");
            const ks = this.i;
            const key = this.string();
            const keySpan = { start: ks, end: this.i };
            this.ws();
            if (this.peek() !== ":") this.fail(`Expected ":" after the property name.`);
            this.i++;
            this.ws();
            props.push({ key, keySpan, value: this.value(depth + 1) });
            this.ws();
            const c = this.peek();
            if (c === ",") {
                this.i++;
                continue;
            }
            if (c === "}") {
                this.i++;
                return { kind: "object", span: { start, end: this.i }, props };
            }
            this.fail(c === "" ? 'Unexpected end of the script. Expected "}".' : `Expected "," or "}" after the value.`);
        }
    }

    private array(depth: number): JNode {
        const start = this.i++;
        const items: JNode[] = [];
        this.ws();
        if (this.peek() === "]") {
            this.i++;
            return { kind: "array", span: { start, end: this.i }, items };
        }
        for (;;) {
            this.ws();
            if (this.peek() === "]") this.fail("A trailing comma is not allowed in JSON.");
            items.push(this.value(depth + 1));
            this.ws();
            const c = this.peek();
            if (c === ",") {
                this.i++;
                continue;
            }
            if (c === "]") {
                this.i++;
                return { kind: "array", span: { start, end: this.i }, items };
            }
            this.fail(c === "" ? 'Unexpected end of the script. Expected "]".' : `Expected "," or "]" after the item.`);
        }
    }

    private string(): string {
        const start = this.i++;
        let out = "";
        for (;;) {
            if (this.i >= this.t.length) this.fail("This string is never closed.", start, this.t.length - start);
            const c = this.t[this.i];
            if (c === '"') {
                this.i++;
                return out;
            }
            if (c < " ") this.fail("A line break or control character inside a string must be written as \\n or \\uXXXX.");
            if (c !== "\\") {
                out += c;
                this.i++;
                continue;
            }
            const e = this.t[this.i + 1];
            const simple: Record<string, string> = { '"': '"', "\\": "\\", "/": "/", b: "\b", f: "\f", n: "\n", r: "\r", t: "\t" };
            if (e in simple) {
                out += simple[e];
                this.i += 2;
            } else if (e === "u") {
                const hex = this.t.slice(this.i + 2, this.i + 6);
                if (!/^[0-9a-fA-F]{4}$/.test(hex)) this.fail("A \\u escape needs 4 hex digits.", this.i, 2);
                out += String.fromCharCode(parseInt(hex, 16));
                this.i += 6;
            } else {
                this.fail(`Unknown escape "\\${e ?? ""}".`, this.i, 2);
            }
        }
    }

    private number(): JNode {
        const start = this.i;
        const m = /^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?/.exec(this.t.slice(this.i));
        if (!m) this.fail("This is not a valid number.", start);
        this.i += m[0].length;
        const value = Number(m[0]);
        if (!Number.isFinite(value)) this.fail("This number is too large.", start, m[0].length);
        return { kind: "number", span: { start, end: this.i }, value };
    }
}

export function parseJson(text: string): ParseResult {
    try {
        return { ok: true, root: new Parser(text).run() };
    } catch (e) {
        if (e instanceof Fail) return { ok: false, message: e.message, span: e.span };
        throw e;
    }
}

/** Offset -> 1-based line and column. */
export class LineIndex {
    private readonly starts: number[] = [0];
    constructor(private readonly text: string) {
        for (let i = 0; i < text.length; i++) if (text[i] === "\n") this.starts.push(i + 1);
    }
    pos(offset: number): { line: number; column: number } {
        const o = Math.max(0, Math.min(offset, this.text.length));
        let lo = 0;
        let hi = this.starts.length - 1;
        while (lo < hi) {
            const mid = (lo + hi + 1) >> 1;
            if (this.starts[mid] <= o) lo = mid;
            else hi = mid - 1;
        }
        return { line: lo + 1, column: o - this.starts[lo] + 1 };
    }
    diagnostic(span: Span, severity: Diagnostic["severity"], message: string, fix?: Diagnostic["fix"]): Diagnostic {
        const a = this.pos(span.start);
        const b = this.pos(span.end);
        return { severity, message, line: a.line, column: a.column, endLine: b.line, endColumn: b.column, ...(fix ? { fix } : {}) };
    }
}
