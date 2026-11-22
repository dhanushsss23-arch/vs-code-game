import { NextRequest, NextResponse } from "next/server";
import { UserStatus } from "@prisma/client";
import { z } from "zod";
import { hashPassword } from "@/lib/auth/password";
import { getClientAddress, isSameOrigin } from "@/lib/auth/request";
import { consumeAuthAttempt } from "@/lib/auth/rate-limit";
import { createSession } from "@/lib/auth/session";
import { logError } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

const registrationSchema = z.object({
  email: z.string().trim().email().max(254),
  displayName: z.string().trim().min(2).max(64),
  password: z.string().min(12).max(128),
  preferredLocale: z.enum(["EN", "TA"]).default("EN"),
});

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const parsed = registrationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Please check your registration details." }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase();
  try {
    if (!(await consumeAuthAttempt(email, getClientAddress(request)))) {
      return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
    }

    const passwordHash = await hashPassword(parsed.data.password);
    const user = await prisma.$transaction(async (transaction) => {
      const created = await transaction.user.create({
        data: {
          email,
          passwordHash,
          displayName: parsed.data.displayName,
          status: UserStatus.ACTIVE,
          preferredLocale: parsed.data.preferredLocale,
          studentProfile: { create: { wallet: { create: {} } } },
        },
        select: { id: true, email: true, displayName: true },
      });

      const studentRole = await transaction.role.upsert({
        where: { name: "STUDENT" },
        create: { name: "STUDENT", description: "Student account" },
        update: {},
        select: { id: true },
      });
      await transaction.userRole.create({ data: { userId: created.id, roleId: studentRole.id } });
      return created;
    });

    await createSession(user.id);
    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "Unable to create an account with those details." }, { status: 409 });
    }
    logError("auth.register.failed", error);
    return NextResponse.json({ error: "Registration is temporarily unavailable." }, { status: 500 });
  }
}
