import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserWithRole } from "@/lib/auth/identity";
import { isSameOrigin } from "@/lib/auth/request";
import { logError } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

const topicSchema = z.object({
  subjectName: z.string().trim().min(2).max(80),
  topicName: z.string().trim().min(2).max(100),
  description: z.string().trim().max(500).optional(),
});

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const user = await getCurrentUserWithRole("ADMIN");
  if (!user || !user.roles.includes("ADMIN")) {
    return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const parsed = topicSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid subject and topic name." }, { status: 400 });

  try {
    const result = await prisma.$transaction(async (transaction) => {
      const subject = await transaction.subject.upsert({
        where: { name: parsed.data.subjectName },
        create: { name: parsed.data.subjectName },
        update: {},
        select: { id: true },
      });
      const topic = await transaction.topic.create({
        data: {
          subjectId: subject.id,
          name: parsed.data.topicName,
          description: parsed.data.description,
        },
        select: { id: true, name: true },
      });
      await transaction.auditLog.create({
        data: {
          actorId: user.id,
          action: "topic.created",
          entityType: "Topic",
          entityId: topic.id,
        },
      });
      return topic;
    });
    return NextResponse.json({ topic: result }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "That topic already exists in this subject." }, { status: 409 });
    }
    logError("admin.topic.create_failed", error, { userId: user.id });
    return NextResponse.json({ error: "Unable to create the topic." }, { status: 500 });
  }
}
