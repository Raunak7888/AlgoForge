/** Every date leaves the API as an ISO 8601 UTC string. Cached rows already hold strings, so both are accepted. */
export function toIso(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new RangeError("Invalid date value.");
  return date.toISOString();
}
