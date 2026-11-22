import { NextRequest, NextResponse } from "next/server";
import { Locale, StoreItemKind } from "@prisma/client";
import { z } from "zod";
import { getCurrentUserWithRole } from "@/lib/auth/identity";
import { isSameOrigin } from "@/lib/auth/request";
import { logError } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

const itemSchema = z.object({
  sku: z.string().trim().regex(/^[A-Z0-9][A-Z0-9_-]{1,39}$/),
  kind: z.nativeEnum(StoreItemKind),
  priceCoins: z.coerce.number().int().min(1).max(100_000),
  nameEn: z.string().trim().min(2).max(80),
  descriptionEn: z.string().trim().max(300).optional(),
  nameTa: z.string().trim().min(2).max(80),
  descriptionTa: z.string().trim().max(300).optional(),
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
  const parsed = itemSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Complete both languages and enter a valid price and item code." }, { status: 400 });

  try {
    const data = parsed.data;
    const item = await prisma.$transaction(async (transaction) => {
      const created = await transaction.storeItem.create({
        data: {
          sku: data.sku,
          kind: data.kind,
          priceCoins: data.priceCoins,
          name: data.nameEn,
          description: data.descriptionEn,
          enabled: true,
          translations: {
            create: [
              { locale: Locale.EN, name: data.nameEn, description: data.descriptionEn },
              { locale: Locale.TA, name: data.nameTa, description: data.descriptionTa },
            ],
          },
        },
        select: { id: true, sku: true },
      });
      await transaction.auditLog.create({
        data: { actorId: user.id, action: "store_item.created", entityType: "StoreItem", entityId: created.id },
      });
      return created;
    });
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "That item code is already in use." }, { status: 409 });
    }
    logError("admin.store_item.create_failed", error, { userId: user.id });
    return NextResponse.json({ error: "Unable to create the store item." }, { status: 500 });
  }
}
