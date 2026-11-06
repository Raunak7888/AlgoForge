import { isPrimitive, parseValue, type Parsed } from "../core/validate";
import { MAX_EDGES, MAX_VERTICES } from "./model";
import type { InitEdge, InitSpec, Primitive } from "./types";

/** Everything is parsed with JSON.parse / Number (never eval / Function) and checked before any state is touched. */
export { parseValue, isPrimitive };

const ok = <T,>(value: T): Parsed<T> => ({ ok: true, value });
const fail = (error: string): Parsed<never> => ({ ok: false, error });

export const NAME_RE = /^[A-Za-z0-9_-]{1,12}$/;
export const MARKER_HELP = "Marker ids are 1-12 characters: letters, digits, _ or -.";
export const VERTEX_ID_HELP = "Vertex ids look like v1, v2, … (letters, digits, _ or -).";

export function parseWeight(text: string): Parsed<number> {
    const t = text.trim();
    if (t === "") return fail("A weight is required: a finite number such as 4 or -2.5.");
    const n = Number(t);
    return Number.isFinite(n) ? ok(n) : fail("A weight must be a finite number such as 4 or -2.5.");
}
export function parseCoord(text: string, label: string): Parsed<number> {
    const t = text.trim();
    const n = Number(t);
    return t !== "" && Number.isFinite(n) ? ok(n) : fail(`${label} must be a number.`);
}

const index = (v: unknown, where: string): Parsed<number> => (typeof v === "number" && Number.isInteger(v) && v >= 0 ? ok(v) : fail(`${where} must be a whole vertex index (0, 1, 2, …).`));

/**
 *  [ "A", "B", "C" ]                                    → vertices only
 *  { "vertices": ["A","B","C"], "edges": [[0,1],[1,2,5]] }   edge = [fromIndex, toIndex, weight?]  or  {"from":0,"to":1,"weight":5}
 */
export function parseInitial(text: string): Parsed<InitSpec> {
    let v: unknown;
    try {
        v = JSON.parse(text);
    } catch {
        return fail('Invalid JSON. Example: {"vertices": ["A","B","C"], "edges": [[0,1],[1,2,5]]}');
    }
    const checkVertices = (a: unknown): Parsed<Primitive[]> => {
        if (!Array.isArray(a)) return fail('"vertices" must be an array of strings, numbers, booleans or null.');
        if (a.length > MAX_VERTICES) return fail(`At most ${MAX_VERTICES} vertices are supported.`);
        return a.every(isPrimitive) ? ok(a as Primitive[]) : fail("Vertex values must be strings, numbers, booleans or null.");
    };
    if (Array.isArray(v)) {
        const vs = checkVertices(v);
        return vs.ok ? ok({ vertices: vs.value, edges: [] }) : vs;
    }
    if (v === null || typeof v !== "object") return fail("The input must be an array of vertex values or an object with vertices and edges.");
    const o = v as Record<string, unknown>;
    for (const k of Object.keys(o)) if (k !== "vertices" && k !== "edges") return fail(`Unknown key "${k}". Use "vertices" and "edges".`);
    const vs = checkVertices(o.vertices ?? []);
    if (!vs.ok) return vs;
    const raw = o.edges ?? [];
    if (!Array.isArray(raw)) return fail('"edges" must be an array.');
    if (raw.length > MAX_EDGES) return fail(`At most ${MAX_EDGES} edges are supported.`);
    const edges: InitEdge[] = [];
    for (let i = 0; i < raw.length; i++) {
        const r = raw[i];
        let from: unknown;
        let to: unknown;
        let weight: unknown;
        if (Array.isArray(r)) {
            if (r.length < 2 || r.length > 3) return fail(`edge ${i} must be [from, to] or [from, to, weight].`);
            [from, to, weight] = r;
        } else if (r && typeof r === "object") {
            const e = r as Record<string, unknown>;
            for (const k of Object.keys(e)) if (!["from", "to", "weight"].includes(k)) return fail(`edge ${i} has an unknown key "${k}".`);
            ({ from, to, weight } = e);
        } else return fail(`edge ${i} must be an array or an object.`);
        const a = index(from, `edge ${i} "from"`);
        if (!a.ok) return a;
        const b = index(to, `edge ${i} "to"`);
        if (!b.ok) return b;
        if (weight !== undefined && (typeof weight !== "number" || !Number.isFinite(weight))) return fail(`edge ${i} weight must be a finite number.`);
        edges.push({ from: a.value, to: b.value, ...(weight !== undefined ? { weight: weight as number } : {}) });
    }
    return ok({ vertices: vs.value, edges });
}
