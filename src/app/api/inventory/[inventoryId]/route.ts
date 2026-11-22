import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentStudent } from "@/lib/auth/identity";
import { isSameOrigin } from "@/lib/auth/request";
import { logError } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ inventoryId: string }> };
const equipSchema = z.object({ equipped: z.boolean() });

export async function PATCH(request: NextRequest, context: RouteContext) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const identity = await getCurrentStudent();
  if (!identity) return NextResponse.json({ error: "Sign in as a student to manage inventory." }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const parsed = equipSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Choose whether to equip this item." }, { status: 400 });
  }
  const shouldEquip = parsed.data.equipped;
  const { inventoryId } = await context.params;

  try {
    const result = await prisma.$transaction(async (transaction) => {
      const inventory = await transaction.inventoryItem.findFirst({
        where: { id: inventoryId, studentId: identity.studentId },
        select: { id: true, storeItem: { select: { kind: true } } },
      });
      if (!inventory) return { error: "Inventory item not found.", status: 404 as const };

      if (shouldEquip) {
        await transaction.inventoryItem.updateMany({
          where: { studentId: identity.studentId, storeItem: { kind: inventory.storeItem.kind } },
          data: { equippedAt: null },
        });
      }
      await transaction.inventoryItem.update({
        where: { id: inventory.id },
        data: { equippedAt: shouldEquip ? new Date() : null },
      });
      return { equipped: shouldEquip };
    }, { isolationLevel: "Serializable" });

    if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json(result);
  } catch (error) {
    logError("inventory.equip_failed", error, { studentId: identity.studentId, inventoryId });
    return NextResponse.json({ error: "Unable to update your inventory." }, { status: 500 });
  }
}
