import { NextRequest, NextResponse } from "next/server";
import { SessionStatus } from "@prisma/client";
import { z } from "zod";
import { getCurrentStudent } from "@/lib/auth/identity";
import { logError } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

const periodSchema = z.enum(["ALL_TIME", "DAILY", "WEEKLY"]);

export async function GET(request: NextRequest) {
  const identity = await getCurrentStudent();
  if (!identity) return NextResponse.json({ error: "Sign in as a student to view rankings." }, { status: 401 });
  const parsed = periodSchema.safeParse(request.nextUrl.searchParams.get("period") ?? "WEEKLY");
  if (!parsed.success) return NextResponse.json({ error: "Choose a valid leaderboard period." }, { status: 400 });

  try {
    if (parsed.data === "ALL_TIME") {
      const students = await prisma.studentProfile.findMany({
        where: { user: { status: "ACTIVE" } },
        orderBy: [{ xp: "desc" }, { id: "asc" }],
        take: 10,
        select: { id: true, xp: true, user: { select: { displayName: true } } },
      });
      return NextResponse.json({
        entries: students.map((student, index) => ({
          studentId: student.id,
          displayName: student.user.displayName,
          score: student.xp,
          rank: index + 1,
          isCurrentStudent: student.id === identity.studentId,
        })),
      });
    }

    const now = new Date();
    const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    if (parsed.data === "WEEKLY") {
      const daysSinceMonday = (periodStart.getUTCDay() + 6) % 7;
      periodStart.setUTCDate(periodStart.getUTCDate() - daysSinceMonday);
    }
    const scores = await prisma.quizSession.groupBy({
      by: ["studentId"],
      where: {
        status: SessionStatus.COMPLETED,
        completedAt: { gte: periodStart },
        student: { user: { status: "ACTIVE" } },
      },
      _sum: { score: true },
      orderBy: { _sum: { score: "desc" } },
      take: 10,
    });
    const profiles = await prisma.studentProfile.findMany({
      where: { id: { in: scores.map((entry) => entry.studentId) } },
      select: { id: true, user: { select: { displayName: true } } },
    });
    const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
    return NextResponse.json({
      entries: scores.flatMap((entry, index) => {
        const profile = profileById.get(entry.studentId);
        if (!profile) return [];
        return [{
          studentId: profile.id,
          displayName: profile.user.displayName,
          score: entry._sum.score ?? 0,
          rank: index + 1,
          isCurrentStudent: profile.id === identity.studentId,
        }];
      }),
    });
  } catch (error) {
    logError("leaderboard.read_failed", error, { studentId: identity.studentId, period: parsed.data });
    return NextResponse.json({ error: "Unable to load the leaderboard." }, { status: 500 });
  }
}
