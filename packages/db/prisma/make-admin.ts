/* Promotes an existing user to ADMIN.
   Usage: pnpm db:make-admin <email>
   The user must have signed in with Google at least once so the account exists. */
import { prisma, Role } from "../src/index";

async function main(): Promise<void> {
  const email = process.argv
    .slice(2)
    .find((arg) => arg !== "--")
    ?.trim()
    .toLowerCase();

  if (!email || !email.includes("@")) {
    console.error("Usage: pnpm db:make-admin <email>");
    process.exitCode = 1;
    return;
  }

  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true, email: true, role: true },
  });

  if (!user) {
    console.error(`No user with email ${email}. The user must sign in with Google once first.`);
    process.exitCode = 1;
    return;
  }

  if (user.role === Role.ADMIN) {
    console.log(`${user.email} is already an ADMIN. Nothing changed.`);
    return;
  }

  await prisma.user.update({ where: { id: user.id }, data: { role: Role.ADMIN } });
  console.log(`${user.email} is now an ADMIN.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
