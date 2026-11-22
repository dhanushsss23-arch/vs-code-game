import { NextResponse } from "next/server";
import { getCurrentUserWithRole } from "@/lib/auth/identity";
import { logError } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getCurrentUserWithRole("TEACHER");
  if (!user) return NextResponse.json({ error: "Teacher access is required." }, { status: 403 });

  try {
    const subjects = await prisma.subject.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        name: true,
        topics: { orderBy: { sortOrder: "asc" }, select: { id: true, name: true } },
      },
    });
    return NextResponse.json({ subjects });
  } catch (error) {
    logError("teacher.catalog.read_failed", error, { userId: user.id });
    return NextResponse.json({ error: "Unable to load the learning catalog." }, { status: 500 });
  }
}
