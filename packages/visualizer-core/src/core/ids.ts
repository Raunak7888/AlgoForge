/**
 * Element ids on the shared canvas are namespaced by instance: "A:e1".
 * Two arrays both own an "e1" internally; the canvas never sees a collision.
 */
const SEP = ":";

export const nsId = (instance: string, id: string): string => `${instance}${SEP}${id}`;

export function splitNsId(ns: string): { instance: string; id: string } {
    const i = ns.indexOf(SEP);
    return i < 0 ? { instance: "", id: ns } : { instance: ns.slice(0, i), id: ns.slice(i + 1) };
}

/** Valid instance ids: a letter, then letters, digits, _ or -. No ":" so namespacing stays unambiguous. */
export const INSTANCE_ID_RE = /^[A-Za-z][A-Za-z0-9_-]{0,15}$/;
