/* Re-runs the Phase 5 backfill. Idempotent. Usage: pnpm db:backfill:phase5
   Run it again right before the Phase 8 / Phase 9 cutovers to pick up rows written since the migration. */
import { readFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "../src/index";

async function main(): Promise<void> {
  const file = path.resolve(__dirname, "backfills/phase5_backfill.sql");
  await prisma.$executeRawUnsafe(readFileSync(file, "utf8"));
  console.log("Phase 5 backfill finished (safe to run again).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
