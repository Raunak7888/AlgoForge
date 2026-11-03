import { isPrimitive, type Parsed } from "../core/validate";
import type { Primitive } from "./types";

// Shared validators live in core/validate.ts; re-exported so existing imports keep working.
export { HEX_RE, InputError, isPrimitive, parseInteger, parseOptionalInteger, parseValue, val, type Parsed } from "../core/validate";

export const MAX_ITEMS = 24;

export function parseArrayJson(text: string): Parsed<Primitive[]> {
  let v: unknown;
  try {
    v = JSON.parse(text); // never eval / Function
  } catch {
    return { ok: false, error: 'Invalid JSON. Example: [10, 20, null, "hello"]' };
  }
  if (!Array.isArray(v)) return { ok: false, error: "The value must be a JSON array." };
  if (v.length > MAX_ITEMS) return { ok: false, error: `At most ${MAX_ITEMS} cells are supported.` };
  if (!v.every(isPrimitive)) return { ok: false, error: "Items must be strings, numbers, booleans or null." };
  return { ok: true, value: v };
}
