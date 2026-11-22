import { getSessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export async function getCurrentStudent() {
  const user = await getSessionUser();
  if (!user || !user.roles.includes("STUDENT")) return null;

  const profile = await prisma.studentProfile.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });
  if (!profile) return null;

  return { user, studentId: profile.id };
}

export async function getCurrentUserWithRole(role: "TEACHER" | "ADMIN") {
  const user = await getSessionUser();
  if (!user || (!user.roles.includes(role) && !user.roles.includes("ADMIN"))) return null;
  return user;
}
