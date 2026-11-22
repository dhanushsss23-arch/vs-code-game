import { randomInt } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { Difficulty, Locale, QuestionStatus, SessionMode } from "@prisma/client";
import { z } from "zod";
import { getCurrentStudent } from "@/lib/auth/identity";
import { isSameOrigin } from "@/lib/auth/request";
import { logError } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

const startSchema = z.object({
  topicId: z.string().min(1),
  difficulty: z.nativeEnum(Difficulty),
});

function shuffle<T>(values: T[]): T[] {
  for (let index = values.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    [values[index], values[swapIndex]] = [values[swapIndex], values[index]];
  }
  return values;
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  const identity = await getCurrentStudent();
  if (!identity) return NextResponse.json({ error: "Sign in as a student to play." }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const parsed = startSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Choose a topic and difficulty." }, { status: 400 });

  try {
    const locale = identity.user.preferredLocale as Locale;
    const candidates = await prisma.question.findMany({
      where: {
        topicId: parsed.data.topicId,
        difficulty: parsed.data.difficulty,
        status: QuestionStatus.PUBLISHED,
        translations: { some: { locale } },
      },
      take: 100,
      select: {
        id: true,
        translations: { where: { locale }, take: 1, select: { id: true } },
        options: {
          orderBy: { sortOrder: "asc" },
          select: { id: true, isCorrect: true, translations: { where: { locale }, take: 1, select: { id: true } } },
        },
      },
    });
    const playable = candidates.filter(
      (question) =>
        question.translations.length === 1 &&
        question.options.length >= 2 &&
        question.options.every((option) => option.translations.length === 1) &&
        question.options.filter((option) => option.isCorrect).length === 1,
    );
    if (playable.length === 0) {
      return NextResponse.json({ error: "There are no complete questions for this topic and language yet." }, { status: 404 });
    }

    const selected = shuffle(playable).slice(0, Math.min(10, playable.length));
    const session = await prisma.quizSession.create({
      data: {
        studentId: identity.studentId,
        mode: SessionMode.PRACTICE,
        questions: {
          create: selected.map((question, position) => ({ questionId: question.id, position })),
        },
      },
      select: { id: true },
    });
    return NextResponse.json({ sessionId: session.id }, { status: 201 });
  } catch (error) {
    logError("quiz.start.failed", error, { studentId: identity.studentId });
    return NextResponse.json({ error: "Unable to start a quiz right now." }, { status: 500 });
  }
}
