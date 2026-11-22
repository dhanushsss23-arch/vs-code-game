import { NextRequest, NextResponse } from "next/server";
import { Locale } from "@prisma/client";
import { getCurrentStudent } from "@/lib/auth/identity";
import { logError } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ sessionId: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const identity = await getCurrentStudent();
  if (!identity) return NextResponse.json({ error: "Sign in as a student to play." }, { status: 401 });
  const { sessionId } = await context.params;

  try {
    const session = await prisma.quizSession.findFirst({
      where: { id: sessionId, studentId: identity.studentId },
      select: {
        id: true,
        status: true,
        score: true,
        questions: {
          orderBy: { position: "asc" },
          select: {
            id: true,
            attempt: { select: { isCorrect: true, awardedXp: true } },
            question: {
              select: {
                points: true,
                translations: {
                  where: { locale: identity.user.preferredLocale as Locale },
                  take: 1,
                  select: { prompt: true, explanation: true, hint: true },
                },
                options: {
                  orderBy: { sortOrder: "asc" },
                  select: {
                    id: true,
                    translations: {
                      where: { locale: identity.user.preferredLocale as Locale },
                      take: 1,
                      select: { text: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!session) return NextResponse.json({ error: "Quiz session not found." }, { status: 404 });

    const next = session.questions.find((item) => !item.attempt);
    return NextResponse.json({
      session: { id: session.id, status: session.status, score: session.score },
      totalQuestions: session.questions.length,
      answeredQuestions: session.questions.filter((item) => item.attempt).length,
      question: next
        ? {
            id: next.id,
            points: next.question.points,
            prompt: next.question.translations[0]?.prompt ?? "",
            hint: next.question.translations[0]?.hint ?? null,
            options: next.question.options.map((option) => ({
              id: option.id,
              text: option.translations[0]?.text ?? "",
            })),
          }
        : null,
    });
  } catch (error) {
    logError("quiz.read.failed", error, { studentId: identity.studentId, sessionId });
    return NextResponse.json({ error: "Unable to load this quiz." }, { status: 500 });
  }
}
