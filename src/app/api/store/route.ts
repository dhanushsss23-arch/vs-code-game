import { NextRequest, NextResponse } from "next/server";
import { CoinTransactionType } from "@prisma/client";
import { z } from "zod";
import { getCurrentStudent } from "@/lib/auth/identity";
import { isSameOrigin } from "@/lib/auth/request";
import { logError } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

const purchaseSchema = z.object({ storeItemId: z.string().min(1) });

export async function GET() {
  const identity = await getCurrentStudent();
  if (!identity) return NextResponse.json({ error: "Sign in as a student to visit the marketplace." }, { status: 401 });

  try {
    const [wallet, items, ownedItems] = await Promise.all([
      prisma.wallet.findUnique({ where: { studentId: identity.studentId }, select: { balance: true } }),
      prisma.storeItem.findMany({
        where: { enabled: true },
        orderBy: [{ kind: "asc" }, { priceCoins: "asc" }],
        select: {
          id: true,
          sku: true,
          name: true,
          description: true,
          kind: true,
          priceCoins: true,
          translations: { where: { locale: identity.user.preferredLocale }, take: 1, select: { name: true, description: true } },
          inventory: { where: { studentId: identity.studentId }, select: { id: true } },
        },
      }),
      prisma.inventoryItem.findMany({
        where: { studentId: identity.studentId },
        orderBy: { acquiredAt: "desc" },
        select: {
          id: true,
          equippedAt: true,
          storeItem: {
            select: {
              id: true,
              sku: true,
              name: true,
              description: true,
              kind: true,
              translations: { where: { locale: identity.user.preferredLocale }, take: 1, select: { name: true, description: true } },
            },
          },
        },
      }),
    ]);
    return NextResponse.json({
      balance: wallet?.balance ?? 0,
      items: items.map((item) => ({
        ...item,
        localizedName: item.translations[0]?.name ?? item.name,
        localizedDescription: item.translations[0]?.description ?? item.description,
        owned: item.inventory.length > 0,
        inventory: undefined,
        translations: undefined,
      })),
      inventory: ownedItems.map((item) => ({
        id: item.id,
        equipped: Boolean(item.equippedAt),
        storeItem: {
          ...item.storeItem,
          localizedName: item.storeItem.translations[0]?.name ?? item.storeItem.name,
          localizedDescription: item.storeItem.translations[0]?.description ?? item.storeItem.description,
          translations: undefined,
        },
      })),
    });
  } catch (error) {
    logError("store.read_failed", error, { studentId: identity.studentId });
    return NextResponse.json({ error: "Unable to load the marketplace." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const identity = await getCurrentStudent();
  if (!identity) return NextResponse.json({ error: "Sign in as a student to purchase items." }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const parsed = purchaseSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Choose an item from the store." }, { status: 400 });

  try {
    const result = await prisma.$transaction(async (transaction) => {
      const item = await transaction.storeItem.findFirst({
        where: { id: parsed.data.storeItemId, enabled: true },
        select: { id: true, sku: true, priceCoins: true },
      });
      if (!item) return { error: "This item is no longer available.", status: 404 as const };

      const owned = await transaction.inventoryItem.findUnique({
        where: { studentId_storeItemId: { studentId: identity.studentId, storeItemId: item.id } },
        select: { id: true },
      });
      if (owned) return { error: "You already own this item.", status: 409 as const };

      const debit = await transaction.wallet.updateMany({
        where: { studentId: identity.studentId, balance: { gte: item.priceCoins } },
        data: { balance: { decrement: item.priceCoins } },
      });
      if (debit.count !== 1) return { error: "You don't have enough coins for this item.", status: 409 as const };

      const wallet = await transaction.wallet.findUniqueOrThrow({
        where: { studentId: identity.studentId },
        select: { id: true, balance: true },
      });
      const ledger = await transaction.coinTransaction.create({
        data: {
          walletId: wallet.id,
          type: CoinTransactionType.ITEM_PURCHASE,
          amount: item.priceCoins,
          balanceAfter: wallet.balance,
          idempotencyKey: `purchase:${item.sku}`,
          reference: item.id,
        },
        select: { id: true },
      });
      const inventory = await transaction.inventoryItem.create({
        data: {
          studentId: identity.studentId,
          storeItemId: item.id,
          purchaseTransactionId: ledger.id,
        },
        select: { id: true },
      });
      return { inventoryId: inventory.id, balance: wallet.balance };
    });

    if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "This item was already purchased." }, { status: 409 });
    }
    logError("store.purchase_failed", error, { studentId: identity.studentId });
    return NextResponse.json({ error: "Unable to complete this purchase." }, { status: 500 });
  }
}

export const runtime = "nodejs";
