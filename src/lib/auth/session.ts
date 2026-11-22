import { createHmac, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { UserStatus } from "@prisma/client";
import { getSecret } from "@/lib/env";
import { prisma } from "@/lib/prisma";

const COOKIE_NAME = "eduverse_session";
const SESSION_LIFETIME_SECONDS = 60 * 60 * 24 * 14;

function hashToken(token: string): string {
  return createHmac("sha256", getSecret("SESSION_SECRET")).update(token).digest("hex");
}

export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_LIFETIME_SECONDS * 1000);

  await prisma.authSession.create({
    data: { userId, tokenHash: hashToken(token), expiresAt },
  });

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function getSessionUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await prisma.authSession.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      expiresAt: true,
      user: {
        select: {
          id: true,
          email: true,
          displayName: true,
          status: true,
          preferredLocale: true,
          roles: { select: { role: { select: { name: true } } } },
        },
      },
    },
  });

  if (!session || session.expiresAt <= new Date() || session.user.status !== UserStatus.ACTIVE) {
    return null;
  }

  return {
    ...session.user,
    roles: session.user.roles.map(({ role }) => role.name),
  };
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (token) {
    await prisma.authSession.deleteMany({ where: { tokenHash: hashToken(token) } });
  }
  cookieStore.delete(COOKIE_NAME);
}
