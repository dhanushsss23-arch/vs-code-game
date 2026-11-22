import { PrismaClient } from "@prisma/client";

const email = process.argv[2]?.trim().toLowerCase();
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error("Usage: npm run admin:promote -- existing-user@example.com");
  process.exitCode = 1;
} else {
  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true },
    });
    if (!user) {
      throw new Error("No existing user has that email. Register the account before granting admin access.");
    }

    await prisma.$transaction(async (transaction) => {
      const role = await transaction.role.upsert({
        where: { name: "ADMIN" },
        create: { name: "ADMIN", description: "Platform administrator" },
        update: {},
        select: { id: true },
      });
      await transaction.userRole.upsert({
        where: { userId_roleId: { userId: user.id, roleId: role.id } },
        create: { userId: user.id, roleId: role.id },
        update: {},
      });
      await transaction.auditLog.create({
        data: {
          action: "admin.granted",
          entityType: "User",
          entityId: user.id,
          metadata: { provisionedBy: "local-cli" },
        },
      });
    });
    console.log(`Administrator access granted to ${user.email}.`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Unable to grant administrator access.");
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}
