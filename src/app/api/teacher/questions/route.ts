import { NextRequest, NextResponse } from "next/server";
import { Difficulty, Locale, QuestionStatus } from "@prisma/client";
import { z } from "zod";
import { getCurrentUserWithRole } from "@/lib/auth/identity";
import { isSameOrigin } from "@/lib/auth/request";
import { logError } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

const translationSchema = z.object({
  locale: z.nativeEnum(Locale),
  prompt: z.string().trim().min(3).max(2000),
  explanation: z.string().trim().max(2000).optional(),
  hint: z.string().trim().max(500).optional(),
});
const optionSchema = z.object({
  isCorrect: z.boolean(),
  translations: z.array(z.object({
    locale: z.nativeEnum(Locale),
    text: z.string().trim().min(1).max(500),
  })).length(2),
});
const questionSchema = z.object({
  topicId: z.string().min(1),
  difficulty: z.nativeEnum(Difficulty),
  points: z.number().int().min(1).max(100),
  translations: z.array(translationSchema).length(2),
  options: z.array(optionSchema).min(2).max(6),
}).superRefine((question, context) => {
  if (new Set(question.translations.map(({ locale }) => locale)).size !== 2) {
    context.addIssue({ code: "custom", path: ["translations"], message: "Add one translation per language." });
  }
  if (question.translations.some((translation) => !translation.explanation)) {
    context.addIssue({ code: "custom", path: ["translations"], message: "Add explanations in both languages." });
  }
  if (question.options.filter(({ isCorrect }) => isCorrect).length !== 1) {
    context.addIssue({ code: "custom", path: ["options"], message: "Mark exactly one correct option." });
  }
  for (const option of question.options) {
    if (new Set(option.translations.map(({ locale }) => locale)).size !== 2) {
      context.addIssue({ code: "custom", path: ["options"], message: "Add both languages for every option." });
      break;
    }
  }
});

export async function GET() {
  const user = await getCurrentUserWithRole("TEACHER");
  if (!user) return NextResponse.json({ error: "Teacher access is required." }, { status: 403 });

  try {
    const questions = await prisma.question.findMany({
      where: user.roles.includes("ADMIN") ? undefined : { authorId: user.id },
      orderBy: { updatedAt: "desc" },
      take: 100,
      select: {
        id: true,
        difficulty: true,
        status: true,
        points: true,
        updatedAt: true,
        topic: { select: { name: true, subject: { select: { name: true } } } },
        translations: { select: { locale: true, prompt: true } },
      },
    });
    return NextResponse.json({ questions });
  } catch (error) {
    logError("teacher.questions.read_failed", error, { userId: user.id });
    return NextResponse.json({ error: "Unable to load questions." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  const user = await getCurrentUserWithRole("TEACHER");
  if (!user) return NextResponse.json({ error: "Teacher access is required." }, { status: 403 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const parsed = questionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Complete both languages and mark one correct answer." }, { status: 400 });

  try {
    const topic = await prisma.topic.findUnique({ where: { id: parsed.data.topicId }, select: { id: true } });
    if (!topic) return NextResponse.json({ error: "Choose an existing topic." }, { status: 400 });

    const question = await prisma.question.create({
      data: {
        topicId: topic.id,
        authorId: user.id,
        difficulty: parsed.data.difficulty,
        points: parsed.data.points,
        status: user.roles.includes("ADMIN") ? QuestionStatus.PUBLISHED : QuestionStatus.REVIEW,
        translations: {
          create: parsed.data.translations.map((translation) => ({
            ...translation,
            explanation: translation.explanation ?? "",
          })),
        },
        options: {
          create: parsed.data.options.map((option, sortOrder) => ({
            isCorrect: option.isCorrect,
            sortOrder,
            translations: { create: option.translations },
          })),
        },
      },
      select: { id: true, status: true },
    });
    return NextResponse.json({ question }, { status: 201 });
  } catch (error) {
    logError("teacher.question.create_failed", error, { userId: user.id });
    return NextResponse.json({ error: "Unable to save this question." }, { status: 500 });
  }
}
