import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { isSameOrigin } from "@/lib/auth/request";
import { logError } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

const preferenceSchema = z.object({ preferredLocale: z.enum(["EN", "TA"]) });

export async function PATCH(request: NextRequest) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const parsed = preferenceSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Choose English or Tamil." }, { status: 400 });

  try {
    await prisma.user.update({
      where: { id: user.id },
      data: { preferredLocale: parsed.data.preferredLocale },
    });
    const response = NextResponse.json({ preferredLocale: parsed.data.preferredLocale });
    response.cookies.set("eduverse_locale", parsed.data.preferredLocale === "TA" ? "ta" : "en", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
    return response;
  } catch (error) {
    logError("auth.preference.update_failed", error, { userId: user.id });
    return NextResponse.json({ error: "Unable to update your language right now." }, { status: 500 });
  }
}
