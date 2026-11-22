import { NextRequest, NextResponse } from "next/server";
import { isSameOrigin } from "@/lib/auth/request";
import { destroySession } from "@/lib/auth/session";
import { logError } from "@/lib/logger";

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  try {
    await destroySession();
    return NextResponse.json({ ok: true });
  } catch (error) {
    logError("auth.logout.failed", error);
    return NextResponse.json({ error: "Logout is temporarily unavailable." }, { status: 500 });
  }
}
