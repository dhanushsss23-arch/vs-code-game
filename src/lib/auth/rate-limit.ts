import { createHmac } from "node:crypto";
import { getSecret } from "@/lib/env";
import { prisma } from "@/lib/prisma";

const WINDOW_MILLISECONDS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;

async function consumeBucket(identifier: string): Promise<number> {
  const keyHash = createHmac("sha256", getSecret("AUTH_RATE_LIMIT_SECRET"))
    .update(identifier)
    .digest("hex");
  const windowStart = new Date(Math.floor(Date.now() / WINDOW_MILLISECONDS) * WINDOW_MILLISECONDS);

  const bucket = await prisma.authRateLimitBucket.upsert({
    where: { keyHash_windowStart: { keyHash, windowStart } },
    create: { keyHash, windowStart, attempts: 1 },
    update: { attempts: { increment: 1 } },
    select: { attempts: true },
  });
  return bucket.attempts;
}

export async function consumeAuthAttempt(email: string, clientAddress: string): Promise<boolean> {
  const normalizedEmail = email.trim().toLowerCase();
  const [emailAttempts, addressAttempts] = await Promise.all([
    consumeBucket(`email\0${normalizedEmail}`),
    consumeBucket(`address\0${clientAddress}`),
  ]);
  return emailAttempts <= MAX_ATTEMPTS && addressAttempts <= MAX_ATTEMPTS;
}
