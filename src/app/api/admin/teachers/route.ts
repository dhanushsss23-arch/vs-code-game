import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserWithRole } from "@/lib/auth/identity";
import { isSameOrigin } from "@/lib/auth/request";
import { logError } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

const teacherSchema = z.object({ email: z.string().trim().email().max(254) });

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const actor = await getCurrentUserWithRole("ADMIN");
  if (!actor || !actor.roles.includes("ADMIN")) {
    return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const parsed = teacherSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid account email." }, { status: 400 });

  try {
    const target = await prisma.user.findUnique({
      where: { email: parsed.data.email.toLowerCase() },
      select: { id: true, email: true, displayName: true },
    });
    if (!target) return NextResponse.json({ error: "Create the account before granting teacher access." }, { status: 404 });

    await prisma.$transaction(async (transaction) => {
      const role = await transaction.role.upsert({
        where: { name: "TEACHER" },
        create: { name: "TEACHER", description: "Teacher account" },
        update: {},
        select: { id: true },
      });
      await transaction.userRole.upsert({
        where: { userId_roleId: { userId: target.id, roleId: role.id } },
        create: { userId: target.id, roleId: role.id },
        update: {},
      });
      await transaction.teacherProfile.upsert({
        where: { userId: target.id },
        create: { userId: target.id },
        update: {},
      });
      await transaction.auditLog.create({
        data: { actorId: actor.id, action: "teacher.granted", entityType: "User", entityId: target.id },
      });
    });
    return NextResponse.json({ user: target });
  } catch (error) {
    logError("admin.teacher.grant_failed", error, { actorId: actor.id });
    return NextResponse.json({ error: "Unable to grant teacher access." }, { status: 500 });
  }
}
