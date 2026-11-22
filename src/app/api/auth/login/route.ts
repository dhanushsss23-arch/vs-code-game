import { NextRequest, NextResponse } from "next/server";
import { UserStatus } from "@prisma/client";
import { z } from "zod";
import { getClientAddress, isSameOrigin } from "@/lib/auth/request";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { consumeAuthAttempt } from "@/lib/auth/rate-limit";
import { createSession } from "@/lib/auth/session";
import { logError } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(128),
  preferredLocale: z.enum(["EN", "TA"]).optional(),
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
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 400 });
  }

  try {
    const email = parsed.data.email.toLowerCase();
    if (!(await consumeAuthAttempt(email, getClientAddress(request)))) {
      return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, displayName: true, passwordHash: true, status: true },
    });
    const validPassword = user
      ? await verifyPassword(user.passwordHash, parsed.data.password)
      : (await hashPassword(parsed.data.password), false);

    if (!user || !validPassword || user.status !== UserStatus.ACTIVE) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    if (parsed.data.preferredLocale) {
      await prisma.user.update({
        where: { id: user.id },
        data: { preferredLocale: parsed.data.preferredLocale },
      });
    }

    await createSession(user.id);
    return NextResponse.json({
      user: { id: user.id, email: user.email, displayName: user.displayName },
    });
  } catch (error) {
    logError("auth.login.failed", error);
    return NextResponse.json({ error: "Login is temporarily unavailable." }, { status: 500 });
  }
}
