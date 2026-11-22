import { NextRequest, NextResponse } from "next/server";
import { CoinTransactionType, SessionStatus } from "@prisma/client";
import { z } from "zod";
import { getCurrentStudent } from "@/lib/auth/identity";
import { isSameOrigin } from "@/lib/auth/request";
import { logError } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ sessionId: string }> };
const answerSchema = z.object({
  questionInstanceId: z.string().min(1),
  selectedOptionId: z.string().min(1),
  elapsedMilliseconds: z.number().int().min(0).max(600_000).optional(),
});

export async function POST(request: NextRequest, context: RouteContext) {
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
  const parsed = answerSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Choose one of the available answers." }, { status: 400 });
  const { sessionId } = await context.params;

  try {
    const result = await prisma.$transaction(async (transaction) => {
      const sessionQuestion = await transaction.quizSessionQuestion.findFirst({
        where: {
          id: parsed.data.questionInstanceId,
          sessionId,
          session: { studentId: identity.studentId, status: SessionStatus.IN_PROGRESS },
        },
        select: {
          id: true,
          attempt: { select: { id: true } },
          session: { select: { id: true } },
          question: {
            select: {
              id: true,
              topicId: true,
              points: true,
              translations: {
                where: { locale: identity.user.preferredLocale },
                take: 1,
                select: { explanation: true },
              },
              options: { select: { id: true, isCorrect: true } },
            },
          },
        },
      });
      if (!sessionQuestion) return { error: "Quiz session is no longer active.", status: 409 as const };
      if (sessionQuestion.attempt) return { error: "This question has already been answered.", status: 409 as const };

      const selectedOption = sessionQuestion.question.options.find((item) => item.id === parsed.data.selectedOptionId);
      if (!selectedOption) return { error: "That answer does not belong to this question.", status: 400 as const };

      const student = await transaction.studentProfile.findUnique({
        where: { id: identity.studentId },
        select: { xp: true, level: true, currentStreak: true, longestStreak: true, lastActiveDate: true },
      });
      if (!student) return { error: "Student profile not found.", status: 404 as const };

      const isCorrect = selectedOption.isCorrect;
      let awardedXp = 0;
      let earnedCoins = 0;
      if (isCorrect) {
        const walletBeforeReward = await transaction.wallet.findUnique({
          where: { studentId: identity.studentId },
          select: { id: true, balance: true },
        });
        if (!walletBeforeReward) return { error: "Wallet not found.", status: 409 as const };

        const idempotencyKey = `first-correct:${sessionQuestion.question.id}`;
        const rewardClaim = await transaction.coinTransaction.createMany({
          data: [{
            walletId: walletBeforeReward.id,
            type: CoinTransactionType.QUESTION_REWARD,
            amount: 1,
            balanceAfter: walletBeforeReward.balance,
            idempotencyKey,
            reference: sessionQuestion.question.id,
          }],
          skipDuplicates: true,
        });
        if (rewardClaim.count === 1) {
          const wallet = await transaction.wallet.update({
            where: { id: walletBeforeReward.id },
            data: { balance: { increment: 1 } },
            select: { balance: true },
          });
          await transaction.coinTransaction.update({
            where: { walletId_idempotencyKey: { walletId: walletBeforeReward.id, idempotencyKey } },
            data: { balanceAfter: wallet.balance },
          });
          earnedCoins = 1;
          awardedXp = sessionQuestion.question.points;

          const profileAfterXp = await transaction.studentProfile.update({
            where: { id: identity.studentId },
            data: { xp: { increment: awardedXp } },
            select: { xp: true },
          });
          await transaction.studentProfile.update({
            where: { id: identity.studentId },
            data: { level: Math.floor(profileAfterXp.xp / 100) + 1 },
          });
        }
      }

      const attempt = await transaction.answerAttempt.create({
        data: {
          sessionQuestionId: sessionQuestion.id,
          selectedOptionId: selectedOption.id,
          isCorrect,
          awardedXp,
          elapsedMilliseconds: parsed.data.elapsedMilliseconds,
        },
        select: { id: true },
      });

      const now = new Date();
      const todayKey = now.toISOString().slice(0, 10);
      const lastActiveKey = student.lastActiveDate?.toISOString().slice(0, 10);
      if (lastActiveKey !== todayKey) {
        const yesterday = new Date(now);
        yesterday.setUTCDate(yesterday.getUTCDate() - 1);
        const nextStreak = lastActiveKey === yesterday.toISOString().slice(0, 10) ? student.currentStreak + 1 : 1;
        await transaction.studentProfile.updateMany({
          where: { id: identity.studentId, lastActiveDate: student.lastActiveDate },
          data: {
            currentStreak: nextStreak,
            longestStreak: Math.max(student.longestStreak, nextStreak),
            lastActiveDate: new Date(`${todayKey}T00:00:00.000Z`),
          },
        });
      }

      const progress = await transaction.studentProgress.upsert({
        where: {
          studentId_topicId: { studentId: identity.studentId, topicId: sessionQuestion.question.topicId },
        },
        create: {
          studentId: identity.studentId,
          topicId: sessionQuestion.question.topicId,
          xp: awardedXp,
          questionsAnswered: 1,
          correctAnswers: isCorrect ? 1 : 0,
          mastery: isCorrect ? 1 : 0,
        },
        update: {
          xp: { increment: awardedXp },
          questionsAnswered: { increment: 1 },
          correctAnswers: { increment: isCorrect ? 1 : 0 },
        },
        select: { id: true, questionsAnswered: true, correctAnswers: true },
      });
      await transaction.studentProgress.update({
        where: { id: progress.id },
        data: { mastery: progress.correctAnswers / progress.questionsAnswered },
      });

      if (isCorrect) {
        await transaction.quizSession.update({
          where: { id: sessionId },
          data: { score: { increment: sessionQuestion.question.points } },
        });
      }
      const totalQuestions = await transaction.quizSessionQuestion.count({ where: { sessionId } });
      const answeredQuestions = await transaction.answerAttempt.count({
        where: { sessionQuestion: { is: { sessionId } } },
      });
      const completed = answeredQuestions === totalQuestions;
      if (completed) {
        await transaction.quizSession.update({
          where: { id: sessionId },
          data: { status: SessionStatus.COMPLETED, completedAt: new Date() },
        });
      }

      const wallet = await transaction.wallet.findUnique({
        where: { studentId: identity.studentId },
        select: { balance: true },
      });
      return {
        isCorrect,
        explanation: sessionQuestion.question.translations[0]?.explanation ?? null,
        awardedXp,
        earnedCoins,
        coinBalance: wallet?.balance ?? 0,
        completed,
        answeredQuestions,
        totalQuestions,
      };
    });

    if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "This answer was already submitted." }, { status: 409 });
    }
    logError("quiz.answer.failed", error, { studentId: identity.studentId, sessionId });
    return NextResponse.json({ error: "Unable to save this answer." }, { status: 500 });
  }
}
