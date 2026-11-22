import { NextRequest, NextResponse } from "next/server";
import { QuestionStatus } from "@prisma/client";
import { getCurrentUserWithRole } from "@/lib/auth/identity";
import { isSameOrigin } from "@/lib/auth/request";
import { logError } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ questionId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const user = await getCurrentUserWithRole("ADMIN");
  if (!user || !user.roles.includes("ADMIN")) {
    return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
  }
  const { questionId } = await context.params;

  try {
    const question = await prisma.question.findUnique({
      where: { id: questionId },
      select: { id: true, status: true, translations: { select: { locale: true } }, options: { select: { isCorrect: true, translations: { select: { locale: true } } } } },
    });
    if (!question) return NextResponse.json({ error: "Question not found." }, { status: 404 });
    const locales = new Set(question.translations.map(({ locale }) => locale));
    const complete = locales.size === 2 &&
      question.options.length >= 2 &&
      question.options.filter(({ isCorrect }) => isCorrect).length === 1 &&
      question.options.every((option) => new Set(option.translations.map(({ locale }) => locale)).size === 2);
    if (!complete) return NextResponse.json({ error: "Question needs complete Tamil and English content before publishing." }, { status: 409 });

    const updated = await prisma.$transaction(async (transaction) => {
      const published = await transaction.question.update({
        where: { id: questionId },
        data: { status: QuestionStatus.PUBLISHED },
        select: { id: true, status: true },
      });
      await transaction.auditLog.create({
        data: { actorId: user.id, action: "question.published", entityType: "Question", entityId: questionId },
      });
      return published;
    });
    return NextResponse.json({ question: updated });
  } catch (error) {
    logError("admin.question.publish_failed", error, { userId: user.id, questionId });
    return NextResponse.json({ error: "Unable to publish this question." }, { status: 500 });
  }
}
