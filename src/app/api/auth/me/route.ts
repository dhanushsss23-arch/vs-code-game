import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { logError } from "@/lib/logger";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ user: null }, { status: 401 });
    return NextResponse.json({ user });
  } catch (error) {
    logError("auth.session.read_failed", error);
    return NextResponse.json({ error: "Session lookup is temporarily unavailable." }, { status: 500 });
  }
}
