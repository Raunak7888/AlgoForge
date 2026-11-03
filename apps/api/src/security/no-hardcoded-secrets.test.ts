import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = resolve(__dirname, "..");

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
    else if (name.endsWith(".ts") && !name.endsWith(".test.ts")) out.push(full);
  }
  return out;
}

function offenders(pattern: RegExp): string[] {
  return sourceFiles(SRC).filter((f) => pattern.test(readFileSync(f, "utf8")));
}

describe("S-04: no hard-coded admin secret", () => {
  it("has no admin secret setting, header or default value anywhere in src", () => {
    expect(offenders(/adminUpgradeSecret|ADMIN_UPGRADE_SECRET|x-admin-secret|1d201bf1/i)).toEqual([]);
  });
});

describe("S-03: rate limiting never trusts X-Forwarded-For", () => {
  it("does not read the header in the rate limiter", () => {
    const limiter = readFileSync(join(SRC, "middleware", "rate-limit.ts"), "utf8");
    expect(limiter.toLowerCase()).not.toContain("x-forwarded-for");
    expect(limiter).toContain("req.ip");
  });
});
